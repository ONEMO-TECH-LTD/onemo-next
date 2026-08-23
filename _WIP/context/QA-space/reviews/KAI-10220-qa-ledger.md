# KAI-10220 independent QA ledger

## Authority

- Active snapshot: `16a7c02c6f1f2b3dd2a02141f97b033dd22a0a75`; superseded QA-cleared parent: `fee76892b7661cfd3da095c29aa79d3f232b052d`; prior shared-edge HOLD parent: `20c45436f86e34106d329fa295dc054a934d5ad5`; failed physical-device parent: `53e34a3562a57d394108bd61057a89e40a039872`; Meta-cleared Increment-4 parent: `5db841832c3adc35e0f1ffd85efe5d2add4bcefd`.
- Local and upstream branch heads match the active snapshot.
- Contract: 177 lines, SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 5.
- Final owner calibration rule: u2net and GrabCut may differ only in initial mask production; both use one post-`MLResult` edge/contour/matte/compose path with release default `8`. Blend blur remains `0` unless the user moves it. Paint admin ranges are swath `0..12x`, smoothing `0..100%` with true zero-off, and loop-close `0..1`; slider changes must visibly replay only the latest accepted Paint add/erase from its exact pre-stroke mask, debounce and generation-invalidate stale work, and replace the current history entry without adding Undo.
- KAI-10221 remains Backlog and blocked by KAI-10220.

## Atomic deliverables

1. Return scratch+erase before OpenCV loading and every Mat allocation.
2. Freeze raw standalone/refine/add/erase/no-change/never-destroy GrabCut behavior and current interaction.
3. Compare installed official OpenCV 5.0.0 with one reproducible same-version official core+imgproc candidate across bytes, memory, latency, responsiveness, stability, and device behavior.
4. Ship exactly one mask-identical provider; retain no losing probe/provider or unjustified worker.
5. Route u2net and GrabCut through one post-`MLResult` edge/contour/matte/compose owner controlled by one existing-admin 0..12 value.
6. Prove raw input/history/refinement/provider preservation, continuous-alpha output, shared ownership, desktop/WebKit/runtime/output quality, and static/build gates.
7. Prove standalone/refine quality and practical timing on physical iPhone; no emulation substitute.
8. No KAI-10221 build-ahead.

## First snapshot review — `53e34a…`

- Full-read the contract, Builder ledger, complete product/proof diff, GrabCut provider, detector owners, 798-line flow, 296-line finish owner, 293-line mask owner, and direct consumers.
- Scratch+erase moved before `loadCv()`, canvas creation, and every Mat. Raw GrabCut remained 512-cap, three iterations, corridor-bounded, and nearest-neighbour-expanded; history/refinement kept raw data.
- Official OpenCV 5.0.0 core+imgproc candidate measured 370,122 gzip bytes but blocked the first real GrabCut beyond 120 seconds. It was deleted. The installed `@techstark/opencv-js@5.0.0-release.1` remained the sole provider; no worker shipped.
- Independent 532-test, typecheck, build, lint, five-oracle Chromium/WebKit, exact provider/mask, local visual, and Vercel provenance gates passed.
- QA issued HOLD because physical-iPhone standalone/refine edge quality and timing were missing; durable historical verdict SHA `920f8c44…`.

## Physical-iPhone failure — `53e34a…`

- Dan tested the exact Vercel snapshot. Zoomed GrabCut edges remained choppy with no visible fade/blend. The open device gate failed and KAI-10220 returned to Building.
- The radius-3 branch smoothed then re-thresholded a binary mask, so it could not produce the required continuous-alpha fade.
- Bounded correction: replace the failed GrabCut-only branch with the actual u2net matte seam while preserving raw masks/provider/history/refinement and excluding new framework/UI/KAI-10221 work.

## Superseding owner correction

- Dan superseded the interim GrabCut-only calibration wording. The final architecture must have one shared post-`MLResult` finish and one existing-admin value for both u2net and GrabCut.
- The shared finish may intentionally change completed u2net output; raw detector/GrabCut truth remains unchanged.
- Increment 6 owns locking the chosen release default and removing the route-only calibration control from the portable closure.

## Superseding snapshot intake — `20c45436…`

- Active diff from the failed parent: nine files, +234/−70. Contract bytes remain exact. Live Linear records the same accumulated directive, deployment, and phone residual.
- Full-read all changed files: `ERRORS.md`; 269-line GrabCut oracle; `finish.ts`; all 836 lines of `flow.ts`; all 464 lines of `page.tsx`; `segment-ml.ts`; `mask.ts`; `prepare-effect.ts`; characterization tests; and direct callers.
- `finish.ts` has one private `prepareCut`. u2net enters through `prepareNative`; GrabCut enters through `prepareAI` after conversion to `MLResult`; both call the same `finishMLResultEdges` and `prepareEffect` path with the same value.
- `finishMLResultEdges` copies completed texture alpha without mutating raw mask, texture mask, source texture, provider, history, or refinement input.
- `mask.ts` owns one private box filter. Continuous matte alpha and thresholded binary contour are two projections of that filter/value, not competing smoothers.
- The one slider is route-gated by `?admin=1`, clamps to integer 0..12, and calls only `setEdgeFinishPx`. Actual u2net preseg and GrabCut raw masks both recalibrate through the same `prepareCut`; standalone and refine share `acceptMask`.
- GrabCut provider, detector chain/worker, v531 adapter, and history owner are byte-unchanged. No KAI-10221 file changed.
- `EFFECT_BUILD_CONFIG` and `payload.ts` are byte-identical to the failed parent. `edgeFinishPx` is optional and absent from the global object; non-Cutout callers keep the prior radius-3 behavior and serialized config hash.
- The task-linked `ERRORS.md` entry records two browser-golden mismatches caused by the intentional output change and their separate refresh. No unrelated cleanup was found.

