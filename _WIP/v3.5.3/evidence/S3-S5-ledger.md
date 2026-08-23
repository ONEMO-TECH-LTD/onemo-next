# S3–S5 — atomic cut-over — build ledger

Builder: s62-kai-lead · 2026-08-23 · branch `session62-task/grid-v3.5.3-build` · commits `f6defa7d` (8 files +342 −215: `spec.ts`, `logic.ts`, `engine.ts`, `law.worker.ts`, `LawPanel.tsx`, `__tests__/scaling.test.ts` new, `__tests__/separation.test.ts`, `__tests__/wrap.test.ts`) and `7bcca659` (Meta red flag: co-lawful fixture on the measured diamond B3 130/4 rung). Base: closed S2 head `a88f4596`. Authority: master 203 lines SHA `0e3bf136…` (plan commit `2515a83f`).

## Contract trace

| Clause | Where | Status |
|---|---|---|
| §5.1 `LawfulLayout`, `Rung`, `BandLadder`, `BandSolveResult`, `RefusalCode`; `BandSnapPoint` and `GridConfig.solveCache` gone | `spec.ts` | done |
| §5.3 `reduceBandLadders(candidates, policy)`: judge each candidate with `evaluateWrap`; keep parity-true + wrap-lawful; group by count; smallest size; all placements at that size; Auto minimum + ties; vertical eliminates horizontal among equal; publish strictly greater than last published; owned by first band; typed band refusal | `logic.ts reduceBandLadders`, `bandRefusal` | done |
| §5.4 `solveBands(sized, cfg)` — each even size once via `computeGrid(sized(sizeMM), sizeMM, cfg)` stored in `gridsBySize`; candidates → reducer | `engine.ts solveBands` | done |
| §5.4 `fitSizeInBand(solved, band, rung, layout)` overlays `phaseMM`, `lattice`, `anchors`, `wrap`, `parityTrue`, `centreErrorMM`, `contactsMM`; `concessions: []`; zero geometry/Centre/Wrap/Coverage/scaling/Logic calls | `engine.ts fitSizeInBand` | done (spy asserts zero `computeGrid` calls) |
| §5.4 `autoFlapInBand(sized, cfg, capMM)` = same solve under Auto; no scan | `engine.ts` | done |
| §5.4 "`solveBands` is the only production loop over `BANDS`/`SIZE_STEP_MM`" | guard: exactly one `+= SIZE_STEP_MM` in `engine.ts`, none elsewhere; walk identifiers absent | done |
| §5.5 worker caches the `BandSolveResult` per shape+config, answers band and rung requests from it; Free/manual via `computeGrid`; visible `v3.5.1` selector, `engineId`, `compare.v1` namespace preserved; honesty note = three laws; no snap-step control | `law.worker.ts`, `LawPanel.tsx` | done (second size-prefetch loop removed) |
| §6 Band B1–B4 walk even sizes; rung chips; co-lawful layouts; typed refusals | `LawPanel.tsx` | done (headless; live at F1) |
| §7.3 square 1@24; 2 and 4@72; 8@120; 12@168; squircle 8 in B4; diamond 1@34; strictly increasing; no cross-band repeat; lower count survives higher refusal; co-lawful plural; vertical beats horizontal | `scaling.test.ts` | done |
| §7.6 / plan S3–S5 gate: chip select zero compute calls; offset contour present in every rung; distinct phase/lattice per co-lawful layout | `scaling.test.ts` | done |
| §8 S3–S5 atomic row: no compatibility overload, legacy projection, adapter, dormant helper or second size loop | diff | done |

## Contract-silent decisions (need QA + Meta approval)

