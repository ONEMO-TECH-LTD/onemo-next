# KAI-10220 Builder ledger

## Authority and boundary

- Base snapshot: `5db841832c3adc35e0f1ffd85efe5d2add4bcefd`.
- Branch: `session62-task/KAI-10220-opencv-provider`.
- Contract: authoritative 177-line SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 5.
- Accumulated owner extension: completed GrabCut must reuse one existing final edge-finishing seam to remove visible nearest-neighbour stair-step while preserving raw GrabCut semantics and u2net output.
- Preserve: exact seeds, three iterations, corridor, standalone/refine, add/erase/no-change, never-destroy behavior, current interaction, lazy loading, and exactly one shipped provider.
- Measure before provider choice: emitted/transferred bytes, peak memory, first-stroke latency, main-thread responsiveness, repeat stability, desktop/WebKit, and physical iPhone.
- Exclude: second provider, second smoother, new mask framework, speculative worker, output/UI work, package relocation, or KAI-10221 build-ahead.

## Minimal-diff gate

1. Freeze the installed provider's exact raw masks and current interaction before product edits.
2. Move scratch+erase no-op classification ahead of `loadCv()` and every Mat allocation.
3. Reproduce one same-version official core+imgproc-only candidate only for measurement; delete it unless it is mask-identical and materially better across the required gates.
4. Add one lazy worker only if the selected provider fails caller-thread responsiveness, then re-run every gate; never ship both providers.
5. Trace u2net and GrabCut publication to one existing finishing seam; reuse only that seam for final GrabCut polish, with exact before/after evidence and no u2net change.

Necessity — pending fresh source/caller/probe evidence; no implementation element beyond the five bounded items above is justified.

Sufficiency — pending the full provider measurement, exact raw/final mask proof, responsiveness, desktop/WebKit, and physical-iPhone gates.

## Fresh source and installed-provider baseline

- Current defect is literal: `grabCutRefine()` awaits `loadCv()`, creates the downscaled canvas plus `src`, `rgb`, and `gc` Mats, and only then returns for scratch+erase. Those three Mats bypass the later `finally` and remain unowned.
- Current raw algorithm is 512px max, three iterations, standalone probable-foreground halo, refine base seeding, and a `2.5x`/24px minimum corridor. The 512px labels expand to the 1024px working mask with nearest-neighbour index sampling.
- Flow publishes raw GrabCut through `prepareAI`; `prepareEffect` smooths the mask used for vector tracing, but `buildPreseg` builds the subject matte directly from GrabCut's hard expanded mask. This is why the outline can look smooth while the completed alpha edge still stair-steps. u2net instead supplies its continuous model matte through untouched `preseg`.
- Installed provider provenance: `@techstark/opencv-js` `5.0.0-release.1`, package artifact 13,298,869 bytes, SHA-256 `b873c821…`; its build information reports OpenCV 5.0.0, single-file WASM, C++17, and broad modules including dnn/features/photo/video.
- Current production client chunk containing GrabCut/OpenCV is 26,597,321 emitted bytes and 4,515,010 gzip bytes. The direct provider probe transfers 4,053,350 gzip bytes and reserves 134,217,728 bytes of WASM memory.
- Fixed 1024px fixture raw masks: first standalone area 85,116, SHA `24bbd40c…`; refine-add area 91,633, SHA `626749d2…`; refine-erase preserves the base at area 85,116/SHA `24bbd40c…`. Warm algorithm calls block the caller thread about 0.33–0.64s; provider load adds about 0.20–0.29s and a 75–108ms frame gap.
- Repeating standalone in one warm provider session drifted to area 86,220/SHA `715a7d76…`; this is recorded repeat behavior, not a new repair mandate. A trial reseed reproduced standalone's first mask but changed the existing standalone→refine sequence, so it was removed before snapshot. Raw OpenCV RNG/algorithm behavior remains untouched.
- Official OpenCV 5.0.0 tag `40738fb16ceddb5fb3fea747585f7ce6abb0605b` was built only under Builder probe space. The final whitelist contains no optional core calls and only imgproc `cvtColor`/`grabCut`; Mat/constants remain generated core bindings. One probe-only guard was required around OpenCV's unconditional disabled-`photo` namespace import.

## Provider decision

- Narrow candidate: 1,273,461 emitted bytes, 370,122 gzip bytes, SHA-256 `e45a5a9e173cc5caa04cb9c8edc689b60da6ba8d198e8f459fe03f379dbddf12`; same OpenCV 5.0.0 source, single-file/no-pthreads, C++17, core+imgproc JS binding.
- It returned scratch+erase immediately, then blocked the browser on the first real standalone GrabCut for more than 120 seconds and never produced a mask. The installed provider completes that exact call in about 0.61 seconds. The candidate therefore fails the frozen responsiveness gate by over two orders of magnitude and cannot be evaluated as a mask-identical product replacement.
- The installed provider is retained as the sole product provider. Fresh fixed-fixture evidence reproduces exact raw hashes: standalone `24bbd40c…`, refine-add `626749d2…`, refine-erase `24bbd40c…`, repeat `715a7d76…`; no RNG reseed or provider cutover survives.
- Fresh retained-provider runtime: 4,053,350 gzip transfer, 134,217,728-byte WASM memory, 0.22–0.25s provider load, 84–92ms load gap, 0.61s first standalone, 0.30–0.36s warm refine, and 0.50s repeat. This stays in Dan's explicitly named current practical envelope; the losing narrow candidate is deleted rather than moved behind a worker.

## Product seam and automated proof

- Caller audit caught and removed an overreach before freezing proof: storing the smoothed binary mask would have changed the base geometry consumed by the next refine. The final implementation keeps `Mask.data` as the exact raw GrabCut/history/refine truth and puts only the existing radius-3 result into `Mask.soft` as the completed engine matte. u2net never enters this branch.
- Direct Chromium and WebKit production-module proof reproduce the same four raw masks and repeat behavior byte-for-byte. Radius-3 final soft hashes are `f08d4616…` standalone and `39bebc82…` refine-add; changed area stays bounded to 1,183 and 1,262 pixels respectively.
- New proof-only `verify-cutout-v1-grabcut.mjs` uses the installed Playwright/esbuild stack, no production seam. It proves direct scratch+erase without a provider, retained provider provenance/bytes/WASM memory, exact raw standalone/refine/erase/repeat masks, final polished masks, real-route provider laziness, one provider request on first real GrabCut, practical route timing, and exact Chromium/WebKit Save outputs.
- The existing detector oracle now also proves Upload/Detect make zero OpenCV requests in Chromium and WebKit. Both focused oracles pass on the current tree with no console problems.

