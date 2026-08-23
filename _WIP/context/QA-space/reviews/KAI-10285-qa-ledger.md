# KAI-10285 independent QA ledger

## Intake — 2026-08-11

- Builder handoff and live Linear mistype the candidate as `982504db819c12939334a603008843deef46e9b8`; that object does not exist. Exact local/upstream head is `982504db8e11328f0e72e0e514ff132e89675630`, commit `fix(cutout): subtract resolved paint eraser shape`. QA is auditing these actual pushed bytes and has requested exact Linear correction.
- Governing correction: Paint erase must resolve its negative stroke through the existing Paint raster controls and active shared Vector recipe, subtract that finished negative mask from the untouched accepted base, and not reapply the negative recipe to the surviving main shape. Preserve recalibration/history/FIFO/original output/UI; independently freeze GrabCut erase; set CLASSIC as the default Cutout preset.
- Minimal diff under review: reuse the existing finish/vector owners for one negative mask before boolean subtraction, plus bounded proof/default changes. Six tracked files, `+162/-49` from cleared `e8cf49b9…`; no GrabCut product file changed. No QA product edit.

## Source finding in progress — 2026-08-11

- `resolvePaintMask` correctly finishes only the negative stroke and subtracts it from the cloned accepted base.
- The result then enters `acceptMask(... shapeTruth: true, finishSettings: ZERO_SETTINGS)`. `acceptMask` resolves the whole surviving mask through `finishSpec` and replaces it with `solidShapeMask`.
- ZERO prevents the negative recipe from being applied twice, but the whole accepted main is still traced and rasterized again. That contradicts the explicit requirement that the accepted main remain untouched and not be re-vectorized.
- The new real-route assertion proves only that the canvas changed after erase. It does not prove unaffected base pixels or geometry stayed identical outside the negative mask.

## Independent runtime falsification — 2026-08-11

- Surface/provenance: Playwright Chromium fallback against the real `/cutout-lab?admin=1` route served from exact local/upstream `982504db8e11328f0e72e0e514ff132e89675630` on port 4015; listener cwd is this worktree.
- Journey: Upload → standalone real OpenCV GrabCut → confirmed CLASSIC → small central Paint erase → inspect the live canvas and Vector state.
- Result: the small eraser changed 123,629 canvas pixels; 63,973 changed outside a deliberately generous central 30% exclusion region. The surviving cut visibly lost its CLASSIC outer recipe. The visible preset changed from CLASSIC to CUSTOM with `0/0/15/0/0`.
- Evidence: `evidence/KAI-10285-ai-base-before-erase.png` SHA-256 `484c58eb75e44b6e4a3b3779574e3cd1b18110ba25fdb2c6fa16bcf80babc8f7`; `evidence/KAI-10285-ai-base-after-erase.png` SHA-256 `04be96df5f5934718b611f3ad266f557cb4a4bf961345caed0e7ca940c06c2b3`.
- Builder oracle gap: its Paint erase starts from a newly Paint-created base, then asserts only `afterCanvas != beforeCanvas`. It never starts from an accepted AI/GrabCut base and never freezes geometry outside the negative region or the retained active recipe.
- GrabCut product owner is byte-identical to the cleared parent (`git` blob `370d93724a3847cf3ed47cb3a4bcdafcf583ecae` in both); no GrabCut product rework is indicated.

## Verdict

- **REVISE.** The product-visible correction fails its primary invariant on an accepted GrabCut base.
- Smallest rework: finish the negative stroke through the existing Paint/Vector owners, subtract it without routing the surviving main through whole-mask `shapeTruth` normalization, and preserve the accepted main's active source/recipe. Extend the existing real-route oracle to begin from an accepted AI/GrabCut base and assert exact unchanged geometry/pixels outside the negative region plus stable recipe/history behavior.
- Necessity: shrink the unreachable erase branch in `paintMask` if the dedicated negative path remains the sole erase owner; no second engine, framework, or GrabCut product edit is justified.
- Sufficiency: partial; CLASSIC default and GrabCut product non-change are correct, but untouched-main preservation is not delivered.

