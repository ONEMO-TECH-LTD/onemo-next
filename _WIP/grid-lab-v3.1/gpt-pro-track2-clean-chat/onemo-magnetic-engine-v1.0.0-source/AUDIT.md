# ONEMO Magnetic Free-Shape Engine — Brief Audit

## Audit conclusion

The brief contains a sound geometric core and a sufficient three-layer semantic architecture, but it does **not** uniquely define a final product-ranking engine. The package therefore implements:

1. an exact geometry kernel;
2. a finite, complete candidate enumerator relative to an explicit grammar;
3. a thin product-rule executor that can reject and order candidates only from explicit product evidence and explicit precedence.

It does **not** invent regional decomposition, tongue/overhang thresholds, gravity rules, tight-wrap metrics, escalation precedence, or a winner. Those remain visible input contracts.

## 1. Mathematical facts, modelling assumptions, and product policy

### Mathematical facts

These statements follow from the supplied physical system or from geometry:

- The cutout is the closed region bounded by one validated simple outer outline. Concavity is lawful. Holes and disconnected regions are outside this schema.
- A manufactured version is a homothetic copy of the canonical outline: one positive uniform scale, no rotation, mirroring, deformation, or aspect change.
- Magnet centres are lattice points of a 48 mm square lattice.
- A 96 mm population is obtained by retaining one parity class in each axis from the 48 mm lattice. Its points differ by 96 mm and reuse the same lattice origin.
- The 9 × 9 released field contains 81 base-lattice positions. With indices −4 through +4, the first-to-last centre span is 384 mm; adding the two 12 mm disc radii gives the previously stated 408 mm padded ceiling.
- A closed radius-12 mm holding disc is contained exactly when its centre is in the closed polygonal region and its distance to the boundary is at least 12 mm.
- Boundary equality is lawful because the containment predicates use `>=`, not `>`.
- A direct radius-12 mm straight corridor is a capsule: the centre segment Minkowski-summed with the closed radius-12 mm disc.
- Legal sizes must be solved independently. General concave homothetic feasibility is not monotonic.
- Candidate enumeration is finite because the field, populations, registrations, patterns, and translations are finite.

### Explicit modelling assumptions encoded by this package

The brief leaves the following modelling details underdefined. The package makes them explicit instead of hiding them:

- **Physical size basis:** `max_bbox_extent`. A supplied size is the target length of the canonical outline’s longer bounding-box dimension. Scaling occurs about the canonical bounding-box centre.
- **Field indexing:** base-lattice indices are `[-4, 4] × [-4, 4]`.
- **Finite parity registrations:** the guarded physical specification supplies origins `(0,0)`, `(24,0)`, `(0,24)`, and `(24,24)` mm relative to the cutout bounding-box centre. A solve may supply a different explicit finite list. The 96 mm population never changes any selected origin.
- **Pattern coordinates:** every pattern is an explicit list of integer indices in population coordinates. Translation maps those indices to base indices by

  `base = phase + stride × (patternSite + translation)`.

- **Initial grammar profile v1:** pairs are adjacent population sites; both diagonal slopes exist; complete windows contain every point of a contiguous rectangle; row/column skipping uses strict alternating rows/columns with both outer rows/columns present; corner triangles contain exactly three rectangle corners; corner rectangles contain exactly four rectangle corners.
- **Corridor status in grammar:** every pattern edge is marked either `report` or `require`. The initial profile uses `report`; a corridor excludes a candidate only when the explicit edge mode is `require`.
- **Exact numeric protocol:** physical coordinates enter as finite decimal strings. C++ parses them as exact rationals. Exact distances are returned by their non-negative squared values plus exact limiting witnesses, because an ordinary Euclidean distance can be irrational.
- **Stable identity:** IDs are restricted to ASCII tokens so candidate IDs remain deterministic and unambiguous.

These are ratifiable contracts, not claims that the brief mathematically forced those definitions.

### Product policy

