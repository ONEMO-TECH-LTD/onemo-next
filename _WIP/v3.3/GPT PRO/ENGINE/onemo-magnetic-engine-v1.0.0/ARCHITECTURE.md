# Architecture

```text
Effects Studio / fulfilment caller
                |
                v
        @onemo/magnetic-next
  adaptation, loading, rendering, transport
                |
                v
       @onemo/magnetic-logic
  immutable profile + deterministic product policy
                |
       neutral requests/evidence
                |
                v
      @onemo/geometry-compute
  geometry predicates and measurements only
```

## Separation laws

### Compute package

It knows polygons, points, radii, directions, lattices, bounds, score descriptors and error envelopes. It does not know ONEMO, bands, magnets as product semantics, heads, ears, gravity preference, or the winning pattern.

### Logic package

It owns cell sizes, bands, frame capacity, pattern data, permissions, structural thresholds, the mechanical criterion order, profile lifecycle, deterministic reasons, and manufacturing contracts. It never implements point-in-polygon, distance-to-edge, Boolean geometry or offset mathematics.

### Next adapter

It converts an already validated editor outline, lazy-loads the engine, exposes React state, draws overlays and transports canonical output. No product rule resides in a React component.

## Solve lifecycle

### Interactive preview

1. Validate and canonicalise outline.
2. Evaluate approved size rungs independently.
3. Determine per-axis class and overall band.
4. Enumerate permitted pattern/frame hypotheses.
5. Generate deterministic continuous-domain witnesses and critical candidates.
6. Score candidates through the profile's lexicographic mechanics.
7. Exact-revalidate every selected protected disc.
8. Return one primary offer per band.

### Selected-size certification

1. Rebuild the selected physical size from the source outline.
2. Preserve continuous feasible registration regions through adaptive boxes.
3. Optimise each approved criterion with certified intervals.
4. Prune only on certified dominance.
5. Restrict against the certified global anchor.
6. Apply canonical/nearest/X/Y only inside the surviving mechanical optimum set.
7. Quantise and exact-revalidate every protected disc.
8. Return a certified solution or `DECISION_INDETERMINATE`.

### Manufacturing

1. Bind user selection to the exact source/final geometry and artifact hashes.
2. Re-verify the Engine ManufacturingSpec against the exact executable/profile identity.
3. Fulfilment adds the physical component and process profile.
4. Validate tolerance compatibility.
5. Re-hash the complete physical-product specification.
