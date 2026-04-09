
# ONEMO Create Module — Production Architecture (Independent Track)

## Architecture call

Build Create as a **top-level application module** at `create/` that owns customer orchestration, not product truth.

The correct production split is:

- **Studio** authors and publishes versioned product and scene artifacts.
- **Create** loads only published artifacts, captures customer intent, and writes canonical design revisions.
- **Render Factory** generates deterministic previews and catalog media from the same renderer.
- **Commerce** projects approved designs into Shopify shell products and checkout.
- **Manufacturing** compiles approved design revisions into immutable production artifacts.

There are four canonical business artifacts:

1. `ProductSpec`
2. `ScenePreset`
3. `DesignSession`
4. `ManufacturingPackage`

The `.onemo` bundle is **not** a fifth business artifact. It is the **scene exchange package** used by Studio, Create, and the render factory. Treat it as a versioned scene asset referenced by `ScenePreset`.

## Non-negotiables

- **Later ADRs win.** Theatre and Leva are dead. Build around the accepted Three.js scene graph and top-level `create/` module, not the earlier Theatre-based baseline.
- **Create and Studio stay separate.** Same renderer, different controls. No shared UI state.
- **Canonical placement is normalized print-area space only.** Never store screen pixels as truth.
- **Shopify never owns design truth.** It gets bounded projections and line-item references only.
- **Approved revisions must be reproducible.** The current `designs` head row is not enough; immutable revision snapshots are required.
- **AI is a sidecar translator.** It can suggest and translate intent, but it does not own state, rendering, proof, or manufacturing.

---

## 1. System overview

### What Create is

Create is ONEMO’s customer-facing 3D configurator. It sits between:

- **upstream product/scene authoring** in Studio
- **downstream commerce, sharing, and manufacturing** flows

It is the primary surface for configurable products, but not the whole product. Commerce and social/share remain equal loops.

### Where it sits

```text
Studio / Admin
  -> publishes ProductSpec + ScenePreset + .onemo scene bundle
Create
  -> loads published artifacts
  -> captures customer design intent
  -> writes DesignSession revisions
  -> triggers review, approval, preview generation, share, and checkout handoff
Render Factory
  -> captures owner/public/order/catalog media from the same runtime
Commerce
  -> projects approved revision into Shopify cart / checkout
Manufacturing
  -> compiles approved revision into ManufacturingPackage
```

### Inputs

Create accepts these inputs:

- configurable catalog entry
- preset link
- saved draft / resumable design
- public remix entry
- published `ProductSpec`
- published `ScenePreset`
- published `.onemo` scene bundle
- user artwork via normalized `image_source`
- user variant selections
- feature flags
- compatibility rules
- anonymous or authenticated identity context

### Outputs

Create produces:

- `DesignSession` draft and immutable revision snapshots
- owner preview continuity artifacts
- public/share metadata seed
- approval state for a specific revision
- cart intent / checkout handoff payload
- preview render jobs
- manufacturing compile jobs
- analytics events

### What Create does **not** own

Create does **not** own:

- product-family grammar
- catalog publication
- stock product truth
- order lifecycle
- manufacturing fulfillment state
- governance policy outcomes beyond required input metadata

### Runtime context diagram

```text
Customer browser
  -> Next.js route shell
  -> create/ UI + renderer
  -> signed upload to Cloudinary

Next.js route handlers
  -> Supabase repositories
  -> Cloudinary asset store
  -> Shopify Storefront cart gateway
  -> job_queue

Workers
  -> Playwright render worker
  -> manufacturing compile worker

Shopify
  -> checkout
  -> orders/create webhook
  -> shell product / variant projections
```

---

## 2. Component architecture

## 2.1 Repo and module layout

The accepted layout is a top-level `create/` module with thin Next wrappers.

