# Grid Engine Blueprint v2.1 — Architecture, Mathematics and Pipeline

Status: next-version build specification for [`engine-contract.md`](./engine-contract.md)
Scope: one portable engine that produces measured cutout-variant families  
Build gate: no engine implementation begins until Lead QA and Meta independently accept this document

## 0. Purpose and authority

The contract defines what a valid answer means. This blueprint defines how that answer is produced. A builder must be able to implement the engine from this document without consulting a prototype or choosing missing mathematics.

Provenance boundary: Dan's confirmed requirements define the predicates and outputs. Equations, event construction, graph composition, data structures and optimisations in this blueprint are `DERIVED` engineering mechanisms unless a Dan quotation is explicitly attached. They require independent falsification and may never be restated as his law.

The prototype is research only. No prototype source is carried. The useful prior result is the independently rerun event-interval proof: legality can enter and leave as a concave outline scales, analytic event intervals matched an independent brute-force oracle, and publication must intersect a lawful interval with the even-millimetre lattice. Intervals are settled rather than merely preferred: Lead's committed falsification harness, independently rerun by Meta, proved the old closed form publishes wholly unsupported deep-notch/C/crescent answers and over-constrains a lawful plus/cross answer; the scan path also returns only a first fit and caused the measured UI freeze.

Version 2 changes the solved predicate. Individual disc containment is not the manufacturing answer. Dan's later ruling makes the connected pair the geometric unit: every adjacent horizontal or vertical pair contributes its padding-grown box, those boxes form one union, and the scaled shape must encapsulate that complete union. Pair-box containment both discovers material-derived partial populations and determines lawful scale; the former disc-event pipeline is unnecessary.

### 0.1 Minimal complete mechanism

One deterministic pipeline is sufficient:

1. validate and canonicalise one solid outline;
2. compute the six centre options once;
3. construct centred run windows on one unmoved lattice;
4. derive closed containment intervals for every adjacent pair's padded box;
5. sweep those pair states to discover material-supported connected arrangements;
6. intersect the active pair-box intervals to obtain every arrangement's lawful scale intervals;
7. couple 48mm and 96mm arrangements at the same scale and published size;
8. measure contacts, per-population grid-box overhangs, extremities and limb candidates;
9. return every distinct family in canonical order and cache the immutable answer;
10. apply returned geometry without invoking the solver.

No shape classifier, free lattice translation, rotation, arbitrary ranking, physical-size input, render-loop calculation, or second production solver exists.

Necessity: no unnecessary element is included.  
Sufficiency: §§1–12 define every settled computation required by EC-01 through EC-12 and EC-11b. The two explicitly open product judgements prevent a complete-engine freeze; they are not hidden behind invented defaults.

## 1. Code architecture

The engine is a pure package. The runner and proof surface are adapters around it.

```text
grid-engine/
  contract.ts          request, result and failure types only
  canonical-outline.ts validation, canonical ring and immutable edges
  centres.ts           six centre constructions
  lattice.ts           fixed 48 lattice, 96 thinning, parity targets, run windows
  containment.ts       pair boxes, boundary events and lawful scale intervals
  arrangements.ts      active-pair components, region unions and canonical IDs
  overhang.ts          grid boxes, flap overhangs, extremities and limb candidates
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
    bands: [2, 3]
    centreMethods: [box, oriented-box, area, perimeter, vertices, maximum-clearance]
  }
  flapLimitsMM: [12, 24]
}
```

There is no size, cap in millimetres, target, shape name, rotation, lattice offset, chosen registration, ranking weight or tolerance input. The 9-position ceiling is converted internally to a derived field span.

Every spec field above, including `sparseFactor`, is a guarded law input. No module may supply it as a local default or literal.

### 2.2 Result

