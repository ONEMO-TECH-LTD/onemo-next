# Creator — As-Built Technical Architecture

**Status:** As-built (what the code *is*, not the blueprint's intent)
**Version:** v5.5 (foundation Phases 2–3) — the v5.3.1 baseline re-cut into the **UI-agnostic Layer-2 seam**: the `useCreator` macro is decomposed into flow-blind **primitives** + flow-owned **transaction services** (Phase 2) and formalized as the named, swappable **`v53Flow`** behind the **`CreatorFlow`** contract (Phase 3). The engine (Layer 1) + the `lib/effect` internals are **UNCHANGED** — only the orchestration seam + the page binding changed (behaviour-neutral re-cut). (v5.3.1 drift already removed: v1/v2, the prototype/shaped/studio routes, old `studio/`, `/dev/tokens`, the A/B scaffolding; the scene-format is the **live** studio-v2 → Creator `.onemo` bridge — DEC-v5-08, §8/§9.)
**Scope:** `src/app/(dev)/effect-creator/v5.3.1/` + `src/lib/effect/` + the kernels (`vector-core`, `outline-core` live half, `shape-library`, `export`). Logic/architecture only — `.module.css` styling files are excluded.
**Provenance:** branch `session58-task/kai-9205-creator-v53flow` off `origin/staging` (Phase 2 merged @ `b60e52f`; Phase 3 `v53Flow` @ `2deda75`; dead route barrels killed @ `7e0b1c0`). Re-derived from a full code read per §11 rule-2 (KAI-9266).
**Companion:** the forward blueprint lives at `onemo-ssot-global/_ssot-workbench/v5/` — that is *to-be*; this is *as-is*. On conflict, the code (and this doc) win.

---

## 1. Overview & invariants

The Creator turns a user photo into a 3D-previewed, manufacturable suede effect. The product is a single 3D scene the user never leaves; every tool is a surface over it.

Invariants the code actually enforces:

- **One flow seam (v5.5).** The page is a thin Layer-3 adapter binding ONLY a flow's `CreatorFlow` `{ state, actions }` (`page.tsx` → `useV53Flow`). All orchestration lives in the flow (`flows/v53Flow.ts`), composed from Layer-2 primitives + transaction services; the UI never imports an engine lib or reads a store directly. A new pipeline is a new compose-function, not a socket rewrite (blueprint inv 18).
- **One persistent scene.** The golden scene mounts once and never unmounts (`page.tsx` `AdminViewer`→`EffectViewer`). No "phases", no "Finish in 3D". The 2D editor is an *overlay* that freezes the scene (`frameloop="never"`), never a separate route.
- **One 2D engine.** `prepareEffect` (`lib/effect/prepare-effect.ts`) is the only producer of geometry + textures. It is **three-free**; the 3D half is `buildMeshFromSpec`.
- **One shape truth.** `resolve(source, adjustments)` (`lib/effect/outline-resolve.ts`) is the only path from edit-recipe to display/cut shape. All-off ⇒ exact source.
- **One image bake.** `composeFront` (`lib/effect/composite.ts`) bakes the front texture used by **both** the 3D model and print — 3D == print parity.
- **One state bridge.** `outlineStore` (`user/outlineStore.ts`) holds the truth; `ShapedModelBridge` translates it to props; `ShapedModel` renders from props only.
- **Fail-closed geometry.** A commit that resolves to a null or non-cuttable contour is *refused* — editor truth never advances past a bad projection (`outlineStore.ts:84` `derive`, R9).

## 2. End-to-end data flow

The page binds `useV53Flow` and renders from `state` / calls `actions`. **v53Flow** (`flows/v53Flow.ts`) COMPOSES the Layer-2 primitives (`core/primitives.ts`) + transaction services (`core/transactions.ts`) + the viewer adapter (`core/viewer-adapter.ts`). The engine (`lib/effect`) is unchanged from v5.3.1 — the macro was retired, the orchestration moved into the flow (Phases 2–3).

```
upload (File) → v53Flow.upload:
  → loadImage(file) [blob lifecycle] → prepareStandard(url): prepareEffect(url,'standard')
      → PreparedEffect { spec, composite, edgeComposite, frontSrc }
      → store.setSpec(spec); setPrepared (prepared-for-EDITING); publishToViewer(p) (prepared-for-3D, inv 26)
      → history.setBaseline (the history transaction owns the AppSnap stack + clears it)
  → startBackgroundCutout: runCutout(url) [segmentML, working-res cap inv 19] → cacheSeg
      → publishCutoutResult(seq,…) [the seq-guard at PUBLICATION; matte written iff still the active image]
  → 3D: EffectViewer(prepared-for-3D) → ShapedModelBridge → ShapedModel   (engine, unchanged)
        mesh = buildShapedGeometry( vectorTrueContour(committedContour ?? spec.geometryMM) )
        texture = composeFront(frontSrc.origCanvas, frontSrc.subjCanvas, blur, fx, vignette, tint)

Magic → v53Flow.magic: prepareShaped(url, preseg from cache) [reuses the bg cut — no AI re-run]
  → if isCurrent(runId): setPrepared + publishToViewer; shaped spec REPLACES standard; setSubjMatteUrl;
    autoOutline=true; history.pushHistory(preMagic) [one Magic = one undo step]. cancelMagic bumps the token.

Editor / Trim / Filter SESSIONS (useSessions): begin = snapNow; commit = pushHistory on a real change; revert.
  Editor overlay: store.setEditorOpen(true) [scene frozen; 3D bakes DEFER]; seeds OutlineSource from
  spec.vectorShape (Magic = raw polygon; pre-Magic = square + 8mm radius); edits → setSource/setAdjustments →
  derive → committedShape + committedContourMM; Done → setEditorOpen(false) → ONE deferred mesh rebuild +
  ONE texture rebake. (cancelFilters is close-only — the imageFx/bgBlur/wrapTile revert still lives in
  FiltersSurface until Phase 6 by construction, Option A.)

Filters (hero, KAI-9124): FiltersSurface over the LIVE scene → setImageFx/setBgBlur/setWrapTile → rebakes live.
Export (?internal=1): actions.exportSvg → exportCutlineSvg(shape, geom) [feasibility gate + mm-SVG]; UI writes file.
```

`spec` (engine→editor) and `committedShape`/`committedContourMM` (editor→3D) are the two bridge contracts;
`prepared-for-editing` (2D) is split from `prepared-for-3D` (the viewer, inv 26). The cut-out runs in a worker;
its matte feeds the editor's Blend preview on any shape.

## 3. Module map

### 3.1 Composition, flow & state — `v5.3.1/`

| File | Role | Key contract |
|---|---|---|
| `page.tsx` (240) | **Thin Layer-3 composition root.** Mounts the one scene; binds `useV53Flow` → renders from `state`, calls `actions`. Owns ONLY the injected UI-side adapters: notify (toast), URL/route params, the double-tap editor-entry gesture, the export file-download, the first-paint resize nudge. **No orchestration** — that's the flow. | Surfaces mutually exclusive: `showColors`→Trim, `showFilters`→Filters, else Toolbar; editor is a separate overlay. |
| `flows/v53Flow.ts` (219) | **THE v53 flow** — `useV53Flow(adapters): CreatorFlow`. Today's behaviour as a thin COMPOSITION of the primitives + transaction services + viewer adapter (blueprint §6); returns `{ state, actions }`. | Formalized from the Phase-2 `useCreator` macro (retired); body byte-identical. twoDFirstFlow is a sibling compose-fn in Phase 5. |
| `flows/flow-contract.ts` (78) | The `CreatorFlow` `{ state, actions }` contract + `CreatorAdapters`/`Notify` — the named Layer-3 seam. | DESCRIPTIVE: v53Flow's current surface named, NOT a guaranteed shared contract (inv 18; conformance = Phase-5 finding). |
| `core/primitives.ts` (93) | **Layer-2a flow-blind primitives** — one engine op each, zero sequencing: `loadImage` · `prepareStandard` · `runCutout` (working-res cap, inv 19) · `prepareShaped` (Option-A preseg) · `exportCutlineSvg` (feasibility-gated result). | No history, no seq-guard, no cache, no notify (blueprint inv 15). |
| `core/viewer-adapter.ts` (36) | **Layer-2a viewer adapter** — owns `prepared-for-3D`; `publishToViewer` builds 3D ON CALL (inv 26 2D/3D split); `handleStatus` (G4). | The flow decides WHEN to publish; split from prepared-for-editing. |
| `core/transactions.ts` (422) | **Layer-2b flow-owned transaction services**: `useHistoryTransaction` (snap/restore/undo/redo/reset + F25 recipe/LRU/seg-cache, inv 20) · `useGenerationTask` (Magic-cancel token) · `useUploadPublish` (publishCutoutResult seq-guard at publication) · `useSessions` (editor/trim/filter begin/commit/revert). Pure helpers (unit-tested): liteSpec/liteSource + the session change-detection predicates. | Flow-timing state — NOT primitives. |
| `types.ts` (112) | Shared viewer/scene config types. | `ViewerConfig`, `DesignState`(offsetX/offsetY/scale), `ColorConfig`, material roles. No duplicates elsewhere. |
| `user/outlineStore.ts` (142) | The state bridge (zustand). | See §4. |

### 3.2 3D — `v5.3.1/core/` + `core/shaped/`

| File | Role | Key contract |
|---|---|---|
| `EffectViewer.tsx` (370) | R3F `<Canvas>` wrapper. `frameloop={frozen?'never':'demand'}`. Routes `shaped`→`ShapedModelBridge`, else `EffectModel` (GLB). OrbitControls `enableDamping=false` (damping defeats demand-loop), `enabled={!isEditing && !frozen}`. `InvalidateOnAssetLoad` = no-blank-mount burst. `deriveSuede`. DPR `[1,2]`. | The 3D shell; shared with Studio. |
| `core/shaped/ShapedModelBridge.tsx` (45) | TRANSLATE half. Subscribes `outlineStore` (committedShape/committedContourMM/editorOpen/bgBlur/imageFx/wrapTile) → props. | "Bridge translates, viewer renders." Keeps store reads local to the 3D subtree. |
| `core/shaped/ShapedModel.tsx` (446) | RENDER half (R7 prop-pure, reads NO store). Builds mesh + 3 materials; owns the **version-bridge defer** and the **texture rebake**. | `vectorTrueContour` tessellates at `DISPLAY_TOLERANCE_MM` (0.004). Mesh rebuild + texture rebake both `if (editorOpen) return` → fire on close. Pan/zoom = matrix-only (no `needsUpdate`). |
| `core/EffectModel.tsx` (341) | GLB material path. **Not used by /create** (`shaped=true`); Studio/admin only. | `useGLTF` + role-material override. |
| `core/onemo-loader.ts` (232) | Loads the golden scene `.onemo` (zip: `scene.glb` + `studio.json`) → `ViewerConfig`. | `parseOnemoConfig(url)`. Imports from `./scene-format` (extracted from the old studio). |

### 3.3 Scene config — `v5.3.1/admin/`

| File | Role | Key contract |
|---|---|---|
| `AdminViewer.tsx` (120) | Loads `/api/dev/scenes/golden` via `onemo-loader`, merges trim colors, provides `ViewerConfig` to `EffectViewer`. | No hardcoded scene defaults — all from the `.onemo`. |
| `sceneStore.ts` (34) | Trim colors (back/frame/bg). | Defaults `#080808`/`#0f0f0f`/`#ffffff`. |

### 3.4 The 2D editor — `v5.3.1/user/` + `user/editor/`

| File | Role | Key contract |
|---|---|---|
| `OutlineEditor.tsx` (886) | The editor overlay. Modes Shape/Adjust/Image; orchestrates the 5 hooks + EditorCanvas + sheets. On open: snapshot (preEditRef), `setEditorOpen(true)`, seed source. On Done: `setEditorOpen(false)`. On ✕: restore preEditRef (source+adjustments+bgBlur+imageFx+artwork). | Dock = **Shape · Magic · Adjust** (848–858). **Image entry NOT in the dock** — `ImageSheet` renders only on `activeAdjust==='image'`, set only via `openMode==='image'` (286), which page never passes → orphaned (§10). |
| `editor/useOutlineEditing.ts` (114) | The editor's geometry-state engine over `source+adjustments`. `display = resolve(source, preview ?? adjustments)`; 50-deep history. Verbs: `applyAdjustments` (tool), `seedSource` (producer), `reBaseline` (manual op→fresh source), `transformSource` (move/rotate/stretch, ids preserved). | resolve() is the only truth→display path. |
| `editor/useEditorGestures.ts` (446) | Every pointer/touch handler (anchor/handle drag, double-tap Points, pinch/pan/wheel, move, crop stretch, rotate, tap-select). Latest-ref pattern (stable handlers, fresh ctx). | Image mode: single-finger pans the photo (`artwork`), wheel zooms it. |
| `editor/useEditorAdjustments.ts` (128) | Recipe writers: `previewRadius`/`commitRadius` (per-corner Paper / whole Clipper), `previewCurve`/`commitCurve`, `previewGlobal`/`commitGlobal` (simplify/smooth/straighten), **`writeBlend(on,pct)→setBgBlur`**. | Writes source+adjustments/bgBlur; resolve owns shaping. |
| `editor/useCanvasView.ts` (78) | G11 view as the SVG `viewBox` (`scale`/`vx`/`vy`). `screenToContent`, `originPinning`, `applyZoom`, `toViewBox`. | Zoom clamp `[1,6]`. |
| `editor/EditorCanvas.tsx` (302) | Presentational SVG overlay (memo'd). Renders photo (live fx + blend + pan/zoom), scrim, true-curve path, anchor skeleton, rotate handle, lock chip, crop grips. | Live preview = **Safari-safe DOM filters**: CSS `fxFilter` (126) + SVG `feGaussianBlur` blend (187, 198). Distinct from the 3D's `composeFront` bake. |
| `editor/sheets.tsx` (413) | `AdjustSheet` (Detail/Offset/Radius/Curve/Simplify/Smooth/Straighten), `ImageSheet` (Bright/Contrast/Color/Warmth/Blend → `setImageFx`), `ShapeSheet` (Upload + chips + parametric). `fxToPct`/`fxFromPct`. | `ImageSheet` is fully wired to `setImageFx`/`writeBlend` but reached only via the orphaned Image mode. |
| `editor/producers.ts` (127) | Pure source builders: `vecFromGenerator`, `vecFromImageFile`, `traceSourceFromRaw` (Detail/Offset re-derive from cached raw trace, no AI re-run), `detailToFloorMm`/`offsetPctToMm`. | |
| `editor/chips.tsx` (48) | `SHAPE_CHIPS` (curated lineup), `ShapeChipIcon` (drawn from real geometry), `DEFAULT_SHAPE_PARAMS`. | |
| `editor/seed-defaults.ts` (40) | `cornerRadiusAdjustments` (T5), `AUTO_TUNE` (T6 — **dormant, paused 2026-06-17**), `representativeLocal` (T7 value-reflection). | Magic seeds raw + tools OFF for manual calibration. |
| `editor/geometry.ts` (20) | Editor ring math: `pointInPolygon`, `GripId`. | |

### 3.5 Surfaces & chrome — `v5.3.1/user/`, `v5.3.1/ui/`, `v5.3.1/dev/`

| File | Role |
|---|---|
| `Toolbar.tsx` (76) | Hero creation dock: Image · Magic · Trim · Filters · Editor. `onFilters`→FiltersSurface; `onEditor`→OutlineEditor. |
| `Dock.tsx` (43) / `TopBar.tsx` (50) | The shared pill-island + top bar, used by hero AND editor (same component identity). |
| `FiltersSurface.tsx` (102) | Hero image-fx (KAI-9124). PRESETS/TINTS/sub-tabs/fill. `apply()` = `setImageFx` LIVE over the unfrozen scene → ShapedModel rebakes immediately. |
| `TrimCarousel.tsx` (70) | Back-material color (mock suede + picker). Recolors 3D back live. |
| `EmptyState` (30) / `GenerateShimmer` (25) / `EditOverlay` (13) | Pre-upload square / Magic shimmer / drag indicator. |
| `ui/TickBar.tsx` (194) | The one ruler control. `onChange` per-tick (preview), `onCommit` on release (resolve+apply+undo+3D push). |
| `ui/Toast.tsx` (64) | G4 error surface (module-level `toast()`). |
| `dev/PerfHUD.tsx` (116) | `?perf=1` telemetry; `perfGesture()` sink. Budgets: tick ≤16ms, task ≤50ms. |
| `user/icons.tsx` (69) | Phosphor glyph map. |
| `user/shapes.ts` (190) | The 4 live parametric generators (daisy/pinwheel/form/blob); static presets live in `shape-library`. `PARAMETRIC`. |

### 3.6 Engine library — `lib/effect/`

| File | Role | Key contract |
|---|---|---|
| `prepare-effect.ts` (292) | The ONE 2D engine. `standardBirthShape` (full rect + 8mm corners via Paper). `prepareEffect(url, type, cfg, onProgress, preseg)`. | `EFFECT_BUILD_CONFIG`: 70mm base, 1mm body, edgeRadius 0.2mm, padding 1.5mm, texDim 2400. Shaped = raw marching-squares + RDP at `minFeatureMM` (5mm floor), NO fairing/fit. `frontSrc` = re-bake source. |
| `composite.ts` (172) | The image bake (P2 cross-browser SVG engine). `composeFront(orig, subj, blurPx, fxFilter?, vignette, tint)` async. `svgFilterBake` via `URL.createObjectURL(Blob)` (Safari-safe; data-URL renders empty on WebKit). `cssColorFilterToSvg`. `PRESET_FILTER`/`presetFilter`/`PRESET_LABELS`. | One bake feeds 3D + print. Zero `ctx.filter`. |
| `outline-resolve.ts` (263) | The shape engine. `resolve(source, adjustments)→VShape`: all-off=exact source; globalPass (straighten→simplify→smooth→radius) + localPass (curve+per-corner radius), fold-guarded. | Kernels: Paper (smooth/simplify/per-corner radius) + Clipper2 (straighten/whole radius) + in-house curve. |
| `geometry-truth.ts` (106) | The single geometry pipeline. `contourFromShape(v)` @ `MANUFACTURING_TOLERANCE_MM` (0.05). `assertContourCuttable`. `vectorShapeHash`. | Tolerances: mfg 0.05, display 0.004, min-feature 5mm, anchor-sep 1.5mm. |
| `mesh.ts` (212) | `buildShapedGeometry(contour, opts)` — custom BufferGeometry: front cap + rounded edge lip + back cap. 3 material groups (0 front / 1 edge / 2 back). UV0=image, UV1=world-XY suede. Canonical winding (outer CCW / holes CW). | Edge = same front image rolled over the lip. |
| `build-mesh.ts` (46) | `buildMeshFromSpec(geometryMM, opts, composite, edgeComposite)` → geometry + 2 CanvasTextures. | The only three.js touch besides mesh.ts. |
| `mask.ts` (293) | Image load (`loadImageData`, y-up), `deviceMaxTextureDim`, the **fallback** segmentation (`segment` = alpha-channel else border flood-fill), `postProcessMask`/`smoothMask`/`dilateMask`. | Header corrected post-de-slop (BEN2 retired; default = the trio). |
| `image-shape.ts` (53) | `maskFromImageData` (Otsu) for image-upload-as-shape. | |
| `contour.ts` (151) | `traceContourRaw`: marching-squares → stitch → largest loop → CCW raw ring. No RDP/fillet/smoothing (those route through outline-core). | |
| `ben.worker.ts` (271) | Cut-out worker. Default = rembg trio (`resolveChain`) on **WASM EP** (no WebGPU). `?seg=ben2` = transformers/WebGPU (opt-in). Degenerate-matte guard. | Posts RGBA matte (alpha=subject). |
| `ben-chain.ts` (37) | `resolveChain(seg)`: no seg → `[u2netp, silueta]` (production trio); single rembg model; else null→transformers. `REMBG` specs (self-hosted `/seg-models`). `isDegenerateMatte`. | The truth of which model runs. |
| `segment-ml.ts` (174) | Main-thread worker wrapper. `segmentML(url, maskDim, texDim)` → low-res mask + hi-res texture + `adapterId`. 120s watchdog. `preloadBen` (disabled at boot). | Header corrected; residual BEN2 NAMING remains lower (segParam comment, the downscale/run comments, `ML_ADAPTER_ID='ben2-onnx'`) — naming-only; the router runs the trio (§10). |
| `payload.ts` (306) | **DORMANT** manufacturing contract. `buildApprovedEffectPayload` (content-addressed, int-micron). Not wired to /create (§7). | |
| `persistence.ts` (167) | **DORMANT** saved-effect model (EditableRecipe + LockedPayload, F1 bond). No save surface. | |
| `attachment.ts` (149) | **DORMANT** `validateAttachment` (magnet 54mm grid / velcro). Invented defaults. | |
| `sizes.ts` (57) | `EFFECT_SIZES` (s70 1×, s140 2.4×), `toFinalPhysicalMm`. | |
| `offset.ts` (37) | `insetRingMM` (Clipper2). Editor Offset tool (live); −8mm magnetic inset (dormant consumer). | |
| `types.ts` (76) | Core contracts: `EffectSpecDraft` (the `vectorShape` truth + derived `geometryMM` + `dimensions` + `rawTracePx` provenance + `diagnostics`), `Contour`/`Ring`/`Pt`, `Dimensions`, `SuedeMaterialParams`. | Draft = preview routing surface, not canonical truth. |
| `effect-types.ts` (13) | `EFFECT_TYPES` registry: `standard` (tier-1, fixed geometry) / `shaped` (tier-2, contour silhouette). | Taxonomy carried as data, not symbol names. |

### 3.7 Kernels (live half) — `lib/vector-core/`, `lib/outline-core/`, `lib/shape-library/`

| File | Role |
|---|---|
| `vector-core/types.ts` (40) | `VAnchor`(p/hIn/hOut/corner/id) / `VPath` / `VShape`. SVG-path-native; stable per-anchor id (VD9). |
| `vector-core/path.ts` (157) | `segmentAt`/`cubicPoint`/`flattenPath`/`flattenShape`/`toSVGPathD`/`transformShape`/`splitCubic`/`signedArea`. `filletPath` = test-only. |
| `vector-core/ops.ts` (164) | `nearestOnPath`/`insertAnchorCentered`/`deleteAnchorRefit`/`scaleAnchorTension` (Curve). |
| `vector-core/fit.ts` (424) | Schneider cubic Bézier fit (`ringToVPath`) + DP anchor-compaction (KAI-8974) + pair-collapse. |
| `vector-core/paper-kernel.ts` (183) | Paper.js headless: `roundCornersPaper`/`roundShapePaper`/`smoothPaper`/`simplifyPaper`. |
| `vector-core/clipper-kernel.ts` (73) | Clipper2: `straightenPath`/`roundWholeShapePx`. |
| `outline-core/math.ts` (21) | Narrow barrel — re-exports the LIVE ring-math from `./resolver` + `contentHash`/`stableStringify`. |
| `outline-core/resolver.ts` (480) | **All live ring/curve math** (via the math barrel): `signedArea`/`rdpClosed`/`catmullRomClosed`/`normalizeRing`/`validateSelfIntersection`/`repairSimplePolygon`/`fairTracedRing`/`fairingFromDetail`/`flattenPath`. The v1/v2 doc-runtime (`resolveOutlineDocument`/`nodesFromTracedRing`/`assembleTracedRing`) was **removed in the v5.5.1 de-slop** (DEC-v5-07) — no longer MIXED. |
| `outline-core/hash.ts` (36) | `contentHash` (cyrb53) + `stableStringify` — all live; the dead `outlineDocumentHash`/projections were removed in the de-slop. |
| `shape-library/defs.ts` (214) | 14 stock shapes as pure vector data — analytic (circle/square/polygon/star/heart/leaf/lens/pill) + baked organic (pinched/sparkle/teardrop/squircle/asterisk/bowtie). |
| `shape-library/baked.ts` (175) | Frozen anchor literals (data; generated by `bake.ts`). |
| `shape-library/index.ts` (19) | `getShape(kind, imgW, imgH)` — place in image box (0.72). |

### 3.8 Export — `lib/export/`

| File | Role | Key contract |
|---|---|---|
| `svg-mm.ts` (118) | `toManufacturingSVG` — mm-true SVG (1 user unit = 1 mm; `laser` = red stroke-only cut line at 0.1mm / `cricut` = filled silhouette). `normalizeWinding` (outer CCW). `parsePathD` (M/L/C/Z dialect, loud failure). | **Kerf is never baked into geometry** — the cutter applies it. Live: `page.onExport`. |
| `svg-import.ts` (38) | `vshapeFromSVG` (single-path dialect gate — loud product-language rejection of layers/transforms/multi-path), `fitShapeToBox` (0.72 placement). | Live: `OutlineEditor.onUploadShape`. |
| `index.ts` (5) | Public barrel. | |

## 4. State model — `outlineStore`

Truth (V4):
- `source: OutlineSource | null` — immutable sharp vector + stable ids + `mmPerPx`/`maskHeightPx`/`klass`/`rawTracePx`.
- `adjustments: OutlineAdjustments` — `{ global{simplify,smooth,straighten,radius}, local{id→{radius,curve}} }`.

Derived projection (consumer contract, read by ShapedModel/page/payload):
- `committedShape = resolve(source, adjustments)`.
- `committedContourMM = contourFromShape(committedShape)` @ 0.05mm.

`derive()` (`outlineStore.ts:84`) is **fail-closed (R9)**: resolve → contourFromShape → `assertContourCuttable`. Null or non-cuttable ⇒ the writer returns without mutating state. So `source/adjustments` and `committedShape/contour` can never desync, and a folded outline never reaches the mesh or the manufacturing contour.

Writers: `setSpec`, `setSource` (producer; adj defaults OFF), `setAdjustments` (tool), `commitGeometry` (compat shim: wrap a VShape as a fresh all-off source, or clear).

Other state: `bgBlur` (magic-blend), `subjMatteUrl` (Blend preview matte), `editorOpen` (version-bridge flag), `imageFx` (`{brightness,contrast,saturate,warmth,preset,vignette,tint}`), `wrapTile` (fill/clamp), `artwork` (`DesignState` pan/zoom).

## 5. The four engines

### 5.1 Shape — `resolve(source, adjustments)`
The editor writes a recipe; `resolve` owns the shape. Born sharp (Magic = raw marching-squares polygon RDP'd to the 5mm min-feature floor; pre-Magic = square + 8mm-radius adjustment). Tools are reversible: dialing every axis to 0 returns the exact source. Math bottoms out in Paper.js (round/smooth/simplify), Clipper2 (straighten/whole-radius), Schneider fit (`ringToVPath`), and the outline-core ring-math (RDP/self-intersection/fairing).

### 5.2 Image-fx — `composeFront` (P2)
Cross-browser SVG-filter bake. `composeFront(orig, subj, blurPx, fxFilter, vignette, tint)`: blurred bg + sharp subject (magic-blend) → CSS-shorthand colour fx → tint + vignette. Rasterized via **Blob-URL** SVG `<filter>` (Safari-safe; data-URL is empty on WebKit). The **same** composite is the 3D front texture and the print master.

Two preview paths, by design:
- **Editor** (EditorCanvas): live preview via Safari-safe DOM filters (CSS `fxFilter` + SVG `feGaussianBlur`), 3D bake **deferred** to Done (version-bridge).
- **Hero Filters** (FiltersSurface): writes `setImageFx` over the unfrozen scene → ShapedModel rebakes **live** (the laggy/iPhone-reset path).

### 5.3 3D mesh — `buildShapedGeometry`
Custom geometry from the display-tolerance contour: front cap (golden suede + image), rounded edge lip (matte copy, same image rolled by arc-length), back cap (solid colour). Suede normal/roughness/bump on UV channel 1 (world-XY → never stretches). Pan/zoom is matrix-only.

### 5.4 Cut-out — `ben.worker`
Product default = lightweight trio **u2netp (4MB) → silueta (44MB, lazy) → flood-fill**, WASM EP, self-hosted `/seg-models`, no WebGPU → Safari-safe. BEN2 is opt-in only (`?seg=ben2`). Runs at upload in the background (P1), cached so Magic reuses it (no AI re-run) and the matte lights up Blend on any shape.

## 6. Surfaces & UI

Over the live scene, mutually exclusive (page routing):
- **Toolbar** (default): Image · Magic · Trim · Filters · Editor.
- **TrimCarousel** (`showColors`): back-material color, live.
- **FiltersSurface** (`showFilters`): image-fx, live over the unfrozen scene.
- **OutlineEditor** (`editingOutline`): separate overlay, scene frozen. Dock = Shape · Magic · Adjust.

Editor entry: double-tap the object (two clean taps <350ms) or the Editor dock tool. Magic is self-sufficient — it lands in 3D and does **not** auto-open the editor.

Global history (page): one user action = one step (Magic, editor session, trim, filters, position). The editor keeps its own 50-deep undo inside a session; Done collapses it to one global step.

## 7. Manufacturing track (dormant)

The full contract exists, is pure + unit-tested, and is **not wired** to /create:
- `payload.ts` — `ApprovedEffectPayload` (geometry in int-microns, content hash, artwork recipe hash, gates).
- `persistence.ts` — saved-effect model + F1 recipe↔payload bond.
- `attachment.ts` — magnet/velcro validators (invented defaults, coupon-pending).
- `sizes.ts` — size bands → price multiplier.

The only live manufacturing output is `page.onExport` (`?internal=1`): mm-true SVG cutline via `toManufacturingSVG` (laser profile by default — red 0.1mm stroke, kerf applied by the cutter), feasibility-gated by `contourFromShape` + `assertContourCuttable`. Wiring the save/order flow + the 4 artifacts is the open manufacturing work.

## 8. v5.3.1 delta — what v5.3 left behind

v5.3 ran two sprints on this branch; the build broke and was reverted to working state. What **survived** into v5.3.1:

- **P1 — background cut-out at upload** (KAI-9146): `page.startBackgroundCutout` + `prepareEffect` `preseg` + `subjectMatteFromSeg`. Magic reuses the cached cut; Blend works on any shape.
- **P2 — cross-browser SVG composite engine** (KAI-9147): `composite.ts` `composeFront`/`blurCanvas` now bake via Blob-URL SVG filters (async). Zero `ctx.filter`. The validated Safari fix.
- **P4 — version-bridge** (KAI-9149): `ShapedModel` defers the texture bake while `editorOpen`, rebakes once on Done. The 3D displays a frozen version during editing instead of re-filtering live.
- **Filters v2 surface** (KAI-9124/9125): the hero `FiltersSurface` (presets/tint/vignette/fill) + `imageFx` preset/vignette/tint fields + `wrapTile`.
- **Sprint-1 features** (7b92abc): Radius dual-engine (Paper per-corner + Clipper whole-shape), Detail/Offset re-derive tools, curated stock chips.

What was **reverted** (P3/P5): the full-bleed canvas effects, surround-glow / 3D-backdrop, and editing-unclip — the effect layers no longer fill the screen. (The editor *overlay* is itself full-screen — `OutlineEditor` renders `styles.overlay` = `position:fixed; inset:0` with a 100%-size SVG canvas; the revert removed the full-bleed effect surfaces, not the overlay. No "~300px contained" model size exists in v5.3.1 code — that was a hero-model target, not an as-built fact.)

## 9. Dead-code register

**Removed in the v5.3.1 cleanup** (off snapshot `798b191`): `effect-creator/v1` + `v2`, the `(dev)/prototype`/`shaped`/`studio` routes, old `studio/` (the 26M PlayCanvas-fork editor — superseded by studio-v2, which is untouched), the `/dev/tokens` old-token pipeline, and the dev A/B build scaffolding. The scene-format adapter (`onemo-deserialize`/`onemo-format`) was extracted from old `studio/` into `core/scene-format/`, so the Creator owns its `.onemo` reader.

**Removed since the v5.3.1 doc was written** (v5.5.1 de-slop DEC-v5-07 + Phase-3 o-deslop KAI-9268) — verified against the tree 2026-06-27:
- `outline-core` document-runtime: `sdf.ts`, `livewire.ts`, `reducer.ts` **DELETED**, and `resolver.ts`'s `resolveOutlineDocument`/`nodesFromTracedRing`/`assembleTracedRing` half **DELETED** (0 refs; resolver 726→480L). `outline-core/` is now `hash/index/math/resolver/types`; the `index.ts` **barrel + ring-math are LIVE** (engine imports `fairingFromDetail`/`validateSelfIntersection` through `outline-core/math`). **Cleanup complete — no remnant:** `outline-core/types.ts` (100L) carries only a *comment* noting the `OutlineDocument` model was removed; no `OutlineDocument` type or doc-runtime symbol remains (verified `rg`).
- The 3 route barrels `v5.3.1/{user,core,admin}/index.ts` — **DELETED** (Phase-3 o-deslop, KAI-9268; 0 static+dynamic importers, triple-verified).
- `geometry-truth.legacy.ts` — retired trace fit, **relocated to `src/lib/effect/__tests__/`** (test-only fixture).

Still present (clarified, NOT dead):
- `EffectModel.tsx` — the GLB material path; not on the shaped (/create) route, used by Studio/admin. **`onemo-loader.ts` is LIVE** — `parseOnemoConfig` loads the golden scene through `AdminViewer` (live on /create). Per **DEC-v5-08**, the scene-format (`core/scene-format/`) is the **live studio-v2 → Creator `.onemo` single-source bridge**, not a dead one-time extraction.

## 10. Known drift / debt

- **Orphaned editor Image path.** `ImageSheet` + EditorCanvas image preview + `setImageFx` are fully built and wired, but the editor dock (`OutlineEditor.tsx:848`) doesn't expose Image and page never passes `openMode='image'` — so the only image-fx entry is the hero `FiltersSurface`, which bakes the 3D live (the iPhone lag/reset path). Re-exposing the editor's Image entry routes image-fx through the version-bridge (deferred bake). The plumbing already exists.
- **Residual BEN2 naming** (cosmetic, not behaviour). The `mask.ts` + `segment-ml.ts` HEADERS are corrected (BEN2 retired; default = the trio). Residual BEN2 wording remains LOWER in `segment-ml.ts` only — the `segParam` default comment, the downscale/run comments, and `ML_ADAPTER_ID = 'ben2-onnx'`. The router (`ben-chain.ts`) runs the trio by default; the names are naming debt.
- **AUTO_TUNE dormant.** `seed-defaults.ts` `AUTO_TUNE` (T6) is built but paused (Dan, 2026-06-17) — Magic seeds raw + tools OFF for manual calibration.
- **`edgeRadiusMM` re-pin TODO.** `prepare-effect.ts:66` notes 0.15 was tuned for a 0.5mm body; current 0.2 on the 1mm body is the accepted straight-wall value but flagged as a §9 follow-up.
- **Multi-ring drop.** `geometry-truth.contourFromShape` keeps only the outer ring while the SVG exporter serializes all paths — a silent divergence the moment holes/multi-piece shapes ship (KAI-9086 guard logs it).

## 11. Maintenance discipline

This doc is **as-built** — it is only true if it tracks the code. Two mechanisms (decided 2026-06-19):

1. **Same-PR rule.** Any Creator PR that changes architecture (a module's role/contract, the data flow, the state model, an engine, a surface, or the dead-code/drift state) MUST update this doc in the same PR. Precedent: SSOT `5.1-system-architecture.md` already binds its contract sources this way.
2. **Version-bump re-audit.** At each version bump (v5.3.1 → next), re-derive this doc from a full code read to catch anything that slipped the same-PR rule. Bump the version + provenance header.

Canonical copy: `onemo-ssot-global/5-architecture/5.4-creator-as-built-architecture.md`. This repo copy is the working copy kept in lockstep by rule 1.
