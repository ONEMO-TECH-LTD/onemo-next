# Scene Pipeline

How scenes flow from the studio editor to the user-facing configurator.

## End-to-End Flow

```
┌──────────────┐     serialize      ┌──────────────┐     upload      ┌──────────────┐
│    STUDIO    │ ──────────────────▶ │  .onemo file │ ─────────────▶ │   CDN / S3   │
│   (editor)   │                    │  (template)  │                │   (storage)  │
└──────────────┘                    └──────────────┘                └──────┬───────┘
       │                                                                   │
       │ Three.js scene                                                    │ fetch
       │ is the SSOT                                                       │
       │                                                                   ▼
       │                                                           ┌──────────────┐
       │                                                           │ CONFIGURATOR │
       │                                                           │   (viewer)   │
       │                                                           └──────┬───────┘
       │                                                                  │
       │                                                    load template │ + config
       │                                                    from database │
       │                                                                  ▼
       │                                                           ┌──────────────┐
       │                                                           │  Three.js    │
       │                                                           │  Scene       │
       │                                                           │  (rendered)  │
       │                                                           └──────────────┘
       │
       │  Studio can also LOAD .onemo files (round-trip)
       │◀─────────────── deserialize ──────────────────
```

## Serialize (Studio → .onemo)

When the user clicks "Save" in the studio:

1. **Export GLB** — `GLTFExporter.parseAsync(scene)` walks the Three.js scene graph and produces a binary GLB containing all meshes, materials, lights, cameras, animations, and textures.

2. **Extract studio.json** — Read renderer settings from `WebGLRenderer` (toneMapping, exposure, colorSpace, shadows). Read environment config, scene settings (background, fog, ambient), editor camera state, product material role mappings. Serialize as JSON.

3. **Include environment** — If a custom HDR/EXR is loaded, include it in the ZIP as `environment.hdr`.

4. **Package ZIP** — Combine `scene.glb` + `studio.json` + `environment.hdr` (optional) into a single `.onemo` ZIP file.

5. **Store** — Save to `data/scenes/` (local dev) or upload to CDN (production).

```typescript
// Pseudocode
async function saveScene(name: string): Promise<Blob> {
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  const studioJson = extractStudioJson(renderer, scene, editorCamera, productConfig);
  const zip = new JSZip();
  zip.file('scene.glb', glb);
  zip.file('studio.json', JSON.stringify(studioJson, null, 2));
  if (environmentHdr) {
    zip.file('environment.hdr', environmentHdr);
  }
  return zip.generateAsync({ type: 'blob' });
}
```

## Deserialize (.onemo → Studio or Viewer)

When loading a scene (studio startup, scene picker, or viewer page load):

1. **Unzip** — Extract `scene.glb`, `studio.json`, and `environment.hdr` from the ZIP.

2. **Load GLB** — `GLTFLoader.loadAsync(scene.glb)` creates a complete Three.js scene graph with meshes, materials, lights, cameras, animations.

3. **Apply studio.json** — Configure the renderer (toneMapping, exposure, colorSpace, shadows). Load and apply the environment map. Set background color, fog, ambient light. Apply any materialOverrides for GLTFExporter gaps.

4. **Apply product config** — Map material roles to meshes by name. Apply default material values and textures for each role. Set up the artwork slot.

5. **Bridge rebuild (studio only)** — The bridge reads the new Three.js scene and creates PlayCanvas entity observers for the hierarchy/inspector.

6. **Apply user config (viewer only)** — If loading in the configurator with a user config from the database, apply material overrides (colors, textures) and artwork on top of the template defaults.

```typescript
// Pseudocode
async function loadScene(onemoBlob: Blob, userConfig?: OnemoUserConfig) {
  const zip = await JSZip.loadAsync(onemoBlob);
  const glbBuffer = await zip.file('scene.glb').async('arraybuffer');
  const studioJson = JSON.parse(await zip.file('studio.json').async('string'));
  const envBuffer = zip.file('environment.hdr')
    ? await zip.file('environment.hdr').async('arraybuffer')
    : null;

  // Load scene graph
  const gltf = await new GLTFLoader().parseAsync(glbBuffer, '');
  scene.add(gltf.scene);

  // Apply renderer settings
  renderer.toneMapping = studioJson.renderer.toneMapping;
  renderer.toneMappingExposure = studioJson.renderer.toneMappingExposure;
  renderer.outputColorSpace = studioJson.renderer.outputColorSpace;

  // Apply environment
  if (envBuffer) {
    const envTexture = new EXRLoader().parse(envBuffer);
    scene.environment = envTexture;
    scene.environmentIntensity = studioJson.environment.intensity;
  }

  // Apply user config overrides (configurator only)
  if (userConfig) {
    applyUserOverrides(gltf.scene, studioJson.product, userConfig);
  }
}
```

## User Configuration Flow

When a customer uses the configurator:

1. **Load template** — Fetch the `.onemo` file from CDN. Deserialize as above.
2. **Present controls** — Read `product.materialRoles` to know which controls to show. Each role with `configurable: true` gets a control panel. `configurableProperties` limits which fields are exposed.
3. **User makes changes** — Picks a color, uploads artwork, adjusts a slider. Each change applies directly to the Three.js material on the matching mesh.
4. **Save design** — The user's choices are saved as a JSON object to the database. This JSON only contains the deltas — NOT a new .onemo file.
5. **Load design** — Fetch template from CDN + config from database. Apply config overrides on top of template defaults. Render.

```
User picks red face color:
  1. UI sends: { role: 'face', color: '#ff0000' }
  2. Find meshes matching role 'face' (via product.materialRoles[0].meshNames)
  3. Set mesh.material.color = new THREE.Color('#ff0000')
  4. Save to DB: { templateId: 'effect-70mm', materials: [{ role: 'face', color: '#ff0000' }] }
```

## Round-Trip Guarantee

The serialize/deserialize pipeline must satisfy:

1. **Studio → Studio:** Save scene, load it back = identical scene (same entities, materials, lights, cameras, renderer settings)
2. **Studio → Viewer:** Save scene, load in configurator = identical render (same visual appearance)
3. **Viewer + Config:** Load template + apply user config = deterministic result

The round-trip is verified by visual comparison (screenshot diffing) during QA.

## What Replaces What

| Old | New | Status |
|-----|-----|--------|
| `SavedScene` type (scene-schema.ts) | `OnemoStudioJson` type (onemo-format.ts) | Replacing |
| `ViewerConfig` type (types.ts) | `OnemoStudioJson.product` + GLB scene | Replacing |
| `serializeScene()` (observer-r3f-bridge.ts) | GLTFExporter + studio.json extraction | Replacing |
| `deserializeScene()` (observer-r3f-bridge.ts) | GLTFLoader + studio.json application | Replacing |
| `savedSceneToViewerConfig()` (scene-schema.ts) | Direct scene load from .onemo | Replacing |
| `createDefaultViewerConfig()` (scene-schema.ts) | Default .onemo template file | Replacing |
| JSON scene files in `data/scenes/` | .onemo ZIP files in `data/scenes/` | Replacing |
