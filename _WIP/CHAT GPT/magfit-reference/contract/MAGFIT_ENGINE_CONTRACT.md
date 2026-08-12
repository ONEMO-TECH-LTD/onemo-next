# Magnetic-Grid Fitting Engine — Normative Build Contract

**Contract version:** 1.0-draft  
**Reference engine:** `magfit-core/0.1.0`  
**Scope:** cut-out shape normalisation, manufactured size selection, magnetic layout selection, sparse-grid compatibility, contact explanation, and flap reporting  
**Normative language:** MUST, MUST NOT, SHOULD, and MAY have their ordinary requirements meaning

---

## 1. Executive decision

Build a small exact finite solver. Do not build a CAD application, a generic nesting engine, a continuous optimiser, a raster tracer, or a polygon-offset platform inside this module.

For every requested band, the engine MUST:

1. receive one already-traced simple solid polygon;
2. canonicalise and validate it;
3. centre its axis-aligned bounding box on the lattice origin;
4. preserve aspect ratio and orientation;
5. test the band’s finite legal manufactured sizes in ascending order;
6. at each size, test only the finite parity-correct lattice templates for that band;
7. regard a magnet as supported only when its entire radius-12 mm disc lies in the cut-out;
8. regard adjacent magnets as linked only when the entire radius-12 mm capsule around their centre segment lies in the cut-out;
9. form connected supported layouts from those verified links;
10. require the layout to span the requested band;
11. apply the declared 96 mm thinning-phase policy;
12. stop at the first legal size with at least one valid layout;
13. choose exactly one layout at that size by a total deterministic order;
14. return one result or `NO_FIT` for that band.

The unknown is the polygon. The hardware, band sizes, legal steps, lattice registration, magnet footprint, and ranking policy are constants or versioned product policy. No heuristic search is necessary.

---

## 2. Research verdict: reuse geometry primitives, not somebody else’s product

### 2.1 No turnkey engine was found

The researched open-source and commercial offerings provide pieces of the geometry problem, but none provides the product computation described here: band-constrained uniform scaling, parity-centred lattice templates, full-disc support, verified fabric links, 48/96 thinning phases, one size per band, and product-specific ranking.

The result should therefore be a custom product solver of roughly this reference implementation’s size, optionally using a third-party polygon library only at the trace-ingestion boundary.

### 2.2 Dependency decision

| Candidate | What it supplies | Decision |
|---|---|---|
| **Clipper2** | Integer-backed polygon clipping, union, offsetting, point-in-polygon, C++/C#/Delphi and exported C functions; permissive Boost licence | **Optional upstream utility.** Suitable for flattening/unioning incoming SVG paths or implementing a separate trace-cleaning service. Do not use its round offsets as the legal magnet test because circular arcs are approximated by line segments. |
| **CGAL 2D Minkowski Sums** | Exact or guaranteed polygon/disc offsets and insets | **Reference/consultancy option, not default runtime.** Mathematically strong but much larger than the finite query problem; the relevant package is GPL unless commercially licensed. |
| **GeometryFactory** | Commercial CGAL licensing, consulting, customer-specific geometry development | **Credible external specialist** if independent formal review or supported exact-offset work is desired. It would still build custom band policy. |
| **GEOS/JTS** | Broad polygon predicates, distances, buffers, prepared geometry, spatial indexes | **Prototype/reference only.** General GIS geometry is heavier than required; double and polygonal buffer paths are unnecessary for the exact finite decisions. |
| **libnest2d / SVGNest / Deepnest / no-fit-polygon libraries** | Irregular bin packing and part placement | **Reject for this module.** They optimise many movable parts in a bin. Here the lattice is fixed, the shape is centred, scale candidates are finite, and there is no packing objective. |
| **3D CAD kernels / mesh SDKs** | General modelling, constraints, mesh repair, booleans | **Reject.** Wrong dimensionality and several orders of magnitude more machinery than the problem requires. |

### 2.3 Recommended source strategy

