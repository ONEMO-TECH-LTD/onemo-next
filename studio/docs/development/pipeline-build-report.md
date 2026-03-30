# Pipeline Build Report

Date: 2026-03-30
Branch: `task/kai-3924-onemo-pipeline`
Issues: `KAI-3938`, `KAI-3939`

## What Was Built

### Serialize

Created `studio/src/editor/adapter/onemo-serialize.ts` with `serializeOnemo(...)`.

The serializer now:

- exports a Three.js scene to binary GLB with `GLTFExporter`
- captures renderer settings into `studio.json`
- captures environment intensity/rotation with format defaults as fallback
- captures background color, fog, and ambient light state
- captures editor camera state
- embeds product config from `OnemoProductConfig`
- captures material override patches for non-GLTF-safe properties such as `envMapIntensity`
- packages `scene.glb`, `studio.json`, and optional `environment.hdr` into a ZIP blob

### Deserialize

Created `studio/src/editor/adapter/onemo-deserialize.ts` with `deserializeOnemo(...)`.

The deserializer now:

- reads `.onemo` blobs through `JSZip`
- tolerates missing or invalid `studio.json` by rebuilding a defaulted `OnemoStudioJson`
- accepts missing environment files and returns `null` for `environmentHdr`
- loads `scene.glb` through `GLTFLoader`
- reapplies renderer settings to the provided renderer
- best-effort decodes HDR/EXR environment files and attaches the resulting environment texture to the loaded scene state
- reapplies background, fog, environment intensity/rotation, and ambient light state onto the loaded scene group
- reapplies `materialOverrides` by material name
- returns the loaded scene group, parsed/defaulted `studioJson`, animation clips, and raw environment buffer

### Dependency

Added `jszip` to `studio/package.json` and updated `studio/package-lock.json`.

### Tests

Added `studio/test/common/onemo-pipeline.test.ts` covering:

- serialize ZIP packaging and `studio.json` extraction
- deserialize renderer/scene/material reapplication
- graceful fallback when `studio.json` is missing

The tests stub Three's browser-side GLTF IO internals so the pipeline logic can be verified in Node without relying on browser-only `FileReader` behavior.

## Verification

- `npm run build` in `studio/`: PASS
- `npm test` in `studio/`: PASS

Current suite result on 2026-03-30 is `160 passing`. The issue text referenced `157` tests, so the repo has moved since that brief was written.

## Notes

- `deserializeOnemo` normalizes the incoming `Blob` through `blob.arrayBuffer()` before handing it to `JSZip`, which makes the loader work in both browser and Node test environments.
- HDR `.hdr` files are decoded through `HDRLoader`; `.exr` files are decoded through `EXRLoader`.
- Ambient light is preserved through `studio.json` because glTF does not carry it as a native scene light type.
