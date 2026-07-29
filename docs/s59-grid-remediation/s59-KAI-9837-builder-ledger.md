# KAI-9837 builder ledger

## Authority and outcome

- Laws: 2.2 hard 10mm delivery floor; 3.5 canonical sizing inset
  `padding + frame = 11mm`; 3.21 rounded 70mm default carries four corner
  magnets; 3.22 radius is user-controlled and may grow the canonical size;
  8.7 output-affecting values are derived or supplied as released calibration.
- Current Dan ruling supersedes both the abandoned 72mm compensation and the
  abandoned fixed-radius interpretation. Radius is a serialized input. The
  released starting values are 70mm side, 10mm radius, and four minimum
  anchors; they live in one calibration input, not in grid geometry.
- Growth is driven by the 11mm canonical sizing inset, not the four-anchor
  minimum. At radius 12, a 70mm shape already delivers four anchors at
  10.586mm from the contour, but it is not a zero-point rung because
  `10.586 < 11`; the first canonical construction is 71mm.
- The 10mm value remains the inclusive delivery floor and never substitutes
  for the 11mm catalogue target.

## Full reads and bounded implementation

Before writing, I read the current law/brief sources, `ERRORS.md`, every affected
source file, its immediate callers, and the relevant tests in full. The
post-change audit covered the complete diff against `e371e25`, every newly
introduced export and caller, and `git diff --check`.

Minimal implementation:

1. One `roundedSquareShape(width, height, radius)` construction owns physical
   rounded-square geometry. Its millimetre materializer is used by serialized
   ladder and plan recipes; the shape-library preview and standard birth use
   the same construction. The Creator picker keeps its existing reversible
   Radius adjustment but consumes the same released radius input, with
   producer parity enforced at manufacturing tolerance.
2. `LadderRecipe` and `PlanRecipe` carry radius explicitly. The rounded ladder
   also carries the released minimum-anchor input, so both output constraints
   participate in cache identity. `semanticLadderFromRecipe` executes the
   complete serialized semantics; direct legacy ladders retain their existing
   ONE/two-anchor behavior.
3. The admin bench exposes radius `0..35` only for the rounded-square preset.
   The upper bound is derived from half of the 70mm released side: fully round.
   It feeds the same recipe as tests and worker transport. The existing v5.3.1
   Radius adjustment remains the product user control.
4. The old proportional `half * 0.42`, baked squircle data, and standard-birth
   `8mm` source are removed. The released default is the only source value;
   arbitrary radius inputs still flow through every producer.
5. Exact tangency uses `MANUFACTURING_TOLERANCE_MM / 10`, a derived chord-error
   epsilon included in the engine policy signature. It is not a product
   tolerance.

## RED-first and mutation evidence

Base: `e371e25fdea109d2b29eac3798cc08b64185362e`.

- Exact 10mm delivery tangency seated 2 anchors; exact 11mm sizing tangency
  seated 1. With the derived epsilon both seat 4.
- The rounded 70mm default resolved to 2 anchors instead of Dan's required 4.
- The picker used `half * 0.42`; standard birth used 8mm; the library used a
  separately baked superellipse.

Mutations were applied to real production lines and confirmed in the diff
before trusting the failures:

- `GRID_ARITHMETIC_EPSILON_MM → 0`: the 10mm tangency test fell 4→2 and the
  11mm sizing tangency fell 4→1. Restored: green.
- Catalogue inset `padding + frame → padding`: radius 10/12/14 shifted
  70/71/72 → 69/70/71; the dedicated 11-vs-10 witness failed. Restored: green.
- Removed `minimumAnchors` from the ladder cache body: the min-2/min-4 cache
  identity assertion failed. Restored: green.
- Forced recipe execution to ignore the released four-anchor minimum: its
  regression failed because ONE/sub-four constructions returned. Restored:
  green.

## Before / after

All measurements are Standard/48, light density, zero adaptive growth.

| Radius input | First released rung | Seated | Canonical minimum |
|---:|---:|---:|---:|
| 10mm | 70mm | 4 | 11mm |
| 12mm | 71mm | 4 | 11mm |
| 14mm | 72mm | 4 | 11mm |

- Sharp-square canon stays byte-identical:
  `22 · 70 · 118 · 166 · 214 · 262 · 310`.
- Circle keeps its lawful 5.8 witness: `S 71mm / 2 anchors`, vertical span
  48mm. A first generic 2→4 implementation deleted this tier; the full suite
  caught it and that implementation was removed.
- The device-performance canonical ladder hash stays unchanged.
- Standard-birth calibration 8→10 intentionally changes
  `EFFECT_BUILD_CONFIG.config_hash`; the payload schema is unchanged and its
  golden moves `10c7ecbb4623739c → 50be46dc3e00b0f1`.

## Executed gates

- Focused rounded/worker/cache/boundary/payload/performance suites: green.
- Final full Vitest after recipe coupling:
  47 files passed, 1 skipped; 448 passed, 10 skipped, 1 todo.
- TypeScript: exit 0.
- ESLint: exit 0, 0 errors; 214 pre-existing warnings.
- `git diff --check`: clean.
- Four landed production-line mutations each failed their named regression and
  were restored before the final full-suite run.

## Live visual

Observed in headed Playwright Chromium at
`http://localhost:3970/effect-creator/grid-lab`. PID `38475` served from
`onemo-next/.claude/worktrees/grid-lab`; the source head was
`5973e95cb60ef94dde0ef9d858f8c96fe3f50fd9`.

| Radius control | Test size | Product tier | Screenshot |
|---:|---:|---:|---|
| 10mm | 70mm | S · 4pt · seated 4 | `.playwright-cli/page-2026-07-29T17-56-33-202Z.png` |
| 12mm | 71mm | S · 4pt · seated 4 | `.playwright-cli/page-2026-07-29T17-56-49-183Z.png` |
| 14mm | 72mm | S · 4pt · seated 4 | `.playwright-cli/page-2026-07-29T17-56-02-243Z.png` |

All three stayed Standard/48 with no product verdict banner. Playwright
reported zero console errors.

## Scope kept

No pattern law, pitch law, scheduler invariant, worker key check, sharp-square
canon, Circle gravity behavior, or unrelated source family changed. The
remaining grid-first solver work is not claimed complete by this task.
