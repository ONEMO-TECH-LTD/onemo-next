# v3.5.2 T3 surgical execution sub-plan

Status: execution authority revised 2026-08-23 to the even-millimetre walk (Dan ruling). R0 is CLEAR; G1 is superseded; B1 (graduate the walk) is the released build scope; B2 remains gated on B1 CLEAR.

## Authority

Execute only from:

1. `v3.5.2-master-contract.md` — 853 lines — SHA-256 `aa76a353c56b0d845cc6e81714e7af53d5ff0cc28eeba6dbf0fbf956180aef47` (v3.5.2-1, revised 2026-08-22).
2. `T3-build-three-laws.md` — 658 lines — SHA-256 `3196b875b2e5e5e65ce8e124fc2cdac86bf4860251a559e01f59526691ab0bd9` (regenerated from that master).

Historical evidence only, not execution authority: `../supporting/T3-execution-matrix.md` (describes product `1ccba648` and the pre-simplification mechanism; superseded) and `../supporting/T3-post-wrap-commit-audit.md` (joint 34-commit recovery disposition).

Product base: a fresh clean worktree at `2c043257` (Centre + Wrap cleared). R0 below is the historical record of how that base was reached from the rejected branch; it is not replayed.

Voting, Centre-rules, their worker/modules and the Meta-cleared fixed-size Wrap behavior remain frozen comparators.

## Operating contract

- One builder owns product edits. Grid-Meta continuously watches the builder pane and actual diff; Grid-QA independently reviews each named gate.
- Before each edit block, the builder states only: sub-plan step, controlling contract lines, allowed files and intended semantic result. It does not design in code.
- Every semantic result is a local rollback commit. No amend, rebase, reset, push or product deletion outside the named recovery disposition.
- An off-step file, unapproved mechanism, public stub, fallback, number-based law decision or dormant platform is an immediate hard stop.
- A genuine contract silence produces one bounded proposed block. Grid-Meta and Grid-QA must both clear necessity and sufficiency before that block enters the contract or code.
- Compile/focused tests and the frozen Centre/Wrap replay run after every semantic commit. The live Law tab is observed after every user-visible or worker/engine integration commit.
- No T4 bridge/transport/UI ownership migration, broad audit or Centre repair occurs in this sub-plan before its named gate. Performance is in scope only as cheap discovery and exact work at candidate roots.

## R0 — Recover the branch surgically

Goal: remove unauthorized machinery while preserving every independently necessary exact-scaling input and all history.

### R0.1 — Remove continuous Centre-repair machinery

Allowed files:

- `src/lib/magnetic-grid/compute/centre-evidence.ts`
- `src/lib/magnetic-grid/__tests__/offset-features.test.ts`
- `src/lib/magnetic-grid/__tests__/exact-centre-scaling.test.ts`
- `src/lib/magnetic-grid/__tests__/separation.test.ts`

Action:

- Remove every body/type/test/allowlist entry introduced by `862b71e4..fac33358`: offset features, line/curve intersections, expression graph, arrangements, legal-edge filtering and canonical offset-ring identity.
- Preserve the frozen `safeSegments`, `centroidOf`, `measureCentreBranches` and other pre-offset live Centre code.
- Remove the consumerless hole-aware exact Weight coefficient body and the focused exact-centre-scaling tests. Retain exact Box through R0.1 only because the still-present `c1132856` contact-event enumerator consumes it; R0.2 deletes exact Box atomically with that consumer. B1 reintroduces exact Box plus frozen full-outer/no-holes Weight with their first live evaluator.
- Delete `offset-features.test.ts` only after the tracked import/reference trace proves it belongs entirely to the reverted stack.

Proof: frozen fixed-size Centre/Wrap hashes equal; no offset symbol remains; package separation still passes.

Commit: `revert(grid): remove unauthorized continuous centre stack`.

### R0.2 — Remove the generic proof platform

Allowed files:

- `src/lib/magnetic-grid/spec.ts`
- `src/lib/magnetic-grid/compute/centre-evidence.ts`
- `src/lib/magnetic-grid/compute/exact-real.ts`
- `src/lib/magnetic-grid/compute/identity.ts`
- `src/lib/magnetic-grid/compute/regimes.ts`
- `src/lib/magnetic-grid/__tests__/exact-real.test.ts`
- `src/lib/magnetic-grid/__tests__/identity.test.ts`
- `src/lib/magnetic-grid/__tests__/regimes.test.ts`
- `src/lib/magnetic-grid/__tests__/separation.test.ts`

Action:

- Remove all general predicate, multivariate token, resultant, generator factorization, RUR/tuple, back-substitution and predicate-request bodies/types/tests introduced by `e77bfcdf..5c9a6f40` and `1ccba648`.
- Remove the consumerless `c1132856` contact-event enumerator, its exact Box coefficient/re-export, focused tests and allowlist entries. B1 recovers its audited segment equations/lattice enumeration and exact Box only with exact projection proof and the first live consumer.
- Remove all `40d90c53` changes, including its consumerless runtime typing and offset-test coupling. (Historical R0.2 record; the revised B1 below defines what returns.)
- Preserve the audited KEEP kernel: exact rational/quadratic roots, affine transform, uncapped comparison, parity events, half-open band domains and B1-B4 horizon.
- Remove the consumerless `CertifiedExpressionReal` scale-expression functions/types/tests from `3849ed1f+c1911cdf+a98bb671`. (Historical R0.2 record; `CertifiedExpressionReal` does not return.)

Proof: no removed symbol has a runtime reference; fixed Centre/Wrap hashes equal; exact root/domain/parity focused oracles remain green.

Commit: `revert(grid): remove dormant symbolic proof platform`.

R0 gate: Grid-Meta and Grid-QA independently verify the resulting tree against the joint audit. No body classified REWORK remains as a standalone foundation; correct portions enter only with their first B1 live consumer. The two untracked RED scaling/topology fixtures remain preserved and unadopted until their owning step.

## G1 — superseded (2026-08-22)

The Centre-site contract gap was closed by removing the requirement that created it. Scaling no longer evaluates Centre at exact sites over the continuum; the numeric Centre path selects the state and only the selected coordinates are reconstructed exactly (master §7.1b). No G1 mechanism, transition set, falsifier or `CENTRE_EVIDENCE_UNRESOLVED` site is built.

## B1 — Graduate the walk on the 1 mm ruler

Authority: master §1 (ruler), §6.1–§6.4, §7.1b/§7.2/§7.4 and §10 T3 as revised on 2026-08-23 (Dan: sizes even millimetres; no measurement below 1 mm).

Allowed runtime files: `src/lib/magnetic-grid/{spec,compute,logic,engine}.ts`, `src/lib/magnetic-grid/compute/{seat,centre-evidence,contact-root}.ts`, focused tests and the existing separation guard.

Required result, in rollback commits (~80 lines total):

1. `spec.ts`: `SIZE_STEP_MM = 2`; `BANDS` = four even-size bands (24–70, 72–118, 120–166, 168–214); `PlacementCandidate`; delete `CONTACT_TOLERANCE_MM`, `AUTO_FLAP_STEP_MM`, `SNAP_STEP_MM`.
2. `compute`: `roundToRulerMM`; `measureWrap` unchanged; the near-boundary seat decision and Wrap judge the same scaled contour and anchors.
3. `engine.ts computeGrid`: evaluate all four placements (Coverage, Wrap, ruler rounding) and return them as `candidates`; `chooseCentrePlacement` stays the Free-display pick.
4. `engine.ts bandWalk`: every even size in the band; every candidate to Logic; delete bisection, `CONTACT_TOLERANCE_MM` refinement and the seat-based `below` exclusion.
5. `logic.ts reduceBandLadders`: lawful = parity + whole-mm flap ≤ allowance (Auto: ≤ cap, minimum kept); group by output count; earliest even size; ties kept; vertical eliminates horizontal only among equals; counts strictly increasing; ownership by first acceptance across B1–B4.
6. `fitSizeInBand`/`autoFlapInBand` publish from the reduced ladder (no re-solve, no scan).

