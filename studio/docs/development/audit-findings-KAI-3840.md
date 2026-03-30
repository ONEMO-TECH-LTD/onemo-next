# KAI-3840 — Codex deep code audit (L1 + L2 partial + L3 + L4)

**Date:** 2026-03-30  
**Scope:** `onemo-next/studio` plus shared R3F viewer code in `onemo-next/src/app/(dev)/prototype/core/EffectViewer.tsx`  
**Method:** code-only audit. I ran the L3 commands directly, traced the adapter/UI wiring by reading source, and verified L4 exclusions with targeted grep + file review. I did **not** run the browser-facing L2 checklist in Chrome.

---

## Executive summary

| Layer | Result | What it means |
|---|---|---|
| **L3 — Code health** | **FAIL** | `npm run type:check` fails hard, `npm run lint` fails hard, `npm test` passes, `npm run build` passes. |
| **L1 — Feature parity** | **PARTIAL / FAIL by section** | The editor shell exists, the R3F overlay exists, and selection/transform/material-drop bridging exists. But many claimed parity paths still terminate in the hidden legacy engine canvas or only cover a narrow subset of the inspector surface. |
| **L2 — Visual + interactive (code-verifiable subset)** | **PARTIAL** | DOM structure, overlay mounting, selection wiring, gizmo wiring, transform history, drag-drop, and save/load handlers are present in code. No browser proof here. |
| **L4 — Scope exclusions** | **FAIL** | Some removals are real (`src/editor/vc`, toolbar GitHub/lightmapper files). But many exclusions are only stubbed, hidden, or still actively wired through menus, inspector fields, and legacy engine systems. |

### High-signal findings

1. **Viewport parity is overstated if you only follow legacy editor code paths.** The visible editor viewport is the R3F overlay inserted by [`effect-viewer-mount.tsx:160`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx) and the legacy canvas is explicitly hidden at [`effect-viewer-mount.tsx:170-171`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx). Several viewport controls still target the hidden engine stack, not the R3F overlay.
2. **Material and light inspector surfaces are much broader than the active bridge.** The material inspector exposes a large PlayCanvas-era schema surface in [`material.ts:159-917`](../onemo-next/studio/src/editor/inspector/assets/material.ts), but `material-mapper.ts` only applies a narrow subset in [`material-mapper.ts:40-190`](../onemo-next/studio/src/editor/adapter/material-mapper.ts). The light inspector exposes rich light/shadow/cookie/shape controls in [`light.ts:25-390`](../onemo-next/studio/src/editor/inspector/components/light.ts), but the mapper only handles basic color/intensity/range/shadow toggle/cone angles in [`light-mapper.ts:13-74`](../onemo-next/studio/src/editor/adapter/light-mapper.ts).
3. **Model thumbnails are not “Three.js only.”** Final drawing is done through the shared Three renderer in [`thumbnail-renderer.ts:17-250`](../onemo-next/studio/src/common/thumbnail-renderers/thumbnail-renderer.ts), but model thumbnails still source geometry/materials from `pc.Application.getApplication()` in [`model-thumbnail-renderer.ts:116-157`](../onemo-next/studio/src/common/thumbnail-renderers/model-thumbnail-renderer.ts).
4. **Static quality gates are red even though production build succeeds.** The repo currently has a “buildable but not statically clean” state.

---

## Acceptance criteria

| AC | Verdict | Evidence |
|---|---|---|
| Independent L3 verification (18 checks) | **PASS** | Table below. Commands executed directly in `studio/`. |
| Deep adapter code trace for all L1 WIRED items / 16 sections | **PASS** | Section trace below. I did not rubber-stamp existing WIRED labels; I downgraded sections where the path stops at the hidden engine canvas or at an incomplete mapper. |
| L4 exclusion verification (16 items) | **PASS** | Table below. Several items fail the exclusion gate. |
| Findings report with disagreements vs Composer flagged | **PASS** | Dedicated comparison section included. |

---

## L3 — Independent verification (18 checks)