## Superseding independent gates — `20c45436…`

- Two default-parallel full Vitest attempts each reached 532 pass/10 skip but timed out the unchanged exhaustive `grid-sources` case at the fixed 5s ceiling (5.15s and 5.71s). The file passed 6/6 alone in 2.25s; the full serialized suite then passed twice with 533 pass/10 skip. The timeout is recorded rather than hidden.
- Typecheck, changed-scope zero-warning lint, full lint with zero errors/404 pre-existing warnings, production build, and `git diff --check` pass.
- A fresh production server on port 3219 was proven to serve this worktree and active commit. Preservation, detector, flow, output, and shared-edge/GrabCut oracles pass in Chromium/WebKit.
- Exact raw standalone/refine-add/refine-erase/repeat GrabCut hashes remain frozen. The shared finish does not mutate its inputs, produces nonzero continuous alpha for both source types, and loads one OpenCV provider. The oracle's labelled u2net unit witness is synthetic; source topology plus the actual u2net route below close that wiring gap.
- Own headed observation exercised actual u2net Detect 3→7, standalone GrabCut 3→7, and GrabCut Add refinement at 7. Each used the one control/status with zero console warnings/errors. Evidence hashes: u2net 3 `7658d316…`; u2net 7 `f723868b…`; GrabCut 3 `1451bcb1…`; GrabCut 7 `db431be8…`; refine 7 `24cccf39…` under `KAI-10220-20c45436-evidence/`.
- Vercel deployment `dpl_EqXUHZNutyLg5BqgNkpPtXBo3tzm` independently resolves to branch `session62-task/KAI-10220-opencv-provider`, commit `20c4543`, successful compile/TypeScript/22-page build, deployment completion, and Ready. Authenticated CLI fetch returns the real `/cutout-lab?admin=1` page and shared-edge client chunk.

## Active disposition

- No product-source REVISE is justified. The minimal shared-owner correction is present without global config drift, duplicate smoothing/provider/framework ownership, or downstream build-ahead.
- QA remains HOLD because Dan's exact physical-iPhone 3/5/7 standalone/refine quality and practical-timing result is outstanding. Desktop/WebKit cannot substitute.
- If one phone value passes, QA can issue CLEAR without Builder rework. If all fail, the device result must define the smallest exact revision.
- Necessity — no unnecessary product elements.
- Sufficiency — partial only because physical-iPhone calibration/acceptance is outstanding.
- Durable active verdict: `KAI-10220-20c45436-qa-verdict.md`, SHA-256 `f248842212ba7a343327a35953b7cfca4edd9c1599a083837da562c7daa3c456`.

## Owner-locked calibration snapshot intake — `fee76892…`

