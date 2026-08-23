# S1 — even sizes — build ledger

Builder: s62-kai-lead · 2026-08-23 · branch `session62-task/grid-v3.5.3-build` · commit `f0d7853a` (6 files).

## What changed

- `spec.ts` — `SIZE_STEP_MM = 2`; `BANDS` = four inclusive even bands 24–70 / 72–118 / 120–166 / 168–214 (`BandId = 1|2|3|4`); B5, `SNAP_STEP_MM`, `AUTO_FLAP_STEP_MM`, `GridConfig.seatMarginMM` deleted. `CONTACT_TOLERANCE_MM` is still declared — it is read by the legacy `bandWalk`, which S3 deletes together with it.
- `engine.ts`, `law.worker.ts` — every `seatMarginMM` use removed (the seat radius is the spot radius; no margin).
- `LawPanel.tsx` — Free-size and band-scale sliders step by 2 and snap to even mm (`evenMM`); snap-step control and its persisted dial deleted; the worker is told `SIZE_STEP_MM` (the legacy walk therefore steps even sizes until S3 replaces it).

## Headless

`tsc --noEmit` clean · `vitest src/lib/magnetic-grid`: 6 files, 24 tests pass · eslint: the 3 pre-existing LawPanel `react-hooks/refs` errors only.

## Live tab — :4031 serving `…/s62-grid-v353-build` (lsof cwd), commit `f0d7853a`

`S1-free-bands.png`: band chips read **B1 B2 B3 B4 Free** (no B5); the Free size slider has `step="2"`, value 72; zero console errors.

## Contract trace

§5.1 values (`SIZE_STEP_MM`, four `BANDS`), §6 "Free size · any even size (slider snaps to 2 mm)", §8 S1 row. Not in S1 by design: `CONTACT_TOLERANCE_MM`/bisection/`below` (S3).