| # | Check | Result | Evidence |
|---|---|---|---|
| 3.1 | No direct `from 'playcanvas'` in `src/editor/` + `src/common/` excluding compat | **PASS** | `grep` returned zero hits. |
| 3.2 | No direct `from 'playcanvas'` in `src/editor/viewport/` excluding `viewport-engine.ts` | **PASS** | `grep` returned zero hits. |
| 3.3 | `playcanvas-compat.ts` reads from global runtime | **PASS** | [`playcanvas-compat.ts:5-205`](../onemo-next/studio/src/common/playcanvas-compat.ts) uses a cached `globalThis.pc` source and exports through `read(...)`. |
| 3.4 | `viewport-engine.ts` re-exports via compat | **PASS** | [`viewport-engine.ts:1-6`](../onemo-next/studio/src/editor/viewport-engine.ts). |
| 3.5 | No orphaned `import ... from 'playcanvas'` under `src/` | **PASS** | `grep` returned zero hits. |
| 3.6 | Clean TypeScript (`npm run type:check`) | **FAIL** | Command exits `2`. Errors span adapter, UI, workers, animstategraph, and viewport code; sample failures start in `element-asset-list.ts`, `camera-mapper.ts`, `observer-r3f-bridge.ts`, `anim-viewer.ts`, `viewport-drop-*`, etc. |
| 3.7 | Clean lint (`npm run lint`) | **FAIL** | Command exits `1` with `214100 problems (214099 errors, 1 warning)`. |
| 3.8 | No `src/launch/` | **PASS** | Directory absent. |
| 3.9 | No `src/editor/expose.ts` | **PASS** | File absent. |
| 3.10 | Vendored engine runtime exists | **PASS** | `vendor/playcanvas/playcanvas.js` exists at `3,711,121` bytes. |
| 3.11 | No npm `playcanvas` dependency | **PASS** | `package.json` has `@react-three/drei`, `@react-three/fiber`, `three`, but no bare `playcanvas`. |
| 3.12 | `howdoi.json` has no PlayCanvas URLs | **PASS** | `static/json/howdoi.json` is `[]`. |
| 3.13 | Tests pass | **PASS** | `npm test` => `157 passing`. |
| 3.14 | No runtime `window.pc.*` / `globalThis.pc.*` outside compat | **PASS** | `grep` returned zero hits outside compat. |
| 3.15 | No unused engine-specific dependencies remain | **PARTIAL** | Engine-era packages still remain and are still referenced in runtime/editor code: `sharedb`, `ot-text`, `@playcanvas/observer`, `@playcanvas/pcui`, `@playcanvas/pcui-graph`, `@playcanvas/attribute-parser`. They are not orphaned, but they also are not removed. |
| 3.16 | No legacy branding in CSS / UI-visible code | **FAIL** | Branding remains in [`notify.ts:5`](../onemo-next/studio/src/editor/notify/notify.ts) (`playcanvas-logo-360.jpg`), [`layout-console.ts:198-202`](../onemo-next/studio/src/editor/layout/layout-console.ts), [`picker-cms.ts:648-656`](../onemo-next/studio/src/editor/pickers/project-management/picker-cms.ts), and Sass still imports `playcanvas-theme` at `sass/editor/_editor-main.scss:6865`. |
| 3.17 | No hardcoded `localhost:` in `src/` | **PARTIAL** | [`sourcefiles-attributes.ts:463`](../onemo-next/studio/src/editor/sourcefiles/sourcefiles-attributes.ts) still whitelists `localhost:51000`. |
| 3.18 | No `console.log` in adapter layer | **PASS** | `grep` returned zero hits in `src/editor/adapter/`. |

### Command results

| Command | Result |
|---|---|
| `npm run type:check` | **FAIL** |
| `npm run lint` | **FAIL** |
| `npm test` | **PASS** (`157 passing`) |
| `npm run build` | **PASS** |

### L3 score

- **PASS:** 13
- **FAIL:** 3
- **PARTIAL:** 2

---

## L1 — Deep trace by section