- Local and upstream branch heads match `fee76892b7661cfd3da095c29aa79d3f232b052d`; tracked product tree is clean and the authoritative contract remains 177 lines at SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`.
- Superseding delta from `20c45436…`: nine files, +204/−87. The review is bounded to the locked shared-edge default, Blend-zero behavior, Paint calibration/replay/history semantics, preservation of the already-cleared provider/raw/shared-finish closure, and absence of KAI-10221 build-ahead.
- Live Linear records the accumulated owner directive and is `In QA review`; KAI-10221 remains Backlog and blocked by KAI-10220.

## Source and necessity audit — `fee76892…`

- Full-read all nine changed files (2,806 lines) and the complete delta. `EDGE_FINISH_DEFAULT` is exactly `8`; the one shared `prepareCut` owner remains unchanged apart from that default. Package/lockfile, OpenCV provider, GrabCut algorithm, shared edge filter, preparation owner, global payload/config surface, detector, raw masks and KAI-10221 files are byte-unchanged from `20c45436…`.
- The implicit outgrowth transition that mutated Blend from zero to an engine default is deleted. The necessary outgrown Clamp/composition path remains; the applied Blend value stays the user's explicit value and matteless degradation remains guarded.
- Paint exposes only the requested three existing-admin controls. Source bounds are swath `0..12x`, smoothing `0..100%`, loop-close `0..1`; smoothing zero returns an unfiltered copied binary mask and swath zero draws no line/dot while loop-close remains its independent fill control.
- One `PaintCalibrationSource` records the exact artwork generation, cloned pre-stroke mask, stroke, brush scale and add/erase flag. Each new accepted Paint operation replaces that source; Detect, GrabCut, vector edit, Upload, restore, Clear and unmount invalidate it.
- Slider changes update the existing Paint config, debounce for 120 ms, generation-guard stale work, replay from the recorded pre-stroke mask through the existing Paint/accept path, and call the existing history stack's `replaceCurrent` rather than adding an entry. The snapshot now carries the Paint config so Undo/Redo restores the mask and controls together.
- No second history, provider, smoother, settings framework, panel or downstream closure work was added. The new helper/ref/timer/one stack method are each used directly by the required live-recalculation behavior; no source element is presently unjustified.

## Independent gates and current-runtime observation — `fee76892…`

- Serialized Vitest passes: 57 files plus one declared skipped file; 534 tests pass and 10 are declared skipped. Typecheck, changed-scope zero-warning lint, full lint with zero errors/404 pre-existing warnings, production build, and `git diff --check` pass.
- All five current-build oracles pass against the production server proven to run this worktree at `fee76892…`: preservation, detector, flow/history/FIFO/tools, output, and GrabCut/provider/shared-finish/Paint-calibration in Chromium and WebKit. Exact raw GrabCut masks and one provider remain frozen; upload and scratch+erase stay provider-cold; route first GrabCut loads exactly one provider.
- QA's separate real-route visual journey observed edge default `8`; all three Paint ranges; visible recalculation of the accepted Paint shape at loop-close `1→0.2`, swath `12`, smoothing `0→100`; visible recalculation of a later Paint erase at swath `3` and smoothing `0`; and Blend still `0` after Frame outgrowth. Standalone Paint stayed non-undoable through calibration; the calibrated erase returned to the original Paint result in exactly one Undo and restored in one Redo. Console warnings/errors were zero.
- Captured current-runtime evidence: `KAI-10220-fee76892-evidence/qa-paint-shape-live.png` SHA-256 `cec1b9f6…`; `qa-paint-erase-live.png` `ec4fb8b9…`; `qa-blend-zero-outgrown.png` `aece8ba2…`. The screenshots were independently opened and visually inspected.
- Dan's direct physical-phone observation recorded in the Builder transcript confirms the edge-finish effect is visible and explicitly selects `8` as the default. This closes the prior phone-calibration HOLD; QA does not infer a new device gate after the owner-selected release value.
- Vercel logs independently pin deployment `dpl_EuDNun9Fw7vaHht8dFXVU98hUvHV` to branch `session62-task/KAI-10220-opencv-provider`, commit `fee7689`, successful compile/TypeScript/22-page generation, completed deployment and Ready. Authenticated deployment fetch returns the real Cutout page with HTTP 200.

## Final QA disposition — `fee76892…`

- QA CLEAR to Meta. The prior `20c45436…` HOLD is historical and is closed by Dan's physical-phone confirmation that the edge control is visible plus his explicit release-default selection of `8`.
- Necessity — no unnecessary product elements.
- Sufficiency — delivers Increment 5 and the accumulated owner directives in full.
- KAI-10221 remains Backlog and blocked until Meta closes KAI-10220; QA performs no build-ahead.
- Durable verdict: `KAI-10220-fee76892-qa-verdict.md`.

## Post-clear owner correction — Paint swath default

- Dan superseded one product value after the `fee76892…` QA verdict: Paint swath must default to `1x`, not `2x`.
- The `fee76892…` verdict remains historical evidence for that exact snapshot but is no longer the active clearance. KAI-10220 returns to Building for one default-value correction plus proof-witness updates.
- Re-review scope is bounded to the new default, required deterministic witness changes, regression preservation, and exact pushed provenance. KAI-10221 remains blocked; no build-ahead is authorised.

## Superseding scope correction — source-result recipe switching

- The open delta has two linked owner corrections: Paint swath defaults to `1x`; and each newly accepted result selects its existing source-appropriate recipe.
- Accepted Paint shape/erase uses the clean Paint vector recipe. Accepted AI Detect, standalone GrabCut, or GrabCut refinement restores the prior Cutout recipe. Tabs do not mutate recipes; source acceptance is the only switch event.
- Re-review must prove both directions on the same session, preserve Undo/Redo/source history truth, and confirm no second recipe framework or downstream KAI-10221 work. The prior swath-only scope statement is superseded.

## Later UI-shell input excluded from this gate

- Dan's named vector-preset screen is a later UI-shell input. Exact preset names, count and values are not yet locked.
- KAI-10220 QA must not invent or gate on preset details. Snapshot `16a7c02…` remains bounded to Paint swath default `1x` and source-owned Paint versus AI/GrabCut recipes.

## Source and necessity audit — `16a7c02…`

- Local and upstream branch heads exactly match `16a7c02c6f1f2b3dd2a02141f97b033dd22a0a75`; the contract remains 177 lines at SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`.
- Full-read the contract and all six changed files, 2,528 lines total, plus the exact delta from `fee76892…`. Product scope is four existing files; two existing browser oracles carry the proof. No package, provider, detector, shared edge/compositor, new UI/framework, or KAI-10221 file changed.
- `PAINT_DEFAULTS.swathMult` is exactly `1`; Paint rasterization consumes that value. The shell's Paint ink and cursor use the same configured multiplier. Exact contain-fit/WYSIWYG behavior remains a runtime check because the shell converts between image, view-box and CSS coordinates.
- One existing flow owns two stored recipes: Cutout starts at `AUTO_SETTINGS`, Paint at `ZERO_SETTINGS`. `acceptMask` switches only after a successful accepted result. Detect and both standalone/refine GrabCut pass `source: 'cutout'`; Paint shape/erase and live recalculation pass `source: 'paint'`. Tab clicks only change shell tab state.
- `setTune` updates only the active source recipe. Snapshots now carry `outlineSource`; restore republishes that source and its exact settings. No second history/store/recipe framework exists. Runtime still must prove both switch directions and Undo/Redo source truth in one session.

## Independent gates — `16a7c02…`

