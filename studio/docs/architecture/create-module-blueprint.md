# Create Module — Production Architecture Blueprint

**Sprint 43.9 Task 1 (KAI-4839)**
**Date:** 2026-04-06
**Author:** Kai (Claude Opus 4.6, CLI)
**Status:** Draft — pending Dan's approval

---

## 1. Context & Goal

The prototype at `src/app/(dev)/prototype/` proved the 3D renderer quality. The V3 architecture (March 24) + DEC S42-SCENE + Session 37 designed the production layout. This blueprint executes it.

**Goal:** Graduate from prototype to a production-ready configurator core with:
- Generic viewer shell (product-agnostic)
- Product module registry (Effect first, extensible to new families)
- Scene pipeline (Studio → .onemo → CDN → Create loads → user config deltas from DB)
- Foundation for attachment system variations, gen AI integration, and multiple product types

**Key decisions honored:**
- DEC S42-SCENE: Three.js scene graph is canonical. No conversion layers.
- Reflection 37.79: Two-layer format — .onemo template (CDN) + user config deltas (DB)
- Brief 37.83: Attachment systems are a dimension, not hardcoded
- Reflection 37.55: Product-family module registry with GLB userData discovery
- Reflection 37.67: Gen AI pipeline infrastructure wired from day one

---

## 2. Target Folder Structure

Everything lives in top-level `create/` — sibling to `studio/`, same pattern.

Next.js picks it up via tsconfig path alias: `"@create/*": ["./create/*"]`.

```
onemo-next/
├── create/                              ← Create module — top level, like studio/
│   ├── core/                            ← Shared viewer shell (Studio imports from here too)
│   │   ├── ViewerShell.tsx              ← Generic R3F Canvas: camera, orbit, environment, renderer sync
│   │   ├── SceneLoader.ts              ← Load .onemo ZIP → extract GLB + studio.json
│   │   ├── EnvironmentProvider.tsx      ← HDR/preset environment, intensity, rotation, ground
│   │   ├── RendererSync.tsx             ← Tone mapping, exposure, color space, shadows
│   │   ├── CameraSync.tsx              ← Camera position from config, orbit controls
│   │   ├── ModelLoader.tsx             ← Generic GLB loading via useGLTF, returns Object3D
│   │   ├── types.ts                    ← ViewerSceneConfig (product-agnostic scene contract)
│   │   ├── schema.ts                   ← Zod schemas for scene config validation
│   │   └── index.ts
│   │
│   ├── products/                        ← Product family modules
│   │   ├── registry.ts                 ← ProductFamilyModule interface + module registry
│   │   └── effect/                     ← Effect product family
│   │       ├── EffectRenderer.tsx      ← Material roles, artwork UV projection
│   │       ├── EffectSurfaceRegistry.ts ← Surface discovery from GLB userData / mesh names
│   │       ├── EffectOverrides.ts      ← Apply user material/artwork overrides
│   │       ├── types.ts               ← Effect-specific types (surface roles, material configs)
│   │       └── index.ts
│   │
│   ├── domain/                          ← Artifact schemas (Zod)
│   │   ├── scene-preset/
│   │   │   ├── schema.ts              ← ScenePreset Zod schema (derived from OnemoStudioJson)
│   │   │   ├── types.ts               ← ScenePreset TS types (inferred from Zod)
│   │   │   └── convert.ts             ← ScenePreset ↔ ViewerSceneConfig conversion
│   │   ├── design-session/
│   │   │   ├── schema.ts              ← DesignSession Zod schema
│   │   │   └── types.ts
│   │   └── product-spec/
│   │       ├── schema.ts              ← ProductSpec Zod schema (simplified v1)
│   │       └── types.ts
│   │
│   ├── CreateShell.tsx                  ← Customer-facing entry point (ViewerShell + product module + controls)
│   ├── ConfigPanel.tsx                  ← User controls: color, artwork, attachment system
│   ├── useScenePreset.ts                ← Load ScenePreset from CDN / API
│   ├── useDesignSession.ts              ← Manage DesignSession state (draft → save → DB)
│   ├── index.ts                         ← Module exports
│   │
│   └── docs/                            ← Architecture docs
│       └── create-module-blueprint.md   ← this file
│
├── studio/                              ← Studio — authoring tool (existing)
│
├── src/
│   └── app/
│       ├── create/
│       │   └── page.tsx                ← 1-line Next.js route → @create/CreateShell
│       └── (dev)/
│           └── prototype/              ← STAYS AS-IS — legacy/reference
```

