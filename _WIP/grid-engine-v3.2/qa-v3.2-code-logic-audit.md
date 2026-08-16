# Grid engine v3.2 — code and logic audit

**Audit baseline:** `4bf5043a20f93974f08c71242add05664e687c5e` in the isolated Codex worktree.
**Scope:** transcript requirements, complete grid-engine source and test suite, independent probes, and the real `/grid-engine` bench. No engine repair was implemented.

## Verdict

v3.2 is a useful base, not a completable product selector in its current state.

Keep its exact geometry kernel, guarded specification, bridge, UI scaffold, and previously repaired structural laws. Replace the current candidate-search and offer-selection path with the v3.3 certified-placement contract. Continuing to patch the phase flood, templates, mass proxies, and fallback is the longer and less reliable route.

The committed baseline is red: 93/97 tests pass and four canon families regress. Bat Band 4 is also still wrong by Dan's direct visual ruling.

## What works and should stay

1. **Exact geometry predicates.** The compute layer already validates padding, lattice placement, non-overlap, contour containment, and measured wrap. `computePreparedGrid(..., { construction })` is a valid exact proof door for a proposed construction.
2. **Portable engine boundary.** The shell reaches the unit through the bridge; framework and UI concerns are separated from the portable engine files.
3. **Guarded values.** Released values, calibration writers, refusal bounds, and deep-frozen template data are covered by executable guards.
4. **Structural repairs.** Single-linkage connectivity, equality-safe comparison, deterministic stable sorting, and the classifier/geometry separation are present.
5. **UI scaffold.** Upload/library contours, tracing, size controls, grid display, and rendering of every returned `variant` already work. The UI is not limited to one chip.
6. **Known-good lower-band behavior exists.** Independent canon execution at the pre-flood baseline `9123ba3d` passes all 7/7 shape families. The new phase flood, not the underlying exact geometry, caused the current four regressions.

## Problems and precise repairs

### P0 — The new candidate door changes protected lower bands

**Evidence**

- Independent canon run: Duck B3 became `win-2x2·160`, Butterfly B3 `win-2x2·132`, Poke1 B2 `win-1x2·84`, and Poke2 B3 `win-1x3·122`.
- The growth/phase door executes for every band at `logic/judgement.ts:593`, despite Dan protecting the already-correct Bat B1–B3 and approving other existing bands.

**Cause**

The phase flood adds a new candidate universe to all bands, then lets the existing heuristic comparator re-rank it. It was introduced as a Band-4 repair but is not band-scoped.

**Repair**

Remove the phase-enumerated growth door introduced by `6b2f11ae` and the Band-4 allowance introduced by `4bf5043a` from the accepted base. Restore the last green lower-band behavior before installing the replacement solver. Do not re-pin canon tests to the regressed outputs.

The certified replacement may evaluate every band, but it must pass the immutable approved-frame gate before replacing the old path.

### P0 — Bat Band 4 is still not a stepped, tight optimum

**Evidence**

- Live B3@146: face anchor plus a base row of three.
- Live B4@172: the same family plus one chest anchor. Dan explicitly rejected this as no meaningful step.
- Live B4@206: a narrow 2×3 column. Probe measurements are L56/R70/T52/B34. Large parts of the wings and skirt hang outside the held block.
- `B4DEBUG` calls this second candidate lawful; therefore the current hold filters do not imply optimal fit.

**Cause**

The candidate set does not certify the best placement for each stepped window. It only presents templates, a finite phase family, and auto-search outputs to a heuristic comparator.

**Repair**

Implement the v3.3 certified-placement request behind the existing bridge:

1. For each governed band size and lattice/window hypothesis, generate the finite critical placement set required by the v3.3 contract.
2. Prove every returned construction through the existing exact geometry door.
3. Certify the optimum for the window; never substitute one sampled representative for a connected feasible region.
4. Return the certified construction and its window/registration identity to judgement.

The display field is not this solver. `GridCanvas.tsx:100-105` lays out a fixed field, changes the camera view, and counts visible nodes. Its `3×3`, `4×4`, `5×5` readout carries no containment or optimality proof.

### P0 — Tightness is calculated but does not govern selection

**Evidence**

- `tier` is computed at `logic/judgement.ts:160-178` and never used by `better()`.
- Structure and sparse spread decide at `logic/judgement.ts:391-406`.
- Coarse total-wrap comparison does not occur until `logic/judgement.ts:426-440`.
- `allowed` ignores side flap entirely: any candidate with vertical wrap within 28mm is labelled allowed, even with 70mm sides.

**Cause**