- Focused characterization passes 19/19. Typecheck, six-file zero-warning lint and `git diff --check` pass.
- First full serialized Vitest run reached 531 pass/10 declared skip but timed out three unchanged tests: two exhaustive Grid laws at their 5-second ceilings and the composite pixel oracle at its 30-second ceiling. No changed file imports either test owner. Isolated reruns are required before disposition; the failures are recorded rather than hidden.
- Both unchanged timeout files pass alone: Grid 46/46 and composite pixel 1/1. A second full serialized run with no concurrent gates passes 57 files/534 tests with 10 declared skips.
- Production build passes: Next 16.2.12 compiles, TypeScript completes and all 22 pages generate. A fresh production server on port 3220 is proven by listener PID/cwd to serve this worktree at exact commit `16a7c02…`.
- All five current-build oracles pass: preservation, detector, flow/history/FIFO/tools, output, and GrabCut/provider/shared-finish/source-recipe. The GrabCut oracle passes in Chromium and WebKit, restores Cutout smooth `37` after accepted Paint smooth `23`, keeps Paint at clean `0`, preserves exact raw masks/output, and loads one provider.
- QA-owned exact-current browser proof confirms swath `1x`; accepted Paint smooth `0`; tab-neutral Cutout smooth `37`; accepted GrabCut restoration to `37`; and history Undo Paint `23` / Redo Cutout `37`, with zero console problems. Three screenshots were opened and inspected under `evidence/KAI-10220-16a7c02/`.
- Blocking source/runtime mismatch: Paint deposition uses image-space scale `img.width / dispWRef`, but the changed ink/cursor use view-box scale `viewBox.w / disp.w`. After Frame outgrowth the real route measured image width `1024`, view width `1987`, deposited internal width `34.91`, rendered width `67.74` (`1.94x`). Swath `0` also deposits nothing while live ink forces a 2-pixel mark.
- Smallest correction is page rendering only plus its existing oracle: use image-space scale for Paint ink/cursor, suppress Paint ink at zero, preserve the AI cursor and every other cleared path. No new abstraction/UI/preset/provider/task.
- Necessity — six-file shape otherwise has no unnecessary product element. Sufficiency — partial only because the changed Paint ink/cursor witness is not truthful after view outgrowth or at zero. Verdict: REVISE; KAI-10221 remains blocked.

## Superseding owner correction — Cutout Offset pixel parity

- Snapshot `16a7c02…` and its QA REVISE are historical. Dan now requires Cutout Offset semantics to be pixel-parity: `1` means `1` working-canvas pixel.
- Every already-calibrated preset and the current default must preserve its visible/effective result automatically; Dan must not recalculate values.
- Builder is probing the smallest Cutout-only migration. Grid and Creator semantics must remain unchanged. QA is stopped until one superseding pushed snapshot arrives; KAI-10221 remains blocked.

## Independent QA intake — `9ca0a27…`

- Pinned exact local/upstream snapshot `9ca0a27deb8c36144b5ef5fd68fc3a5c51096cd3`, parent `16a7c02…`, against contract `367e2d27…` and source owner statements in Builder transcript segments 21–23.
- Active deliverables: direct working-canvas pixels for Detail/Offset/Simplify/Radius; Smooth unchanged at `0..200` strength; shape-identical migration of the six supplied calibration rows and current default; Grid/Creator legacy semantics unchanged; prior Paint WYSIWYG correction; Paint smoothing `0..100%`, cap and join choices through the real mask/live ink; one-point Paint preserved; every accepted/replayed Paint result resets visible Vector controls to zero while AI/GrabCut recipe remains separately restorable.
- Ten tracked files changed, `+305/-78`; KAI-10221 remains untouched and blocked. QA will full-read the changed source, trace shared callers, run independent static/browser/current-build gates, then return CLEAR or the smallest source-proven REVISE.

## Source/owner audit — `9ca0a27…`

- Full-read the 177-line contract, all ten changed files (3,147 source/script lines), and the immediate shared Grid/Creator/vector callers (1,134 lines), plus the exact diff. Owner wording is pinned from Builder transcript segments 21–23; the earlier smart-gesture-normalizer discussion was research, not an implementation order, so it is not invented as this gate.
- Cutout recipe migration is source-backed: legacy Detail/Offset/Simplify/Radius are converted once against the accepted prepared source, Smooth stays numeric-identical, then Cutout resolves with direct-pixel spatial units. The six supplied rows are preservation fixtures, not a prematurely built preset UI. The current product default also migrates through the same owner.
- Shared semantics are protected structurally: existing Grid/Creator settings omit the new unit marker and therefore stay on the legacy scale-relative path; only Cutout writes `spatialUnit: 'px'`. Vector-edit callers likewise keep `GLOBAL_OFF` without the marker.
- Paint cap/join extend the existing `PaintConfig`, the same Canvas swath rasterizer, and the existing admin panel. Live ink uses the same cap/join and corrected image-space width; zero swath renders neither ink nor cursor. One-point Paint remains a circular deposit by explicit existing-product rule.
- Every accepted or recalculated Paint mask invokes the existing accepted-result owner with `resetPaint`, zeroing the visible Paint recipe; the Cutout recipe is saved separately and restored only by an accepted Detect/GrabCut result. No second recipe store, mask pipeline, UI framework, dependency, provider, or KAI-10221 work exists.
- Open proof questions, not findings yet: exact shape preservation across the real 1024px source/current default and all six rows; one-pixel visible Offset parity; cap/join and zero-swath behavior on the current route; full regression/static gates.

