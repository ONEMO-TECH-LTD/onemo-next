# v3.2 product selector — final consolidated execution proposal

**Owner:** s62-grid-meta-qa

**Status:** QA-corrected proposal. No product code is authorised until T0 clears and Dan gives the build go.
**Inputs compared:** s62-kai `FINAL-PROPOSAL.md` at `e617ae74`; s62-kai-meta `v3.2-final-execution-proposal.md`; both v3.2 QA reports; the amended R3 system/Compute/Logic contracts; product-base; focus spec; current v3.2 code and commit history.

## Decision

Neither submitted proposal governs unchanged.

Kai's proposal is the execution skeleton because it chooses the cleaner recorded base, dispositions the dirty edit, separates removal from replacement, and gives task-level verification. Meta's proposal contributes the reference-only donor boundary and the attack-proven adaptive/certification approach.

The following submitted elements are rejected:

- Meta's `9123ba3d` restore target. It still contains the row/column growth door and count ladder. `60656152` is the earlier, smaller base.
- Kai's finite critical set of feasible-region vertices, canonical projection and directional extrema. It is not complete for the governing criteria.
- Both proposals' claim that only the three focus-spec contradictions, Bat B4 and one missing contour remain Dan-open. The binding R3 hold contains further unresolved/proposed decisions unless later direct rulings are traced as explicit supersessions.
- Both proposals' qualitative comparator. The binding R3 contract requires approved formulas, tolerances, dominance and anchored-restriction semantics; “peel leverage” has no settled numerical definition.
- Any claim that agreement with the old sweep proves completeness. The old sweep is a falsification oracle only.

## Governing boundary

Preserve:

- exact contour preparation;
- BVH distance and y-interval containment acceleration;
- exact construction proof through `computePreparedGrid(..., { construction })`;
- neutral validated measurements whose predicates remain valid;
- guarded configuration, bridge/module boundary and UI scaffold;
- source contours and only those expected frames traceable to Dan's direct rulings.

Replace:

- heuristic candidate search and registration sampling;
- `better()` and its inferred ranking policies;
- offer assembly, topology-only identity and fallback;
- band-target, cross-band truncation, count-growth and fullest-population policies;
- phase/sub-window flood, candidate-dependent side proxy and re-pinned expectations.

Delete after the replacement passes its independent gate:

- 2 mm sweep as production search;
- auto-search and phase/sub-window growth paths;
- count ladder, band target and cross-band pruning;
- side-mass proxy, inferred B4 40 mm exception and heuristic fallback;
- `probe-winners.test.ts`, `probe-bat4.test.ts`, `B4DEBUG` and superseded selector code.

Do not adopt the GPT package. Audit and port only algorithms that survive source-level review and the local gates. No line-count target governs reuse.

## Execution plan

### T0 — close authority before implementation

**Objective:** establish the exact executable rule set. The amended R3 contracts remain binding and place implementation behind Hold A.

**Method:**

1. Map every `PROPOSED_FOR_DAN` and `UNRESOLVED` R3 decision to later direct Dan rulings, with transcript pointers.
2. Mark a row superseded only where a later ruling explicitly conflicts with it.
3. Return only the residual product decisions to Dan. At minimum, verify the effective safety radius/tolerance policy, coordinate quantum and approximation tolerance, size/band offer policy, translation domain, region thresholds, pattern permissions, exact mechanics registry, sub-quantum behaviour, approved Bat vector, input vertex budget and B1 guarantee.
4. Resolve the three focus-spec contradictions against that ledger; the focus spec governs only non-conflicting clauses.
5. Identify the upload behind the missing 200–216 mm case and establish whether its exact contour is an approved fixture.

**Verification:** every executable profile value and comparator rule has one authority pointer; no unresolved field enters production mode; the residual Dan decision list contains no already-answered question.

**Gate:** no backend probe or implementation starts before this task clears and Dan gives the build go.

### T1 — restore and subtract to a clean base

**Objective:** remove known-bad policy without carrying the current dirty edit.

**Method:**