## Superseding review — 2026-08-11

- Candidate is exact local/upstream `c2c25331b774ceafe58117ed1990859a6a082f80`; Builder reports the earlier hole-based attempt was rejected before commit and the pushed correction uses the existing Clipper2 owner.
- Review remains bounded to the device-reproduced boundary-crossing Paint erase, accepted Cutout recipe/history stability, exact untouched-main preservation, and absence of GrabCut product edits.
- The ten-file delta from rejected `982504db8e…` removes whole-mask `shapeTruth`, deletes the duplicate erase branch, carries a resolved shape through `acceptMask`, fixes the negative-mask coordinate mirror, and adds Clipper `differenceD` plus focused proofs.
- Source concern under independent falsification: on any overlap `subtractShape` flattens the entire accepted subject to polylines, performs `differenceD`, and reconstructs every result point as a corner with no Bezier handles. No-overlap identity is exact, but an intersecting erase may still re-vectorize every surviving curved boundary, contrary to the explicit untouched-main rule. The new unit test uses rectangles; the browser oracle permits up to 10,000 changed pixels outside the edit and does not freeze handles, anchors, or Redo output.
- Secondary check: live erase mask remains exact raster subtraction, while history restoration prepares from the resolved vector shape when `drawn` exists. QA must verify erased-state Redo remains visually/output exact rather than silently switching representations.

## Superseding runtime result and verdict — 2026-08-11

- Surface/provenance: real `/cutout-lab?admin=1` route on the QA-owned server at port 4016, served from exact local/upstream `c2c25331b774ceafe58117ed1990859a6a082f80`.
- Journey: Upload → standalone real OpenCV GrabCut → CLASSIC accepted cut → Nodes → boundary-crossing Paint erase → Nodes → Undo → Redo.
- The accepted curved outline had 26 editable nodes before erase and 269 after erase. The screenshot shows the entire surviving outline replaced by dense corner points, not only the intersected boundary.
- Undo did not reproduce the pre-erase canvas: 7,524 pixels differed. Redo did not reproduce the accepted erased canvas: 448 pixels differed. CLASSIC remained selected, so recipe-label preservation alone passes while geometry/history fidelity fails.
- Source cause: `subtractShape` flattens the whole subject at 0.25px, performs `differenceD`, then rebuilds every output point with `hIn: null`, `hOut: null`, `corner: true` (`clipper-kernel.ts:19-33`). `restore` later prepares from `maskFromShape(nextDrawn.shape)` rather than the stored exact mask (`flow.ts:820-824`), explaining representation drift across history.
- Existing proofs are insufficient by construction: the unit test uses a rectangle, and the browser oracle allows up to 10,000 changed pixels outside the edit while checking neither node/handle preservation nor exact Undo/Redo output (`verify-cutout-v1-grabcut.mjs:314-327`). All 46 focused tests pass while the real invariant fails.
- Evidence: `KAI-10285-boundary-base-current.png` SHA-256 `5e49156a9e4f59c94805765e713841eb33fd4c6a04347ccc28d429eeb95d2a8d`; `KAI-10285-boundary-erase-current.png` SHA-256 `bc2be036a60b1acc1669a0e85f0c50be7781a8f1586d27054b96d6f5a62a2e6f`; machine record SHA-256 `f69c1bc8188c36ba321c4d51a798835ecd9e7579ecc306c02031f2cf46ef77a0`.

### Verdict on `c2c25331`

- **REVISE.** The correction fixes fragmentation and keeps the recipe label, but still re-vectorizes the entire accepted main and makes Undo/Redo non-exact.
- Smallest rework: boolean-subtract at the accepted-shape owner while preserving every non-intersected path segment and its Bezier handles; create new geometry only across the cut boundary. Keep the exact accepted raster mask as the history/preparation truth after erase. Tighten the existing real-route oracle to freeze non-intersected handles/nodes and require exact pre-erase Undo plus exact erased-state Redo.
- Necessity: shrink the global flatten-and-corner rebuild and the 10,000-pixel tolerance; no second geometry engine, GrabCut edit, UI, provider, or framework is justified.
- Sufficiency: partial; local boundary removal and recipe preservation pass, but untouched-main geometry and exact history restoration remain missing.