The comparator's implementation contradicts the current rule: a placement the shape wraps tightly must beat a loose placement before spread preference.

**Repair**

Replace `better()` with the v3.3 versioned criterion descriptors and comparator. Hard feasibility remains first. Within feasible candidates, the certified tight-fit criterion must be applied before structure/spread, using the contract's exact formulas and tolerances. Do not merely move the current `tier`; its definition is unsound.

At minimum, direct `measureWrap` facts must control fit: per-side extent, maximum side, total, and imbalance. Zero flap wins where attainable; otherwise the certified minimum attainable flap wins.

### P0 — Multiple optimal scale/window answers are discarded

**Evidence**

- `layoutIdentity()` ignores size, window, and registration (`logic/judgement.ts:117-133`). The same topology across those dimensions collapses before offer selection (`:501-510`).
- Every later offer must have strictly more anchors (`:774-790`). A distinct later optimum with equal count is dropped.
- Dan's direct requirement was multiple distinct optimal scale/window answers, including a later Band-4 optimum around 200–216mm. It was not “only outputs with increasing magnet count.”

**Cause**

The code equates arrangement topology with offer identity and then uses increasing count as a proxy for stepped windows.

**Repair**

Use the v3.3 candidate/result identity, including the certified window/scale and registration identity. Group by distinct governed window step, select one certified optimum per step, then deduplicate only exact equivalent offers. Equal-count optima remain valid when their window or placement identity differs.

Remove the `maxOffered` increasing-count ladder. `optionsPerBand` may cap presentation only after the complete ordered optimum set exists; it must not define correctness.

### P0 — A previous band's heuristic winner truncates the next band's search

**Evidence**

`judgeShape()` carries the previous primary answer forward as both `sizeFloorMM` and `prevCount` (`logic/judgement.ts:843-862`). `judgeBand()` then begins one 24mm step above that answer instead of at the governed band minimum (`:517-526`). A loose or wrong earlier winner can therefore hide otherwise valid later-band sizes.

**Cause**

Band separation is implemented as cross-band search pruning. It is not merely an offer-ranking rule.

**Repair**

Certify each governed band/window domain independently. Apply any cross-band echo suppression only after each band's complete optimum set exists. Never use a heuristic winner to truncate another band's feasible domain.

### P0 — The side-mass proxy is dimensionally unstable

**Evidence**

`sideHangMM` divides side material area by the selected anchor block's height (`logic/judgement.ts:479-494`). The same side material receives a smaller “hang” merely by making the anchor block taller.

**Cause**

The denominator is candidate-dependent. A tall column can pass the side law while leaving roughly the same solid side mass unsupported.

**Repair**

Remove `sideHangMM` from selection. Use the v3.3 governed fit descriptors and direct wrap/coverage facts. If a future physical mass model is required, its normalization must be shape-defined and independently calibrated; it cannot depend on the candidate block height.

### P0 — Band 4 silently weakens the top law

**Evidence**

`better()` and the lawful filter change the top bound from 28mm to 40mm whenever `band.stepUp` is true (`logic/judgement.ts:330-336`, `:712-719`). Dan did not set that numeric exception. It was inferred from his description of a bottom-heavy arrangement.

**Repair**

Remove the Band-4 numeric exception. Use only balloted descriptor values from the v3.3 spec. Arrangement shape does not authorize a looser hold law.

### P1 — Fallback can return the thing the stepped-band rule rejected

**Evidence**

When the fresh/growing set is empty, `logic/judgement.ts:793-807` returns the first candidate passing reduced hold filters. It drops the window, echo, symmetry, footprint, and growth requirements.

**Repair**

No fallback may manufacture an optimum. Return no offer or the contract's explicit indeterminate/failure result when certified selection cannot be completed. Preserve the reason for the UI and logs.

### P1 — Current search is not product-viable

**Evidence**

- Seven-shape canon solve: 372 seconds.
- Full engine suite: 637 seconds wall time under concurrent bench use.
- Isolated four-test cutout file: 157 seconds.
- The real bench blocks its UI thread while solving.

**Cause**

Every size runs auto search, every template over a 2mm origin sweep, and a combinatorial subwindow search over several phases.

**Repair**

Do not optimize this brute-force path as the production architecture. Build the bounded certified critical-set solver from the v3.3 blueprint, measure it, and retain the old sweep only as an A/B oracle until equivalence is proved. Offload execution from the UI thread only if the new measured solver still exceeds the interaction budget; do not add a worker pre-emptively.

### P1 — The acceptance oracle is incomplete and internally stale

**Evidence**