```text
onemo-next/
├── create/
│   ├── index.ts
│   ├── CreateShell.tsx
│   ├── core/
│   │   ├── runtime/
│   │   │   ├── ViewerCanvas.tsx
│   │   │   ├── SceneRuntime.tsx
│   │   │   ├── RenderReadyBeacon.tsx
│   │   │   ├── DemandFrameLoop.tsx
│   │   │   ├── ProjectionFallbackCanvas.tsx
│   │   │   └── RuntimeDiagnostics.tsx
│   │   ├── camera/
│   │   ├── lighting/
│   │   ├── environment/
│   │   ├── capture/
│   │   └── loading/
│   ├── products/
│   │   ├── registry.ts
│   │   └── effect/
│   │       ├── module.ts
│   │       ├── renderer/
│   │       ├── gestures/
│   │       ├── projection/
│   │       ├── compatibility/
│   │       ├── shopify/
│   │       └── manufacturing/
│   ├── domain/
│   │   ├── common/
│   │   ├── onemo-scene-bundle/
│   │   ├── image-source/
│   │   ├── product-spec/
│   │   ├── scene-preset/
│   │   ├── design-session/
│   │   ├── design-revision/
│   │   ├── compatibility/
│   │   ├── preview/
│   │   ├── cart-intent/
│   │   └── manufacturing-package/
│   ├── application/
│   │   ├── bootstrap/
│   │   ├── use-cases/
│   │   ├── services/
│   │   ├── policies/
│   │   └── jobs/
│   ├── adapters/
│   │   ├── repositories/
│   │   ├── api/
│   │   ├── storage/
│   │   ├── commerce/
│   │   └── render-factory/
│   ├── state/
│   │   ├── createStore.ts
│   │   ├── selectors.ts
│   │   └── actionSafety.ts
│   ├── ui/
│   │   ├── shells/
│   │   ├── modes/
│   │   ├── panels/
│   │   ├── review/
│   │   └── overlays/
│   └── docs/
├── studio/
│   └── imports create/core + create/products/*
└── src/app/
    ├── create/**               thin route wrappers only
    ├── render/**               headless capture routes
    └── api/**                  public boundary
```

## 2.2 Layer responsibilities

### Route layer (`src/app/**`)
Owns URLs, auth gates, and request boundaries. Nothing more.

### Create shell (`create/ui`, `create/CreateShell.tsx`)
Owns:

- intake, draft shell, compose/configure/review modes
- back-side / attachment inspections
- bundle suggestions
- resume and recovery overlays

### Core runtime (`create/core/**`)
Product-agnostic renderer shell:

- Canvas lifecycle
- scene loading
- camera controls
- lighting/env application
- render-ready beacons
- projection fallback
- diagnostics and performance downgrades

It does **not** know what an Effect is.

### Product modules (`create/products/**`)
Product-family logic. MVP needs only `effect`.

Owns:

- GLB surface discovery
- mesh metadata contract
- material slot application
- artwork placement adapter
- preview projection fallback adapter
- subtype-specific manufacturing compilation
- Shopify shell projection

### Domain (`create/domain/**`)
Pure schemas, validators, deterministic transforms:

- artifact schemas
- compatibility result model
- placement reconciliation
- preview manifests
- cart intent
- lineage and version pinning rules

### Application (`create/application/**`)
Use cases and orchestration:

- resolve bootstrap
- create draft
- autosave
- review
- approve
- add to cart
- enqueue previews
- enqueue manufacturing compile

### Adapters (`create/adapters/**`)
Concrete integrations:

- repositories
- Cloudinary scene / asset storage
- Storefront cart gateway
- render-factory worker client

### State (`create/state/**`)
Three separated state classes:

1. **canonical server state** — published artifacts, persisted draft head, confirmed revision
2. **working client state** — optimistic local edits, compare state, panel mode
3. **interaction runtime state** — drag deltas, hover state, camera pose, frame metrics; refs only, not reactive app state

## 2.3 Same renderer, different controls

Studio, Create, and the render factory use the same scene runtime:

- same `.onemo` scene bundle
- same `ScenePreset`
- same product-family renderer
- same materials, lighting, and capture cameras

What changes is the shell:

- **Studio** exposes authoring controls and inspectors
- **Create** exposes customer-safe composition and variant controls
- **Render Factory** exposes no controls and only deterministic capture routes

---

## 3. Data flows

## 3.1 Studio authoring -> published scene

1. Studio edits a Three.js scene graph and product-specific metadata.
2. Studio serializes the scene into `.onemo`:
   - `scene.glb`
   - `studio.json`
   - optional `environment.hdr`
3. Publish validation checks:
   - mesh metadata contract
   - surface bindings
   - capture preset completeness
   - subtype support
4. Publish writes:
   - versioned `.onemo` bundle asset
   - versioned `ScenePreset`
   - `scene_hash`
5. Create reads the published version only.

**Important:** this is not Theatre compilation. It is scene validation + indexing over the same canonical scene package.

## 3.2 Customer creation flow

1. Route resolves bootstrap from catalog entry, preset, saved draft, or remix.
2. Server loads:
   - published `ProductSpec`
   - published `ScenePreset`
   - published `.onemo` bundle
3. Browser requests signed Cloudinary upload permission.
4. Browser uploads original artwork directly to Cloudinary.
5. Create opens or creates a draft head.
6. User manipulates artwork with 3D gestures.
7. Product module reconciles viewport interaction into canonical placement.
8. Client generates normalized applied texture and uploads it.
9. Autosave writes:
   - new mutable head state
   - immutable revision snapshot
   - revision number bump
