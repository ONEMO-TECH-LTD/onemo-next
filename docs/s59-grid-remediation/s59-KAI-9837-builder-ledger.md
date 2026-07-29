# KAI-9837 builder ledger

## Authority and bounded outcome

- Current authority: merged `grid-laws.md` at SSOT commit `3af459e`, especially
  laws 2.1, 2.2, 2.8, 3.1, 3.3, 3.5, 5.9, and 9.2.
- Dan's explicit product requirement: the 70mm sharp and rounded squares both
  carry four corner magnets by default.
- The 70mm size remains unchanged. The earlier 72mm compensation is rejected.
- Catalogue sizing remains `padding + frame = 11mm`; the delivered hard floor
  remains `padding = 10mm`. They answer different questions and are not merged.
- The rounded-square corner is derived from the complete 11mm sizing inset.
- Exact tangency is inclusive. Polygonal contour approximation is bounded by an
  engine-owned epsilon derived from the source manufacturing tolerance.
- No pattern, pitch, ladder algorithm, cache protocol, or unrelated shape
  algorithm changed; only the rounded-square catalogue output moves.

## Full reads

Before writing, every affected source, its immediate consumers, the current law
book, the relevant tests, and `ERRORS.md` were read in full. After writing, all
ten changed source/test files and `ERRORS.md` were read back in full, followed by
the complete diff and `git diff --check`.

## RED first

At base `e371e25fdea109d2b29eac3798cc08b64185362e`:

- exact 10mm rounded-corner tangency seated 2 anchors instead of 4;
- exact 11mm catalogue tangency seated 1 anchor instead of 4;
- the real rounded-square preset published `S 71mm / 2 anchors`, not
  `S 70mm / 4 anchors`;
- the Creator picker used `half * 0.42`, which produced a 151.2px radius in the
  720px source box instead of the law-derived 113.142857px;
- the shape library used a separately baked superellipse, so the two rounded-
  square producers had no shared construction.

## Minimal implementation

1. Added one `roundedSquareDefaultRadius(side)` derivation in the shape library.
   It converts the 11mm canonical inset into the producer's coordinate system;
   no styling fraction remains.
2. Both rounded-square producers consume that derivation:
   the live shape-library preset uses circular arcs, while the Creator picker
   applies the same radius to its reversible square-plus-radius source.
3. Removed the retired baked superellipse source and its offline bake recipe.
4. Bounded prepared-contour chord sagitta with
   `MANUFACTURING_TOLERANCE_MM / 10`. The value is derived, engine-owned, and
   included in `GRID_ENGINE_POLICY_SIGNATURE`; it is not a product padding
   tolerance.
5. Added RED-first regressions for 10mm and 11mm tangency, the real 70mm preset,
   the sharp-square canon, cross-producer geometry, and cache-policy identity.

## Mutation evidence

- Reduced the derived engine epsilon to `1e-6`: the real rounded-square preset
  regressed from four anchors to two. Restored: green.
- Replaced the radius derivation with the old `0.21 * side`: the producer and
  70mm rung regressions failed. Restored: green.
- Restored only the Creator picker's old `half * 0.42`: the actual descriptor-
  driven producer parity test failed. Restored: green.

Each mutation changed the intended source line before its failure was trusted.

## Before / after catalogue

Conditions: Auto mode, light density, zero growth, current 10mm delivery floor.
The detached before tree was the immutable base commit above.

- Sharp square: byte-identical ladder
  `22 · 70 · 118 · 166 · 214 · 262 · 310`.
- Circle, triangle, and rotated-diamond: byte-identical rung/output tables.
- Rounded square before:
  `ONE 23/1 · S 71/2 · M 119/6 · L 167/8 · XL 215/12 · 2XL 269/16`.
- Rounded square after:
  `ONE 22/1 · S 70/4 · M 118/6 · L 166/8 · XL 214/12 · 2XL 262/16 · 3XL 310/24`.
- Every after-state rounded-square multi-anchor rung resolves `ok:true` with
  zero uncovered intervals.
- At `S 70`, the ladder and delivered plan both seat four Standard/48 corner
  magnets. The flattened contour reports 10.996673mm at the sizing centre; the
  source curve is exact 11mm tangency and the 0.005mm representation bound
  covers the 0.003327mm chord sagitta.

The only catalogue movement is the intended rounded-square correction. `ONE`
remains the classified single-anchor boundary and is not presented as a
multi-anchor hold construction.

## Executed gates

- Targeted `grid.test.ts` + `grid-sources.test.ts`: 33 passed, 1 todo.
- TypeScript: exit 0.
- Full Vitest: 46 passed files, 1 skipped file; 437 passed, 10 skipped, 1 todo.
- ESLint: exit 0, 0 errors; 214 pre-existing warnings.
- `git diff --check`: clean.
- Stale-source sweep: zero `half * 0.42` and zero `SQUIRCLE_ANCHORS`.

## Live visual

- Surface: `http://localhost:3970/effect-creator/grid-lab`.
- Serving process cwd was verified as this `grid-lab` worktree.
- Playwright Chromium observed the live preset path:
  `squircle · S · 70mm · tier 4pt · seated 4 · Standard/48`.
- The centre view visibly shows four corner magnets and the 11mm circles aligned
  with the rounded corner curve; no page error was observed.
- Capture:
  `.playwright-cli/page-2026-07-29T17-09-28-488Z.png`.
- The old physical-product photo under `~/Downloads` was not readable from this
  process because macOS denied that directory. I therefore do not claim a
  direct photo-to-render comparison. The rendered geometry was checked against
  the source law and Dan's stated physical construction; Designer QA should
  perform the photo comparison on its permitted visual surface.

## Outcome

The 70mm rounded-square default is fixed forward to four lawful corner seats
without moving the product size or restoring the deleted corner tolerance.
Unrelated shapes, the sharp-square canon, and the 10/11 layer distinction remain
untouched.
