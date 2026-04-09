# ONEMO Create Module — Production Architecture (Review Track)

## Call on the existing draft

The current draft is a good base, but it is **not shippable as-is**.

Keep:
- top-level `create/` module
- shared viewer core under `create/core`
- product-family module registry
- browser-capture render factory
- file-backed + Supabase repository split
- phased migration from prototype

Fix immediately:
1. **Kill stale Theatre assumptions.** DEC S42 already made Three.js scene graph canonical. Published Create runtime must not depend on Theatre concepts.
2. **Do not treat `.onemo` as the canonical artifact.** `.onemo` is an immutable runtime bundle produced from a published `ScenePreset`. `ScenePreset` remains the canonical DB artifact.
3. **Add immutable revision snapshots.** A mutable `designs` head row without append-only snapshots breaks proof, share, order replay, and manufacturing reproducibility.
4. **Do not make client-generated applied textures canonical.** Canonical truth is original asset + placement + texture policy. Preview textures are derivatives.
5. **Separate design truth from commerce intent.** Add-ons, bundles, and mixed-cart state belong in `CheckoutIntent`, not in `DesignSession`.
6. **Make compatibility a first-class domain service.** It must not live inside UI components or Shopify mapping code.

---

## 1) System overview

Create is the customer-facing 3D product runtime for ONEMO’s custom Effect flow.

It sits:
- downstream of **Product System** (`ProductSpec`)
- downstream of **Studio** (`ScenePreset` + `.onemo` bundle)
- upstream of **Commerce** (Shopify cart/checkout)
- upstream of **Manufacturing** (`ManufacturingPackage`)
- adjacent to **Library / Share / Public Presentation** through preview/render outputs

### Inputs

1. **Entry context**
   - configurable catalog entry
   - preset link
   - saved draft
   - remix/public share seed
2. **Published product truth**
   - `ProductSpec`
3. **Published render truth**
   - `ScenePreset`
   - immutable `.onemo` runtime bundle
4. **Image intake**
   - upload at launch
   - `generation`, `connected_import`, `wallet_import` later through the same intake contract
5. **Identity / continuity**
   - anonymous session or authenticated user
6. **Feature flags**
   - back-side view, bundle suggestions, latent attachment tracks, AI hooks

### Outputs

1. **Canonical design state**
   - `designs` head row
   - append-only `design_revision_snapshots`
2. **Derived assets**
   - live texture cache
   - owner/public/order previews
   - fallback stills
   - catalog/listing captures
3. **Commerce handoff**
   - `CheckoutIntent`
   - Shopify cart + checkout URL
4. **Production handoff**
   - immutable `ManufacturingPackage`
5. **Share/remix seeds**
   - preview refs
   - lineage refs
   - visibility/share metadata

### One-sentence architecture call

**Create is a thin customer shell over a shared Three.js runtime, backed by canonical artifacts, append-only design revisions, a unified render factory, and a strict separation between design truth, preview derivatives, commerce intent, and manufacturing output.**

---

## 2) Component architecture

## 2.1 Layer map

```text
UI shell
  CreatePage / ReviewPage / ProofPanel / BacksideSheet / BundleDrawer

Client state
  React Query (server state)
  WorkspaceStore (ephemeral edit state)
  AutosaveController (patch queue -> server)

Application services
  ResolveCreateBootstrap
  CreateDraft / ResumeDraft
  CommitDesignPatch
  RequestReview
  ApproveRevision
  BuildCheckoutIntent
  EnqueuePreviewCapture
  EnqueueManufacturingCompile

Domain
  ProductSpec / ScenePreset / DesignSession / ManufacturingPackage
  CompatibilityEngine
  PlacementNormalizer
  SafeAreaValidator
  TransformHash
  TexturePolicy
  VariantProjectionKey

Runtime
  ScenePackageLoader
  ViewerShell
  Effect runtime module
  TextureComposer
  RenderReadyLatch
  FallbackStillRuntime

Infrastructure / adapters
  Supabase repositories
  ScenePackageStore (R2/S3/CDN)
  AssetStore (Cloudinary)
  ShopifyGateway
  JobQueue
  RenderWorker
```

### Dependency rule

- UI depends on application contracts, never directly on Supabase or Shopify.
- Application depends on domain + ports.
- Domain depends on nothing framework-specific.
- Runtime depends on domain value objects + Three.js/R3F.
- Infrastructure implements ports and is the only layer allowed to know provider SDKs.