The hot fitting core SHOULD have no third-party geometry dependency. This makes the legal pass/fail predicates reviewable, keeps the WebAssembly payload small, and prevents an upstream library’s tolerance or approximation setting from becoming hidden product law.

Clipper2 MAY be used in a separate adapter before this engine when raw customer SVG paths must be unioned, self-intersections must be resolved under a declared fill rule, or multiple contours must be collapsed. The fitting core itself MUST still receive one valid simple polygon and MUST reject, rather than silently repair, invalid input.

CGAL MAY be used in an offline oracle test suite to compare erosion/component topology on difficult fixtures. It is not required to answer the finite magnet queries.

---

## 3. Product law fixed by this contract

### 3.1 Hardware constants

```text
dense lattice pitch             48 mm
half-pitch coordinate unit       24 mm
sparse lattice pitch             96 mm (phase thinning of dense lattice)
required magnet footprint        closed disc, radius 12 mm
boundary tangency                passes nominal law
manufactured size step           12 mm
maximum lattice positions/axis   9
orientation                      fixed; no rotation or mirroring
scale                            uniform only
shape topology                   one simple closed solid polygon, no holes
```

### 3.2 Band span and legal sizes

The standard span of band `b` is:

```text
span(b) = 24 + 48·(b − 1) millimetres
```

The legal manufactured sizes for band `b` are:

```text
S(b) = { span(b), span(b)+12, span(b)+24, span(b)+36 }
```

Equivalently, they occupy `[span(b), span(b+1))` on a 12 mm step.

Therefore:

```text
band 1 (internal)  24, 36, 48, 60 mm
band 2             72, 84, 96, 108 mm
band 3             120, 132, 144, 156 mm
```

The scalar manufactured size is the scaled polygon’s **maximum axis-aligned bounding-box dimension**. The other dimension is aspect-derived and MAY be fractional. It is returned as an exact rational.

### 3.3 Important clarification about “between band 1 and band 2”

A horizontal or vertical pair has centres 48 mm apart. Adding a 12 mm radius at both ends gives a padded footprint of exactly:

```text
72 × 24 mm
```

Consequently, when manufactured size means maximum bbox dimension, an adjacent pair cannot fit below 72 mm. If “band 2” were instead defined as `(24,72]`, the only band-2 value capable of supporting a pair would be 72 mm itself. This contract retains the original non-overlapping band intervals: band 1 ends below 72; band 2 begins at 72.

### 3.4 One result per band

For a requested band, the engine returns exactly one of:

```text
FIT(size, layout, witnesses, metrics)
NO_FIT(reason)
```

It MUST NOT return a menu of sizes. It MAY expose diagnostic records in test builds, but the production result is singular.

### 3.5 Size-first selection

The latest product clarification is interpreted as “scale to the first grid-led size at which the shape wraps the required support.” Therefore the normative selection order is:

1. legal manufactured size ascending;
2. best valid layout at that size.

A pair at 72 mm therefore beats a four-magnet square that first appears at 84 mm. Within the same size, more supported magnets and links are preferred.

Changing this to “full square at any size beats a pair at a smaller size” is a product-policy change and MUST increment the policy/engine version.

### 3.6 User-facing and internal minimums

```text
band 1 internal minimum       one supported disc
band 2+ production minimum    two supported adjacent nodes joined by a verified link
```

Band 2 can yield:

- a two-node horizontal or vertical pair;
- a three-node L, meaning two verified pairs sharing one node;
- a four-node square.

A diagonal pair without a horizontal/vertical 48 mm link is invalid.

---

## 4. Module boundary

### 4.1 The fitting engine owns

- polygon canonicalisation after tracing;
- simple-polygon validation;
- exact scale transforms;
- lattice/template generation;
- disc and link containment;
- connected layout extraction;
- band and sparse-phase policy;
- deterministic ranking;
- exact manufactured dimensions;
- contact and flap reporting.

### 4.2 The fitting engine does not own

- raster segmentation;
- background removal;
- SVG parsing;
- Bézier flattening;
- fill-rule resolution;
- unioning multiple source paths;
- artistic simplification;
- cut-path kerf compensation;
- physical tolerance calibration;
- UI rendering or pricing.

