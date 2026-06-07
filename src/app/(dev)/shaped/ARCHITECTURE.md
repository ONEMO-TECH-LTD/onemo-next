# Prototype Folder Architecture

> This document defines how the prototype folder is structured.
> Every file has a home. Follow this before creating anything new.
> The structure projects directly to production — admin/ is the clean cut line.

---

## Principle

The prototype is the **dev/admin version** of the future production embed. Everything built here either:
1. Ships to prod (core + user) — shared 3D viewer and customer controls
2. Stays dev-only (admin) — scene setup, material tuning, debug tools

The folder structure makes this separation physical, not conceptual. To produce the prod embed: exclude `admin/`, keep everything else.

---

## Current State vs Target

The target structure below is being built incrementally. Check the actual filesystem to see what has been migrated. The `admin/` folder exists and is populated. `core/` and `user/` are created as code is extracted from the monolithic `page.tsx` and `EffectViewer.tsx`.

If a file still lives at the prototype root, it is mid-migration. The target structure below is the authority on where it should end up.

---

## Folder Map

```
src/app/(dev)/prototype/
├── ARCHITECTURE.md          ← you are here
├── page.tsx                 ← dev page orchestrator (thin — imports from below)
├── types.ts                 ← shared types (typed interfaces, not loose records)
│
├── core/                    ← SHARED CORE — used by both admin and prod
│   ├── EffectViewer.tsx     ← Canvas wrapper: camera, environment, tone mapping, orbit
│   ├── EffectModel.tsx      ← 3D model: mesh traversal, material creation, UV projection
│   └── index.ts             ← re-exports
│
├── admin/                   ← ADMIN ONLY — exclude entirely for prod builds
│   ├── AdminViewer.tsx      ← wraps core/EffectViewer + adds Leva controls + store sync
│   ├── ScenePanel.tsx       ← scene save/load/delete UI
│   ├── sceneStore.ts        ← Zustand store: Leva bridge, scene config, baseline tracking
│   └── index.ts             ← re-exports
│
└── user/                    ← USER FACING — stays in prod
    ├── ColorPanel.tsx       ← back/frame/bg color swatches + custom picker
    ├── Toolbar.tsx          ← Upload, Edit, Reset buttons + file input
    ├── EditOverlay.tsx      ← edit mode indicator + gesture handler
    └── index.ts             ← re-exports
```

---

## How It Works

### Core (shared — never has admin dependencies)

The core viewer is **pure and prop-driven**. It receives all configuration as typed props — material values, scene settings, colors, model path, texture paths. It does NOT import from `admin/`. It does NOT import Leva. It does NOT manage state. It does NOT import Zustand stores.

```typescript
// core/EffectViewer props
interface EffectViewerProps {
  modelPath: string
  artworkUrl: string
  designState: DesignState
  face: FaceMaterialConfig
  back: BackMaterialConfig
  frame: FrameMaterialConfig
  scene: SceneSettings
  textures: TexturePaths
  isEditing: boolean
}
```

In admin mode: `admin/AdminViewer` wraps `core/EffectViewer`, uses Leva controls to generate the config values, and passes them down as props.

In prod mode: `(store)/create/page.tsx` imports `core/EffectViewer` directly, loads a saved scene JSON, and passes the config as static props.

### The R3F Canvas Boundary

R3F's `<Canvas>` creates a separate React fiber reconciler. Components inside Canvas cannot use regular DOM hooks/context from outside.

This matters for the admin/core split:
- **Leva controls (`useControls`)** are DOM components — they must live OUTSIDE the Canvas, in `admin/AdminViewer`.
- **EffectModel** (materials, meshes, textures) lives INSIDE the Canvas, in `core/EffectModel`.
- **The data bridge** between them is the Zustand store (`admin/sceneStore`). Zustand works across the Canvas boundary because it's a vanilla JS store, not React context.

```
┌─ admin/AdminViewer (DOM) ──────────────────┐
│  useControls() → values                    │
│  sceneStore.registerSetter() ← setters     │
│  values → props to core/EffectViewer       │
│                                            │
│  ┌─ core/EffectViewer (Canvas boundary) ─┐ │
│  │  core/EffectModel                     │ │
│  │  ← receives config as props           │ │
│  │  ← does NOT import store or Leva      │ │
│  └───────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

In admin mode, the sceneStore acts as the bidirectional bridge:
- **Admin → Core:** Leva values pass as props through AdminViewer → EffectViewer → EffectModel
- **Save:** AdminViewer reads current Leva values via the store's `getConfig()`
- **Load:** AdminViewer calls `applyConfig()` which calls Leva setters, which update props

In prod mode, there is no store, no Leva, no AdminViewer. Core receives props directly from a static JSON config.

### Admin (dev only — the clean cut line)

Everything in `admin/` is excluded for production. Contains:
- **AdminViewer** — Leva controls wrapping the core viewer (the glue layer)
- **ScenePanel** — scene save/load/delete UI
- **sceneStore** — Zustand store bridging Leva controls and the core viewer
- **Asset browsers** — future: texture picker, GLB selector, HDRI browser
- **Debug tools** — future: wireframe toggle, stats, light helpers

The admin folder can import from `core/` and `user/` but **never the reverse**. The dependency arrow is:

```
admin/ → core/    (admin wraps core)
admin/ → user/    (admin can read user state)
user/  → core/    (user controls feed into core)
core/  → nothing  (core is self-contained, prop-driven)
```

### User (customer facing — stays in prod)

User-facing controls that ship to customers. Currently:
- Color selection (swatches + custom picker)
- Artwork upload (file picker + drag/drop)
- Edit mode (position/scale artwork on the 3D surface)

User components can import from `core/` (e.g., shared types) but **never from `admin/`**.

---

## Typed Interfaces (types.ts)

All config types are strongly typed — no loose `Record<string, number | string>`. These types are the contract between admin, core, and scene config files.

```typescript
interface DesignState {
  offsetX: number
  offsetY: number
  scale: number
}