## 2.2 Directory structure

```text
create/
├── core/
│   ├── viewer/
│   │   ├── ViewerShell.tsx
│   │   ├── CameraRig.tsx
│   │   ├── OrbitRig.tsx
│   │   ├── RenderReadyLatch.tsx
│   │   ├── FallbackSurface.tsx
│   │   └── scene-runtime.ts
│   ├── scene/
│   │   ├── ScenePackageLoader.ts
│   │   ├── scene-package-schema.ts
│   │   └── verify-scene-package.ts
│   ├── textures/
│   │   ├── TextureComposer.ts
│   │   └── texture-policy.ts
│   └── index.ts
│
├── products/
│   ├── registry.ts
│   └── effect/
│       ├── contracts.ts
│       ├── runtime/
│       │   ├── EffectRenderer.tsx
│       │   ├── SurfaceDiscovery.ts
│       │   ├── PlacementProjector.ts
│       │   ├── BacksidePresenter.ts
│       │   └── PairAndCapViews.tsx
│       ├── compiler/
│       │   ├── compileMethodA.ts
│       │   ├── compileMethodB.ts
│       │   ├── compileMethodC.ts
│       │   └── index.ts
│       └── index.ts
│
├── domain/
│   ├── artifacts/
│   │   ├── product-spec.ts
│   │   ├── scene-preset.ts
│   │   ├── design-session.ts
│   │   ├── design-revision.ts
│   │   ├── manufacturing-package.ts
│   │   └── checkout-intent.ts
│   ├── rules/
│   │   ├── compatibility.ts
│   │   ├── safe-area.ts
│   │   ├── transform-hash.ts
│   │   └── variant-projection.ts
│   └── value-objects/
│       ├── image-source.ts
│       ├── placement.ts
│       ├── preview.ts
│       └── review.ts
│
├── application/
│   ├── bootstrap/
│   ├── design-session/
│   ├── review/
│   ├── preview/
│   ├── commerce/
│   └── manufacturing/
│
├── infrastructure/
│   ├── repositories/
│   ├── assets/
│   ├── scene-packages/
│   ├── shopify/
│   ├── queue/
│   └── render/
│
├── state/
│   ├── workspace-store.ts
│   ├── create-query.ts
│   └── autosave-controller.ts
│
├── ui/
│   ├── shell/
│   ├── controls/
│   ├── overlays/
│   └── review/
│
├── render/
│   ├── pages/
│   └── worker/
│
├── CreateShell.tsx
└── index.ts
```

## 2.3 Viewer core

`create/core` is shared with Studio, but only the **runtime layer** is shared.

Responsibilities:
- canvas lifecycle
- camera and orbit constraints
- environment + tone mapping
- demand frameloop
- render-ready signaling
- fallback still mounting
- zero product knowledge

Non-responsibilities:
- surface discovery
- placement math
- product compatibility
- persistence
- commerce

## 2.4 Product modules

`ProductFamilyModule` is the runtime/manufacturing seam.

For launch, Create only needs `effect`, but the interface must support later `shaped-effect` and `garment` families.

Responsibilities of `products/effect`:
- discover `face`, `back`, `frame`, hardware surfaces from `userData.onemo.*`
- project placement onto the printable face
- expose cap/pair/back-side presentation variants
- resolve construction method from subtype + attachment context
- compile method A/B/C manufacturing outputs

Hard rule: mesh names are migration shims only. Production contract is GLB metadata.

## 2.5 Domain layer

This is where the current draft is too thin.

The domain layer must own:
- artifact schemas
- compatibility reason codes
- safe-area rules
- transform hashing
- purchase mode / attachment system semantics
- add-on vs design separation
- immutable revision model

UI components may render compatibility, but they may not interpret it privately.

## 2.6 Data layer

### Canonical storage

- `product_specs` — canonical product artifact
- `scene_presets` — canonical published scene artifact
- `designs` — mutable head row for fast resume
- `design_revision_snapshots` — append-only revision ledger
- `design_preview_assets` — preview/render outputs by revision + role
- `manufacturing_packages` — immutable production artifact
- `checkout_intents` — ephemeral but durable commerce handoff object
- `job_queue` — preview/manufacturing/projection sync jobs

### Storage split