These operations MUST occur before or after the core through explicit adapters. They MUST NOT be smuggled into the solver as tolerances or “helpful” geometry repairs.

### 4.3 Required input

Conceptual input:

```json
{
  "enginePolicyVersion": "magfit-policy/1.0",
  "polygon": {
    "units": "canonical_integer_trace_units",
    "vertices": [[0,0], [7200,0], [7200,2400], [0,2400]]
  },
  "bands": [2, 3],
  "sparsePolicy": {
    "mode": "ANY",
    "minimumActiveNodes": 1,
    "require96mmConnected": false
  }
}
```

Input rules:

- one contour only;
- at least three distinct vertices;
- last repeated closing vertex optional;
- integer coordinates;
- no holes;
- no self-intersection or self-touching;
- no overlapping adjacent edges;
- maximum bbox span at most 65,536 trace units;
- upstream SHOULD translate the contour near the origin, although translation does not change the result;
- upstream MUST preserve the exact polygon sent to manufacturing, or the fit MUST be rerun after any later geometry change.

### 4.4 Required output

Conceptual output for each band:

```json
{
  "engineVersion": "magfit-core/0.1.0",
  "band": 2,
  "fit": true,
  "manufactured": {
    "nominalSizeMm": 72,
    "widthMm": {"numerator": 5184, "denominator": 72},
    "heightMm": {"numerator": 1728, "denominator": 72}
  },
  "registration": {
    "anchor": "AXIS_ALIGNED_BBOX_CENTER",
    "templateRuns": [2,1]
  },
  "magnets": [
    {"x24": -1, "y24": 0, "xMm": -24, "yMm": 0},
    {"x24": 1, "y24": 0, "xMm": 24, "yMm": 0}
  ],
  "links": [
    {"a": [-1,0], "b": [1,0], "widthMm": 24}
  ],
  "sparsePhase": {
    "xResidueMod4": 1,
    "yResidueMod4": 0,
    "activeNodes": [[-1,0]]
  },
  "binding": {
    "kind": "MAGNET_DISC",
    "nodeA": [-1,0],
    "polygonEdgeIndex": 0,
    "clearanceUmFloor": 12000,
    "slackUmFloor": 0
  },
  "flap": {
    "exactDenominator": 144,
    "leftNumerator": 0,
    "rightNumerator": 0,
    "bottomNumerator": 0,
    "topNumerator": 0,
    "switch12": [false,false,false,false],
    "switch24": [false,false,false,false]
  }
}
```

The JSON adapter is illustrative; the reference source exposes C++ structures and a fixed-layout C ABI.

---

## 5. Canonical geometry and transform

Let the canonical polygon be `P` with bbox:

```text
[minX,maxX] × [minY,maxY]
```

Define:

```text
widthSpan  = maxX − minX
heightSpan = maxY − minY
D          = max(widthSpan,heightSpan)
centre2    = (minX+maxX, minY+maxY)
```

`centre2` stores twice the bbox centre and avoids halves.

At manufactured size `s`, a source vertex `(x,y)` is mapped to millimetres by:

```text
X = s·(2x − centre2.x) / (2D)
Y = s·(2y − centre2.y) / (2D)
```

The reference implementation stores every transformed vertex numerator and the common denominator `2D`. It does not round transformed vertices before fit decisions.

Exact manufactured dimensions are:

```text
widthMm  = s·widthSpan / D
heightMm = s·heightSpan / D
```

### 5.1 Why bbox centre is fixed in v1

A fixed bbox centre is:

- deterministic;
- scale-equivariant;
- cheap;
- independent of triangulation or raster sampling;
- stable under translation, winding reversal, and vertex-start changes;
- easy to explain visually.

The engine MUST NOT continuously slide the grid inside the artwork in v1. Such an optimiser can place all magnets in one butterfly wing, can jump between disconnected feasible regions, and makes “centred” a hidden objective rather than a law.

