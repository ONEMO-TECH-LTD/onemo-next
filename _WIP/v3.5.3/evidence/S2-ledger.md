# S2 — all four placements, render-complete — build ledger

Builder: s62-kai-lead · 2026-08-23 · branch `session62-task/grid-v3.5.3-build` · commit `65b9124f` (5 files: `spec.ts`, `compute/seat.ts`, `engine.ts`, `__tests__/candidates.test.ts` new, `__tests__/separation.test.ts`; +184 −34). Base: closed S1 head `e3b6bc3e`.

## Contract trace

| Clause | Where | Status |
|---|---|---|
| §5.1 `Placement {xHalf, yHalf}`, `PlacementCandidate` (sizeMM, placement, phaseMM, lattice, canon, seated, belt, anchors, magnetCount, parityTrue, centreErrorMM, wrapMeasurement) | `spec.ts` | done |
| §5.1 `GridResult` += `parityTrue`, `centreErrorMM`, `concessions`, `candidates` (current UI fields unchanged) | `spec.ts` | done |
| §5.4 `computeGrid`: Centre → four placements → one final seat/belt/Wrap measurement → Coverage/MagnetPlan output; candidates returned; display pick via `chooseCentrePlacement`; concessions measured | `engine.ts candidateAt` + display selection | done |
| §5.2 (S2-b text) Compute converts the larger-axis Centre miss once, report-only; never decides admission | `seat.ts measureParity` | done |
| §2.1 "consider all four parity placements"; §3 frozen Centre ordering for the display pick | `engine.ts` (`measureCentrePlacements` + `chooseCentrePlacement` unchanged) | done |
| §6 manual drag → concessions in whole mm | forced phase → `centreErrorMM` integer, `CENTRE` concession | done |
| §8 S2 row: render-complete candidates (phase, lattice); `parityTrue`, `centreErrorMM` measured | — | done |
| Plan S2 gate: Free shows concessions; `candidates` length 4 with phase + lattice | `candidates.test.ts` | headless only (no Playwright until F1) |

## Contract-silent decisions (approved before commit, or listed for approval)

- **S2-a (approved QA+Meta, applied as constrained):** `measureParity(seated, target, pitch)` lives in `compute/seat.ts`, is the first live consumer of the deleted `parityHolds` numeric rule, returns neutral `parityTrue`; Engine/Logic do not duplicate it. Mutation tests cover odd/even lines on x and on y, node vs gap.
- **S2-b (approved QA+Meta; master §5.2 clarified at plan commit `948bfa54`):** `centreErrorMM` = larger-axis miss from the required node/gap line, `Math.floor(raw + 0.5)`, in Compute, report-only.
- **S2-c (approved QA+Meta, applied as constrained):** `{xHalf, yHalf}` derived from the declared four-item `centrePhaseCandidates` order (canonical, x-shifted, y-shifted, both); no donor type/body change; the ordering mutation in `candidates.test.ts` derives the expected flags from the phase deltas against the canonical phase and also pins the declared canon sequence `[2,1,1,0]`.
- **S2-d (new — needs QA + Meta approval):** `CENTRE` concession = `!parityTrue || centreErrorMM > 0` (any measured miss of the centre law, not only wrong parity). *Necessity: one boolean; no rocket science; sufficiency: a 3 mm hand-drag is reported as a concession, which the contract's "concessions measured" requires.*
- **S2-e (new — needs QA + Meta approval):** with no seated disc, `measureParity` returns `{ parityTrue: false, centreErrorMM: 0 }` (nothing seats, so the centre law cannot hold; no miss to report). The degenerate-outline fallback display candidate uses phase `[0,0]`, placement `{false,false}`, canon 0 — as before in effect.
- **S2-f (new — needs QA + Meta approval):** `PlacementCandidate.sizeMM` is the longest side of the supplied contour's bbox (even by construction from `makeSizer`; raw test squares give their side). No rounding.

## Headless

`tsc --noEmit` clean · `vitest src/lib/magnetic-grid`: 7 files / 33 tests pass · `eslint src/lib/magnetic-grid`: 0 errors (LawPanel inherited findings unchanged, file untouched in S2).

`candidates.test.ts`: four render-complete candidates and display = one of them · S2-c ordering mutation · S2-a/S2-b parity + ruler mutations (odd/even × x/y, 0.4 → 0, 0.6 → 1, empty) · concessions (clean square none; hand-placed 3 mm → `centreErrorMM 3` + `CENTRE`; nothing seats → `CENTRE`+`WRAP`; square 26 → `WRAP`) · Coverage invariance per candidate (seated, belt, measurement identical; anchors differ).

All W1/W2/S1 fixtures unchanged and green.