- **ScenePackageStore**: `.onemo`, GLB, HDR, published fallback still sets
- **AssetStore**: uploaded originals, derived textures, preview images

Do not force `.onemo` into the same asset plane as user uploads.

## 2.7 State management

Do **not** XState the whole product.

Use:
- **React Query** for server-backed artifacts, head row, preview status, checkout intent
- **Zustand or reducer-based WorkspaceStore** for ephemeral UI state
- **AutosaveController** for patch batching and optimistic state reconciliation

### Canonical vs ephemeral state

**Canonical**
- `DesignSession` payload
- approved revision pointer
- preview assets by revision
- checkout intent

**Ephemeral**
- current tool (`compose`, `configure`, `review`)
- active camera preset
- orbit state
- active gesture
- optimistic unsaved patch queue
- degraded-mode flags
- sheet/modal visibility

### Why this split is correct

The design is a server-owned artifact. The workspace is a client-owned interaction shell. Mixing them creates sync bugs and stale proof state.

---

## 3) Data flows

## 3.1 Studio authoring -> published ScenePreset

```text
Studio authoring state
  -> export .onemo bundle (scene.glb + studio.json + env.hdr?)
  -> validate against ProductSpec + product module contracts
  -> compute package hash + mesh manifest hash
  -> upload immutable package to ScenePackageStore
  -> persist ScenePreset draft with package ref + runtime payload
  -> publish explicit new version
  -> trigger fallback/catalog capture generation
```

### Invariants
- `.onemo` is immutable and content-addressed by hash.
- `ScenePreset` is the canonical artifact that references the package.
- Create only loads published ScenePreset versions.
- Studio draft/editor junk never ships into customer runtime.

## 3.2 Customer creation flow

```text
Entry route
  -> ResolveCreateBootstrap
  -> load ProductSpec + ScenePreset + scene package
  -> mount ViewerShell + Effect runtime
  -> intake image source
  -> create draft head row if needed
  -> gesture / numeric edits
  -> normalize placement
  -> safe-area validation
  -> derive live texture
  -> append revision snapshot + update head row
```

### Important design choice

The live preview uses a derived texture, but the canonical truth is:
- original asset ref
- placement values
- texture policy
- transform hash

That is what proof, share, checkout, and manufacturing use.

## 3.3 Review / proof flow

```text
RequestReview(designId)
  -> flush pending patch queue
  -> snapshot exact revision
  -> validate schema + safe area + compatibility + artifact pins + asset availability
  -> status = ready | warning | blocked
  -> if ready/warning: build RenderSnapshot and enqueue preview jobs
  -> write preview asset refs by role + revision
  -> user approves exact revision
```

### Why snapshot first

Proof must run on an immutable revision. Never proof the mutable head row.

## 3.4 Share / public / remix flow

```text
Approved or share-eligible revision
  -> public preview capture
  -> public share metadata written outside Create UI
  -> remix route references public revision snapshot, not mutable head
  -> new draft inherits lineage but not private state
```

## 3.5 Commerce flow

```text
BuildCheckoutIntent
  -> load approved revision snapshot
  -> revalidate approval freshness + compatibility + sellability
  -> resolve Shopify merchandise projection
  -> add optional garment/pair/add-on lines
  -> create or update Shopify cart
  -> return checkoutUrl
  -> webhook binds order to design revision + checkout intent + manufacturing package
```

### Important rule

Mixed-cart state belongs in `CheckoutIntent`, not `DesignSession`.

## 3.6 Manufacturing flow

```text
ApproveRevision or OrderWebhook
  -> load revision snapshot + original asset + ProductSpec + ScenePreset
  -> select method compiler from resolved product context
  -> derive production-resolution raster from original asset + placement
  -> transform normalized coords to production coordinates
  -> write immutable ManufacturingPackage
  -> expose stable production_asset_ref
```

---

## 4) Interface contracts

The current baseline schemas are close, but they are already stale against the approved PRD and domain model. I would ship these as **v4 contracts**.

## 4.1 Core enums and value objects