A bounded integer-mm translation search MAY be introduced later as a versioned policy, but it is not part of this contract.

---

## 6. Lattice and parity templates

All lattice coordinates use 24 mm units.

A centred run of `n` positions is:

```text
R(n) = { −(n−1), −(n−3), …, n−3, n−1 }
```

Examples:

```text
R(1) = {0}             -> magnet-centred
R(2) = {-1,+1}         -> {-24,+24} mm, gap-centred
R(3) = {-2,0,+2}       -> {-48,0,+48} mm, magnet-centred
```

This encodes parity registration directly. The engine MUST NOT recalculate registration after unsupported nodes are removed.

For band `b`, generate all rectangular parent templates `(runsX,runsY)` such that:

```text
1 ≤ runsX ≤ b
1 ≤ runsY ≤ b
max(runsX,runsY) = b
```

Band 2 parents are:

```text
2×2, 2×1, 1×2
```

Band 3 parents are:

```text
3×3, 3×2, 2×3, 3×1, 1×3
```

A final layout may be a connected supported subset of a parent, but it inherits the parent’s registration. It MUST span the band:

```text
max(maxX24−minX24, maxY24−minY24) = 2·(b−1)
```

This prevents an ordinary band-2 pair from being mislabeled as band 3 simply because the cut-out was made larger.

---

## 7. Exact magnet-disc predicate

For magnet centre `q`, radius `r=12 mm`, the legal requirement is:

```text
closedDisc(q,r) ⊆ scaledPolygon
```

For a closed simple polygon this is equivalent to:

1. `q` is inside or on the polygon; and
2. the minimum Euclidean distance from `q` to every polygon boundary segment is at least `r`.

For edge `[a,b]`, with `v=b−a`, `w=q−a`, `L=v·v`, and `h=w·v`:

```text
if h ≤ 0:    distance² = |w|²
if h ≥ L:    distance² = |q−b|²
otherwise:   distance² = (v×w)² / L
```

The comparison against `r²` MUST be performed after cross-multiplication, without square roots and without floating tolerance.

Boundary tangency passes because the predicate is `distance² ≥ r²`.

---

## 8. Exact linked-pair predicate

Grid adjacency alone is not enough. Two supported discs can sit in separate lobes of a concave polygon or across a notch.

For adjacent 48 mm nodes `q1,q2`, the fabric link is valid only when the complete capsule is inside:

```text
[q1,q2] ⊕ closedDisc(0,12) ⊆ scaledPolygon
```

Equivalently:

1. both segment endpoints are in the polygon;
2. the centre segment does not leave the polygon; and
3. the minimum distance from the centre segment to every polygon boundary segment is at least 12 mm.

The reference checks exact segment-to-segment distance. If two segments intersect, distance is zero. Otherwise the minimum is the least of the four endpoint-to-opposite-segment distances.

This predicate gives the intended interpretation of an L-shaped layout:

```text
three supported nodes
+ two 48 mm adjacencies
+ two complete 24 mm-wide fabric corridors
= two linked pairs sharing one node
```

A narrow visual limb that touches two discs but does not provide the complete capsule does not create a link.

---

## 9. Layout graph and candidate extraction

For each parent template and legal size:

1. create one graph vertex per template node;
2. mark a vertex supported when its disc predicate passes;
3. consider only horizontal/vertical 48 mm neighbours;
4. add an edge only when its link-capsule predicate passes;
5. compute connected components over supported vertices and verified edges;
6. reject components below the band minimum-node count;
7. reject components that do not span the band;
8. apply sparse policy;
9. rank surviving components.

This is not an open-ended graph search. Bands 2 and 3 contain at most four and nine parent nodes respectively. The full 9×9 field contains 81 nodes and 144 possible dense orthogonal links.

### 9.1 Candidate ranking at one size

Use this total order:

1. magnet count descending;
2. verified-link count descending;
3. complete square parent/component preferred;
4. selected sparse active-node count descending;
5. squared component centroid bias from origin ascending;
6. parent-template area ascending, to prefer the smallest parent that explains an identical component;
7. `runsX` descending;
8. `runsY` descending;
9. sorted node list lexicographically ascending.