| § | Trace | Verdict | Notes |
|---|---|---|---|
| 1. Layout & panels | [`layout.ts:185-250`](../onemo-next/studio/src/editor/layout/layout.ts) builds root + toolbar + hierarchy + viewport + assets + inspector. [`effect-viewer-mount.tsx:160-173`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx) mounts the visible R3F overlay into the viewport. | **WIRED** | Layout shell is present and the visible viewport surface is the overlay. |
| 2. Viewport | [`effect-viewer-mount.tsx:50-145`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx) syncs selector/gizmo state into the overlay. [`EffectViewer.tsx:270-385`](../onemo-next/src/app/(dev)/prototype/core/EffectViewer.tsx) provides raycast select, `TransformControls`, and viewcube; [`EffectViewer.tsx:472-543`](../onemo-next/src/app/(dev)/prototype/core/EffectViewer.tsx) provides `Canvas`, `Environment`, and `OrbitControls`. | **PARTIAL** | Orbit/pan/zoom/selection/transform/viewcube are R3F. But wireframe/debug render modes live in [`viewport-render.ts:104-147`](../onemo-next/studio/src/editor/viewport-controls/viewport-render.ts), focus in [`viewport-focus.ts:68-83`](../onemo-next/studio/src/editor/viewport/viewport-focus.ts), and ortho shortcuts in [`camera-shortcuts.ts:8-106`](../onemo-next/studio/src/editor/viewport/camera/camera-shortcuts.ts) all target the hidden engine path, not the visible overlay. No R3F grid exists (`rg` over `prototype/core` found no `Grid`/`GridHelper`). |
| 3. Hierarchy panel | [`entities-treeview.ts:103-154`](../onemo-next/studio/src/editor/entities/entities-treeview.ts) handles rename/reparent/selection; [`entities-hotkeys.ts:1-172`](../onemo-next/studio/src/editor/entities/entities-hotkeys.ts) handles create/duplicate/delete/copy/paste; selection reaches the overlay through [`effect-viewer-mount.tsx:50-106`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx). | **PARTIAL** | The hierarchy shell is live, but end-to-end viewport outcomes for some actions still depend on the legacy entity/runtime layer rather than a purely R3F scene graph. |
| 4. Inspector panel | [`entity.ts:265-314`](../onemo-next/studio/src/editor/inspector/entity.ts) builds the entity inspector + Add Component menu; component/asset inspectors remain extensive. | **PARTIAL** | Inspector UI is present, but renderer parity depends on mapper coverage, which is incomplete for materials, lights, cameras, and lightmapped properties. |
| 5. Assets panel | [`asset-panel.ts:63-110`](../onemo-next/studio/src/editor/assets/asset-panel.ts) defines asset types/openable types. [`effect-viewer-mount.tsx:175-304`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx) bridges material-drop, model-load, and environment-load into the viewer. | **PARTIAL** | Asset browser exists. Material DnD to visible viewport is genuinely wired. Broader asset parity is mixed. |
| 6. Toolbar | [`toolbar-gizmos.ts:12-232`](../onemo-next/studio/src/editor/toolbar/toolbar-gizmos.ts) drives gizmo mode/space/focus. [`toolbar-history.ts:1-68`](../onemo-next/studio/src/editor/toolbar/toolbar-history.ts) drives undo/redo. [`viewport-launch.ts:19-27`](../onemo-next/studio/src/editor/viewport-controls/viewport-launch.ts) stubs launch. [`toolbar-code-editor.ts:6-27`](../onemo-next/studio/src/editor/toolbar/toolbar-code-editor.ts) opens external editors only. | **PARTIAL** | Core gizmo/history controls exist. Launch is stubbed. Publish is stubbed (see §7/L4). |
| 7. Scene management | [`effect-viewer-mount.tsx:336-390`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx) implements scene list/load/save. [`observer-r3f-bridge.ts:532-584`](../onemo-next/studio/src/editor/adapter/observer-r3f-bridge.ts) serializes scenes; [`observer-r3f-bridge.ts:587-620`](../onemo-next/studio/src/editor/adapter/observer-r3f-bridge.ts) deserializes entity transforms/state. | **PARTIAL** | Save/load path is real. Scene settings application is narrow: the bridge only applies exposure, skybox intensity, tonemapping, and gamma, not the full scene-settings surface. |
| 8. Materials | Full source-style material UI remains in [`material.ts:159-917`](../onemo-next/studio/src/editor/inspector/assets/material.ts). Texture slot aliasing and texture metadata handling exist in [`observer-r3f-bridge.ts:170-191`](../onemo-next/studio/src/editor/adapter/observer-r3f-bridge.ts) and [`observer-r3f-bridge.ts:1737-1848`](../onemo-next/studio/src/editor/adapter/observer-r3f-bridge.ts). Scalar/property writes are limited to [`material-mapper.ts:40-190`](../onemo-next/studio/src/editor/adapter/material-mapper.ts). | **FAIL** | Direct path comparison shows `83` unique `data.*` UI fields in the material inspector versus roughly `24` directly handled asset paths in the bridge/mapper. AO intensity, ambient color, specular workflow, anisotropy intensity/rotation, alpha-to-coverage/dither/fade, refraction/IOR/dispersion/attenuation/thickness scalars, iridescence scalars, environment projection/reflectivity, and many render-state toggles have UI but no matching material-side adapter logic. |
| 9. Lighting | Light UI surface in [`light.ts:25-390`](../onemo-next/studio/src/editor/inspector/components/light.ts). Bridge creation/update in [`light-mapper.ts:13-74`](../onemo-next/studio/src/editor/adapter/light-mapper.ts). | **FAIL** | The inspector exposes `39` `components.light.*` paths; the mapper directly handles about `7`. Runtime type switching, area-light shapes, falloff mode, cookies, cascades, resolution, bias, shadow distance/intensity/type, VSM settings, layers, and bake/static flags are not bridged into Three lights. |
| 10. Camera | Camera UI surface in [`camera.ts:9-151`](../onemo-next/studio/src/editor/inspector/components/camera.ts). Bridge creation/update in [`camera-mapper.ts:12-72`](../onemo-next/studio/src/editor/adapter/camera-mapper.ts). Viewer camera instantiation in [`EffectViewer.tsx:472-485`](../onemo-next/src/app/(dev)/prototype/core/EffectViewer.tsx). | **FAIL** | The inspector exposes `16` `components.camera.*` fields; the mapper directly handles `5`. The visible viewer is created as a perspective `Canvas` camera and the R3F mount listens to gizmo events, not `camera:set` / `camera:shader:pass` / projection changes. |
| 11. Keyboard shortcuts | [`entities-hotkeys.ts:1-172`](../onemo-next/studio/src/editor/entities/entities-hotkeys.ts), [`toolbar-gizmos.ts:168-232`](../onemo-next/studio/src/editor/toolbar/toolbar-gizmos.ts), [`viewport-expand.ts:1-35`](../onemo-next/studio/src/editor/viewport/viewport-expand.ts), [`camera-shortcuts.ts:8-106`](../onemo-next/studio/src/editor/viewport/camera/camera-shortcuts.ts). | **PARTIAL** | Entity CRUD and gizmo hotkeys exist. Camera preset/projection shortcuts still drive the hidden engine camera system. |
| 12. Entity components | Add Component menu and per-component inspectors live in [`entity.ts:265-314`](../onemo-next/studio/src/editor/inspector/entity.ts) and [`entity.ts:436-463`](../onemo-next/studio/src/editor/inspector/entity.ts). Bridge observer handling for render/light/camera/material assignments is in [`observer-r3f-bridge.ts:1916-1970`](../onemo-next/studio/src/editor/adapter/observer-r3f-bridge.ts). | **PARTIAL** | Render/light/camera have a bridge. Many other component inspectors remain legacy editor surfaces with no matching R3F adapter path in this bridge. |
| 13. Asset types & pipeline | Asset types/openables in [`asset-panel.ts:63-110`](../onemo-next/studio/src/editor/assets/asset-panel.ts). Viewer asset entry points in [`effect-viewer-mount.tsx:260-274`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx). Model/environment updates in [`observer-r3f-bridge.ts:310-330`](../onemo-next/studio/src/editor/adapter/observer-r3f-bridge.ts). | **PARTIAL** | Material/model/texture/cubemap/font paths exist. Many source-editor asset types (shader, animstategraph, WASM, GSplat tooling) remain editor-managed rather than clearly bridged into the R3F viewport. |
| 14. Thumbnail rendering | Shared Three/Canvas renderer in [`thumbnail-renderer.ts:17-250`](../onemo-next/studio/src/common/thumbnail-renderers/thumbnail-renderer.ts). Material thumbnails are pure Three in [`material-thumbnail-renderer.ts:67-123`](../onemo-next/studio/src/common/thumbnail-renderers/material-thumbnail-renderer.ts). Model thumbnails use engine preview assets in [`model-thumbnail-renderer.ts:116-157`](../onemo-next/studio/src/common/thumbnail-renderers/model-thumbnail-renderer.ts). | **PARTIAL** | Final rendering is Three-based, but model thumbnails still depend on PlayCanvas preview objects/resources. |
| 15. Post effects | No `@react-three/postprocessing` dependency in `package.json`; code search for `postprocessing` in `studio/src` and shared viewer code returns zero hits. | **MISSING / DEFERRED** | No visible post-effect pipeline is wired. |
| 16. Layer system | Full layer composition still exists in [`viewport-layers.ts:22-194`](../onemo-next/studio/src/editor/viewport/viewport-layers.ts). Layer editing UI remains in [`layers.ts`](../onemo-next/studio/src/editor/inspector/settings-panels/layers.ts) and [`layers-render-order.ts`](../onemo-next/studio/src/editor/inspector/settings-panels/layers-render-order.ts). | **FAIL** | This is still the old PlayCanvas `LayerComposition` model, not a simplified Three.js-only approach. |