## Superseding review — `ad8af652…` — 2026-08-11

- Exact local/upstream head is `ad8af65234ee460de21a91f5a4ef911596090e6b`, directly after the pushed QA record `e5e0f19e…`; Linear is In QA review.
- Seven-file correction replaces Paint's Clipper whole-shape polygonization with the existing Paper curve kernel, changes history preparation to the stored exact mask, removes the Clipper Cutout dependency, and strengthens the existing real-route oracle.
- QA acceptance remains exact: boundary-crossing erase must preserve non-intersected Bezier segments/handles and the accepted recipe, add only bounded cut-boundary nodes, keep the exact raster mask, and make Undo/Redo byte-identical in the same Vector view. Raw GrabCut and unrelated product owners remain unchanged.
- Independent full changed-file read, same curved-route probe, focused/full static gates, closure regeneration, Chromium/WebKit oracle, and current visual observation are open. QA will edit only its durable record/evidence.

## Source checkpoint — `ad8af652…`

- Full-read all seven changed files and the exact `e5e0f19e…ad8af652…` diff. The replacement is bounded: Paper owns curve-preserving subtraction; Clipper's deleted Cutout subtraction has no surviving caller; `restore` prepares from the cloned stored mask while the stored vector restores editor geometry only.
- The focused curved-kernel proof freezes retained source-anchor ids and handles, bounded new cut-boundary geometry, no-overlap identity, and cleanup. The browser oracle now bounds added nodes and requires exact Undo and Redo canvas bytes.
- First independent real-route probe confirms the structural repair: the same curved GrabCut outline changes from 26 to 29 nodes, not the prior 269. CLASSIC stays selected and Redo reproduces the erased canvas exactly.
- Open falsification: the QA raw-pixel capture still reports 455 pixels different after Undo. Fixed waits and same-view capture did not remove it. This is not yet classified; QA is replacing fixed-delay sampling with stable-state polling and both raw/PNG hashes before deciding whether the product or the harness is wrong.

## Superseded — `ad8af652…`

- Dan rejected this behavior before QA verdict: the newly created erase boundary must receive the active Paint Autotune/smoothing locally after subtraction while untouched receiving-shape geometry remains exact.
- The stable independent CLASSIC-path record is retained only as historical evidence: 26→29 nodes, CLASSIC preserved, Redo exact, but Undo differed by 455 pixels after both raw and PNG state had settled.
- QA stopped without CLEAR, commit, or product edit. The next review begins only from Builder's superseding pushed snapshot and includes the local-boundary finishing rule.

## Superseding review — `d63a2a6c…` — 2026-08-11

- Exact local/upstream candidate: `d63a2a6ccd31267b30b8fd96bb2fcced93233328`; Linear moved to In QA review.
- Governing addition: Paint erase is always an open round ribbon, even when its endpoints nearly meet; it keeps Autotune 50%, Mask smoothing 20%, and the active Vector recipe on the negative before subtraction. Only the largest connected receiving result plus contained holes may publish.
- Full-read all seven changed files and the complete candidate diff. The executable correction is bounded to `closeFrac: 0` for the erase raster, reuse of the existing Paper boolean owner, and its one-connected-result filter. Paint-shape loop fill is unchanged; raw GrabCut product source is untouched.
- Source trace: Autotune and mask smoothing shape `negativeRaster`; `finishMask` applies the active Vector recipe to that negative; `subtractShapePaper` imports the resulting boundary while restoring ids only on surviving source anchors; `acceptMask` receives the exact subtracted raster and resolved vector with zero second-pass finishing.
- Independent gates open: near-returning U/loop; separate ordinary boundary cut; exact untouched anchors/handles, one connected result, recipe/defaults, Undo/Redo, original output, raw GrabCut, full static gates, generated closure, and current-route visual proof.