**Two top-level application directories:**
- **`studio/`** — Dan's authoring tool (separate Vite build, PC Editor shell)
- **`create/`** — production Create module + shared renderer core

Studio imports from `create/core/` instead of `src/app/(dev)/prototype/core/`.
The Next.js route at `src/app/create/page.tsx` is a 1-line wrapper that imports `CreateShell` from `@create/`.

---

## 3. Viewer/Core Contract

The viewer shell is product-agnostic. It renders a 3D scene with camera, controls, environment, and lighting. It does NOT know what an Effect is.

### ViewerShell Props

```typescript
interface ViewerShellProps {
  /** Scene configuration — camera, environment, renderer settings */
  config: ViewerSceneConfig
  /** Model GLB URL to load */
  modelUrl?: string
  /** Whether user interaction is active (editing mode disables orbit) */
  isEditing?: boolean
  /** Product module renders as children inside the Canvas */
  children?: React.ReactNode
  /** Fires after Canvas + WebGLRenderer are created */
  onCreated?: (context: ViewerContext) => void
  /** External ref to OrbitControls for programmatic camera control */
  orbitControlsRef?: React.RefObject<OrbitControls | null>
  /** Callback when model finishes loading */
  onModelReady?: (modelRoot: THREE.Object3D) => void
}
```

### ViewerSceneConfig (product-agnostic)

```typescript
interface ViewerSceneConfig {
  camera: {
    position: [number, number, number]
    target: [number, number, number]
    fov: number
    near: number
    far: number
    enableDamping: boolean
    dampingFactor: number
  }
  environment: {
    preset?: string
    hdriUrl?: string
    intensity: number
    rotation: number
    ground?: { enabled: boolean; height: number; radius: number }
  }
  renderer: {
    toneMapping: number
    toneMappingExposure: number
    outputColorSpace: string
    shadowsEnabled: boolean
    shadowType: number
  }
  scene: {
    backgroundColor: string
    fog?: { type: 'linear' | 'exponential'; color: string; near?: number; far?: number; density?: number }
    ambientColor: [number, number, number]
    ambientIntensity: number
  }
}
```

### What's IN viewer/core vs what's OUT

| In viewer/core (generic) | Out (product-specific) |
|---|---|
| Canvas setup, dpr, gl config | Material role mapping |
| OrbitControls (damping, limits) | Artwork UV projection |
| Environment loading (HDR/preset) | Surface discovery |
| Camera sync from config | Color/material controls UI |
| Renderer settings sync | Product-specific props (artworkUrl, designState) |
| Background color | Manufacturing concerns |
| Model loading (GLB → Object3D) | DesignSession management |
| Fog, ambient light | Product type switching |

### Relationship to current code

`ViewerShell` extracts the generic parts from `EffectViewer.tsx`:
- `CameraConfigSync` → `CameraSync.tsx` (remove spherical conversion, use Cartesian directly)
- `RendererSettingsSync` → `RendererSync.tsx`
- `RendererBackgroundSync` → merged into `RendererSync.tsx`
- Canvas + OrbitControls setup → `ViewerShell.tsx`
- Environment → `EnvironmentProvider.tsx`
- `useGLTF` model loading → `ModelLoader.tsx`

**What does NOT move:** `artworkUrl`, `designState`, `EffectModel` — these are product-specific.

---

## 4. Product Module Registry

### ProductFamilyModule Interface