```ts
import { z } from "zod"

export const ProductFamilySchema = z.enum(["effect", "garment", "shaped-effect"])
export const AttachmentSystemSchema = z.enum(["magnetic", "velcro", "both"])
export const PurchaseModeSchema = z.enum(["single", "pair"])
export const ImageSourceTypeSchema = z.enum([
  "upload",
  "generation",
  "connected_import",
  "wallet_import",
])

export const CompatibilitySeveritySchema = z.enum([
  "COMP_OK",
  "COMP_INFO",
  "COMP_ADVISORY",
  "COMP_BLOCK",
  "COMP_INACTIVE",
])

export const CompatibilityReasonCodeSchema = z.enum([
  "receiver_required",
  "pair_required",
  "attachment_system_mismatch",
  "cap_requires_active_receiver",
  "bundle_member_incompatible",
  "bundle_member_unavailable",
  "approval_expired",
  "track_not_active",
  "variant_unavailable",
  "public_state_not_shareable",
])

export const PinnedArtifactRefSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
})

export const ScenePackageRefSchema = z.object({
  package_id: z.string().min(1),
  package_hash: z.string().min(1),
  url: z.string().url(),
  environment_url: z.string().url().optional(),
  mesh_manifest_hash: z.string().min(1),
})
```

## 4.2 Scene runtime + product module contracts

```ts
export interface ViewerSceneRuntime {
  defaultCameraId: string
  cameras: CameraPreset[]
  orbitBounds: OrbitBounds
  lighting: LightingRig
  render: RenderSettings
  capturePresets: CapturePreset[]
  fallbackStillSetId?: string
}

export interface ProductFamilyModule {
  family: "effect" | "garment" | "shaped-effect"
  validateSpec(spec: ProductSpec): void
  buildSurfaceRegistry(args: {
    root: THREE.Object3D
    context: ResolvedProductContext
  }): SurfaceRegistry
  createRenderer(): React.ComponentType<ProductRendererProps>
  createCompiler(): ProductManufacturingCompiler
  getAttachmentPresentation(
    context: ResolvedProductContext,
  ): AttachmentPresentation | null
}

export interface SurfaceRegistry {
  byId: Record<string, SurfaceBinding>
  printableSurfaceId: string
  backsideSurfaceId?: string
  frameSurfaceId?: string
  hardwareSurfaceIds: string[]
}
```

## 4.3 Updated `ScenePreset`

```ts
export const ScenePresetSchemaV4 = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  version: z.number().int().positive(),
  status: z.enum(["draft", "published", "archived"]),
  family: ProductFamilySchema,
  product_spec_ref: PinnedArtifactRefSchema,
  scene_package: ScenePackageRefSchema,
  payload: z.object({
    target_subtypes: z.array(z.enum(["edge_trim", "plain", "tv_retro"])).min(1),
    runtime: z.custom<ViewerSceneRuntime>(),
    fallback_stills: z.array(z.object({
      role: z.enum(["front", "three_quarter", "side_detail", "back"]),
      asset_url: z.string().url(),
    })).min(1),
  }),
})
```

## 4.4 Updated `DesignSession`

```ts
export const DesignSessionSchemaV4 = z.object({
  version: z.literal(4),
  image_source: z.object({
    source_id: z.string().min(1),
    source_type: ImageSourceTypeSchema,
    original_asset_url: z.string().url(),
    rights_attestation_id: z.string().min(1).optional(),
  }),
  artifact_pins: z.object({
    product_spec: PinnedArtifactRefSchema,
    scene_preset: PinnedArtifactRefSchema,
    scene_package_hash: z.string().min(1),
  }),
  product_context: z.object({
    family: z.literal("effect"),
    subtype: z.enum(["edge_trim", "plain", "tv_retro"]),
    purchase_mode: PurchaseModeSchema,
    attachment_system: AttachmentSystemSchema,
    construction_method: z.enum([
      "method_a_edge_trim",
      "method_b_magnetic_caps",
      "method_c_tv_retro",
      "solid",
    ]),
    size: z.string().min(1),
    face_material: z.string().min(1),
    trim_back_colour: z.string().min(1),
  }),
  surface_appearance: z.record(z.string(), z.object({
    material_id: z.string().min(1),
    color_id: z.string().min(1),
    hex: z.string().optional(),
  })),
  artwork: z.object({
    original_asset_url: z.string().url(),
    live_texture_url: z.string().url().optional(),
    texture_policy_id: z.string().min(1),
    transform_hash: z.string().min(1),
  }),
  placements: z.array(z.object({
    id: z.string().min(1),
    surface_id: z.enum(["face", "back", "frame"]),
    coordinate_space: z.string().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    scale: z.number().positive(),
    rotation_deg: z.number(),
    crop_mode: z.enum(["cover", "contain"]),
  })).min(1),
})
```

