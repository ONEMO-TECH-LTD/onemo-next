# Create Module — System Design

> The bridge between UX specification and implementation.
> Derived from: Opus UX chain (04-12a), prototype inventory, locked ADRs.
> Approved by: [pending Dan's review]

---

## 1. Platform Context

Per locked decisions:

- **DEC S37-CONFIGURATOR-FIRST:** The Create configurator lives at `/create` in Next.js. It is NOT embedded in Shopify. It is a full-screen Next.js application.
- **DEC S37-SHOPIFY-HUB:** Shopify owns admin, orders, inventory. Next.js owns the creation experience. Cloudflare routes traffic between them on a unified domain.
- **DEC S42-SCENE:** Three.js scene graph is canonical. No conversion layers.
- **DEC S43-CREATE:** Create module lives at top-level `create/`, sibling to `studio/`.

```
Customer hits onemo.fashion/create
  → Cloudflare routes to Next.js (onemo-next)
  → /create route loads the configurator
  → Customer creates a design
  → At checkout → Storefront API creates Shopify cart
  → Redirect to Shopify checkout
  → Shopify webhook confirms order back to Next.js
```

---

## 2. What Exists Today (Prototype Inventory)

### Working Code

| Component | Location | What It Does |
|-----------|----------|-------------|
| EffectViewer | `prototype/core/EffectViewer.tsx` (286 lines) | R3F Canvas, OrbitControls, camera, environment, renderer sync |
| EffectModel | `prototype/core/EffectModel.tsx` (375 lines) | GLB loading via useGLTF, material roles, artwork texture, UV manipulation |
| onemo-loader | `prototype/core/onemo-loader.ts` (230 lines) | Parse .onemo ZIP → ViewerConfig + GLB blob URL |
| Toolbar | `prototype/user/Toolbar.tsx` (74 lines) | Upload button, edit toggle, reset, color toggle |
| ColorPanel | `prototype/user/ColorPanel.tsx` (104 lines) | Color swatches for back/frame/background |
| sceneStore | `prototype/admin/sceneStore.ts` (35 lines) | Zustand store for colors only |
| page.tsx | `prototype/page.tsx` (152 lines) | Loads template, manages local state (artwork, editing, design) |

### Working Infrastructure

| System | What Exists |
|--------|------------|
| Supabase | `designs` table with RLS, moderation states, crop_params jsonb |
| Cloudinary | Upload token signing, folder path conventions |
| Scene API | GET/POST/DELETE `/api/dev/scenes` — list, load, save .onemo files |
| Auth | Supabase session bootstrap, requireAuth() helper |
| .onemo format | Full type definitions in `studio/src/editor/adapter/onemo-format.ts` |

### Stub / Empty

| Component | Location | Status |
|-----------|----------|--------|
| Create page | `src/app/(store)/create/page.tsx` | Shell only — bootstraps session, shows user ID |
| Designs API | `src/app/api/designs/route.ts` | Stub — returns "stub" message |
| Design domain schemas | None | Not built |
| Design session persistence | None | Table exists, no hooks or use cases |

---

## 3. UX → Data Mapping

How each Opus content model object maps to real storage:

| UX Object | ID | Storage | Existing? | Maps To |
|-----------|-----|---------|-----------|---------|
| **DesignSession** | CM-001 | Supabase | Partially — `designs` table exists but schema is V1 | Extend `designs` table with session_id, progress_position, placement_transform, selected_* fields. Or: new `design_sessions` table alongside existing `designs`. |
| **ImageSource** | CM-002 | Supabase + Cloudinary | Partially — `cloudinary_asset_id` on designs, upload signing exists | New `image_sources` table or embed in DesignSession. Cloudinary upload flow exists. |
| **PreviewRender** | CM-003 | Client memory only | No | React state / ref. Never persisted. Re-derived from DesignSession on restore. |
| **PersistenceCheckpoint** | CM-004 | Supabase | No | New `design_checkpoints` table. Or: use the existing `designs.crop_params` jsonb as the snapshot field. |
| **ProductVariantContext** | CM-005 | Shopify (read via Storefront API) | Storefront client exists (`lib/shopify/storefront.ts`) | Read-only. Query Shopify for variant axes, pricing, availability at runtime. Cache briefly. |
| **ShareArtifact** | CM-006 | Supabase | Partially — `public_slug`, `is_public` on designs | Deferred. Existing fields can serve basic sharing. |
| **CartPayload** | CM-007 | Shopify (via Storefront API) | Client exists | Deferred. Build at checkout time from DesignSession + ProductVariantContext. |
| **OwnedEffect** | CM-008 | Supabase | No | Deferred. Created on purchase via webhook. |
| **Collection** | CM-009 | Supabase | No | Deferred. Query designs by user_id for now. |
| **PublishedProduct** | CM-010 | Supabase + Shopify | No | Post-MVP. |

### Key Data Decision

The existing `designs` table has useful fields but doesn't match the Opus DesignSession schema. Two options:

**Option A: Extend `designs` table.** Add columns for progress_position, selected_face_material, selected_trim_back_colour, selected_size, selected_finish, placement_transform (jsonb). Keep crop_params for backward compat.

**Option B: New `design_sessions` table.** Clean schema matching Opus exactly. Existing `designs` becomes the "owned outcome" (CM-008) layer. New sessions table is the active creation workspace.

**Recommendation: Option B.** The existing `designs` table was designed for V1 (post-creation records). DesignSession is the active creation workspace — different lifecycle, different access patterns. Cleaner to separate.

---

## 4. UX → Route Mapping

How the 15 Opus IA containers map to Next.js:

| IA Container | Type | Next.js Route | Component |
|-------------|------|---------------|-----------|
| **IA-01** Create entry | Screen | `/create` | CreateEntryPage — start new + saved designs grid |
| **IA-02** Creator shell | Shell | `/create/[designId]` | CreateShell — persistent workspace hosting modes |
| **IA-03** Intake mode | Mode | (within shell) | IntakeMode — upload trigger, first render |
| **IA-04** Configure mode | Mode | (within shell) | ConfigureMode — placement, material, color, size |
| **IA-05** Preview mode | Mode | (within shell) | PreviewMode — high-fidelity review, decision actions |
| **IA-06** Save sheet | Overlay | (bottom sheet) | SaveDraftSheet |
| **IA-07** Share sheet | Overlay | (bottom sheet) | ShareSheet (deferred) |
| **IA-08** Collection | Screen | `/collection` | CollectionPage (deferred) |
| **IA-09** Effect detail | Screen | `/collection/[effectId]` | EffectDetailPage (deferred) |
| **IA-10** Time-sensitive | Screen | `/effects/[variantId]` | AcquisitionPage (deferred) |
| **IA-11** Post-purchase | Screen | `/orders/[orderId]` | PostPurchasePage (deferred) |
| **IA-12** Restart dialog | Overlay | (modal) | RestartConfirmDialog |
| **IA-13** Shared view | Screen | `/shared/[shareId]` | SharedViewPage (deferred) |
| **IA-14** Commerce handoff | State | (external) | Shopify checkout — not our UI |
| **IA-15** Publish sheet | Overlay | (bottom sheet) | PublishSheet (post-MVP) |

### MVP Routes (what we build now)

```
/create                    → CreateEntryPage
/create/[designId]         → CreateShell
  (mode: intake)           → IntakeMode component
  (mode: configure)        → ConfigureMode component
  (mode: preview)          → PreviewMode component
```

### Mode Switching

The shell at `/create/[designId]` manages a `mode` state. No route changes for mode switches — instant, all state preserved. The active mode is determined by `DesignSession.progress_position`:

- Before first render → intake mode
- After first render, during editing → configure mode
- User initiates review → preview mode

---

## 5. UX → API Mapping

How the Opus flows map to server use cases and API routes:

### FLOW-01: Core Creation Journey

| Flow Step | User Action | API Route | Server Use Case |
|-----------|-------------|-----------|-----------------|
| S01 | Enter Create | — | (client-side routing) |
| S02 | Upload image | `POST /api/upload-permission` | Issue Cloudinary token (exists) |
| S03 | Validate image | `POST /api/designs/[id]/image` | Validate + create ImageSource |
| S04 | See first render | — | (client-side: load .onemo, mount viewer) |
| S05 | Adjust placement | `PATCH /api/designs/[id]` | Autosave placement_transform |
| S06 | Select material/color | `PATCH /api/designs/[id]` | Autosave selections |
| S07 | Select size | `PATCH /api/designs/[id]` | Autosave size + resolve variant |
| S08-S09 | Preview and inspect | — | (client-side: re-render from session) |
| S10 | Decision (save/buy/share) | Various | Route to appropriate flow |
| S11 | Purchase | `POST /api/designs/[id]/checkout` | Create Shopify cart via Storefront API |
| S12 | Post-purchase | — | (Shopify webhook → create OwnedEffect) |

### FLOW-02: Persistence and Resume

| Flow Step | API Route | Server Use Case |
|-----------|-----------|-----------------|
| S01 | `PATCH /api/designs/[id]` | Save explicit checkpoint |
| S02 | `GET /api/designs?mine=true` | List saved designs for resume |
| S03 | `GET /api/designs/[id]` | Load full session state for restore |

### API Routes to Build

```
POST   /api/designs              → createDesignDraft (new session)
GET    /api/designs              → listMyDesigns (saved designs grid)
GET    /api/designs/[id]         → getDesignSession (load for resume)
PATCH  /api/designs/[id]         → autosaveDesign (debounced updates)
POST   /api/designs/[id]/image   → uploadImage (validate + create ImageSource)
POST   /api/designs/[id]/review  → reviewDesign (run CompatibilityEngine)
POST   /api/designs/[id]/approve → approveDesign (lock revision)
POST   /api/designs/[id]/checkout → createCheckout (Shopify cart)
```

---

## 6. Existing → New Mapping

What prototype code becomes what production component:

| Prototype File | New Location | Change Type |
|----------------|-------------|-------------|
| `prototype/core/EffectViewer.tsx` | `create/core/ViewerShell.tsx` | Extract generic parts. Remove Effect-specific logic. |
| `prototype/core/EffectModel.tsx` | `create/products/effect/EffectRenderer.tsx` | Move + rename. Keep material role logic. |
| `prototype/core/onemo-loader.ts` | `create/core/ScenePackageLoader.ts` | Extract generic parts. Add hash validation. |
| `prototype/types.ts` | Split: `create/core/types.ts` + `create/products/effect/types.ts` | Split product-agnostic from Effect-specific. |
| `prototype/admin/sceneStore.ts` | `create/state/workspace-store.ts` | Expand from colors-only to full workspace state. |
| `prototype/user/Toolbar.tsx` | `create/ui/Toolbar.tsx` | Move, make props-based. |
| `prototype/user/ColorPanel.tsx` | `create/ui/ColorPanel.tsx` | Move, make props-based. |
| `prototype/page.tsx` | `create/[designId]/page.tsx` (shell) | Rewrite as shell with modes. |
| `studio/adapter/onemo-format.ts` | Stays + re-exported via `create/domain/` | Keep as format source of truth. |
| `lib/cloudinary/*` | Stays | Already production-ready. |
| `lib/supabase/*` | Stays | Already production-ready. |

---

## 7. State Management

From the UX spec (Opus 10 interaction architecture notes):

| State Category | What | Where | Persisted? |
|---------------|------|-------|-----------|
| **Session lifecycle** | session_id, owner_identity, progress_position | Supabase (DesignSession) | Yes |
| **Design choices** | placement, material, color, size, finish | Supabase (DesignSession) | Yes — autosaved |
| **Image source** | asset_url, validation_status | Supabase (ImageSource) | Yes |
| **Preview render** | render_status, config_snapshot | React state/ref | No — re-derived on restore |
| **Variant context** | Shopify product/variant/price/availability | Shopify API → React Query cache | No — fetched fresh |
| **Workspace UI** | active mode, edit state, undo stack | Zustand (WorkspaceStore) | No — reset on reload, restored from session |
| **Persistence status** | save state (saving/saved/error) | Zustand (WorkspaceStore) | No |

### Client State Architecture

```
React Query (canonical server state)
  ├── designSession query (GET /api/designs/[id])
  ├── productVariant query (Shopify Storefront API)
  └── myDesigns query (GET /api/designs?mine=true)

Zustand WorkspaceStore (working client state)
  ├── activeMode: 'intake' | 'configure' | 'preview'
  ├── pendingChanges: Partial<DesignSession>
  ├── undoStack: DesignSession[]
  ├── saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  └── editState: { isDragging, isEditing }

Refs (interaction runtime — not state)
  ├── orbitControlsRef
  ├── canvasRef
  └── gestureRef
```

---

## 8. Directory Structure

```
create/
├── core/                          ← Product-agnostic viewer infrastructure
│   ├── ViewerShell.tsx            ← R3F Canvas, camera, environment, orbit
│   ├── ScenePackageLoader.ts      ← .onemo ZIP loading + hash validation
│   └── types.ts                   ← ViewerConfig, LoadedScene
│
├── products/                      ← Product family modules (extensible)
│   ├── registry.ts                ← ProductFamilyModule interface + registry
│   └── effect/                    ← First product family
│       ├── EffectRenderer.tsx     ← GLB model, materials, artwork
│       ├── EffectSurfaces.ts      ← Surface discovery
│       └── types.ts               ← Effect-specific types
│
├── domain/                        ← Zod schemas derived from Opus CM-001–010
│   ├── design-session.ts
│   ├── image-source.ts
│   ├── preview-render.ts
│   ├── persistence-checkpoint.ts
│   ├── product-variant-context.ts
│   ├── deferred.ts                ← CM-006–010 type stubs
│   └── index.ts
│
├── server/                        ← Server-side logic
│   ├── repositories/              ← Data access (file-backed dev, Supabase prod)
│   │   ├── design-session.ts
│   │   ├── image-source.ts
│   │   ├── checkpoint.ts
│   │   └── index.ts               ← DI factory
│   ├── use-cases/                 ← Business logic
│   │   ├── create-draft.ts
│   │   ├── autosave.ts
│   │   ├── resume.ts
│   │   ├── review.ts
│   │   └── approve.ts
│   └── compatibility/             ← Domain rules engine
│       └── engine.ts
│
├── state/                         ← Client state management
│   └── workspace-store.ts         ← Zustand store for working state
│
├── ui/                            ← Prototype UI (props-based, swappable)
│   ├── Toolbar.tsx
│   ├── ColorPanel.tsx
│   ├── MaterialPicker.tsx
│   ├── SizeSelector.tsx
│   ├── SaveIndicator.tsx
│   └── ReviewActions.tsx
│
├── [designId]/                    ← Next.js route (shell)
│   ├── page.tsx                   ← CreateShell — hosts modes
│   └── _components/
│       ├── IntakeMode.tsx
│       ├── ConfigureMode.tsx
│       └── PreviewMode.tsx
│
├── page.tsx                       ← /create entry (start new + resume grid)
│
└── docs/
    └── architecture/              ← This folder
```

---

## 9. Build Sequence

Dependencies determine order. Each phase builds on the previous.

### Phase 0: Contracts (no UI, no viewer)
1. Domain schemas (`create/domain/`) — Zod types from Opus CM-001–010
2. Repository interfaces + file-backed implementations
3. Compatibility engine (pure functions, testable)
4. API route stubs (POST/GET/PATCH /api/designs)

**Depends on:** Nothing. Pure backend.
**Delivers:** Data layer that any frontend can use.

### Phase 1: Viewer (extract from prototype)
5. ViewerShell extraction from EffectViewer
6. ScenePackageLoader from onemo-loader
7. Product module registry + Effect module from EffectModel

**Depends on:** Phase 0 (types).
**Delivers:** Renderable 3D viewer, product-agnostic.

### Phase 2: Shell + Lifecycle (wire everything together)
8. Create shell route with 3 modes
9. Design lifecycle use cases (create, autosave, resume, review)
10. Prototype UI (functional props for the full flow)

**Depends on:** Phase 0 (data) + Phase 1 (viewer).
**Delivers:** A customer can upload → configure → review → save → resume.

---

## 10. What This Design Does NOT Cover

These are deferred to later phases:

- **Commerce handoff** (Phase 5) — Shopify cart, checkout, webhooks. Depends on operations decisions.
- **Manufacturing** (Phase 4) — Production coordinate transforms, compiler. Depends on manufacturing spec.
- **Share/Public** (Phase 6) — Private share, public pages, remix.
- **AI** (Phase 7) — Intent parsing, video textures, content generation.
- **Render factory** (Phase 3) — Headless Playwright capture for proof images.
- **Design system UI** — All UI is prototype-quality props. Design system swap happens after UX validation.