10. Owner continuity preview may be local-first, but proof/order/public outputs are always server-generated.

## 3.3 Review / proof flow

1. User requests review.
2. Server validates current immutable revision snapshot:
   - schema validity
   - safe area
   - attachment / compatibility rules
   - applied texture hash freshness
   - referenced product / scene versions still published and accessible
3. If review is valid or warning-only:
   - create `ApprovalCandidate`
   - enqueue preview render jobs
4. Render factory captures deterministic owner/public/order stills from the exact revision snapshot.
5. Review screen reads preview statuses and displays the proof boundary.

## 3.4 Approval and commerce flow

1. User approves revision `rN`.
2. Server locks approval against that immutable revision snapshot.
3. Commerce validates:
   - approval still current
   - sellable shell variant exists
   - bundle suggestions / add-ons still valid
4. Server projects:
   - Shopify shell product
   - Shopify variant
   - bounded public and private line-item properties
5. Server creates Storefront cart and returns `checkoutUrl`.
6. Shopify webhook records the order against `design_id + approved_revision`.

## 3.5 Manufacturing flow

1. Approval or order webhook triggers compile.
2. Compiler loads immutable revision snapshot plus pinned artifacts.
3. Product module resolves construction method:
   - A `edge_trim`
   - B `magnetic_caps`
   - C `tv_retro`
4. Canonical placement is transformed into production coordinates.
5. Compiler emits versioned output assets and writes immutable `ManufacturingPackage`.
6. Package is referenced by:
   - order record
   - ops UI
   - support tooling
   - optional private Shopify line-item reference

## 3.6 Social/share flow

1. Review-ready or approved design can request public preview generation.
2. Render factory captures public stills from the exact revision.
3. Public presentation record references that revision, not the mutable draft head.
4. Remix clones allowed public state into a new draft. It never reaches into the original private source chain.

---

## 4. Interface contracts

The baseline interfaces are a good start, but they are missing required V3 fields. The production module needs explicit schema deltas.

## 4.1 Scene exchange contract (`.onemo`)

```ts
import { z } from "zod"

export const SceneBundleFileSchema = z.object({
  scene_glb: z.string().min(1),
  studio_json: z.string().min(1),
  environment_hdr: z.string().min(1).optional(),
})

export const OnemoSceneBundleSchema = z.object({
  id: z.string().min(1),
  schema_version: z.literal(1),
  scene_hash: z.string().min(32),
  files: SceneBundleFileSchema,
  exported_at: z.string().datetime({ offset: true }),
  studio_version: z.string().min(1),
})

export type OnemoSceneBundle = z.infer<typeof OnemoSceneBundleSchema>
```

### Scene contract rule

`studio.json` is the canonical runtime document for scene configuration. `ScenePreset` is the validated and indexed reference to that bundle, not a second scene language.

## 4.2 Image source and create context

```ts
export const ImageSourceKindSchema = z.enum([
  "upload",
  "generation",
  "connected_import",
  "wallet_import",
])

export const ImageSourceSchema = z.object({
  kind: ImageSourceKindSchema,
  provider: z.string().nullish(),
  source_asset_id: z.string().min(1),
  source_url: z.string().url().nullish(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  rights_attestation_ref: z.string().nullish(),
})

export const AttachmentSystemSchema = z.enum(["magnetic", "velcro", "both"])
export const PurchaseModeSchema = z.enum(["single", "pair"])

export const ReceiverClassSchema = z.enum([
  "onemo_garment_receiver",
  "cap_receiver",
  "ordinary_fabric_pair_pathway",
])

export const CreateBootstrapModeSchema = z.enum([
  "direct",
  "preset",
  "draft_resume",
  "public_remix",
  "catalog_entry",
])

export const CreateContextSchema = z.object({
  bootstrap_mode: CreateBootstrapModeSchema,
  catalog_entry_id: z.string().nullish(),
  purchase_mode: PurchaseModeSchema,
  attachment_system: AttachmentSystemSchema,
  receiver_class: ReceiverClassSchema.nullish(),
  feature_flags: z.array(z.string()).default([]),
})
```

## 4.3 Canonical placement

```ts
export const CanonicalPlacementSchema = z.object({
  id: z.string().min(1),
  surface_id: z.enum(["face", "back", "frame"]),
  print_area_id: z.string().min(1),
  coordinate_space_id: z.string().min(1),
  anchor_x: z.number().min(0).max(1),
  anchor_y: z.number().min(0).max(1),
  scale: z.number().positive(),
  rotation_deg: z.number(),
  crop_mode: z.enum(["cover", "contain"]),
  safe_area_status: z.enum(["inside", "clamped", "blocked"]),
  texture_transform_hash: z.string().min(1),
  reconciled_at: z.string().datetime({ offset: true }),
})
```