## 4.5 Revision snapshot, review, preview, and checkout contracts

```ts
export const DesignRevisionSnapshotSchema = z.object({
  design_id: z.string().uuid(),
  revision: z.number().int().positive(),
  payload: DesignSessionSchemaV4,
  saved_from: z.enum(["autosave", "review", "approve", "recovery"]),
  created_at: z.string().datetime({ offset: true }),
})

export const CompatibilityResultSchema = z.object({
  severity: CompatibilitySeveritySchema,
  code: CompatibilityReasonCodeSchema,
  message: z.string().min(1),
  recovery_actions: z.array(z.object({
    kind: z.enum([
      "choose_receiver",
      "switch_purchase_mode",
      "switch_attachment_track",
      "remove_bundle_member",
      "choose_available_variant",
    ]),
    target_id: z.string().optional(),
  })).default([]),
})

export const ReviewOutcomeSchema = z.object({
  design_id: z.string().uuid(),
  revision: z.number().int().positive(),
  status: z.enum(["ready", "warning", "blocked"]),
  issues: z.array(z.object({
    severity: z.enum(["info", "warning", "error"]),
    code: z.string().min(1),
    message: z.string().min(1),
  })),
})

export const CheckoutIntentSchema = z.object({
  id: z.string().uuid(),
  approved_design: z.object({
    design_id: z.string().uuid(),
    revision: z.number().int().positive(),
  }),
  primary_line: z.object({
    merchandise_gid: z.string().min(1),
    quantity: z.number().int().positive(),
    attributes: z.record(z.string(), z.string()),
  }),
  add_on_lines: z.array(z.object({
    merchandise_gid: z.string().min(1),
    quantity: z.number().int().positive(),
    parent_line_key: z.string().optional(),
    attributes: z.record(z.string(), z.string()).default({}),
  })).default([]),
  compatibility_snapshot: z.array(CompatibilityResultSchema),
  expires_at: z.string().datetime({ offset: true }),
})
```

## 4.6 Manufacturing contract

```ts
export const ManufacturingPackageSchemaV4 = z.object({
  id: z.string().uuid(),
  design_ref: z.object({
    design_id: z.string().uuid(),
    revision: z.number().int().positive(),
  }),
  product_spec_ref: PinnedArtifactRefSchema,
  scene_preset_ref: PinnedArtifactRefSchema,
  compiler_version: z.string().min(1),
  method: z.enum([
    "method_a_edge_trim",
    "method_b_magnetic_caps",
    "method_c_tv_retro",
    "solid",
  ]),
  status: z.enum(["queued", "compiled", "failed", "approved"]),
  production_asset_ref: z.string().min(1),
  outputs: z.array(z.object({
    role: z.enum([
      "print_raster",
      "patch_raster",
      "cutline_svg",
      "registration_json",
      "qa_preview",
      "bom_json",
      "manufacturing_manifest",
    ]),
    asset_url: z.string().url(),
  })).min(1),
})
```

## 4.7 Repositories / ports

```ts
export interface ProductSpecRepository {
  getPublishedBySlug(slug: string): Promise<ProductSpec | null>
  getByIdVersion(id: string, version: number): Promise<ProductSpec | null>
}

export interface ScenePresetRepository {
  getPublishedBySlug(slug: string): Promise<ScenePreset | null>
  getByIdVersion(id: string, version: number): Promise<ScenePreset | null>
}

export interface DesignHeadRepository {
  createHead(input: NewDesignHead): Promise<{ designId: string; revision: number }>
  getHead(designId: string): Promise<DesignHead | null>
  updateHead(input: UpdateDesignHead): Promise<{ revision: number }>
  markApprovedRevision(designId: string, revision: number): Promise<void>
}

export interface DesignRevisionRepository {
  putSnapshot(snapshot: DesignRevisionSnapshot): Promise<void>
  getSnapshot(designId: string, revision: number): Promise<DesignRevisionSnapshot | null>
}

export interface ScenePackageStore {
  putPackage(input: PutScenePackageInput): Promise<ScenePackageRef>
  getPackage(ref: ScenePackageRef): Promise<ArrayBuffer>
}

export interface TextureComposer {
  compose(input: ComposeTextureInput): Promise<DerivedTexture>
}

export interface ShopifyGateway {
  createCart(input: CheckoutIntent): Promise<{ cartId: string; checkoutUrl: string }>
  addLines(input: AddCartLinesInput): Promise<void>
}
```

