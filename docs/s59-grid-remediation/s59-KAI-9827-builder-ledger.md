# KAI-9827 builder ledger

## Authority and outcome

- Law 9.2(a): the product circle is the true circle. Polygonisation is an
  implementation approximation only.
- Law 9.2(b): circle tessellation refines with physical size so radial sagitta
  stays within the source-imported manufacturing tolerance. The catalogue
  contract is 70→59, 130→81, 174→93, 214→103, 262→114, 310→124; the existing
  96-point floor remains lawful through 174.
- Fact F11: `MANUFACTURING_TOLERANCE_MM` is the one manufacturing tolerance.
  This change imports it from `geometry-truth.ts`; no copy is typed.
- Law 2.2: the 10mm physical seating floor remains exact and inclusive.

The fixed 96-point circle now refines only when its physical sagitta would
exceed the manufacturing tolerance. The implementation uses the exact inverse
of the sagitta equation:

`ceil(PI / acos(1 - tolerance / radius))`

Law 9.2(b)'s square-root derivation and the exact inverse agree on every
catalogue budget. The law's table is the contract; the exact inverse is the
implementation proof.

## Full reads and bounded implementation

Before writing, I read the KAI-9827 body and correction comments from Brain OS,
the complete current `grid-laws.md` and `briefs.md`, `AGENTS.md`, `ERRORS.md`,
all five grid engine/transport files, the live bench page, all immediate recipe
callers, and every affected test/performance harness in full. The temporary
read ledger is `/private/tmp/s59-KAI-9827-builder-read-ledger.md`.

Minimal implementation:

1. `stdShapeContour` remains the one standard-circle materialiser shared by
   ladder and plan recipes. A small helper derives its point count from
   diameter and the imported manufacturing tolerance, clamped to the existing
   96-point floor.
2. No new module, protocol, recipe field, cache key function, shape branch, or
   consumer was added.
3. `GRID_ENGINE_CACHE_VERSION` moves 3→4 because serialized circle output
   changes above the first breach.
4. The device-performance Vite fixture now resolves the repository's existing
   `@/*` source alias. Without that one line, the named runtime gate crashed
   before READY when `geometry-truth.ts` imported `@/lib/outline-core/math`.

## RED-first and mutation evidence

Base: `6e353760343be557ff6ba661e1a9718d7ce3b375`.

- The law test was added before engine code. It failed at the first breach:
  `circle Ø214 point budget: expected 103, received 96`.
- After green, the production return was mutated from `required` to
  `required - 1`. The diff was confirmed before execution; the same test failed
  at Ø214 with 102 instead of 103. Restored: green.
- A broad gate exposed a 272mm diamond/48 floor apparent failure:
  polygon-proxy seat `9.996332862mm`. The decisive analytic measurement of the
  true circle at anchor `[136,10]` is exactly `10.000000000mm`. Its 116-gon
  sagitta is `0.049873074mm`; the 0.003667138mm proxy deficit is inside the
  existing derived arithmetic epsilon `0.005mm`.
- This is worked instance 2 of the F17(b) representation/epsilon law and worked
  instance 1 of law 9.2(a) as measurement authority. The floor test now uses
  analytic true-circle distance for Circle only; every other shape retains the
  strict prepared-contour metric. No engine floor was relaxed.

## Before / after: circle tessellation

| Diameter | Before points | After points | Max sagitta status |
|---:|---:|---:|---|
| 70mm | 96 | 96 | lawful floor retained |
| 130mm | 96 | 96 | lawful floor retained |
| 174mm | 96 | 96 | lawful floor retained |
| 214mm | 96 | 103 | first breach corrected |
| 262mm | 96 | 114 | corrected |
| 310mm | 96 | 124 | corrected |

For every refined size, the test proves both halves: the chosen budget is
within `MANUFACTURING_TOLERANCE_MM`, and one point fewer exceeds it.

## Derived catalogue consequence

The existing Auto circle ladder stays byte-identical through 2XL:

`ONE 23 · S 71 · M 119 · L 174 · XL 215 · 2XL 263`

True-circle refinement makes one previously masked covered extent lawful:

`3XL 310 · 16 points · hidden above the 214 visibility ceiling`

The direct default 310mm plan consequently changes from 8 seated,
Standard/96 to 16 seated, Standard/48. This is derived catalogue data under
law 3.1, not a silent rebaseline. The performance fixture hash moves:

`348cd151… → 5285b0d6…`

The post-change product-path table (Auto, light, zero adaptive growth) is:

| Rung | Size | Extent | Tessellation | Delivered | Pattern / pitch | Gaps | Floor |
|---|---:|---:|---:|---:|---|---:|---:|
| S | 71 | 70 | 96 | 2 | standard / 48 | 0 | 11.50 |
| M | 119 | 118 | 96 | 4 | quincunx / 96 | 0 | 11.50 |
| L | 174 | 166 | 96 | 4 | standard / 96 | 0 | 19.12 |
| XL | 215 | 214 | 104 | 4 | diamond / 96 | 0 | 11.50 |
| 2XL | 263 | 262 | 114 | 12 | quincunx / 96 | 0 | 24.17 |
| 3XL | 310 | 310 | 124 | 16 | standard / 48 | 0 | 11.00 |

Every multi-anchor published circle rung is floor-clean and has zero uncovered
intervals. ONE remains the explicit no-grid boundary and is not claimed as a
multi-anchor optimal construction.

## Executed gates

- Focused source + performance contracts: 142/142.
- Law/fixture focused set: 175 passed, 1 explicit law-3.1 todo.
- Final full Vitest: 47 files passed, 1 skipped; 449 passed, 10 skipped,
  1 explicit law-3.1 todo.
- TypeScript: exit 0.
- ESLint: exit 0, changed files; full lint exit 0 with 214 pre-existing
  warnings and zero errors.
- `git diff --check`: clean.
- Device WebKit runtime: all three scenarios T1/T2 PASS.
  Canonical circle ladder cold/warm `1345/1ms`; dense plan `79/0ms`; small
  square `37/1ms`.
- Real Chromium Worker oracle: PASS 6/6 — neutral standard ladder, holed plan,
  diamond ladder, signed-margin Velcro, all-attachment seeded cache hits, and
  physical pre-emption.

## Live visual

Observed in headed Playwright Chromium at
`http://localhost:3970/effect-creator/grid-lab`. PID `38475` served from
`onemo-next/.claude/worktrees/grid-lab`; the source base was `6e35376` plus
this bounded working-tree delta.

- Standard source → Circle → XL rendered at 215×215mm.
- The live result reported 4 seated magnets, Diamond/96, and no flap-risk or
  product verdict surface.
- The first refined visible circle is backed by 104 points at 215mm.
- Screenshot:
  `output/playwright/kai-9827/circle-xl-215.png`.

The in-app browser bootstrap was attempted twice on a clean kernel and failed
with `Cannot redefine property: process`; the required fallback ladder was
used rather than handing off the gate: Playwright Chromium completed both the
visual and real-Worker observations.

## Scope kept

No UI, pattern law, pitch law, scheduler invariant, worker key check, padding
law, non-circle source, or square canon changed. KAI-9836 still owns the wider
approximation sweep; the grid-first solver remains separate work.