1. Discard the uncommitted `judgement.ts` mass-tier/label edit; it belongs to the superseded selector.
2. Restore `src/lib/grid-engine/` forward from `60656152`; do not reset history or re-pin fixtures.
3. In one bounded removal change, delete `targetMagnets`, sparse-spread ranking, count-direction flip, fullest-per-footprint, `sizeFloorMM`/`prevCount`, `maxOffered`, `maxTestedMM`, the old out-counting policy and assertion-free probe/debug residue.
4. Record every answer changed by subtraction. Do not call the resulting selector conformant.

**Verification:** clean tree; diff proves the exact geometry kernel, bridge, guards and UI are untouched; condemned symbols are absent; suite results and changed answers are recorded without calibrating expectations to them.

### T2 — build an independent acceptance oracle

**Objective:** make the gate independent of engine output.

**Method:**

1. Separate `ruled`, `contract`, `observed` and `open` fixture fields. Only ruled/contract fields are hard assertions.
2. Add square, tall rectangle, wide rectangle, rounded/circle, concave notch, narrow corridor, mixed parity, symmetry, dominance, uncertainty and registration counterexamples required by the approved contract.
3. Preserve Dan-approved Bat B1–B3 outcomes, but treat the vector itself as authoritative only after its exact geometry hash and mappings clear T0.
4. Add the identified uploaded contour and its ruled outcomes. Leave Bat B4 unpinned until ruled.
5. Add mutation checks proving each hard assertion fails when its governed behaviour is broken.

**Verification:** no expected winner comes only from a prior engine run; every hard assertion has an authority pointer; observed rows cannot pass or fail the release gate; expected initial engine failures are named rather than treated as T2 failure.

**Dependency:** the ruled oracle must exist before selector work. A missing uploaded contour blocks the final replacement gate, not neutral Compute work whose tests do not depend on that contour.

### T3 — run the bounded backend/representation probe

**Objective:** select one representation that can satisfy correctness and performance before freezing implementation.

**Method:**

1. Probe the existing fixed-point TypeScript/Clipper2 route using the v3.2 BVH and y-interval predicates.
2. Probe the R3 alternative only if a reproducible C++/Clipper2-WASM build is actually available.
3. Exercise tangency, one-quantum intrusion, split safe regions, a zero-width legal corridor, an isolated legal witness, just-too-narrow infeasibility, concave-notch false seats, starved refinement, hairline feasibility, deterministic output, memory and the real contour vertex budget.
4. Prove the conservative sandwich relation for any polygonal approximation. `InflatePaths` output alone is not that proof.
5. Select exactly one production backend using the R3 engineering rule.

**Verification:** reproducible build; measured corpus; certified error envelope; no lower-dimensional feasible set is reported empty; one backend selected with written evidence. If neither passes, stop and return the measured block to Dan.

### T4 — implement continuous safe and feasible sets

**Objective:** replace sweep-and-guess with sound continuous feasibility on the selected backend.

**Method:**

1. Implement the safe centre set for the approved effective radius while preserving every component. Do not reuse `compute/offset.ts`'s largest-ring-only result.
2. V1 continues to reject holes and disconnected input; do not add hole support.
3. For pattern offsets `O={o_i}` and permitted domain `A`, compute
   `F = A ∩ ⋂(C_r(P) - o_i)`.
4. Carry the certified approximation envelope. A conservative inward approximation may omit placements below epsilon; refine, retain exact boundary witnesses or return `INDETERMINATE_WITHIN_TOLERANCE`.
5. An empty approximation is never automatically certified infeasible.
6. Quantise the selected registration and re-prove every disc through the existing exact construction door.

**Verification:** the T3 geometry corpus passes; all components and lower-dimensional witnesses survive; exact tangency is legal; one-quantum intrusion is illegal; false seats are zero; real contours do not return indeterminate within the approved budget; per-shape runtime is measured against the approved gate.

### T5 — implement certified neutral descriptors

**Objective:** preserve the full feasible registration set through mechanics.

**Method:**

1. Build the multi-clearance component hierarchy using T0-approved profile levels; do not invent `r+4/r+8/r+12`.
2. Implement only the approved neutral descriptor registry, formulas, tolerances and units.
3. For every registration-sensitive descriptor, return an exact optimum/argopt subset, a conservative interval-refined equivalent set, or a proven-complete critical set with a certificate.
4. Apply the two-phase rule: local optimum evidence per hypothesis, then restriction against the certified global anchor.
5. Preserve score-uncertain legal candidates until certified dominance; otherwise return `DECISION_INDETERMINATE`.