## Superseding owner correction — output-resolution comparison

- Snapshot `9ca0a27deb8c36144b5ef5fd68fc3a5c51096cd3` and its unfinished QA are historical; QA issued no verdict.
- KAI-10220 now requires one admin-only toggle comparing current capped 1536px Preview/Save with original-upload-resolution Preview/Save.
- The 1024px editor/mask proxy and the exact edit/effect recipe remain unchanged; only final output resolution switches.
- Builder will return one pushed replacement snapshot. QA stops the current gates. KAI-10221 remains blocked.

## Independent QA intake — `8d85eaf…`

- Pinned exact local/upstream snapshot `8d85eaf8c038f914cdb062117fd4fa1130e3ecc9`, parent `9ca0a27…`, against contract `367e2d27…` plus Dan's live comparison directive recovered from Builder transcript segments 24–25 and live Linear.
- Bounded deliverable: one existing-admin toggle between the unchanged capped 1536px final Preview/Save and original-upload-resolution final Preview/Save. The 1024px editor/mask proxy, accepted recipe/history/compositor, and capped default must remain unchanged. Report real source dimensions and preparation time; switch-back must reproduce exact capped bytes.
- This is a phone measurement seam, not manufacturing closure. Physical-iPhone capped/original quality, time, and stability remains the owner/device gate. KAI-10221 stays blocked; QA makes no product edits.

## Source/necessity audit — `8d85eaf…`

- Full-read all six changed files (2,870 lines), the exact `9ca0a27…8d85eaf` diff, and immediate shared `prepareEffect` callers/tests. The delta is `+139/-39`; no dependency, package, relocation, provider, history, compositor, Grid/Creator, or KAI-10221 file changed.
- The sole shared-engine extension is optional `originalTexture`; omitted callers retain `effectiveTextureDim()`. Only Cutout's existing `prepareCut` passes it, so the default Creator/Grid-facing engine behavior remains capped and unchanged.
- Original mode re-decodes the same object URL at uploaded dimensions, reuses the accepted native preseg or current mask, then enters the same edge finish, `prepareEffect`, `finishSpec`, `bakeStickerEngine`, and canonical compositor owners. The 1024px upload/editor canvas and mask are not replaced.
- Toggle commit is validate-before-publish and generation-guarded: failure leaves the prior prepared output installed; success swaps only prepared source/output-mode metrics, re-resolves the existing outline, and schedules the existing bake. It does not mutate settings, blend, mask, shape, recipe source, history stack, or accepted artwork identity.
- The admin panel exposes one checkbox plus actual prepared raster dimensions/time. Default remains capped on a fresh flow. Preview and Save still use the single full-bake scheduler; original mode changes only its prepared source raster. The corrected comments explicitly state that manufacturing replay is not delivered.
- Necessity — no unnecessary elements in the bounded delta. Sufficiency remains pending independent static/current-build/physical-device proof.

## Independent static gates — `8d85eaf…`

- Full serialized Vitest: 57 files passed, 1 declared skipped; 542 tests passed, 10 declared skipped.
- Typecheck passed. Six changed files passed ESLint with `--max-warnings=0`. Exact delta passed `git diff --check`.
- Production build and current-build browser/visual comparison remain next; no source finding requires rework at this point.

## Independent QA verdict — HOLD — `8d85eaf…`

- Production build passed. All five exact-current Cutout oracles passed; capped hashes stayed frozen, native-resolution outputs were larger and frozen, and both engines reproduced exact capped bytes after switch-back.
- QA-owned current-route proof served exact commit `8d85eaf…` on port 3228. u2netp Detect succeeded; editor canvas stayed `1024×1024`; prepared source switched `1536×1536 → 2048×2048 → 1536×1536 → 2048×2048`; history stayed `2`; original Preview rendered with zero console problems.
- No source rework is justified. Physical-iPhone capped/original quality, time, Save completion and repeat stability/crash behavior remains mandatory and cannot be replaced by desktop/WebKit.
- Necessity — no unnecessary elements. Sufficiency — partial only for the physical-iPhone comparison. KAI-10220 remains In QA review; KAI-10221 remains blocked.
- Durable verdict: `KAI-10220-8d85eaf-qa-verdict.md`.

## Superseded by owner-authorised vector presets — `8d85eaf…`

- The `8d85eaf…` HOLD is historical evidence for that exact snapshot only and is withdrawn from current authority. QA stops; there is no current KAI-10220 verdict.
- Dan authorised named vector presets. Builder will recover the exact final ZERO, PURE, and current preset names/values from Dan's CSV plus transcript, then add only the smallest selector/table through the existing vector recipe owner.
- Preserve the cleared output-resolution comparison. Add no second recipe framework and no KAI-10221 work.
- KAI-10220 returns to Building. KAI-10221 remains blocked pending one superseding pushed snapshot and fresh QA.

## Independent QA intake — `a7d36e1…`

