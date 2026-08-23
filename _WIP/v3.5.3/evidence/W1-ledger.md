# W1 — Wrap on the ruler — build ledger

Builder: s62-kai-lead · 2026-08-23 · product branch `session62-task/grid-v3.5.3-build` (worktree `onemo-next/.claude/worktrees/s62-grid-v353-build`, base `2c043257`) · commit `ddc6906d`.

## What changed (11 files, +197 −436)

- `compute/contact-root.ts` — `measureWrap(contour, lattice, pitchMM, r)` → `{ seated, belt, wrapMeasurement }`: one record per node (nearest distance over outer+holes, material membership, `clearanceMM = floor(raw + 0.5)`), seated = `≥ 0`, belt from the same records (`≤4` rule / `splitPerimeter`), `requiredFlapMM` = max belt clearance, co-nearest witnesses by exact native equality. Refusals: `invalid-boundary`, `empty-belt` only.
- `compute/seat.ts` — `pointInMaterial` (outer + holes, float parity) and `nearestOutlineMM` (all rings, every tied point, deduplicated). Frozen Centre prescreen untouched.
- `spec.ts` — `ContactWitness {beltAnchorMM, outlinePointMM, clearanceMM}`, `WrapMeasurement`/`WrapEvaluation` unions per master §5.1, `WrapPolicy` on whole mm.
- `logic.ts` — `evaluateWrap` on integers; geometry refusal passed through with null allowance; no compute import.
- `engine.ts` — prescreen selects the phase only; final population from `measureWrap`; Coverage/plan after; `contactsMM` = every witness on a lawful result.
- `identity.ts` — dead `certifyContactWitness` removed (its only consumer was the exact witness path).
- `law.worker.ts`, `LawPanel.tsx` — field rename only (`appliedFlapMM`; whole-mm Wrap note; geometry refusal shows its reason).
- Tests: `wrap.test.ts` rewritten to fixture 2; `wrap-admitted-domain.test.ts` asserts squircle 72 lawful in all six modes with sub-ruler residue present; `separation.test.ts` owner map + a source guard (`Math.floor(rawClearanceMM + 0.5)` present, no exact/approx/toFixed in contact-root or Logic).

## Headless evidence

- `tsc --noEmit`: clean. `vitest src/lib/magnetic-grid`: 6 files, 27 tests pass. `eslint`: 3 pre-existing `react-hooks/refs` errors in LawPanel (identical at `2c043257`, not touched).

## Live tab (visual gate) — served from the build worktree on :4031, `lsof` cwd = `…/s62-grid-v353-build`, commit `ddc6906d`

Screenshots `W1-*.png` beside this file; zero console errors.

| Case | Live reading |
|---|---|
| squircle 72, Masses, flap 0 | Wrap lawful · requires 0 · applied 0 · 8 truth dots |
| squircle 72, **Weight**, flap 0 | Wrap lawful · requires 0 · applied 0 · 6 truth dots — the `2c043257` refusal by float residue is gone (fixture 2, I1) |
| square 24, Box | lawful · 4 truth dots at the four sides |
| square 26 @ pitch 48 | refused · requires 1 mm · allowed 0 · no dots |
| preset diamond 34 / 36 | refused · `empty-belt` |

**Preset diamond note (product data, not an engine defect):** the library diamond is a rhombus (at 34 mm longest side its bbox is 26.5 × 34), so its inscribed distance at the centre is 10.46 mm < 12 mm — no disc can seat until 40 mm (centre distance 12.30 → reads 0 → lawful, 1 magnet); 42 mm requires 1. The contract's "diamond 34 lawful" fixture is the square-rotated diamond (`diamond(17)`, inscribed 12.02) and passes in `wrap.test.ts`. Nothing to fix in W1; the scaling steps will publish the preset's first rung at 40.

## Contract trace

Fixture 2 lines covered: square 24 four witnesses at 0 ✓ · square 26 requires 1 ✓ · Weight squircle residue reads 0, all six modes lawful ✓ · −0.49 seated / −0.51 refused ✓ · outside/hole anchor signed negative ✓ · diamond 34/36 ✓ · 0.5 reads 1 ✓ · hole as binding witness ✓ · Auto minimum + cap ✓ · invalid-boundary / empty-belt null evidence, Logic never invents ✓ · Coverage invariance ✓ · MagnetPlan invariance ✓. Not yet in W1 (later steps): rung-walk agreement (S3/S4), mutation of the 0.001 prescreen (S-fixtures), instrumented guards (F1).

## Gate record

- QA verdict `/tmp/s62-grid-qa-w1-verdict.md`: runtime correct; W1-a..d approved; two fixes shipped as commits and adopted unchanged by cherry-pick: `6c289939` → `6ff380ca` (hole-side −0.49/−0.51, corners8 invariance, band-path = direct Wrap) and `73d1ba8f` → `dc6e9b15` (every ring needs ≥3 finite points or `invalid-boundary`).
- Meta gate `/tmp/s62-grid-meta-w1-gate.md`: both commits accepted unchanged; W1-a..d approved; diamond-34 canon number corrected at plan commit `995f0a66`.
- Adopted head `dc6e9b15`: tsc clean, 27 tests pass. Awaiting QA adopted-head verification and Meta live/source closure.