This is the contract between:

- 3D gesture editing
- precision assist inputs
- proof rendering
- preview rendering
- manufacturing transforms

## 4.4 ScenePreset delta required for production Create

```ts
export const ScenePresetRuntimeDeltaSchema = z.object({
  scene_bundle_ref: z.object({
    bundle_id: z.string().min(1),
    scene_hash: z.string().min(32),
  }),
  presentation_contexts: z.array(
    z.enum(["effect_only", "pair", "cap", "backside"]),
  ).min(1),
  gesture_profiles: z.array(
    z.object({
      surface_id: z.enum(["face", "back", "frame"]),
      allow_move: z.boolean(),
      allow_scale: z.boolean(),
      allow_rotate: z.boolean(),
      safe_area_visible: z.boolean(),
    }),
  ).min(1),
  fallback_stills: z.array(
    z.object({
      role: z.enum(["front", "three_quarter", "side_detail", "back"]),
      asset_id: z.string().min(1),
    }),
  ).default([]),
})
```

## 4.5 DesignSession delta required for V3

```ts
export const PairContextSchema = z.object({
  orientation: z.enum(["left_right", "inner_outer"]),
  polarity_profile: z.string().min(1),
  packaging_profile: z.string().min(1),
}).optional()

export const CompatibilitySnapshotSchema = z.object({
  result: z.enum([
    "compatible",
    "advisory",
    "recoverable_block",
    "hard_block",
    "inactive_track_block",
  ]),
  codes: z.array(z.string()).default([]),
  generated_at: z.string().datetime({ offset: true }),
})

export const DesignSessionV4Schema = z.object({
  version: z.literal(4),
  create_context: CreateContextSchema,
  image_source: ImageSourceSchema,
  effect_variant: z.object({
    product_family: z.literal("effect"),
    tier: z.enum(["standard", "shaped"]),
    subtype: z.enum(["edge_trim", "plain", "tv_retro"]),
    purchase_mode: PurchaseModeSchema,
    attachment_system: AttachmentSystemSchema,
    size: z.string().min(1),
    face_material: z.string().min(1),
    trim_back_colour: z.string().min(1),
  }),
  surface_appearance: z.record(z.string(), z.unknown()),
  artwork: z.object({
    original_asset_id: z.string().min(1),
    applied_texture_asset_id: z.string().min(1),
    original_width_px: z.number().int().positive().nullish(),
    original_height_px: z.number().int().positive().nullish(),
    transform_hash: z.string().min(1),
  }),
  placements: z.array(CanonicalPlacementSchema).min(1),
  pair_context: PairContextSchema,
  compatibility_snapshot: CompatibilitySnapshotSchema,
  product_spec_ref: z.object({ id: z.string(), version: z.number().int().positive() }),
  scene_preset_ref: z.object({
    id: z.string(),
    version: z.number().int().positive(),
    scene_hash: z.string().min(32),
  }),
})
```

## 4.6 Immutable revision snapshots

This is the missing piece in the baseline row model.

```ts
export const DesignRevisionRecordSchema = z.object({
  design_id: z.string().uuid(),
  revision: z.number().int().positive(),
  design_session: DesignSessionV4Schema,
  review_status: z.enum(["draft", "proofed", "approved", "expired"]),
  owner_preview_url: z.string().url().nullish(),
  public_preview_url: z.string().url().nullish(),
  order_preview_url: z.string().url().nullish(),
  approved_at: z.string().datetime({ offset: true }).nullish(),
  created_at: z.string().datetime({ offset: true }),
})
```

**Call:** keep `designs` as the mutable head row, but add `design_revisions` as immutable snapshots. Without that, “buy exact approved revision” is fake.

## 4.7 Product family module contract

```ts
export interface ProductFamilyModule {
  family: "effect" | "shaped-effect" | string
  validateProductSpec(spec: unknown): void
  loadRenderer(): Promise<React.ComponentType<ProductRendererProps>>
  buildSceneRuntime(args: BuildSceneRuntimeArgs): Promise<ProductSceneRuntime>
  createGestureAdapter(args: GestureAdapterArgs): ArtworkGestureAdapter
  createProjectionAdapter?(args: ProjectionAdapterArgs): ProjectionAdapter
  projectShopifyVariant(args: ShopifyProjectionArgs): Promise<ShopifyVariantProjection>
  compileManufacturing(args: CompileManufacturingArgs): Promise<unknown>
}
```

```ts
export interface ProductRendererProps {
  productSpec: unknown
  scenePreset: unknown
  designSession: unknown
  runtime: ProductSceneRuntime
  mode: "compose" | "configure" | "review" | "render"
}
```