## Completion audit before device snapshot

- Full-read every changed product/proof file and the complete 798-line flow after implementation. No dead provider, RNG reseed, duplicate smoother, new worker, alternate mask state, u2net change, or KAI-10221 build-ahead exists.
- Contract mapping: early no-op is before `loadCv()` and every Mat; all retained Mats remain in the existing single `finally`; raw standalone/refine/add/erase/repeat hashes are exact; finished polish uses the existing `smoothMask` seam only through `Mask.soft`; raw `Mask.data` remains the next-refine/history truth; the installed provider is the only shipped provider.
- Final gates on the integrated production build pass: 532 tests, 17 focused characterizations, typecheck, scoped lint with zero warnings, full lint with zero errors (pre-existing warnings remain), production build, preservation, detector, flow, output, and dedicated GrabCut Chromium/WebKit oracles.
- Current production server on port 3217 serves this worktree. Real Playwright fallback observation exercised Upload → scratch Erase → standalone Add → Preview; Save enabled and the finished car edge rendered. Screenshots: `output/playwright/KAI-10220-production-grabcut-preview.png` SHA `4618a1f0…`; canvas SHA `210312ea…`. The final build's OpenCV chunk SHA remains `65719d76…`, identical to the observed build.
- Necessity: no unnecessary product element; the 219-line addition is one proof-only oracle required to distinguish raw masks from final polish and reproduce provider/runtime/route evidence.
- Sufficiency: local desktop/WebKit scope is complete. Exact pushed snapshot plus physical-iPhone polished standalone/refine/timing proof remains before QA can clear the increment.

## Exact snapshot, Vercel build, and QA handoff

- Committed and pushed exact rollback snapshot `53e34a3562a57d394108bd61057a89e40a039872`; local and remote branch heads agree and the tracked tree is clean.
- The first Vercel attempt failed during `npm install` because the pre-existing `browsertime` dependency's `@sitespeed.io/edgedriver` download returned `fetch failed`; no Increment-5 source or build step had run. An unchanged exact-commit redeploy succeeded.
- Ready exact-commit preview: `https://onemo-next-1s6fv6vnn-onemo-web-app.vercel.app/cutout-lab`; deployment `dpl_GgdtEeBYvhubU1tprLwnYd2exRLR`. Logs prove branch `session62-task/KAI-10220-opencv-provider`, commit `53e34a3`, successful Next 16.2.12 compile, TypeScript, 22-page generation, and deployment completion.
- Vercel protection redirects anonymous HTTP clients to SSO; Dan's authenticated iPhone session must perform the physical-device observation on this preview.
- Linear now reads `Ready for QA` with the exact snapshot, local proof, Vercel evidence, and physical-device residual. `@s62-pixel-qa` received the full-identity independent review dispatch and is actively auditing. KAI-10221 remains locked until QA and Meta CLEAR.

## Physical-iPhone gate failure and bounded rework

- Dan tested exact Vercel snapshot `53e34a3562a57d394108bd61057a89e40a039872` on physical iPhone and reported that zoomed GrabCut edges remain choppy, with no visible edge fade/blend. The explicit device gate therefore fails; QA's source-clean HOLD cannot become CLEAR.
- The prior radius-3 `smoothMask` branch only smooths then re-thresholds a binary shape. It does not yet prove or deliver the soft-alpha edge behavior Dan observes from u2net.
- Minimal correction: fresh-trace the actual accepted u2net matte publication and its immediate consumers; route completed GrabCut through the same existing soft-edge owner while preserving raw `Mask.data` for refinement/history. Replace the ineffective final-only branch in place; add no second smoother/provider/framework or UI change.
- Re-prove exact raw masks/u2net preservation plus actual output alpha gradient, Chromium/WebKit/live Preview, then commit/push a superseding rollback snapshot for physical-iPhone re-test. KAI-10221 remains excluded.

## Owner extension — edge calibration

- Dan directed that the GrabCut edge smooth/blend amount be exposed in the existing admin calibration panel so the release value can be tuned on device.
- Minimal addition: one numeric GrabCut edge-feather setting on the existing flow state/action and existing admin panel only. It controls only the continuous alpha sent through the shared engine matte path; raw GrabCut geometry/history/refinement remains unchanged.
- No new panel, general settings framework, duplicated pipeline, or product UI redesign. Increment 6 must lock the selected production default and exclude this route-only calibration control from the portable closure, consistent with the existing adoption-map rule.

## Owner correction — one shared u2net + GrabCut edge pipeline

- Dan corrected the calibration scope: the control is not GrabCut-only. u2net and GrabCut must enter the same edge post-processing path and one admin value must govern both so there is no source-dependent finishing difference.
- Fresh source truth: u2net's continuous alpha currently comes directly from the model `texImage`; its binary contour alone passes through hard-coded `smoothMask(..., 3)` in `prepareEffect`. GrabCut's attempted flow branch produced another binary edge and therefore could not match the model matte.
- Superseding minimal diff: delete the GrabCut-only flow smoothing branch; introduce one shared Cutout preparation value that governs the existing contour smoothing plus continuous-alpha feathering for both u2net and GrabCut at their common `MLResult -> prepareEffect` seam; expose that single value in the existing admin panel. Keep raw masks/provider/interaction unchanged.

## Shared-edge implementation and first proof