Required proof:

- frozen Centre/Wrap zero- and positive-flap replay unchanged (Wrap verdicts at flap 0 change only where sub-ruler air now rounds to 0 — squircle 72 in every mode becomes lawful; record the diff);
- fixture 12: seat/Wrap one geometry; fixture 17: holed cutout;
- square: 1 at 24; 2 and 4 at 72; 8 at 120; 12 at 168; diamond: 1 at 34 (air 0.06 → flap 0); squircle 8 in B4; no cross-band repeat; lower count survives a higher count's refusal; co-lawful placements plural;
- per-band squircle solve < 2 s;
- a mutation that refines below 2 mm, compares sub-mm air, or judges seat and Wrap on different geometry fails.

Stop before code if bisection, refinement, exact-root, adapter, algebraic or sub-millimetre law logic appears.

B1 gate: builder self-audit, Grid-QA independent source/runtime QA, then Grid-Meta necessity/sufficiency/deslop/live-product audit. Continue only on both independent verdicts CLEAR.

## B2 — Extend the existing worker and tab

Allowed files: `law.worker.ts`, `LawPanel.tsx`, `magnetic-grid-bridge.ts`, `engine.ts`, `spec.ts`, focused tests and the separation guard.

- Keep the isolated newest-only queue, lifecycle and engine/contour identity checks. No T4 solve service or view-model migration.
- Worker stores the complete accepted B1–B4 result once per shape/config; band/rung selection is a stored lookup; free/manual routes through fixed inspection with measured concessions.
- Transport exact scales, witnesses and refusals unchanged; display the rounded scale, retain the exact value.
- Remove `snapRange`, `bandSnapPoints`, the per-size caches/prefetch and the snap-step control only once the stored result drives the tab.
- Honesty note to all three laws only after the committed live result renders. Exactly three tabs; no restyle.

Proof: worker result byte-equals direct engine; shape/config change invalidates once; selection causes no solve; stale requests never render; legacy worker hashes unchanged; all four bands render stored exact rungs/refusals; frozen Centre/Wrap visuals unchanged.

## F1 — Completed-system gate

Run Centre + Wrap + scaling together on the real Law tab across:

- B1-B4;
- all six Centre modes and four Masses governors;
- fixed flap 0, fixed positive and Auto cap pass/refusal;
- Full/Perimeter and all MagnetPlans;
- square, diamond, heart and real supplied concave/holed cutouts;
- manual fixed inspection;
- direct engine, worker/cache replay and selected-layout lookup.

Required verdict: strictly increasing counts at exact solved scales, no cross-band repeat/double owner, exact witnesses, explicit refusals/ties, every even size evaluated, comparator hashes unchanged, real UI truthful.

## F2 — Centre repair remains last and conditional

Only after F1 passes, run the named 2mm-ruler residue/sliver cases against actual law results.

- If no required rung/verdict changes materially, record evidence and leave Centre untouched.
- If a material product result changes, open one separate bounded contract amendment for that repair. Master §7.1b is the exact coordinate adapter, not repair authority; the repair is not part of B1-B2 and cannot retroactively justify the reverted platform.

## Final T3 closure

Builder runs a complete self-audit. Grid-QA performs independent source/runtime QA. Grid-Meta performs independent necessity, sufficiency, deslop and live-product Meta review. T3 closes only when both verdicts are CLEAR on one clean immutable HEAD. No T4 work begins before that closure.

## Necessity and sufficiency

Necessity — the plan removes the unauthorized platform first, retains only audited exact inputs, replaces the Centre-site gap with the proved exact adapter, and builds one live engine→worker→UI path. No parallel engine, Support B, duplicate Wrap or premature Centre repair exists.

Sufficiency — the plan delivers frozen Centre, exact fixed/Auto Wrap at exact rung scales, exact next-count B1-B4 scaling, typed direct/worker/manual results, stored lookup, truthful UI, completed-system proof and conditional Centre repair.