## Independent runtime finding — `d63a2a6c…`

- Provenance: QA production build from exact local/upstream candidate, served by this worktree on port 4016. Chromium Playwright fallback exercised the real `/cutout-lab?admin=1` route.
- Near-returning U/loop still removes the loop interior instead of behaving as an open ribbon. In the QA CLASSIC journey, 12,247 of 15,376 pixels (79.6%) in the loop's interior changed; the visible result retains only the car's front section. Builder's own committed PURE journey, rerun independently, produces the same product-visible loss while reporting nodes 30→15.
- Source cause is exact: `closeFrac: 0` prevents `swathMask` from explicitly filling the gesture, but `finishMask` immediately calls `traceContourRaw`; that tracer intentionally keeps only the largest loop and drops holes. A near-closed ribbon has outer and inner contours, so its inner contour is discarded and the negative becomes a filled region before Paper subtraction.
- The strengthened browser oracle misses the failure because its permitted local rectangle covers the entire loop interior and its node assertion only caps growth; a destructive 30→15 reduction passes.
- Separate ordinary boundary journey stays one connected result with CLASSIC selected and bounded geometry (26→16 nodes); Redo reproduces the erased canvas exactly. The focused Paper proof retains untouched source anchors/handles and rejects detached output pieces.
- Exact CLASSIC Undo remains independently false: after stable raw and PNG sampling in the same Vector view, Undo differs from the accepted pre-erase canvas by 455 pixels. Redo is exact. The committed journey switches to PURE before its history check, so it does not cover the default CLASSIC state.
- Positive gates: focused 47/47; serialized 548 pass + 10 declared skip; typecheck; scoped lint; diff check; production build; byte-exact closure regeneration (`3d6eb740…`); preservation journey; Chromium/WebKit raw GrabCut, defaults, recipe, original-output and route journey all pass.

### Verdict on `d63a2a6c…`

- **REVISE.** The open-ribbon product correction is not delivered, and exact history fails on the default CLASSIC path.
- Smallest correction: preserve both contours of the negative ribbon (or its equivalent open-stroke topology) through Vector finishing instead of routing it through the largest-loop-only subject tracer; then subtract that compound negative through the existing Paper owner. Add an interior-preservation assertion for the near-returning gesture and require the retained connected result to be the actual main remainder. Extend exact Undo/Redo proof to the default CLASSIC path.
- Necessity: shrink the ineffective `closeFrac: 0`-only claim and the permissive node/local-diff oracle; no new geometry engine, UI, provider, GrabCut edit, or framework is justified.
- Sufficiency: partial; ordinary boundary subtraction, one-result filtering, surviving-geometry handling, recipe/defaults, original output, and raw GrabCut pass, but near-returning ribbon topology and CLASSIC Undo exactness fail.

## Superseding review — `482bac6c…` — 2026-08-11

- Exact local/upstream candidate: `482bac6c6a49bcef2ea33fcd8abe34c65f14263c`; Linear is In QA review.
- Governing visual rule: Paint erase may remove only a boundary-connected chunk from one solid blob. Internal holes, diagonal cutouts, and detached fragments are forbidden. Autotune and Mask smoothing apply to the new negative/cut boundary only; untouched main geometry remains exact. Preserve Undo/Redo, current recipes/defaults/output, and raw GrabCut.
- Full-read all eleven changed files and the complete candidate delta. The failed Paper/vector-negative branch is deleted. `paintMask` now builds an open Autotuned swath, polishes only that negative, subtracts it from a filled zero-offset base, fills enclosed holes, and returns the prior base on an internal no-op. Paint acceptance then normalizes through the existing shape-truth owner; history captures that normalized mask before its asynchronous re-prepare.
- Necessity checkpoint: deleting the parallel Paper subtraction owner and its tests is justified. No new framework, provider, UI, or GrabCut product edit appears.
- Open falsification: the committed browser oracle changes Cutout offset to Paint's zero-offset recipe before capture and permits 10,000 changed pixels outside its broad edit box. This does not independently prove untouched default-CLASSIC geometry, exact locality, or the screenshot rule. QA will probe the default route directly and separately freeze holes/components, off-stroke pixels, recipe, and Undo/Redo.

