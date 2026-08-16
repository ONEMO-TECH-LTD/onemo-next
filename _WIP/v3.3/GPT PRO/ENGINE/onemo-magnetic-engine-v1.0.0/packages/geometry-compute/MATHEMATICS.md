# Mathematical implementation notes

## Canonical polygon

Input points are quantised by the caller-provided quantum `q`. The package:

1. removes a duplicate explicit closing point;
2. removes adjacent duplicates introduced by quantisation;
3. rejects fewer than three distinct vertices;
4. rejects zero-length edges and self-intersection;
5. orients the ring counter-clockwise;
6. rotates it to the canonical lexicographically minimal start sequence;
7. hashes canonical integer coordinates.

## Exact disc containment

For centre `c` and radius `r`, legality is:

```text
c belongs to the closed polygon
AND
minimum squared distance from c to every polygon segment >= r²
```

The comparison is performed in the canonical integer coordinate system with rational segment projection represented through integer numerators/denominators and `BigInt` cross-multiplication. Floating-point clearance is returned for diagnostics, but the legal boolean is controlled by the integer proof.

## Continuous translation

For relative offsets `oₖ`, translation `t` is feasible when every `t + oₖ` supports the requested disc. The package represents the continuous domain with adaptive axis-aligned boxes.

The signed distance field is 1-Lipschitz. At a box centre, the box half-diagonal bounds how much clearance can change anywhere in that box. This gives conservative classifications:

- `INSIDE`: every requested disc is legal throughout the box;
- `OUTSIDE`: at least one disc is illegal throughout the box;
- `BOUNDARY`: unresolved mixture, retained or refined.

An empty conservative witness set is not automatically certified empty. Resource/tolerance limits return an indeterminate status rather than a guessed negative.

## Structural hierarchy

The current backend computes multi-clearance connected evidence on a caller-defined regular sample board. The response carries an error envelope equal to the cell half-diagonal. Logic owns all labels and thresholds.

## Neutral criterion registry

`geometry-criteria-v1` supports:

- region coverage and selected-region coverage;
- unsupported cap first moment;
- maximum directional overhang;
- exact discrete scalar/key;
- maximum region load;
- anchor-centroid balance;
- point count;
- final registration identity.

Every criterion returns exact or certified interval evidence. Product priority and semantic meaning remain outside this package.

## Dominance-safe optimisation

The package exposes local interval optimisation and anchored restriction. It never decides product dominance. Logic compares interval evidence and must retain any candidate that may still be equivalent or superior.

## Numerical limits

Canonical coordinates must remain JavaScript safe integers after division by the coordinate quantum. Input overflow and excessive vertex counts are typed failures; the package never silently simplifies source geometry.
