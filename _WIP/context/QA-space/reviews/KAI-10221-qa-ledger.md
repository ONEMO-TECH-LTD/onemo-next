# KAI-10221 independent QA ledger

## Intake — 2026-08-11

- Exact local/upstream snapshot: `97ddfb39c222f978301c0de3dc9f92e5b6076474`; branch `session62-task/KAI-10221-portable-package`.
- Corrected canonical contract is 177 lines, SHA-256 `c63f70e86597e7be93b6e042be4c7fa6df86356f36a9777b100ff0968ef66742`; live Linear matches it and KAI-10221 is In QA review.
- Owner correction: package Cutout and publish the deterministic VShape/Contour/artwork/mask/regeneration boundary now; no legacy Grid import, speculative replacement-Grid API, sizing/rung/magnet policy, adapter or compatibility claim.
- Branch was replayed from common baseline `5c32124b` rather than descending the prior cleared SHA, but its KAI-10284 replay head `3bfcb492…` has the exact same tree as cleared `89e23e24…`; no cleared product state was lost.
- Exact closure delta from that tree: 18 tracked files, `+1660/-1038`, including owner moves, thin route/mount split, result contract, generated closure/verifier, tests and stale architecture deletion. QA will full-read contract, every changed file/diff and import/asset ownership before static/browser/current-runtime/device verdict. No QA product edit.

## Source and necessity audit

- Full-read all 18 changed files plus the deleted 359-line stale architecture file and the 82-line Builder ledger. The product package is one cutover, not a parallel copy: the dev route now contains only `page.tsx` and `CutoutLabMount.tsx`; six studio owners moved to `src/components/cutout-studio`, history moved byte-exact to `src/lib/cutout-studio`, and no product source imports the old dev route.
- One definition remains for each required owner: flow, HistoryStack, FIFO, scheduler, canonical compositor, Cutout adapter, detector, GrabCut provider and result builder. Other hits are callers, tests or the generated ownership record, not duplicate owners.
- Route-only query parsing, eruda, calibration UI and `localStorage` diagnostics are absent from all 40 closure files. The excluded mount injects only the temporary diagnostic/calibration surface. The closure contains no legacy Grid import, replacement-Grid API, size/rung/magnet policy or compatibility claim; generic CSS grid and contour sampling comments are unrelated.
- `buildCutoutResult` is headless and calls the existing geometry-truth owners for the exact cloned `VShape`, vector hash and `Contour`; the flow action adds on-demand artwork/mask hashing, working-mask scale and versioned current recipe inputs. No second contour or Grid adapter exists. Focused result/adoption tests: 22/22 pass.
- The target `onemo-effects-engine` repo was inspected read-only. It is a clean scaffold with `src/lib/grid` and `src/lib/image-pipeline` placeholders but no frozen Cutout or replacement-Grid interface. Same-path destination records are therefore concrete lift destinations without prematurely inventing an adapter.
- The generated record resolves the tracked recursive import closure, required ORT/model assets, installed dependency versions/license metadata, tests, fixture, public API, owner map and same-path destinations. `paperjs-round-corners` is explicitly `UNKNOWN` because its installed package contains no license field or license file; the record does not fabricate one.
- Necessity: no unnecessary product element. Each addition is required by the corrected closure contract: exact owner moves, one result boundary, one generated record/generator and replacement of the stale verifier/architecture. The dev mount remains only because the still-open phone gate needs its route diagnostic sink.
- Sufficiency: source and desktop/runtime implementation deliver the corrected portable-package directive in full. Final sprint sufficiency remains blocked only by the explicitly required physical-iPhone Low Power off/on observation.

## Independent gates

- Exact local/upstream head: `97ddfb39c222f978301c0de3dc9f92e5b6076474`; tracked tree remained clean.
- Full serialized Vitest: 59 pass + 1 declared skip files; 541 pass + 10 declared skip tests. Typecheck, scoped lint and `git diff --check` pass.
- Exact-head production build passes and statically emits `/cutout-lab`.
- Post-build closure regeneration is byte-identical: SHA-256 `2dfcb9510ba6cad9d1b1e7b053d4469bd8f50d49da0d4b7987c5961580cf2aa7`; 40 files / 337,511 source bytes; recorded emitted totals reproduce exactly.
- Independent production server PID 90511 on port 4012 serves this worktree and exact head. Preservation, detector, FIFO/flow, output and GrabCut oracles all pass in their declared Chromium/WebKit coverage.
- QA current-surface observation: Upload → primary u2netp Detect completed with `Status: ✨ done (cut: u2netp)`, Save/Preview enabled, route admin calibration intact and zero console warnings/errors. Evidence `_WIP/context/QA-space/evidence/KAI-10221-current-detect-qa.png`, SHA-256 `9bb993245d8a98508af40099b258bf38bfb2e3c8586e4d0246b4b9c4ad6a9a11`.