## 4.8 Compatibility contract

```ts
export const CompatibilityResultSchema = z.object({
  classification: z.enum([
    "compatible",
    "advisory",
    "recoverable_block",
    "hard_block",
    "inactive_track_block",
  ]),
  code: z.string().min(1),
  message: z.string().min(1),
  recovery_actions: z.array(
    z.object({
      action: z.enum([
        "switch_attachment_system",
        "suggest_receiver",
        "suggest_pair",
        "remove_bundle_member",
        "retry_review",
      ]),
      label: z.string().min(1),
      payload: z.record(z.string(), z.unknown()).default({}),
    }),
  ).default([]),
})

export type CompatibilityResult = z.infer<typeof CompatibilityResultSchema>
```

## 4.9 Preview/render factory contract

```ts
export const PreviewRoleSchema = z.enum(["owner", "public", "order", "catalog"])

export const RenderJobPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("design_preview"),
    design_id: z.string().uuid(),
    revision: z.number().int().positive(),
    scene_preset_ref: z.object({ id: z.string(), version: z.number().int().positive() }),
    roles: z.array(PreviewRoleSchema).min(1),
  }),
  z.object({
    kind: z.literal("catalog_capture"),
    capture_set_id: z.string().min(1),
    scene_preset_ref: z.object({ id: z.string(), version: z.number().int().positive() }),
    product_variant_key: z.string().min(1),
  }),
])
```

## 4.10 Commerce handoff contract

```ts
export const ShopifyVariantProjectionSchema = z.object({
  shell_product_gid: z.string().min(1),
  variant_gid: z.string().min(1),
  public_properties: z.record(z.string(), z.string()),
  private_properties: z.record(z.string(), z.string()),
})

export type ShopifyVariantProjection = z.infer<typeof ShopifyVariantProjectionSchema>

export const CartIntentSchema = z.object({
  custom_lines: z.array(
    z.object({
      design_id: z.string().uuid(),
      approved_revision: z.number().int().positive(),
      projection: ShopifyVariantProjectionSchema,
    }),
  ),
  stock_lines: z.array(
    z.object({
      merchandise_gid: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  ).default([]),
  grouped_context: z.array(
    z.object({
      group_id: z.string().min(1),
      kind: z.enum(["bundle", "pair", "receiver_suggestion"]),
      line_refs: z.array(z.string()).min(1),
    }),
  ).default([]),
})
```

## 4.11 Repository and gateway contracts

```ts
export interface ProductSpecRepository {
  getPublishedBySlug(slug: string): Promise<unknown | null>
  getByIdVersion(id: string, version: number): Promise<unknown | null>
}

export interface ScenePresetRepository {
  getPublishedBySlug(slug: string): Promise<unknown | null>
  getByIdVersion(id: string, version: number): Promise<unknown | null>
}

export interface SceneBundleStore {
  getPublishedBundle(bundleId: string): Promise<OnemoSceneBundle | null>
  resolveAssetUrls(bundleId: string): Promise<{
    scene_glb_url: string
    studio_json_url: string
    environment_hdr_url?: string
  }>
}

export interface DesignSessionRepository {
  createDraft(input: {
    title: string
    userId?: string | null
    sessionId?: string | null
    designSession: z.infer<typeof DesignSessionV4Schema>
  }): Promise<{ designId: string; revision: number }>
  getHead(designId: string): Promise<unknown | null>
  saveHead(input: {
    designId: string
    expectedRevision?: number
    designSession: z.infer<typeof DesignSessionV4Schema>
    editorState?: unknown
  }): Promise<{ revision: number }>
  createRevisionSnapshot(input: {
    designId: string
    revision: number
    designSession: z.infer<typeof DesignSessionV4Schema>
  }): Promise<void>
  getRevision(designId: string, revision: number): Promise<z.infer<typeof DesignRevisionRecordSchema> | null>
  setApprovedRevision(designId: string, revision: number): Promise<void>
}

export interface ManufacturingRepository {
  putPackage(pkg: unknown): Promise<unknown>
  getByDesignRevision(designId: string, revision: number): Promise<unknown | null>
}

export interface CartGateway {
  createCart(intent: z.infer<typeof CartIntentSchema>): Promise<{
    cartId: string
    checkoutUrl: string
  }>
}
```

---

## 5. Phased build plan

## 5.1 Dependency order

The build order should be:

1. **artifact/schema correction**
2. **revision snapshot persistence**
3. **shared renderer extraction**
4. **effect module extraction**
5. **draft shell and autosave**
6. **review and preview render factory**
7. **approval + commerce projection**
8. **manufacturing compile**
9. **share/remix/public presentation**
10. **AI sidecars**