```text
SolveResult {
  requestFingerprint
  outlineFacts
  families: MeasuredCutoutVariantFamily[]
  emptyBands: { band, centreMethod, reason }[]
  diagnostics: { outlinePointCount, solveDurationMS }
  offerings: {
    status: complete | separation-policy-unresolved
    rawFamilyIds[]
    ladderFamilyIds[]
    separationMM?: guarded product value
  }
}
```

Each family contains every field required by EC-07 plus:

- `familyId` and `arrangementId48/96`;
- the independent 48/96 run extents that produced those arrangements;
- the tested centre coordinate and parity target;
- `centreRelationships` for every centre method and both populations, as defined in §8.0;
- per-axis registration (`point | gap`) because row and column parity can differ;
- the exact source interval and manufactured-size interval;
- separate 48/96 active-pair topology, padded pair boxes, region union, coordinates, implied disc clearances and region binding contacts;
- per-population padded grid boxes, four overhangs, spread, extremities and outside-box zone records;
- `floor | intermediate | optimum` as a classification only;
- per-population `twin-fix | multi-fix` plus the size-only twin-fix eligibility fact from §7.7;
- a status derived only from the settled hard predicates.

All manufactured geometry is returned in the selected shape frame: origin at the tested centre `Cκ`, `+x` right, `+y` down. Thus returned magnet coordinate is `qshape=q-a`, returned outline coordinate is `σ(p-Cκ)`, and no consumer needs the engine's lattice target. Engine-frame coordinates may appear only as labelled diagnostics.

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

**Measured centre sensitivity, not a default.** On the frozen seven-cutout corpus, maximum-clearance produces five to eight lawful four-point sizes for every shape. The Duck produces zero with box or area centre and five with maximum-clearance. Therefore centre methods are not interchangeable diagnostics: the chosen construction can change whether a lawful family exists. The engine continues to return all six until Dan rules the product-facing centre policy; no builder may silently default to the cheapest or first registry entry.

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

For every operational band `n∈{2,3}` and every extent `1≤r,c≤n`, construct one centred `r×c` window in each population. Band 4 is not enumerated as an offered band; its 168mm span survives only in the separate twin-fix rule and does not create band-4 families.

For pitch `s`, the one-dimensional run is:

```text
run(s,k) = { s·(i - floor((k-1)/2)) : i=0..k-1 }
```

At 48 this is centred on the parity target: odd runs around `0`, even runs around `24`. At 96 it is a fresh run on the fixed subset `Λ96` about the unchanged 48-derived target; it is not a subset of the finite 48 run. Even runs are therefore intentionally asymmetric about `24`.

```text
W(s,r,c) = run(s,c) × run(s,r)
```

There are only `n²` centred extent windows per band. Translated windows are excluded: translating the selected run away from its parity target would introduce a free placement choice and contradict centring. Arbitrary subsets are excluded: omitting a supported point would be an engine preference with no law.

### 6.2 Material-derived population

For each window, construct its fixed adjacency graph `G=(V,E)`: `V=W(s,r,c)` and `(q1,q2)∈E` exactly when the two points are horizontal or vertical neighbours one population pitch apart. Diagonals are never edges.

At scale `σ`, an edge is active exactly when its padded pair box is contained:

```text
Eσ = { e ∈ E : B(e) ⊆ Tκ,r,c,σ(P) }
```

The material-derived arrangements are the connected components of `(V,Eσ)` that contain at least one edge. Vertices incident to no active edge are excluded by the ruled pair floor: without an active connection they are pivoting single magnets, not arrangements. Thus a full rectangle remains rectangular only while all of its connecting pair boxes fit; an L, T, run or unequal partial arises automatically when the material admits exactly those connections. No shape is named and no active connection is deliberately removed.

The 48mm three-position run and the 96mm sparse pair are generated independently by their own population graphs. `###` has two active 48mm edges; `#.#` has one active 96mm edge. Both occupy the same `120×24mm` padded region, so the sparse pair can be reported as the ruled preferred equivalent without mutating the 48mm arrangement.