```typescript
interface ProductFamilyModule {
  /** Unique family identifier */
  family: string

  /** Display name */
  displayName: string

  /**
   * Discover surfaces/roles from a loaded GLB model.
   * Uses GLB userData tags (preferred) or mesh name patterns (fallback).
   */
  discoverSurfaces(modelRoot: THREE.Object3D): SurfaceRegistry

  /**
   * The React component that renders the product inside ViewerShell.
   * Receives the model root and surface registry.
   */
  Renderer: React.ComponentType<ProductRendererProps>

  /**
   * Apply user config overrides to the scene (colors, artwork, etc.)
   */
  applyOverrides(
    modelRoot: THREE.Object3D,
    surfaces: SurfaceRegistry,
    userConfig: Record<string, unknown>
  ): void

  /**
   * Get the user-facing control panel component.
   */
  ConfigPanel: React.ComponentType<ProductConfigPanelProps>
}

interface SurfaceRegistry {
  surfaces: Map<string, Surface>
  artworkSlot?: ArtworkSlot
}

interface Surface {
  role: string
  meshNames: string[]
  material: THREE.Material | THREE.Material[]
  configurable: boolean
  configurableProperties?: string[]
  defaults?: Record<string, unknown>
}

interface ArtworkSlot {
  meshName: string
  role: string
  textureChannel: string
  defaultUrl?: string
}
```

### GLB userData Discovery

Per V3 architecture (Reflection 37.55), GLBs should carry metadata:

```
mesh.userData.onemo = {
  surface_id: "face",
  surface_role: "primary-surface",
  material_slot: "suede_face",
  configurable: true,
  attachment_system: "magnetic-grid"  // ← attachment dimension
}
```

The `EffectSurfaceRegistry` discovers surfaces from:
1. **userData tags** (preferred) — `userData.onemo.surface_role`
2. **OnemoProductConfig** from studio.json (fallback) — `materialRoles[].meshNames`
3. **Hardcoded mesh name patterns** (legacy, last resort)

### How new families plug in

```typescript
// products/registry.ts
const registry = new Map<string, ProductFamilyModule>()

// Register Effect family
import { effectModule } from './effect'
registry.set('effect', effectModule)

// Future: register garment family
// import { garmentModule } from './garment'
// registry.set('garment', garmentModule)

export function getProductModule(family: string): ProductFamilyModule {
  const module = registry.get(family)
  if (!module) throw new Error(`Unknown product family: ${family}`)
  return module
}
```

---

## 5. ScenePreset Formalization

The `.onemo` format's `studio.json` IS already the ScenePreset. We formalize it:

### ScenePreset Zod Schema (simplified v1)

```typescript
import { z } from 'zod'

const MaterialRoleSchema = z.object({
  role: z.string(),
  meshNames: z.array(z.string()),
  defaults: z.record(z.unknown()).optional(),
  textures: z.record(z.string()).optional(),
  configurable: z.boolean(),
  configurableProperties: z.array(z.string()).optional(),
})

const ArtworkSlotSchema = z.object({
  meshName: z.string(),
  role: z.string(),
  defaultUrl: z.string().optional(),
  textureChannel: z.string(),
})

const ScenePresetSchema = z.object({
  version: z.number(),
  name: z.string(),
  created: z.string(),
  modified: z.string(),

  renderer: z.object({
    toneMapping: z.number(),
    toneMappingExposure: z.number(),
    outputColorSpace: z.string(),
    shadowsEnabled: z.boolean(),
    shadowType: z.number(),
  }),

  environment: z.object({
    file: z.string().nullable(),
    preset: z.string().nullable(),
    intensity: z.number(),
    rotation: z.number(),
    ground: z.object({
      enabled: z.boolean(),
      height: z.number(),
      radius: z.number(),
    }),
  }),

  scene: z.object({
    backgroundColor: z.union([z.string(), z.tuple([z.number(), z.number(), z.number()])]),
    fog: z.enum(['none', 'linear', 'exponential']),
    fogColor: z.string(),
    fogNear: z.number(),
    fogFar: z.number(),
    fogDensity: z.number(),
    ambientColor: z.tuple([z.number(), z.number(), z.number()]),
    ambientIntensity: z.number(),
  }),

  editorCamera: z.object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    target: z.tuple([z.number(), z.number(), z.number()]),
    fov: z.number(),
    near: z.number(),
    far: z.number(),
  }),

  product: z.object({
    productType: z.string(),
    materialRoles: z.array(MaterialRoleSchema),
    artworkSlot: ArtworkSlotSchema.optional(),
    attachmentSystem: z.string().optional(),   // ← NEW: magnetic | velcro | both
  }),

  materialOverrides: z.record(z.record(z.unknown())).optional(),
})

export type ScenePreset = z.infer<typeof ScenePresetSchema>
```

