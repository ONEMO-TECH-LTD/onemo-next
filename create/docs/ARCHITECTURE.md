# Create Module — Architecture

> The production 3D product experience. Studio authors scenes, Create renders them for customers.
> Everything in this module lives under `create/` at the repo root.

---

## What This Module Is

Create is the customer-facing 3D product configurator. It loads scene templates authored in Studio, renders them with Three.js/R3F, and lets customers customize colors, artwork, and materials. Customer choices are stored as lightweight database records — not 3D files.

Create is to the customer what Studio is to Dan: same renderer, different controls.

## Directory Structure

```
create/
├── core/                            ← Shared viewer shell
│   ├── ViewerShell.tsx              ← R3F Canvas + camera + orbit + environment + renderer
│   ├── SceneLoader.ts               ← Load .onemo ZIP → GLB blob URL + studio.json
│   ├── types.ts                     ← ViewerSceneConfig, ViewerContext
│   └── index.ts
│
├── products/                        ← Product family modules
│   ├── registry.ts                  ← ProductFamilyModule interface + registry
│   └── effect/                      ← Effect product family (first and primary)
│       ├── EffectRenderer.tsx        ← Material roles, artwork UV, surface management
│       ├── EffectSurfaces.ts         ← Surface discovery from GLB userData + mesh names
│       ├── EffectOverrides.ts        ← Apply user config (colors, artwork) to scene
│       ├── types.ts                  ← Effect-specific types
│       └── index.ts
│
├── domain/                           ← Artifact schemas
│   ├── scene-preset.ts              ← ScenePreset Zod schema + types
│   ├── design-session.ts            ← DesignSession Zod schema + types
│   └── product-spec.ts              ← ProductSpec Zod schema + types (v1)
│
├── CreateShell.tsx                   ← Entry point: ViewerShell + product module + controls
├── ConfigPanel.tsx                   ← Customer controls: colors, artwork, attachment
├── useScenePreset.ts                 ← Load + validate + convert ScenePreset
├── useDesignSession.ts               ← DesignSession lifecycle (draft → save → DB)
├── index.ts                          ← Module exports
│
└── docs/
    └── ARCHITECTURE.md               ← this file
```

Next.js route: `src/app/create/page.tsx` — 1-line wrapper importing `CreateShell`.
Studio imports: `create/core/` replaces `src/app/(dev)/prototype/core/`.
tsconfig alias: `"@create/*": ["./create/*"]`

---

## How It Connects to Studio

```
Studio                          .onemo file                    Create
┌──────────────────┐           ┌──────────────┐              ┌──────────────────┐
│ PlayCanvas UI    │  save →   │ scene.glb    │  load →      │ ViewerShell      │
│ + R3F viewport   │           │ studio.json  │              │ + EffectRenderer │
│ + Bridge         │           │ env.hdr      │              │ + ConfigPanel    │
│                  │           └──────┬───────┘              │                  │
│ Authoring tool   │                  │                      │ Customer tool    │
│ Full controls    │                  ↓                      │ Limited controls │
│ All properties   │              CDN / local                │ Colors, artwork  │
└──────────────────┘                                         └────────┬─────────┘
                                                                      │
                                                                      ↓
                                                             ┌──────────────────┐
                                                             │ Supabase         │
                                                             │ DesignSession    │
                                                             │ (user deltas)    │
                                                             └──────────────────┘
```

**Pipeline:**
1. Studio saves scene as `.onemo` ZIP (scene.glb + studio.json + optional environment.hdr)
2. `.onemo` deployed to CDN (or served locally by `studio/host/step1-server.mjs`)
3. Create loads `.onemo` via `SceneLoader` → extracts GLB as blob URL + parses studio.json
4. studio.json validated as `ScenePreset` → converted to `ViewerSceneConfig`
5. `ViewerShell` mounts with config. Product module discovers surfaces from GLB.
6. Customer's `DesignSession` loaded from DB → applied as material/artwork overrides
7. Customer changes colors/artwork → DesignSession updated (autosave to DB)

**Key invariant:** One .onemo template, millions of DesignSessions. The template is the only 3D file. Customer configs are JSON deltas: artwork URL, color hex values, placement coordinates.

---