Do not start with Shopify. Do not start with AI. Do not start with manufacturing. The dependency spine is scene/runtime -> canonical design revision -> proof -> commerce/manufacturing.

## 5.2 Version progression

| Milestone | Scope | Hard outputs |
|---|---|---|
| `v0-foundation` | top-level `create/`, schema deltas, file-backed repos, revision snapshots | no production wiring yet |
| `v1-live-scene` | published scene load, effect renderer, draft shell, gesture reconciliation | interactive Create on seeded artifacts |
| `v2-canonical-state` | autosave, resume, anonymous continuity, applied texture upload | stable design revisions in Supabase |
| `v3-proof` | review gate, preview jobs, render routes, approval locks | authoritative proof boundary |
| `v4-commerce` | Shopify shell projection, cart creation, webhook reconciliation | buy path for approved revisions |
| `v5-manufacturing` | compile worker, immutable packages, ops inspection | full digital-to-physical loop |
| `v6-share` | public preview, presentation routes, remix | social/share loop wired |
| `v7-ai-sidecars` | prompt/image intake adapters, try-on/lifestyle hooks | non-blocking AI extensions |

## 5.3 What to build first

### Phase 1 — Correct the contracts
Ship first:

- `DesignSessionV4`
- `ScenePreset` scene bundle ref
- `ProductSpec` attachment-system and purchase-mode deltas
- `design_revisions` table
- repository contract tests for file and Supabase backends

Without these, every later step is built on sand.

### Phase 2 — Extract the renderer core
Move the proven prototype runtime into `create/core`:

- Canvas
- camera
- lighting
- environment
- demand frame loop
- render-ready beacon

No product logic yet.

### Phase 3 — Extract the Effect product module
Add:

- surface registry discovery
- metadata-driven mesh binding
- artwork gesture adapter
- projection fallback adapter
- subtype runtime selection

### Phase 4 — Wire Create shell
Build the real customer flow:

- intake
- draft shell
- compose/configure modes
- autosave
- resume
- numeric precision assist

### Phase 5 — Add proof boundary
Wire:

- review endpoint
- render worker
- preview status polling
- approval lock

### Phase 6 — Add commerce
Wire:

- shell projection
- cart intent
- Storefront cart create
- order webhook reconciliation

### Phase 7 — Add manufacturing
Wire:

- compile worker
- method A/B/C compilers
- ops viewer
- private production refs

---

## 6. Performance contracts

These combine the normative requirements with the production implementation budget.

## 6.1 UX and route budgets

| Contract | Target | Enforcement |
|---|---|---|
| usable Create shell | `<= 2.5s p75` | route shell renders before heavy assets |
| first believable preset preview | `<= 6.0s p75` | poster-first + progressive live upgrade |
| first believable preview after valid upload | `<= 8.0s p75` | upload + texture normalize + initial render |
| read APIs | `<= 400ms p95` | cached artifact reads |
| mutating API acknowledgement | `<= 800ms p95` | async jobs, no long work in request |

## 6.2 Scene budgets

| Budget item | Target | Hard warning |
|---|---|---|
| fps during active gesture | `45 preferred / 30 floor` | repeated `<24` triggers degrade path |
| visible geometry | `~75k tris` | review above `120k` |
| draw calls | `<50` | review above `80` |
| user texture long edge | `1024px` | never exceed `1536px` in MVP |
| static material maps | `1024² target` | review above `2048²` |
| environment map | `1k mobile` | do not ship heavier by default |
| gesture latency | `<16ms` | visible lag is a regression |
| capture render-ready timeout | `<= 6s` | fail job, record diagnostics, retry once |

## 6.3 Rendering constraints

- `frameloop="demand"` when idle
- camera invalidation only on real motion
- gesture transforms stay in refs during drag; commit canonical placement on settle / debounce
- only the applied artwork texture may change per user session; static materials stay cached
- no per-frame React state churn from drag
- public/order previews are not generated on autosave

## 6.4 Fallback strategy

### Level 1 — poster first
Every Create entry shows a deterministic poster still immediately while the live scene boots.

### Level 2 — live upgrade
If WebGL and assets load in budget, poster crossfades to live scene.

### Level 3 — projection fallback
If WebGL init fails or frame health collapses, switch to `ProjectionFallbackCanvas`:

- face-only projected compose preview from canonical print area
- numeric precision controls remain available
- three-quarter / back views use deterministic stills
- this is a resilience path, not the primary UX

### Level 4 — still-only review
If even projection fallback is unavailable, preserve continuity with stills and retry paths, but block gesture editing explicitly.

This is the correct replacement for the retired React-Konva editor: not a permanent second editor, but a bounded failure mode.

---

## 7. Commerce integration