The following are product rules, not geometry:

- how the shape is decomposed into important regions;
- whether regions overlap and how a boundary site is assigned;
- minimum support per region;
- the definition of “worst-supported region” beyond an explicitly supplied regional metric;
- gravity direction and coordinate frame;
- what counts as top support;
- the definition of tight wrap;
- escalation rules between arrangement classes;
- ranking precedence, tie treatment, and any one-per-band publication rule;
- the definition of local tongue, flap, or overhang risk.

The TypeScript layer accepts explicit gates, exact criteria, and precedence and returns reason traces. It does not derive those missing rules.

## 2. Contradictions and missing definitions

### Fixed lattice versus “every registration”

These statements are compatible only when “registration” means a finite, explicit origin alignment relative to the cutout, while 48 mm and 96 mm remain populations of that selected lattice. They would be contradictory if the 96 mm population were implemented by shifting its origin. This package represents registration and population phase separately, and tests that 96 mm points reuse the same origin.

### Physical size is not mathematically defined

A scalar size cannot determine a uniform scale until the reference dimension is named. Width, height, maximum bounding-box extent, area, perimeter, or another measure would produce different manufactured geometry. The request therefore names `max_bbox_extent` explicitly. No alternate basis is silently accepted.

### The arrangement class names do not define a unique grammar

The brief does not state:

- whether “pair” means adjacent sites only or any two sites on the population;
- whether both diagonal slopes are required;
- minimum and maximum rectangle dimensions;
- whether a “rectangular window” includes one-row or one-column cases;
- whether row/column skipping means one omitted row, strict alternation, or arbitrary masks;
- whether corner triangles/rectangles use only adjacent corners or every rectangular span;
- which pattern edges are structural requirements.

The initial profile gives one transparent finite interpretation. The C++ enumerator itself consumes explicit patterns and does not infer a hidden grammar.

### “Lawful matching placement” does not say whether corridors are mandatory

Disc containment alone is enough to establish that each magnet disc fits, but not that material exists along a desired connection. Conversely, a direct corridor is not proof of general fabric connectivity. The grammar therefore declares each edge as evidence-only (`report`) or mandatory (`require`). There is no global implicit corridor rule.

### Local tongue and overhang are undefined

A “local tongue” could mean a component of an eroded region, a narrow medial-axis branch, a boundary arc associated with a magnet, a cantilever length, a neck width, or another physical quantity. No unique predicate follows from the stated facts. The kernel therefore returns exact clearances, limiting witnesses, and requested direct-corridor facts, but no tongue/overhang pass/fail threshold.

### Regional coverage is undefined

Quadrants, connected components, semantic image regions, responsibility cells, geodesic zones, or material lobes are different decompositions and can choose different candidates. The product layer requires explicit region membership/evidence. It never treats the number of contained discs as regional quality.

### Gravity, top support, and tight wrap are undefined

The brief does not define the gravity vector, whether “top” is shape-local or canvas-local, the top-support measure, the tight-wrap measure, or their precedence. The package supplies no formula for them.

### Selection examples are acceptance oracles, not a complete rule system

No full oracle set is present in this brief. Examples can falsify a proposed rule, but cannot generally prove a unique regional decomposition or precedence. The package therefore has no single-winner selector. Any earlier “one size per band” rule would be product policy and would conflict with the current requirement to preserve the complete immutable candidate set; it is intentionally absent from the geometry/enumeration package.

## 3. Geometry predicate proofs and falsifications

### Complete-disc containment theorem

Let `Ω` be the closed polygonal region, `∂Ω` its boundary, `p` the proposed magnet centre, and `D(p,r)` the closed disc of radius `r`.

The package uses:

`D(p,r) ⊆ Ω  ⇔  p ∈ Ω and dist(p, ∂Ω) ≥ r`.

**Necessity:** If the complete disc is contained, its centre is contained. If a boundary point were closer than `r`, the disc would reach across that boundary, so the boundary distance cannot be less than `r`.