Deduplicate equal components within the same `(band, centre, population, parity target)` by canonical vertex-and-edge identity. Retain the smallest canonical extent as provenance when two windows produce the same component; do not emit duplicates.

### 6.3 Classification

- population `floor`: exactly two magnets forming an admissible pair;
- population `optimum`: exactly four magnets occupy the four corners of their outermost rectangular extent **and this is the first lawful published size in that arrangement's interval**, so it is the published edge-fit for that interval; later/looser sizes with the same four-corner topology are `intermediate`;
- population `intermediate`: every other admissible material-derived arrangement;
- family `optimum`: both populations are `optimum`; family `floor`: both are `floor`; every mixed or other case is `intermediate`.

These labels do not sort, rank, discard or gate.

`optimum` is not guaranteed to exist. If no lawful four-corner edge-fit exists for a shape, centre or band, no family receives that label; the result remains truthful and the available intermediate arrangements and pair floor remain present. A later selection stage must degrade through those existing families and may never manufacture an optimum classification.

### 6.4 Completeness boundary

The generator exhausts every law-authorised centred rectangular extent up to its band and returns every connected component produced by its active pair boxes. It deliberately does not enumerate arbitrary mathematical subsets. A layout requiring a translated window or deliberate removal of an active connection is outside the ruled grammar and therefore outside the engine.

**Declared product question — disconnected supported pairs.** Under the current component rule, two separated active pairs are returned as two pair arrangements, never as one four-magnet family. A butterfly whose two wings each hold a pair therefore cannot receive a four-corner classification from those disconnected pairs. Dan's four-corner balance ruling may instead intend their disconnected union to be one layout. This changes the returned arrangements and must be confirmed before §6 freezes; the blueprint does not silently combine them or silently claim they are forbidden.

## 7. M4 — exact pair-region containment solve

All calculations use source coordinates relative to `Cκ` and engine coordinates relative to parity target `a`. Write a source vertex as `v`, a fixed lattice point as `q`, and a fixed region point relative to `a` as `b`.

### 7.1 The region being solved

For every adjacent horizontal or vertical pair `(q1,q2)` in arrangement `A`, define its closed padded box:

```text
B(q1,q2) = [min(q1.x,q2.x)-P, max(q1.x,q2.x)+P]
           × [min(q1.y,q2.y)-P, max(q1.y,q2.y)+P]
```

The arrangement region is the exact polygonal union:

```text
Q(A) = union B(q1,q2) over every adjacent pair in A
```

Every retained magnet belongs to at least one adjacent pair. Consequently `Q(A)` contains every complete radius-`P` magnet disc. The central predicate is:

```text
lawful(A,κ,σ) ⇔ Q(A) ⊆ Tκ,σ(P)
```

Containment is closed: touching boundaries are lawful. Because union distributes over containment,

```text
Q(A) ⊆ T(P) ⇔ B(e) ⊆ T(P) for every edge e in A
```

the solver never needs a general polygon-union Boolean operation. It solves each rectangle exactly, then intersects the resulting intervals. For a complete 2×2, the four boxes form a ring with a `24×24mm` centre hole; testing the four constituent boxes is exact and gives the same containment answer as the union on every solid outline. Per-disc clearance is re-evaluated only as an invariant check.

### 7.2 Complete containment events for one pair box

For a fixed pair box `B`, the truth of `B ⊆ Tκ,σ(P)` can change only when the rectangle boundary and outline boundary touch. The complete event set contains both vertex-edge directions.

For every box corner `b` and source outline edge `[v,w]`, with `d=w-v`, solve the linear collinearity equation:

```text
cross(d, b) - σ·cross(d, v) = 0
```

For every source outline vertex `v` and box edge `[b,c]`, with `e=c-b`, solve:

```text
σ·cross(e, v) - cross(e, b) = 0
```

