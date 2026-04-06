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
