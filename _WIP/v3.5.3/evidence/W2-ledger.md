# W2 — delete the rocket science — build ledger

Builder: s62-kai-lead · 2026-08-23 · branch `session62-task/grid-v3.5.3-build` · commits `f5f85b72` (deletion, 14 files, +41 −500) and `fd68c890` (fixture-1 disposition test).

## Deleted (master §3 table, every row)

| Row | Done |
|---|---|
| `compute/exact-real.ts` + `exact-real.test.ts` | deleted |
| exact distance/witness machinery in `contact-root.ts` | gone in W1; file renamed `compute/wrap-measurement.ts` (git mv) |
| analytic circle path — `makeCircleSeatPredicate`, `GridConfig.circle`, engine branch, LawPanel `circle:` field | deleted |
| hand-written SHA-256 + witness certification in `identity.ts` | deleted; `contourIdentity` = canonical JSON of the ordered coordinates |
| `exactPointInMaterial` / `exactSeatIsLegal` | deleted (with their rational imports) |
| spec exact types `ExactInteger`, `Rational`, `AlgebraicReal`, `ExactReal`, `ExactScale`, `BoundaryElement`, `PreparedContour` | deleted |
| dead float Wrap helpers `maxPressMM`, `contactPointsMM`, `impliedFlapMM`, `TANGENT_GUARD_MM`; `parityHolds` (+ its private `mod`/`QUANTUM_KEY_MM`) | deleted |
| `bandWalk` bisection, tolerances, `seatMarginMM`, `below`, B5 | **S1/S3** — not this step |

Kept as the contract requires: Centre's 0.001 mm integer seat prescreen (`prepare`/`locate`/`holds`/`makeSeatPredicate`), `pressExcessMM` (live Centre tie-breaker), `centre-evidence.ts` untouched.

## Guard (fixture 4)

`separation.test.ts`: owner map renamed to `wrap-measurement.ts`; Logic may import `spec` only (any compute import is a violation); new test asserts every deleted identifier (`Rational`, `AlgebraicReal`, `ExactReal`, `ExactScale`, `sqrtMinusRational`, `compareExactToRational`, `certifyContactWitness`, `sha256Text`, `exactSeatIsLegal`, `exactPointInMaterial`, `makeCircleSeatPredicate`, `maxPressMM`, `contactPointsMM`, `impliedFlapMM`, `TANGENT_GUARD_MM`, `parityHolds`, `prepareContour`) is absent from every Law runtime file and that no file imports `exact-real`/`contact-root`; mutation-proved on a synthetic line.

## Fixture 1 — Centre unchanged except the ruled circle-preset disposition

- `centre-freeze.test.ts` passes unchanged for the non-circle frozen comparator.
- The deleted analytic circle predicate and supplied-segment predicate were replayed over all four Centre candidate lattices at every even size 24–214 (QA, `cff17f1c`). Candidate seating differs at 24/72/120/168. The selected placement differs at 24 (`[12,12]`, 1 seat → none), 72 (`[36,12]`, 2 → `[36,36]`, 1), and 120 (`[12,12]`, 5 → `[36,36]`, 4). Final Law anchors differ only at those three sizes: counts 1→0, 2→1, and 4→4 with changed positions. Every other even size selects the same placement and anchors. This is exactly the contract-authorized circle-only consequence of replacing the analytic predicate with the supplied segments.
- Correction of my earlier claim: my original fixture compared seat counts on the phase the *new* predicate had already selected, so it could not see that the analytic predicate would have selected a different phase; "zero differing sizes" was false. QA's replay is the disposition of record.

## Headless

`tsc --noEmit` clean · `vitest src/lib/magnetic-grid`: 6 files, 24 tests pass · eslint: the 3 pre-existing LawPanel `react-hooks/refs` errors only.

## Live tab — :4031 serving `…/s62-grid-v353-build` (lsof cwd), commit `f5f85b72`

`W2-*.png` beside this file, zero console errors; readings identical to W1 (squircle 72 lawful in Masses and Weight; square 24 four dots; square 26 requires 1; preset diamond 34/36 `empty-belt` — rhombus, first rung at 40, see W1 ledger). Deleting the exact layer changes nothing visible on the non-circle presets; the circle preset's authorised placement changes at 24/72/120 are recorded under Fixture 1.

## Gate record

- QA `/tmp/s62-grid-qa-w2-verdict.md`: deletion correct and minimal; W2-a (with patch), W2-b, W2-c approved; patch `cff17f1c` (full four-lattice circle replay + extended absence guard) adopted unchanged → `9cda9ba0`.
- Meta `/tmp/s62-grid-meta-w2-gate.md`: patch and corrected ledger accepted; W2-a..c approved; production build, typecheck, lint, diff/status clean.
- Adopted head `9cda9ba0`: tsc clean, 27 tests pass. Awaiting QA adopted-head verification and Meta closure.