- Older Bat yardstick and selection-example documents disagree with the newer direct rulings.
- The actual uploaded contour that exposed the missing 200–216mm optimum is absent from the fixture set.
- Current canon tests mostly pin the primary family, not the required later optimum, tightness, window identity, or failure semantics.

**Repair**

Create immutable acceptance fixtures from the latest direct Dan rulings. Preserve the approved B1–B3 frames. Add the actual uploaded contour and both its approved earlier optima and missing later optimum. Fixtures must be authored from Dan's evidence, never re-pinned from whatever the engine currently returns.

### P2 — Variant UI keys are incomplete

**Evidence**

The React key at `page.tsx:743` contains band, size, count, and layout/pattern, but not registration, coordinates, window identity, or artifact identity.

**Repair**

Once the engine returns the v3.3 result identity, use that stable identity as the chip key. No UI redesign is required.

## Smallest correct implementation path

1. **Restore the base.** Remove only the broken phase-flood, side-mass, and Band-4 40mm exception changes. Re-run the immutable lower-band fixtures.
2. **Install certified placement behind the bridge.** Reuse the exact contour and construction predicates. Do not rewrite the UI or geometry core.
3. **Install the v3.3 comparator and result identity.** One optimum per distinct certified window step; equal-count steps allowed; explicit indeterminate/failure results; no heuristic fallback.
4. **Gate replacement.** Run the approved seven-shape frames, the actual uploaded contour, the v3.3 adversarial counterexamples, byte determinism, and measured performance. Compare the new solver to the old sweep as an oracle only.
5. **Delete the superseded search.** Remove the 2mm template sweep, phase flood, increasing-count ladder, mass proxy, and fallback after the new path passes. Do not ship parallel selectors.
6. **Wire the existing UI.** Keep the scaffold and variant rendering; change only the result identity/key and failure display required by the contract.

## Quarantined experimental commits

Both commits are preserved on branch `session62-task/s62-grid-qa-experimental`. Neither is an accepted repair.

### `077c55f1` — restore canon and add stepped Band-4 layout

What it did:

- Removed the phase flood, side-mass proxy, and inferred 40mm top exception.
- Restored the prior candidate path.
- Added a generic `trapezoid-144x96` six-anchor template and a Bat regression.

What it proved:

- The recent phase/side changes caused the lower-band regressions.
- A 144×96 bottom-heavy six-anchor construction can be seated and exact-validated.

Why it is not the fix:

- A curated template does not solve arbitrary uploaded contours or continuous placement.
- The test is Bat-specific.
- It restores one finite registration path instead of satisfying the v3.3 certified-placement contract.

### `16c6a7e9` — skip impossible template origins

What it did:

- Skipped origins inside the padding-wide bounding-box border before calling exact validation.
- Preserved the 2mm sweep phase because released padding is 12mm, an exact multiple of 2mm.

What it proved:

- A large portion of the template sweep is guaranteed refusal work.

Why it is not the fix:

- It only makes the provisional brute-force path faster.
- That path is superseded by certified placement if v3.3 is implemented correctly.
- Keep it only if the old sweep remains temporarily as an oracle and equivalence tests confirm no accepted origin is removed.

## Execution evidence

- Independent canon gate: 3/7 shape tests pass; 4/7 fail, 372 seconds.
- Independent pre-flood baseline gate at `9123ba3d`: 7/7 shape tests pass, 282 seconds.
- Full suite under concurrent live solve: 92/97; isolated cutout rerun passes 4/4, establishing the stable result as 93/97 with four correctness failures.
- Independent seven-shape winner probe completed for all 28 band answers.
- Independent Bat debug probe completed.
- Live surface: isolated server on port 3064 from this worktree and baseline; real `/grid-engine` route exercised.
- Captures:
  - `.playwright-cli/page-2026-08-16T12-23-34-145Z.png` — approved Bat B3 family.
  - `.playwright-cli/page-2026-08-16T12-23-21-576Z.png` — rejected Bat B4@172 family.
  - `.playwright-cli/page-2026-08-16T12-23-49-013Z.png` — loose Bat B4@206 column.

## Necessity and sufficiency

**Necessity:** no new UI, duplicate engine, donor transplant, template catalogue expansion, mass model, or new policy value is required. Reuse the existing compute kernel, bridge, spec guards, and UI. Replace only the failed search/selection path, then delete it.

**Sufficiency:** the path above covers the whole directive: protected existing answers, certified continuous placement, tight-fit ordering, distinct scale/window optima, exact failure semantics, determinism, performance measurement, and the real uploaded-shape acceptance case. Implementation is not complete until every item passes on the live current build.
