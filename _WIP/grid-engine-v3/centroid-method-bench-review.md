# Centroid method bench — QA handoff

Snapshot: `eb32c046` on `session62-task/grid-centroid-method-bench`, based on cleanup snapshot `748f3e99`.

## Directive covered

- Add an admin switch for all relevant centre constructions.
- Retain oriented-box centre for a possible future rotation mode, without adding rotation now.
- Run the same traced outline through each method and empirically test the difference.
- Do not select a production default or infer the still-unruled automatic band/coverage policy.

## Implementation

The portable engine now computes six definitions:

1. axis-aligned bounding-box centre
2. minimum-area oriented bounding-box centre
3. polygon area centroid (signed shoelace moments)
4. perimeter-weighted boundary centroid
5. vertex mean (sampling-sensitive by definition)
6. maximum-clearance interior point (branch-and-bound pole of inaccessibility)

The bridge maps the traced picture-relative ring into millimetres and translates the selected centre
to the existing grid origin. The shell owns only the experimental selector and draws the bridge answer.
Oriented-box selection translates only: it does not rotate the shape, lattice, camera, or magnets.

Maximum-clearance precision is derived from the existing padding input by four halvings (0.75mm at
the released 12mm padding). It is an experimental thickest-material anchor, not a mass/balance claim.

## Gates run

- `vitest --run src/lib/grid-engine/__tests__`: 28/28 passed.
- `tsc --noEmit`: passed.
- scoped ESLint: passed.
- production Next build: passed; `/grid-engine` generated.
- separation guard: included in the passing suite.

## Real-surface observation

Served this worktree on `:3134`, loaded an asymmetric alpha L-cutout through the real file control,
then selected every method. Observed source offsets:

- box: -0.1, -0.1mm
- oriented box: -0.1, -0.1mm (expected for this axis-aligned fixture)
- area: -10.6, 8.8mm
- perimeter: -7.6, 7.4mm
- vertices: -7.6, 7.4mm (the traced contour is near-uniformly sampled)
- maximum clearance: -23.7, 23.5mm

Evidence: `evidence/centroid-methods/box.png` and `evidence/centroid-methods/area.png`.

## QA request

Audit source and live behavior independently. In particular attack:

- translation-only behavior for every method;
- oriented-box calculation without accidental rotation;
- area/perimeter winding invariance;
- maximum-clearance stability on concave outlines;
- whether the admin selector remains experimental and makes no product-default claim.

No push, merge, production default, automatic band selection, or coverage/balance precedence is in scope.