## core/ — Shared Viewer Shell

The viewer shell is **product-agnostic**. It renders a 3D scene with camera, controls, environment, and lighting. It does NOT know what an Effect is, what surfaces exist, or what artwork means.

Both Studio and Create use this same shell. Studio wraps it with the PlayCanvas editor UI. Create wraps it with customer controls.

### ViewerShell.tsx

```typescript
interface ViewerShellProps {
  config: ViewerSceneConfig
  modelUrl?: string
  isEditing?: boolean
  children?: React.ReactNode
  onCreated?: (ctx: ViewerContext) => void
  orbitControlsRef?: React.RefObject<OrbitControls | null>
  onModelReady?: (root: THREE.Object3D) => void
  onRenderReady?: () => void  // signals "first frame rendered" for render factory
}

interface ViewerContext {
  scene: THREE.Scene
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
}
```

**What ViewerShell does:**
- Creates R3F `<Canvas>` with configured dpr, camera, gl settings
- Mounts `<OrbitControls>` with damping, limits from config
- Loads environment (HDR file or drei preset) with intensity, rotation, ground projection
- Syncs renderer settings (tone mapping, exposure, color space, shadows) per frame
- Sets background color and fog from config
- Loads GLB model via `useGLTF` and calls `onModelReady` with the root Object3D
- Renders `children` inside the Canvas — product modules inject their components here

**What ViewerShell does NOT do:**
- Material role mapping
- Artwork texture application
- Surface discovery
- User config management
- Product-specific UI

### ViewerSceneConfig

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
    preset?: string          // drei preset name: 'studio', 'city', etc.
    hdriUrl?: string         // custom HDR/EXR file URL
    intensity: number
    rotation: number         // Y-axis degrees
    ground?: {
      enabled: boolean
      height: number
      radius: number
    }
  }
  renderer: {
    toneMapping: number      // THREE.ToneMapping enum
    toneMappingExposure: number
    outputColorSpace: string // 'srgb' or 'srgb-linear'
    shadowsEnabled: boolean
    shadowType: number       // THREE.ShadowMapType enum
  }
  scene: {
    backgroundColor: string  // CSS hex
    ambientColor: [number, number, number]
    ambientIntensity: number
    fog?: {
      type: 'linear' | 'exponential'
      color: string
      near?: number
      far?: number
      density?: number
    }
  }
}
```

### SceneLoader.ts

Loads a `.onemo` ZIP and extracts the parts:

```typescript
interface LoadedScene {
  modelBlobUrl: string        // GLB as object URL
  preset: ScenePreset         // validated studio.json
  environmentBlobUrl?: string // HDR as object URL (if present in ZIP)
}

async function loadScene(url: string): Promise<LoadedScene>
```

This is extracted from the existing `prototype/core/onemo-loader.ts` `parseOnemoConfig()` function — same logic, proper home.

### Relationship to current EffectViewer.tsx

ViewerShell extracts these pieces from the current `EffectViewer.tsx`:
- `CameraConfigSync` component → built into ViewerShell (Cartesian position, not spherical)
- `RendererSettingsSync` component → built into ViewerShell
- `RendererBackgroundSync` component → merged into renderer sync
- Canvas + OrbitControls setup → ViewerShell body
- Environment loading → ViewerShell body

What stays OUT: `artworkUrl`, `designState`, `EffectModel`, `onModelReady` material slot discovery — all product-specific.

---

## products/ — Product Family Modules

### ProductFamilyModule Interface

```typescript
interface ProductFamilyModule {
  family: string
  displayName: string

  // Discover configurable surfaces from a loaded GLB
  discoverSurfaces(
    modelRoot: THREE.Object3D,
    productConfig: ProductConfig  // from ScenePreset
  ): SurfaceRegistry

  // React component rendered inside ViewerShell as children
  Renderer: React.ComponentType<ProductRendererProps>

  // Apply user overrides to the live scene
  applyOverrides(
    modelRoot: THREE.Object3D,
    surfaces: SurfaceRegistry,
    overrides: MaterialOverride[]
  ): void

  // Customer-facing control panel
  ConfigPanel: React.ComponentType<ConfigPanelProps>
}