---

## 5) Phased build plan

## Phase 0 — Contract repair

Build first:
- v4 schema pack
- `design_revision_snapshots`
- `design_preview_assets`
- scene package ref/hash model
- compatibility reason codes

Do **not** start UI rewrites before this exists.

## Phase 1 — Shared runtime foundation

Build:
- `create/core` extraction
- `ScenePackageLoader`
- `ViewerShell`
- `products/effect/runtime`
- visual parity harness against prototype scenes

Exit gate:
- same scene package renders in Studio and Create runtime with no visual drift beyond tolerance

## Phase 2 — Create bootstrap + edit loop

Build:
- `ResolveCreateBootstrap`
- upload intake contract with `image_source`
- WorkspaceStore
- TextureComposer
- autosave to head + append-only snapshot
- gesture + numeric assist + safe-area enforcement
- degraded still-assisted edit mode

Exit gate:
- start, edit, close, resume, account-upgrade continuity works with identical canonical placement

## Phase 3 — Review / proof / render factory

Build:
- `RequestReview`
- `RenderSnapshot`
- internal render pages
- Playwright worker
- owner/public/order/fallback/catalog captures

Exit gate:
- proof and previews are generated from exact revision snapshots only

## Phase 4 — Manufacturing

Build:
- method A/B/C compilers
- production coordinate transforms
- QA preview outputs
- immutable `ManufacturingPackage`
- ops recovery compile path

Exit gate:
- same approved revision compiles deterministically twice to the same output manifest

## Phase 5 — Commerce wiring

Build:
- checkout intent model
- variant projection resolver
- Shopify cart integration
- mixed-cart add-on lines
- webhooks + order binding
- approval-expiry revalidation

Exit gate:
- approved design + add-on garment + pair metadata survives checkout and order replay

## Phase 6 — AI and latent tracks

Build:
- `generation` intake provider
- connected imports
- AI intent parser -> typed actions
- generated media jobs
- public Velcro activation hooks

Exit gate:
- AI can only produce typed proposals or new derived assets; never mutate canonical rules directly

### Dependency chain

```text
contracts
  -> runtime parity
    -> draft persistence
      -> proof snapshots + render factory
        -> manufacturing compile
          -> checkout intent + Shopify
            -> AI sidecars / latent tracks
```

---

## 6) Performance contracts

## 6.1 Product-level budgets

| Contract | Target | Enforcement |
|---|---:|---|
| Create shell usable | <= 2.5s p75 | route-shell budget |
| First believable preview (preset entry) | <= 6.0s p75 | still-first + live-upgrade |
| First believable preview after image intake | <= 8.0s p75 | local derived texture + background upload |
| Read API p95 | <= 400ms | cache + thin route handlers |
| Mutating API ack p95 | <= 800ms | enqueue long jobs only |
| Active gesture FPS | 45 preferred / 30 floor | low-spec mode if sustained drop |
| Repeated sustained FPS < 24 | fallback threshold | force degraded mode |
| GLB triangles | ~75k target / review >120k | publish-time asset validation |
| Draw calls | <50 target / review >80 | publish-time validation |
| Live texture long edge | 1024 target / 1536 max | texture policy |
| Static material maps | 1024 target / review >2048 | asset lint |
| Environment map | 1k mobile target | package lint |

## 6.2 Runtime constraints

- `frameloop="demand"` by default
- DPR clamped by device tier
- no free pan
- no free roll
- no continuous shadow updates when idle
- no proof or checkout path may block on long-running render or manufacturing jobs

## 6.3 Fallback ladder

1. **Still-first live-upgrade**
   - show published fallback stills immediately
   - upgrade to live WebGL when ready

2. **Low-spec live mode**
   - DPR 1.0
   - disable dynamic shadows
   - lower live texture resolution
   - reduced post-processing

3. **Still-assisted edit mode**
   - static canonical front/three-quarter/back stills
   - numeric controls always available
   - optional limited drag on front still only as degraded mode

4. **Hard failure mode**
   - preserve canonical draft
   - allow save/resume/proof recovery
   - never strand the user inside a broken canvas

