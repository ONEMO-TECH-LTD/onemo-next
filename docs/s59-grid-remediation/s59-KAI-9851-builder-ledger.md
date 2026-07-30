# KAI-9851 builder ledger

## Authority and base

- Branch: `session59-task/kai-9851-radial-coverage`.
- Base: `origin/staging` at `044538c3890e023605c02aad78172910eda499fb`,
  verified with `git ls-remote` before branching.
- Dan ruling: every point of the outer edge must be within `HOLD_REACH_MM` of an
  actual magnet, per-magnet radial, identical to hole rims.
- Superseded implementation: convex-hull, capsule and miter expansion that
  invented support between magnets.

## Hydration and probe

- Read `grid-laws.md` 1–1020 in full at SSOT main `890530b`.
- Read `grid-core.ts` 1–1709, `grid.test.ts` 1–967 and `ERRORS.md` in full before
  editing.
- Independent current-base probe:
  `/private/tmp/kai-9851-base-probe.ts`.
- The probe printed a launcher witness, executed 46 product catalogue
  rung-by-density comparisons and sampled 99,366 outline points.
- Exact radial intervals found 15/46 deliveries outside hold reach:
  - Square Light XL 214: `20.439mm` uncovered, worst `49.244mm`.
  - Circle Light XL 216: `280.487mm` uncovered, worst `78.851mm`.
  - Circle Standard XL 216: `13.172mm` uncovered, worst `48.455mm`.
  - Triangle Light S 136: `25.908mm` uncovered, worst `58.779mm`.
  - Diamond Light XL 224: `169.877mm` uncovered, worst `68.819mm`.

## Necessity and sufficiency

Minimal diff:

1. Delete the outer convex-hull/capsule/miter branch and its orphan helpers.
2. Reuse the existing per-magnet disc-interval union for every manufactured ring.
3. Pin a closed-form outer witness and independently verify every published
   construction across both densities.
4. Re-derive only the expectations, cache version and performance baseline that
   move because the corrected authority changes output.

Necessity: no new module, product constant, shape branch, UI path or alternate
coverage authority. The engine diff is net subtractive.

Sufficiency: the one corrected `exactPerimeterCoverage` authority feeds phase
ranking, runtime verdict, adaptive fit and catalogue publication; outer and hole
rings now obey the same per-magnet physics.

## RED to green

At the base:

- closed-form 118mm square / four 96mm-spaced corner magnets expected
  `10.2193156408mm` unsupported outline; the hull oracle returned `0`;
- independent product sweep compared 38 multi-anchor constructions and named
  all 15 radial failures.

After the deletion:

- the closed-form witness returns `10.2193156408mm` and four gap intervals;
- the corrected solver publishes 20 multi-anchor product deliveries and the
  independent oracle reports zero radial failures;
- including ONE, the post-fix product table is 28/28 held.

## Product Auto catalogue — before and after

All listed constructions are Standard/48. Format is `label:sizeMM/anchors`.

| Shape / density | Before `044538c` | After |
|---|---|---|
| Square / Light | `ONE:22/1 S:70/4 M:118/8 L:166/12 XL:214/8 2XL:262/12 3XL:310/12` | `ONE:22/1 S:70/4 M:118/8 L:166/12` |
| Square / Standard | `ONE:22/1 S:70/4 M:118/9 L:166/16 XL:214/25 2XL:262/36 3XL:310/49` | `ONE:22/1 S:70/4 M:118/9 L:166/16` |
| Circle / Light | `ONE:24/1 S:72/2 M:120/4 L:168/6 XL:216/4 2XL:262/6 3XL:310/16` | `ONE:24/1 S:72/2 M:120/4 L:168/6` |
| Circle / Standard | `ONE:24/1 S:72/2 M:120/5 L:168/8 XL:216/13 2XL:262/18 3XL:310/29` | `ONE:24/1 S:72/2 M:120/5 L:168/8` |
| Triangle / Light | `ONE:40/1 S:136/4 M:232/5` | `ONE:40/1 S:150/5` |
| Triangle / Standard | `ONE:40/1 S:136/4 M:232/10` | `ONE:40/1 S:150/5` |
| Diamond / Light | `ONE:32/1 S:80/2 M:128/4 L:176/6 XL:224/4 2XL:272/6` | `ONE:32/1 S:80/2 M:128/4 L:176/6` |
| Diamond / Standard | `ONE:32/1 S:80/2 M:128/5 L:176/8 XL:224/13 2XL:272/18` | `ONE:32/1 S:80/2 M:128/5 L:176/8` |