- Replaced the ineffective GrabCut-only binary smooth/re-threshold branch with one common `prepareCut`: native u2net `MLResult` and non-AI/brush `MLResult` both pass through the same edge finish, contour, matte, `prepareEffect`, compose, Preview and Save path. Raw masks and the stored native u2net result are not mutated.
- Generalized the existing box-filter owner so one radius produces continuous 0–255 alpha and the binary contour threshold. `ShapeBuildConfig.edgeFinishPx` defaults to the prior contour radius `3`; one existing-admin slider exposes `0..12` and re-prepares either current source through the same seam. No new panel, provider, framework or source-specific finishing branch exists.
- Focused typecheck, zero-warning scoped lint, 18/18 characterization, and production build pass. Chromium/WebKit direct production-module proof freezes unchanged raw GrabCut hashes plus exact shared finished alpha: GrabCut `3449afa4…` with 21,788 intermediate-alpha pixels; u2net-like continuous input `f1d1785e…` with 28,852 intermediate-alpha pixels; both source hashes remain unchanged.
- Real-route Chromium/WebKit proof opens `?admin=1`, creates a standalone GrabCut, verifies default `3px`, changes the one shared control to `5px`, waits for live re-prepare, enters Preview and saves exact outputs (`676c3d99…` 1265x443 Chromium; `c7a68d72…` 1264x443 WebKit). Sole OpenCV provider count and raw/provider/runtime evidence remain unchanged.
- Current production build on port 3217 serves this worktree. Headed Playwright fallback observed the actual route through Upload → GrabCut Add → shared edge 3→5 → Preview; the control reads `5px`, status confirms `shared u2net/GrabCut edge finish`, and the same capped Preview is visible. Evidence: `output/playwright/KAI-10220-shared-edge-admin-5px.png`.

## Completion audit — superseding device snapshot

- The first full regression sweep exposed one scope leak before handoff: adding `edgeFinishPx` to the runtime `EFFECT_BUILD_CONFIG` changed the shared payload/config hash and Grid catalogue goldens. Removed it from the global runtime object; the option remains caller-supplied with the legacy `3px` fallback, and Cutout alone owns its explicit `3px` default. The three affected shared-surface suites then passed 22/22 without golden edits.
- Full current-tree gates pass after that correction: 533 tests with 10 declared skips, typecheck, scoped zero-warning lint, full lint with zero errors (404 pre-existing generated/tool warnings), production build, preservation, detector, FIFO/flow, truthful-output, and shared-edge/GrabCut Chromium+WebKit oracles.
- Final-build preservation hashes remain the accepted `d7a28a…` and edited `55e6178e…`; raw GrabCut/provider hashes remain exact. Shared finished alpha and 5px route output hashes reproduce exactly in both browsers. No global Grid/Creator config or output golden changed.
- Final-build visual gate: port 3217 serves this worktree; headed Playwright fallback exercised Upload → standalone GrabCut → admin edge `3px` to `5px` → Preview. The live panel and status prove the one shared control; Preview is the same capped result as Save. Evidence `output/playwright/KAI-10220-shared-edge-admin-5px-final-build.png`, SHA-256 `0e4c839f…`.
- Audit mapping: early scratch+erase, exact raw masks/provider closure, one post-`MLResult` finish for u2net+GrabCut, one route-only calibration value, truthful output, and no KAI-10221 work are all source- and runtime-proven. No dead import, second smoother/provider, or source-specific finishing branch remains.
- Necessity: no unnecessary product element; the global config leak was removed rather than accepted.
- Sufficiency: Builder/local scope delivers the owner correction in full. Exact pushed snapshot, Vercel compile, and physical-iPhone edge calibration/acceptance remain the named external gate before QA can clear KAI-10220.

## Superseding rollback snapshot and Vercel device gate

- Staged and audited exactly nine tracked KAI-10220 rework/proof files; `_WIP/` continuity and Playwright evidence remained untracked. Committed and pushed `20c45436f86e34106d329fa295dc054a934d5ad5`; local and origin branch heads agree.
- Vercel auto-built that exact GitHub commit. Deployment `dpl_EqXUHZNutyLg5BqgNkpPtXBo3tzm` is Ready at `https://onemo-next-5imlvhzw3-onemo-web-app.vercel.app`; logs prove commit `20c4543`, clean dependency install, Next compile, TypeScript, 22-page generation, output deploy, and completion.
- Physical-iPhone calibration URL is `/cutout-lab?admin=1`. Dan is asked to compare the same cut at 3px, 5px, and 7px and accept the smallest value that removes staircase without losing fine detail. QA may independently audit the exact snapshot in parallel; KAI-10221 remains locked.

## Owner calibration lock — edge 8, blend 0, live Paint ranges

- Dan accepted `8px` as the shared U2Net/GrabCut edge-finish default and directed Blend blur to remain `0` by default. The existing outgrowth transition was the only path that silently raised Blend above zero, so that latch and its stale comments were deleted; Clamp still handles outgrown output while the visible Blend value remains explicit.
- Paint admin controls now expose the full bounded useful range: swath `0..12×`, smoothing `0..100%` of brush radius with a true `0` off state, and loop-close `0..1`. The prior smoothing default is preserved exactly as `33%` (`1/3` brush radius).
- Moving any Paint control replays only the latest accepted Paint shape/erase operation against its exact cloned pre-stroke mask after a `120ms` debounce. It replaces the current history snapshot rather than adding an Undo step. Upload, Detect, GrabCut, vector/frame edit, Clear, restore, replacement and unmount invalidate that replay source; no second stroke-history framework exists.
- A fresh production build serves this exact worktree on port `3217`. Headed Playwright fallback observed Upload -> Paint U-shape -> swath `2×` to `12×`; the current canvas changed visibly and status reported `latest Paint stroke recalculated`. Full-page witness hashes: before `570da1dc380f61525afd03345e32866a890b3dade54db58ef962a9c4c48c9a6e`, after `844b60c12bdc457f80757e9cdeec12f5ce70bbec8b9184d85380ebdbcdcf8efc`. The same live page showed shared edge default `8` and Blend `0`.
- Final current-tree gates: serialized suite `534 passed / 10 skipped`; focused characterization `19/19`; typecheck; scoped zero-warning lint; full lint zero errors; production build; detector, flow, truthful-output, preservation and GrabCut/shared-edge browser oracles. Chromium and WebKit both prove each Paint slider changes the existing shape, exact full ranges, Blend remains zero after outgrowth, raw GrabCut hashes stay exact, and one provider ships. The flow oracle now selects the topmost node target because default-8 edge geometry can overlap transparent hit targets; the node-rebase behavior itself remains unchanged and passes.
- Updated intentional fixed-viewport output witnesses: clean Detect `1329x622` SHA `b4e60832…`; edited OpenCV `1416x661` SHA `8424c2b2…`; standalone GrabCut Chromium `1263x443` SHA `2a6bf8c1…`; WebKit `1263x443` SHA `824c2ff1…`.
- Necessity: no unnecessary product element; the change adds only the requested defaults, ranges and one bounded replay source, while deleting the contradictory implicit Blend owner.
- Sufficiency: Builder scope delivers Dan's calibration directives in full. One new rollback snapshot, exact Vercel build and independent QA/Meta gates remain; KAI-10221 stays locked.

