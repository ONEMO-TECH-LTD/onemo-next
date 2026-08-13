# MVP contract — raw candidates, four bands

Directive: pure engine + minimum logic. All lawful candidates per band. No ranking, no twin-fix, no shop gates. Existing shell only.

## Layers
- **engine** — lattice sites (`magnetsInRegion`), disc-fit, enumerate grammar.
- **spec** — values + guard only. Legal band sizes and named anchors live here as data.
- **bridge** — one collect call, cached document. No geometry.
- **shell** — indexes the cache. Pan/step do not collect.

## Measure
Full 24mm disc on material. Tangency passes. Sites come from the existing lattice (one grid; 96 = stride 2).

## Enumerate (no score)
single · run (axis or diagonal, ≥2) · rectangle corners (any whole-step spans) · corner triangle (exactly 3 of 4) · full window. Base and sparse populations, same origin. Keep cross-family aliases.

## Bands (size lists only)
1: 24–72 · 2: 72–120 · 3: 120–168 · 4: 168–216 · step 12.

## Anchors (O-1 switches, not ranking)
bbox centre · centroid · max-clearance. Union of candidates across switches. No invented offsets.

## Forbidden
preferred/best flags · twin-fix ceiling · solve on pan · second lattice · ranking.