### Strong call

The old dedicated 2D editor should stay dead as a primary surface.

But a **degraded still-assisted edit path** is necessary for graceful failure on mobile Safari. Not shipping one is reckless.

---

## 7) Commerce integration

## 7.1 Commerce model

Keep the product-system rule:
- **real Shopify products** for garments, stock/curated Effects, and any pair products intentionally merchandised as standalone retail products
- **checkout-shell products** for custom Standard Effects and custom Pairs

Create hands off a **CheckoutIntent**, not raw UI state.

## 7.2 Variant projection

Do not resolve variants by re-deriving option strings in UI code.

Use:
- `ProductSpec.shopify_projection` as canonical projection hints
- a derived `VariantProjectionResolver` cache for hot-path lookup

Projection key:

```text
productSpecVersion + purchaseMode + attachmentSystem + size + faceMaterial + trimBackColour
  -> Shopify merchandise GID
```

## 7.3 Cart composition

`CheckoutIntent` contains:
- primary custom line
- optional add-on garment / stock / pair lines
- compatibility snapshot
- approval expiry timestamp

The custom line should carry only minimal attributes:
- customer-visible: design title, size label, material label, order preview URL
- internal IDs: `_design_id`, `_design_revision`, `_approval_ref`, `_production_asset_ref`, `_bundle_group`

No PII. No secret data. No raw manufacturing details.

## 7.4 Webhooks and order binding

At minimum:
- `orders/create` — bind order to exact design revision + checkout intent + package ref
- `app/uninstalled` — cleanup app projection/config state

Optional later:
- order update / fulfillment sync for library/order-status surfaces

## 7.5 Approval-expiry enforcement

Before cart creation:
- load approved revision snapshot
- re-run compatibility and sellability checks
- confirm variant projection still valid
- confirm add-on lines still available

If stale, return `approval_expired` with recovery actions.

---

## 8) Manufacturing pipeline

## 8.1 Triggers

- approval path enqueues preflight compile
- explicit ops compile
- order-webhook recovery if compile missing

## 8.2 Compile inputs

Every compile uses:
- immutable revision snapshot
- original source asset
- pinned ProductSpec version
- pinned ScenePreset version
- scene package hash
- compiler version

## 8.3 Compile steps

```text
Load revision snapshot
  -> validate placement + safe area + profile constraints
  -> derive production-resolution texture from original asset
  -> select method compiler
  -> transform normalized coords -> production coords
  -> write output assets
  -> write immutable ManufacturingPackage
```

## 8.4 Method routing

| Method | Used for | Outputs |
|---|---|---|
| A — edge trim | standard edge-trim magnetic Effects | print raster, cutline, registration, QA preview |
| B — magnetic caps | plain magnetic Effects | print raster, cap placement, BOM, QA preview |
| C — TV retro | framed patch/base hybrid | patch raster, registration, base blank metadata, QA preview |
| Solid | no sublimated artwork | BOM, QA preview |

## 8.5 Hard rules

- manufacturing never trusts client-generated preview textures
- packages are immutable per design revision + compiler version
- recompile writes a new package, never mutates an old one
- pair metadata must survive into packaging and support tooling
- attachment system is product truth, not hidden factory metadata

---

## 9) Preview / render factory

## 9.1 One render factory

One system should produce:
- owner continuity preview
- public preview
- order preview
- fallback stills
- catalog/listing images

Same renderer. Same product module. Same capture presets.

## 9.2 Architecture

```text
Revision snapshot
  -> RenderSnapshotResolver
  -> signed internal render route
  -> Playwright worker
  -> capture exact preset viewport(s)
  -> upload to AssetStore
  -> write design_preview_assets row
```

## 9.3 Internal routes

Recommended:
- `/render/design/[designId]/[revision]/[role]`
- `/render/catalog/[scenePresetId]/[capturePresetId]`
- `/render/fallback/[scenePresetId]/[context]`

These are internal-only and signed.

## 9.4 Render snapshot contents

A `RenderSnapshot` freezes:
- exact revision payload
- exact pinned artifact refs
- scene package ref
- derived texture refs by profile
- capture preset IDs
- background/profile settings

The worker should never hit mutable head rows directly.

## 9.5 Naming / cache keys

Deterministic key shape:

```text
{designId}/r{revision}/{role}/{capturePresetId}/{scenePresetVersion}/{transformHash}
```