## Live Paint calibration rollback snapshot

- Staged and audited exactly nine tracked files; `_WIP/` continuity and Playwright evidence remained untracked. Committed and pushed `fee76892b7661cfd3da095c29aa79d3f232b052d`; local and origin branch heads agree.
- Vercel auto-deployment `dpl_EuDNun9Fw7vaHht8dFXVU98hUvHV` is Ready at `https://onemo-next-ml4bnwk3z-onemo-web-app.vercel.app`. Provenance resolves to branch `session62-task/KAI-10220-opencv-provider` and exact commit `fee76892b7661cfd3da095c29aa79d3f232b052d`; logs prove dependency install, Next 16.2.12 compile, TypeScript, and 22-page generation.

## Owner correction — Paint swath default 1x

- Dan confirmed that `1x` swath equals the selected brush diameter and directed it as the Paint default. The prior `2x` default is superseded; range and live recalculation stay unchanged.
- Dan corrected the source model: Paint is a freehand shape creator, not a sticker-object detector. An accepted Paint result therefore starts from an all-off vector recipe; accepted AI/GrabCut results restore the prior sticker-cutout recipe. Switching tabs alone does not mutate the accepted result. Paint mask smoothing remains at its existing `1/3` default until Dan settles its production value.
- Minimal implementation keeps two recipes inside the existing flow, switches only after successful source acceptance, stores source kind in the existing history snapshot, and keeps tuning/restoration source-owned. The purple Paint preview and Paint cursor now read the actual swath width instead of the stale hard-coded `2x`/radius mismatch; GrabCut retains its separate radius semantics.
- Existing Chromium/WebKit production-route proof now asserts swath `1x`, cutout Smooth `37` -> accepted Paint Smooth `0`, independent Paint Smooth `23`, and accepted GrabCut restoration to `37`. The FIFO oracle uses a smaller erase brush so the new truthful `1x` swath cannot legitimately empty its seed while testing queue order.
- `fee76892…` QA CLEAR and queued Meta review are superseded/held. Builder will prove, snapshot and return the correction through QA before Meta.

## Source-owned Paint rollback snapshot

- Exact local/origin snapshot `16a7c02c6f1f2b3dd2a02141f97b033dd22a0a75` is pushed. Six tracked files only; `_WIP` and visual evidence remain untracked.
- Final gates on the committed bytes: serialized 534 pass / 10 declared skips; 19 focused characterizations; typecheck; scoped zero-warning lint; production build; preservation, detector, FIFO/flow, truthful-output, and Chromium/WebKit GrabCut/Paint/source-recipe oracles.
- Current-build visual gate: port 3221 is served from this exact worktree at `16a7c02c`; real Upload -> Paint shape -> Vector Smooth visibly shows swath `1x` and Paint Smooth `0`. Screenshot `output/playwright/KAI-10220-paint-source-vector-zero.png`, SHA-256 `0762cebb7d39fb9712f339bfd567da50d0b2eed26a47cd7883bece3ba76dc370`.
- Necessity: no unnecessary product element; source identity lives in the existing flow/history and both proof changes extend existing oracles. Sufficiency: delivers swath `1x`, truthful Paint cursor/ink, clean Paint vector defaults, independent tuning, and cutout-recipe restoration. Paint mask smoothing intentionally stays `1/3`; no maximum was owner-locked and the observed maximum can erase narrow shapes.
- Next: exact Vercel deployment provenance and bounded independent QA. KAI-10221 remains blocked until QA and Meta CLEAR.

## Future owner input — named vector presets

- Dan has designed a new UI-shell screen around named vector presets so normal users do not tune the raw vector controls directly.
- Each preset will be one complete recipe over the existing vector settings. Dan supplied the authoritative visible-control table at `_WIP/context/PRESETS FOR CUTOUT LAB.csv`:

| Preset | Name | Detail | Offset | Simplify | Smooth | Radius |
|---|---|---:|---:|---:|---:|---:|
| 1 | PURE | 0 | 0 | 0 | 0 | 0 |
| 2 | CLASSIC | 0 | 2 | 15 | 0 | 10 |
| 3 | TECHNO | 10 | 3 | 0 | 20 | 2 |
| 4 | EDGY | 13 | 4 | 0 | 1 | 1 |
| 5 | FLUID | 0 | 4 | 100 | 0 | 13 |
| 6 | SPACE | 80 | 15 | 0 | 0 | 5 |

- `PURE` is Preset 1 and the default/reset recipe. All five user-visible controls read `0`; internally the existing Detail inversion represents visible Detail `0` as engine `detail: 100`. The CSV typo `SIPLIFY` maps to the existing `simplify` setting.
- Implementation must start every recipe from the existing `ZERO_SETTINGS` so hidden `curve`, `straighten`, and `offsetJoin` retain their established all-off/default values, then map the five visible table values. It must not store visible Detail values directly in the inverted engine field.
- Preserve the source-owned behavior established here: Paint and AI/GrabCut keep separate active recipes; selecting a preset updates the recipe for the accepted source rather than creating another processing pipeline.
- This is a later UI-shell input, not an authorised change to the exact KAI-10220 snapshot currently in QA.

## Pending preset refinement — ZERO and micro Offset

- Dan is considering separating an explicit default `ZERO` preset (all five visible vector controls at `0`) from `PURE`, which would become the next-tightest clean recipe.
- Exact source semantics: Offset is percentage-based, not pixel- or millimetre-based. One visible Offset unit equals `1%` of the mask's longest side. At Cutout's 1024px working maximum this is about `10.24px`; `0.1` equals about `1.024px`, and `0.05` equals about `0.512px`.
- Physical millimetres depend on subject framing because `mmPerPx` is calibrated from the subject silhouette bbox. If the subject fills the longest side, Offset `1` is about `0.7mm` on the 70mm base; a smaller subject makes the same percentage step physically larger. Pixel displacement in mask space remains percentage-stable.
- Builder recommendation: allow Offset decimals in `0.1` steps across the existing range, keep `ZERO` at `0`, and begin calibrating `PURE` at Offset `0.1` with its other values at zero. This is a proposal pending Dan's lock; do not edit the authoritative CSV or product code yet.

## Owner correction — Offset uses pixel parity in the preset shell

