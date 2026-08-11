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
