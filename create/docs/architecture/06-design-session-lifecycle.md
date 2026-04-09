# 06 — DesignSession Lifecycle

> The customer design flow: draft → configured → proofed → approved → purchased → fulfilled.
> Consolidation: U1 (immutable revision snapshots on every save), U4 (CheckoutIntent separation).

## Phase: [Phase 2]

## State Machine [Phase 2]

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

### Important Rules
- Approval expiry is a **Commerce-owned validity overlay**, not a Create state. Commerce can force `approved → proofed` revalidation without mutating the design revision.
- Every save appends an immutable revision snapshot (U1). The mutable head row is for fast resume. Proof, commerce, manufacturing, and share always reference a revision snapshot.

## Create Live Flow [Phase 2]

1. Route loads published `ProductSpec` + `ScenePreset`
2. Loading state while scene initializes
3. Viewer mounts product renderer via product registry
4. User uploads original artwork → signed Cloudinary upload
5. Create initial `DesignSession` draft in Supabase (mutable head)
6. User drags/scales artwork on 3D surface
7. Client generates normalized applied texture → uploads to Cloudinary
8. Autosave writes canonical head row + appends revision snapshot, bumps `design_revision`
9. Optional owner preview is client-captured (continuity only)

## Revision Snapshot Flow (U1) [Phase 2]

Every autosave appends an immutable snapshot:

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
  // 1. Load current head
  const session = await repos.designHead.get(input.designId)

  // 2. Apply changes
  session.surface_appearance = input.surfaceAppearance
  session.placements = input.placements
  if (input.artwork) {
    session.artwork = {
      ...session.artwork,
      ...input.artwork,
      transform_hash: computeTransformHash(input.placements, input.artwork),
    }
  }

  // 3. Bump revision + save mutable head
  session.design_revision += 1
  session.modified_at = new Date().toISOString()
  const result = await repos.designHead.save(session)

  // 4. Append immutable revision snapshot (U1)
  await repos.designRevision.append(
    input.designId,
    session.design_revision,
    session
  )

  return result
}
```

## Review Flow [Phase 2→Phase 3]

Review now uses CompatibilityEngine (U5) instead of ad-hoc validation:

```typescript
// server/use-cases/reviewDesign.ts
async function reviewDesign(
  repos: Repositories,
  designId: string
): Promise<ReviewResult> {
  const session = await repos.designHead.get(designId)
  const spec = await repos.productSpec.getById(session.product_spec_ref.id)
  const preset = await repos.scenePreset.getPublished(session.scene_preset_ref.id)

  // Use CompatibilityEngine for all validation (U5)
  const results = evaluateCompatibility({
    session,
    spec,
    preset,
    currentTime: new Date(),
  })

  const hasBlock = results.some(r => r.severity === 'COMP_BLOCK')

  if (!hasBlock) {
    await repos.designHead.updateCreateState(designId, 'proofed')
    // Enqueue preview generation for current revision [Phase 3]
    // Preview captures from the immutable revision snapshot, not the mutable head
  }

  return {
    status: hasBlock ? 'blocked' : results.length > 0 ? 'warning' : 'ready',
    compatibility: results,
    designRevision: session.design_revision,
  }
}

interface ReviewResult {
  status: 'ready' | 'warning' | 'blocked'
  compatibility: CompatibilityResult[]
  designRevision: number
}
```

## Approve Flow [Phase 2→Phase 3]

Approval re-validates and records the exact approved revision:

```typescript
// server/use-cases/approveDesign.ts
async function approveDesign(
  repos: Repositories,
  designId: string,
  revision: number
): Promise<void> {
  // 1. Load the immutable snapshot — not the mutable head
  const snapshot = await repos.designRevision.getByRevision(designId, revision)
  const spec = await repos.productSpec.getById(snapshot.product_spec_ref.id)

  // 2. Re-validate at approval time (freshness check)
  const results = evaluateCompatibility({
    session: snapshot.snapshot,
    spec,
    currentTime: new Date(),
  })

  if (results.some(r => r.severity === 'COMP_BLOCK')) {
    throw new Error('Design cannot be approved: compatibility check failed')
  }

  // 3. Mark as approved
  await repos.designHead.updateCreateState(designId, 'approved')

  // 4. Trigger manufacturing compile from revision snapshot [Phase 4]
  // await repos.manufacturing.enqueue(designId, revision)
}
```

## Resume / Continuity [Phase 2]

From UX interaction architecture (IA-11):

- Resume opens the same draft shell, not a blank create entry
- Last coherent design state rehydrated from **mutable head row** (fast reads)
- If head row is suspect, fall back to **latest revision snapshot** (always consistent)
- Missing enrichments (previews, shares) explicitly marked until refreshed
- Works across session breaks and account upgrades

```typescript
// Resume strategy
async function resumeDesign(repos: Repositories, designId: string): Promise<DesignSession> {
  try {
    // Primary: resume from mutable head (fast)
    return await repos.designHead.get(designId)
  } catch {
    // Fallback: rebuild from latest immutable snapshot
    const latest = await repos.designRevision.getLatest(designId)
    return latest.snapshot
  }
}
```

## URL Routing [Phase 2]

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

## Autosave Strategy [Phase 2]

- Save on meaningful change (color switch, placement move, material change)
- Debounce: 2-second quiet period before write (AutosaveController)
- Bump `design_revision` on every save
- Append immutable revision snapshot on every save (U1)
- Do NOT generate public/order previews on autosave (expensive, noisy, wrong)
- Owner preview is client-captured for continuity only
- AutosaveController implementation: see [13-state-management.md](13-state-management.md)

## Cross-Module Transitions [Phase 2+]

| From | To | What transfers |
|------|-----|---------------|
| Create → Library | DesignSession becomes resumable draft | Canonical design state (mutable head) |
| Create → Commerce | Approved revision eligible for checkout | CheckoutIntent (from revision snapshot) |
| Create → Share | Design becomes shareable | preview_ref, design context (from revision snapshot) |
| Commerce → Library | Purchase becomes owned outcome | order_id, design lineage |
| Create → Manufacturing | Approved revision compiled | ManufacturingPackage (from revision snapshot) |

## Server Use Cases [Phase 2]

```typescript
// server/use-cases/createDesignDraft.ts
async function createDesignDraft(
  repos: Repositories,
  input: {
    userId: string
    productFamily: string
    templateId: string
    createContext?: 'direct' | 'remix' | 'ai_intake'
    imageSource?: ImageSource
  }
): Promise<DesignSession> {
  // 1. Load published ProductSpec for the family
  const spec = await repos.productSpec.getPublished(input.productFamily)

  // 2. Load published ScenePreset
  const preset = await repos.scenePreset.getPublished(spec.id)

  // 3. Resolve default subtype + construction method
  const defaultRoute = spec.payload.subtype_routes[0]

  // 4. Create initial DesignSession with pinned versions
  const session = await repos.designHead.create({
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
    createContext: input.createContext ?? 'direct',
    imageSource: input.imageSource,
    scenePackageHash: preset.payload.scene_package_ref.package_hash,
  })

  // 5. Append initial revision snapshot (revision 0)
  await repos.designRevision.append(session.id, 0, session)

  return session
}
```

## API Route Handlers [Phase 2]

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
    createContext: body.createContext,
    imageSource: body.imageSource,
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