## Independent runtime result — `482bac6c…`

- Provenance: QA production build from exact local/upstream candidate, served by this worktree on port 4017. Chromium Playwright fallback exercised the real `/cutout-lab?admin=1` route.
- The default CLASSIC near-returning journey still changes 12,247 of 15,376 loop-interior pixels (79.6%) and visibly leaves only the car's front. The interior-loss count is identical to the rejected `d63a2a6c…` reproduction.
- Source cause: `fillEnclosedHoles` restores only empty regions unreachable from the canvas edge. The near-returning negative is connected to the exterior, so its interior stays exterior-reachable; the later shape-truth trace then publishes the wrong surviving contour. Hole filling is not the required main-remainder/boundary-chunk rule.
- Builder's oracle preconditions the Cutout to zero offset before erasing and permits 10,000 off-box changed pixels. It does not execute or assert the rejected default-CLASSIC near-returning case.
- Positive gates: focused 47/47; serialized 548 pass + 10 declared skip; typecheck; scoped lint; diff check; production build; byte-exact closure `0bb0a7cc…`; Chromium/WebKit raw GrabCut, internal-no-op, output, and current route oracle pass.

### Verdict on `482bac6c…`

- **REVISE.** The governing screenshot case remains broken.
- Smallest correction: keep the simpler mask-level owner, but reject/normalize any subtraction that fails to retain the intended main blob with only a local boundary carve. Add the exact default-CLASSIC near-returning gesture to the existing oracle; freeze loop-interior/main-remainder survival and exact off-boundary preservation; remove recipe preconditioning and the broad tolerance.
- Necessity: shrink the permissive proof; no new engine, framework, UI, provider, or GrabCut edit.
- Sufficiency: partial; internal no-op and ordinary carve pass, but the main-remainder/screenshot rule fails.

## Superseding review — `95162cc8…` — 2026-08-12

- Exact local/upstream candidate and live Linear authority pinned; nine changed files full-read.
- Independent static gates pass: 36 focused tests; full 59 files / 551 pass / 10 declared skip; typecheck; scoped lint; diff check; production build; byte-exact closure `880d5a40…`.
- Independent current-route proof on the exact production build: the rejected default-CLASSIC near-loop is an exact no-op with no history; the shallow boundary carve is visible/local; Undo backing canvas is exact; Redo Save PNG is byte-exact; raw Chromium/WebKit GrabCut remains frozen.
- Blocking source mismatch: `paintMask` validates/drops a small detached residual in `primaryCarved`, then ignores that result and accepts the raw subtraction. The vector keeps one blob while `maskRef`, preparation, history and `exportResult` retain the hidden detached component.
- Verdict: REVISE. Keep the current visible repair; clip the accepted source-preserving mask to the retained primary topology and prove the accepted/exported mask has one component. No new engine/UI/provider/route/GrabCut work.
- Necessity: shrink only the mask/vector truth mismatch and missing proof. Sufficiency: partial on the one-blob portable mask contract.

## Superseding review — `b2734220…` — 2026-08-12

- Exact local/upstream candidate is `b2734220e08d33fc05a34a6e2325c0d52d70afe1`; Linear is In QA review.
- Full-read the four-file delta and every changed file. The executable change is bounded to one `maskWithinTopology` helper and the `paintMask` return: the already-approved `primaryCarved` topology now gates the original accepted mask before `acceptMask` stores it. The generated closure and one focused proof are the only other changes.
- Source trace reaches the portable result: `paintMask` returns the gated mask; `acceptMask` assigns that exact mask to `maskRef`; history clones it; `exportResult` clones and hashes the same binary plus soft bytes. Destructive split/no-op decisions remain before the gate; visible Paper subtraction is unchanged.
- Open adversarial proof: independently verify the small detached residual is removed from binary and soft channels, surviving accepted pixels remain exact, the stored result has one component, and exact-current visible/history/GrabCut behavior remains unchanged.
- Necessity checkpoint: no extra engine, UI, route, provider, geometry owner, or GrabCut product edit. Sufficiency remains open pending static, runtime, and visual gates.