- Dan rejected the fractional-millimetre proposal. The vector-preset Offset will use pixel parity at this stage: one Offset unit equals exactly one working-canvas pixel; ZERO is `0px` and the first non-zero step is `1px`.
- Rationale: this screen shapes the working vector. The complete resolved model converts to millimetres later as one whole, so converting this UI control to physical units early adds no product value.
- This supersedes the prior percentage-based/millimetre recommendation for the later preset implementation. Do not blend the models: the future preset adapter must translate the table's Offset numbers as pixels, not percentages or millimetres.
- The authoritative CSV has not been rewritten because Dan has not yet supplied the revised ZERO/PURE rows. Current KAI-10220 QA code remains unchanged.

## Owner lock — normalized vector units

- Dan locked the later/current Cutout vector-unit model: visible Detail, Offset, Simplify, and Radius use direct working-canvas pixels; Smooth remains a normalized `0..200` strength value, with `0` off and `200` maximum.
- Smooth is not labelled or converted as a percentage. Existing Smooth preset values remain numerically unchanged.
- Existing calibrated spatial defaults/presets must be migrated mathematically to equivalent pixel values so their geometry does not change and Dan does not recalibrate them.
- This resolves the earlier open question and authorises the bounded Cutout unit migration. Shared Grid/Creator behavior must remain unchanged.

## Normalized-unit implementation and completion audit

- Cutout now uses direct working-canvas pixels for Detail, Offset, Simplify and Radius, each with one-pixel UI steps. Smooth remains direct `0..200` strength with step `1`; it is neither relabelled nor divided as a percentage.
- The existing Cutout default is converted once against each accepted source into an equivalent pixel recipe. Exact unit tests prove shape equality for the existing default and all six supplied calibration rows; Smooth values are numerically identical. Shared Grid/Creator callers omit the Cutout unit mode and their 61 focused engine/boundary tests remain unchanged.
- The completion audit recovered QA's still-live `16a7c02…` Paint finding: after Frame outgrowth, live Paint ink/cursor used view-box scale while deposition used image scale, and zero swath still rendered a 2px mark. The page now uses the same image-space width as deposition and renders no Paint ink/cursor at zero. The existing Chromium/WebKit GrabCut/Paint oracle proves equality after outgrowth and the zero-off state; no product seam or new proof file was added.
- The preservation oracle's old Detail-25 percentage witness was intentionally superseded because Detail 25 now means `25px`. Two fixed-viewport witnesses were re-frozen after reproducing them: clean `1329x622` RGBA SHA `30c14812…`; subsequent real OpenCV edit `1416x661` RGBA SHA `0bcb4a79…`. Same-byte replacement still matches exactly.
- Final current-tree gates: serialized `542 passed / 10 skipped`; 61 shared-engine tests; typecheck; changed-scope zero-warning lint; full lint zero errors with the unchanged generated/tool warnings; production build; preservation, detector, FIFO/flow, truthful-output, and Chromium/WebKit GrabCut/normalized-unit/Paint-width oracles.
- Final visual gate: production server on port `3224` serves this worktree's fresh build. A real headed Chromium journey Upload -> actual u2net Detect -> Vector -> Smooth shows `smooth (strength)`, range `0..200`, step `1`, current migrated value `10`, and the accepted cut. Screenshot `output/playwright/KAI-10220-normalized-vector-final.png`.
- Necessity: no unnecessary product element; one Cutout unit mode, one compatibility conversion, the two-line Paint rendering correction, and extensions to existing proofs only.
- Sufficiency: delivers the full accumulated owner unit directive plus the still-live QA Paint correction while preserving the existing calibrated recipes/default and shared Grid/Creator behavior. One exact commit/push, Vercel provenance, QA and Meta remain; KAI-10221 stays locked.

## Owner extension — Paint-exclusive stroke calibration

- Dan directed the existing admin calibration panel to expose the Paint-only mask smoothing and every native Canvas stroke cap/join mode for hands-on comparison.
- Minimal diff: keep the existing smoothing `0..100%` range; add `cap: round|butt|square` and `join: round|bevel|miter` to the existing `PaintConfig`; feed them to both deposited mask rasterization and live Paint ink; add selectors to the existing `?admin=1` panel and extend the existing browser oracle. No library, second paint path, vector/AI coupling, or normal-user UI.
- Default stays `round` cap + `round` join, preserving current output until Dan deliberately changes a selector.
- Dan clarified that using or recalibrating Paint must visibly reset the AI/GrabCut vector controls to zero. Every successfully accepted Paint stroke/replay now resets the Paint-owned vector recipe to `ZERO_SETTINGS`; the separate Cutout recipe is retained and restored on the next accepted Detect/GrabCut result.
- Current-tree proof: typecheck, changed-scope zero-warning lint, 19 focused characterizations, full serialized `542 passed / 10 skipped`, production build, preservation oracle, and the full Chromium/WebKit GrabCut/Paint oracle pass. The browser oracle proves all cap/join options exist, defaults remain round/round, selecting square/bevel changes the already-drawn shape, Paint recalibration resets visible Vector Smooth `23 -> 0`, and the later GrabCut result restores the saved Cutout Smooth `37`; raw GrabCut and finished-output hashes remain exact.
- Visual gate: fresh production build on port `3225` from this worktree shows the existing `?admin=1` panel with smoothing `0..100%`, cap `round|butt|square`, join `round|bevel|miter`, defaults round/round. Screenshot `output/playwright/KAI-10220-paint-cap-join-admin.png`, SHA-256 `f8649ed05698745044532f0cd14618f44d04f8370a4cf7117ed68a5802236250`.
- One-point Paint remains the established circular deposit under every line-cap choice because a tap has no direction/endpoints; cap/join apply to multi-point strokes only. This preserves the existing one-point Paint contract while exposing every native line style.
- Necessity: no unnecessary elements; two fields on the existing config, two selectors on the existing admin panel, one reset flag on the existing source switch, and extensions to the existing oracle only. Sufficiency: delivers full Paint-only smoothing/cap/join calibration plus zeroed Paint vector controls and preserved AI/GrabCut recipe restoration.

## Owner correction — manufacturing artwork is original-resolution