**Why Kai T4.3 is not used:** for an asymmetric pattern, balance minimises `||t + mean(offsets) - materialCentroid||²`. The proposed T pattern has non-zero mean offset. Its optimum can lie strictly inside `F`, where it is neither a vertex, canonical projection nor directional support extremum. Each descriptor needs its own complete optimisation proof.

**Verification:** exact R3 boundary, global-anchor, compound-uncertainty and candidate-dominance fixtures pass; a one-representative-per-component implementation fails; Node/Chromium/WebKit return the same certified set and bytes.

### T6 — implement Logic selection and complete identity

**Objective:** replace heuristic ranking and offers with the approved total order.

**Method:**

1. Apply the T0-approved mechanics registry exactly; no qualitative placeholder or opaque score.
2. Evaluate every approved size independently. No prior band's winner truncates another domain.
3. Use the complete candidate identity: source geometry; size/window; population and origin parity; frame; pattern/variant; registration; profile hash; Compute artifact hash; Logic artifact hash.
4. Assemble offers only under the T0-approved per-band policy. Equal-count results survive when their governed identity is distinct.
5. Cap presentation only after the complete certified offer set exists.
6. Remove fallback. Surface stable legality, uncertainty, rejection and indeterminate codes.

**Verification:** every earlier criterion is tied before a later one decides; extra anchors never win by count; no fallback emits an answer; uncertain legal contenders cannot be silently dropped; T2 hard assertions pass.

### T7 — replacement gate

**Objective:** prove the new selector independently before deleting the old path.

**Method:** run the complete T2 oracle, T3/T4 adversarial geometry set, deterministic double-run hash, approved vertex-budget corpus and performance/memory gates. Exercise the real `/grid-engine` surface from the exact worktree/commit and capture every ruled frame, distinct optimum and refusal state.

The old sweep may falsify a missed placement. Agreement with it is not proof of completeness.

**Verification:** all hard assertions green; no affected real contour is indeterminate; performance meets the approved gate; live provenance identifies port, process, worktree and commit; captured frames show the returned identity and refusal reasons.

### T8 — delete the superseded selector

**Objective:** ship one selector.

**Method:** remove the sweep, auto-search, growth/flood paths, heuristic comparator, topology-only dedupe, fallback, debug/probe residue and unused imports created by their removal.

**Verification:** source/import search finds no parallel selector; full suite and T7 gate remain green after deletion; diff contains no unrelated cleanup.

### T9 — wire the existing UI and close

**Objective:** keep the same screen while exposing truthful engine results.

**Method:** key chips by complete solution identity; mark the approved primary/bulls-eye only if the offer policy defines one; render stable refusal/indeterminate reasons. Add no UI redesign and no product logic to React. Do not add a Worker unless the approved performance contract requires returning to Dan and a new decision authorises it.

**Verification:** every returned optimum renders once; equal-count distinct identities remain distinct; refused bands explain why; real interaction is captured on the current serving commit. QA then Meta each run their own source, execution and visual gates.

## Explicitly outside this selector increment

- package extraction;
- full ManufacturingSpec and fulfilment completion;
- B5, unless T0 makes it part of the approved offer domain;
- new UI design;
- holes/disconnected-outline support;
- a second runtime or parallel production selector.

These deferrals do not permit omission of profile, Compute artifact and Logic artifact identity from the selector result.

## Necessity and sufficiency

**Necessity — no unnecessary elements after correction.** One authority closure, one clean subtraction, one independent oracle, one bounded backend probe, one Compute path, one Logic path, one replacement gate, one deletion and one UI wiring step. Hole support, six deletion commits, a fixed critical-point recipe, a new worker and package adoption are removed.

**Sufficiency — delivers the v3.2 selector directive in full once T0 clears.** The plan covers authority, exact continuous feasibility, lower-dimensional cases, certified mechanics, full identity, honest uncertainty/failure, deterministic output, performance, deletion of the old selector and live UI proof. It does not call an unresolved product rule an engineering fact.

**Final selection:** this document supersedes both submitted proposals. Build remains blocked at T0 plus Dan's explicit go.