Coordinates `b,c` are relative to target `a`. Each equation has form `A-σB=0`: if `B≠0`, retain `σ=A/B` when it is positive, within the count-derived ceiling and the contact lies on both finite closed segments. If `A=B=0`, the supporting lines are collinear for all scales; add the linear endpoint-coincidence scales on the dominant axis so every change in finite-segment overlap is still partitioned. It is safe to retain extra supporting-line roots because the full predicate labels every piece.

The sorted exact roots plus `0` and `σmax` partition the domain. Evaluate every root and one exact witness in every open piece. At an evaluation scale, rectangle containment is exact when:

1. all four box corners are inside or on the manufactured polygon;
2. split every box edge at all exact intersections with the outline boundary and verify one point from every resulting open subsegment is inside or on the polygon;
3. reject every proper boundary crossing into exterior material.

The subsegment test is necessary: on a concave outline all four corners can be inside while a notch crosses the middle of a box edge. Since the accepted outline is one solid simple polygon with no holes, these boundary conditions are sufficient for the rectangle interior as well.

Merge adjacent lawful pieces, preserving isolated lawful contact points and disjoint intervals. The result is `I(e)`, the complete closed scale set for one pair box. No monotonicity, bisection or millimetre walk is assumed. Every endpoint retains the exact `(box corner|edge, outline vertex|edge)` contact that opened or closed it.

### 7.3 Arrangement sweep and interval composition

1. compute `I(e)` once for every adjacent pair edge used by any operational window;
2. create exact start/end events tagged by `(population,e)`;
3. sort once, with closed-boundary membership evaluated at the event itself;
4. maintain one active-edge bitset per population;
5. maintain an inverse index from each edge to the centred windows containing it;
6. when an edge changes state, recompute connected components only in affected windows;
7. emit a new arrangement-state interval whenever a component's canonical vertex-and-edge identity changes.

For a component `A`, its lawful scale set is exactly `intersection I(e)` over its active edges. This is also the containment interval of `Q(A)` by §7.1. The sweep therefore discovers the population and solves its manufacturing legality with the same predicate; no second geometry model can disagree.

### 7.4 Couple both populations at one manufactured size

For each `(band, centreMethod, parityTarget)`, intersect containment-lawful arrangement intervals from 48 and 96. Form the cross-product of every distinct 48 arrangement and every distinct 96 arrangement whose row and column extents produce that same per-axis parity target. The extents may differ between populations; requiring the same `r,c` would silently discard lawful families. Retain a pair `(A48,A96)` only when both complete pair-box unions are contained and both arrangements independently contain a lawful pair.

The two populations share the canonical outline, centre method, parity target, uniform scale and published manufactured size. They do not have to contain identical coordinates, regions or magnet counts.

### 7.5 Publication

Let `L=max(sourceBBoxWidth, sourceBBoxHeight)`. A common lawful scale interval `[σ0,σ1]` maps to manufactured longest-side interval `[Lσ0,Lσ1]`.

Enumerate every even integer `m` inside that closed interval in ascending order:

```text
m0 = smallest even integer ≥ Lσ0
m ∈ {m0, m0+2, ...} while m ≤ Lσ1
σpublished = m/L
```

Re-evaluate exact pair-region containment for both populations at `σpublished`. A size ships because both complete regions are contained at that exact even integer, never because a floating comparison was near a boundary. Each published size is a distinct family record. This is upward publication inside a lawful interval, never blind ceiling and never first-fit termination.

Only the source outline's **longest side** publishes as the whole even millimetre `m`. The other manufactured dimension is `m` multiplied by the source bounding-box aspect ratio and is returned exactly; it is never independently rounded.

### 7.6 Binding explanation

Each interval endpoint retains the exact region/outline feature contact that created it. At the published scale, compute the minimum exact boundary separation between `Q(A)` and the manufactured outline for each population and retain the lexicographically first tuple:

```text
(separation, population, regionFeature, outlineFeature, closestPoints)
```