---

## Deep checks the issue explicitly asked for

### Materials — mapper coverage vs inspector surface

| Surface | Evidence | Result |
|---|---|---|
| Inspector breadth | [`material.ts:159-917`](../onemo-next/studio/src/editor/inspector/assets/material.ts) covers AO, diffuse, metalness/specular workflows, gloss, emissive, opacity, normals, parallax, clearcoat, sheen, refraction, iridescence, environment, lightmap, and other render-state toggles. | **Broad UI present** |
| Direct scalar/property mapper | [`material-mapper.ts:51-74`](../onemo-next/studio/src/editor/adapter/material-mapper.ts) creates only diffuse, metalness, roughness/gloss, normal strength, emissive, opacity/blend/alphaTest, clearcoat, and sheen defaults. [`material-mapper.ts:89-184`](../onemo-next/studio/src/editor/adapter/material-mapper.ts) updates the same narrow slice. | **Narrow bridge** |
| Texture slot bridge | [`observer-r3f-bridge.ts:170-191`](../onemo-next/studio/src/editor/adapter/observer-r3f-bridge.ts) maps many texture slots. [`observer-r3f-bridge.ts:1737-1848`](../onemo-next/studio/src/editor/adapter/observer-r3f-bridge.ts) supports map/uv/channel/offset/tiling/rotation updates. | **Good texture-slot coverage** |
| Missing/non-bridged examples | Ambient/AO scalar behavior, specular workflow scalars, anisotropy intensity/rotation, opacity dither/fade/alpha-to-coverage, refraction/IOR/dispersion, attenuation, iridescence scalars, environment projection/reflectivity, depth/cull/fog/lighting/tonemap toggles have inspector paths but no corresponding adapter writes. | **FAIL for full 22-property parity** |

