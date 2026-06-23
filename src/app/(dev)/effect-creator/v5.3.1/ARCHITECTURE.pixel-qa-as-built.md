# Creator v5.2.1 As-Built Architecture - Pixel QA

Status: supporting QA note only. This artifact used lead-pane context for scoping and is not the independent code-only architecture authority.

Date: 2026-06-19
Lane: s57-pixel-qa
Worktree: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s57-creator-v5.3`
Branch: `session57-task/creator-v5.3`
HEAD: `f135954`

This document describes the code as read in the current worktree. It is not a blueprint, not a desired future architecture, and not a merge summary. The current worktree is dirty; this doc treats the dirty Creator files as the effective v5.2.1 surface because the lead pane identified this tree as the current as-built source.

## Scope

Fully read source areas:

- `src/app/(dev)/effect-creator/v5.3.1`
- `src/lib/effect`
- `src/lib/vector-core`
- `src/lib/shape-library`
- `src/lib/outline-core`
- All tests under those kernel directories

Not treated as runtime architecture:

- `next.config.ts`, `tsconfig.json`, and `.next-v*` dev scaffolding.
- Existing untracked `ARCHITECTURE.md`; this QA artifact does not edit or replace it.
- Future save/manufacturing UI flows not called by the current v3 page.

## Core Invariants

- The live Creator model is vector-native. A shape is a `VShape`/`VPath` with anchors and optional absolute Bezier handles. SVG strings, Paper objects, Three geometry, and flattened point rings are derived outputs, not source truth.
- The 2D editor truth is `outlineStore.source + outlineStore.adjustments`. `committedShape` and `committedContourMM` are derived by resolving those two values.
- All-off edit state must return the exact source object. Reversibility is a tested contract, not a visual convention.
- Geometry is 2D-first. `prepareEffect` produces `PreparedEffect` and imports no Three.js. Three/R3F consumes prepared geometry; it does not own shape truth.
- Manufacturing contours derive from the same vector shape through `contourFromShape`. The effect engine avoids parallel shape truths.
- Paper.js and Clipper2 are math kernels only. They do not render and do not own app state.
- The active Creator v5 import boundary avoids the old `OutlineDocument` runtime. Current v5 imports the narrow `outline-core/math.ts` surface where needed.
- Async image composition is allowed, but 3D texture baking is gated while the 2D editor is open to avoid rebuilding during live edits.

## End-to-End Flow

Upload / Standard birth:

1. `page.tsx` receives a file URL and resets local page state, `outlineStore`, and global history.
2. `prepareEffect({ type: 'standard' })` creates a full-photo rounded rectangle, not the 72 percent shape-library square.
3. Standard birth applies the 8mm corner radius after full-image birth through the Paper kernel.
4. `outlineStore` is seeded with a `standard` source and all adjustments off.
5. In parallel, upload-time segmentation starts in the background and caches the result in `cutCacheRef`.

Magic / Shaped birth:

1. The Magic action calls `prepareEffect({ type: 'shaped' })`.
2. If upload-time segmentation is available and no explicit `?seg=` harness is active, Magic reuses the cached segmentation through `preseg`.
3. Segmentation returns a low-res contour mask and high-res texture matte.
4. `prepareEffect` traces the raw contour, applies the mm-true simplification floor, builds a sharp `VShape`, derives `geometryMM`, and returns a new `PreparedEffect`.
5. `page.tsx` publishes the resulting source/matte, updates `outlineStore`, updates design state, and records one global history step.

Editor:

1. `OutlineEditor` opens as a 2D overlay and sets `outlineStore.editorOpen = true`.
2. The 3D scene freezes while editing.
3. Tool UI edits local preview state and commits through `useOutlineEditing`.
4. `applyAdjustments` writes recipes over the current source.
5. `reBaseline` converts manual topology changes into a new source with adjustments off.
6. `transformSource` applies affine transforms while preserving ids and adjustments.
7. Done keeps live commits. Cancel restores source, adjustments, blur, image-fx, and artwork state.
8. Closing the editor clears `editorOpen`, and `ShapedModel` rebuilds once from committed geometry.

Rendering:

1. `AdminViewer` loads the `.onemo` scene and hands viewer config to the page.
2. `EffectViewer` hosts R3F with demand rendering and chooses the shaped route in current page usage.
3. `ShapedModelBridge` subscribes to `outlineStore` and passes committed shape/contour, image-fx, blur, wrap tile, and editor state into `ShapedModel`.
4. `ShapedModel` builds mesh geometry from `PreparedEffect` plus committed editor geometry, composes textures, applies materials, and invalidates demand rendering.

## State Model

- `page.tsx` owns page-level UI state: uploaded file URL, prepared effect, auto/generated state, design state, trim, image-fx, wrap tile, status, toasts, and global undo/redo history.
- `outlineStore` owns cross-surface Creator state: source, adjustments, committed shape, committed mm contour, editor-open flag, image-fx, blur, wrap tile, artwork transform, raw trace, and subject matte.
- `OutlineEditor` owns local interaction state: selection, sheet mode, transient shape preview, generator params, gesture refs, canvas view, and internal editor undo/redo.
- `sceneStore` owns admin scene color overrides.
- `PreparedEffect.spec` owns engine-level facts: source ref, mask dimensions, `mmPerPx`, vector shape, `geometryMM`, dimensions, generator metadata, and diagnostics.

## Module Map

App shell:

- `page.tsx`: composition root, upload/Magic/standard flow, history, overlays, and UI routing.
- `types.ts`: local page/editor type surface.
- `FiltersSurface.tsx`: reachable image-fx sheet outside the 2D editor.
- `outlineStore.ts`: app/editor shared state store.

Editor:

- `OutlineEditor.tsx`: 2D editing overlay, source/adjustment lifecycle, Done/Cancel, freeze boundary.
- `EditorCanvas.tsx`: presentational SVG/canvas overlay for image, path, anchors, handles, crop, and transform controls.
- `useOutlineEditing.ts`: mutation verbs for adjustments, rebaseline, and source transforms.
- `useEditorGestures.ts`: pointer/gesture behavior.
- `useEditorAdjustments.ts`, `sheets.tsx`, `seed-defaults.ts`: tool UI and default recipe logic.
- `producers.ts`: stock/generated/upload/SVG production helpers.

3D/runtime:

- `EffectViewer.tsx`: R3F canvas shell, demand frameloop, freeze handling, camera/renderer/environment sync.
- `ShapedModelBridge.tsx`: store-to-3D bridge.
- `ShapedModel.tsx`: shaped mesh, texture composition, material application, mm-to-scene scaling.
- `EffectModel.tsx`: older GLB/material path; still exported, not primary in current shaped page flow.
- `onemo-loader.ts`: `.onemo` zip parsing to viewer config.
- `AdminViewer.tsx`: scene/template loader.

Effect engine:

- `prepare-effect.ts`: standard/shaped preparation, mm sizing, geometry, and front/edge canvases.
- `segment-ml.ts`, `ben.worker.ts`, `ben-chain.ts`: worker segmentation, adapter chain, and comparison harness.
- `mask.ts`, `contour.ts`, `image-shape.ts`: image/mask/trace utilities.
- `composite.ts`: async SVG-filter front/blur composition.
- `outline-resolve.ts`: active source + adjustment shape resolver.
- `geometry-truth.ts`: vector-to-manufacturing contour, cuttability, and vector hash.
- `mesh.ts`: custom Three geometry with front/edge/back material groups.
- `payload.ts`, `persistence.ts`, `attachment.ts`, `sizes.ts`: pure contract/manufacturing/save foundations, currently dormant from page flow.

Kernels:

- `vector-core`: VShape model, flattening, SVG path emit, transform, fitting, point insertion/deletion, and handle tension.
- `shape-library`: static vector preset definitions plus placement transforms; organic presets are baked offline.
- `outline-core/math.ts`: active narrow fairing/validation/hash surface.
- `outline-core` full document runtime: dormant reducer/resolver/SDF/livewire stack for retired/future document flows.

## Active Engines

Cutout engine:

- Production default segmentation chain is `u2netp -> silueta`.
- Both production models are self-hosted from `/seg-models/`.
- Explicit `?seg=` keys select single-model comparison paths where supported.
- Unknown transformer keys like `ben2` and `birefnet` fall through to the transformer harness path.
- Empty/full-frame mattes are treated as degenerate and fall back.
- Stale code comments still call BEN2 the default in places; the actual default chain is `u2netp -> silueta`.

Shape/edit engine:

- `outline-resolve.ts` resolves `OutlineSource + OutlineAdjustments` through direct Paper/Clipper/vector-core ops.
- Global axes include simplify, smooth, straighten, and whole-shape radius.
- Local axes include radius and curve keyed by source anchor id.
- Claimed/pinned anchor ids survive through local/global passes where needed.
- Fold guards reject self-crossing results and preserve the previous safe geometry path.
- Clean-shape symmetry is test-gated across Radius, Curve, Smooth, Simplify, and Straighten.
- There is no active `fairPath` wrapper pipeline in the v5 resolver.

Image-fx/composite engine:

- `FiltersSurface` is the reachable image-fx surface from the hero dock.
- It writes `imageFx`, `bgBlur`, and `wrapTile` into the shared store/page state.
- `composeFront` and `blurCanvas` use async SVG-filter rasterization through Blob URLs.
- `ShapedModel` defers front texture baking while `editorOpen` is true.
- Standalone Filters still bakes live because it does not set `editorOpen`.

3D engine:

- `buildShapedGeometry` creates the mesh from mm contours, not screen pixels.
- The edge profile is an almost-straight wall at the silhouette with short soft corners, not an outward lip or inward groove.
- Geometry carries front, edge, and back material groups.
- UV channel 0 maps artwork; UV channel 1 supports suede/back material scale.
- `EffectViewer` normally runs `frameloop="demand"` and switches to `frameloop="never"` while frozen.

Manufacturing/contracts:

- `geometry-truth.ts` is active as the contour/hash/cuttability truth surface.
- `payload.ts` builds deterministic schema 3 payloads and enforces cuttability, but no active page caller was found.
- `persistence.ts` binds editable recipes to locked payloads through vector F1 hash, but save UI is currently erased/dormant.
- `attachment.ts` validates magnet/velcro attachment deterministically, but it is not in the current page flow.

## v5.2.1 Delta as Found

Present in code:

- P1-style upload cutout cache exists in `page.tsx` and `prepare-effect.ts` through `cutCacheRef`, `preseg`, and subject matte publication.
- P2-style SVG-filter image pipeline exists in `composite.ts` and is used by `ShapedModel`.
- A surviving bridge boundary exists as `ShapedModelBridge.tsx`, translating committed outline store state into shaped-model props.

Not found as active runtime:

- No active page path from the 2D editor dock to `ImageSheet`; the sheet remains implemented but unreachable through current toolbar config.
- No active save/manufacturing UI path into `payload.ts` or `persistence.ts`.
- No active v5 page import of the full `OutlineDocument` runtime.

## Dormant / Dead-Code Register

- `src/app/(dev)/effect-creator/v5.3.1/ARCHITECTURE.md`: existing untracked architecture doc, not edited by this QA artifact.
- `EffectModel.tsx`: older GLB/material flow, still exported but not primary in the current shaped page route.
- `ImageSheet` in `sheets.tsx`: implemented, but no visible editor dock entry currently opens it.
- `payload.ts`, `persistence.ts`, `attachment.ts`: pure tested contracts, dormant from the v3 page.
- `outline-core/reducer.ts`, `resolver.ts`, `sdf.ts`, `livewire.ts`: tested dormant document runtime, not active Creator v5 authority.
- `geometry-truth.legacy.ts`: test-only trace-fit fixture for historical bug classes.
- Old hand-rolled vector fillet helpers: direct test fixtures only, not exported from the public vector barrel.
- Parked shape-library definitions: still resolvable, not necessarily picker-visible.
- `PerfHUD`: opt-in only through `?perf=1`.

## Test Surface Read

Tests were read, not executed in this pass.

Important contracts encoded by tests:

- Standard birth is full image bounds and applies 8mm radius after birth.
- Shape-library square remains a centered 72 percent preset and is not product birth.
- All-off resolver state returns source identity.
- Radius, Curve, Smooth, Simplify, and Straighten are reversible and symmetry-gated.
- Whole-shape Radius uses Clipper2 and can round a square into a circle at half-side radius.
- Paper runs headless without DOM and owns round/smooth/simplify kernel behavior.
- Production cutout chain is `u2netp -> silueta`.
- Vector hashes and payload hashes are deterministic and sensitive to geometry identity.
- Payload/persistence/attachment contracts are tested despite being dormant from current page flow.

## Known Drift / Risks

- Several segmentation comments still say BEN2 default, but code and tests say default is `u2netp -> silueta`.
- Existing `ARCHITECTURE.md` is untracked and likely lane-owned elsewhere; this QA doc avoids modifying it.
- Worktree is dirty beyond this doc, including Creator source files and dev config. This document describes that dirty tree, not clean `HEAD`.
- The current UI has two image-adjustment surfaces in code, but only the hero `FiltersSurface` appears reachable.
- The codebase has strong contract tests around payload/persistence/attachment, but current Creator page flow does not call those contracts.
- No tests were run for this write. Verification here is full-source read and architecture synthesis only.

## Coverage Self-Audit

- App spine read: complete.
- Editor subsystem read: complete.
- Runtime/3D/CSS/UI read: complete.
- Effect engine read: complete.
- Vector-core read: complete.
- Shape-library read: complete.
- Outline-core read: complete.
- Kernel tests read: complete.
- Artifact added without editing existing untracked `ARCHITECTURE.md`.