This order MUST be encoded once and covered by tie fixtures. Object-map iteration order, pointer order, hash order, or platform-specific sort stability MUST NOT influence a result.

---

## 10. Sparse 96 mm compatibility

The 96 mm garment lattice is a phase thinning of the same dense lattice. A sparse phase retains one residue class modulo 4 on each 24 mm coordinate axis.

For phase `(rx,ry)`, a physical layout node `(x24,y24)` is active when:

```text
x24 mod 4 = rx
and
y24 mod 4 = ry
```

There are two valid residue choices per axis within a dense parity class, hence four 2D phase combinations.

The same polygon scale, anchor, orientation, and physical magnet layout MUST be used for dense and sparse evaluation. No independent recentring is allowed.

### 10.1 Normative default

The reference default is:

```text
phase mode                    ANY
minimum sparse active nodes   1
require 96 mm connectivity    false
```

This means the engine selects and reports the best compatible sparse thinning phase. It makes band 2 possible because a 2×1 or 2×2 dense layout exposes at least one active node on a suitable sparse phase.

### 10.2 Production modes

- `FIXED`: use when a garment/SKU has a known phase. This is the strongest real-world production mode.
- `ANY`: use when manufacturing or placement may select the compatible phase and record it with the SKU.
- `ALL`: require every phase combination to satisfy the active-node rule. This is often too strict for narrow layouts.
- `DISABLED`: diagnostic only when dual-density compatibility is not part of that product.

If a sparse garment must independently engage an adjacent 96 mm pair, band 2 is mathematically impossible: two 96 mm-separated centres plus two 12 mm radii require at least 120 mm projected extent. That policy begins at band 3 or requires a different hardware rule.

---

## 11. One size per band algorithm

```text
solveBand(P, band, policy):
    validate policy and exact bounds
    canonicalise P once

    for size in legalSizes(band), ascending:
        scaled = exactUniformScaleAboutBboxCentre(P, size)
        candidates = []

        for parentTemplate in templates(band):
            supported[node] = exactDiscInside(scaled, node, radius=12)
            linked[a,b] = supported[a] && supported[b]
                          && adjacent48(a,b)
                          && exactCapsuleInside(scaled, a, b, radius=12)

            for component in connectedComponents(supported, linked):
                if nodeCount(component) < minimum: continue
                if !spansBand(component, band): continue
                sparse = evaluateSparse(component, policy)
                if !sparse.pass: continue
                candidates.add(component + witnesses + sparse)

        if candidates is not empty:
            chosen = maximum(candidates, totalCandidateOrder)
            return buildExactResult(size, chosen)

    return NO_FIT
```

The solver MUST evaluate legal sizes directly. It MUST NOT:

- derive a floating “critical scale” and round it;
- binary-search scale;
- assume that passing at one scale implies passing at every larger scale;
- publish an untested rounded size.

Concave shapes can produce non-monotone support as the scale changes about a centre outside the polygon kernel. Exhaustive evaluation of four legal sizes per band is cheaper and correct.

---

## 12. Binding contact

For every selected magnet disc and verified link capsule, compare its minimum boundary clearance. The limiting contact is the exact minimum, with ties resolved by:

1. magnet-disc before link-capsule;
2. first grid node lexicographically;
3. optional second node lexicographically;
4. canonical polygon edge index ascending.

Return:

- contact kind;
- node or link identity;
- canonical boundary edge index;
- explanatory clearance in millimetres;
- exact deterministic `clearanceUmFloor`;
- exact deterministic `slackUmFloor = clearanceUmFloor − 12000`.

The floating millimetre value MAY be used for display. Cache keys, equality tests, and cross-device snapshots MUST use the integer micrometre fields and discrete witness identity.

At a stepped size the limiting contact may have positive slack. The term “binding” should be read as “most limiting selected contact,” not as a claim that exact tangency occurred.

---

## 13. Flap reporting