interface SurfaceRegistry {
  surfaces: Map<string, Surface>
  artworkSlot?: ArtworkSlot
}

interface Surface {
  role: string
  meshNames: string[]
  materials: THREE.Material[]
  configurable: boolean
  configurableProperties?: string[]
  defaults?: Record<string, unknown>
}

interface ArtworkSlot {
  meshName: string
  role: string
  textureChannel: string  // 'map' = diffuse
}
```

### Surface Discovery

Surfaces are discovered in priority order:

1. **GLB userData tags** (preferred): `mesh.userData.onemo.surface_role`
2. **ScenePreset productConfig** (fallback): `materialRoles[].meshNames` from studio.json
3. **Mesh name patterns** (legacy): hardcoded name matching as last resort

GLB userData convention:
```json
{
  "onemo": {
    "surface_id": "face",
    "surface_role": "primary-surface",
    "material_slot": "suede_face",
    "configurable": true,
    "attachment_system": "magnetic-grid"
  }
}
```

### Effect Module (products/effect/)

The first and primary product family. Handles:

- **EffectRenderer.tsx** — manages material application on discovered surfaces. Handles artwork texture loading and UV projection onto the face mesh. Extracted from current `prototype/core/EffectModel.tsx`.

- **EffectSurfaces.ts** — discovers face/back/frame surfaces from GLB. Reads from `OnemoProductConfig.materialRoles` (studio.json) or `userData.onemo` tags.

- **EffectOverrides.ts** — applies customer color and material changes to the live scene. Extracted from `prototype/core/onemo-loader.ts` `applyUserOverrides()`.

### Adding New Product Families

```typescript
// create/products/registry.ts
const registry = new Map<string, ProductFamilyModule>()

import { effectModule } from './effect'
registry.set('effect', effectModule)

// Future:
// import { garmentModule } from './garment'
// registry.set('garment', garmentModule)

export function getProductModule(family: string): ProductFamilyModule {
  const mod = registry.get(family)
  if (!mod) throw new Error(`Unknown product family: ${family}`)
  return mod
}
```

New families implement the `ProductFamilyModule` interface: provide a `Renderer`, `ConfigPanel`, surface discovery, and override application. The viewer shell doesn't change.

---

## domain/ — Artifact Schemas

Three artifacts drive the system. Defined as Zod schemas with inferred TypeScript types.

### ScenePreset (scene-preset.ts)

**What it is:** The .onemo file's `studio.json` content. Everything the scene needs that GLB doesn't store.

**Already exists as:** `OnemoStudioJson` in `studio/src/editor/adapter/onemo-format.ts`. We re-export and add Zod validation.

```typescript
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
    materialRoles: z.array(z.object({
      role: z.string(),
      meshNames: z.array(z.string()),
      defaults: z.record(z.unknown()).optional(),
      textures: z.record(z.string()).optional(),
      configurable: z.boolean(),
      configurableProperties: z.array(z.string()).optional(),
    })),
    artworkSlot: z.object({
      meshName: z.string(),
      role: z.string(),
      defaultUrl: z.string().optional(),
      textureChannel: z.string(),
    }).optional(),
    attachmentSystem: z.string().optional(),
  }),
  materialOverrides: z.record(z.record(z.unknown())).optional(),
})

type ScenePreset = z.infer<typeof ScenePresetSchema>
```

**Conversion:** `ScenePreset` → `ViewerSceneConfig` strips editor-only fields (editorCamera) and product config, keeping only the generic scene rendering config.

### DesignSession (design-session.ts)

**What it is:** A customer's choices applied on top of a scene template. Stored in Supabase.

**Already exists as:** `OnemoUserConfig` in `studio/src/editor/adapter/onemo-format.ts`. We formalize with Zod.

```typescript
const DesignSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  templateId: z.string(),          // references .onemo file
  presetVersion: z.number(),       // pin to specific ScenePreset version
  createdAt: z.string().datetime(),
  modifiedAt: z.string().datetime(),
  designRevision: z.number(),      // bumps on every save
  materials: z.array(z.object({
    role: z.string(),
    color: z.string().optional(),
    overrides: z.record(z.unknown()).optional(),
  })),
  artwork: z.object({
    url: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    scale: z.number(),
    rotation: z.number(),
  }).optional(),
  attachmentSystem: z.string().optional(),
})

