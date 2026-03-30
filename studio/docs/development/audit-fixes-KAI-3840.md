# KAI-3840 — Audit fix report

**Date:** 2026-03-30  
**Branch:** `staging`  
**Scope:** `onemo-next/studio` plus shared viewer file `src/app/(dev)/prototype/core/EffectViewer.tsx`

---

## What changed

### L3 — Branding and code-health cleanup

1. Removed the PlayCanvas notification icon fallback in [`notify.ts`](../onemo-next/studio/src/editor/notify/notify.ts).
2. Removed the release-notes/version button and its divider from [`layout-console.ts`](../onemo-next/studio/src/editor/layout/layout-console.ts).
3. Removed the GitHub quick link from [`picker-cms.ts`](../onemo-next/studio/src/editor/pickers/project-management/picker-cms.ts).
4. Removed the `playcanvas-theme` import from [`_editor-main.scss`](../onemo-next/studio/sass/editor/_editor-main.scss).
5. Removed the `localhost:51000` whitelist from [`sourcefiles-attributes.ts`](../onemo-next/studio/src/editor/sourcefiles/sourcefiles-attributes.ts).

### L4 — Exclusion cleanup

6. Simplified version-control handling to defensive stubs in [`picker-cloud-disabled.ts`](../onemo-next/studio/src/editor/pickers/picker-cloud-disabled.ts) and removed project-picker-specific version-control close/hide logic from [`picker-project.ts`](../onemo-next/studio/src/editor/pickers/picker-project.ts).
7. Removed lightmapper imports from [`index.ts`](../onemo-next/studio/src/editor/index.ts), removed the “Bake LightMaps” menu item from [`toolbar-logo.ts`](../onemo-next/studio/src/editor/toolbar/toolbar-logo.ts), and deleted:
   - [`viewport-lightmapper.ts`](../onemo-next/studio/src/editor/viewport/viewport-lightmapper.ts)
   - [`viewport-lightmapper-auto.ts`](../onemo-next/studio/src/editor/viewport/viewport-lightmapper-auto.ts)
   - [`lightmapping.ts`](../onemo-next/studio/src/editor/inspector/settings-panels/lightmapping.ts)
8. Removed cookie texture controls from [`light.ts`](../onemo-next/studio/src/editor/inspector/components/light.ts).
9. Removed clustered-lighting settings from [`rendering.ts`](../onemo-next/studio/src/editor/inspector/settings-panels/rendering.ts).
10. Replaced the layer composition editor/runtime path with minimal stubs in:
   - [`viewport-layers.ts`](../onemo-next/studio/src/editor/viewport/viewport-layers.ts)
   - [`layers.ts`](../onemo-next/studio/src/editor/inspector/settings-panels/layers.ts)
   - [`layers-render-order.ts`](../onemo-next/studio/src/editor/inspector/settings-panels/layers-render-order.ts)
11. Removed the `Model (legacy)` create entry and removed `(legacy)` labels from add-component menus in:
   - [`entities-menu.ts`](../onemo-next/studio/src/editor/entities/entities-menu.ts)
   - [`entity.ts`](../onemo-next/studio/src/editor/inspector/entity.ts)
   - [`entities-components-menu.ts`](../onemo-next/studio/src/editor/entities/entities-components-menu.ts)
   - [`animation.ts`](../onemo-next/studio/src/editor/inspector/components/animation.ts)
12. Removed lightmap-specific render/model inspector fields from:
   - [`render.ts`](../onemo-next/studio/src/editor/inspector/components/render.ts)
   - [`model.ts`](../onemo-next/studio/src/editor/inspector/components/model.ts)
13. Removed the lightmapper auto-bake editor setting from [`editor.ts`](../onemo-next/studio/src/editor/inspector/settings-panels/editor.ts).

### L1 — Adapter expansion

14. Expanded [`material-mapper.ts`](../onemo-next/studio/src/editor/adapter/material-mapper.ts) to cover the broader inspector surface:
   - Added direct mappings for AO intensity, specular color/intensity, anisotropy, alpha-to-coverage, clearcoat normal scale, transmission/refraction, IOR bridging, thickness, attenuation color/distance, iridescence, reflectivity/env intensity, depth state, cull mode, fog, and tone mapping.
   - Added explicit `// No Three.js equivalent...` handling for fields that still have no sane MeshPhysicalMaterial equivalent in the current bridge, including the remaining refraction/sheen/thickness channel controls and dynamic-refraction toggle.
15. Expanded [`light-mapper.ts`](../onemo-next/studio/src/editor/adapter/light-mapper.ts):
   - Added mappings for falloff mode, shadow resolution, bias, normal offset bias, and shadow distance.
   - Added explicit no-equivalent skips for fields that require engine-only behavior or light-class recreation in the current bridge.
16. Expanded [`camera-mapper.ts`](../onemo-next/studio/src/editor/adapter/camera-mapper.ts):
   - Added handling/storage for clear flags/color, frustum-culling metadata, priority, rect, layers, tonemapping, gamma, and grabpass flags.
   - Kept projection switching as an explicit no-direct-equivalent case for in-place mutation.