### Lighting — mapper coverage vs inspector surface

| Surface | Evidence | Result |
|---|---|---|
| Inspector breadth | [`light.ts:25-390`](../onemo-next/studio/src/editor/inspector/components/light.ts) exposes type, shape, falloff, bake/static flags, affect flags, full shadow config, cookies, and layer controls. | **Broad UI present** |
| Runtime bridge | [`light-mapper.ts:13-28`](../onemo-next/studio/src/editor/adapter/light-mapper.ts) only creates `type`, `color`, `intensity`, `range`, `castShadows`, `innerConeAngle`, `outerConeAngle`. [`light-mapper.ts:36-70`](../onemo-next/studio/src/editor/adapter/light-mapper.ts) only updates enabled/color/intensity/castShadows/range/spot cones. | **Narrow bridge** |
| Area light support | Area-light shape constants still exist in compat / gizmo code, but the R3F light mapper does not instantiate or reconfigure `RectAreaLight` or equivalent runtime shapes. | **Not end-to-end wired** |
| Shadow property coverage | Resolution, bias, normal offset, shadow distance, shadow intensity, shadow type, VSM settings, cascades are UI-only in the R3F path. | **FAIL** |

### Camera — mapper coverage vs visible viewer

| Surface | Evidence | Result |
|---|---|---|
| Inspector breadth | [`camera.ts:9-151`](../onemo-next/studio/src/editor/inspector/components/camera.ts) exposes clear buffers/colors, grabpasses, projection, frustum culling, FOV, ortho height, clips, priority, rect, layers, tonemapping, gamma. | **Broad UI present** |
| Runtime bridge | [`camera-mapper.ts:18-29`](../onemo-next/studio/src/editor/adapter/camera-mapper.ts) creates only clearColor/clear buffers/projection/fov/orthoHeight/near/far. [`camera-mapper.ts:39-68`](../onemo-next/studio/src/editor/adapter/camera-mapper.ts) only updates enabled, fov, near, far, orthoHeight. | **Narrow bridge** |
| Visible viewer camera | [`EffectViewer.tsx:472-485`](../onemo-next/src/app/(dev)/prototype/core/EffectViewer.tsx) creates a perspective `Canvas` camera directly. The R3F mount does not subscribe to `camera:set` / preset / shader-pass events; it only syncs selection and gizmo state in [`effect-viewer-mount.tsx:50-89`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx). | **Fail for full camera parity** |