Also re-evaluate every magnet disc and retain its minimum clearance as an invariant. The region contact explains the manufactured size; the disc clearance proves the implied magnet support. They are distinct fields and may not be renamed into one another.

### 7.7 Twin-fix classification

Twin fix is a fixing classification, not a shape grammar or a new solve. For each population independently, an arrangement containing exactly two retained magnets is `twin-fix`; an arrangement containing three or more is `multi-fix`. At a published longest side `m`, the twin fix is size-eligible exactly when:

```text
m < twinFixLimitMM
twinFixBaseSpanMM = (4 - 1)·basePitchMM + 2·paddingMM
twinFixLimitMM = twinFixBaseSpanMM + max(flapLimitsMM)
               = 168mm + 24mm
               = 192mm under the released spec
```

The limit is derived from guarded values, never accepted as a size input or repeated as an engine literal. There is no aspect-ratio, elongation or shape-name condition. The limit does not apply to `multi-fix`; three or more magnets remain bounded by the count-derived field. The larger built-in-garment-grid regime remains an explicit product-boundary question: the current engine has no garment-capability input and must not infer one.

### 7.8 Raw families and the user-facing size ladder

The canonical answer always retains every lawful family in §9 order. The admin proof surface steps through that raw order without omission.

The user-facing ladder is a derived ID view over those immutable families. EC-11b requires separated offerings but does not yet define the minimum separation value or the exact deterministic thinning rule. Until both are ruled and added as a guarded product input, `offerings.status=separation-policy-unresolved`, `rawFamilyIds` contains the complete canonical order, and `ladderFamilyIds` is empty. The engine may not guess 12, 24 or 48, use first-fit, or hide clustered answers behind an undocumented UI filter.

When that product rule is settled, this section must define one deterministic pass over already-computed IDs; it may mark or index families but never delete them. An absent four-corner `optimum` remains absent: ladder construction degrades only through existing intermediate and floor families and never manufactures an optimum.

## 8. M2 — centre relationship, grid-box flap and limbs

### 8.0 Centre relationship

For a family placed using centre method `κ`, express the source coordinate of every tested centre method `λ` and each magnet population in the returned shape frame:

```text
zλ = σ(Cλ - Cκ)                            tested centre in shape frame
μs = (1 / |As|) · Σq∈As (q-a)             magnet-population centroid in shape frame
Δs,λ = μs - zλ                            centre displacement vector
```

For every `λ` and population, return `{ shapeCentreMM:zλ, magnetCentroidMM:μs, displacementMM:Δs, distanceMM:||Δs,λ|| }`. This is the normative EC-08 relationship: the actual material-supported magnet population relative to each tested shape centre. It is not the rectangular window midpoint and not a selected winner.

### 8.1 Padded grid bounding box

Flap is computed separately for each population because the 48mm and 96mm arrangements can have different coordinates and extents. For population arrangement `As`, expressed in the returned shape frame, define:

```text
gridBoxs = {
  left:   min(q.x for q in As) - P,
  right:  max(q.x for q in As) + P,
  top:    min(q.y for q in As) - P,
  bottom: max(q.y for q in As) + P
}
```

This reproduces Dan's canonical examples exactly: a horizontal pair 48mm apart produces a `72×24mm` box; four `2×2` 48mm points produce a `72×72mm` box. Nothing inside this box is flap.

### 8.2 Four exact overhangs

Let the manufactured outline bounding extents in the same shape frame be `(shapeLeft, shapeRight, shapeTop, shapeBottom)`. For each population:

```text
overhang.left   = max(0, gridBox.left   - shapeLeft)
overhang.right  = max(0, shapeRight    - gridBox.right)
overhang.top    = max(0, gridBox.top    - shapeTop)
overhang.bottom = max(0, shapeBottom   - gridBox.bottom)
spread          = max(overhang) - min(overhang)
```