17. Extended path normalization in [`observer-r3f-bridge.ts`](../onemo-next/studio/src/editor/adapter/observer-r3f-bridge.ts) so more nested material/light/camera updates reach the expanded handlers.
18. Trimmed lightmap-only defaults from [`render-mapper.ts`](../onemo-next/studio/src/editor/adapter/render-mapper.ts).

### L1 — Visible viewport rewiring

19. Rewired the visible R3F viewport controls through [`effect-viewer-mount.tsx`](../onemo-next/studio/src/editor/viewport/effect-viewer-mount.tsx) and [`EffectViewer.tsx`](../onemo-next/src/app/(dev)/prototype/core/EffectViewer.tsx):
   - Added R3F-facing render-pass state.
   - Added visible-viewer wireframe/debug material switching.
   - Added focus and camera-preset commands for the visible overlay camera.
20. Replaced the engine-only viewport render controls in [`viewport-render.ts`](../onemo-next/studio/src/editor/viewport-controls/viewport-render.ts) with R3F event emitters.
21. Replaced the engine-only focus implementation in [`viewport-focus.ts`](../onemo-next/studio/src/editor/viewport/viewport-focus.ts) with an R3F focus event.
22. Rewired numeric camera shortcuts in [`camera-shortcuts.ts`](../onemo-next/studio/src/editor/viewport/camera/camera-shortcuts.ts) to the visible viewer.
23. Rewired built-in camera dropdown options in [`viewport-cameras.ts`](../onemo-next/studio/src/editor/viewport-controls/viewport-cameras.ts) so editor preset cameras also target the visible viewer.

### L1 — Model thumbnails

24. Refactored [`model-thumbnail-renderer.ts`](../onemo-next/studio/src/common/thumbnail-renderers/model-thumbnail-renderer.ts) off `pc.Application.getApplication()` and `_editorPreviewModel`.
25. Model thumbnails now load GLTF/GLB assets through `GLTFLoader`, clone Three meshes, apply mapped material overrides, render them through the shared Three thumbnail renderer, and dispose their preview clones after rendering.

---

## Deliberate no-equivalent skips

The expanded mappers now call out non-mappable PlayCanvas-era controls in code instead of silently ignoring them. The main skipped groups are:

- Material fields that need renderer-specific or shader-authoring behavior beyond MeshPhysicalMaterial, such as sphere-map projection, cube-map projection boxes, opacity dithering modes, and section-specific vertex-color semantics.
- Light fields that require engine-only behavior or light recreation in the current runtime, such as cookies, bake/static flags, cascades, per-light shadow type, and runtime light-class switching.
- Camera projection swapping in place. The mapper documents this as a non-mutating case; the visible viewer presets were rewired separately through the R3F control path.

---

## Verification

```bash
cd onemo-next/studio
npm run build
npm test
```

Results:

- `npm run build` — PASS
- `npm test` — PASS (`157 passing`)

---

## Files touched

```text
src/app/(dev)/prototype/core/EffectViewer.tsx
studio/sass/editor/_editor-main.scss
studio/src/common/thumbnail-renderers/model-thumbnail-renderer.ts
studio/src/editor/adapter/camera-mapper.ts
studio/src/editor/adapter/light-mapper.ts
studio/src/editor/adapter/material-mapper.ts
studio/src/editor/adapter/observer-r3f-bridge.ts
studio/src/editor/adapter/render-mapper.ts
studio/src/editor/entities/entities-components-menu.ts
studio/src/editor/entities/entities-menu.ts
studio/src/editor/index.ts
studio/src/editor/inspector/components/light.ts
studio/src/editor/inspector/components/animation.ts
studio/src/editor/inspector/components/model.ts
studio/src/editor/inspector/components/render.ts
studio/src/editor/inspector/entity.ts
studio/src/editor/inspector/settings-panel.ts
studio/src/editor/inspector/settings-panels/editor.ts
studio/src/editor/inspector/settings-panels/layers-render-order.ts
studio/src/editor/inspector/settings-panels/layers.ts
studio/src/editor/inspector/settings-panels/rendering.ts
studio/src/editor/layout/layout-console.ts
studio/src/editor/notify/notify.ts
studio/src/editor/pickers/picker-cloud-disabled.ts
studio/src/editor/pickers/picker-project.ts
studio/src/editor/pickers/project-management/picker-cms.ts
studio/src/editor/sourcefiles/sourcefiles-attributes.ts
studio/src/editor/toolbar/toolbar-logo.ts
studio/src/editor/viewport-controls/viewport-cameras.ts
studio/src/editor/viewport-controls/viewport-render.ts
studio/src/editor/viewport/camera/camera-shortcuts.ts
studio/src/editor/viewport/effect-viewer-mount.tsx
studio/src/editor/viewport/viewport-focus.ts
studio/src/editor/viewport/viewport-layers.ts
```
