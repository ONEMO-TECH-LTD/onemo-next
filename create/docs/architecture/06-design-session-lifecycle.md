# 06 — DesignSession Lifecycle

> The customer design flow: draft → configured → proofed → approved → purchased → fulfilled.

## Phase: [v2]

## State Machine [v2]

```
[start] → draft → configured → proofed → approved → purchased → fulfilled
                      ↑            ↑          ↑
                      └── edit ─────┘          │
                                    └── revalidation (commerce-driven)
```

| State | Meaning | Transition trigger |
|-------|---------|-------------------|
| `draft` | Design exists but not proof-ready | First save after intake |
| `configured` | Product context + placement set | Valid configuration saved |
| `proofed` | Review/proof generated | Review endpoint returns ready |
| `approved` | User accepted proof | Explicit approve action |
| `purchased` | Checkout succeeded | Shopify webhook confirms order |
| `fulfilled` | Manufacturing complete | Ops marks fulfillment |

### Important rule
Approval expiry is a **Commerce-owned validity overlay**, not a Create state. Commerce can force `approved → proofed` revalidation without mutating the design revision.

## Create Live Flow [v2]

From V3 architecture §6.2:

1. Route loads published `ProductSpec` + `ScenePreset`
2. Viewer mounts `EffectRenderer` via product registry
3. User uploads original artwork → signed Cloudinary upload
4. Create initial `DesignSession` draft in Supabase
5. User drags/scales artwork on 3D surface
6. Client generates normalized applied texture → uploads to Cloudinary
7. Autosave writes canonical `DesignSession`, bumps `design_revision`
8. Optional owner preview is client-captured (continuity only)

## Review Flow [v2→v3]

From V3 architecture §6.3:

1. `POST /api/designs/:id/review`
2. Server validates: schema, product constraints, applied texture hash matches current placement, scene preset version exists
3. If `ready` or `warning`: enqueue preview job for current revision [v3]
4. Worker loads internal render page, captures screenshots, uploads to Cloudinary [v3]

### Transform Hash Invariant

Review is rejected if `artwork.transformHash` doesn't match the current placement. Prevents stale renders entering the proof pipeline.

## Resume / Continuity [v2]

From UX interaction architecture (IA-11):

- Resume opens the same draft shell, not a blank create entry
- Last coherent design state rehydrated before secondary enrichments
- Missing enrichments (previews, shares) explicitly marked until refreshed
- Works across session breaks and account upgrades

## URL Routing [v2]

From UX interaction architecture:

| Route | Container | Purpose |
|-------|-----------|---------|
| `/create` | Screen (IA-01) | Intake — start episode, first credible preview |
| `/create/{draftId}` | Shell (IA-02) | Active draft — resume, edit, compare |
| `/create/{draftId}?mode=compose` | Mode (IA-03) | Placement and detail tuning |
| `/create/{draftId}?mode=configure` | Mode (IA-04) | Material/color/size comparison |
| `/create/{draftId}/review` | Screen (IA-05) | Proof boundary — trust, revise, proceed |
| `/share/private/{shareRef}` | Screen (IA-06) | Private share + feedback |
| `/presentation/{presentationRef}` | Screen (IA-07) | Public presentation |

## Autosave Strategy [v2]

- Save on meaningful change (color switch, placement move, material change)
- Debounce: 2-second quiet period before write
- Bump `design_revision` on every save
- Do NOT generate public/order previews on autosave (expensive, noisy, wrong)
- Owner preview is client-captured for continuity only

## Cross-Module Transitions [v2]

| From | To | What transfers |
|------|-----|---------------|
| Create → Library | DesignSession becomes resumable draft | Canonical design state |
| Create → Commerce | Approved revision eligible for cart | design_id, revision, variant_id |
| Create → Share | Design becomes shareable | preview_ref, design context |
| Commerce → Library | Purchase becomes owned outcome | order_id, design lineage |

## Server Use Cases — Transaction Scripts [v2]

Use cases are the real orchestration layer. Route Handlers stay thin.

```typescript
// server/use-cases/createDesignDraft.ts
async function createDesignDraft(
  repos: Repositories,
  input: {
    userId: string
    productFamily: string
    templateId: string
  }
): Promise<DesignSession> {
  // 1. Load published ProductSpec for the family
  const spec = await repos.productSpec.getPublished(input.productFamily)

  // 2. Load published ScenePreset (or extract from .onemo)
  const preset = await repos.scenePreset.getPublished(spec.id)

  // 3. Resolve default subtype + construction method
  const defaultRoute = spec.payload.subtype_routes[0]

  // 4. Create initial DesignSession with pinned versions
  const session = await repos.designSession.create({
    userId: input.userId,
    templateId: input.templateId,
    productSpecId: spec.id,
    productSpecVersion: spec.version,
    scenePresetId: preset.id,
    scenePresetVersion: preset.version,
    effectVariant: {
      subtype: defaultRoute.subtype,
      constructionMethod: defaultRoute.construction_method,
    },
  })

  return session
}
```