## Verdict

**HOLD** on exact snapshot `97ddfb39c222f978301c0de3dc9f92e5b6076474`.

- Code/source/runtime: clear; no Builder rework identified.
- External closing evidence still absent: run the exact integrated Upload → Detect → edit/GrabCut/Paint → Preview → Save/replacement/Clear journey on the recorded physical iPhone/Safari/input-output caps with Low Power off and on. Record non-recurrence or the exact retained diagnostic stage. Desktop Chromium/WebKit cannot substitute for this contract gate.
- Keep KAI-10221 In QA review and the route diagnostic sink available. Do not mark Done until that owner-device observation lands. No Meta in Session 62.

## Superseding Paint Autotune intake — 2026-08-11

- Exact local/upstream snapshot: `e3d713c3b3530f01e7b5702158ed4f0da2c45f24`; six-file bounded delta from the prior QA-held `97ddfb39…`, `+133/-21`.
- Owner evidence on live KAI-10221 resolves the prior device HOLD: Dan reports the full physical-iPhone Low Power off/on journey works. New closing defect and directive: Paint centre-line wobble must be removed before shape generation; 0 preserves raw gesture, near-straight becomes straight, intentional curves remain averaged continuous, strength is independent, brush diameter controls thickness only, Mask smoothing remains separate, and AI/GrabCut vector state remains independent/reset.
- QA scope: full-read the six changed files/diff and immediate owners/callers; independently prove zero-strength fidelity, extent-relative autotune behavior, deliberate-curve retention, brush independence, UI separation, runtime output, closure regeneration, accumulated package invariants, static/build/browser gates, necessity and sufficiency. No QA product edit.

## Superseding source/runtime audit

- Product correction is bounded to the existing `mask-tools` owner: one `autoTuneStrength` field/default, one pure centre-line normalizer, tuned swath rasterization with continuous quadratic joins, one route-only admin row and focused proof. No second Paint path, framework, Grid edge or package-boundary change.
- `autoTunePaintStroke` clamps 0..1, removes only repeated consecutive samples before the off return, preserves endpoints, filters without a brush input, scales RDP tolerance by gesture extent, collapses the tested micro-jittered line to its endpoints at 1 and retains multiple points for the tested quarter-circle. `swathMask` uses brush only for `lineWidth`; existing completed-mask smoothing remains downstream and separate.
- Flow/history carry the full Paint config; live recalculation uses the same stored pre-stroke source. AI/GrabCut vector ownership and reset behavior are unchanged. Result regeneration inputs now record Autotune under the still-unreleased `cutout-inputs/v1` boundary.
- Focused 7/7 and full serialized 543 pass + 10 declared skip tests pass. Typecheck, scoped lint, diff hygiene and production build pass. Post-build closure regeneration is byte-exact at SHA-256 `df1cc45cd03c21dc9bb0ea7969de36c6ccca82291cfe8a477f6da129a3d12e03`.
- Exact-current production server PID 66191 on port 4013 serves this worktree at `e3d713c3…`. Preservation, detector, flow and output oracles pass. The independent flow journey measures the identical Paint gesture at 39 visible outline nodes with Autotune 0 and 6 with Autotune 100, with no console problems. QA visual `_WIP/context/QA-space/evidence/KAI-10221-autotune-flow-qa.png`, SHA-256 `4fa2eeb3722fd5d90996797b2c5e2e5bc5f28aa3882b4d7cf0909492c175440e`, shows the tuned continuous line, 100% Autotune and distinct 0% Mask smoothing.

## Superseding verdict

**REVISE** exact snapshot `e3d713c3b3530f01e7b5702158ed4f0da2c45f24` — proof-only; no product rework.

- The mandatory Chromium/WebKit GrabCut/Paint oracle fails before exercising the route because `scripts/verify-cutout-v1-grabcut.mjs:346` still queries the removed accessible name `Paint smoothing`; the route now exposes `Paint mask smoothing` and the new `Paint autotune` slider. This is the only stale live consumer found.
- Smallest exact correction: in that existing oracle, rename the smoothing locator to `Paint mask smoothing`, add the `Paint autotune` locator/default `100`, and include its `0..100` range in the existing Paint calibration assertion. Rerun that oracle in Chromium and WebKit plus the already-green focused/static/build gates. No product source, new test file or new phase.
- Necessity: no unnecessary product elements; shrink nothing.
- Sufficiency: partial only because the full declared browser proof cannot complete against the renamed/expanded admin surface. Product behavior and accumulated closure otherwise satisfy the directive.

