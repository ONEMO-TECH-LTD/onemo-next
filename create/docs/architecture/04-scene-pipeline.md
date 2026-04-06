# 04 — Scene Pipeline

> How scenes flow from Studio authoring to Create rendering.
> The .onemo format is the contract. SceneLoader is the bridge.

## Phase: [v1]

## The .onemo Format [v1]

A `.onemo` file is a ZIP containing:

| File | Required | Content |
|------|----------|---------|
| `scene.glb` | Yes | Three.js scene as glTF binary — meshes, materials, hierarchy |
| `studio.json` | Yes | ScenePreset — camera, lighting, materials, environment, product config |
| `environment.hdr` | No | Custom HDR environment map (if not using drei preset) |

**Key invariant:** One .onemo template, millions of DesignSessions. The template is the only 3D file. Customer configs are JSON deltas.

## Pipeline Flow [v1]

```
Studio                          .onemo file                    Create
┌──────────────────┐           ┌──────────────┐              ┌──────────────────┐
│ PlayCanvas UI    │  save →   │ scene.glb    │  load →      │ ViewerShell      │
│ + R3F viewport   │           │ studio.json  │              │ + ProductModule  │
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

## SceneLoader [v1]

Loads a .onemo ZIP and extracts the parts:

```typescript
interface LoadedScene {
  modelBlobUrl: string         // GLB as object URL
  preset: ScenePreset          // validated studio.json
  environmentBlobUrl?: string  // HDR as object URL (if present in ZIP)
}

async function loadScene(url: string): Promise<LoadedScene>
```

**Extracted from:** `prototype/core/onemo-loader.ts` → `parseOnemoConfig()` function (same logic, proper home).

### Loading Sequence

1. Fetch .onemo ZIP from CDN (or Studio's dev server at `localhost:3487`)
2. Extract ZIP entries
3. Create blob URL for `scene.glb`
4. Parse and validate `studio.json` against `ScenePresetSchema`
5. If `environment.hdr` exists, create blob URL
6. Return `LoadedScene`

### Error Handling

| Error | Response |
|-------|----------|
| ZIP corrupt | Fall back to still image if available |
| GLB missing from ZIP | Fatal — cannot render |
| studio.json missing | Fatal — no scene config |
| studio.json fails validation | Log warning, attempt load with defaults |
| HDR missing but referenced | Use drei preset fallback |

## Studio Save Flow [v1]

Studio saves → .onemo ZIP → Create loads. No intermediate conversion.

1. Studio user adjusts scene (materials, camera, lighting, environment)
2. Studio's bridge syncs Three.js state from PlayCanvas observers
3. On save: Studio serializes the Three.js scene to GLB + studio.json
4. Output ZIP deployed to CDN (or served locally by `studio/host/step1-server.mjs`)
5. Create loads the same ZIP at runtime

### What studio.json Contains

`studio.json` = the runtime portion of `ScenePreset`. It contains everything the scene needs that GLB doesn't store:

- Surface material profiles (colors, roughness, metalness, PBR maps)
- Camera presets (position, target, FOV, orbit bounds)
- Lighting rig (HDRI, key/fill/rim lights, exposure, tone mapping)
- Render settings (background color, shadows, DPR)
- Product config (material roles, artwork slot, attachment system)
- Capture presets (viewport sizes for preview generation) [v3]

### What studio.json Does NOT Contain

- Theatre.js source data (stripped on compile, Studio-only)
- Raw PlayCanvas observer state (editor UI only)
- Customer choices (those are DesignSession)

## Dev Server [v1]

Studio's `host/step1-server.mjs` serves .onemo files during local development:

- `GET /api/onemo/scenes` — list available scenes
- `GET /api/onemo/scenes/:name` — download .onemo ZIP
- Port 3487

Create's dev setup uses the same server. The `useScenePreset` hook accepts either a CDN URL or a local dev server URL.

## ScenePreset to ViewerSceneConfig Conversion [v1]

See [01-viewer-shell.md](01-viewer-shell.md) for the `scenePresetToViewerConfig()` function.

Key design decision: ViewerShell uses **Cartesian** camera position (position + target), not spherical (distance + polar + azimuth). The .onemo format already stores Cartesian. The prototype's spherical conversion in `onemo-loader.ts` is eliminated.

## DEC S42-SCENE Compliance [v1]

Per DEC S42-SCENE: Three.js scene graph is the canonical format.

- Studio and Create are the same thing with different UI shells
- Studio saves → Three.js JSON → Create loads the same file
- No conversion layers between Studio and Create
- The ViewerConfig is a product-level view on top of the scene format, not a separate data model
