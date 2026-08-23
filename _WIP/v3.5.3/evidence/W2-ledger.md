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

## Fixture 1 — Centre unchanged, circle preset disposition

- `centre-freeze.test.ts` passes unchanged (squircle 72 flap 0/4: centre, targets, evidence, phase, anchors equal to the frozen comparator).
- **Circle preset before/after (`circle-disposition.test.ts`):** the deleted analytic predicate (embedded byte-equivalent as "before") and the supplied-segment prescreen ("after") seat the same count at every even size 24…214 — **zero differing sizes** (the preset is flattened at 192 points; its chords sit within the 0.001 mm kernel's quantum at every tested tangency). The only intended Centre-path change therefore produces no placement difference on the live preset.

## Headless

`tsc --noEmit` clean · `vitest src/lib/magnetic-grid`: 6 files, 24 tests pass · eslint: the 3 pre-existing LawPanel `react-hooks/refs` errors only.

## Live tab — :4031 serving `…/s62-grid-v353-build` (lsof cwd), commit `f5f85b72`

`W2-*.png` beside this file, zero console errors; readings identical to W1 (squircle 72 lawful in Masses and Weight; square 24 four dots; square 26 requires 1; preset diamond 34/36 `empty-belt` — rhombus, first rung at 40, see W1 ledger). Deleting the exact layer changed nothing visible — as the contract predicts.