- Dan confirmed manufacturing is mandatory unfinished product work, not an optional dormant capability. The browser's 1024px editor and 1536px texture canvases are preview proxies only and may never become the printable artifact.
- Baseline `050d557e` proves the gap existed in v5.3.1: `types.ts` limits the lane to Draft/preview, `persistence.ts` and `payload.ts` explicitly declare themselves unwired contract code, and `ARCHITECTURE.md` says save/order plus the four manufacturing artifacts remained open. The comment in `mask.ts` claiming full-resolution save/order regeneration described intent, not an executable path.
- Manufacturing invariant: preserve the exact uploaded bytes and original dimensions; record the complete final mask/vector/Paint/GrabCut/frame/effect recipe; deterministically regenerate lossless artwork from the original; fail closed if source or recipe is incomplete. Capped browser Save is not manufacturing evidence.
- Immediate KAI-10220 comparison: one existing-admin toggle selects capped 1536px or original-resolution Preview/Save while the 1024px editor/mask proxy and exact accepted recipe remain unchanged. Show the actual output-source dimensions, deploy, and compare the same journey on physical iPhone for quality, time, and Safari stability.
- Minimal seam: add an explicit original-resolution option to the existing `prepareEffect` texture decode, pass it through the existing Cutout `prepareCut`, and re-prepare the current accepted mask when the admin toggle changes. No second compositor, mask path, export framework, or KAI-10221 relocation.
- First current-build comparison passes in Chromium and WebKit on the existing 2048×2048 fixture. Capped source is 1536×1536 and preserves the existing exact PNGs; original mode reports 2048×2048 and produces larger RGBA PNGs (Chromium 1683×591 SHA `a76410cb…`; WebKit 1684×590 SHA `d6b735de…`). Switching back reproduces the capped PNG byte-for-byte and does not change history.
- Current-build visual gate: the final fresh production build on port `3227` is served from this exact worktree. Headed Chromium exercised the real Upload -> standalone GrabCut -> original-output toggle journey; the admin panel showed `original upload`, actual source `2048×2048`, `172ms`, and retained history `2`. Screenshot: `output/playwright/KAI-10220-original-output-admin-current-build.png`, SHA-256 `34921580107d61f2c2b11263337b3ca9d156721826b3085fa9bf27be5dd516f1`. Browser console had zero warnings/errors.
- This toggle is a phone measurement gate only. It does not complete manufacturing: the production invariant remains original-byte retention plus deterministic lossless replay of the final recipe, with capped browser proxies excluded from print input.
- The old source comment that claimed manufacturing re-bake already existed was corrected: it now states the actual requirement and explicitly forbids using the capped display raster as manufacturing input.
- Final current-tree gates: `542 passed / 10 skipped`, typecheck, changed-scope zero-warning lint, production build, and the full Chromium/WebKit GrabCut/Paint oracle. Exact capped outputs stay unchanged; original-source outputs reproduce at Chromium `1683×591` SHA `a76410cb…` and WebKit `1684×590` SHA `d6b735de…`; switching back restores each exact capped PNG and history does not move.
- Necessity: no unnecessary product element; one optional decode cap, one existing-flow toggle, one existing-admin control, one corrected false comment, and extensions to the existing oracle only. Sufficiency: delivers the requested capped-versus-original phone comparison in full; physical-iPhone quality/time/stability observation remains the external measurement. It does not claim manufacturing closure.

## Original-resolution comparison rollback snapshot

- Exact local/origin snapshot `8d85eaf8c038f914cdb062117fd4fa1130e3ecc9` is pushed on `session62-task/KAI-10220-opencv-provider`; six tracked files only. `_WIP` continuity and Playwright evidence remain untracked.
- Vercel deployment `dpl_DBWgtcU725keD7WAnbASvf6KNt8Y` is Ready at `https://onemo-next-6l2dloxsh-onemo-web-app.vercel.app`. Build logs pin branch and commit `8d85eaf`, clean install, Next 16.2.12 compile, TypeScript, 22-page generation, and deployment completion.
- Physical-iPhone comparison route: `https://onemo-next-6l2dloxsh-onemo-web-app.vercel.app/cutout-lab?admin=1`. Preview protection may redirect to the owner's Vercel login; it is the same branch-preview access model as prior snapshots.

## Owner extension — implement named vector presets

- Dan directly authorised preset implementation after the original-resolution snapshot reached QA. `8d85eaf8…` remains historical comparison evidence and is superseded as the delivery candidate; QA was stopped.
- Exact final model recovered from the source transcript: `ZERO` is the default all-zero recipe; `PURE` is the first clean enhancement and, after Dan's pixel-parity correction, uses direct Offset `1px` with every other visible value zero. Retain the five other calibrated CSV recipes: CLASSIC, TECHNO, EDGY, FLUID, SPACE.
- The retained CSV rows remain legacy calibration inputs and must be converted through the existing source-specific `traceSettingsToPixelUnits` seam so their rendered shapes do not change. Do not store the old percentage values under pixel labels.
- Minimal implementation: one seven-row preset table and resolver in existing Cutout finishing glue; one source-owned preset state/action in the existing flow; one selector in the Vector UI. Normal users see presets; the existing raw vector calibration controls remain visible only under `?admin=1`. No new store/framework/module or KAI-10221 work.
- Both Paint and AI/GrabCut retain their own active recipe and preset label. Accepted Paint resets to ZERO; selecting/tuning a preset affects only the accepted source. Raw admin tuning becomes CUSTOM. History restores the exact preset label with its stored recipe.

## Named preset implementation audit

- The existing Vector tab now exposes exactly `ZERO`, `PURE`, `CLASSIC`, `TECHNO`, `EDGY`, `FLUID`, and `SPACE`. Normal users see only the preset selector; `?admin=1` retains the raw five-control calibration UI. No separate preset framework or module was added.
- `ZERO` is the all-off direct-pixel default. `PURE` is direct Offset `1px` with the other visible values zero. The five retained CSV recipes resolve from their old calibration units through the existing per-source pixel conversion, so the labels are pixel-truthful without requiring recalibration.
- Source ownership is preserved: accepted Paint resets its recipe and label to ZERO; Cutout retains its own preset/CUSTOM recipe; returning through Detect/GrabCut restores it. Raw admin tuning marks only the active source CUSTOM. History snapshots carry the matching label with the already-stored settings.
- The capped/original-resolution comparison remains intact. With the intentional new ZERO default, exact capped/original output witnesses were re-frozen: standalone GrabCut Chromium `1158x349` / `0c04006c…`, original `1543x465` / `33af8330…`; WebKit capped `1158x349` / `648358ca…`, original `1543x465` / `54ad0ecf…`. Switching back reproduces the capped output exactly.
- Current-tree proof: `543 passed / 10 declared skips`; typecheck; scoped zero-warning lint; production build; truthful-output oracle; preservation oracle; exact Chromium/WebKit GrabCut/provider/Paint/preset/original-output oracle. The oracle proves option order, ZERO default, TECHNO retained Smooth `20`, PURE Offset `1px`, raw CUSTOM, Paint ZERO reset, Cutout restore, and admin-only raw controls.
- Visual gate: headed Chromium on the current tree at `http://127.0.0.1:3131/cutout-lab` shows the public Vector tab with the seven-option selector at ZERO and no raw vector controls. Witness: `output/playwright/KAI-10220-vector-presets-public.png`.
- Necessity: no unnecessary elements. Sufficiency: delivers the authorised presets and preserves the original-resolution comparison in full. Commit, push, Vercel provenance, and independent QA remain; KAI-10221 stays blocked.

