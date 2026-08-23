# Minimum touch — Dan's Wrap ruling (2026-08-23 15:40) — build ledger

Ruling (verbatim, master §0): "this is not the rule flap is not all or nothing - we need to allow imperfections of the shape to not touch all the shapes one or pair touching can be enough" · "make the toggle where i can select it in the admin dash and test reaction" · "minimum touch".

Product commit `145e4293` (pushed) on `session62-task/grid-v3.5.3-build`; canon master SHA `89cbbfa147d917e059b2fcbafa4269ca9754e3291a21ec189b4d0a83c0b7277c`.

## Change (minimal diff)

- `spec.ts`: `MIN_TOUCH 1`, floor 1, ceiling 8; `GridConfig.minTouch`; `WrapMeasurement.measured` carries `beltClearancesMM` (one ruled clearance per belt disc) instead of a pre-decided `requiredFlapMM`; `WrapPolicy` carries `minTouch`.
- `wrap-measurement.ts`: reports the belt clearances; decides nothing.
- `logic.ts evaluateWrap`: required flap = the `minTouch`-th smallest belt clearance (clamped to the belt size); lawful when ≤ allowance. Reducer unchanged.
- `engine.ts wrapPolicyOf`: reads `cfg.minTouch` (default `MIN_TOUCH`).
- bridge door re-exports the three constants; `LawPanel`: "Minimum touch · belt magnets that must wrap" dial (1–8, persisted, in save/reset defaults), honesty copy updated.

## Measured consequences (flap 0, minTouch 1)

| Shape | Ladder |
|---|---|
| square | 1@24 · 2&4@72 · **6**&8@120 · **10**&12@168 (the x-shifted 2×3 / 2×4 frames now wrap: corners touch, the middle pair carries air) |
| squircle (Masses) | 1@24 · 2&4@72 · 6@120, 8@124 · 10@168, 12@176 |
| cutout (4) | 1@44 · 2@108 · B3 refused (needs 1 mm) · 4@174, 5@182 — previously nothing beyond 1@44 at flap 0 |
| squircle 120 (Dan's screenshot) | lawful at minTouch ≤ 4 (4 of 6 belt discs touch), refused at 5 with `requires 24mm` |

Gates: tsc clean · 8 files / 52 tests · scoped lint 0 · live on :4031 at `145e4293`: dial present, ladders as above, 0 console errors (`minTouch-squircle-B4.png`, `minTouch-cutout4-B4.png`).

Contract fixture 3 re-measured to these ladders. Needs QA + Meta gate (source/test + the ruling's fidelity).