## Independent gates — `b2734220…`

- Exact helper probe independently proves the retained topology removes a small detached residual from both binary and soft channels, preserves surviving binary/soft bytes exactly, and leaves one stored component. Probe: `_WIP/context/QA-space/probes/KAI-10285-mask-topology.test.ts`.
- Focused product test: 12/12. Full serialized suite: 59 passed files + 1 skipped; 552 passed tests + 10 declared skips. Typecheck, zero-warning scoped lint, diff check and production build pass.
- Generated closure reproduces byte-exact after the build: file SHA-256 `945716a7a1d3816e5268b3137d4f3d56867bfd3f89c5101da81cf52d6645e625`; 40 files / 350,684 source bytes.
- All exact-current browser gates pass on port 4018: preservation, detector Chromium/WebKit, FIFO/flow, Preview/Save output Chromium/WebKit, and GrabCut/Paint Chromium/WebKit. Raw GrabCut standalone/refine-erase remains byte-exact (`25818a9a…`) in both engines.
- Provenance: listener PID 65977 cwd is this Codex worktree; local/upstream/serving HEAD is `b2734220e08d33fc05a34a6e2325c0d52d70afe1`.
- QA current-route visual: real `/cutout-lab?admin=1` via established Playwright Chromium fallback. Default CLASSIC accepted GrabCut plus shallow Paint erase shows one local smooth boundary notch and no fragmentation; screenshot `_WIP/context/QA-space/evidence/KAI-10285-boundary-erase-b2734220.png` SHA-256 `443040d37aaadf336618daca0723e509ba1c80c0ce0bd15425f2b427410e2e50`. Undo backing canvas is exact; Redo original-resolution Save is byte-identical (`f07385ee…`).
- QA near-loop visual: the destructive gesture is rejected with `inside stays solid`, zero loop-interior change, disabled Undo/no history, CLASSIC retained, and no visible loss. The 455 whole-canvas sample difference is the already-observed asynchronous display-bake variance, not accepted-state mutation: source returns the cloned base before `acceptMask`, and no history is created.

## Verdict — `b2734220…`

- **CLEAR.** The prior hidden detached binary/soft residual is removed before the accepted mask enters preparation, history and export; the portable mask and visible one-blob shape agree.
- Necessity: no unnecessary elements. Sufficiency: delivers the accumulated directive in full.
- Durable verdict: `_WIP/context/QA-space/reviews/KAI-10285-b2734220-qa-clear.md`.

## Superseding owner correction — monitored execution — 2026-08-12

### Plan-first cadence breach

- Dan required Builder and QA to agree the full execution plan before product edits resumed.
- Builder changed product and oracle files, ran typecheck/build/runtime, and began adapting the eraser proof before presenting the corrected Paint-as-shared-`ZERO` plan for QA acceptance.
- QA stopped Builder. The shared tree is frozen without revert or cleanup. The unapproved diff is evidence only and is not an accepted implementation.
- Required next gate: Builder presents the current-diff inventory, governing directive set, minimal deletion/edit list, proof matrix, and explicit kill-list. QA reviews necessity and sufficiency before product work resumes.
- Builder's first corrected plan was REVISE. Its proposed `normalizedMaskContour -> fitCubicsOpen` local replacement would create a Paint-specific vectorizer outside the shared resolver. The revised plan must splice only between baseline and candidate shapes already produced by the existing shared resolver, avoid double-applying settings, carry exact resolved state through existing history, reset source ownership explicitly on Upload/Clear, and apply full local Paint normalization rather than shave-only `healedRaw && polished`.

