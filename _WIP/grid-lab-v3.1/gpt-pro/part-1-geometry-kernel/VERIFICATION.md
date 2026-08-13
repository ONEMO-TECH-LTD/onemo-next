# Part 1 — verification record (s62-kai-lead, 2026-08-13)

Package: `magnetic-grid-measurement-kernel v1.0.0` (TypeScript, zero dependencies).

Checks run in a clean copy, by this lane, not inherited from the deliverable's own claims:

- `shasum -a 256 -c SHA256SUMS` — every file OK.
- `node --test test/golden.test.mjs` — **18 passed, 0 failed**: exact disc tangency,
  clearance ±1 unit either side of tangency, winding / start-index / source-translation
  invariance, concave support, rational transform and origin, straight-capsule tangency
  and side cases, concave centreline crossing, independent evaluation of each requested
  size with input order preserved, rejection (not repair) of a repeated closing vertex
  and of a self-intersection.
- Policy-leak grep over `src/` for band|rank|select|winner|prefer|tier|gravity|wrap|
  escalat|layout|policy|arrangement|sparse — **zero hits**.
- Float scan of predicate paths — no `Number(` conversions; floats appear only in the
  clearly separated display helper `approximateSqrtRational` and in array-index maths.
- API shape: `measureLattice`, `measureStraightCapsule`, `serializeCanonical`. Lattice
  parameters carry pitch, an exact rational origin and an inclusive field extent, and the
  size transform requires caller-supplied `sourceSize` + `sourceAnchor` + `targetAnchor`
  — so no centring convention or meaning of "size" is baked into the kernel.

Verdict: accepted as the Layer-1 baseline. Not to be rewritten by later parts; its 18
goldens must keep passing unchanged inside every later package.