- Pinned exact local/upstream snapshot `a7d36e1bb4b14a3c29ac160e85ac242d09f394aa`, parent `8d85eaf…`, authoritative contract `367e2d27…`, live KAI-10220, Dan's CSV, and the exact Builder transcript owner statements that supersede the CSV's original PURE row.
- Active named-preset deliverable: normal UI exposes exactly ZERO, PURE, CLASSIC, TECHNO, EDGY, FLUID, SPACE; ZERO is all-off/default; PURE is direct Offset `1px`; the five retained CSV recipes convert through the existing Cutout legacy-to-pixel seam; raw tuning is admin-only and becomes CUSTOM; Paint resets to ZERO; accepted Detect/GrabCut restores Cutout recipe and label; history restores settings plus label.
- The already-audited capped/original output comparison remains required and must not become a second output/compositor/history path. No new recipe framework, provider, UI redesign, KAI-10221 work, or shared Grid/Creator semantic change is authorised.
- Exact delta is seven tracked files, `+172/-55`; local and upstream heads match. QA owns source/diff necessity+sufficiency, static gates, current-tree Chromium/WebKit runtime, and its own visual observation. No QA product edits.

## Source and necessity audit — `a7d36e1…`

- Full-read the exact seven-file delta and all seven complete changed files (3,045 lines), then traced the existing prepared-source, outline-source, history, output and route owners. The preset change adds one literal table plus one resolver over the existing `TraceOutlineSettings`; there is no second recipe store/framework, dependency, output path, provider, shared Grid/Creator edit, or KAI-10221 build-ahead.
- Source authority matches exactly: ZERO is direct-pixel all-off; PURE is direct Offset `1`; CLASSIC/TECHNO/EDGY/FLUID/SPACE retain the CSV values and convert once through the existing accepted-source legacy-to-pixel function. Legacy visible Detail is correctly inverted at the resolver boundary; Smooth remains numeric strength.
- Normal Vector UI exposes only the preset select. Raw vector chips/knob and CUSTOM tuning are admin-only. A raw tune nulls the active label in the existing source-owned recipe ref; the select surfaces CUSTOM without creating a separate preset object.
- Paint and Cutout reuse the existing separate settings refs and now carry matching label refs. Accepted Paint resets its settings and label to ZERO; accepted Detect/GrabCut restores the saved Cutout settings and label. History snapshots store the label beside the settings and restore them atomically through the existing restore owner.
- The capped/original toggle and its one prepared-source seam are unchanged by product code in this delta. Oracle hash updates are expected because the new all-off ZERO default replaces the prior Cutout auto recipe; both capped and original outputs remain frozen separately and switch-back remains asserted.
- Open proof questions: exact legacy-row conversion on the real prepared source; runtime preset/default/CUSTOM/source/history behavior; capped/original preservation; Chromium/WebKit; static/build gates. No source-proven rework finding yet.

## Independent static gates — `a7d36e1…`

- Full serialized Vitest passes: 57 files passed, one declared skipped; 543 tests passed, 10 declared skipped.
- Typecheck passes. All seven changed files pass scoped ESLint with zero warnings. Exact delta passes `git diff --check`.
- Production build passes: Next 16.2.12 compiles, TypeScript completes, and all 22 pages generate. The existing middleware-deprecation warning is outside this seven-file delta.
- Current-tree browser oracles and QA-owned visual/history proof remain open; no static failure justifies product rework.

## Superseded by owner correction — `a7d36e1…`

- Dan superseded PURE: every visible Vector knob must equal `1`. Snapshot `a7d36e1…` is historical and has no QA verdict.
- QA stopped immediately and will not inspect Builder's live shared diff. KAI-10220 returns to Building; KAI-10221 remains blocked until one superseding pushed snapshot receives fresh QA.
- Historical exact-snapshot evidence only: source/static/five-oracle gates passed, and QA visually observed the public ZERO preset on the exact current runtime. Before supersession, a targeted real-route probe also showed preset selection did not create/update a history state: TECHNO → accepted Paint → Undo restored ZERO, not TECHNO. This is not a current verdict; re-check preset recipe+label history on the superseding snapshot.

## Independent QA intake — `ad6b54cf…`

- Pinned exact local/upstream snapshot `ad6b54cfb2f35edb1c8316ac3a81a5d436681dcd`, parent `a7d36e1…`, authoritative contract `367e2d27…`, live KAI-10220 and the accumulated owner corrections. Linear is In QA review; KAI-10221 remains blocked.
- Active correction: PURE = Detail/Offset/Simplify/Smooth/Radius `1/1/1/1/1`; Detail returns to prior `0..100`, `0 = full` source-relative behavior; Offset/Simplify/Radius are direct pixels at `0..250`, `0..40`, `0..350`; Smooth remains `0..200` strength; CLASSIC–SPACE retain exact geometry.
- Preset selection and raw tuning must update the current accepted history snapshot without creating an Undo step. TECHNO → accepted Paint → Undo must restore TECHNO plus Smooth `20`. The capped/original output comparison and all previously cleared provider/Paint/shared-finish behavior remain required.
- Exact correction delta is eight tracked files, `+63/-27`; local and upstream heads match. QA will full-read all eight files and the exact diff, then run static, five-oracle, current-tree history/range/visual, necessity and sufficiency gates. No QA product edits.

## Source and necessity audit — `ad6b54cf…`

