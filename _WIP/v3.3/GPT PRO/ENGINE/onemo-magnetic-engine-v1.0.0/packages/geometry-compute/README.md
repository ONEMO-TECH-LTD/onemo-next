# `@onemo/geometry-compute`

Product-neutral deterministic geometry package. It accepts caller-supplied polygons, radii, lattices, directions and criterion descriptors and returns geometric evidence. It contains no ONEMO product policy.

## Public capabilities

- `preparePolygon`
- `scaleToDominantDimension`
- `clearanceAtPoint`
- `discContainedExact` / `discsContainedExact`
- `adaptiveFeasibleTranslations`
- `buildComponentHierarchy`
- `generateLattice`
- `directionalCapMetrics`
- `evaluateCriterionOnBox`
- `optimizeCriterion`
- `restrictCriterionToAnchor`
- `finalRegistrationTieBreak`
- deterministic canonical JSON/SHA-256
- explicit runtime identity and lifecycle

## Exact final legality

A protected disc is legal only when its quantised centre is inside/on the closed polygon and the exact squared distance to every quantised boundary segment is at least the squared caller radius. Tangency is legal. Positive intrusion by one coordinate quantum is illegal.

Approximate safe/feasible sets are search and certification evidence; they are never the final legality proof.

## Backend

The shipped backend is dependency-free TypeScript. Canonical coordinates are safe integers; exact orientation and distance comparisons use `BigInt`. See `MATHEMATICS.md` and the top-level backend report.

## Build and test

```bash
npm run build
node --test tests/*.test.mjs
```

The generated artifact hash covers every executable JavaScript file in `dist/` except `artifact-manifest.js`, avoiding a self-referential digest.
