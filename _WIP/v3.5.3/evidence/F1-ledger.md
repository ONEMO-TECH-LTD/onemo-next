# F1 — full-system live gate — ledger

Builder: s62-kai-lead · 2026-08-23 · product `f0cab139` (S3–S5 closed) → F1 finding fix `64d73365`. Server: `:4031`, `lsof` cwd = `onemo-next/.claude/worktrees/s62-grid-v353-build`, clean tree at the named commit. Capture: `shot-f1.mjs` (presets × bands × chips) and `shot-f1-cutout.mjs` (real library cutout, fixed and Auto). Zero console errors in every run.

## Fixture 6 — live tab (at `f0cab139`, Masses governor 0, pitch 48, flap 0)

| Shape | B1 | B2 | B3 | B4 |
|---|---|---|---|---|
| square | 1@24 (4 dots) | **2@72**, 4@72 (2 rungs, chips select) | 8@120 | 12@168 |
| squircle | 1@24 | 2@72, 4@72 | refused `NO_WRAPPED_LAYOUT_IN_BAND` (needs 24 mm) | 8@168 |
| diamond (rhombus preset) | 1@38 | 2@88 | 4@148 | refused `WRAP_EXCEEDS_ALLOWANCE` (needs 10 mm) |
| circle | 1@24 | 2@72, 4@92 | refused (needs 14 mm) | 8@176 |

Honesty copy reads "Centre + Wrap + Scaling … Three laws, no voting"; exactly three selector tabs (Voting · Centre rules · v3.5.1); refusals show their typed code and the measured whole-mm need plus concessions; rung chips switch layouts with `SOLVE 0.02S` (stored, no re-solve). Screenshots `F1-<shape>-<band>.png`, `F1-square-B2-chip{1,2}.png`.

## Fixture 5 — timing (live perf dash, first band request = whole even-size solve)

square 0.50 s · squircle 0.74 s · diamond 0.40 s · circle 1.02 s · **real cutout "cutout (10)" 1.32 s** for all 96 sizes; every later band/rung request 0.02 s. Gate (< 2 s per band) met with the whole ladder under 2 s. Headless per-band numbers in the S3–S5 ledger.

Real cutout at flap 0: 1@48, then B2–B4 refused `WRAP_EXCEEDS_ALLOWANCE` (needs 5 / 1 / 13 mm). With the Auto toggle the cap is the flap dial (0 here), so Auto refuses `AUTO_FLAP_CAP_EXCEEDED` with the same measured needs — the UI semantics ("auto works within this"), not an engine defect; raising the dial publishes the rungs.

## F1 finding — orientation mapping inverted (fixed at `64d73365`)

The square's 2-magnet rung rendered a **horizontal** pair (`F1-square-B2-chip1.png`) although the contract says vertical eliminates horizontal. Cause: I labelled "vertical" as the y-shifted phase; shifting the **x** phase puts the node line on the centre's x, so the magnets stack along y — that is the vertical pair. Fix in `logic.ts` (two predicates swapped, comment added); the square fixture now pins the kept pair's anchors at `(0, ±24)`. Live after the fix (`F1-square-B2-chip1-fixed.png`): the two magnets sit at one x, two y's — vertical. 50 tests, tsc, lint clean. **Correction to S3-c as approved:** gravity order is canonical, vertical (x-shifted), horizontal (y-shifted), both-shifted; the earlier wording had the two shifted labels swapped. Needs QA + Meta acceptance as an F1-gate fix.

## Post-F1 Centre comparison (contract §8 stop rule)

`centre-freeze.test.ts` at HEAD replays squircle 72 at flap 0 and flap 4 across Box/Core/Weight/Deep/Top and Masses governors 0–3 against the frozen Centre-rules Free semantics — equal. Every rung is one of the four frozen-Centre placements at its size (fixture 2 identity test). The only placement deltas vs `2c043257` are the ruled ones: the seat-margin double-count removal and the circle-preset disposition. **No Centre-caused rung change measured → no amendment; delivery closes at F1** pending QA/Meta.

## Product observations for Dan (law, not defects)

1. At fixed flap 0 only shapes whose belt discs read 0 mm air at an even size get rungs (squares, the squircle, the circle); organic cutouts get theirs under Auto with a non-zero cap.
2. The library diamond is a rhombus — 1@38 with Masses, not the contract's 34 (that is the square-rotated test diamond).
3. The circle preset's placements changed at 24/72/120 when the analytic circle path was deleted (contract-authorised; recorded in the W2 disposition).

## Gate record — WHOLE PRODUCT CLOSED

- QA verified `64d73365` and the F1 evidence; Meta rebound independently (`:4031` PID 18151, cwd the build worktree, HEAD `64d73365`): own headed capture — three tabs, three-law copy, square B2-1 vertical pair, real cutout whole solve 1.30 s with typed refusals, squircle 0.72 s and 8@168, console 0 errors / 0 warnings; all-nine Centre replay green, no Centre-caused rung delta, no amendment.
- Engineering Meta gate CLOSED at product `64d73365` / plan `e7462dcc`. Push, PR and merge are Dan-authorised shipping scope (not yet done).