That makes retries idempotent and cache invalidation trivial.

---

## 10) Migration path from prototype

## 10.1 Strategy

Graduate from the prototype, but do not let prototype state shapes infect production.

Prototype remains a reference. Production grows beside it.

## 10.2 Step sequence

1. **Extract viewer runtime**
   - move canvas/orbit/environment code into `create/core`
   - preserve visual parity first

2. **Extract Effect runtime**
   - move surface discovery and material application into `products/effect/runtime`
   - keep legacy mesh-name fallback only as a temporary adapter

3. **Introduce scene package model**
   - wrap current `.onemo` loader with hash verification
   - map old `studio.json` into `ScenePresetSchemaV4`

4. **Introduce contract repair**
   - add v4 artifact schemas
   - add `design_revision_snapshots`
   - add preview asset table

5. **Wire edit loop**
   - bootstrap resolver
   - autosave head + snapshot
   - local texture composer

6. **Wire review/proof**
   - review service
   - render worker
   - preview assets by revision

7. **Wire manufacturing**
   - compile services and queue

8. **Wire commerce**
   - checkout intent + Shopify gateway + webhooks

9. **Cut over route traffic**
   - feature-flag new Create shell
   - keep prototype fallback route during bake-in

## 10.3 Migration hard rules

- no big-bang rewrite
- no in-place mutation of old design rows without snapshots
- no reuse of prototype UI state as canonical artifact shape
- no checkout before revision snapshots + approval revalidation exist

## 10.4 Verification gates

- visual parity snapshots against prototype scenes
- save -> close -> resume exact placement parity
- proof generated from exact revision snapshot
- order replay reproduces exact preview/package lineage
- manufacturing compile deterministic across retry

---

## 11) Gen AI integration points

AI is a sidecar translator and derivative-content engine.

It is **not**:
- the primary UI
- the renderer
- the compatibility authority
- the manufacturing compiler
- the proof gate

## 11.1 Where AI hooks in cleanly

### A. Intake providers

`ImageSource` already supports:
- `upload`
- `generation`
- `connected_import`
- `wallet_import`

That is the correct architectural seam for customer-facing AI image generation later.

### B. Intent parsing

LLM -> typed actions -> validator -> patch queue

Example:
- “make the back darker”
- “show me the pair version”
- “switch to the framed one”

The model proposes actions. Domain rules approve or reject them.

### C. Generated media after proof

After proof or save:
- try-on still
- spin loop
- export package
- surprise media / “comes alive” content

These belong in `GeneratedMedia`, not in the core renderer contract.

### D. Assistant copy / education

AI can help generate contextual explanations for:
- pair education
- attachment system explanation
- material notes

But it must never invent compatibility truth.

## 11.2 What AI cannot do

- mutate a canonical artifact without passing schema + domain validation
- bypass safe-area rules
- override compatibility engine results
- approve a design
- change a construction method outside ProductSpec rules
- produce manufacturing output directly
- turn private or blocked content public without governance clearance

## 11.3 Strong call on the current draft’s AI hooks

“Video texture” is not a core Create architecture requirement.

Treat it as a **later GeneratedMedia subtype**, not as something the viewer architecture should be organized around.

---

## 12) Final architecture call

This is the production architecture I would ship:

- top-level `create/` module
- shared viewer runtime under `create/core`
- product-family runtime/compiler modules under `create/products/*`
- canonical artifacts in `create/domain/artifacts`
- explicit application layer for bootstrap/review/commerce/manufacturing
- immutable `.onemo` runtime bundles referenced by `ScenePreset`
- append-only design revision snapshots
- unified render factory for preview/share/order/catalog/fallback
- texture derivatives as cache, not truth
- `CheckoutIntent` separate from `DesignSession`
- Shopify as commerce projection only
- manufacturing packages immutable per design revision
- AI only as typed sidecar and derivative-content engine

### Non-negotiables

1. Do not ship without revision snapshots.
2. Do not trust client textures for proof or manufacturing.
3. Do not let add-ons mutate the design artifact.
4. Do not hide compatibility logic inside UI or Shopify mapping code.
5. Do not make WebGL a hard dependency for proof or checkout continuity.
6. Do not keep stale Theatre concepts in the published runtime.

That is the clean production path from the current prototype to a module that can scale without being rebuilt every week.