## 7.1 Shopify role

Shopify is checkout backend and commerce projection. It is not Create state storage.

### Custom shell strategy

Use separate shell products by **purchase mode x attachment track**.

For MVP magnetic-only, that means:

- `ONEMO Custom Effect`
- `ONEMO Custom Effect Pair`

If Velcro goes public later, add Velcro shell siblings rather than trying to add a fourth Shopify option.

### Why

ADR 10.1 locks inventory-bearing options to:

- size
- face material
- trim/back colour

That fits Shopify’s three-option limit. `attachment_system` stays canonical in ONEMO and selects the shell product, not a fourth option axis inside one shell.

## 7.2 Variant projection

`EffectShopifyProjector` does this:

1. pick shell product from `purchase_mode + attachment_system`
2. map canonical `size/face_material/trim_back_colour` into Shopify options
3. resolve exact variant
4. attach bounded line-item properties

### Public properties

- display title
- selected size
- selected face material
- selected trim/back colour
- order preview URL

### Private properties

Required:

- `_onemo_design_id`
- `_onemo_design_revision`
- `_onemo_product_spec_id`
- `_onemo_product_spec_version`
- `_onemo_scene_preset_id`
- `_onemo_scene_preset_version`
- `_onemo_attachment_system`
- `_onemo_purchase_mode`

Preferred when available:

- `_onemo_manufacturing_package_id`
- `_onemo_production_asset_ref`
- `_onemo_public_source_id`

## 7.3 Cart and checkout

- `POST /api/cart` is the public handoff boundary
- server validates approval currency and compatibility
- server creates Storefront API cart
- response returns `checkoutUrl`
- later Checkout Kit can reuse the same handoff contract

## 7.4 Webhooks

`orders/create` must:

1. parse ONEMO line properties
2. create order linkage record
3. verify manufacturing package exists
4. enqueue compile if missing
5. persist order preview reference and support metadata

### Idempotency keys

- cart handoff: `cart:{design_id}:{revision}:{variant_gid}`
- preview render: `preview:{design_id}:{revision}:{role}`
- manufacturing compile: `mfg:{design_id}:{revision}:{compiler_version}`
- order webhook: `shopify-order:{order_id}`

## 7.5 Merchant integration

If Create is embedded into Shopify PDPs, use:

- a small Shopify app package in the repo
- inline **app block** mount point
- product metafields for `product_spec_id`, `scene_preset_id`, enablement flags

Do not make app proxy the backbone. Use it only when storefront-origin fetches genuinely need it.

---

## 8. Manufacturing pipeline

## 8.1 Trigger rules

Compile can be triggered by:

- approval
- explicit ops request
- order webhook recovery if missing

Normal path should be **approval-time eager compile**. Webhook compile is recovery, not the main path.

## 8.2 Inputs

Compiler loads:

- immutable `design_revision`
- pinned `ProductSpec`
- pinned `ScenePreset`
- exact `.onemo` scene hash
- compiler version

## 8.3 Method routing

`ProductSpec.subtype_routes` owns the physical routing:

- `edge_trim` -> `method_a_edge_trim`
- `plain` -> `method_b_magnetic_caps`
- `tv_retro` -> `method_c_tv_retro`
- solid -> `solid`

This is driven by the sublimation heat constraint. Do not put method selection in UI state.

## 8.4 Outputs

`ManufacturingPackage` must include:

- immutable lineage refs
- method
- compiler version
- output assets
- transformed placements
- validations
- production asset ref
- pair / packaging context when relevant

### Method output examples

- **A**: print raster, registration JSON, BOM JSON, QA preview
- **B**: print raster, cap placement data, BOM JSON, QA preview
- **C**: patch raster, registration JSON, BOM JSON, QA preview

## 8.5 Production artifact immutability

If the user edits the design after approval, that creates a new revision. It does not mutate the prior manufacturing package.

That is the whole point of immutable revision snapshots.

---

## 9. Preview / render factory

## 9.1 One render factory

Use the same runtime to generate:

- owner continuity previews
- public presentation previews
- order confirmation previews
- catalog listing images
- fallback stills

No second render engine.

## 9.2 Architecture

- routes under `src/app/render/**`
- Playwright/Chromium worker
- route loads exact immutable revision snapshot
- runtime emits `render-ready`
- worker captures according to `ScenePreset.capture_presets`
- outputs uploaded to Cloudinary

## 9.3 Capture rules

The render page is ready only when:

- scene bundle loaded
- GLB loaded
- textures loaded
- ScenePreset applied
- camera settled
- one stable frame rendered

## 9.4 Naming policy

Recommended asset keys:

```text
designs/{designId}/owner/r{revision}.webp
designs/{designId}/public/r{revision}.webp
designs/{designId}/order/r{revision}.webp
catalog/{captureSetId}/{key}.webp
```

## 9.5 Catalog reuse

Catalog images should also come from this factory, not a separate asset workflow. That keeps PDP imagery, Create preview, and order proof in the same lighting/material universe.

---

## 10. Migration path from prototype to production

## 10.1 Freeze the prototype

Keep `src/app/(dev)/prototype/**` as a legacy reference. Stop adding features there.

## 10.2 Extract in slices, not a rewrite

### Slice 1 — core extraction
Move proven runtime pieces into `create/core` without changing behavior.

### Slice 2 — effect module extraction
Move mesh discovery, material application, and artwork mapping into `create/products/effect`.

### Slice 3 — contract adapter
Wrap the current prototype config object with adapters that emit:
- `ProductSpec`
- `ScenePreset`
- `DesignSessionV4`

### Slice 4 — persistence correction
Introduce:
- `design_revisions`
- repository contract tests
- Cloudinary asset adapter
- Supabase head + snapshot writes

### Slice 5 — route cutover
Replace `src/app/create/page.tsx` and draft routes with thin wrappers around `@create/*`.

### Slice 6 — render / commerce / manufacturing
Add workers last, once the core revision pipeline is stable.

## 10.3 Migration rules

- no big-bang renderer rewrite
- no attempt to keep Theatre compatibility
- no new logic in prototype paths
- support mesh-name fallback temporarily, but move assets to `userData.onemo.*` metadata
- keep column names like `design_spec_v2` if needed for migration, but bump the payload schema to `version: 4`

---

## 11. Gen AI integration points

## 11.1 What AI can do

AI is useful in five places:

### 1. Intake adapters
- prompt-to-image generation later
- connected import normalization later
- image-to-palette / image-to-crop suggestions

### 2. Sidecar intent translation
Translate natural language into typed actions:

- change material
- suggest trim colour
- move artwork slightly left
- explain why a cap path is blocked
- suggest pair vs receiver bundle

### 3. Review assistance
- explain compatibility rules
- summarize why proof is blocked
- suggest safe-area corrections

### 4. Post-proof media
- try-on stills
- lifestyle composites
- share captions

### 5. Ops assistance
- support summaries
- manufacturing package explanation
- issue triage against validation codes

## 11.2 What AI cannot do

AI may **not**:

- become the source of truth for product configuration
- mutate canonical design state without typed command validation and user acceptance
- bypass compatibility or safe-area rules
- generate the authoritative proof
- generate manufacturing packages directly
- decide construction method routing
- store hidden state only in prompts or chat history

## 11.3 AI command contract

```ts
export const AiCreateCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("set_variant"),
    axis: z.enum(["size", "face_material", "trim_back_colour"]),
    value: z.string().min(1),
  }),
  z.object({
    type: z.literal("placement_delta"),
    dx: z.number().optional(),
    dy: z.number().optional(),
    dscale: z.number().optional(),
    drotation_deg: z.number().optional(),
  }),
  z.object({
    type: z.literal("set_view"),
    camera_id: z.string().min(1),
  }),
  z.object({
    type: z.literal("explain_compatibility"),
    context: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    type: z.literal("suggest_bundle"),
    suggestion_kind: z.enum(["receiver", "pair", "starter_bundle"]),
  }),
])
```

AI outputs commands. The normal rule engine validates them. The renderer and artifacts stay deterministic.

---

## 12. Final decisions

### Keep
- one renderer
- four canonical artifacts
- Supabase + Cloudinary + Shopify split
- route handlers as public API boundary
- metadata-driven mesh contract
- browser-based headless capture
- product-family module registry

### Change from the baseline
- remove Theatre assumptions
- move Create to top-level `create/`
- add `.onemo` scene bundle as the scene exchange contract
- add immutable `design_revisions`
- extend schemas for `image_source`, `attachment_system`, `purchase_mode`, receiver context, and pair context
- make projection fallback the graceful-failure path instead of reviving a dedicated 2D editor

### Do not do
- no Shopify canonical state
- no raw authoring state in customer runtime
- no single mutable design row as the only revision store
- no AI-first configurator
- no order-preview generation on autosave
- no mesh-name-only asset contract

## Bottom line

The production Create module should be a **top-level, renderer-centered, artifact-driven system**.

The key correction is this:

**Create is not just a 3D page. It is the boundary where authored scene truth, customer intent, proof integrity, commerce projection, and manufacturing lineage all meet.**

If the module does not have:

- a real scene package contract (`.onemo`)
- immutable design revision snapshots
- shared renderer core
- product-family adapters
- deterministic projection into commerce and manufacturing

then it is still a prototype.