These four subtractions are the complete flap measure. A square whose manufactured bounds equal its padded grid box reads `0/0/0/0`; a circle 10mm larger in radius than the box reads `10/10/10/10`. Equal overhangs are Dan's “flap evened out on all sides”; spread is evidence, never an argmin or pass gate.

The two switch outcomes are computed and reported separately for each population: `flapLimitMM=12` passes only when all four overhangs are `≤12`; `flapLimitMM=24` passes only when all four are `≤24`. A family passes a switch only when **both** its 48mm and 96mm population outcomes pass it. Passing 24 never implies passing 12.

The canonical family output therefore carries `gridBoxMM`, `overhangMM` and `overhangSpreadMM` inside each population record. There is no singular family-level reach because the two population boxes can differ. The contract's answer sketch must use these per-population fields before build; no compatibility alias may create a second meaning.

**Declared limitation.** Flap is now a bounding-box function. Two different outlines with identical four extrema and the same arrangement box produce identical flap evidence; concave voids and unsupported material that remains inside the box are invisible to this measure. Full-disc support still rejects magnets that lack material, and the applied outline remains visible, but the engine does not silently promote another uncovered-surface metric into flap.

### 8.3 Material extremities

For each side, retain every outline point attaining the corresponding manufactured bound: all points at `shapeLeft`, `shapeRight`, `shapeTop` or `shapeBottom`. On a polygon these are vertices or collinear boundary segments; canonicalise a segment by its ordered endpoints. Each extremity reports its side, coordinate and that side's population-specific overhang.

No radial extremity, angular cone or nearest-disc distance is part of flap. A diagonal protrusion that remains inside the grid box is not flap under the ruled definition and the engine does not create a second hidden measure for it.

### 8.4 Overhang zones and limb candidates

For population `s`, intersect the manufactured polygon boundary with the complement of `gridBoxs`. The exact segment/axis-aligned-box intersections partition it into maximal connected outside-box boundary chains. Each chain reports:

- population and side or sides crossed;
- ordered boundary coordinates and bounding box;
- maximum side overhang from §8.2;
- contained material extremities;
- `unsupported-zone | limb-candidate`.

A chain is a `limb-candidate` exactly when it contains a material extremity; otherwise it is `unsupported-zone`. This is deliberately broad because neither `narrow` nor `trivial` has a ruled numeric definition. The engine never silently approves the exception: any over-limit limb remains `exception-pending` for applied visual confirmation.

There is no interior-gap diagnostic in the engine. Dan ruled that space between magnets is not flap and its fabric behaviour is a physical question, so computing or scoring it here would be unnecessary scope.

## 9. Determinism and numerical kernel

Same canonical outline bytes plus same guarded spec must produce byte-identical families.

- Preserve the canonical finite-decimal input representation and use filtered robust predicates with exact fallback for orientation, intersection, tangency and equality. Exact fallback is necessary because the canonical square answer is tangency at clearance exactly `12mm`; an epsilon would change a lawful answer.
- Algebraic contact roots are represented by defining polynomial plus isolating interval only where exact event ordering/equality requires it. Ordinary non-boundary arithmetic need not be promoted to a general rational-number architecture.
- Deduplicate equal events algebraically, not by rounded strings.
- Every tie uses the canonical order: band, centre-method registry order, rows, columns, population, coordinate `(y,x)`, scale interval, published size, edge index.
- IDs hash canonical exact numeric encodings, never runtime object order.
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

Raw-family browsing and any later ladder browsing both use those indices. Neither invokes geometry or changes the immutable result.

Pinch, resize, pan, drag, camera movement and browsing issue zero solve calls. Outline/spec change is the only invalidation trigger. First measure the decoupled cached runner. If a cache miss still creates a main-thread long task or visible input/animation stall, move the unchanged pure request/result boundary into one Web Worker. The worker is a measured execution escalation, never a second engine or a baseline mandate.

