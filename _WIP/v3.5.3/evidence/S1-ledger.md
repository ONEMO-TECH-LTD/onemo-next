# S1 — even sizes — build ledger

Builder: s62-kai-lead · 2026-08-23 · branch `session62-task/grid-v3.5.3-build` · commit `f0d7853a` (4 files: `spec.ts`, `engine.ts`, `law.worker.ts`, `LawPanel.tsx`; +35 −40).

## What changed

- `spec.ts` — `SIZE_STEP_MM = 2`; `BANDS` = four inclusive even bands 24–70 / 72–118 / 120–166 / 168–214 (`BandId = 1|2|3|4`); B5, `SNAP_STEP_MM`, `AUTO_FLAP_STEP_MM`, `GridConfig.seatMarginMM` deleted. `CONTACT_TOLERANCE_MM` is still declared — it is read by the legacy `bandWalk`, which S3 deletes together with it.
- `engine.ts`, `law.worker.ts` — every `seatMarginMM` use removed (the seat radius is the spot radius; no margin).
- `LawPanel.tsx` — Free-size and band-scale sliders step by 2 and snap to even mm (`evenMM`); snap-step control and its persisted dial deleted; the worker is told `SIZE_STEP_MM` (the legacy walk therefore steps even sizes until S3 replaces it).

## Headless

`tsc --noEmit` clean · `vitest src/lib/magnetic-grid`: 6 files, 24 tests pass · eslint: 3 pre-existing LawPanel hook errors (1 set-state-in-effect, 2 refs); no S1-new lint finding.

## Live tab — :4031 serving `…/s62-grid-v353-build` (lsof cwd), commit `f0d7853a`

`S1-free-bands.png`: band chips read **B1 B2 B3 B4 Free** (no B5); the Free size slider has `step="2"`, value 72; zero console errors.

## Contract trace

§5.1 values, §6 Free even-size control and §8 S1 are complete through QA remediation e3b6bc3e. Only legacy below ownership remains for S3.

## QA remediation adopted

Commit `e3b6bc3e` deletes `CONTACT_TOLERANCE_MM`, its import and the complete fractional bisection; the interim band path now publishes only the lawful even sample already evaluated. The biting 0.7-aspect rectangle fixture proves B1 publishes `1@36`, never the former `34.3125mm` refinement.

Adopted-head gates: `tsc --noEmit` clean · `vitest src/lib/magnetic-grid`: 6 files / 28 tests pass · `eslint src/lib/magnetic-grid`: clean · diff-check/status clean.

## Gate record

- QA `/tmp/s62-grid-qa-s1-review.md`: blocking S1-a replaced by the deletion above (adopted exactly → `e3b6bc3e`); S1-b, S1-c approved; adopted head verified.
- Meta `/tmp/s62-grid-meta-s1-gate.md`: QA patch accepted exactly; S1-b, S1-c approved; S2-a/b/c pre-approved with constraints (S2-b master clarification applied at plan commit `948bfa54`).