### Thumbnail renderers

| Type | Evidence | Result |
|---|---|---|
| Shared renderer | [`thumbnail-renderer.ts:17-250`](../onemo-next/studio/src/common/thumbnail-renderers/thumbnail-renderer.ts) is a real offscreen Three.js renderer. | **PASS** |
| Material thumbnails | [`material-thumbnail-renderer.ts:67-123`](../onemo-next/studio/src/common/thumbnail-renderers/material-thumbnail-renderer.ts) build `MeshPhysicalMaterial` + Three geometry. | **PASS** |
| Model thumbnails | [`model-thumbnail-renderer.ts:116-157`](../onemo-next/studio/src/common/thumbnail-renderers/model-thumbnail-renderer.ts) still fetch `pc.Application`, `_editorPreviewModel`, and PlayCanvas material resources before converting to Three meshes. | **PARTIAL / disagreement with Composer phrasing** |

### Post effects

| Check | Evidence | Result |
|---|---|---|
| Dependency surface | `package.json` contains `@react-three/drei`, `@react-three/fiber`, `three` at lines `80-86`, but no `@react-three/postprocessing`. | **No effect stack dependency** |
| Code search | Search for `postprocessing` across `studio/src` and shared viewer code returns zero matches. | **No active effect chain** |

### Layer system

| Check | Evidence | Result |
|---|---|---|
| Runtime model | [`viewport-layers.ts:22-194`](../onemo-next/studio/src/editor/viewport/viewport-layers.ts) constructs and mutates a PlayCanvas `LayerComposition`. | **Legacy engine-driven** |
| UI model | [`layers.ts`](../onemo-next/studio/src/editor/inspector/settings-panels/layers.ts) and [`layers-render-order.ts`](../onemo-next/studio/src/editor/inspector/settings-panels/layers-render-order.ts) still expose full layer/sub-layer editing. | **Not simplified to basic Three.js layer assignment/order** |

---

## L2 — Code-verifiable DOM / interaction wiring

