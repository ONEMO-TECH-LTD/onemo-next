# Contract-fidelity trace — W1 · W2 · S1 (Dan's goal, 2026-08-23)

Rule: build purely by the v3.5.3 contract (`../v3.5.3-master-contract.md`, SHA 19183807…) and plan (`../v3.5.3-execution-plan.md`). Every clause the step touches is traced. **Where the contract is silent, the choice is listed under "Contract-silent decisions" and is not settled until QA and Meta both approve it** (necessity · no rocket science · sufficiency).

## W1 — `ddc6906d`

| Contract clause | Where in code | Status |
|---|---|---|
| §1 one conversion `clearanceMM = floor(raw + 0.5)`, signed ruler | `wrap-measurement.ts` (then `contact-root.ts`) line `Math.floor(rawClearanceMM + 0.5)` | done |
| §2.2 `rawClearanceMM = pointInMaterial ? d − r : −(d + r)`; seated = `≥ 0`; belt `max(0, clearanceMM)`; max over belt | same file | done |
| §5.1 `ContactWitness {beltAnchorMM, outlinePointMM, clearanceMM}`; `WrapMeasurement`/`WrapEvaluation` unions; `invalid-boundary`/`empty-belt` only | `spec.ts` | done |
| §5.2 `measureWrap(contour, lattice, pitchMM, r)` → private `{seated, belt, wrapMeasurement}`; seated → `belt = splitPerimeter(seated, pitch)` (≤4 rule); co-nearest by exact native equality, dedup, stable order | same file; `seat.ts nearestOutlineMM` | done |
| §5.2 `pointInMaterial` (outer + holes) and all-ring nearest helper in `seat.ts` | `seat.ts` | done |
| §5.3 Logic integer comparison; refusal passes through, never invents `requiredFlapMM`/`allowedFlapMM`; Logic imports nothing from compute | `logic.ts evaluateWrap` | done |
| §5.4 truth dots only from returned witnesses on a lawful result | `engine.ts contactsMM` | done |
| §8 W1 files: `contact-root.ts`, `seat.ts`, `logic.ts`, `spec.ts` | + `engine.ts`, `identity.ts`, `law.worker.ts`, `LawPanel.tsx` | **deviation — see S-1 below** |
| §7.2 fixture lines | `wrap.test.ts`, `wrap-admitted-domain.test.ts` — traced in W1-ledger | done (rung-walk agreement lines belong to S3/S4) |

### Contract-silent decisions (need QA + Meta approval)

- **W1-a.** W1 touched four files outside the plan's W1 list (`engine.ts` wiring, `identity.ts` dead `certifyContactWitness`, `law.worker.ts`/`LawPanel.tsx` field renames) because the type change does not compile otherwise. Alternative would have been a temporary shim — more code. *Necessity: the minimum to compile; no rocket science: renames; sufficiency: one measurement path end to end.*
- **W1-b.** On `empty-belt` the private result returns the actual (empty) `seated`; on `invalid-boundary` it returns `[]`. Contract says "never fabricated populations" but not the value. *Chosen: the true population.*
- **W1-c.** `nearestOutlineMM` is a brute force over every segment for every node (no bucket index) so seat and Wrap share one distance computation exactly as §5.2 demands. Cost measured in F1 (fixture 5). *Simpler than reusing the indexed `edgeDistMM`, which returns no tied points.*
- **W1-d.** The 0.001 mm prescreen (`makeSeatPredicate`) still picks the phase with the **spot radius only** (no margin) — unchanged from `2c043257` behaviour at `seatMarginMM: 0`.

## W2 — `f5f85b72` + `fd68c890`

| Contract clause | Status |
|---|---|
| §3 table rows: exact-real, exact witness machinery, circle path, SHA-256/certificates, exactPointInMaterial/exactSeatIsLegal, exact spec types, dead float helpers + `parityHolds` | all deleted (walk constants row → S1/S3) |
| §3 kernel kept; `contact-root.ts` → `wrap-measurement.ts` | done |
| §4 import law (`logic.ts` → `spec.ts` only; `identity.ts` → `spec.ts`; `wrap-measurement.ts` → `spec.ts`, `seat.ts`) | done; owner map updated |
| §5.2 `contourIdentity` = canonical JSON of ordered coordinates; `boundaryTruth = {rule, contourIdentity}` | done |
| §7.1 circle-preset before/after disposition fixture | `circle-disposition.test.ts`: zero differing sizes 24–214 |
| §7.4 guard asserts every deleted identifier absent; no sub-mm comparison in Logic | `separation.test.ts` | 

### Contract-silent decisions (need QA + Meta approval)

- **W2-a.** The disposition fixture embeds the deleted analytic predicate (12 lines) as the "before" so the comparison is self-contained and permanent. *Alternative: a one-off probe with no durable fixture.*
- **W2-b.** `contourIdentity` JSON keeps each hole under a `hole:<i>` label (same labelling as before); no rounding of coordinates (bit-identical identity).
- **W2-c.** `centre-freeze.test.ts` passes `circle: false` only to the legacy comparator call (the Law `GridConfig` no longer has the field).

## S1 — `f0d7853a`

| Contract clause | Status |
|---|---|
| §5.1 `SIZE_STEP_MM 2`; `BANDS` 24–70/72–118/120–166/168–214 inclusive even | done |
| §8 S1: delete B5, `CONTACT_TOLERANCE_MM`, `AUTO_FLAP_STEP_MM`, `SNAP_STEP_MM`, `seatMarginMM`, `GridConfig.circle` | all done **except `CONTACT_TOLERANCE_MM`** — still read by the legacy `bandWalk`; deleting it in S1 would mean editing the walk S3 deletes |
| §6 Free size any even size, slider snaps to 2 mm; no snap-step control | done |
| §5.5 no snap-step control | done |

### Contract-silent decisions (need QA + Meta approval)

- **S1-a.** `CONTACT_TOLERANCE_MM` deferred to S3 (with `bandWalk`) rather than deleted in S1 — *a plan-row deviation, chosen to keep S1 a pure values/UI commit.* If QA/Meta prefer plan-literal, the paste-ready fix is: delete the constant and its import and replace the bisection loop body with `const rungMM = mm` in S1.
- **S1-b.** The worker is handed `snapStep: SIZE_STEP_MM` so the legacy walk steps even sizes until S3; the request field is deleted in S5.
- **S1-c.** `evenMM()` snaps pinch/slider requests with `Math.round(mm / 2) * 2` in the tab (UI convenience; the engine never sees an odd size from the tab).

## Pending before S2 (parked in stash, not on the branch)

- **S2-a.** `parityTrue` must be *measured* (§5.4 "concessions measured (parityTrue, centreErrorMM)"). The deleted `logic.ts parityHolds` held the per-axis rule (odd line count → node on centre, even → gap); the contract deleted it as having no consumer. S2 needs that rule as a **compute measurement** (`seat.ts measureParity`). *This is a contract-silent re-homing of a deleted body's rule; QA + Meta must approve the rule and the home before S2 is committed.*
- **S2-b.** `centreErrorMM` = larger axis miss from the required node/gap line, converted to whole mm with the same `floor(x + 0.5)` (§1 says concessions are whole mm; §5.2 says `measureWrap` is the only law conversion — the two clauses need one reading).
- **S2-c.** `Placement {xHalf, yHalf}` derived from the order of `centrePhaseCandidates` (index 1 = x-shifted, 2 = y-shifted, 3 = both).