The larger rungs are not hidden or silently re-labelled; they are absent because
their outline cannot be radially held by the delivered construction. Triangle S
moves `136 → 150` and `4 → 5` anchors because 136 was genuinely uncovered.

## Solver and count obligations

Independent post-fix executable:
`/private/tmp/kai-9851-post-invariants.ts`.

- launcher witness printed;
- 100 rungs and 348 delivered anchors executed across four shapes, six
  mode/pitch cases and both densities;
- construction identity failures: 0;
- off-lattice / wrong-extent failures: 0;
- odd published sizes: 0;
- non-monotonic size or extent: 0;
- uncovered multi-anchor publications: 0;
- larger-size anchor-count drops: 0.

## Verification

- Focused coverage RED: 36 tests, 2 intentional failures.
- Focused coverage green: 36/36.
- Cache/performance/worker contracts: 175/175.
- Affected edge-registration/report contracts: 12/12.
- Typecheck: exit 0.
- Changed-file lint: exit 0.
- Full suite after explicit downstream updates: 459 passed / 10 intentionally
  skipped; 47 files passed / 1 intentionally skipped.
- Device performance: WebKit 26.0; canonical ladder `352ms/1ms`, dense real-AI
  plan `66ms/1ms`, small square `39ms/0ms`; T1/T2 PASS for all three.

## Deslop disposition

- KILL: outer `cross`/`convexHull`, `clipRange`, `capsuleIntervals`,
  `miterHullInterval`; stale edge-registration fixtures for rungs the radial
  catalogue no longer publishes.
- COLLAPSE: outer and hole ring coverage now share one disc-interval loop.
- KEEP: `HOLD_REACH_MM = 48`, population-boundary Light delivery, solver,
  registration ranking and freeform adaptive fit; none is owned by this change.
- DEFER: frameless sizing/admin buffer and truthful label work remain their
  separately ordered tasks.

## Current-runtime visual gate

- Product commit `737190c5ed93a7663cff6a98b63c8c57a28c33cc` served on
  `http://localhost:3970/effect-creator/grid-lab`.
- Provenance: listener PID 19834, `next-server v16.2.6`, cwd
  `.claude/worktrees/grid-lab`, HTTP 200, worktree HEAD exactly `737190c`.
- Playwright fallback exercised the real bench:
  - Circle product Auto exposes only `ONE 24`, `S 72`, `M 120`, `L 168`;
    selected L renders Standard/48, tier 6, seated 6, with no red flap edge.
    Artefact: `output/playwright/kai-9851/circle-l-737190c.png`.
  - Diamond product Auto exposes only `ONE 32`, `S 80`, `M 128`, `L 176`;
    selected L renders Standard/48, tier 6, seated 6, with no red flap edge.
    Artefact: `output/playwright/kai-9851/diamond-l-737190c.png`.
  - With the admin snap toggle disabled, the two original falsification
    witnesses remain reachable only as raw diagnostics: Circle 216 and Diamond
    224 both render their unsupported perimeter in red. They are absent from
    the published product ladder rather than hidden.
    Artefacts: `output/playwright/kai-9851/circle-raw-216-737190c.png` and
    `output/playwright/kai-9851/diamond-raw-224-737190c.png`.
- Browser console: 2 informational development messages, 0 warnings, 0 errors.
- The bench was returned to the safe snapped Circle L 168 state after the raw
  witness checks.
