# KAI-10219 Builder ledger

## Authority and boundary

- Base snapshot: `0b747d813e62f0ce77b7f2b3f9a93e213a7741a7`.
- Branch: `session62-task/KAI-10219-output-adapter-truthful-output`.
- Contract: authoritative 177-line SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 4.
- Preserve: `bakeStickerEngine` as the Cutout clip/crop/coordinate adapter, canonical `composeEffectArtwork`, shared Tile/non-Cutout callers, current output cap, existing UI behavior.
- Remove only after caller trace: Mirror and Cutout fill-choice/mosaic glue; Cutout-only dormant preset/vignette/tint/scale/pan settings/ranges/transforms.
- Measure before change: cost of Cutout-unused `prepareEffect` outputs. Add no skip unless measured material and shared defaults/outputs stay unchanged.
- Repair: Blend-0 bypass boundary; Preview/Save capped-pixel identity; visible image/SVG failure; timeout/cancellation/resource settlement.
- Exclude: Cutline, natural-resolution Save, shared-compositor policy migration, GrabCut/provider work, KAI-10220 build-ahead.

## Minimal-diff gate

- Read the full output adapter, shared compositor/preparation owners, every caller, current output tests/oracles, and UI bindings before editing.
- Probe preparation allocations/timing and current Preview/Save pixels/dimensions before proposing any skip or output change.
- Minimal diff must delete replaced Cutout glue in the same snapshot and add no parallel compositor/output path.

## Fresh source/caller/profile result

- Cutout consumes `spec`, `frontSrc`, `widthMM`, and `heightMM`; it never reads `PreparedEffect.composite` or `edgeComposite`. Grid/Creator/3D do read those outputs, so shared defaults must remain full.
- Exact fixed-viewport route profile on the 1536x1536 fixture source measured the unused initial artwork + edge composite at 407 ms, 403 ms, and 402 ms across three prepares, retaining 18,874,368 output bytes before intermediates. A Cutout-only skip is materially justified.
- The output adapter is necessary: it maps mask space to texture space, expands Clamp bounds, pads blur, invokes the canonical compositor, flips y-up to y-down, clips the vector path, and crops to the requested outline bounds.
- The current Preview toggles before a full bake settles and can show either an old display bake or `drawCutout` checkerboard pixels. Save awaits full mode, so Preview and Save do not currently share a readiness boundary.
- Shared SVG raster loading rejects but has no timeout or in-flight cancellation; a hung image can retain its Blob URL indefinitely. The adapter cancellation callback is checked only between stages.

## Final minimal diff

1. `prepare-effect.ts`: add one typed `buildOutputs: false` option returning the existing spec/front-source base without allocating initial/edge outputs; shared callers and the default return contract remain unchanged. Cutout alone opts out.
2. `finish.ts`: shrink Cutout `BlendSettings` to `blend`; delete Mirror, fill choice, mosaic, preset/vignette/tint/scale/pan transform glue; keep the coordinate/Clamp/clip/crop adapter and canonical compositor.
3. `composite.ts`: keep shared Clamp/Tile and callers; add bounded SVG image timeout/cancellation cleanup through one optional generic cancellation callback.
4. `flow.ts` + `page.tsx`: Preview becomes ready only after a current full bake settles; Save uses the same full-mode canvas; pending/failure stays in editing with visible status. Delete checkerboard fallback instead of adding a substitute.
5. `ui-config.ts` + tests/oracle: delete dormant Cutout ranges; activate the existing Increment-4 deletion case; add targeted shared-loading and exact Preview/Save pixel/dimension proof.

Necessity — no unnecessary elements; every element either deletes a named dormant path or closes a measured output/readiness/settlement defect while preserving the existing owners.

Sufficiency — the minimal diff covers every Increment-4 change/proof clause; shared Tile/Creator/Grid/3D behavior remains in the default path and KAI-10220 is excluded.

## Truthful-output browser proof

- Fixed 1280x720 Chromium Preview and Save are exact: 1330x621 RGBA, SHA-256 `f852cabd19d2ea1f71ca9876cf6a72f14f6df21a85791c7cbba7f89c94e60b83`, 94,842 transparent and 727,814 opaque pixels.
- Fixed 1280x720 WebKit witnesses that visible Preview and Save use the same 1329x622 canvas object; the WebKit-produced Save decodes to RGBA SHA-256 `e1af79e66882e2adf4c85a265580e7819a7d23ad803da26028db59c65d49dc54`, with 94,642 transparent and 728,256 opaque pixels.
- Chromium additionally proves visible SVG rejection preserves the existing display instead of publishing substitute pixels, and replacement cancels a hanging Preview without stale output. Both journeys report zero console errors or warnings.
- WebKit scratch/direct readback and `toBlob` can expose an invalid 1024x1024 opaque backing store. The final oracle proves Preview/Save source-canvas identity and matching visible/source/download dimensions in WebKit, then decodes the WebKit-produced PNG through Chromium; the harness failures are recorded in `ERRORS.md`.

## Completion audit

- Source audit maps every live Linear/contract Increment-4 clause to current code: Cutout-only measured preparation skip; one retained adapter around one canonical compositor; Clamp-only Cutout with shared Tile preserved; removed dormant output glue; bounded neutral bypass; full-mode Preview/Save readiness; visible failures; SVG timeout/cancellation/URL settlement.
- Final gates pass: 531 tests with one expected KAI-10220 failure and 10 unrelated skips; TypeScript; scoped ESLint; full ESLint with zero errors and 404 pre-existing/generated warnings; diff hygiene; production build; preservation, detector, flow, and output browser oracles.
- Current work screen provenance: port 3217 PID 67612 serves this exact worktree on branch `session62-task/KAI-10219-output-adapter-truthful-output` from base `0b747d81…`. Visual evidence shows the capped transparent Preview/status (`KAI-10219-current-output.png`, SHA `566b59a3…`) and the Clamp-only Blend surface with no Mirror/fill controls (`KAI-10219-current-controls.png`, SHA `89eac119…`).
- Necessity: no unnecessary product elements; the proof-only oracle is the sole new script and the product delta deletes more Cutout adapter glue than it adds.
- Sufficiency: delivers Increment 4 in full; KAI-10220, Cutline, natural-resolution Save, route relocation, shared compositor policy migration, and protected-branch work remain untouched.