Performance evidence records event count, window updates, canonical serialized-result bytes, peak memory, wall time and main-thread long tasks on the largest real trace. Result size is measured at the headless complete-engine step-9 freeze, before proof-surface work. No unmeasured millisecond or memory budget is invented; any observed interaction stall fails EC-12.

### 10.1 Answer cardinality and browsing

The engine does not prune variants. Its maximum published-size count follows from the count-derived field: at most `fieldSpanMM/2 = 204` even longest-side values at the released spec. A window with `k` vertices can have at most `floor(k/2)` connected components containing an edge. For band 3, summing that bound across the centred extents belonging to each parity target gives at most `6,4,4,2` arrangements per population. Cross-population coupling therefore gives at most `6²+4²+4²+2²=72` families at one size. The released absolute bound is:

```text
6 centre methods × 2 bands × 204 even sizes × 72 families = 176,256 families per cutout
```

Band 2 and most band-3 targets have smaller actual extent counts; deduplication reduces this further, but no implementation may depend on that reduction. The headless freeze measures both actual family count and canonical bytes on every real cutout. No count is converted into pruning.

The immutable canonical result remains the ordered family array specified in §2. The runner builds read-only secondary indices keyed by `(band, centreMethod, parityTarget, publishedEvenMM, familyId)` without changing or duplicating answer truth. It exposes filtered ID slices and one-family lookup. The proof UI renders only the current slice and selected family, using list virtualisation; changing a filter or page performs index lookup only. Every family remains addressable and applicable. No cardinality-based truncation, “top N”, implicit ranking or alternative result set is permitted.

## 11. Independent verification

### 11.1 Oracle

The oracle independently:

- constructs the fixed lattices and centred windows from the public request;
- iterates every publishable even longest-side size derived from the 9-count ceiling;
- directly transforms the outline and constructs every adjacent-pair-box union;
- computes the exact polygon difference between each union and the manufactured shape;
- independently measures every complete disc against every edge as the implied-support invariant;
- derives material-supported arrangements by the grammar in §6;
- couples both populations at the same size;
- independently constructs each population's padded grid box and recomputes all four outline-bounding-box overhangs by direct subtraction.

It compares the complete canonical family-ID set, coordinates, classification and pass/fail facts. It does not share production geometry. The event solver separately proves interval boundaries on analytic fixtures because an even-size oracle cannot prove an interval containing no publishable integer.

The oracle carries one model-identity assertion, not a sampled example: whenever a square outline's manufactured bounds equal an arrangement's padded grid box, all four overhangs are exactly zero at every band and population. Any non-zero result falsifies the flap implementation that Dan ruled.

### 11.2 Synthetic attacks

- square/circle: arithmetic controls only, including exact pair-region containment;
- reversed winding and rotated start index: identical bytes;
- transparent image margin: identical outline result;
- concave C and stepped limb: legality enters then leaves;
- L/T/triangle-like solids: material-derived partial populations;
- sliver: vertical or horizontal pair only;
- diagonal-only two points: rejected as a pivoting/non-pair set;
- open concavity (C/crescent): lawful islands and explicit impossibility where applicable;
- donut/multiple rings/self-intersection/degenerate outline: explicit deterministic refusal;
- asymmetric protrusion and bottom limb: extremity/zone/limb reporting;
- boundary tangency: pair-region boundary contact accepted exactly;
- concave notch crossing a region edge while every region vertex is inside: rejected;
- complete 2×2 pair-box ring and its filled outer rectangle: identical on solid outlines;
- disconnected two-pair fixture: records the current two-family result and keeps the product question in §6.4 visible until Dan rules whether their union is one layout;
- twin-fix boundary: 190mm is eligible, 192mm and 194mm are not; changing aspect ratio alone changes no classification;
- ladder: raw IDs are complete and ordered while unresolved policy produces no fabricated ladder IDs;
- spec mutations: padding, base pitch, sparse factor and count rederive every answer;
- unknown centre method: explicit refusal.

### 11.3 Real applied proof

