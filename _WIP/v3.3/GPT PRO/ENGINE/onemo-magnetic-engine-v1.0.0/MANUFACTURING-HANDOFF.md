# Manufacturing handoff

## Engine ManufacturingSpec

Created only from an offered and, for a production profile, continuously certified solution. It pins:

- source and final geometry hashes;
- final quantised cut ring;
- width, height and uniform scale;
- band, population, frame and pattern;
- registration and selected cell addresses;
- exact centre coordinates;
- base and effective verification radii;
- per-centre clearance and minimum effective margin;
- tolerance-composition rule;
- profile, Compute and Logic artifact hashes;
- ordered mechanical decision evidence;
- canonical payload hash.

Timestamps and mutable run metadata are excluded from the canonical hash.

## Fulfilment completion

The fulfilment service must add a versioned physical component profile containing the magnet and process data that affect assembly, including diameter, thickness and the approved cut/placement/material/assembly tolerances.

For `POST_TOLERANCE_MINIMUM_V1` the effective verification radius must cover the base 12 mm requirement plus the adverse tolerance composition. An incompatible component profile is rejected; fulfilment may not silently reuse the nominal proof.

## Historical verification

Keep exact package artifacts and approved profiles resolvable by hash. A historical specification must never be reinterpreted by the newest engine or profile when the original artifact is absent.