| Surface | Evidence | Verdict |
|---|---|---|
| 5-panel shell exists | [`layout.ts:185-244`](../onemo-next/studio/src/editor/layout/layout.ts) | **PASS** |
| R3F overlay is mounted into viewport and legacy canvas hidden | [`effect-viewer-mount.tsx:160-173`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx) | **PASS** |
| Selector state flows into visible viewer | [`effect-viewer-mount.tsx:50-83`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx) | **PASS** |
| Visible viewer click selects scene objects back into editor selector | [`EffectViewer.tsx:270-302`](../onemo-next/src/app/(dev)/prototype/core/EffectViewer.tsx), [`effect-viewer-mount.tsx:98-106`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx) | **PASS** |
| Gizmo state flows from toolbar into visible `TransformControls` | [`toolbar-gizmos.ts:39-50`](../onemo-next/studio/src/editor/toolbar/toolbar-gizmos.ts), [`effect-viewer-mount.tsx:62-83`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx), [`EffectViewer.tsx:372-378`](../onemo-next/src/app/(dev)/prototype/core/EffectViewer.tsx) | **PASS** |
| Transform commits write history back into bridge | [`EffectViewer.tsx:311-343`](../onemo-next/src/app/(dev)/prototype/core/EffectViewer.tsx), [`effect-viewer-mount.tsx:110-116`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx) | **PASS** |
| Material drag-drop uses overlay raycast, not legacy canvas | [`effect-viewer-mount.tsx:175-210`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx), [`observer-r3f-bridge.ts:462-499`](../onemo-next/studio/src/editor/adapter/observer-r3f-bridge.ts) | **PASS** |
| Save/load handlers exist in code | [`effect-viewer-mount.tsx:346-390`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx) | **PASS** |
| Camera/render preset wiring reaches visible R3F viewer | No matching subscriptions in `effect-viewer-mount.tsx` for `camera:set`, `camera:shader:pass`, `viewport:focus`, or render-style events. | **FAIL** |

---

## L4 — Scope exclusions

| # | Exclusion | Result | Evidence |
|---|---|---|---|
| 4.1 | Cloud saving removed | **PASS** | Save/load now targets `/api/onemo/scenes` in [`effect-viewer-mount.tsx:336-390`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx). |
| 4.2 | Version control removed | **FAIL** | `src/editor/vc` is gone, but version-control methods are still registered as stubs in [`picker-cloud-disabled.ts:8-36`](../onemo-next/studio/src/editor/pickers/picker-cloud-disabled.ts), menus still carry “version control” logic in [`picker-project.ts:146-201`](../onemo-next/studio/src/editor/pickers/picker-project.ts), and helper calls remain in context menus. |
| 4.3 | Launch page removed | **STUBBED** | [`viewport-launch.ts:19-27`](../onemo-next/studio/src/editor/viewport-controls/viewport-launch.ts) keeps `editor.method('launch')` but only warns and returns `null`. |
| 4.4 | Legacy publishing removed | **STUBBED** | [`picker-publish-new.ts:1-10`](../onemo-next/studio/src/editor/pickers/picker-publish-new.ts) is a no-op stub, but publish concepts remain loaded in `index.ts` and project picker logic still references publish sections. |
| 4.5 | Collaboration removed | **PASS** | Offline flag in [`studio-network-offline.ts:1-5`](../onemo-next/studio/src/editor-api/studio-network-offline.ts); realtime short-circuits in [`realtime/connection.ts:179-190`](../onemo-next/studio/src/editor-api/realtime/connection.ts); relay short-circuits in [`relay-server.ts:78-92`](../onemo-next/studio/src/editor/relay/relay-server.ts); whoisonline is local-only in [`whoisonline.ts:3-45`](../onemo-next/studio/src/editor/whoisonline/whoisonline.ts) and scene presence is disabled in [`whoisonline-scene.ts:1-4`](../onemo-next/studio/src/editor/whoisonline/whoisonline-scene.ts). |
| 4.6 | Source editor hosting removed | **PASS** | I did not find hosted deployment UI in the active runtime path. |
| 4.7 | Community links removed | **FAIL** | Release notes link in [`layout-console.ts:198-202`](../onemo-next/studio/src/editor/layout/layout-console.ts); GitHub quick link in [`picker-cms.ts:648-656`](../onemo-next/studio/src/editor/pickers/project-management/picker-cms.ts). |
| 4.8 | Lightmapper removed | **FAIL** | Lightmapper modules are still imported in `index.ts` (`359-360`), menu still exposes “Bake LightMaps” in [`toolbar-logo.ts:320-325`](../onemo-next/studio/src/editor/toolbar/toolbar-logo.ts), and runtime lightmapper files still exist. |
| 4.9 | Cookie textures removed | **FAIL** | Cookie UI remains in [`light.ts:367-390`](../onemo-next/studio/src/editor/inspector/components/light.ts). |
| 4.10 | Clustered lighting removed | **FAIL** | Clustered lighting UI remains in [`rendering.ts:158-195`](../onemo-next/studio/src/editor/inspector/settings-panels/rendering.ts). |
| 4.11 | Layer composition editor removed | **FAIL** | Full `LayerComposition` runtime + editor UI remain in [`viewport-layers.ts:22-194`](../onemo-next/studio/src/editor/viewport/viewport-layers.ts), [`layers.ts`](../onemo-next/studio/src/editor/inspector/settings-panels/layers.ts), and [`layers-render-order.ts`](../onemo-next/studio/src/editor/inspector/settings-panels/layers-render-order.ts). |
| 4.12 | Integrated code editor removed | **PASS** | [`toolbar-code-editor.ts:6-27`](../onemo-next/studio/src/editor/toolbar/toolbar-code-editor.ts) opens external editor URLs only. |
| 4.13 | How Do I widget removed | **PASS** | `howdoi` search only finds type declarations and an empty `howdoi.json`; no active widget code found. |
| 4.14 | Deprecated components removed | **FAIL** | “Model (legacy)” remains in [`entities-menu.ts:284-296`](../onemo-next/studio/src/editor/entities/entities-menu.ts); Add Component menu still appends `(legacy)` to Model/Animation in [`entity.ts:442-446`](../onemo-next/studio/src/editor/inspector/entity.ts). |
| 4.15 | Lightmap-related render properties removed | **FAIL** | Render/model inspectors still expose Cast Lightmap Shadows / Lightmapped / Lightmap Size Multiplier in [`render.ts:55-80`](../onemo-next/studio/src/editor/inspector/components/render.ts) and model equivalents; lightmapper runtime still exists. |
| 4.16 | Post effects deferred / excluded | **DEFERRED** | No active postprocessing stack found; status should be treated as deferred rather than “implemented”. |