## Owner supersession while verdict delivery was pending

- Dan directly superseded `e3d713c3…` on the physical iPhone: all edit/Paint/Preview/Save rendering must use the already-validated original-resolution source; the display-resolution edit bake is stale policy. He also reports the current Autotune and Mask smoothing do not fix the visible Paint result.
- Therefore the preceding proof-only REVISE is historical evidence, not the active verdict. KAI-10221 remains Building; QA stops on `e3d713c3…` and awaits one new exact pushed snapshot implementing the owner correction.
- Carry forward one proof requirement: the next snapshot's GrabCut/Paint oracle must use the current `Paint mask smoothing` accessible name and cover the then-current Autotune/smoothing controls. No QA product edit.

## Original-resolution / Paint-controls superseding intake — 2026-08-11

- Exact local/upstream snapshot: `e8cf49b9d3c0f7719c84bda7bfe84c2756e396eb`; 12-file delta from superseded `e3d713c3…`, `+103/-206`.
- Accumulated owner correction under review: delete the capped/display result path and make original upload pixels drive live result, Paint, Preview, Save and result export; Paint exposes only Autotune `0..300%` and Mask smoothing `0..100%`; existing brush size alone owns thickness; loop-close is fixed `0.35`; cap/join fixed round; shared Vector controls remain visible/active in Paint with an independent `0/0/15/0/0` default; AI/GrabCut recipes restore separately.
- QA will full-read all 12 changed files and immediate callers, prove the deletion cutover/residue, reproduce generated closure, static/build/browser gates and an exact-current visual interaction. Physical-device sufficiency will be classified from current owner evidence rather than inherited Builder evidence. No QA product edit.

## Original-resolution / Paint-controls independent QA

- Full-read all 12 changed files and their diff. The replacement is subtractive: the display/capped prepare owner, toggle, state/actions, cache and result enum branch are deleted; tracked-source residue is limited to the oracle assertion that the removed toggle stays absent. All live, awaited Preview, Save and result-export paths use the one original-upload prepared owner.
- Paint-specific surface is exactly Autotune `0..300%` and Mask smoothing `0..100%`; Swath and Loop-close UI are gone. Brush size is the sole Paint/GrabCut diameter owner, raster cap/join remain round, and loop-close is fixed at `0.35`. Paint source activation selects the existing independent `Detail 0 / Offset 0 / Simplify 15 / Smooth 0 / Radius 0` Vector recipe; accepted Detect/GrabCut restores its separately retained Cutout recipe.
- The 1024px mask remains the declared edit geometry proxy, while original 2048px artwork drives the composed live result, Preview, Save and output identity. This matches Dan's exact correction: remove the temporary display-resolution baked source; it does not invent a second full-size mask owner.
- Focused 8/8 and full serialized `544 pass / 10 declared skip` tests pass. Typecheck, changed-file lint, diff hygiene and a fresh production build pass. Generated 40-file closure reproduces byte-exact at SHA-256 `65bb24123232d49f270d662fad87b90e05175a1c6acf4df2003ec4e53908f665`.
- QA production server PID `55407` on port `4014` serves this exact worktree/head. Preservation, detector, flow and output oracles pass there; the Chromium/WebKit GrabCut oracle also passes independently, proving the provider/raw masks, two Paint controls, shared Paint vector recipe, recipe restoration and absent lossy toggle. Output Preview/Save agree at original-source geometry.
- QA visual `_WIP/context/QA-space/evidence/KAI-10221-e8cf-current-qa.png`, SHA-256 `1ffa98cc0be6a1c46db587b26c7c27588bcddcc01c24b6fb2d2a93e7451e3d6a`, shows the exact-current original `2048×2048` source, only Autotune/Mask smoothing rows, and a clean accepted Paint result. The independently produced Paint calibration visual `output/playwright/KAI-10284-shape-relative-paint-smoothing.png`, SHA-256 `f79b1eb10913ed0052b37c4813396a1fb930cf91048d3dab3df0a15ddb7586f2`, shows brush size plus the shared Vector controls in Paint and visible recalculation at the full calibration extremes.

## Final verdict

**QA CLEAR** exact snapshot `e8cf49b9d3c0f7719c84bda7bfe84c2756e396eb`.

- Necessity: no unnecessary elements. The patch deletes the redundant resolution, width and Paint-outline ownership and reuses the existing Vector path.
- Sufficiency: delivers the accumulated KAI-10221 directive in full. The prior physical-iPhone Low Power journey passed; Dan separately established that the original-resolution source is validated and that existing Vector Simplify fixes the phone-visible Paint segmentation. This exact source/runtime implements those ruled mechanisms without a second fitter or lossy path.
- Session 62 closes on QA; no Meta gate.