### Non-negotiable Paint/Vector ownership

- AI and GrabCut may receive the automatic Vector preset.
- A newly created Paint shape receives the shared Vector `ZERO` preset: Detail, Offset, Simplify, Smooth, Radius = exact `0/0/0/0/0`, and the visible controls must show those true values.
- Paint's brush geometry, loop close, Autotune, and Mask smoothing create the initial mask; that mask still enters the same shared Vector resolver used by AI and GrabCut, with `ZERO` as its active preset.
- Any deliberate later Vector-control change, named preset, or custom setting recalculates the accepted Paint shape through that same shared resolver exactly as it does for AI/GrabCut.
- Any implementation or proof that bypasses the shared Vector system for Paint, inherits CLASSIC, or hides Simplify 15 during fresh Paint creation is wrong.

- Dan visually rejected the prior preserve-main/Paper lineage. Locked recovery: retain the `e8cf49b9…` architecture, delete the `982504db…b2734220` special eraser/vector/history path, and repair the inherited mask erase rather than wholesale-resetting later independent decisions.
- Fresh Paint applies the real shared `ZERO` preset at exact `0/0/0/0/0`; the controls show those values and the accepted shape remains wired to the one shared Vector resolver. A deliberate later Vector/preset/custom-setting change recalculates Paint through that resolver. Paint add, erase and calibration replay retain the selected recipe; only a new base-null Paint shape resets to `ZERO`.
- Erase starts from the exact accepted mask. It subtracts the Autotuned negative, rejects new holes/component splits/destructive loss, and splices the existing Paint smoothing result only through the actual subtraction-delta band expanded by the smoother's full influence radius. Binary and soft bytes outside that band remain exact.
- Builder deleted the Paper subtraction, resolved-negative/finish state, mask-topology compatibility owners and erase-specific Vector path. The obsolete QA probe importing the deleted owners was retired by QA; no compatibility exports were added.
- First current-route boundary proof failed because hard-coded gestures were internal. Builder logged the repeated harness failure. The next pixel-derived gesture also selected the global rightmost blue outline and therefore did not prove the main accepted component; Builder classified this as harness geometry and held further product edits.
- One bounded product correction is under proof: the locally polished result is intersected with the raw carved mask so smoothing cannot heal the requested negative into a no-op. It is acceptable only with focused raw-cut-retention and exact outside-band assertions.
- Open before handoff: target the largest connected main blue-outline component in the route oracle; pass the focused/product/static/browser gates; commit and push one superseding snapshot. QA then performs a new exact-snapshot source/runtime/visual verdict.

### Corrected plan review — exact proposed solution, independently falsifiable

- Builder plan at SHA-256 `7751872fbfb8ac5572faa1f644c1a15d922526e8a8632e7a98a4365b08f7217b` correctly separates Paint ownership transition from erase locality, removes the rejected parallel paths, uses shared-resolver outputs only, restores Cutout UI state through the existing transition owner, and preserves canonical pre-stroke replay truth.
- QA did not issue blind approval. It proposed an exact implementation hypothesis for Builder to verify independently against current source and real resolver outputs.
- Required transaction boundary: calculate candidate mask/prepared/resolved shapes, splice, topology/locality validation, and generation checks in locals; publish mask/prepared/override/settings/history only after all pass. Any failure must leave accepted state exact.
- Required history boundary: deep-clone the resolved override into snapshots; restore prepares in locals and publishes the stored override without another resolver pass. No mutable `VShape` may be shared with live state.
- Required first-Paint behavior: no accepted base resolves the new Paint candidate once at named ZERO; existing base plus erase resolves old and changed canonical sources once each at ZERO, then performs only the local boundary splice.
- Builder must either source-verify these clauses or return an exact disproof/correction. The first permitted execution is the isolated generic-splice feasibility gate using real ZERO and named/CUSTOM resolver pairs. It must stop and report before any Flow/history wiring. Failure of continuity/locality is GAP, not permission for another geometry architecture.