---

## Disagreements vs Composer report (`audit-findings-KAI-3839.md`)

| Topic | Composer report | Codex finding |
|---|---|---|
| Viewport WIRED parity | Row-level citations marked several viewport controls as WIRED based on existing code paths. | That is too generous. Focus, wireframe/debug render modes, camera presets, ortho switching, and grid still route through the hidden engine canvas or engine camera stack, while the visible surface is the R3F overlay. Presence of legacy code is not sufficient evidence of visible parity. |
| Thumbnail renderer claim | Composer phrased thumbnails as using Three.js, not engine API. | Material/cubemap/font thumbnails fit that statement. Model thumbnails do not: they still read `pc.Application` preview models/resources before converting to Three meshes. |
| Lint failure description | Composer described lint as “many issues.” | Current direct run is materially worse than that shorthand: `214100 problems (214099 errors, 1 warning)`. |
| L4 evidence freshness | Composer L4 table cites files like `src/editor/vc/*` and `toolbar-lightmapper.ts`. | Those specific files are now gone, so the old evidence is stale. The exclusion gate still fails, but for updated reasons: stubs, menu logic, imported lightmapper runtime, and remaining legacy surfaces. |

---

## Recommended next actions

1. **Split the viewport stack into “visible R3F” and “hidden legacy engine” and decide which one is truth.** Right now several controls are still wired only to the hidden stack.
2. **Narrow the inspector to the actually bridged surface or finish the bridge.** Materials, lights, and cameras currently present much larger capability surfaces than the adapter honors.
3. **Treat lightmapper, layer composition, cookies, clustered lighting, and deprecated components as unresolved exclusions.** They are still live enough in code to confuse parity claims and manual QA.
4. **Update the Composer findings file or supersede it with this report before any final VALIDATE sign-off.** The current file mixes stale evidence with later remediation notes.
5. **Run the real browser L2 pass only after the viewport truth is clarified.** Otherwise browser QA will mix visible overlay behavior with dead/hidden legacy controls.

---

## Commands run

```bash
cd onemo-next/studio
npm run type:check
npm run lint
npm test
npm run build
```