## Snapshot and handoff

- Exact local/origin snapshot `a7d36e1bb4b14a3c29ac160e85ac242d09f394aa` is pushed. Vercel deployment `dpl_DAdj527MeZz8PxCATJnYsngSTvoa` is Ready at `https://onemo-next-7dz9t5tsb-onemo-web-app.vercel.app`; deployment metadata pins the exact branch and SHA.
- Anonymous deployed Playwright correctly reached Vercel SSO rather than the product route. This is access protection, not a runtime verdict; the same exact current bytes passed the complete local Chromium/WebKit route gates.
- Linear update correction: passing `description` replaces the whole issue description. The task was immediately rebuilt as one concise authoritative live contract plus the latest handoff, with full chronology explicitly delegated to the Builder/QA ledgers. Future handoffs must use `patch: [{ op: 'append', ... }]`, never `description`, unless replacement is the intended operation.
- QA review was delivered to `@s62-pixel-qa` with the full `[s62-pixel-builder]` identity. Linear is Ready for QA; KAI-10221 remains blocked.

## Owner correction — PURE all ones

- Dan superseded the prior PURE recipe: every visible vector control is exactly `1` — Detail `1px`, Offset `1px`, Simplify `1px`, Smooth strength `1`, Radius `1px`.
- Minimal correction changes the existing source-owned preset row, its exact unit characterization, the existing Chromium/WebKit route oracle, and the calibration CSV. The stale legacy PURE migration fixture is removed because PURE is now a direct-pixel recipe; CLASSIC through SPACE remain unchanged.
- ZERO remains the all-off default. No UI, flow ownership, output resolution, Paint defaults, detector pipeline, retained preset, or KAI-10221 code changes.

## Owner correction — restore Detail; extend Offset

- Detail returns to its prior visible and mathematical model: `0..100`, `0 = full fidelity`, source-relative/mm-scaled simplification. It is no longer presented or interpreted as a direct pixel tolerance.
- Offset remains direct working-canvas pixels at one-pixel steps; its manual calibration ceiling expands from the compatibility-derived `160px` to `250px`. No engine limit required `160px`.
- Simplify and Radius remain direct pixels; their ceilings increase to `40px` and `350px` because the former `30px`/`260px` calculations omitted the old maximum Offset expansion and could be weaker in combination. Smooth remains `0..200` strength. Existing preset values and geometry remain unchanged; PURE remains `1 / 1 / 1 / 1 / 1` in the visible control order.

## Detail/range and history correction proof

- Current ranges are Detail `0..100`, Offset `0..250px`, Simplify `0..40px`, Smooth `0..200`, Radius `0..350px`. The enlarged Simplify/Radius ceilings cover the old maximum-offset geometry instead of weakening the former controls.
- Preset selection and raw tuning now replace the current accepted history snapshot; neither creates a new Undo step. The existing Chromium/WebKit oracle proves TECHNO -> accepted Paint -> Undo restores TECHNO and Smooth `20` exactly.
- Current focused proof: 30 tests, typecheck, changed-scope zero-warning lint, diff hygiene, and the full Chromium/WebKit GrabCut route oracle pass. Raw GrabCut/provider hashes and capped/original PNG witnesses remain unchanged.
- Full current-tree proof: 57 test files pass with `542 passed / 10 skipped`; production build completes all 22 routes; preservation, detector, FIFO/flow, truthful-output, and Chromium/WebKit GrabCut oracles pass.
- Visual gate: headed Chromium on the current worktree at port `3131` ran Upload -> actual u2net Detect -> Vector -> PURE and showed Offset `1px`, the seven presets, Detail's restored label, and the current admin controls with zero console warnings/errors. Screenshot `output/playwright/KAI-10220-detail-restored-expanded-ranges-current.png`, SHA-256 `3d9e928b53f0a3f9e03b5dac90b6c49f35c83325494672b891ccbabe3ed293ce`.
- Necessity: no unnecessary element; one existing conversion seam, one existing range table, one history replacement call per existing tuning action, and existing proofs only. Sufficiency: delivers PURE all ones, restored Detail math, non-weaker direct-pixel ranges, exact retained preset geometry, and preset/recipe history restoration. Snapshot push and independent QA/Meta remain.

## Superseding rollback snapshot

- Exact local/origin snapshot `ad6b54cfb2f35edb1c8316ac3a81a5d436681dcd` is pushed on `session62-task/KAI-10220-opencv-provider`. Eight tracked task files only; `_WIP` and Playwright evidence remain untracked.
- `a7d36e1b…` is historical. Await exact Vercel Ready provenance, then append the corrected handoff to Linear and dispatch bounded QA. KAI-10221 remains locked.
- Vercel deployment `dpl_31km5FvvkRYCR7ce6MR5KYM6bz4Z` is Ready at `https://onemo-next-51onmkggd-onemo-web-app.vercel.app`; API metadata pins exact commit `ad6b54cf…`, branch, and commit message. The test route is `https://onemo-next-51onmkggd-onemo-web-app.vercel.app/cutout-lab?admin=1`; anonymous access redirects to the expected Vercel SSO.

## Independent QA hold

- QA found no source rework on `ad6b54cf…`: full source/diff, 542/10 suite, static/build gates, five Chromium/WebKit oracles, and QA-owned current u2net/preset/history/range visual pass.
- Only remaining gate is Dan's physical-iPhone capped/original comparison: visible quality, preparation time, Save completion, repeat stability, and Safari freeze/reload/crash behavior. KAI-10220 stays In QA review; KAI-10221 stays blocked.

