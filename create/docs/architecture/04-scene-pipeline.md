# 04 — Scene Pipeline

> How scenes flow from Studio authoring to Create rendering.
> The .onemo format is the delivery contract. ScenePackageLoader is the bridge.
> Consolidation: U2 (.onemo is delivery, not artifact), D4 (ScenePackageRef + bundle schema).

## Phase: [Phase 1]

## The .onemo Format [Phase 1]

A `.onemo` file is an immutable, content-addressed ZIP containing:

| File | Required | Content |
|------|----------|---------|
| `scene.glb` | Yes | Three.js scene as glTF binary — meshes, materials, hierarchy |
| `studio.json` | Yes | ScenePreset payload — camera, lighting, materials, environment, product config |
| `environment.hdr` | No | Custom HDR environment map (if not using drei preset) |
| `bundle.json` | Yes | Self-describing metadata: `OnemoSceneBundle` schema (format_version, hashes, exported_at) |

### Key Invariants

- **One .onemo template, millions of DesignSessions.** The template is the only 3D file. Customer configs are JSON deltas.
- **.onemo is a delivery format, not an artifact (U2).** `ScenePreset` is the canonical DB artifact. `.onemo` is the content-addressed bundle produced from a published ScenePreset.
- **ScenePackageRef is what ScenePreset stores (D4).** A pointer with `package_id`, `package_hash`, `mesh_manifest_hash`, and `url`. The bundle has its own self-describing `OnemoSceneBundle` schema.

## ScenePackageRef [Phase 0]

Stored on ScenePreset. Points to the immutable bundle.

```typescript
interface ScenePackageRef {
  package_id: string            // unique bundle identifier
  package_hash: string          // SHA-256 of the full .onemo ZIP
  url: string                   // CDN URL for the .onemo file
  environment_url?: string      // optional separate HDR URL
  mesh_manifest_hash: string    // hash of mesh names + slot structure
}
```

**Hash validation on load:** ScenePackageLoader fetches the bundle, computes the hash, and rejects if it doesn't match `package_hash`. This prevents stale or corrupted scenes from entering the render pipeline.

## Pipeline Flow [Phase 1]

```
Studio                          .onemo file                    Create
┌──────────────────┐           ┌──────────────┐              ┌──────────────────┐
│ PlayCanvas UI    │  save →   │ scene.glb    │  load →      │ ViewerShell      │
│ + R3F viewport   │           │ studio.json  │              │ + ProductModule  │
│ + Bridge         │           │ bundle.json  │              │ + ConfigPanel    │
│                  │           │ env.hdr      │              │                  │
│ Authoring tool   │           └──────┬───────┘              │ Customer tool    │
│ Full controls    │                  │                      │ Limited controls │
│ All properties   │                  ↓                      │ Colors, artwork  │
└──────────────────┘           CDN (content-addressed)       └────────┬─────────┘
                                                                      │
                                                                      ↓
                                                             ┌──────────────────┐
                                                             │ Supabase         │
                                                             │ DesignSession    │
                                                             │ (mutable head)   │
                                                             │ + Revisions      │
                                                             │ (immutable)      │
                                                             └──────────────────┘
```

## ScenePackageLoader [Phase 1]

Loads a .onemo ZIP, validates hashes, and extracts the parts. Replaces the prototype's `parseOnemoConfig()`.

```typescript
interface LoadedScene {
  modelBlobUrl: string         // GLB as object URL
  preset: ScenePreset          // validated studio.json
  bundle: OnemoSceneBundle     // self-describing metadata
  environmentBlobUrl?: string  // HDR as object URL (if present in ZIP)
}

async function loadScenePackage(ref: ScenePackageRef): Promise<LoadedScene> {
  // 1. Fetch .onemo ZIP from CDN
  const response = await fetch(ref.url)
  const zipBuffer = await response.arrayBuffer()

  // 2. Validate package hash
  const actualHash = await computeSHA256(zipBuffer)
  if (actualHash !== ref.package_hash) {
    throw new ScenePackageIntegrityError(
      `Package hash mismatch: expected ${ref.package_hash}, got ${actualHash}`
    )
  }

  // 3. Extract ZIP entries
  const zip = await JSZip.loadAsync(zipBuffer)
  const glbEntry = zip.file('scene.glb')
  const studioJsonEntry = zip.file('studio.json')
  const bundleJsonEntry = zip.file('bundle.json')
  const hdrEntry = zip.file('environment.hdr')

  if (!glbEntry || !studioJsonEntry || !bundleJsonEntry) {
    throw new ScenePackageFormatError('Missing required files in .onemo')
  }

  // 4. Parse and validate bundle metadata
  const bundleRaw = JSON.parse(await bundleJsonEntry.async('text'))
  const bundle = OnemoSceneBundleSchema.parse(bundleRaw)

  // 5. Validate mesh manifest hash
  if (bundle.mesh_manifest_hash !== ref.mesh_manifest_hash) {
    throw new ScenePackageIntegrityError(
      `Mesh manifest hash mismatch — scene structure has changed`
    )
  }

  // 6. Parse studio.json as ScenePreset payload
  const presetPayload = JSON.parse(await studioJsonEntry.async('text'))
  const preset = ScenePresetPayloadSchema.parse(presetPayload)

  // 7. Create blob URLs
  const glbBlob = await glbEntry.async('blob')
  const modelBlobUrl = URL.createObjectURL(glbBlob)

  let environmentBlobUrl: string | undefined
  if (hdrEntry) {
    const hdrBlob = await hdrEntry.async('blob')
    environmentBlobUrl = URL.createObjectURL(hdrBlob)
  }

  return { modelBlobUrl, preset, bundle, environmentBlobUrl }
}
```

