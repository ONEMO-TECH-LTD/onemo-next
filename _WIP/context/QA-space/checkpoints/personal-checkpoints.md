# s62-pixel-qa checkpoints

## 2026-08-09 — KAI-10216 first QA pass

- Candidate `26d37579c0a119c2482212b6b84c482918937d75` reviewed against baseline `050d557e2ddbe99520c008e2090c202c554f03f8` and contract `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`.
- Product diff is behavior-preserving: exact normalized owner moves, identity re-exports, no duplicate implementation, PerfHUD/perfGesture/lastFileRef removal, current UI/API unchanged.
- Fresh gates pass: full tests, typecheck, scoped lint, diff check, production build, and QA-owned Upload → u2netp Detect → Detail 25 → Preview → Save plus successful replacement.
- QA verdict: REVISE. Missing real preservation oracles; adoption map must explicitly exclude route query/eruda/admin calibration; Builder evidence record conflicts with QA's twice-reproduced 1329x622 RGBA output.
- Durable records: `../reviews/KAI-10216-qa-ledger.md` and `../reviews/KAI-10216-qa-verdict.md`.
- Linear KAI-10216 returned to Building. KAI-10217 and Meta remain blocked. Builder has the exact correction set and must stop at the next QA snapshot.

## 2026-08-09 — KAI-10216 proof rework QA

- Re-audited exact pushed candidate `78a21d9d0e93f5aaf81fc9c22ac05ae462c1a30e`; local/upstream match and only four proof files changed from the first QA snapshot.
- Corrected adoption map, viewport evidence, visible fallback callback, full static gates, production build, and the fixed-viewport route oracle now pass independently.
- QA remains REVISE on two bounded oracle gaps only: assert eight Frame targets plus one corner anchor case; assert the deterministic post-edit GrabCut output instead of merely logging it.
- No product/UI/API/Figma/engine/later-task change is requested. KAI-10217 and Meta remain blocked.

## 2026-08-09 — KAI-10216 QA CLEAR

- Exact candidate `88dede13066dd7e22db365568943150f90e22e0a` matches upstream; final delta is one proof-only Playwright file.
- Independent oracle proves eight Frame targets, side/corner anchoring, exact post-GrabCut output, replacement, detector fallback, edits, output, and history on the current-code server.
- Final syntax, scoped lint, typecheck, and diff checks pass; parent full-suite/build evidence was independently established by QA before the one-file oracle correction.
- Necessity: no unnecessary elements. Sufficiency: KAI-10216 delivered in full.
- Route KAI-10216 to Meta. KAI-10217 stays locked until Meta closes KAI-10216.

## 2026-08-09 — KAI-10219 QA CLEAR