## Owner rollback and retained deliverables

- Dan revoked pixel parity and the bundled Paint calibration work. Exact product baseline is restored to pre-pixel snapshot `16a7c02c`; the interrupted selective-revert draft is recoverable in stash `s62-pixel-builder-pre-rollback-selective-revert`.
- Git history proves pixel parity preceded presets: `9ca0a27d` pixel parity/Paint, `8d85eaf8` original-resolution comparison, `a7d36e1b` presets, `ad6b54cf` later calibration/history.
- Current owner directive: retain the original v1 vector math/ranges; rebuild the six CSV presets from `_WIP/context/PRESETS FOR CUTOUT LAB.csv` in those original visible units; restore original-resolution output and make it the default. Do not retain the later Paint cap/join/pixel-normalisation work.
- CSV truth: PURE `1/1/1/1/1`, CLASSIC `0/2/15/0/10`, TECHNO `10/3/0/20/2`, EDGY `13/4/0/1/1`, FLUID `0/4/100/0/13`, SPACE `80/15/0/0/5` in Detail/Offset/Simplify/Smooth/Radius order (`SIPLIFY` maps to `simplify`).

## Original-control preset rebuild — final candidate

- Product delta is the requested combination only: original v1 vector meanings/ranges; ZERO plus the six CSV presets; PURE `1/1/1/1/1`; original-upload Preview/Save selected by default; capped 1536px retained as the admin fallback.
- Pixel-parity conversion, Paint cap/join controls, Paint width normalization, and forced Paint recipe reset remain removed. Shared Grid/Creator behavior is restored to the pre-pixel implementation.
- Preset state is source-owned and history-owned. The exact Chromium/WebKit route oracle proves TECHNO -> accepted Paint/ZERO -> Undo restores TECHNO/Smooth 20; raw tuning is CUSTOM; normal users see presets and no raw vector controls.
- Exact-current proof: `535 passed / 10 skipped`, typecheck, production build, diff hygiene, and all five Cutout browser oracles pass. Original Preview/Save pixels agree in Chromium (`1642x694`, RGBA SHA `2de2cf08...`) and WebKit (`1644x694`, RGBA SHA `6502d223...`). GrabCut preserves the frozen raw masks, one provider, original default, exact capped fallback, and exact switch-back in both engines.
- Visual gate: current worktree on port `3131`; headed Chromium ran Upload -> actual u2net Detect -> Vector -> PURE. It showed the seven presets, PURE Detail `1`, original upload checked at `2048x2048`, edge finish `8px`, and zero console warnings/errors. Witness: `output/playwright/KAI-10220-presets-original-output-current.png`, SHA-256 `dd8bd346f943774c80fd4cbe7269b536e83d31f97143a26aca7a6cc01255cb08`.
- Necessity: no unnecessary product elements. Sufficiency: delivers the latest owner directive in full. Commit/push, deployment provenance, Linear append, and independent QA remain; KAI-10221 stays blocked.

## Original-control preset rebuild — pushed QA snapshot

- Exact local/origin snapshot `23603ff7184f9f03187aedc36a97eba2b8340dd8` is pushed on `session62-task/KAI-10220-opencv-provider`; tracked tree is clean and untracked continuity/evidence stays excluded.
- Vercel deployment is Ready at `https://onemo-next-mgcjg0tdt-onemo-web-app.vercel.app`; GitHub deployment `5823468236` and commit status pin the exact snapshot. Test route: `https://onemo-next-mgcjg0tdt-onemo-web-app.vercel.app/cutout-lab?admin=1`.
- Linear contains the superseding handoff and is `Ready for QA`. KAI-10221 remains Backlog/blocked pending QA and Meta.

## Owner correction — PURE default, extended calibration, effective Detail + Simplify

- `23603ff…` is historical and QA was stopped. PURE is now the default Cutout recipe in restored original units: Detail `0`, Offset `1`, Simplify `15`, Smooth `0`, Radius `0`. Paint retains its separate ZERO recipe.
- Offset exposes `0..25`; Simplify exposes the engine's existing `0..300` headroom. Neither conversion/math changed.
- Source probe reproduced the interaction defect: after Detail coarsened a generated trace, the generic redundant-vertex guard could skip Simplify entirely. The existing Cutout adapter now explicitly lets that already-existing fitter run only when Detail is active; Grid/Creator retain the guard and their exact catalogue/source tests pass.
- Current proof: combined Detail+Simplify unit regression passes; full serialized suite passes `536/10`; typecheck, scoped lint, diff check, production build, preservation/detector/flow/output and Chromium/WebKit GrabCut oracles pass. Headed live u2net route at Detail `70` changed canvas SHA from `118d9691…` at Simplify `15` to `a3c3f16d…` at `300`; screenshot `output/playwright/KAI-10220-pure-default-simplify300-current.png`, SHA `ed52a477…`; zero console warnings/errors.
- User-saved personal presets are deferred to standalone backlog KAI-10259, blocked by KAI-10221. No implementation entered this sprint.
- Replacement local/origin snapshot `501a30e1b15ba4f42d185871e1f9055be6da7452` is pushed; tracked tree is clean. Vercel is pending before the QA handoff.
- Exact Vercel deployment `5823826631` completed successfully at `https://onemo-next-kdvajeuyq-onemo-web-app.vercel.app/cutout-lab?admin=1` for snapshot `501a30e1…`.
- QA handoff was delivered with full identity `[s62-pixel-builder]` and verified in `@s62-pixel-qa`'s pane. Builder stops here; KAI-10221 remains blocked pending QA and Meta.
- Independent QA CLEAR is verified for exact snapshot `501a30e1…`; the on-disk verdict hash is `3a2ad2b23b8e0cb7e6e0332664bf0942216a1c2f7a21aec484a7e24aae11c941`, matching QA's report. Linear is `Ready for Meta`.
- Standing Meta review was dispatched to `@s62-lead` with full identity `[s62-pixel-builder]`. No KAI-10221 build-ahead; await Meta CLEAR or the smallest exact correction.
- Dan superseded that pending gate: QA is sufficient for KAI-10220, Meta is waived, and the attempted alternative Meta dispatch was cancelled. This is an owner waiver, not a Meta verdict.
- Linear records the exact waiver and closes KAI-10220 Done at snapshot `501a30e1…`. KAI-10221 is unblocked and handed to Builder under the standing cadence.