Let the padded magnet bbox be the bbox of all selected centres enlarged by 12 mm on every side. Let the scaled shape bbox be centred at the origin.

Raw side flaps are:

```text
left   = paddedMinX − shapeMinX
right  = shapeMaxX − paddedMaxX
bottom = paddedMinY − shapeMinY
top    = shapeMaxY − paddedMaxY
```

The engine returns each value as an exact rational over a common denominator and provides exact switches at 12 and 24 mm.

Evenness is:

```text
horizontal imbalance = |left − right|
vertical imbalance   = |bottom − top|
```

### 13.1 Narrow-limb exception

A bbox flap is an extent measurement, not proof of a useful broad fabric flap. A 1 mm antenna can create a large bbox overhang.

Therefore v1 MUST report a bbox switch as `extent_pass`, not as automatic mechanical approval. A later robust-flap module MAY test a required-width outward capsule. Until the minimum useful flap width and “one outer node versus every outer node” policy are fixed, narrow-limb cases remain reportable exceptions rather than auto-approved flaps.

---

## 14. Canonicalisation and deterministic trace handling

The core MUST perform these operations in this order:

1. remove an optional final closing duplicate;
2. remove consecutive duplicate vertices;
3. reject any other repeated vertex;
4. remove collinear vertices that lie between their neighbours;
5. reject remaining collinear reversal/backtracking, which indicates overlapping adjacent edges;
6. reject any non-adjacent edge intersection or touch;
7. reject zero area;
8. normalise winding to counter-clockwise;
9. rotate vertex order so the lexicographically smallest vertex is first;
10. record the canonical edge indices after this order is fixed.

The engine MUST NOT silently choose a fill rule or repair a bow-tie polygon. Such a repair changes product geometry and belongs in a separate, versioned ingestion step.

### 14.1 Stability under retracing

Exact code gives the same answer for the same canonical polygon. It cannot make materially different traces identical without an explicit trace-normalisation law.

The upstream tracing contract therefore MUST pin:

- tracer name/version;
- raster pre-processing version;
- threshold and fill rule;
- curve flattening tolerance;
- integer quantisation scale and rounding mode;
- simplification rule;
- final contour hash.

The fit MUST run on the final manufactured contour after any cutter-path simplification or snapping.

---

## 15. Physical tolerance and nominal law

The supplied core implements the stated nominal legal radius of exactly 12 mm with inclusive tangency.

A zero-adjustment physical guarantee requires a separate calibrated release radius:

```text
releaseRadius = 12 mm
              + cut error
              + effect magnet-placement error
              + garment lattice error
              + registration error
              + material change allowance
```

The safe implementation pattern is to run the identical exact engine with a versioned effective radius, preferably represented in an integer subunit such as micrometres once tolerances below 1 mm become legitimate product inputs.

Do not hide a physical tolerance in `epsilon` comparisons. Return distinct statuses such as:

```text
NOMINAL_PASS
PRODUCTION_PASS
NOMINAL_ONLY_BORDERLINE
FAIL
```

The current reference is the nominal integer-millimetre core; tolerance calibration remains a manufacturing input rather than a geometry-library choice.

---

## 16. APIs and integration

### 16.1 C++ API

Primary functions:

```cpp
CanonicalPolygon canonicalize_and_validate(...);
BandSpec default_band_spec(int band, ...);
SolveResult solve_canonical(...);
SolveResult solve(...);
```

Use `solve` for a one-off uploaded shape. Use `canonicalize_and_validate` once and `solve_canonical` when the same contour is evaluated repeatedly under several policies.

### 16.2 Stable C ABI

`magfit_solve_band_i32`:

- accepts a flat `int32` vertex array;
- solves exactly one band;
- uses caller-owned fixed-capacity result memory;
- never throws through the ABI;
- returns an error code separately from `fit=false`;
- is suitable for iOS/Android FFI and Emscripten export.

The maximum arrays are fixed by the 9×9 hardware ceiling:

```text
81 nodes
144 orthogonal dense links
```

### 16.3 WebAssembly

