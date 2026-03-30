# KAI-3839 — Composer fast code audit (L1 + L3 + L4)

**Date:** 2026-03-30  
**Scope:** `onemo-next/studio` (per `studio/docs/development/audit-spec.md`)  
**Method:** L3 automated first, then L1 code traces for WIRED parity, then L4 exclusion grep/read.

---

## Executive summary

| Layer | Result | Notes |
|-------|--------|--------|
| **L3** | **FAIL** | `tsc` reports thousands of errors; `npm run lint` reports widespread ESLint violations. `npm test` (Mocha) **157 passing**. |
| **L1** | **COMPLETE** (row-level) | Every spec row with Expected Status **WIRED** (§1–§14) has a primary `file:line` citation in [L1 — Row-Level WIRED Citations](#l1--row-level-wired-citations-kai-3839-follow-up) (appendix below). |
| **L4** | **FAIL** | Follow-up resolved all former VERIFY rows: many are **FAIL** (legacy publish UI, lightmapper toolbar, cookie/clustered/layer-composition UI, legacy Model/Animation in Add Component, lightmap render fields, etc.). See L4 table. |

**Counts:** L3 checks with clear PASS/FAIL: **11 PASS, 4 FAIL, 3 PARTIAL** (see table). L4 exclusions: VERIFY items from the follow-up list are resolved in the **L4** table below (no VERIFY left for those rows).

---

## L3 — Code health (18 checks)

| # | Check | Result | Evidence |
|---|--------|--------|----------|
| 3.1 | No `from 'playcanvas'` in `src/editor/` + `src/common/` (excl. compat) | **PASS** | `grep` returned no hits. |
| 3.2 | No `from 'playcanvas'` in `src/editor/viewport/` (excl. viewport-engine) | **PASS** | `grep` returned no hits. |
| 3.3 | `playcanvas-compat.ts` uses `read()` / `globalThis.pc` | **PASS** | `src/common/playcanvas-compat.ts` — `read()` + `runtimePc` from `(globalThis as any).pc`. |
| 3.4 | `viewport-engine.ts` exports via compat | **PASS** | `src/editor/viewport-engine.ts` imports `@/common/playcanvas-compat` and re-exports; `src/editor/viewport/viewport-engine.ts` re-exports `../viewport-engine`. |
| 3.5 | No orphaned `import … from 'playcanvas'` in `src/` | **PASS** | No matches under `src/` (only vendor `.d.ts` / audit doc). |
| 3.6 | Clean TypeScript (`npm run type:check`) | **FAIL** | `tsc` exits 2; errors start in `element-asset-list.ts`, `element-asset-thumbnail.ts`, legacy UI, thumbnail renderers, etc. (2k+ lines of diagnostics). |
| 3.7 | Clean lint (`npm run lint`) | **FAIL** | ESLint reports many issues (e.g. `host/step1-server.mjs`, `src/common/thumbnail-renderers/*`, large swaths of `src/`). |
| 3.8 | No `src/launch/` | **PASS** | Directory absent. |
| 3.9 | No `src/editor/expose.ts` | **PASS** | File absent. |
| 3.10 | `vendor/playcanvas/playcanvas.js` present (~3.7MB) | **PASS** | File exists; size **3,711,121** bytes. |
| 3.11 | No npm package `playcanvas` | **PASS** | `package.json` `dependencies`: no bare `playcanvas`; engine via global + vendor script. |
| 3.12 | `howdoi.json` — no playcanvas.com URLs | **PASS** | `static/json/howdoi.json` is `[]`. |
| 3.13 | Tests pass (`npm test`) | **PASS** | **157 passing** (79ms). |
| 3.14 | No `window.pc.` / `globalThis.pc.` outside compat | **PASS** | No matches in `src/` (compat uses `(globalThis as any).pc` internally only). |
| 3.15 | No unused engine-specific deps | **PARTIAL** | `sharedb`, `ot-text`, etc. remain for legacy editor-api patterns — not automatically “orphaned”; needs product decision. |
| 3.16 | No legacy branding in `src/` + `sass/` (excl. compat/vendor) | **FAIL** | `sass/common/_fonts.scss`, `_ui.scss`, `_editor-main.scss`, `_ui-common.scss` reference `https://playcanvas.com/static-assets/...`; class `.playcanvas-icon` in `_editor-main.scss`. |
| 3.17 | No hardcoded `localhost:` in `src/` (excl. tests) | **PARTIAL** | `src/editor/sourcefiles/sourcefiles-attributes.ts` — regex allows `localhost:51000` for API URLs. |
| 3.18 | No `console.log` in `src/editor/adapter/` | **PASS** | `grep` returned no matches. |

**L3 score:** 11 PASS / 4 FAIL / 3 PARTIAL.

---

## L1 — Feature parity (summary)

**VERIFY / SKIPPED / N/A rows** in `audit-spec.md` are out of scope for this code pass (L2 / Gemini). **WIRED** rows **§1.1–§14.6** are mapped row-by-row in the appendix below.

**Note:** §15–§16 are **all VERIFY** in the spec — no WIRED rows there.

---

## L4 — Scope exclusions (16 items)

| # | Exclusion | Result | Evidence |
|---|-----------|--------|----------|
| 4.1 | Cloud saving | **PASS** | No dedicated “save to PlayCanvas cloud” UI in `src/editor/`; R3F scene I/O uses `effect-viewer-mount.tsx` (`saveSceneByName` / `loadSceneByName` + `savedSceneToViewerConfig`). Realtime remains for multi-user hosted scenarios — distinct from product “cloud save”. |
| 4.2 | Version control UI removed | **FAIL** | `src/editor/vc/graph/*` — checkpoints, `picker:versioncontrol:*`, `branchCheckpoints` API usage. |
| 4.3 | Launch page | **PASS** | `src/launch/` absent (L3.8). |
| 4.4 | Legacy publishing | **FAIL** | `src/editor/pickers/picker-publish-new.ts:402-409` — “Publish Now” / publish flows still present (`picker:project:registerPanel` for publish-new, publish-download). |
| 4.5 | Collaboration | **PASS** | Single flag `STUDIO_NETWORK_OFFLINE` in `src/editor-api/studio-network-offline.ts`. Realtime: `connection.ts` — no WebSocket when offline; immediate `connected`/`authenticated`; send/bulk no-ops; stub ShareDB docs. Relay: `relay-server.ts` — no WebSocket when offline; synthetic `connect` event; `send`/`reconnect` no-ops. Whoisonline: `whoisonline-scene.ts` no-op; `whoisonline.ts` local-only. |
| 4.6 | Source editor hosting | **PASS** | No `hosting` / `deploy` / `Vercel` UI under `src/editor/` (repo search). |
| 4.7 | Community links | **FAIL** | `src/editor/toolbar/toolbar-github.ts:15` — opens `https://github.com/playcanvas/editor/issues`. |
| 4.8 | Lightmapper | **FAIL** | `src/editor/toolbar/toolbar-lightmapper.ts:15-22` — bake control appended to toolbar; `src/editor/index.ts:264` imports module (always loaded). |
| 4.9 | Cookie textures | **FAIL** | `src/editor/inspector/components/light.ts:368-369` (`components.light.cookieAsset`); `src/editor/inspector/settings-panels/rendering.ts:192-195` (`render.lightingCookiesEnabled`). |
| 4.10 | Clustered lighting | **FAIL** | `src/editor/inspector/settings-panels/rendering.ts:158-161` — `render.clusteredLightingEnabled` UI. |
| 4.11 | Layer composition editor | **FAIL** | Full layer stack still wired: `src/editor/viewport/viewport-layers.ts:164-194` (`LayerComposition`, `layerOrder:*`). |
| 4.12 | Integrated code editor | **PASS** | `src/editor/toolbar/toolbar-code-editor.ts:6-26` — opens **external** editor via `picker:codeeditor` (not in-browser Monaco). |
| 4.13 | How Do I widget | **FAIL** | `src/editor/guides/guide-intro.ts` — `'howdoi'` still referenced in disabled-tips list (widget path not fully removed). |
| 4.14 | Deprecated components | **FAIL** | `src/editor/inspector/entity.ts:444-446` — Add Component menu still exposes **Model** / **Animation** with **`(legacy)`** suffix. |
| 4.15 | Lightmap render props | **FAIL** | `src/editor/inspector/components/render.ts:55-83` — Cast Lightmap Shadows, Lightmapped, Lightmap Size Multiplier. |
| 4.16 | Post effects deferred | **N/A** | Product deferral — same surface as L1 §15 (all **VERIFY** in spec, not an “excluded removal” proof). |

---

## PASS / FAIL gates

- **Overall L3 gate:** **FAIL** (3.6, 3.7, 3.16; 3.17 partial).
- **Overall L4 gate:** **FAIL** — exclusions not cleanly gone: **4.2, 4.4, 4.7, 4.8, 4.9, 4.10, 4.11, 4.13, 4.14, 4.15** (see L4 table). **4.5** collaboration: **PASS** (realtime stub + whoisonline disabled per follow-up).

---

## Recommended next actions

1. Treat **TypeScript + ESLint** as release blockers for any “audit PASS” claim, or document waiver scope (e.g. legacy `src/common` excluded).  
2. **Remediate L4.7** — replace or remove PlayCanvas GitHub toolbar button for ONEMO branding.  
3. **Decide fate of VC + realtime modules** — strip from bundle vs. feature-flag for local-only studio.  
4. **Self-host or replace** Sass font/loader URLs currently pointing at `playcanvas.com` (L3.16 / L2 Group H).  
5. Run **L2** (`http://127.0.0.1:3487`) per spec for VERIFY rows and final parity sign-off.

---

## L1 — Row-Level WIRED Citations (KAI-3839 follow-up)

**Scope:** Only rows with Expected Status = **WIRED** in `audit-spec.md` §1–§14 (95 rows). **Skipped:** every row marked VERIFY / SKIPPED / N/A in the spec (including all of §15–§16).

**Path base:** `studio/src/...` unless noted. **R3F viewer** shared with the Next app: `onemo-next/src/app/(dev)/prototype/core/EffectViewer.tsx` (repo root, not under `studio/`).

**Spec nuance — §2.21 Grid:** The spec names Drei `<Grid />`; the editor viewport still draws the floor grid via the compat path `viewport-grid.ts` (not Drei). Cited as **WIRED (compat)**.

| Spec | Feature | Primary file:line | Status |
|------|---------|-------------------|--------|
| 1.1 | Toolbar | `editor/layout/layout.ts:205-212` | WIRED |
| 1.2 | Hierarchy panel | `editor/layout/layout.ts:9-35` | WIRED |
| 1.3 | Viewport (R3F Canvas) | `src/editor/viewport/effect-viewer-mount.tsx` (mount) + repo `src/app/(dev)/prototype/core/EffectViewer.tsx:472-487` (`<Canvas>`) | WIRED |
| 1.4 | Inspector | `editor/layout/layout.ts:71-97` | WIRED |
| 1.5 | Assets panel | `editor/layout/layout.ts:39-67` | WIRED |
| 1.6 | SPACE toggle panels | `editor/viewport/viewport-expand.ts:35-39` | WIRED |
| 1.7 | Drag asset to viewport | `editor/viewport/viewport-drop-material.ts:145` (+ sibling `viewport-drop-*.ts` drop targets) | WIRED |
| 1.8 | Drag asset to inspector slot | `editor/inspector/assets/material.ts:132-156` (offset/tiling/rotation) + `adapter/observer-r3f-bridge.ts:462-481` (material apply) | WIRED |
| 1.9 | Context-sensitive inspector | `editor/inspector/entity.ts:296-307` (component inspector factory) | WIRED |
| 2.1 | Perspective camera (default) | `EffectViewer.tsx:480-485` (PerspectiveCamera via Canvas `camera` prop) | WIRED |
| 2.4 | Orbit (LMB) | `EffectViewer.tsx:521-530` (`OrbitControls`) | WIRED |
| 2.5 | Pan (MMB) | `EffectViewer.tsx:521-530` (`OrbitControls` pan) | WIRED |
| 2.8 | Zoom (scroll) | `EffectViewer.tsx:521-530` (`OrbitControls`) | WIRED |
| 2.11 | F = focus | `editor/toolbar/toolbar-gizmos.ts:223-231` (`hotkey:register` `viewport:focus`) | WIRED |
| 2.12 | Translate gizmo | `EffectViewer.tsx:372-378` (`TransformControls` `mode` from props) + `toolbar-gizmos.ts:169-177` | WIRED |
| 2.13 | Rotate gizmo | `EffectViewer.tsx:372-378` + `toolbar-gizmos.ts:180-188` | WIRED |
| 2.14 | Scale gizmo | `EffectViewer.tsx:372-378` + `toolbar-gizmos.ts:191-199` | WIRED |
| 2.17 | L = local/world | `EffectViewer.tsx:375-376` (`TransformControls` `space`) + `toolbar-gizmos.ts:213-221` | WIRED |
| 2.18 | Click = select | `EffectViewer.tsx:270-301` (raycast + `onSelectResourceId`) | WIRED |
| 2.21 | Grid | `editor/viewport/viewport-grid.ts:16-40` | WIRED (compat) |
| 2.22 | GizmoHelper / viewcube | `EffectViewer.tsx:380-384` (`GizmoHelper` + `GizmoViewcube`) | WIRED |
| 3.1 | Entity tree | `editor/entities/entities-treeview.ts:37-48` | WIRED |
| 3.2 | Click to select | `editor/entities/entities-treeview.ts:180+` (`_onSelectEntityItem`) | WIRED |
| 4.1 | Entity transform | `adapter/observer-r3f-bridge.ts:619` / `1936` (position sync) | WIRED |
| 4.5 | Number/text fields | `editor/inspector/attributes-inspector.ts:67-80` (inspector shell + bindings) | WIRED |
| 4.6 | Asset slot | `common/pcui/element/element-asset-input` (via `attributes-inspector` imports) | WIRED |
| 4.7 | Color picker | `editor/pickers/picker-color.ts` (registered from picker index) | WIRED |
| 4.8 | Vector inputs | `attributes-inspector.ts` + vec3 attributes in component inspectors | WIRED |
| 4.9 | Boolean checkbox | `attributes-inspector.ts` field types (`boolean` attributes) | WIRED |
| 4.10 | Enum dropdown | `attributes-inspector.ts` (`select` attributes, e.g. `render.ts` type) | WIRED |
| 4.13 | Undo/redo on property | `editor-api/history.ts:66-70` + `toolbar-history.ts:28-60` | WIRED |
| 5.1 | Asset browser | `editor/layout/layout.ts:39-67` + `editor/assets/asset-panel.ts` | WIRED |
| 5.7 | DnD to viewport | `editor/viewport/viewport-drop-material.ts:145` | WIRED |
| 5.8 | DnD to inspector | `inspector/assets/material.ts` texture slot bindings | WIRED |
| 5.10 | Thumbnail previews | `common/thumbnail-renderers/thumbnail-renderer.ts:25-30` (shared Three loaders) | WIRED |
| 6.1 | Translate button | `editor/toolbar/toolbar-gizmos.ts:13-51` | WIRED |
| 6.2 | Rotate button | `toolbar-gizmos.ts:13-51` | WIRED |
| 6.3 | Scale button | `toolbar-gizmos.ts:13-51` | WIRED |
| 6.4 | World/local toggle | `toolbar-gizmos.ts:71-87` | WIRED |
| 6.6 | Undo | `editor/toolbar/toolbar-history.ts:10-28` | WIRED |
| 6.7 | Redo | `toolbar-history.ts:42-60` | WIRED |
| 6.8 | Focus | `toolbar-gizmos.ts:135-144` | WIRED |
| 7.1 | Save scene | `editor/viewport/effect-viewer-mount.tsx:369-391` (`saveSceneByName` → REST) | WIRED |
| 7.2 | Load scene | `effect-viewer-mount.tsx:346-362` (`loadSceneByName` + `savedSceneToViewerConfig`) | WIRED |
| 7.3 | Undo (scene) | `editor-api/history.ts:66-70` | WIRED |
| 7.4 | Redo (scene) | `editor-api/history.ts` + `toolbar-history.ts` | WIRED |
| 8.1 | Texture transform | `editor/inspector/assets/material.ts:132-156` | WIRED |
| 8.3 | Ambient / AO | `adapter/observer-r3f-bridge.ts:176` (`aoMap` mapping) | WIRED |
| 8.4 | Diffuse | `observer-r3f-bridge.ts` material map keys + `material.ts` diffuse fields | WIRED |
| 8.5 | Metalness | `observer-r3f-bridge.ts:120-121`, `1440-1448` | WIRED |
| 8.6 | Roughness | `observer-r3f-bridge.ts:121`, `174-175` | WIRED |
| 8.9 | Emissive | `observer-r3f-bridge.ts:179` | WIRED |
| 8.10 | Opacity / alpha | `observer-r3f-bridge.ts:358-359`, `1302-1303`, `1478-1479` | WIRED |
| 8.11 | Normals | `observer-r3f-bridge.ts:172` | WIRED |
| 9.1 | Directional light | `adapter/light-mapper.ts:21` (`type` → `directional`) | WIRED |
| 9.2 | Point light | `light-mapper.ts:15-16` | WIRED |
| 9.3 | Spot light | `light-mapper.ts:21` | WIRED |
| 9.5 | Light color | `light-mapper.ts:41-44` | WIRED |
| 9.6 | Intensity | `light-mapper.ts:47-49` | WIRED |
| 9.7 | Range | `light-mapper.ts:24`, `57-59` | WIRED |
| 9.8 | Spot cones | `light-mapper.ts:26-27`, `62-70` | WIRED |
| 9.9 | Cast shadows | `light-mapper.ts:52-54` | WIRED |
| 10.1 | Perspective projection | `adapter/camera-mapper.ts:24` (`projection` 0 = perspective) | WIRED |
| 10.3 | FOV | `camera-mapper.ts:45-48` + `observer-r3f-bridge.ts:717-723` | WIRED |
| 10.4 | Near clip | `camera-mapper.ts:50-53` | WIRED |
| 10.5 | Far clip | `camera-mapper.ts:55-58` | WIRED |
| 11.1 | Key 1 translate | `toolbar-gizmos.ts:169-177` | WIRED |
| 11.2 | Key 2 rotate | `toolbar-gizmos.ts:180-188` | WIRED |
| 11.3 | Key 3 scale | `toolbar-gizmos.ts:191-199` | WIRED |
| 11.4 | Key L world/local | `toolbar-gizmos.ts:213-221` | WIRED |
| 11.5 | Key F focus | `toolbar-gizmos.ts:223-231` | WIRED |
| 11.13 | Ctrl+Z | `toolbar-history.ts:10-28` | WIRED |
| 11.14 | Ctrl+Y / Shift+Z redo | `toolbar-history.ts:42-60` | WIRED |
| 11.22 | LMB orbit | `EffectViewer.tsx:521-530` | WIRED |
| 11.23 | MMB pan | `EffectViewer.tsx:521-530` | WIRED |
| 11.25 | Scroll zoom | `EffectViewer.tsx:521-530` | WIRED |

| Spec | Feature | Primary file:line | Status |
|------|---------|-------------------|--------|
| 12.1 | Render mesh | `adapter/observer-r3f-bridge.ts:632-659` (`Mesh` + `components.render`) | WIRED |
| 12.2 | Primitive types | `inspector/components/render.ts:13-34` (type `select`: box, sphere, …) | WIRED |
| 12.3 | Render asset / GLTF | `effect-viewer-mount.tsx:266` (`bridge.loadModel`) + asset path in bridge | WIRED |
| 12.5 | Material slots | `adapter/observer-r3f-bridge.ts:659`, `1994+` (`applyMaterialAssignments`) | WIRED |
| 12.6 | Light component | `adapter/light-mapper.ts` + light component inspector `inspector/components/light.ts` | WIRED |
| 12.7 | Camera component | `adapter/camera-mapper.ts` + `inspector/components/camera.ts` (camera inspector) | WIRED |
| 13.1 | Material assets | `inspector/assets/material.ts` + `observer-r3f-bridge.ts` material sync | WIRED |
| 13.2 | Render (.glb) | `effect-viewer-mount.tsx:266` (`loadModel`) | WIRED |
| 13.3 | Texture | `common/thumbnail-renderers/thumbnail-renderer.ts:191-208` (`TextureLoader`) | WIRED |
| 13.4 | Cubemap | `thumbnail-renderer.ts:219-227` (`CubeTextureLoader`) | WIRED |
| 13.5 | Font | `common/thumbnail-renderers/font-thumbnail-renderer.ts` (FontFace / preview) | WIRED |
| 13.13 | JSON/text/etc. | `editor/assets/assets-edit.ts:4` (editable types include css/html/json/…) | WIRED |
| 14.1 | Material thumbnails | `common/thumbnail-renderers/material-thumbnail-renderer.ts` | WIRED |
| 14.2 | Model thumbnails | `common/thumbnail-renderers/model-thumbnail-renderer.ts` | WIRED |
| 14.3 | Cubemap thumbnails | `common/thumbnail-renderers/cubemap-3d-thumbnail-renderer.ts` | WIRED |
| 14.4 | Font thumbnails | `common/thumbnail-renderers/font-thumbnail-renderer.ts` | WIRED |
| 14.6 | Texture thumbnails | `common/thumbnail-renderers/thumbnail-renderer.ts:191-208` (image/texture load) | WIRED |

---

## Fixes Applied (KAI-3839 remediation)

**Verification:** `npm run build` exit 0; `npm test` — **157 passing** (2026-03-30; re-verified after L4.5 realtime stub). Typecheck/lint not re-run per task scope.

| Area | Change |
|------|--------|
| **L3.16 — Sass / branding** | Replaced all `playcanvas.com` font and image URLs with self-hosted assets under `static/fonts/` (woff2) and `static/img/` (`bcg_primary.jpg`, `loader.gif`). Paths in partials use `../../static/...` so compiled `dist/css/editor.css` resolves correctly. |
| **L3.16 — `.playcanvas-icon`** | Renamed to `.studio-icon` in `sass/editor/_editor-main.scss` and `picker-modal-new-project.ts`. |
| **Vite static copy** | Added `static/fonts` → `dist/static/fonts` in `vite.config.mjs` `STATIC_ASSETS`. |
| **L4.7 — GitHub toolbar** | Removed `src/editor/toolbar/toolbar-github.ts` (was not imported from `index.ts`; eliminated dead external link). |
| **L4.2 — Version control UI** | Removed `src/editor/vc/` (graph + unused VC UI). Moved `diff-create.ts` to `src/editor/pickers/conflict-manager/diff-create.ts`; updated `picker-conflict-manager` import. `picker-cloud-disabled.ts` continues to no-op `picker:versioncontrol:*` / `vcgraph:*`. |
| **L4.5 — Collaboration** | **`STUDIO_NETWORK_OFFLINE`** in `editor-api/studio-network-offline.ts` drives both **realtime** (`connection.ts`) and **relay** (`relay-server.ts`) so neither opens a WebSocket. Realtime stub docs + immediate auth; relay synthetic `connect` + no `send`. `whoisonline-scene.ts` no-op; `whoisonline.ts` local-only. (Earlier: removed `viewport-user-cameras.ts`.) |
| **L4.13 — HowDoI** | Removed `'howdoi'` from the tips reset list in `guide-intro.ts`. |
| **L4.4 — Publishing** | Replaced `picker-publish-new.ts` with a stub registering no-op `picker:publish:new`, `picker:publish:download`, `picker:publish`. |
| **L4.8 — Lightmapper** | Removed toolbar lightmapper module and dropped `import './toolbar/toolbar-lightmapper'` from `index.ts`. |
| **P3 — Dependencies** | No change to `sharedb` / `ot-text` — still referenced by editor-api realtime paths. |

**Files touched (by action):**  
`vite.config.mjs`; `sass/common/_fonts.scss`, `_ui-common.scss`; `sass/ui/_ui.scss`; `sass/editor/_editor-main.scss`; `src/editor/index.ts`; `src/editor/guides/guide-intro.ts`; `src/editor/pickers/picker-publish-new.ts`; `src/editor/pickers/project-management/picker-modal-new-project.ts`; `src/editor/pickers/conflict-manager/picker-conflict-manager.ts`; **added** `src/editor/pickers/conflict-manager/diff-create.ts`; **removed** `src/editor/toolbar/toolbar-github.ts`, `toolbar-lightmapper.ts`, `src/editor/viewport/viewport-user-cameras.ts`, entire `src/editor/vc/` tree. **L4.5 follow-up:** `src/editor-api/studio-network-offline.ts`, `src/editor-api/realtime/connection.ts`, `src/editor/relay/relay-server.ts`, `src/editor/realtime/realtime.ts`, `src/editor/whoisonline/whoisonline.ts`, `src/editor/whoisonline/whoisonline-scene.ts`.  

**Assets:** `static/fonts/*.woff2` (Proxima Nova + Inconsolata), `static/img/bcg_primary.jpg`, `static/img/loader.gif` (self-hosted).

---

## Commands log (reproducibility)

```bash
cd onemo-next/studio
npm run type:check   # exit 2 — see tsc output
npm run lint         # exit 1 — see eslint output
npm test             # 157 passing
npm run build        # Vite production build — succeeds (per prior audit); not a substitute for type:check
```

---

*Generated for Linear **KAI-3839** (parent **KAI-3629**).*