- Full-read the exact eight-file correction diff and all eight current files (3,610 lines), including the complete flow, shell and Chromium/WebKit GrabCut oracle. The delta reuses the existing preset table, settings refs, history stack and route UI; it adds no recipe/history/provider/output framework, dependency, shared Grid/Creator edit or KAI-10221 work.
- PURE is exactly `1/1/1/1/1`. The admin shell exposes Detail `0..100` with `0 = full`, Offset `0..250px`, Simplify `0..40px`, Smooth `0..200` strength and Radius `0..350px`.
- Detail source-relative semantics are coherent: visible `0` keeps the accepted full-fidelity shape; values above zero retrace the raw cutout through the existing source-scale conversion. The retained CLASSIC–SPACE rows still pass through the inverse legacy-detail conversion and direct-pixel migration, preserving their prior geometry.
- Preset selection and raw tuning call the existing `replaceHistory()` only when a cut exists. They replace the current accepted snapshot rather than pushing a new one. The existing history snapshot already stores settings and preset label, and atomic restore reinstates both; the oracle now covers TECHNO → Paint/ZERO → Undo → TECHNO/Smooth 20.
- The capped/original output path and frozen output hashes are unchanged in the correction. No source-proven rework finding remains. Open gates are the serialized static suite/build, all five exact-current browser oracles, and QA-owned current-route range/history/visual proof.

## Independent QA verdict — HOLD — `ad6b54cf…`

- Full serialized Vitest passes: 57 files passed, one declared skipped; 542 tests passed and 10 declared skipped. Typecheck, scoped zero-warning lint, exact diff check and production build pass.
- All five exact-current oracles pass in sequence. The detector chain, flow/FIFO/history/tools, Preview/Save, raw OpenCV masks/provider, shared finish, Paint, named presets and capped/original frozen output witnesses remain clean in Chromium and WebKit.
- QA served exact commit `ad6b54cf…` from the correct worktree on port 3231 and observed Upload → actual u2netp Detect in 2590ms. TECHNO added no Undo step; Paint changed the source recipe to ZERO; Undo restored TECHNO plus Smooth 20. PURE displayed `1` for all five knobs at the required ranges. Canvas remained `1024×1024`; console had zero warnings/errors.
- QA visual: `../evidence/KAI-10220-ad6b54cf/qa-current-pure-all-ones.png`, SHA-256 `ed8e895e94f99db00248bbc9af4deb70d02ec23dea5bb11d970be384ee98585d`.
- No source rework is justified. The accumulated scope still explicitly requires the physical-iPhone capped/original quality, time, Save, repeat-stability and Safari crash observation. Desktop/WebKit cannot substitute.
- Necessity — no unnecessary elements. Sufficiency — partial only for the unrecorded physical-iPhone capped/original comparison. KAI-10220 remains In QA review; KAI-10221 remains blocked.
- Durable verdict: `KAI-10220-ad6b54cf-qa-verdict.md`.

## Superseded owner direction — restore original v1 Vector controls

- Dan superseded the direct-pixel control migration. All five Vector controls return to their original v1 meanings and ranges.
- Snapshot `ad6b54cf…` and its physical-device HOLD are historical only; no current QA verdict or device blocker survives from that snapshot.
- QA stopped immediately without inspecting or testing Builder's live shared diff. KAI-10220 returns to Building; KAI-10221 remains blocked pending one new pushed snapshot and fresh QA.
- No product source was touched by QA.

## Independent QA intake — `23603ff…`

- Pinned exact local/upstream snapshot `23603ff7184f9f03187aedc36a97eba2b8340dd8`, parent `ad6b54cf…`, authoritative contract `367e2d27…`, live KAI-10220 and Dan's latest superseding direction. Linear is In QA review; KAI-10221 remains blocked.
- Active deliverable: restore original pre-pixel v1 control semantics/ranges; implement ZERO plus the six exact CSV recipes in those units; keep preset/raw history truth; make original-upload Preview/Save the default with capped 1536px as the existing admin fallback; remove the superseded pixel-parity and bundled Paint cap/join/width/reset additions; preserve the already-cleared OpenCV/shared-finish behavior; no KAI-10221 work.
- Exact replacement delta is 14 tracked files, `+139/-382`; local and upstream heads match. QA will full-read the complete changed source and exact diff, trace shared callers/residue, run static/build/five-oracle/current-route visual gates, and return CLEAR or the smallest exact REVISE. No QA product edits.

## Source and necessity audit — `23603ff…`

- Full-read the authoritative 177-line contract, exact seven-row CSV, all 14 changed current files, the exact rollback diff, and the live KAI-10220 handoff. Where the older contract's capped-output wording conflicts, Dan's later explicit original-output-default directive governs; all non-conflicting Increment 5 requirements remain live.
- Vector behavior is restored to the pre-pixel v1 owners: original UI ranges are Detail `0..100`, Offset `0..15`, Simplify `0..100`, Smooth `0..200`, Radius `0..100`; `trace-outline-controls` again performs the original source/mm/scale-relative conversions, while the shared resolver has no Cutout-only spatial-unit branch.
- The preset table exactly matches the owner CSV in visible units: ZERO `0/0/0/0/0`; PURE `1/1/1/1/1`; CLASSIC `0/2/15/0/10`; TECHNO `10/3/0/20/2`; EDGY `13/4/0/1/1`; FLUID `0/4/100/0/13`; SPACE `80/15/0/0/5`. The existing UI inversion converts visible Detail once at the preset boundary; preset/raw changes still replace the current history snapshot rather than creating an Undo step.
- Original-upload output is the fresh-flow default. Only Cutout opts into `prepareEffect(... originalTexture)`; omitted shared callers retain the canonical cap. The existing admin checkbox switches the same accepted mask/recipe/compositor to capped `1536`, and Preview/Save still consume the one full-bake owner.
- Whole-tree residue checks find no `spatialUnit`, pixel-default/conversion owner, Cutout pixel-parity marker, Paint cap/join config, width-proof, or reset flag. The remaining fixed round `lineCap`/`lineJoin` are the original Paint raster/ink behavior, not the removed configurable branch; `offset.ts`'s unrelated manufacturing join owner is outside Cutout Paint.
- The delta adds no dependency, provider, output framework, history framework, package/relocation work, or KAI-10221 file. Its net deletion removes superseded branches rather than preserving parallel behavior.
- Necessity — no unnecessary elements in the source change. Sufficiency remains pending independent static/build/browser/current-route proof.