**Sufficiency:** Assume `p ∈ Ω` and every boundary point is at least `r` from `p`. If a point `q` in the disc were outside `Ω`, the segment from `p` to `q` would move from the closed region to its exterior and therefore meet `∂Ω` at distance at most `|p−q| ≤ r`, contradicting the boundary-distance condition. Equality is lawful closed tangency.

The implementation evaluates point location exactly and compares exact squared distances, avoiding square roots and tolerances.

### Straight-corridor containment theorem

Let `S=[a,b]` be the centre segment and let `C=S⊕D(0,r)` be its closed radius-`r` capsule. The package uses:

`C ⊆ Ω  ⇔  S ⊆ Ω and dist(S, ∂Ω) ≥ r`.

Necessity is immediate. For sufficiency, any point of the capsule is within `r` of some point of `S`. If such a point were outside, the short segment from the centreline point to it would cross `∂Ω` within distance `r`, contradicting the minimum segment-to-boundary distance. The implementation computes exact segment containment and exact segment-to-edge distance with limiting witnesses.

### Endpoint containment does not prove a corridor

A U-shaped polygon can contain a complete disc in each arm while the straight segment between the centres passes through the open notch. The focused test `endpoint discs versus corridor` constructs exactly that case: both site facts pass, while `centerline_contained` and `complete_corridor_contained` fail.

### A direct corridor does not prove general connectivity

A successful capsule proves only that one named straight capsule lies in the material. It says nothing about other site pairs, alternate paths, a remote lobe, a narrow tongue outside the capsule, or semantic regional support. The result labels it only as direct-corridor evidence.

### Feasibility is not monotonic across size

Consider the simple polygon with outer box `[-500,500]²` and a top notch between canonical `x=60` and `x=200`, extending down to `y=-100`. Its maximum bounding-box extent is 1000. Fix a physical site at `(35,0)` with radius 12 mm.

- At size 100, scale is `1/10`; the inverse canonical site is `(350,0)`. Its physical clearance is 15 mm, so it passes.
- At size 300, scale is `3/10`; the inverse canonical site is `(350/3,0)`, which lies inside the notch and therefore fails.
- At size 900, scale is `9/10`; the inverse canonical site is `(350/9,0)`. Its nearest notch clearance becomes exactly 19 mm physically, so it passes.

Thus the same site has `pass → fail → pass`. The enumerator loops over every supplied size and performs no monotonic pruning.

## 4. Are the three layers sufficient?

Yes, for the stated one-outline, no-rotation scope, provided the contracts above are explicit.

- **Geometry kernel:** prepares and validates the canonical outline once; creates reusable per-size geometry; returns only point, distance, witness, and direct-corridor facts.
- **Candidate enumerator:** consumes exact facts plus explicit patterns; enumerates all fitting translations and registrations; neither scores nor selects.
- **Product logic:** consumes the immutable candidate set plus explicit product evidence and precedence; records every gate, criterion, rejection, and ordering reason.

A worker, cache, C ABI, and UI bridge are execution infrastructure, not a fourth semantic decision layer. They do not introduce geometry or product policy.

## 5. Finite-bound check

Initial grammar v1 contains 461 explicit patterns:

- 1 single;
- 4 adjacent pair patterns;
- 64 complete rectangular windows;
- 36 alternating-row patterns;
- 36 alternating-column patterns;
- 256 corner triangles;
- 64 corner rectangles.

Within one 9 × 9 field and one registration, their complete placement counts are:

- 48 mm population: 9,569;
- 96 mm phase `(0,0)`: 817;
- 96 mm phase `(1,0)`: 505;
- 96 mm phase `(0,1)`: 505;
- 96 mm phase `(1,1)`: 314.

That is 11,710 placements per size/registration. The guarded profile has eight sizes and four registrations, producing a fixed ceiling of **374,720 placement tests**. Geometry rejects most without generating arbitrary subsets.