- Independently audited exact pushed snapshot `5db841832c3adc35e0f1ffd85efe5d2add4bcefd` against contract `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 4; local/upstream match.
- Full changed-file and shared-caller reads confirm one canonical compositor plus the necessary Cutout adapter, Clamp-only Cutout, preserved shared Tile/Grid/Creator/3D behavior, conditional Blend-0 bypass, and no KAI-10220 build-ahead.
- The Cutout-only preparation skip avoids at least 18,874,368 retained RGBA bytes on the recorded 1536×1536 fixture while shared preparation keeps its full-output default.
- Independent static/build, preservation, detector, flow, Chromium/WebKit pixel, failure-settlement, and QA-owned current-route visual gates pass. Chromium Preview/Save are exact-equal 1330×621 RGBA pixels.
- Necessity: no unnecessary product elements. Sufficiency: Increment 4 delivered in full.
- Durable verdict: `../reviews/KAI-10219-qa-verdict.md`, SHA-256 `eaafe53b6723f83f5f594a9da295207723919c41e79c235ec80bf7bdcce14bcd`.
- Linear KAI-10219 is Ready for Meta. KAI-10220 remains Backlog/blocked until Meta; Builder was notified and delivery verified.

## 2026-08-09 — KAI-10220 QA HOLD

- Independently audited exact pushed snapshot `53e34a3562a57d394108bd61057a89e40a039872` against contract `367e2d27…`, Increment 5, plus Dan's physical-iPhone final-edge extension; local/upstream match.
- Source/diff is clean: scratch+erase precedes provider/allocation; raw standalone/refine semantics remain exact; only final GrabCut `Mask.soft` uses the existing radius-3 finishing seam; u2net owners are byte-identical; one OpenCV provider ships; no worker or KAI-10221 build-ahead exists.
- Independent 532-test, typecheck, build, lint, diff, five-oracle Chromium/WebKit, deployment-provenance, and own exact-build standalone/refine visual gates pass. No product-source rework is justified.
- QA cannot CLEAR yet: the exact physical-iPhone after-change standalone/refine edge and timing observation is absent. KAI-10220 remains In QA review; KAI-10221 remains blocked.
- Durable verdict: `../reviews/KAI-10220-qa-verdict.md`, SHA-256 `920f8c44cbb09b20d385b503de9c0870c2b4811573b0bdcc7dd5b6b46099519c`.

## 2026-08-09 — KAI-10220 physical-iPhone FAIL

- Dan tested exact deployed snapshot `53e34a…`; zoomed GrabCut edges remain choppy with no visible fade/blend. The open device gate failed.
- The earlier QA HOLD remains valid local/source evidence but is not a clearance. KAI-10220 returned to Building; KAI-10221 remains locked.
- Builder owns one bounded replacement of the ineffective binary smooth/re-threshold branch with the source-proven u2net soft-matte owner, preserving raw `Mask.data`, u2net, provider count, UI, and task boundary. QA is stopped until the superseding snapshot handoff.
- Added owner scope for the superseding review: expose only GrabCut final-edge feather/smooth amount through the existing route admin panel for phone tuning; raw GrabCut/u2net stay unchanged. Increment 6 locks the chosen default and excludes the calibration control from the portable closure.

## 2026-08-09 — KAI-10220 shared-finish correction

- Dan superseded the GrabCut-only calibration rule. The rework must have one shared post-`MLResult` edge-finish path and one admin value for both u2net and GrabCut; only mask generation differs.
- Raw masks/provider/history/refinement remain unchanged. The prior requirement that u2net completed output stay byte-identical no longer governs this superseding snapshot; QA instead proves both detectors share the same final owner and calibration response.
- No second finish, new panel/framework, or KAI-10221 work. Increment 6 locks the chosen default and removes the route-only calibration control from the portable closure.

## 2026-08-09 — KAI-10220 superseding snapshot QA HOLD

- Independently audited exact pushed snapshot `20c45436f86e34106d329fa295dc054a934d5ad5` against contract `367e2d27…` Increment 5 and Dan's superseding shared-edge directive.
- Source and runtime prove one shared post-`MLResult` preparation/edge/contour/matte/compose path and one existing-admin value for actual u2net, standalone GrabCut, and refinement. Raw masks/provider/history/refinement are unchanged; no second smoother/provider/framework, global Grid/Creator config/hash leak, or KAI-10221 work exists.
- Independent 533-test serialized suite, typecheck, lint, build, five Chromium/WebKit oracles, headed current-build actual u2net/GrabCut/refine observation, and exact Vercel provenance pass. Two default-parallel full runs hit only the unchanged exhaustive Grid test's 5s timeout; the isolated and serialized suites pass.
- QA verdict remains HOLD rather than CLEAR or REVISE: no code rework is justified, but Dan's exact physical-iPhone 3/5/7 standalone/refine quality and timing result is still outstanding. KAI-10220 stays In QA review; KAI-10221 stays blocked.
- Durable verdict: `../reviews/KAI-10220-20c45436-qa-verdict.md`, SHA-256 `f248842212ba7a343327a35953b7cfca4edd9c1599a083837da562c7daa3c456`.

## 2026-08-09 — KAI-10220 owner-locked calibration QA CLEAR

- Independently audited exact pushed snapshot `fee76892b7661cfd3da095c29aa79d3f232b052d` against contract `367e2d27…` Increment 5 and Dan's accumulated shared-edge, Blend-zero, Paint-range and live-recalculation directives.
- Full source/diff proof confirms shared edge default `8`, explicit Blend zero, one latest-Paint replay source with debounce/generation invalidation/current-history replacement, and no change to provider/raw masks/global Grid/Creator configuration/KAI-10221.
- Independent 534-test serialized suite, typecheck, lint, build, five Chromium/WebKit oracles, exact deployment provenance and QA-owned current-route visual pass. Shape and erase both visibly recalculate across the requested controls; zero smoothing is off; Undo/Redo proves no extra history entry; Frame outgrowth leaves Blend at zero.
- Dan's physical-phone observation confirms the edge control is visible and selects release default `8`, closing the prior calibration HOLD.
- Necessity: no unnecessary product elements. Sufficiency: Increment 5 and accumulated owner directives delivered in full.
- Durable verdict: `../reviews/KAI-10220-fee76892-qa-verdict.md`. Route KAI-10220 to Meta; keep KAI-10221 blocked until Meta.

## 2026-08-09 — KAI-10220 post-clear owner correction

- Dan changed the Paint swath release default from `2x` to `1x` after QA cleared `fee76892…`.
- The prior verdict is no longer current. KAI-10220 returns to Building for the bounded default/witness correction; QA waits for one superseding pushed snapshot.
- KAI-10221 remains Backlog and blocked. No downstream work is unblocked.

## 2026-08-09 — KAI-10220 two-part correction scope

- Dan clarified the superseding snapshot must deliver two linked changes: Paint swath default `1x`, plus source-result recipe switching.
- Accepted Paint uses its clean vector recipe; accepted AI/GrabCut results restore the prior Cutout recipe. Switching occurs only when a result is accepted, never when a tab is clicked.
- QA re-review is bounded to those behaviors, history/preservation proof, exact witness updates and provenance. KAI-10221 remains blocked.

## 2026-08-09 — KAI-10220 preset-screen exclusion

- The named vector-preset screen is later UI-shell work; exact preset names, count and values remain owner input.
- It does not alter or gate snapshot `16a7c02…`. QA remains bounded to Paint swath default `1x` and accepted-result switching between the clean Paint recipe and prior AI/GrabCut Cutout recipe.

## 2026-08-09 — KAI-10220 `16a7c02…` QA REVISE

- Source-owned recipes, tab neutrality and history truth pass independently: Paint `0`, tuned Paint `23`, Cutout `37`, Undo Paint `23`, Redo Cutout `37`; swath defaults `1x`; no preset/UI/framework/provider/KAI-10221 work.
- Static/build and browser gates pass after recording and isolating three unchanged first-run timeouts: focused 19/19; full 534 pass/10 declared skip; typecheck; lint; build; five oracles; exact local and Vercel provenance.
- One blocking changed-line defect remains. Paint mask deposition uses image-space width while live ink/cursor use the expanded view-box width. A real Frame/outgrowth probe measured a `1.94x` visual-to-deposit mismatch; swath zero still shows ink.
- Smallest rework: two Paint rendering calculations and the affected existing oracle only. KAI-10220 returns to Building; KAI-10221 stays blocked. Durable verdict: `../reviews/KAI-10220-16a7c02-qa-verdict.md`.

## 2026-08-09 — KAI-10220 superseding Offset correction

- Dan superseded snapshot `16a7c02…`: Cutout Offset changes from percentage semantics to pixel parity, where `1` equals `1` working-canvas pixel.
- Existing calibrated presets and the current default must retain the same effective output automatically; no manual recalibration is transferred to Dan.
- QA is on hold pending one new pushed snapshot. Grid/Creator semantics and KAI-10221 remain untouched; KAI-10221 stays blocked.

## 2026-08-09 — KAI-10220 `9ca0a27…` QA intake

- Exact local/upstream head and parent pinned; authoritative contract remains 177 lines at `367e2d27…`.
- Full directive set recovered from Linear plus Builder transcript segments 21–23: four spatial Cutout controls become direct pixels, Smooth remains `0..200` strength, all existing calibration outputs migrate identically, Grid/Creator stay legacy, Paint cap/join/smoothing and WYSIWYG use the real Paint path, Paint results reset visible Vector controls to zero, and AI/GrabCut restores its saved recipe.
- Ten-file `+305/-78` diff is under independent source/static/browser/visual review. KAI-10221 remains blocked; no product edits by QA.

## 2026-08-09 — KAI-10220 output-resolution comparison supersedes `9ca0a27…`

- QA stopped without a verdict on `9ca0a27…`; its partial checks are historical evidence only.
- New required comparison: admin-only current 1536px-capped Preview/Save versus original-upload-resolution Preview/Save.
- The 1024px editor/mask proxy and exact edit/effect recipe remain fixed. Builder owes one superseding pushed snapshot.
- KAI-10220 is Building; KAI-10221 stays blocked. QA product source remains untouched.

## 2026-08-09 — KAI-10220 `8d85eaf…` QA intake

- Exact pushed replacement and authority set pinned. Six-file bounded delta is under independent source/static/runtime review.
- Required proof: unchanged capped output bytes and 1024px edit state; original-resolution Preview/Save through the same recipe/compositor; exact reversible switch-back; truthful dimensions/time; no manufacturing-closure claim.
- Physical-iPhone comparison remains the product/device gate. KAI-10221 stays blocked; no QA product edits.

## 2026-08-09 — KAI-10220 `8d85eaf…` QA HOLD

- Source/diff, 542-pass suite, typecheck, zero-warning scoped lint, build, five Chromium/WebKit oracles, and QA-owned exact-current visual proof pass.
- Capped output is byte-frozen; original output is larger and deterministic; switch-back is exact. The real editor remained 1024px and history unchanged.
- No code rework. Sufficiency remains partial only for Dan's physical-iPhone quality/time/Save/repeat/stability comparison. KAI-10220 stays In QA review; KAI-10221 blocked.

## 2026-08-09 — KAI-10220 `8d85eaf…` QA superseded

- Dan authorised named vector presets after the HOLD. That HOLD is historical only; no current verdict survives.
- Builder owns the smallest existing-recipe selector/table after recovering exact ZERO/PURE/current values from Dan's CSV and transcript. The output-resolution comparison stays intact.
- QA is stopped. KAI-10220 is Building; KAI-10221 remains blocked. No QA product edits.

## 2026-08-09 — KAI-10220 `a7d36e1…` QA superseded

- Dan changed PURE to all visible Vector knobs = `1`. `a7d36e1…` is historical; no QA verdict survives.
- QA stopped without inspecting Builder's live correction. The next snapshot must re-prove the preset table, output comparison, and preset recipe+label history; the historical snapshot lost TECHNO across Paint → Undo.
- KAI-10220 is Building. KAI-10221 remains blocked. QA made no product edits.

## 2026-08-09 — KAI-10220 `ad6b54cf…` QA HOLD

- Exact local/upstream snapshot `ad6b54cf…` was full-read and independently tested against contract `367e2d27…` plus accumulated owner corrections.
- Source, necessity, 542-pass/10-skip suite, typecheck, zero-warning scoped lint, diff hygiene, production build and all five Chromium/WebKit oracles pass. No product rework is justified.
- QA-owned exact-current runtime proved actual u2netp Detect, PURE `1/1/1/1/1`, required ranges, no preset-created Undo step, and TECHNO → Paint/ZERO → Undo restoring TECHNO/Smooth 20. Visual SHA `ed8e895e…`; console clean.
- Necessity: no unnecessary elements. Sufficiency: partial only because the accumulated owner scope still requires the physical-iPhone capped/original quality/time/Save/repeat/Safari-stability comparison.
- KAI-10220 remains In QA review; KAI-10221 remains Backlog/blocked. Durable verdict: `../reviews/KAI-10220-ad6b54cf-qa-verdict.md`.

## 2026-08-09 — `ad6b54cf…` superseded; QA stopped

- Dan reverted the direct-pixel control migration and restored all five Vector controls to original v1 meanings/ranges.
- The `ad6b54cf…` HOLD and its device gate are historical only. QA issued no current verdict and did not inspect/test the live Builder diff.
- KAI-10220 returns to Building. KAI-10221 remains blocked until one replacement snapshot receives fresh QA.

## 2026-08-09 — KAI-10220 `23603ff…` QA intake

- Exact local/upstream snapshot and parent pinned; KAI-10220 moved to In QA review and KAI-10221 remains blocked.
- QA scope is the owner-authorised rollback/composition only: original v1 Vector controls, exact CSV presets, original-output default with capped fallback, preset/history truth, and deletion of pixel/Paint leftovers. No product edits or KAI-10221 work by QA.
- Fourteen-file `+139/-382` delta is under independent full source/diff, shared-caller, static/build, five-oracle and exact-current visual review.

## 2026-08-09 — KAI-10220 `23603ff…` source/necessity checkpoint

- Full changed-source, CSV, current Linear and supersession read is complete. Original v1 Vector ranges/math, exact seven presets, original-output default/capped fallback, and preset/history ownership are source-backed.
- Superseded pixel-unit and configurable Paint cap/join/width/reset branches leave no tracked-source residue; only the original fixed round Paint raster/ink remains. Shared callers stay capped unless Cutout explicitly selects original texture.
- No source finding or KAI-10221 build-ahead. Static/build/browser/current-route gates remain.

## 2026-08-09 — `23603ff…` superseded; QA stopped

- Dan changed PURE to original-control values `0/1/15/0/0`. The prior all-ones snapshot is historical and has no QA verdict.
- QA stopped, returned KAI-10220 to Building, and preserved KAI-10221 as blocked. Await one new pushed snapshot; no product edit by QA.

## 2026-08-10 — KAI-10220 `501a30e1…` QA intake

- Exact local/upstream snapshot and parent pinned; KAI-10220 is In QA review and KAI-10221 remains blocked.
- Active proof scope: PURE default `0/1/15/0/0`, Paint ZERO separation, original-unit Offset `0..25` and Simplify `0..300`, effective Cutout Detail+Simplify with unchanged Grid/Creator, original-output default/capped fallback, and no personal-preset or packaging build-ahead.
- Ten-file `+78/-30` correction is under independent full source/diff, necessity/de-slop, static/build, five-browser-oracle, and exact-current visual review. No QA product edits.

## 2026-08-10 — KAI-10220 `501a30e1…` source checkpoint

- Full changed-source and exact-diff read complete. PURE/ranges/original math are exact; the one Cutout-only Detail+Simplify flag is absent from Paint, Grid Lab and Creator callers, so their prior guard and behavior remain intact.
- No personal-preset persistence, package/relocation work, second fitter/provider/history owner, pixel-parity residue or configurable Paint cap/join branch appears. Static/build/oracle/current-route gates remain.

## 2026-08-10 — KAI-10220 `501a30e1…` static checkpoint

- Focused 24-test set, full serialized suite exit, typecheck, diff check and production build pass. Scoped lint has zero errors; its sole unused-import warning is proven pre-existing in the exact parent.
- Five browser oracles and QA-owned current-runtime proof remain before verdict.

## 2026-08-10 — KAI-10220 `501a30e1…` QA CLEAR

- All five exact-current Chromium/WebKit oracles pass. QA's exact-current production route proved actual u2netp, PURE `0/1/15/0/0`, Offset `0..25`, Simplify `0..300`, visible Detail+Simplify operation, original `2048²` default, capped `1536²` fallback, exact switch-back and a clean console.
- Necessity: no unnecessary elements. Sufficiency: full. Durable verdict and two QA-owned screenshots are stored under `reviews/` and `evidence/KAI-10220-501a30e1/`.
- KAI-10220 advances to Ready for Meta. KAI-10221 remains blocked pending Meta. No QA product-source edit.
- Live Linear recheck confirms KAI-10220 `Ready for Meta`; KAI-10221 remains `Backlog`, blocked by KAI-10220. Verdict delivery to `@s62-pixel-builder` was verified in the peer pane.
# 2026-08-11 — KAI-10284 QA intake

- Pinned exact local/upstream snapshot `1cc2afd2…`, correction base `5c32124b`, live owner contract and six-file `+108/-29` delta. KAI-10284 is In QA review; KAI-10221 remains blocked.
- Independent changed-source, caller, static/build, browser-oracle and current-route visual gates are open. No QA product edit.

# 2026-08-11 — KAI-10284 source checkpoint

- Full changed-source/diff/caller read complete. Paint smoothing is structurally brush-independent and shape-relative; zero is exact-off; one visible diameter maps to Paint ink/cursor and GrabCut seed radius, while existing GrabCut halo/corridor multipliers remain.
- Necessity: the six-file correction has no unrelated product element or parallel owner. Static/build, browser-oracle and QA-owned visual gates remain.

# 2026-08-11 — KAI-10284 static checkpoint

- Focused `3/3` and full serialized `539 pass / 10 declared skip` gates pass, as do typecheck, scoped lint, diff hygiene and production build.
- Browser oracles and QA-owned exact-current visual proof remain; no source finding.

# 2026-08-11 — KAI-10284 QA REVISE

- Product source and owner behavior pass independent source/runtime review. Detector, flow, output and GrabCut oracles pass; exact-current visual proof shows live `0%`→`100%` Paint recalculation and equal `15px` Paint/GrabCut cursor diameters with a clean console.
- Required preservation oracle fails twice on one stale pre-normalization PNG expectation. Smallest rework is proof-only: replace that exact expected PNG with deterministic current bytes and rerun; no product edit.
- KAI-10284 returns to Builder; KAI-10221 stays blocked.

# 2026-08-11 — KAI-10284 superseding QA CLEAR

- Corrected exact authority is `89e23e24af5c0e8f2ee36c651f0b60f5be31619b`; local/upstream/Linear agree. Only the stale preservation expected width/hash changed; no product source.
- Preservation, `539/10` suite, typecheck, verifier lint, diff check and production build pass. Exact-current QA visual proves live Paint `0%`→`100%` recalculation with zero console problems.
- Necessity: no unnecessary elements. Sufficiency: full. QA closes KAI-10284 and releases KAI-10221; no Meta in Session 62.

# 2026-08-11 — KAI-10221 QA intake

- Pinned exact local/upstream snapshot `97ddfb39…`, corrected 177-line contract SHA `c63f70e8…`, live owner correction and 18-file `+1660/-1038` closure delta. KAI-10221 is In QA review.
- Verified the replayed KAI-10284 head has the exact same tree as cleared `89e23e24…`; the non-ancestor commit graph did not lose cleared behavior.
- Independent full source/ownership/generated-record/static/browser/current-runtime/device audit is open. No QA product edit.

# 2026-08-11 — KAI-10221 QA HOLD

- Portable source cutover, one-owner map, result boundary, no-Grid boundary and generated closure are source-clean. The exact generated record reproduces byte-for-byte after the production build.
- Full `541 pass / 10 declared skip` suite, typecheck, scoped lint, diff hygiene, build and all five Chromium/WebKit oracles pass. QA-owned exact-current production proof completed Upload → u2netp Detect with Save/Preview enabled and zero console problems.
- Necessity: no unnecessary elements. Code/runtime sufficiency: full. Sprint closure is HOLD only for the contract's missing final physical-iPhone integrated journey with Low Power off/on and recorded device/browser/input-output metadata. KAI-10221 remains In QA review; no Builder rework and no Meta in Session 62.

# 2026-08-11 — KAI-10221 Paint Autotune QA intake

- Pinned superseding local/upstream snapshot `e3d713c3…`; Dan's physical-iPhone Low Power off/on pass resolves the prior external HOLD.
- New bounded closure gate: independently prove Paint centre-line Autotune 0 raw fidelity, jitter removal, near-straight straightening, deliberate-curve continuity, brush-diameter independence, distinct Mask smoothing, independent AI/GrabCut state, unchanged portable/Grid boundary and regenerated closure. KAI-10221 is In QA review; no QA product edit.

# 2026-08-11 — KAI-10221 Paint Autotune QA REVISE

- Product correction is source/runtime clean and bounded. Full `543/10`, typecheck, lint, diff, build, byte-exact closure regeneration, preservation, detector, flow and output gates pass. QA current visual proves 39→6 outline nodes at 0→100, continuous tuned line, separate 0% Mask smoothing and clean console.
- One proof-only blocker: the existing Chromium/WebKit GrabCut/Paint oracle still queries removed label `Paint smoothing`, so it aborts before its accumulated journey. Smallest correction is one existing-script update: use `Paint mask smoothing`, add/assert `Paint autotune` default 100 and range 0..100, rerun. No product rework. Necessity clean; sufficiency partial only on this stale oracle.

# 2026-08-11 — KAI-10221 `e3d713c3…` superseded

- Before QA verdict delivery, Dan ruled from the physical iPhone that editing must remain original-resolution and that the current Autotune/Mask smoothing do not fix the visible Paint result. The `e3d713c3…` candidate and its proof-only REVISE are historical.
- KAI-10221 stays Building. QA stops until a new exact pushed snapshot; next review carries forward the stale GrabCut/Paint accessible-name/control proof. No QA product edit.

# 2026-08-11 — KAI-10221 `e8cf49b9…` QA intake

- Pinned exact local/upstream candidate and 12-file `+103/-206` delta. Current gate covers the owner-mandated original-resolution cutover plus the reduced Paint calibration surface and shared Paint vector recipe.
- First pass is deletion/ownership proof, then exact-current static/browser/visual gates. No QA product edit; no Meta in Session 62.

# 2026-08-11 — KAI-10221 final QA CLEAR

- Exact `e8cf49b9…` is source/runtime clear. Display/capped and duplicate Paint-width paths are deleted; original artwork owns every live/output compose; Paint has the two agreed controls plus the existing independent Simplify-15 Vector recipe.
- `544/10`, typecheck/lint/diff/build, byte-exact 40-file closure, preservation/detector/flow/output/Chromium+WebKit GrabCut and QA exact-current visual all pass. Necessity clean; sufficiency full. QA closes the sprint task; no Meta.

# 2026-08-11 — KAI-10285 QA intake

- Builder/Linear candidate SHA is mistyped; actual local/upstream head is `982504db8e11328f0e72e0e514ff132e89675630`. QA is auditing that exact six-file correction and requires the tracker to be corrected before closure.
- Scope is Paint-negative resolution/subtraction, untouched surviving-main recipe, CLASSIC default and GrabCut erase regression proof only. No QA product edit; no Meta.

# 2026-08-11 — KAI-10285 QA REVISE

- Exact corrected candidate `982504db8e11328f0e72e0e514ff132e89675630` fails the owner invariant on the real current route: a small Paint erase over an accepted standalone GrabCut cut changes 63,973 canvas pixels outside a generous central erase region and replaces visible CLASSIC with CUSTOM `0/0/15/0/0`.
- Source cause: the resolved negative is subtracted correctly, then `acceptMask(shapeTruth: true, finishSettings: ZERO_SETTINGS)` traces and rasterizes the entire surviving mask. The builder oracle covers only a Paint-created base and inequality, not untouched AI/GrabCut geometry.
- Smallest rework: preserve the accepted main/source/recipe, avoid whole-main shape-truth normalization after negative subtraction, and add exact outside-negative/current-recipe proof. GrabCut product code remains byte-identical; no second engine or GrabCut edit.
- Necessity: shrink unreachable duplicate erase handling. Sufficiency: partial. KAI-10285 returns to Builder; S62 remains QA-only.

# 2026-08-11 — KAI-10285 `c2c25331…` QA REVISE

- Exact local/upstream correction was reviewed on the real current route. Boundary-crossing erase retains CLASSIC and no longer fragments, but Clipper flattens/rebuilds the whole accepted curve: editable nodes jump `26 → 269`.
- Undo differs from the pre-erase canvas by 7,524 pixels; Redo differs from the accepted erased canvas by 448. Source confirms complete-subject flattening/corner reconstruction and history preparation from that reconstructed vector rather than the stored mask.
- Focused 46 tests pass because the new unit case is rectangular and the route oracle permits 10,000 outside-edit pixels without checking handles or exact history.
- Necessity: replace only the whole-subject rebuild/permissive proof. Sufficiency: partial; local cut and recipe pass, untouched geometry and exact history fail. QA record/evidence/probe are the authorised snapshot; no product source edited.

# 2026-08-11 — KAI-10285 `d63a2a6c…` QA REVISE

- Exact current production route proves `closeFrac: 0` is insufficient: the near-returning U changes 12,247/15,376 loop-interior pixels and visibly leaves only the car's front section. `finishMask → traceContourRaw` drops the ribbon's inner contour, turning it into a filled negative before Paper subtraction.
- The committed oracle passes the destructive result because its local box covers the loop interior and its node assertion permits reduction. Default CLASSIC Undo also remains 455 pixels non-exact; Redo is exact.
- Focused 47, serialized 548/10, typecheck/lint/diff/build, byte-exact closure, preservation, original output and raw Chromium/WebKit GrabCut pass. Necessity: no new owner. Sufficiency: partial on ribbon topology and CLASSIC history. QA returns KAI-10285 to Builder; no product source edit.
