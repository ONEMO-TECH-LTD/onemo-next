# Studio Architecture

## Overview

The ONEMO 3D Studio is a PlayCanvas Editor v2.20.1 fork with the rendering engine replaced by Three.js/R3F. The architecture has three layers:

1. **PlayCanvas UI Shell** — the editor interface (hierarchy panel, inspector forms, asset browser, toolbar, gizmo controls, console)
2. **Three.js/R3F Rendering** — the visible 3D viewport (EffectViewer, EffectModel, all rendering)
3. **Observer↔R3F Bridge** — the adapter layer that connects them (23 mapper files)

```
┌─────────────────────────────────────────────────────┐
│              PlayCanvas Editor UI Shell               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Hierarchy│ │ Inspector│ │  Assets  │ │Toolbar │ │
│  │  Panel   │ │  Panel   │ │  Panel   │ │  Bar   │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │
│       │             │            │            │      │
│       └─────────────┴────────────┴────────────┘      │
│                         │                            │
│              Observer↔R3F Bridge                     │
│              (23 mapper files)                       │
│                         │                            │
│       ┌─────────────────┴──────────────────┐        │
│       │       Three.js / R3F Scene          │        │
│       │  ┌────────────────────────────┐    │        │
│       │  │  EffectViewer (Canvas)     │    │        │
│       │  │  EffectModel (meshes)      │    │        │
│       │  │  Lights, Cameras, Gizmos   │    │        │
│       │  └────────────────────────────┘    │        │
│       └────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

## The Two Canvases

The editor has two canvases stacked in the viewport:

1. **PlayCanvas canvas** — created by the legacy PlayCanvas Application. Hidden with `opacity: 0` and `pointer-events: none`. Still runs for editor internals that depend on the engine, but nothing it renders is visible.

2. **R3F overlay** — an R3F `<Canvas>` mounted on top by `effect-viewer-mount.tsx`. This is what the user sees. All rendering, selection, gizmos, and interactions happen here.

```
viewport DOM:
├── playcanvas-canvas  (hidden, opacity: 0)
└── viewport-r3f-overlay  (visible, receives all input)
    └── <Canvas>  (R3F)
        ├── EffectModel (loaded GLB meshes)
        ├── TransformControls (gizmos)
        ├── OrbitControls (camera)
        ├── Environment (HDR)
        ├── GizmoHelper / GizmoViewcube
        └── Selection helpers (BoxHelper, LightHelper, etc.)
```

## The Bridge (Observer↔R3F)

The bridge is the core architectural piece. It lives in `src/editor/adapter/` and does two things:

**Three.js → PlayCanvas:** Reads the Three.js scene graph (meshes, materials, lights, cameras) and creates PlayCanvas entity observers. These observers populate the hierarchy panel and inspector. When a user clicks on an entity in the hierarchy, the inspector shows its properties — read from the observer, which reflects the Three.js object.

**PlayCanvas → Three.js:** When a user edits a property in the inspector (changes a color, adjusts roughness, moves an entity), the observer fires a change event. The bridge catches it and applies the change to the Three.js object. The viewport updates immediately.

### Mapper Files (23 total)

Each mapper handles one component type's translation between observer properties and Three.js objects:

| Mapper | Component | Three.js Object |
|--------|-----------|-----------------|
| `render-mapper.ts` | Render (mesh) | THREE.Mesh (visibility, shadows) |
| `material-mapper.ts` | Material | THREE.MeshPhysicalMaterial (83 properties) |
| `light-mapper.ts` | Light | THREE.DirectionalLight/PointLight/SpotLight |
| `camera-mapper.ts` | Camera | THREE.PerspectiveCamera/OrthographicCamera |
| `animation-mapper.ts` | Animation | THREE.AnimationMixer + clips |
| `anim-mapper.ts` | Anim (state graph) | THREE.AnimationMixer + state |
| `sound-mapper.ts` | Sound | THREE.PositionalAudio/Audio |
| `audiolistener-mapper.ts` | AudioListener | THREE.AudioListener |
| `sprite-mapper.ts` | Sprite | THREE.Sprite |
| `particle-mapper.ts` | ParticleSystem | THREE.Points + simulation |
| `gsplat-mapper.ts` | GSplat | Point cloud renderer |
| `collision-mapper.ts` | Collision | Wireframe shape helpers |
| `rigidbody-mapper.ts` | RigidBody | Property storage + indicators |
| `element-mapper.ts` | Element (UI) | Text/image sprites |
| `screen-mapper.ts` | Screen (UI) | Wireframe rectangle |
| `button-mapper.ts` | Button | State indicator overlay |
| `layoutgroup-mapper.ts` | LayoutGroup | Dashed boundary |
| `layoutchild-mapper.ts` | LayoutChild | Dashed boundary |
| `scrollview-mapper.ts` | ScrollView/Scrollbar | Scroll container indicator |
| `script-mapper.ts` | Script | Badge indicator |
| `zone-mapper.ts` | Zone | Wireframe volume |
| `model-mapper.ts` | Model (legacy) | Redirects to render-mapper |
| `entity-mapper.ts` | Entity base | Transform (position, rotation, scale) |

### Bridge Entry Points

- **`observer-r3f-bridge.ts`** — the main bridge class. Creates observers, routes changes, manages the entity↔object mapping.
- **`effect-viewer-mount.tsx`** — the mount point. Creates the R3F overlay, instantiates the bridge, connects editor events to viewer actions.
- **`bridge-utils.ts`** — shared helpers (label sprites, component storage, asset loading).
- **`bridge-audio-state.ts`** — shared AudioListener management.
- **`scene-schema.ts`** — scene serialization types and converters (being replaced by `onemo-format.ts`).
- **`onemo-format.ts`** — the new .onemo format type definitions.

## The Shared Viewer Core

The R3F rendering is built on the same core used by the user-facing prototype configurator:

- **`EffectViewer.tsx`** (`src/app/(dev)/prototype/core/`) — the R3F Canvas wrapper. Handles camera, environment, tone mapping, orbit controls, gizmos, selection, render modes, focus.
- **`EffectModel.tsx`** — the 3D model component. Loads GLB, traverses meshes, applies materials, handles artwork UV projection.

Both the studio and the user configurator use these same components. The studio adds the editor UI shell and the full bridge. The configurator adds the customer-facing controls (color picker, artwork upload). The 3D rendering core is shared.

## Local Dev Server (step1-server.mjs)

The `host/step1-server.mjs` is a self-contained HTTP server that:

1. **Generates the HTML shell** — dynamically creates `index.html` with editor config, loads `playcanvas.js` engine and `editor.js`
2. **Runs ShareDB** — in-memory OT database for real-time entity/settings state
3. **Manages asset registry** — scans `public/assets/` at startup, registers files with auto-generated IDs
4. **Serves scene API** — `GET/POST /api/onemo/scenes` for save/load
5. **Serves static files** — `dist/` (editor build), `vendor/` (PlayCanvas engine), `public/assets/` (models, textures)

The server creates a default scene document on startup via `createSceneDocument()`. Saved scenes are stored as JSON in `data/scenes/`.

## Network Isolation

The studio runs fully offline. The `STUDIO_NETWORK_OFFLINE` flag in `src/editor-api/studio-network-offline.ts` disables all outbound WebSocket connections:

- Realtime (ShareDB collab) — short-circuited to local stubs
- Relay (presence) — short-circuited
- WhoisOnline — disabled

All assets serve from localhost. Zero external network requests.