**This is the SAME shape as `OnemoStudioJson`** with one addition: `attachmentSystem` in the product config. No conversion needed — the .onemo format is already the ScenePreset.

---

## 6. Scene Pipeline

```
┌─────────────┐     .onemo ZIP          ┌─────────┐      ScenePreset        ┌────────────┐
│   Studio     │ ──────────────────────→ │   CDN   │ ←──── (studio.json)    │  Supabase  │
│  (authoring) │   scene.glb             │         │                         │            │
│              │   studio.json           │         │      DesignSession      │  designs   │
│              │   environment.hdr       │         │      (user deltas)  ──→ │  table     │
└─────────────┘                          └────┬────┘                         └─────┬──────┘
                                              │                                    │
                                              ↓                                    ↓
                                    ┌─────────────────┐                   ┌──────────────┐
                                    │  Create Viewer   │ ←── user config ─│ DesignSession│
                                    │  (production)    │                   │ {materials,  │
                                    │                  │                   │  artwork,    │
                                    │  ViewerShell     │                   │  colors}     │
                                    │  + EffectModule  │                   └──────────────┘
                                    └─────────────────┘
```

**Flow:**
1. Studio authors a scene → saves as `.onemo` ZIP (scene.glb + studio.json + env.hdr)
2. `.onemo` deployed to CDN (or served locally via step1-server during dev)
3. Create viewer loads `.onemo` → `SceneLoader.tsx` extracts GLB blob URL + studio.json
4. studio.json validated against `ScenePresetSchema` → becomes `ScenePreset`
5. `ScenePreset` → `ViewerSceneConfig` conversion (via `convert.ts`)
6. ViewerShell mounts with config, product module discovers surfaces from GLB
7. User config (DesignSession) loaded from DB → applied as overrides via product module
8. User changes → DesignSession updated in DB (autosave)

**Key invariant:** The .onemo template is the single 3D file. User configs are lightweight JSON deltas — artwork URL, material color overrides, placement coordinates. One template, millions of configurations.

---

## 7. Attachment System Dimension

Attachment systems flow through the full stack:

```
ProductSpec                  ScenePreset                    Create Viewer
┌───────────────┐           ┌──────────────────┐          ┌────────────────┐
│ attachmentSys │           │ product:         │          │ Product module │
│ ┌───────────┐ │           │   attachmentSys: │          │ reads          │
│ │ magnetic  │ │ ────────→ │   "magnetic"     │ ───────→ │ attachmentSys  │
│ │ velcro    │ │           │                  │          │ → swaps prefab │
│ │ both      │ │           │ materialRoles:   │          │ → adjusts UI   │
│ └───────────┘ │           │   (role-specific  │          │ → shows/hides  │
│               │           │    for system)   │          │   controls     │
└───────────────┘           └──────────────────┘          └────────────────┘
```

- **ProductSpec** defines which systems are available for a product type
- **ScenePreset** stores which system this particular template uses + system-specific material roles
- **Product module** reads `attachmentSystem` and adjusts: which prefab meshes are visible, which surfaces are configurable, what controls appear
- **GLB** carries meshes for all systems with `userData.onemo.attachment_system` tags. Product module shows/hides based on the active system.

---

## 8. File Migration Map

### What stays