type DesignSession = z.infer<typeof DesignSessionSchema>
```

### ProductSpec (product-spec.ts)

**What it is:** Defines what can physically exist for a product type. Constraints authority.

```typescript
const ProductSpecSchema = z.object({
  id: z.string(),
  family: z.string(),              // 'effect', 'garment', etc.
  productType: z.string(),         // 'standard-effect', 'shaped-effect'
  subtypes: z.array(z.string()),   // ['edge-trim', 'plain', 'tv-retro']
  variantAxes: z.array(z.object({
    name: z.string(),
    values: z.array(z.string()),
  })),
  attachmentSystems: z.array(z.string()),  // ['magnetic', 'velcro', 'both']
  surfaces: z.array(z.object({
    id: z.string(),
    role: z.string(),
    configurable: z.boolean(),
  })),
  defaultPresetId: z.string(),     // default ScenePreset to load
})

type ProductSpec = z.infer<typeof ProductSpecSchema>
```

---

## Attachment System Dimension

Attachment systems (magnetic grid, Velcro, both) are a dimension in the product model, not a hardcoded assumption.

**How it flows:**
- `ProductSpec.attachmentSystems` → defines which systems this product supports
- `ScenePreset.product.attachmentSystem` → which system this template is configured for
- `DesignSession.attachmentSystem` → customer's choice (if product supports multiple)
- GLB meshes carry `userData.onemo.attachment_system` tags
- Product module shows/hides meshes based on active system
- ConfigPanel shows system selector when multiple systems available

**Example:** An Effect that supports both magnetic and Velcro has meshes for both attachment surfaces in the GLB. When the customer switches from magnetic to Velcro, the product module hides the magnetic grid mesh and shows the Velcro surface mesh. The configurable surfaces may change (Velcro has different trim options).

---

## Gen AI Integration Points

Three hooks, wired in the architecture, built later:

### 1. Video Texture (Image Comes Alive)
After design finishes, AI generates a short animation of the artwork content. The video replaces the still texture on the mesh:
```typescript
const videoTexture = new THREE.VideoTexture(videoElement)
faceMaterial.map = videoTexture
```
Standard Three.js — no architecture change. Product module already manages the face texture.

### 2. Content Generation Pipeline
```
DesignSession → Job Queue → AI Provider (Veo 3 / Kling) → GeneratedMedia → CDN
```
Independent of the viewer. `domain/generated-media.ts` schema (empty for now).

### 3. Render Factory
Dedicated render pages at `src/app/render/` mount ViewerShell + product module headlessly. Playwright worker captures screenshots/video for product listings, share previews, order confirmations.

`ViewerShell.onRenderReady` signals "first frame stable" → worker captures.

---

## Migration Path

### Phase 1: Create core/ (extract from EffectViewer)
1. Create `create/core/ViewerShell.tsx` — extract Canvas, OrbitControls, CameraSync, RendererSync, Environment from `prototype/core/EffectViewer.tsx`
2. Create `create/core/SceneLoader.ts` — extract from `prototype/core/onemo-loader.ts`
3. Create `create/core/types.ts` — ViewerSceneConfig (generic parts of prototype/types.ts)
4. Verify: Studio builds after pointing imports to `create/core/`

### Phase 2: Create domain schemas
1. Create `create/domain/scene-preset.ts` — Zod schema wrapping existing OnemoStudioJson shape
2. Create `create/domain/design-session.ts` — Zod schema wrapping existing OnemoUserConfig shape
3. Create `create/domain/product-spec.ts` — simplified v1
4. Verify: schemas validate against existing .onemo studio.json files

### Phase 3: Create products/effect/ module
1. Create `create/products/registry.ts` — ProductFamilyModule interface
2. Create `create/products/effect/EffectRenderer.tsx` — from prototype/core/EffectModel.tsx
3. Create `create/products/effect/EffectSurfaces.ts` — surface discovery logic
4. Create `create/products/effect/EffectOverrides.ts` — from onemo-loader.ts applyUserOverrides
5. Verify: Effect module discovers surfaces from existing GLBs

### Phase 4: Build the Create experience
1. Create `create/CreateShell.tsx` — assembles ViewerShell + Effect module
2. Create `create/useScenePreset.ts` — load .onemo, validate, convert
3. Create `create/useDesignSession.ts` — manage user config state
4. Create `src/app/create/page.tsx` — Next.js route (1-line wrapper)
5. Add `@create/*` tsconfig alias
6. Verify: /create loads a .onemo template and renders the Effect

### Phase 5: Update Studio imports
1. Point all Studio files to `create/core/` instead of `prototype/core/`
2. Fix stale ViewerRenderPass import in viewport-render.ts
3. Verify: Studio builds, loads scenes, saves scenes — full round-trip

### Phase 6: Full visual audit
1. Studio click-through — all Sprint 43.8 fixes still work
2. Create click-through — .onemo loads, renders, orbit works
3. User overrides — change color, apply artwork, verify visual
4. Console clean, network clean, no regressions

---

## What Exists Today vs What's New

| Current file | → Production destination | Change type |
|---|---|---|
| `prototype/core/EffectViewer.tsx` | `create/core/ViewerShell.tsx` | Extract generic parts |
| `prototype/core/EffectModel.tsx` | `create/products/effect/EffectRenderer.tsx` | Move + rename |
| `prototype/core/onemo-loader.ts` | `create/core/SceneLoader.ts` | Extract generic parts |
| `prototype/types.ts` | Split → `create/core/types.ts` + `create/products/effect/types.ts` | Split |
| `prototype/user/ColorPanel.tsx` | `create/products/effect/` | Move |
| `prototype/user/EditOverlay.tsx` | `create/products/effect/` | Move |
| `prototype/user/Toolbar.tsx` | `create/` (root-level UI) | Move |
| `studio/src/editor/adapter/onemo-format.ts` | Stays + re-exported from `create/domain/` | Keep, add Zod |
| `studio/` (all) | Stays, imports change to `create/core/` | Import path update |
| `prototype/` (all) | Stays as legacy reference | Untouched |

### Studio Import Changes

| Studio file | Old import path | New import path |
|---|---|---|
| `StudioViewport.tsx` | `../../../../src/app/(dev)/prototype/core/EffectViewer` | `../../../../create/core` |
| `StudioViewport.tsx` | `../../../../src/app/(dev)/prototype/types` | `../../../../create/core/types` |
| `effect-viewer-mount.tsx` | `../../../../src/app/(dev)/prototype/types` | `../../../../create/core/types` |
| `viewport-render.ts` | `../../../../src/app/(dev)/prototype/core/EffectViewer` | `../../../../create/core` |
| `scene-schema.ts` | `../../../../src/app/(dev)/prototype/types` | `../../../../create/core/types` |
| `observer-r3f-bridge.ts` | `../../../../src/app/(dev)/prototype/core/EffectViewer` + types | `../../../../create/core` |

---

## Open Questions

1. **Should `create/core/` own the .onemo format types, or should they stay in `studio/src/editor/adapter/`?** The types are shared. Options: (a) keep in studio, re-export from create, (b) move to create/domain, studio imports from there, (c) extract to a shared types package.

2. **Does ViewerShell use Cartesian camera position (like .onemo format) or spherical (like current EffectViewer)?** The .onemo format stores Cartesian (position + target). EffectViewer uses spherical (distance + polar + azimuth). The current `onemo-loader.ts` converts. ViewerShell should probably use Cartesian directly and eliminate the conversion.

3. **How does the Studio's `step1-server.mjs` serve .onemo files during development?** Currently it serves scenes via `GET /api/onemo/scenes/:name`. Create needs the same API for local dev. Share the server, or Create runs its own?

4. **When does ScenePreset versioning start mattering?** The schema has `version: 1`. When we change the schema, older .onemo files need migration. For v1, not a concern. Worth noting for future.

5. **Where do product-family-specific controls live — in the product module or in the Create shell?** Blueprint says product module owns its ConfigPanel. But some controls (save, share, undo) are Create-level, not product-level. The boundary needs to be clear.

6. **GLB userData convention — who sets these tags?** Studio should write `userData.onemo.*` on export. Currently it doesn't. This is a Studio feature task.