- **S3-a.** "Centred" for acceptance = `parityTrue && centreErrorMM === 0` (a parity-true placement with a whole-mm centre miss is not a rung). *Necessity: one conjunction; the contract says "centred and wrapped".*
- **S3-b.** Rung publication walks the band's accepted sizes in ascending order and, at each size, counts ascending; a count is published only if strictly greater than the last published and not owned. Consequence: a smaller count first lawful at a *larger* size than an already-published larger count is never published (contract: "counts strictly increase (jumps are valid)"). Synthetic fixture pins it (3@74 after 4@72 → skipped).
- **S3-c.** Gravity order of co-lawful layouts: canonical, vertical (y-shifted), horizontal (x-shifted), both-shifted; horizontal is eliminated only when a vertical layout is equal on `centreErrorMM`, `requiredFlapMM`, `appliedFlapMM` (count and size are already equal within a rung).
- **S3-d.** Band refusal typing when a band publishes nothing: nothing seated → `NO_CENTRE`; no centred candidate → `NO_PARITY_LAWFUL_PLACEMENT`; lawful layouts exist but every count already owned → `NO_WRAPPED_LAYOUT_IN_BAND`; centred but every Wrap refused → `AUTO_FLAP_CAP_EXCEEDED` (Auto) / `WRAP_EXCEEDS_ALLOWANCE` (fixed); otherwise `NO_WRAPPED_LAYOUT_IN_BAND`.
- **S3-e.** `fitSizeInBand` throws on an unknown band/rung/layout index (no silent fallback); the worker clamps its indices before calling.
- **S3-f.** Worker defaults: `rungSel null` = the band's last (highest-count) rung; `layoutSel null` = first gravity-ordered layout; a band with no rungs renders its floor size's stored result and the typed refusal code; `SOLVE_CAP 6` stored results per shape.
- **S3-g.** The 0.7-aspect rectangle fixture now publishes `1@34` (y-shifted placement), not `1@36`: the contract walk considers all four placements, the legacy single-placement walk saw only 36. Fixture updated with the placement asserted.
- **S3-h.** `magnetCount < 1` candidates are never rungs (a 0-count lawful layout is not a magnet count).
- **S3-i.** Worker → tab rung projection `{ sizeMM, magnetCount, layouts: Placement[] }` typed locally in both files from `Rung`/`Placement` (no transport type/module; LawPanel imports nothing from the worker — Meta red flag applied).

## Headless (at `7bcca659`)

`tsc --noEmit` clean · `vitest src/lib/magnetic-grid`: 8 files / 46 tests pass · eslint: 0 errors in magnetic-grid and the worker; LawPanel's 3 inherited hook findings unchanged, 0 new.

`scaling.test.ts` (11): synthetic reducer — ownership/strictly-increasing/no-repeat, lower count survives, ties + gravity, Auto minimum/ties/cap refusal, typed refusals; real shapes — square ladder 1@24 / 2&4@72 / 8@120 / 12@168 (96 even sizes stored), diamond 1@34, squircle 8 in B4, Auto solve; stored rendering — zero `computeGrid` calls on `fitSizeInBand` with offset contour, requested size on every stored candidate, invalid index throws, diamond B3 130/4 two distinct co-lawful layouts each equal to its stored candidate. `wrap.test.ts`: band solve publishes only even sizes and equals direct inspection at every rung. `separation.test.ts`: one size loop, walk identifiers absent.

Not measured yet (F1): fixture 5 timing per band; live tab.

## Fixture 5 — early headless measurement (at `7bcca659`, Masses mode, flap 0, pitch 48)

| Shape (pts) | B1 | B2 | B3 | B4 | full `solveBands` | rungs |
|---|---|---|---|---|---|---|
| squircle (132) | 47 ms | 112 ms | 236 ms | 384 ms | 713 ms | 1@24 · 2&4@72 · — · 8@168 |
| heart (198) | 41 ms | 121 ms | 230 ms | 362 ms | 772 ms | 1@38 · — · — · — |
| blob generator (96) | 29 ms | 101 ms | 234 ms | 335 ms | 672 ms | none at flap 0 |

Every band is far under the 2 s gate. Product observation for F1 (law, not defect): at fixed flap 0 only shapes whose belt discs all read 0 mm air at an even size publish rungs — organic shapes mostly publish under Auto. The real-cutout timing and the live tab are measured at F1 (`shot-f1.mjs`).