```typescript
// server/use-cases/autosaveDesign.ts
async function autosaveDesign(
  repos: Repositories,
  input: {
    designId: string
    surfaceAppearance: Record<string, SurfaceAppearance>
    placements: Placement[]
    artwork?: ArtworkUpdate
  }
): Promise<{ revision: number }> {
  // 1. Load current session
  const session = await repos.designSession.get(input.designId)

  // 2. Apply changes
  session.surfaceAppearance = input.surfaceAppearance
  session.placements = input.placements
  if (input.artwork) {
    session.artwork = {
      ...session.artwork,
      ...input.artwork,
      transformHash: computeTransformHash(input.placements, input.artwork),
    }
  }

  // 3. Bump revision + save
  session.designRevision += 1
  session.modifiedAt = new Date().toISOString()
  const result = await repos.designSession.save(session)

  return result
}

function computeTransformHash(placements: Placement[], artwork: ArtworkUpdate): string {
  const input = JSON.stringify({ placements, artworkAssetId: artwork.appliedTextureAssetId })
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}
```

```typescript
// server/use-cases/reviewDesign.ts
async function reviewDesign(
  repos: Repositories,
  designId: string
): Promise<ReviewResult> {
  const session = await repos.designSession.get(designId)
  const spec = await repos.productSpec.getById(session.productSpecRef.id)

  const issues: ReviewIssue[] = []

  // 1. Schema validation
  const parseResult = DesignSessionSchema.safeParse(session)
  if (!parseResult.success) {
    issues.push({ severity: 'blocked', message: 'Invalid design schema', details: parseResult.error })
  }

  // 2. Product constraint validation
  const placement = session.placements[0]
  if (placement) {
    const printArea = spec.payload.print_areas.find(p => p.surface_id === placement.surface_id)
    if (printArea) {
      if (placement.x < printArea.safe_bounds.x_min || placement.x > printArea.safe_bounds.x_max ||
          placement.y < printArea.safe_bounds.y_min || placement.y > printArea.safe_bounds.y_max) {
        issues.push({ severity: 'warning', message: 'Artwork extends beyond safe area' })
      }
    }
  }

  // 3. Transform hash check — reject stale applied textures
  if (session.artwork) {
    const expectedHash = computeTransformHash(session.placements, session.artwork)
    if (session.artwork.transformHash !== expectedHash) {
      issues.push({ severity: 'blocked', message: 'Applied texture is stale — regenerate before review' })
    }
  }

  // 4. Scene preset version check
  try {
    await repos.scenePreset.getPublished(session.scenePresetRef.id)
  } catch {
    issues.push({ severity: 'warning', message: 'Scene preset version no longer published' })
  }

  const blocked = issues.some(i => i.severity === 'blocked')
  const status = blocked ? 'blocked' : issues.length > 0 ? 'warning' : 'ready'

  // 5. If ready or warning, enqueue preview generation [v3]
  if (!blocked) {
    await repos.designSession.updateCreateState(designId, 'proofed')
    // Preview generation job enqueued in v3
  }

  return { status, issues, designRevision: session.designRevision }
}

interface ReviewResult {
  status: 'ready' | 'warning' | 'blocked'
  issues: ReviewIssue[]
  designRevision: number
}

interface ReviewIssue {
  severity: 'blocked' | 'warning' | 'info'
  message: string
  details?: unknown
}
```

```typescript
// server/use-cases/approveDesign.ts
async function approveDesign(
  repos: Repositories,
  designId: string,
  revision: number
): Promise<void> {
  const session = await repos.designSession.get(designId)

  // Verify the revision matches current
  if (session.designRevision !== revision) {
    throw new Error(`Revision mismatch: expected ${session.designRevision}, got ${revision}`)
  }

  await repos.designSession.updateCreateState(designId, 'ready_for_checkout')

  // Trigger manufacturing compile [v3]
  // await repos.manufacturing.enqueue(designId, revision)
}
```

## API Route Handlers [v2]

```typescript
// app/api/designs/route.ts
export async function POST(req: Request) {
  const actor = await getRequestActor(req)
  const body = await req.json()
  const repos = createRepositories()
  const session = await createDesignDraft(repos, {
    userId: actor.userId,
    productFamily: body.productFamily,
    templateId: body.templateId,
  })
  return Response.json(session, { status: 201 })
}

// app/api/designs/[id]/route.ts
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const repos = createRepositories()
  const result = await autosaveDesign(repos, { designId: params.id, ...body })
  return Response.json(result)
}

// app/api/designs/[id]/review/route.ts
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const repos = createRepositories()
  const result = await reviewDesign(repos, params.id)
  return Response.json(result)
}

// app/api/designs/[id]/approve/route.ts
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { revision } = await req.json()
  const repos = createRepositories()
  await approveDesign(repos, params.id, revision)
  return Response.json({ approved: true })
}
```

## Client Hooks [v2]

```typescript
// create/useDesignSession.ts
function useDesignSession(templateId: string) {
  const [session, setSession] = useState<DesignSession | null>(null)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<NodeJS.Timeout>()

  // Create or resume draft
  useEffect(() => {
    async function init() {
      // Check for existing draft for this template
      const res = await fetch(`/api/designs?templateId=${templateId}&mine=true`)
      const { designs } = await res.json()
      if (designs.length > 0) {
        setSession(designs[0])  // resume
      } else {
        const res = await fetch('/api/designs', {
          method: 'POST',
          body: JSON.stringify({ productFamily: 'effect', templateId }),
        })
        setSession(await res.json())  // new draft
      }
    }
    init()
  }, [templateId])

  // Debounced autosave (2s quiet period)
  const queueSave = useCallback((changes: Partial<DesignSession>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSession(prev => prev ? { ...prev, ...changes } : prev)
    saveTimerRef.current = setTimeout(async () => {
      if (!session) return
      setSaving(true)
      await fetch(`/api/designs/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
      setSaving(false)
    }, 2000)
  }, [session?.id])

  return { session, saving, queueSave }
}
```
