# Grid Engine Blueprint — Architecture, Mathematics and Pipeline

Status: build specification for [`engine-contract.md`](./engine-contract.md)  
Scope: one portable engine that produces measured cutout-variant families  
Build gate: no engine implementation begins until Lead QA and Meta independently accept this document

## 0. Purpose and authority

The contract defines what a valid answer means. This blueprint defines how that answer is produced. A builder must be able to implement the engine from this document without consulting a prototype or choosing missing mathematics.

The prototype is research only. No prototype source is carried. The useful prior result is the independently rerun contact-event proof: support can enter and leave as a concave outline scales, analytic event intervals matched its brute-force oracle, and publication must intersect a lawful interval with the even-millimetre lattice. Intervals are settled rather than merely preferred: Lead's committed falsification harness, independently rerun by Meta, proved the old closed form publishes wholly unsupported deep-notch/C/crescent answers and over-constrains a lawful plus/cross answer; the scan path also returns only a first fit and caused the measured UI freeze. This blueprint retains the interval result and replaces the prototype's square-only population, first-fit return, 48-only solve, 310mm ceiling and UI-coupled execution.

### 0.1 Minimal complete mechanism

One deterministic pipeline is sufficient:

1. validate and canonicalise one solid outline;
2. compute the six centre options once;
3. construct centred run windows on one unmoved lattice;
4. derive every interval on which each lattice disc is supported;
5. derive material-supported arrangements from those intervals;
6. couple 48mm and 96mm arrangements at the same scale and published size;
7. measure clearance, contacts, side reach, extremities and limb candidates;
8. return every distinct family in canonical order and cache the immutable answer;
9. apply returned geometry without invoking the solver.

No shape classifier, free lattice translation, rotation, arbitrary ranking, physical-size input, render-loop calculation, or second production solver exists.

Necessity: no unnecessary element is included.  
Sufficiency: §§1–12 define every computation required by EC-01 through EC-12; open product judgements remain visible evidence, never invented gates.

## 1. Code architecture

The engine is a pure package. The runner and proof surface are adapters around it.

```text
grid-engine/
  contract.ts          request, result and failure types only
  canonical-outline.ts validation, canonical ring and immutable edges
  centres.ts           six centre constructions
  lattice.ts           fixed 48 lattice, 96 thinning, parity targets, run windows
  contacts.ts          analytic support events and lawful intervals per position
  arrangements.ts      material-derived populations and canonical IDs
  coverage.ts          side territories, reach, extremities, zones and contacts
  solve.ts             deterministic M1–M4 composition only
  canonical-output.ts  stable ordering, fingerprints and byte-stable serialisation
grid-engine-runner/
  runner.ts            cache, cancellation and off-interaction execution boundary
grid-engine-oracle/
  oracle.ts            deliberately independent test implementation
```

Rules:

- `contract.ts` imports nothing from the engine.
- Geometry modules import guarded values through the request; they contain no released literals.
- `solve.ts` owns orchestration, not geometry formulas.
- The runner never changes an answer and contains no geometry.
- UI/bridge code can request, cache, select and draw answers; it cannot calculate them.
- The oracle shares fixtures and public types only. It shares no production predicate or helper.

## 2. Public data contract

### 2.1 Request

```text
SolveRequest {
  outline: PointMM[]
  spec: {
    basePitchMM: 48
    sparseFactor: 2
    paddingMM: 12
    positionsPerAxis: 9
    bands: [2, 3, 4]
    centreMethods: [box, oriented-box, area, perimeter, vertices, maximum-clearance]
  }
  flapLimitsMM: [12, 24]
}
```

There is no size, cap in millimetres, target, shape name, rotation, lattice offset, chosen registration, ranking weight or tolerance input. The 9-position ceiling is converted internally to a derived field span.

### 2.2 Result

```text
SolveResult {
  requestFingerprint
  outlineFacts
  families: MeasuredCutoutVariantFamily[]
  emptyBands: { band, centreMethod, reason }[]
  diagnostics: { outlinePointCount, solveDurationMS }
}
```

Each family contains every field required by EC-07 plus:

- `familyId` and `arrangementId48/96`;
- the independent 48/96 run extents that produced those arrangements;
- the tested centre coordinate and parity target;
- per-axis registration (`point | gap`) because row and column parity can differ;
- the exact source interval and manufactured-size interval;
- separate 48/96 topology, coordinates, clearances and binding contacts;
- side territories, reaches, spread, extremities and unsupported-zone records;
- `floor | intermediate | optimum` as a classification only;
- a status derived only from the settled hard predicates.

An unsuccessful band is an explicit result, not an empty array with ambiguous meaning.

## 3. M3 — canonical material region

### 3.1 Supported topology

The upstream Cutout Lab tracer supplies one solid outer outline and drops holes. Therefore the engine accepts exactly one simple closed polygon `P`. Hole semantics, multiple islands and self-intersections are not invented here.

- fewer than three distinct vertices, zero signed area, a self-intersection, multiple rings or a hole ring returns `unsupported-outline`;
- the EC-12 concavity fixtures are single-ring open C/crescent shapes, not topological holes; donuts remain explicitly excluded by the upstream solid-tracer ruling;
- transparent image margin is irrelevant because scale is derived from outline coordinates only.

### 3.2 Canonicalisation without changing geometry

1. remove a repeated closing vertex and consecutive duplicate vertices;
2. reject zero-length edges remaining after that removal;
3. orient counter-clockwise by the exact shoelace-area sign;
4. rotate the vertex sequence to the lexicographically smallest `(x,y)` vertex; break a tie by the lexicographic sequence of following vertices;
5. preserve every non-duplicate vertex and coordinate exactly.

This makes winding and start-index changes byte-identical without simplifying or redrawing the shape.

### 3.3 Immutable edge kernel

For each edge `e_j=[v_j,v_{j+1}]`, prepare endpoints, vector, squared length, bounding box and winding contribution once. The material predicate is exact point-in-polygon against `P`.

For point `x`, let

```text
d(x,e) = ||x - (v + clamp(((x-v)·(w-v))/||w-v||², 0, 1)(w-v))||
d∂P(x) = min_e d(x,e)
clearanceP(x) = +d∂P(x) when x is in P, otherwise -d∂P(x)
```

A magnet centre `q` with support radius `R` is lawful exactly when:

```text
supported(q) ⇔ clearanceP(q) ≥ R
```