### Error Handling

| Error | Response |
|-------|----------|
| ZIP corrupt | Fall back to poster still (U8) |
| Hash mismatch | Reject — do not render stale scene |
| GLB missing from ZIP | Fatal — cannot render. Show poster still. |
| studio.json missing | Fatal — no scene config. Show poster still. |
| studio.json fails validation | Log warning, attempt load with defaults |
| HDR missing but referenced | Use drei preset fallback |

## Loading Strategy [Phase 1]

**New design:** Loading state while the 3D scene initializes. No poster — there's nothing to show yet.

**Existing design (resume):** The preview thumbnail from the library remains visible while the 3D engine loads. Once the scene is ready, it replaces the thumbnail. This is not a special system — it's just keeping the image that was already on screen.

**Fallback when 3D fails:** See [10-performance-contracts.md](10-performance-contracts.md) for the three-level fallback strategy.

## Studio Save Flow [Phase 1]

Studio saves → .onemo ZIP → CDN → ScenePreset gets `scene_package_ref` → Create loads.

1. Studio user adjusts scene (materials, camera, lighting, environment)
2. Studio's bridge syncs Three.js state from PlayCanvas observers
3. On save: Studio serializes the Three.js scene to GLB + studio.json + bundle.json
4. Compute `package_hash` (SHA-256 of ZIP) and `mesh_manifest_hash` (hash of mesh names)
5. Output ZIP deployed to CDN
6. Update ScenePreset with `scene_package_ref` pointing to the new bundle
7. Create loads the same ZIP at runtime via ScenePackageRef

### What studio.json Contains

`studio.json` = the runtime portion of `ScenePreset`. It contains everything the scene needs that GLB doesn't store:

- Surface material profiles (colors, roughness, metalness, PBR maps)
- Camera presets (position, target, FOV, orbit bounds)
- Lighting rig (HDRI, key/fill/rim lights, exposure, tone mapping)
- Render settings (background color, shadows, DPR)
- Product config (material roles, artwork slot, attachment system)
- Capture presets (viewport sizes for preview generation) [Phase 3]
- Gesture profiles (orbit bounds, drag sensitivity) [Phase 2]
- Presentation contexts (camera + background per context) [Phase 6]

### What studio.json Does NOT Contain

- Theatre.js source data (stripped on compile, Studio-only)
- Raw PlayCanvas observer state (editor UI only)
- Customer choices (those are DesignSession)

## Dev Server [Phase 1]

Studio's `host/step1-server.mjs` serves .onemo files during local development:

- `GET /api/onemo/scenes` — list available scenes
- `GET /api/onemo/scenes/:name` — download .onemo ZIP
- Port 3487

Create's dev setup uses the same server. The `useScenePreset` hook accepts either a CDN URL or a local dev server URL.

## ScenePreset to ViewerSceneConfig Conversion [Phase 1]

See [01-viewer-shell.md](01-viewer-shell.md) for the `scenePresetToViewerConfig()` function.

Key design decision: ViewerShell uses **Cartesian** camera position (position + target), not spherical (distance + polar + azimuth). The .onemo format already stores Cartesian. The prototype's spherical conversion in `onemo-loader.ts` is eliminated.

## DEC S42-SCENE Compliance [Phase 1]

Per DEC S42-SCENE: Three.js scene graph is the canonical format.

- Studio and Create are the same thing with different UI shells
- Studio saves → Three.js JSON → Create loads the same file
- No conversion layers between Studio and Create
- The ViewerConfig is a product-level view on top of the scene format, not a separate data model