## Superseded owner correction — PURE `0/1/15/0/0`

- Dan corrected PURE for the restored original-control model to Detail `0`, Offset `1`, Simplify `15`, Smooth `0`, Radius `0`.
- Snapshot `23603ff…` and its unfinished QA are historical only. QA issued no verdict and stopped immediately; the completed source/static/browser observations remain exact-snapshot evidence only.
- KAI-10220 returned to Building for one superseding pushed snapshot. KAI-10221 remains blocked; QA made no product edit.

## Independent QA intake — `501a30e1…`

- Pinned exact local/upstream snapshot `501a30e1b15ba4f42d185871e1f9055be6da7452`, parent `23603ff…`; tracked product is clean and only continuity/visual artifacts are untracked. KAI-10220 moved to In QA review; KAI-10221 remains Backlog/blocked.
- Live authority is contract `367e2d27…` plus accumulated owner corrections: Cutout defaults to PURE `0/1/15/0/0`; Paint stays separately ZERO; restored original math exposes Offset `0..25` and Simplify `0..300`; Detail+Simplify must visibly work for Cutout without changing Grid/Creator; original-upload Preview/Save stays default with capped admin fallback; personal saving is KAI-10259 only and absent here.
- Exact delta from the superseded snapshot is 10 tracked files, `+78/-30`; no KAI-10221 or KAI-10259 implementation file appears. QA will full-read all changed current files and exact diff, trace shared callers/residue, run serialized suite/static/build/five-oracle gates, then observe the exact-current route independently. No QA product edits.

## Source and necessity audit — `501a30e1…`

- Full-read the exact 10-file correction and all 10 current changed files. PURE is exactly visible `0/1/15/0/0`; Cutout initializes and restores that recipe while Paint retains its separate ZERO owner. Offset exposes `0..25` and Simplify `0..300`, both through the restored original conversion/math.
- The Detail+Simplify repair is one optional datum carried through the existing trace input/source into the existing fitter. Only `finishSpec` opts in, and only when Cutout visible Detail is non-zero (`settings.detail !== 100` internally); Paint `finishDrawn`, Grid Lab and Creator callers omit it and retain the previous redundant-vertex guard byte-for-byte.
- Every prepared Cutout non-standard adapter supplies `rawTracePx`; the new branch therefore operates on the accepted trace rather than inventing another outline source. Shared Grid/Creator behavior remains untouched in the product diff.
- Original-upload Preview/Save remains the Cutout default and the existing admin switch retains capped `1536` fallback. No personal-preset persistence, KAI-10221 package/relocation work, second fitter, provider, recipe store or history framework appears.
- Whole-scope residue search found no superseded pixel-parity or configurable Paint cap/join implementation. Fixed round Paint ink/raster remains the original behavior; diagnostic localStorage is unchanged and unrelated.
- Necessity — no unnecessary source element identified. Sufficiency remains pending independent static/build/browser/current-route proof.

## Independent static gates — `501a30e1…`

- Focused changed-owner tests pass: 2 files, 24 tests. The full serialized suite exits cleanly; the runner's interactive reporter suppresses its final count in the current harness, so the exact `536/10` count is not inherited as QA evidence.
- Typecheck and exact diff check pass. Scoped lint has zero errors and one warning: the unused `simplifyPaper` import. Exact parent source and blame prove that warning predates this correction at commit `058446bd7`.
- Production build passes: Next 16.2.12 compiles, TypeScript completes and all 22 pages generate. The middleware deprecation warning is repository-wide and outside this correction.
- Remaining gates: five exact-current browser oracles and QA-owned exact-current visual interaction.

## Independent QA verdict — CLEAR — `501a30e1…`

- All five exact-current Cutout oracles pass: preservation, detector degradation, flow/history/tools, truthful output and GrabCut/provider/shared finish/presets in Chromium and WebKit.
- QA served exact commit `501a30e1…` from the correct worktree on port `3233` and observed Upload → actual u2netp Detect in `2044ms`. PURE opened at exact `0/1/15/0/0`; Offset max was `25`; Simplify max was `300`.
- At Detail `70`, Simplify `15 → 300` visibly changed the real fitted outline. Original output defaulted to `2048×2048`; capped switched to `1536×1536`; switching back restored `2048×2048`; Preview reported the same original pixels as Save. Console was zero errors/warnings.
- Visual evidence: `../evidence/KAI-10220-501a30e1/detail70-simplify15.png` SHA `0b2a0666…`; `detail70-simplify300.png` SHA `6cdb9add…`.
- KAI-10220 explicitly makes the earlier physical-device HOLD and gate historical; no current device blocker survives. KAI-10259 personal preset saving is correctly absent.
- Necessity — no unnecessary elements. Sufficiency — delivers the accumulated KAI-10220 owner directive in full. Durable verdict: `KAI-10220-501a30e1-qa-verdict.md`.