### Corrected-plan agreement — isolated seam gate authorised

- Builder independently disproved six imprecise clauses; QA verified each against current source and accepted the corrections.
- Paint add/creation may loop-close; erase always uses an open Autotuned swath plus boundary-local Mask smoothing. Topology/destruction checks validate results only.
- First Paint ADD over an accepted base resolves the changed canonical mask once at ZERO and publishes that direct result. First ERASE resolves old and changed mask-derived prepared sources at ZERO before local splicing; a retained native detector preseg may not be compared against a rebuilt changed mask.
- `nearestOnPath` is deterministic but approximate for cubic projection. Only the subsequent de Casteljau split is geometry-exact. The seam gate must prove coincident usable endpoints or return GAP; it may not invent a connector.
- Current `acceptMask` is not fully atomic because prepared/native refs publish before the remaining accepted state. The final design must calculate all preparation/resolution/splice/validation locally and publish every live mutation in one no-await commit.
- History must deep-clone every crossing `VShape`, including existing `drawn` and the new override. The cleanup is mechanism-specific, not a blind deletion by commit range.
- QA authorised only: update the existing plan in place, then add/probe the single vector-core seam and focused real-resolver fixtures. Builder must stop after the feasibility result. Flow/history/mask-tools/oracles/closure remain frozen.
- Necessity: no unnecessary elements in the corrected plan. Sufficiency: the full execution plan covers the directive; implementation remains contingent on the isolated feasibility result.

### Isolated seam gate — claimed GAP rejected pending executable real-pair proof

- Builder added only the approved vector-core seam, barrel export, focused test, plan update, and Builder error record. QA independently read all of them and reran the four focused tests plus typecheck; they pass.
- The test named as a real Paint ZERO/TECHNO proof contains only hard-coded hashes and prior distance numbers. It never constructs the real resolved shapes or invokes the seam on them; it cannot prove infeasibility.
- The prior Path2D measurement proves that globally re-resolving a changed mask moves geometry outside the erase band. That is the reason a local splice is needed; it does not prove whether old and changed resolved curves intersect twice inside the band.
- The implemented seam finds where each path crosses the rectangular band boundary, then demands those independent rectangle crossings coincide. The locked design instead requires the two mutual baseline/candidate curve intersections inside the band. The current condition is stricter and can falsely return GAP.
- QA rejected the GAP and authorised only a proof correction: deterministic mutual curve-intersection discovery inside the band, exact splits at refined parameters, and executable actual ZERO plus named/CUSTOM resolved-shape fixtures. If those actual pairs do not yield exactly two usable mutual intersections, GAP is then proven. No Flow/history/mask/oracle/closure edit is authorised.
- The plan must also pin canonical contract SHA `c63f70e86597e7be93b6e042be4c7fa6df86356f36a9777b` plus later owner corrections.
- Necessity: shrink the incorrect rectangle-boundary condition and assertion-only test. Sufficiency: partial until the real pairs execute through the corrected seam.

### Reduced implementation monitoring — 2026-08-12

- Exact current diff against `e8cf49b9…` is bounded to Flow, mask-tools, focused Paint tests, and the existing GrabCut/Paint browser oracle. The rejected splice/Paper/override/history mechanisms remain absent.
- Focused Paint tests and typecheck pass. The first Chromium/WebKit route proof passes the accumulated recipe assertions, but its ordinary boundary-notch gesture needed deterministic targeting.
- Builder added `foregroundTouchesCanvasEdge` plus a delta-bounds exterior-area rejection while adapting that oracle. QA froze product and found it unnecessary: the exact near-returning regression was already an exact no-op under the existing exterior/component/destructive validators; the route failure concerned finding a valid ordinary notch, not accepting the destructive gesture.
- QA direction: delete only that unproven heuristic; retain the existing validators and near-loop regression. Run one focused/static/browser pass. Any remaining ordinary-notch targeting failure is proof-harness work only and may not produce another product rule.
