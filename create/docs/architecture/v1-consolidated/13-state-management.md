# 13 — State Management

> Three-class state split. Canonical server truth, working client edits, interaction runtime refs.
> Consolidation decision D2: P2's model with P1's tools.

## Phase: [Phase 2]

## The Three State Classes [Phase 2]

State in Create is split into three explicit classes. Mixing them causes sync bugs and stale proof state.

### Class 1: Canonical Server State

**What it is:** The persisted truth. Published artifacts, design head row, confirmed revisions, preview assets, checkout intent.

**Managed by:** React Query (TanStack Query)

**Characteristics:**
- Server is the source of truth
- Reads are cached, invalidated on mutation
- Mutations are optimistic where safe (autosave), pessimistic where not (approve, checkout)
- Stale data is explicitly surfaced, never silently used for proof or commerce

```typescript
// Canonical state queries
const productSpec = useQuery(['productSpec', specId], () => repos.productSpec.getPublished(specId))
const scenePreset = useQuery(['scenePreset', presetId], () => repos.scenePreset.getPublished(presetId))
const designHead = useQuery(['design', designId], () => repos.designHead.getHead(designId))
const previewStatus = useQuery(['previews', designId, revision], () => repos.previews.getByRevision(designId, revision))
```

### Class 2: Working Client State

**What it is:** Optimistic local edits that haven't been confirmed by the server yet. Panel mode, unsaved patch queue, compare state, undo stack.

**Managed by:** Zustand store

**Characteristics:**
- Client-owned, ephemeral across sessions (but autosaved regularly)
- Reconciled with server on save confirmation
- Lost on hard refresh (acceptable — last confirmed state resumes from server)
- Never used for proof, commerce, or manufacturing

```typescript
interface WorkspaceStore {
  // Current edit state (optimistic)
  pendingPatches: DesignPatch[]
  surfaceAppearance: Record<string, SurfaceAppearance>
  placements: Placement[]
  
  // UI mode
  activeMode: 'compose' | 'configure' | 'review'
  activeCameraPresetId: string
  
  // Compare state
  compareDirection: DesignSnapshot | null
  knownGoodSnapshot: DesignSnapshot | null
  
  // Save state
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  lastSavedRevision: number
  
  // Actions
  applyPatch: (patch: DesignPatch) => void
  revertToKnownGood: () => void
  setMode: (mode: 'compose' | 'configure' | 'review') => void
}
```

### Class 3: Interaction Runtime State

**What it is:** Raw gesture deltas, hover state, camera pose, frame metrics. These change every frame during interaction and must NEVER be reactive app state.

**Managed by:** Plain refs (`useRef`)

**Characteristics:**
- Changes at 60fps during gestures
- Never triggers React re-renders
- Committed to Class 2 on gesture settle / debounce
- Disposed when the gesture ends

```typescript
// Interaction refs — never useState, never Zustand
const dragDelta = useRef({ dx: 0, dy: 0 })
const pinchScale = useRef(1)
const rotationDelta = useRef(0)
const currentCameraPose = useRef<CameraPose>(null)
const frameMetrics = useRef({ fps: 60, drawCalls: 0 })
const isGestureActive = useRef(false)

// Gesture settle → commit to workspace store
function onGestureEnd() {
  isGestureActive.current = false
  const placement = reconcileGestureToPlacement(dragDelta.current, pinchScale.current, rotationDelta.current)
  workspaceStore.getState().applyPatch({ type: 'placement', value: placement })
  // Reset refs
  dragDelta.current = { dx: 0, dy: 0 }
  pinchScale.current = 1
  rotationDelta.current = 0
}
```

## Why This Split Is Correct [Phase 2]

| Problem | What causes it | How the split prevents it |
|---------|---------------|--------------------------|
| Stale proof state | Client edits used for proof instead of server-confirmed revision | Proof reads Class 1 only (confirmed revision snapshot) |
| 60fps React churn | Drag deltas in useState | Class 3 uses refs, never triggers renders |
| Sync bugs after resume | Client state diverged from server during session break | Class 1 (React Query) rehydrates from server on resume; Class 2 rebuilds from Class 1 |
| Optimistic save conflicts | Two tabs editing same design | Class 1 uses server revision number for conflict detection |

## AutosaveController [Phase 2]

Bridges Class 2 → Class 1:

```typescript
class AutosaveController {
  private timer: NodeJS.Timeout | null = null
  private readonly DEBOUNCE_MS = 2000

  constructor(
    private store: WorkspaceStore,
    private queryClient: QueryClient,
    private designId: string,
  ) {
    // Subscribe to workspace changes
    this.store.subscribe((state, prev) => {
      if (state.pendingPatches.length > prev.pendingPatches.length) {
        this.scheduleFlush()
      }
    })
  }

  private scheduleFlush() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), this.DEBOUNCE_MS)
  }

  private async flush() {
    const patches = this.store.getState().pendingPatches
    if (patches.length === 0) return

    this.store.setState({ saveStatus: 'saving' })

    try {
      const result = await fetch(`/api/designs/${this.designId}`, {
        method: 'PATCH',
        body: JSON.stringify({ patches }),
      })
      const { revision } = await result.json()

      // Clear flushed patches, update revision
      this.store.setState({
        pendingPatches: [],
        saveStatus: 'saved',
        lastSavedRevision: revision,
      })

      // Invalidate server cache
      this.queryClient.invalidateQueries(['design', this.designId])
    } catch {
      this.store.setState({ saveStatus: 'error' })
    }
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer)
  }
}
```

## Action Safety Envelope [Phase 2]

From UX content models (CM-014): cross-cutting guard that prevents duplicate triggers and silent loss.

```typescript
interface ActionSafetyState {
  guards: Map<string, ActionGuard>
}

interface ActionGuard {
  actionKind: string  // 'save' | 'review' | 'approve' | 'share' | 'checkout'
  status: 'idle' | 'in_progress' | 'succeeded' | 'failed'
  lastConfirmedRef?: string
  retryContext?: string
}

// Usage: prevent double-submit on review
function useActionSafety(kind: string) {
  const guard = useStore(s => s.guards.get(kind))
  const isBlocked = guard?.status === 'in_progress'
  
  const execute = async (fn: () => Promise<void>) => {
    if (isBlocked) return  // suppress duplicate
    setGuard(kind, { status: 'in_progress' })
    try {
      await fn()
      setGuard(kind, { status: 'succeeded' })
    } catch {
      setGuard(kind, { status: 'failed' })
    }
  }

  return { isBlocked, execute }
}
```