Compile the C ABI rather than exposing C++ containers directly. Emscripten exports C functions predictably and eliminates unexported code at optimisation levels.

Representative build shape:

```bash
em++ -O3 -flto -std=c++20 \
  -Iinclude src/magfit.cpp src/magfit_c.cpp \
  -sMODULARIZE=1 -sEXPORT_ES6=1 \
  -sENVIRONMENT=web,worker \
  -sEXPORTED_FUNCTIONS='["_magfit_engine_version","_magfit_default_policy","_magfit_solve_band_i32","_malloc","_free"]' \
  -o magfit.js
```

The production TypeScript adapter SHOULD:

1. normalise trace coordinates to signed 32-bit local coordinates;
2. allocate/copy the flat vertex array into Wasm memory;
3. allocate policy, result, and error buffers;
4. call one exported C function per requested band;
5. copy only the result’s declared counts;
6. convert `x24,y24` to millimetres for rendering;
7. serialise exact rational and integer witness fields;
8. release all allocations in `finally`.

The adapter MUST NOT redo geometry decisions in JavaScript.

---

## 17. Required acceptance suite

A release is not accepted because it “looks right” in a canvas. It must pass fixture and invariant tests.

### 17.1 Core fixtures

| Fixture | Required result |
|---|---|
| 72×72 square, band 2 | size 72; four magnets; four verified links; zero nominal slack |
| 72×24 rectangle, band 2 | size 72; horizontal pair; one verified link |
| rotated-equivalent vertical 24×72 rectangle | size 72; vertical pair |
| 72 mm L shape with 24 mm arms | size 72; three magnets; exactly two links |
| 72×23 aspect rectangle, band 2 | 72 fails; 84 is selected |
| 120×24 rectangle, band 3 | size 120; three-node run; two verified links |
| diagonal-only supported corners | invalid layout; no diagonal link |
| two discs across a concavity without full capsule | discs may pass; link MUST fail |
| exact disc tangency | passes |
| distance smaller than radius by one exact rational unit | fails |
| exact 12 mm bbox flap | 12 switch passes exactly |
| sparse `ANY`, band-2 pair, minimum one | passes and returns one active node |
| sparse `ALL`, band-2 pair, minimum one | fails because some phases have no active node |
| self-intersecting bow tie | invalid input, not repaired |
| adjacent collinear backtracking | invalid input |

### 17.2 Determinism invariants

For the same shape under:

- arbitrary source translation;
- uniform source-coordinate multiplication;
- reversed winding;
- rotated starting vertex;
- optional repeated closing point;

these fields MUST remain identical:

- fit/no-fit;
- manufactured size;
- parent template;
- sorted magnets;
- verified links;
- sparse phase under the same policy;
- binding witness identity;
- exact rational dimensions and flap switches.

### 17.3 Cross-build gate

Run the same golden corpus through:

- Apple Clang native;
- Android NDK Clang native;
- Linux Clang/GCC CI;
- Emscripten WebAssembly.

Discrete and exact-integer fields MUST be byte-identical after canonical serialization. Floating explanatory values are excluded from equality snapshots.

### 17.4 Property/fuzz gate

The release pipeline SHOULD generate valid radial and concave simple polygons, then verify:

- no crash or undefined behaviour;
- selected contacts have non-negative exact nominal slack;
- every selected node independently passes the disc predicate;
- every reported link independently passes the capsule predicate;
- selected component is connected by reported links;
- layout spans its band;
- rerunning produces identical bytes;
- translation/winding/start invariance holds.

Sanitizer builds MUST run with AddressSanitizer and UndefinedBehaviorSanitizer on the corpus.

---

## 18. Performance contract

The complexity for a fixed legal band is bounded by:

```text
legal sizes × parent templates × nodes/links × polygon edges
```

For bands 2 and 3 this is tiny and deterministic. The reference implementation deliberately uses a simple boundary scan rather than an R-tree because 100–1,000 edges and at most nine nodes per band are already inexpensive.

Reference Release benchmark in the supplied container, 1,000 vertices, bands 2 and 3:

```text
canonical polygon already validated   about 3.3 ms/solve
validation plus solve                 about 8.9 ms/solve
```

These are not mobile certification numbers.

Shipping gates:

- benchmark the lowest-supported iOS and Android hardware;
- benchmark the actual WebAssembly bundle in Safari and Chrome;
- report median, p95, and maximum over the production trace corpus;
- no network call or worker round-trip is required for correctness;
- target p95 SHOULD remain within one 16.7 ms frame for the already-canonicalised solve;
- one-time trace validation MAY exceed one frame but SHOULD remain below 50 ms for 1,000 vertices.

If optimisation becomes necessary, apply it in this order:

1. cache canonical polygons;
2. cache scaled edge data per legal size;
3. deduplicate repeated node queries across parent templates;
4. add edge AABB rejection;
5. add a deterministic segment AABB tree.

Do not replace exact predicates with floats to meet a performance target.

---

## 19. Security and failure behaviour

The engine MUST validate all caller-controlled counts and ranges before multiplication or allocation.

The reference exact arithmetic proof assumes:

```text
trace bbox span ≤ 65,536 units
field positions ≤ 9 per axis
legal sizes remain in the declared band interval
```

Custom legal sizes MUST be strictly ascending, on the 12 mm step, and inside the requested band. Invalid policy or geometry returns an input error, not `NO_FIT`.

Distinguish:

```text
INVALID_INPUT    polygon or policy is not legal
NO_FIT           legal input, but no size/layout passes
INTERNAL_ERROR   invariant or capacity failure
FIT              complete result
```

The production boundary MUST not expose C++ exceptions or uninitialised output memory.

---

## 20. Prohibited implementation patterns

The following are contract violations:

- using canvas pixels as geometry truth;
- floating point plus an arbitrary epsilon for legal pass/fail;
- buffering a polygon with an approximated circle and treating the result as exact law;
- moving the grid until “something looks good”;
- deriving layout from unordered surviving-node maps;
- treating grid adjacency as proof of a 24 mm fabric connection;
- accepting diagonal pairs;
- recentering after nodes disappear;
- binary searching scale;
- rounding a continuous answer up without retesting final geometry;
- silently simplifying or repairing the contour;
- letting sparse and dense modes choose different transforms;
- returning several sizes when the contract requires one;
- using a nesting/genetic algorithm;
- introducing a full CAD kernel for bands 2 and 3;
- recomputing geometry differently in UI code.

---

## 21. Reference implementation status

The supplied source currently includes:

- approximately 1,100 lines of exact C++ core;
- a C/Wasm ABI adapter;
- zero third-party runtime geometry dependencies;
- exact 128-bit predicates and fixed 256-bit rational comparison;
- canonical validation;
- band-template generation through 9×9;
- disc and capsule tests;
- dense/sparse policy;
- deterministic ranking;
- exact dimensions, flap switches, and integer contact serialization;
- GCC and Clang builds;
- fixture tests, C ABI tests, and a deterministic 100-shape invariance corpus.

It is a tested reference core, not a substitute for physical tolerance calibration, target-phone benchmarking, upstream tracer locking, or independent production code review.

---

## 22. Product decisions locked for v1

To prevent another implementation from inventing its own problem, v1 is locked as follows:

```text
size measure                 maximum axis-aligned bbox dimension
orientation                  fixed as uploaded
centre                       axis-aligned bbox centre
translation search           none
scale candidates             legal 12 mm values only
selection                    first passing size, then best layout
band identity                selected component must span band
band 2 layouts               pair, linked three-node L, or four-node square
single node                  internal band 1 only for dense product logic
link                         exact radius-12 capsule, not graph adjacency alone
sparse default               ANY phase, at least one active node
sparse/dense transform       identical
flap                         exact bbox extent; narrow-limb exception reported
invalid polygon              reject; never silently repair
result                       one size/layout or no fit per band
```

Any change to this table requires a policy version change, new golden fixtures, and migration rules for previously manufactured products.