| Current file | Stays where it is | Reason |
|---|---|---|
| `prototype/` (entire folder) | `src/app/(dev)/prototype/` | Legacy reference, not actively developed |
| `studio/` (entire folder) | `studio/` | Separate build, editor shell |
| `studio/src/editor/adapter/onemo-format.ts` | Keep + re-export from `create/domain/scene-preset/` | Already well-designed |
| `studio/src/editor/adapter/onemo-serialize.ts` | Keep | Studio-specific serialization |
| `studio/src/editor/adapter/onemo-deserialize.ts` | Keep | Studio-specific deserialization |

### What moves

| Current file | Moves to | What changes |
|---|---|---|
| `prototype/core/EffectViewer.tsx` | **Extracted into** `create/core/ViewerShell.tsx` | Remove artworkUrl, designState, EffectModel. Keep Canvas, OrbitControls, CameraSync, RendererSync, Environment |
| `prototype/core/EffectModel.tsx` | `create/products/effect/EffectRenderer.tsx` | Rename, keep material/artwork logic |
| `prototype/core/onemo-loader.ts` | `create/core/SceneLoader.ts` | Generic .onemo parsing. Product-specific conversion moves to `create/domain/scene-preset/convert.ts` |
| `prototype/types.ts` | Split: generic → `create/core/types.ts`, product → `create/products/effect/types.ts` |
| `prototype/user/ColorPanel.tsx` | `create/products/effect/` (part of Effect config panel) | Product-specific controls |
| `prototype/user/EditOverlay.tsx` | `create/products/effect/` | Artwork editing is product-specific |
| `prototype/user/Toolbar.tsx` | `create/create/` | Create-level UI shell |

### What's new

| New file | Purpose |
|---|---|
| `create/core/ViewerShell.tsx` | Generic viewer extracted from EffectViewer |
| `create/core/schema.ts` | Zod validation for ViewerSceneConfig |
| `create/products/registry.ts` | Product family module registry |
| `create/products/effect/EffectSurfaceRegistry.ts` | Surface discovery from GLB |
| `create/products/effect/EffectOverrides.ts` | Apply user overrides (from onemo-loader.ts `applyUserOverrides`) |
| `create/domain/scene-preset/schema.ts` | ScenePreset Zod schema |
| `create/domain/scene-preset/convert.ts` | ScenePreset → ViewerSceneConfig conversion |
| `create/domain/design-session/schema.ts` | DesignSession Zod schema |
| `create/create/CreateShell.tsx` | Production configurator assembly |
| `create/create/useScenePreset.ts` | Load and cache ScenePreset |
| `create/create/useDesignSession.ts` | Manage DesignSession lifecycle |
| `app/create/page.tsx` | Production route |

### Studio import changes

| Studio file | Current import | New import |
|---|---|---|
| `StudioViewport.tsx` | `from '../../../../src/app/(dev)/prototype/core/EffectViewer'` | `from '../../../../create/core'` |
| `StudioViewport.tsx` | `from '../../../../src/app/(dev)/prototype/types'` | `from '../../../../create/core/types'` |
| `effect-viewer-mount.tsx` | `from '../../../../src/app/(dev)/prototype/types'` | `from '../../../../create/core/types'` |
| `viewport-render.ts` | `from '../../../../src/app/(dev)/prototype/core/EffectViewer'` | `from '../../../../create/core'` (fix stale import) |
| `scene-schema.ts` | `from '../../../../src/app/(dev)/prototype/types'` | `from '../../../../create/core/types'` |
| `observer-r3f-bridge.ts` | `from '../../../../src/app/(dev)/prototype/core/EffectViewer'` + `types` | `from '../../../../create/core'` |

---

## 9. Gen AI Hooks

The gen AI integration has three touch points:

### 1. Video texture (image comes alive)

Standard Three.js pattern — no special architecture needed:

```typescript
// In the product module, after user finishes design:
const videoTexture = new THREE.VideoTexture(videoElement)
material.map = videoTexture  // Replace still artwork with animated version
```

The product module's `EffectRenderer` already manages the artwork texture on the mesh. Swapping still → video is a texture swap, not an architecture change.

### 2. Content generation pipeline

```
DesignSession (approved) → Job Queue → AI Provider → GeneratedMedia → CDN
```