Run all seven saved cutouts through every centre method, operational bands 2/3, both populations and both flap switches. Every family must be selectable and steppable in canonical order. The SVG proof draws the transformed outline, each population's complete pair-box union, full discs, coordinates, padded grid box, four overhang segments, extremities, outside-box zones and binding contacts directly from the immutable answer.

The corpus report groups lawful four-point counts by centre method. It must reproduce the measured load-bearing case: Duck has no four-point family under box or area centre and has five under maximum-clearance on the frozen fixtures. This is evidence for the pending centre policy, not permission to install maximum-clearance as a product default.

An independent browser probe reads the drawn SVG and recomputes coordinates, pair-region containment, implied full-disc containment, grid boxes, overhangs and contacts without calling production geometry. Screenshot plus numeric probe are both required. A table saying `fits` is not evidence.

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
| EC-05 | §§6.2, 7.3–7.4 |
| EC-06 | §§3.3, 7.1–7.4, 7.6 |
| EC-07 | §§2.2, 5.2, 7.4–7.6 |
| EC-08 | §§4, 5.2, 8 |
| EC-09 | §§8.1–8.4 |
| EC-10 | §8.4 |
| EC-11 | §11.3 |
| EC-11b | §§7.7–7.8, 10–11 |
| EC-12 | §§9–11 |

Build in this order, with no build-ahead across a failed gate. The first milestone is deliberately headless and is the minimum viable algorithm/engine Dan required: formula first, algorithm second, test third, verified portable answer fourth. It does not wait for a screen.

1. public types, canonical outline and deterministic serialisation;
2. independent oracle skeleton and analytic fixtures;
3. centre constructions and fixed lattice/parity tests;
4. pair-box construction and exact containment intervals, including concave edge-crossing attacks;
5. active-edge arrangement derivation and non-monotonic component-sweep attacks;
6. 48/96 same-size coupling;
7. region binding contacts, implied disc clearances, per-population grid boxes, overhangs, extremities and zones;
8. freeze and independently verify the headless containment kernel and its raw interval evidence; do not call it the complete engine while the two product questions remain open;
9. after Dan resolves disconnected multi-pair membership and the ladder separation policy, add their exact deterministic rules, complete raw answer assembly and byte-determinism attacks — **freeze the headless minimum viable engine here**;
10. runner cache/cancellation and zero-interaction-call proof;
11. only after the headless engine gate passes, add the applied proof surface and independent SVG probe;
12. seven-cutout, synthetic, performance and visual gates;
13. Builder, QA and Meta each complete EC-01..EC-12 and EC-11b on one frozen snapshot.

## 13. Research disposition

| Prior element | Disposition |
|---|---|
| analytic disc-contact events | reject; pair-box containment now discovers arrangements and solves size |
| event intervals and disjoint lawful pieces | retain as proven method; apply to pair-region containment |
| even-size interval intersection | retain; enumerate every even size, not first fit |
| six centre comparison | retain as test options; define exact algorithms here |
| square-only `centredBand` | reject |
| first-lawful size loop | reject |
| 48-only `BandFit` answer | reject |
| grid pan to a chosen centre | reject; lattice is fixed |
| global event partition with full relabelling | reject; incremental affected-window sweep |
| nearest/farthest Voronoi flap models | reject; Dan ruled four grid-box overhang subtractions |
| sampled/unexplained maximum-clearance epsilon | reject; finite segment-Voronoi construction |
| old UI matrix and stale evidence images | reject; final evidence is regenerated |

## Closing gate

Lead QA must attack law/contract fidelity, formulas, completeness boundaries and implementability. Meta must independently answer: could two builders, given only the contract, law book and this blueprint, produce the same canonical result? A `CLEAR` requires both:

- **Necessity:** no element can be removed without losing a required answer or proof.
- **Sufficiency:** every required size, layout, coordinate, support fact, side measurement and applied proof is computable without an unstated choice.
