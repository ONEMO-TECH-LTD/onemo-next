# S2 — all four placements, render-complete — build ledger

Builder: s62-kai-lead · 2026-08-23 · branch `session62-task/grid-v3.5.3-build` · commits `65b9124f` (5 files +184 −34) and `a018cf1e` (QA S2-QA-1/2/3 corrections, Meta accepted; 10 files +73 −44). Base: closed S1 head `e3b6bc3e`. Adopted runtime/test files: `spec.ts`, `compute/seat.ts`, `logic.ts`, `engine.ts`, `law.worker.ts` (requested-size pass-through only), `__tests__/candidates.test.ts` (new), `__tests__/separation.test.ts`, `__tests__/wrap.test.ts`, `__tests__/wrap-admitted-domain.test.ts`, `__tests__/centre-freeze.test.ts`, `__tests__/circle-disposition.test.ts` (signature updates).

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

- **S2-a (REWORKED per QA S2-QA-1, Meta accepted):** `measureParity(seated, target, pitch)` in `compute/seat.ts` counts lines by the frozen identity `Math.round(coordinate / 0.001)` (`PARITY_LINE_QUANTUM_MM`); my first commit used raw coordinates and was wrong (0 and 0.0004 became two lines). Mutations: odd/even on x and y, node vs gap, and the 0/0.0004 identity case.
- **S2-b (approved QA+Meta; master §5.2 clarified at plan commit `948bfa54`):** `centreErrorMM` = larger-axis miss from the required node/gap line, `Math.floor(raw + 0.5)`, in Compute, report-only.
- **S2-c (approved QA+Meta, applied as constrained):** `{xHalf, yHalf}` derived from the declared four-item `centrePhaseCandidates` order (canonical, x-shifted, y-shifted, both); no donor type/body change; the ordering mutation in `candidates.test.ts` derives the expected flags from the phase deltas against the canonical phase and also pins the declared canon sequence `[2,1,1,0]`.
- **S2-d (formula ACCEPTED, owner REWORKED per QA S2-QA-2, Meta accepted):** `CENTRE` = `!parityTrue || centreErrorMM > 0`, `WRAP` = refused — decided in Logic (`inspectionConcessions(parity, wrap)`), Engine assembles only. Four cases tested directly.
- **S2-e (ACCEPTED QA+Meta):** with no seated disc, `measureParity` returns `{ parityTrue: false, centreErrorMM: 0 }` (nothing seats, so the centre law cannot hold; no miss to report). The degenerate-outline fallback display candidate uses phase `[0,0]`, placement `{false,false}`, canon 0 — as before in effect.
- **S2-f (REPLACED per QA S2-QA-3, Meta accepted):** `PlacementCandidate.sizeMM` is the caller's requested size, never the offset contour's bbox — `computeGrid(contour, requestedSizeMM, cfg)`; the worker and size walk already own that value and pass it explicitly; outline offset changes geometry but never rung ownership. My earlier "even by construction" claim was false (offset ±5 at 72 gave 62/82). Mutation: bbox 82 with requested 72 → all four candidates 72.

## Headless

At `a018cf1e`: `tsc --noEmit` clean · `vitest src/lib/magnetic-grid`: 7 files / 35 tests pass · `eslint src/lib/magnetic-grid` + `law.worker.ts`: 0 errors (LawPanel untouched in S2; inherited findings unchanged).

`candidates.test.ts`: four render-complete candidates and display = one of them · S2-c ordering mutation · S2-a/S2-b parity + ruler mutations (odd/even × x/y, 0.4 → 0, 0.6 → 1, empty) · concessions (clean square none; hand-placed 3 mm → `centreErrorMM 3` + `CENTRE`; nothing seats → `CENTRE`+`WRAP`; square 26 → `WRAP`) · Coverage invariance per candidate (seated, belt, measurement identical; anchors differ).

All W1/W2/S1 fixtures unchanged and green.

## Gate record

- QA `/tmp/s62-grid-qa-s2-gate.md`: S2-QA-1/2/3 (frozen parity identity; concessions to Logic; requested-size API) — applied exactly at `a018cf1e`; dispositions a rework, b/c/e accept, d formula accept/owner rework, f replace.
- Meta `/tmp/s62-grid-meta-s2-cross-review.md`: accepted all three exactly; authority corrections applied: master §5.2 `measureParity` row, §5.3 `inspectionConcessions`, §5.4 signatures, §8 S2 files row; execution plan S2 row/gate and worker allowed-file exception.