The `GeneratedMedia` domain object (from Reflection 37.68) stores:
- Source design revision
- Media type (spin/recontext/vto/alive)
- Provider + prompt
- Output assets
- Moderation flags

This lives in `create/domain/generated-media/` — entirely independent of the viewer.

### 3. Render factory (controlled preview)

The render factory concept (V3 architecture Section 8): dedicated render pages at `app/render/` that the preview worker loads in Playwright to capture screenshots/videos.

```
app/render/
├── design/[designId]/[role]/page.tsx  ← Render specific design state
└── preset/[presetId]/page.tsx         ← Render preset for catalog
```

These pages mount ViewerShell + product module headlessly, wait for render-ready signal, and get captured by the worker.

### Infrastructure to wire now (build later)

- `create/domain/generated-media/schema.ts` — empty Zod schema with the type
- `app/render/` — placeholder route structure
- `create/products/effect/EffectRenderer.tsx` — `onRenderReady` callback for the render factory

---

## 10. Build Sequence

Numbered tasks for the rest of Sprint 43.9, in dependency order:

### Task 2: Extract create/core from EffectViewer
- Create `create/core/` directory
- Extract ViewerShell, CameraSync, RendererSync, EnvironmentProvider, ModelLoader
- Create `types.ts` with ViewerSceneConfig
- Export everything from `index.ts`
- **Verify:** Studio still builds and works after pointing imports to create/core

### Task 3: Create domain schemas
- Create `create/domain/scene-preset/schema.ts` with ScenePreset Zod schema
- Create `create/domain/scene-preset/convert.ts` (ScenePreset → ViewerSceneConfig)
- Create `create/domain/design-session/schema.ts` with DesignSession Zod schema
- Create `create/domain/product-spec/schema.ts` (simplified v1)
- **Verify:** Schemas validate against existing .onemo studio.json files

### Task 4: Create product module registry + Effect module
- Create `create/products/registry.ts` with ProductFamilyModule interface
- Create `create/products/effect/EffectRenderer.tsx` (from EffectModel)
- Create `create/products/effect/EffectSurfaceRegistry.ts`
- Create `create/products/effect/EffectOverrides.ts` (from onemo-loader applyUserOverrides)
- Register Effect module in registry
- **Verify:** Effect module can discover surfaces from existing GLBs

### Task 5: Build create/create (production configurator)
- Create `create/create/CreateShell.tsx` — assembles ViewerShell + Effect module
- Create `create/create/useScenePreset.ts` — load .onemo, validate, convert
- Create `create/create/useDesignSession.ts` — manage user config state
- Create `src/app/create/page.tsx` — production route
- **Verify:** /create loads a .onemo template and renders the Effect

### Task 6: Update Studio imports
- Point all 5 Studio files to `create/core` instead of `prototype/core`
- Fix the stale ViewerRenderPass import in viewport-render.ts
- **Verify:** Studio builds, loads scenes, saves scenes — full round-trip

### Task 7: Integration test + full visual audit
- Start Studio dev server, verify all fixes from Sprint 43.8 still work
- Start Create page, verify .onemo template loads and renders
- Test user config overrides (color change, artwork)
- Full browser click-through of both surfaces
- **Verify:** Both Studio and Create work with the new architecture

### Task 8: Wire gen AI + render factory placeholders
- Create `create/domain/generated-media/schema.ts` (empty type)
- Create `src/app/render/` placeholder route structure (Next.js routes stay in app/)
- Add `onRenderReady` callback to ViewerShell
- **Verify:** Placeholder exists, no runtime impact

---

## Key Architectural Principle

**The .onemo format IS the ScenePreset.** We don't create a new format — we formalize what already exists with Zod validation and version it. `OnemoStudioJson` becomes `ScenePreset`. `OnemoUserConfig` becomes `DesignSession`. The types in `onemo-format.ts` are already correct — they just need a Zod schema wrapper and a proper home in `create/domain/`.

The production configurator is NOT a rewrite. It's a reorganization of code that already works, into the layer boundaries that Session 37 already designed. Everything lives in `create/` — one directory, one home.