This is the configuration-space condition for a complete disc inside material. It is equivalent to membership in the polygon's inner disc offset, but the engine measures the predicate and never constructs or exports an altered outline. [CGAL's 2D Minkowski-sum reference](https://doc.cgal.org/latest/Minkowski_sum_2/index.html) documents exact/guaranteed polygon-disc offsets; that validates the model but is not a required dependency.

## 4. M5 — centre constructions

All methods are options. None is a product default or winner.

| Method | Exact definition |
|---|---|
| `box` | midpoint of the axis-aligned outline bounding box |
| `oriented-box` | centre of the minimum-area enclosing rectangle of the convex hull; enumerate hull-edge orientations by rotating calipers without rotating the outline |
| `area` | signed-area polygon centroid |
| `perimeter` | edge-length-weighted mean of edge midpoints |
| `vertices` | arithmetic mean of canonical vertices; point-count sensitivity is reported |
| `maximum-clearance` | centre of the largest circle contained in `P`, obtained from the interior nearest-feature Voronoi/medial-axis candidates of polygon boundary segments; deterministic coordinate tie-break |

The maximum-clearance method is not a sampled quadtree and has no resolution input. Segment-Voronoi candidates make its termination finite; the winner maximises exact boundary clearance. [CGAL's segment-Voronoi definition](https://doc.cgal.org/latest/Segment_Delaunay_graph_2/index.html) uses minimum Euclidean distance to point/segment sites, matching this construction. Area/perimeter centroid meanings follow the [OGC-conformant Boost.Geometry centroid model](https://www.boost.org/doc/libs/latest/libs/geometry/doc/html/geometry/reference/algorithms/centroid/centroid_2.html).

Each centre is computed once for the frozen canonical outline and included in the request cache entry.

## 5. Fixed lattice, placement and parity

### 5.1 One unmoved lattice

In engine coordinates:

```text
Λ48 = { (48i, 48j) : i,j ∈ ℤ }
Λ96 = { (96i, 96j) : i,j ∈ ℤ } ⊂ Λ48
```

The lattice origin and points never translate. Switching to 96 hides points; it does not recompute a centre or offset.

### 5.2 Per-axis parity target

For a run count `k`:

```text
target(k) = 0mm when k is odd   (centre on a Λ48 point)
target(k) = 24mm when k is even (centre in a Λ48 gap)
```

For a window with `rows=r`, `columns=c`, the tested shape centre is placed at `a=(target(c), target(r))`. Registration is therefore per axis. At 96mm the same `a` remains; the accepted even-run asymmetry is the direct result of thinning.

For centre method `κ` with source centre `Cκ`, scale `σ` places but does not deform the outline:

```text
Tκ,r,c,σ(p) = a(r,c) + σ(p - Cκ)
```

This translation is the declared initial placement of the unchanged outline against the fixed lattice. The only change to its geometry is uniform scale. There is no subsequent pan or fit offset.

### 5.3 Derived ceiling

The ceiling stays a count:

```text
fieldSpanMM = (positionsPerAxis - 1)·basePitchMM + 2·paddingMM
σmax = min(fieldSpanMM / sourceBBoxWidth, fieldSpanMM / sourceBBoxHeight)
```

No millimetre ceiling crosses the public boundary. Both manufactured dimensions must remain inside the count-derived field.

## 6. M1 — finite arrangement grammar

### 6.1 Centred run windows

For every band `n∈{2,3,4}` and every extent `1≤r,c≤n`, construct one centred `r×c` window in each population.

For pitch `s`, the one-dimensional run is:

```text
run(s,k) = { s·(i - floor((k-1)/2)) : i=0..k-1 }
```

At 48 this is centred on the parity target: odd runs around `0`, even runs around `24`. At 96 it is the corresponding fixed thinning around the unchanged target, so even runs are intentionally asymmetric about `24`.

```text
W(s,r,c) = run(s,c) × run(s,r)
```

There are only `n²` centred extent windows per band. Translated windows are excluded: translating the selected run away from its parity target would introduce a free placement choice and contradict centring. Arbitrary subsets are excluded: omitting a supported point would be an engine preference with no law.

### 6.2 Material-derived population

At scale `σ`, population `s` for a window is exactly:

```text
A(s,r,c,σ) = { q ∈ W(s,r,c) : supported against Tκ,r,c,σ(P) }
```

Unsupported members drop automatically. Thus a rectangle stays rectangular when supported; an L, T or unequal partial arises only from material. No shape is named or classified.

An arrangement is admissible only when `A` contains at least one horizontal or vertical adjacent pair at that population's pitch. Two diagonal points or two separated points with no pitch-adjacent edge do not satisfy the non-pivoting pair floor.

Deduplicate equal coordinate sets within the same `(band, centre, population, parity target)` by canonical coordinate-list identity. Retain the smallest canonical extent as provenance when two extents produce the same set; do not emit duplicate arrangements.

### 6.3 Classification

- population `floor`: exactly two magnets forming an admissible pair;
- population `optimum`: exactly four magnets occupy the four corners of their outermost rectangular extent and are reported with their edge contacts;
- population `intermediate`: every other admissible material-derived arrangement;
- family `optimum`: both populations are `optimum`; family `floor`: both are `floor`; every mixed or other case is `intermediate`.

These labels do not sort, rank, discard or gate.

### 6.4 Completeness boundary

The generator exhausts every law-authorised centred rectangular extent up to its band and returns the full supported subset of each. It deliberately does not claim to enumerate every mathematical subset of lattice points. A subset requiring a translated run or deliberate omission of supported material is outside the ruled grammar and therefore outside the engine.

## 7. M4 — exact non-monotonic scale solve

All calculations below use source coordinates relative to `Cκ` and lattice coordinates relative to target `a`; write these as source vertex `v` and fixed magnet point `q`.

### 7.1 Contact events for one lattice point

Support can change only when the radius-`R` disc at `q` is tangent to the scaled polygon boundary or its centre crosses that boundary.

For every source vertex `v`, solve:

```text
||σv - q||² = R²
```

This is a quadratic in `σ`. Keep every real root in `(0,σmax]`.

For every non-zero edge from `v` to `w`, let `d=w-v`. Tangency to its supporting line satisfies:

```text
|cross(d,q) - σ·cross(d,v)| = R·||d||
```

This yields at most two linear roots. Boundary crossing uses the same equation with right side `0`. It is safe to over-generate supporting-line roots, but every interval and event endpoint is labelled by the complete point-in-polygon plus clamped point-to-segment support predicate; irrelevant roots cannot create an answer.

The sorted unique roots plus `0` and `σmax` partition the domain. Test each root and one exact interior witness per open interval. Merge adjacent lawful pieces. The result `I(q)` is the complete union of closed scale intervals on which the full disc at `q` is supported. **Tangency is lawful (`clearance ≥ R`), with no epsilon.** Disjoint intervals are preserved; no monotonicity assumption exists.

### 7.2 Incremental event sweep

Do not build one global interval partition and re-test every point on every interval.

1. compute `I(q)` independently for every lattice point used by any band/window;
2. create start/end events tagged by `(population,q)`;
3. sort once by exact scale, with closed-boundary events before open-interval state changes;
4. maintain one support bitset per population;
5. maintain an inverse index from each position to the centred windows containing it;
6. when a bit changes, recompute only affected windows and emit a new arrangement-state interval when its canonical set changes.

This makes the sweep proportional to actual contact events and affected windows rather than `all events × all points`.

### 7.3 Couple both populations at one manufactured size

For each `(band, centreMethod, parityTarget)`, intersect arrangement-state intervals from 48 and 96. Form the cross-product of every distinct 48 arrangement and every distinct 96 arrangement whose row and column extents produce that same per-axis parity target. The extents may differ between populations; requiring the same `r,c` would silently discard lawful families. Retain a pair `(A48,A96)` only when both arrangements independently contain a lawful pair.

The two populations share:

- the canonical source outline;
- centre method;
- parity target (with separate 48/96 extents);
- uniform scale;
- published manufactured size.

They do not have to contain identical coordinates or magnet counts.

### 7.4 Publication

Let `L=max(sourceBBoxWidth, sourceBBoxHeight)`. A common lawful scale interval `[σ0,σ1]` maps to manufactured longest-side interval `[Lσ0,Lσ1]`.

Enumerate every even integer `m` inside that closed interval in ascending order:

```text
m0 = smallest even integer ≥ Lσ0
m ∈ {m0, m0+2, ...} while m ≤ Lσ1
σpublished = m/L
```

Re-evaluate the complete predicates at `σpublished` in the integer publication domain; a size ships because the exact full-disc predicate clears at that even integer, never because a floating comparison was near a boundary. Each published size is a distinct family record. This is upward publication inside a lawful interval, never blind ceiling and never first-fit termination.

### 7.5 Binding explanation

At the published scale, evaluate every selected magnet against every outline edge and retain the lexicographically first exact minimum tuple:

```text
(clearance, population, magnetCoordinate, edgeIndex, closestOutlinePoint)
```

The interval boundary also retains the contact feature that created it. These records make the answer self-explaining and reproducible by the applied proof.

## 8. M2 — flap, sides, extremities and limbs

### 8.1 Coverage field

For arrangement `A`, let its support discs be `D(q,R)` and define:

```text
ρ(p) = distance(p, ⋃q D(q,R))
     = max(0, min_q ||p-q|| - R)
```

`ρ(p)` is the unsupported reach of material point `p` to the nearest supporting disc.

### 8.2 Four non-overlapping side territories

Relative to the tested centre `a`, assign every material point to one of four 90-degree cones:

```text
left:   dx < 0  and |dx| ≥ |dy|
right:  dx > 0  and |dx| ≥ |dy|
top:    dy < 0  and |dy| > |dx|
bottom: otherwise
```

The strict/non-strict tie rule above is normative. The four territories partition all material, rather than measuring only material beyond the outermost magnets.

For side territory `Mside`:

```text
sideReach(side) = max_{p∈Mside} ρ(p)
spread = max(sideReach) - min(sideReach)
```

Coverage passes for a selected switch value only when all four reaches are `≤12` or all four are `≤24`. Spread is evidence only; it is not equality, argmin, ranking or a pass gate.

### 8.3 Exact maximum-reach computation

Because `ρ` uses distance to the **nearest** magnet, construct the ordinary nearest-site Voronoi diagram of magnet centres, not a farthest-site diagram. Clip each Voronoi cell against the polygon and its side cone. Within a clipped cell the nearest centre is fixed and squared distance to it is convex, so its maximum over each polygonal component occurs at a component vertex. Evaluate:

- canonical polygon vertices;
- side-cone/boundary intersections;
- ordinary Voronoi vertices inside the territory;
- ordinary Voronoi-edge intersections with polygon or side-cone boundaries.

Take the exact maximum and retain every tied material point plus its nearest disc contact. Chew and Drysdale's [constrained largest-empty-circle result](https://digitalcommons.dartmouth.edu/cs_tr/29/) derives the same ordinary nearest-site Voronoi structure for maximising distance to the nearest site inside a polygon.

### 8.4 Material extremity

A `materialExtremity` is a boundary vertex that is a non-strict local maximum of squared radial distance from `a` against its two canonical boundary neighbours. Collinear equal-radius runs collapse to their lexicographically first endpoint. Additionally retain the four global directional extrema `(min x,max x,min y,max y)`. Deduplicate by coordinate.

Every extremity is assigned to its normative side territory and reports `ρ`, nearest disc and whether it exceeds each flap switch. This exposes protruding tips even when the side-wide maximum occurs elsewhere.

### 8.5 Unsupported zones and limb candidates

Define unsupported material exactly:

```text
U = { p∈P : ρ(p) > 0 } = P \ ⋃q D(q,R)
```

Construct its connected components using the arrangement of polygon segments and analytic disc arcs. For each component report area, bounding box, sides touched, extremities contained, maximum reach and limiting point/contact.

A component is labelled `limb-candidate` exactly when:

1. it contains at least one material extremity; and
2. its closure meets the supported region through one connected attachment set.

Otherwise it is `unsupported-zone`. `trivial` is never computed or approved: every limb candidate remains `exception-pending` for applied visual confirmation. This defines limb geometry without inventing a triviality threshold.

## 9. Determinism and numerical kernel

Same canonical outline bytes plus same guarded spec must produce byte-identical families.

- Parse finite decimal input coordinates into exact rationals for predicates and event ordering.
- Use robust/exact orientation, intersection and comparison predicates.
- Algebraic roots are represented by defining polynomial plus isolating interval; compare without locale-formatted decimals.
- Deduplicate equal events algebraically, not by rounded strings.
- Every tie uses the canonical order: band, centre-method registry order, rows, columns, population, coordinate `(y,x)`, scale interval, published size, edge index.
- IDs hash canonical integer/rational encodings, never runtime object order.
- Output serialisation has fixed field and array order and locale-independent decimal formatting.
- No randomness, wall-clock value, platform locale or iteration order affects answer content. Timing stays in diagnostics and outside the canonical answer hash.

## 10. Runner and performance architecture

The portable engine is a pure `SolveRequest → SolveResult` function. The web proof surface invokes it through one runner boundary.

1. fingerprint canonical outline plus every guarded spec input;
2. return an immutable cached result on a hit;
3. on a miss, start one cancellable solve outside the interaction path;
4. publish only if its fingerprint is still current;
5. cache a bounded number of complete results;
6. candidate browsing is an indexed lookup.

For the web instrument the miss runs in one Web Worker because L16 forbids solver or centre work from blocking the UI. This is execution isolation, not a second engine or architecture. Pinch, resize, pan, drag, camera movement and browsing issue zero solve calls. Outline/spec change is the only invalidation trigger.

Performance evidence records event count, window updates, peak memory, wall time and main-thread long tasks on the largest real trace. No unmeasured millisecond budget is invented; any observed interaction stall fails EC-12.

## 11. Independent verification

### 11.1 Oracle

The oracle independently:

- constructs the fixed lattices and centred windows from the public request;
- iterates every publishable even longest-side size derived from the 9-count ceiling;
- directly transforms the outline and measures every complete disc against every edge;
- derives material-supported arrangements by the grammar in §6;
- couples both populations at the same size;
- computes reach by dense subdivision followed by certified upper bounds until it can prove the production maximum lies inside its reported isolating interval.

It compares the complete canonical family-ID set, coordinates, classification and pass/fail facts. It does not share production geometry. The event solver separately proves interval boundaries on analytic fixtures because an even-size oracle cannot prove an interval containing no publishable integer.

### 11.2 Synthetic attacks

- square/circle: arithmetic controls only;
- reversed winding and rotated start index: identical bytes;
- transparent image margin: identical outline result;
- concave C and stepped limb: legality enters then leaves;
- L/T/triangle-like solids: material-derived partial populations;
- sliver: vertical or horizontal pair only;
- diagonal-only two points: rejected as a pivoting/non-pair set;
- open concavity (C/crescent): lawful islands and explicit impossibility where applicable;
- donut/multiple rings/self-intersection/degenerate outline: explicit deterministic refusal;
- asymmetric protrusion and bottom limb: extremity/zone/limb reporting;
- boundary tangency: complete disc accepted at exact contact;
- spec mutations: padding, base pitch, sparse factor and count rederive every answer;
- unknown centre method: explicit refusal.

### 11.3 Real applied proof

Run all seven saved cutouts through every centre method, bands 2/3/4, both populations and both flap switches. Every family must be selectable. The SVG proof draws the transformed outline, full discs, coordinates, side territories, reach segments, extremities, unsupported zones and binding contacts directly from the immutable answer.

An independent browser probe reads the drawn SVG and recomputes coordinates, full-disc containment, reach and contacts without calling production geometry. Screenshot plus numeric probe are both required. A table saying `fits` is not evidence.

### 11.4 Performance proof

On the running current snapshot:

- verify process → worktree → commit provenance;
- record one solve on each real cutout;
- script pinch, resize, pan, drag, camera and variant browsing;
- assert solver and centre invocation count remains zero during that script;
- observe the same interactions on mobile Safari;
- capture the applied surface and performance trace.

## 12. EC coverage and build order

| Contract | Blueprint owner |
|---|---|
| EC-01 | §§3, 5 |
| EC-02 | §§2, 5 |
| EC-03 | §§6–7 |
| EC-04 | §6 |
| EC-05 | §§6.2, 7.3 |
| EC-06 | §§3.3, 7.5 |
| EC-07 | §§2.2, 5.2, 7.4–7.5 |
| EC-08 | §§4, 5.2, 8 |
| EC-09 | §§8.1–8.4 |
| EC-10 | §8.5 |
| EC-11 | §11.3 |
| EC-12 | §§9–11 |

Build in this order, with no build-ahead across a failed gate. The first milestone is deliberately headless and is the minimum viable algorithm/engine Dan required: formula first, algorithm second, test third, verified portable answer fourth. It does not wait for a screen.

1. public types, canonical outline and deterministic serialisation;
2. independent oracle skeleton and analytic fixtures;
3. centre constructions and fixed lattice/parity tests;
4. contact intervals, falsified against non-monotonic fixtures and oracle;
5. arrangement derivation and 48/96 same-size coupling;
6. clearance, binding contacts, side reach, extremities and zones;
7. complete answer assembly and byte-determinism attacks — **freeze and independently verify the headless minimum viable engine here**;
8. runner cache/cancellation and zero-interaction-call proof;
9. only after the headless gate passes, add the applied proof surface and independent SVG probe;
10. seven-cutout, synthetic, performance and visual gates;
11. Builder, QA and Meta each complete EC-01..EC-12 on one frozen snapshot.

## 13. Research disposition

| Prior element | Disposition |
|---|---|
| analytic contact events and disjoint lawful intervals | retain as proven method; reimplement fresh |
| even-size interval intersection | retain; enumerate every even size, not first fit |
| six centre comparison | retain as test options; define exact algorithms here |
| square-only `centredBand` | reject |
| first-lawful size loop | reject |
| 48-only `BandFit` answer | reject |
| grid pan to a chosen centre | reject; lattice is fixed |
| global event partition with full relabelling | reject; incremental affected-window sweep |
| farthest-point Voronoi for flap reach | reject; nearest-site Voronoi is mathematically correct |
| sampled/unexplained maximum-clearance epsilon | reject; finite segment-Voronoi construction |
| old UI matrix and stale evidence images | reject; final evidence is regenerated |

## Closing gate

Lead QA must attack law/contract fidelity, formulas, completeness boundaries and implementability. Meta must independently answer: could two builders, given only the contract, law book and this blueprint, produce the same canonical result? A `CLEAR` requires both:

- **Necessity:** no element can be removed without losing a required answer or proof.
- **Sufficiency:** every required size, layout, coordinate, support fact, side measurement and applied proof is computable without an unstated choice.