interface FaceMaterialConfig {
  roughness: number
  metalness: number
  envMapIntensity: number
  normalScale: number
  bumpScale: number
  sheen: number
  sheenColor: string
  sheenRoughness: number
  colorMultiplier: number
}

interface BackMaterialConfig {
  color: string
  roughness: number
  envMapIntensity: number
  normalScale: number
  bumpScale: number
  sheen: number
  sheenColor: string
  sheenRoughness: number
}

interface FrameMaterialConfig {
  color: string
  roughness: number
  metalness: number
  clearcoat: number
  clearcoatRoughness: number
}

interface SceneSettings {
  exposure: number
  ambientIntensity: number
  envIntensity: number
  background: string
}

interface TexturePaths {
  normal: string
  roughness: string
  height: string
  sheenColor?: string
}

interface SceneConfig {
  name: string
  created: string
  modified: string
  modelPath: string
  face: FaceMaterialConfig
  back: BackMaterialConfig
  frame: FrameMaterialConfig
  scene: SceneSettings
  textures: TexturePaths
  colors: { backColor: string; frameColor: string; bgColor: string }
}
```

`DesignState` is defined ONCE here — not duplicated in page.tsx or EffectViewer.tsx.

---

## Data Directory

```
data/                        ← runtime data (read/written by the app, dev only)
├── scenes/                  ← scene configuration JSON files
│   └── default.json         ← protected base scene (cannot be deleted)
├── specs/                   ← future: manufacturing specs (DesignSpec JSON)
└── exports/                 ← future: composed print images, output files
```

Scene files are read/written by the `/api/dev/scenes/` routes. The `default.json` is the baseline that loads on startup.

**Note:** `data/` is a dev-only runtime directory. In production, there is no filesystem CRUD — the prod embed bakes in a fixed scene config. `process.cwd()` in the API routes works for the Next.js dev server but not in all deployment environments (e.g., Vercel serverless). This is fine because `api/dev/` routes are excluded from prod.

---

## Static Assets

```
public/assets/               ← served by Next.js at runtime (read-only)
├── shapes/                  ← 3D models (GLB files)
├── materials/               ← PBR texture maps (normal, roughness, height, sheen)
│   └── ultrasuede/          ← current material set
├── env/                     ← HDRI environment maps (.exr)
└── test-artwork.png         ← default test image
```

New assets (GLBs, textures, HDRIs) go here. The admin panel lists available files from these directories via API routes.

---

## API Routes

```
src/app/api/dev/             ← dev-only API (all routes excluded for prod)
├── scenes/                  ← scene config CRUD
│   ├── route.ts             ← GET (list) + POST (save)
│   └── [name]/route.ts      ← GET (load) + DELETE
├── assets/                  ← future: list available GLBs, textures, HDRIs
├── output/                  ← existing: token CSS output
├── save/                    ← existing: token CSS save
├── generate/                ← existing: token generation
└── validate/                ← existing: token validation
```

**Security note:** GET/DELETE routes for scenes must sanitize the `name` parameter to prevent path traversal. Only alphanumeric, hyphens, and underscores allowed.

---

## Non-Runtime Archive

```
asset-library/               ← NOT used by the app — reference/archive only
├── reserved-copies/         ← complete approved setups as snapshots
├── presets/                 ← material preset documentation
├── textures/                ← alternative textures not currently in use
└── screenshots/             ← visual reference captures
```

---

## Rules

1. **Every new file goes in the right folder.** Admin code → `admin/`. User controls → `user/`. Viewer/3D → `core/`. No exceptions.
2. **Core never imports admin.** If core needs a value that admin controls, it receives it as a prop.
3. **Core never imports Leva.** Leva lives in admin/AdminViewer only.
4. **User never imports admin.** If user and admin need to share state, it flows through props in page.tsx.
5. **Admin can import everything.** It wraps core, reads user state, manages the store.
6. **page.tsx is a thin orchestrator.** It imports from all three folders and wires them together. No business logic in page.tsx.
7. **Types defined once in types.ts.** No duplicate interface definitions in other files.
8. **Runtime data → `data/`.** Scene configs, specs, exports. Not in `public/`, not in `src/`.
9. **Static assets → `public/assets/`.** GLBs, textures, HDRIs. Organized by type.
10. **Archive → `asset-library/`.** Snapshots, alternatives, reference. Never imported by the app.

---

## Prod Extraction (Future — KAI-2913)

When the embed architecture is locked:
1. Create `src/app/(store)/create/page.tsx`
2. Import `core/EffectViewer` + `user/` components
3. Load scene config from a fixed JSON (no admin, no Leva, no scene switching)
4. The `admin/` folder and `api/dev/` routes don't exist in the prod build
5. `data/scenes/` provides the default config that prod bakes in at build time
