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
