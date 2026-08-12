# Magnetic-Grid Review Engine — Prototype Contract

**Contract version:** 0.3-grid-pixel-review

**Reference engine:** `magfit-core/0.3.0-grid-pixel-review`

**Scope:** enumerate exact lawful size/layout options for manual review
**Not a release claim:** this prototype does not select a product or guarantee physical tolerance

## 1. Deliverable

For each requested band, the engine MUST return every distinct lawful option produced by the declared finite model:

1. one already-traced simple solid polygon;
2. locked aspect ratio and orientation;
3. axis-aligned bbox centre fixed at the lattice origin;
4. the band's finite 12 mm manufactured-size candidates;
5. the band's finite centred lattice windows;
6. every connected supported subset meeting the node floor and band span;
7. every compatible sparse phase under the declared sparse policy;
8. exact support, link, contact, size and flap evidence per option.

The engine MUST NOT rank options, mark a winner, hide a lawful subset, or stop at the first passing size. Topology names are descriptions only. A later one-result-per-band rule may be introduced only after applied review proves it returns the physically correct answer.

The UI MUST compute the fixed cut-out once, retain the returned option set, and browse it without rerunning geometry on pan, zoom, option navigation, or other interaction.

## 2. Boundary

The prototype owns:

- polygon canonicalisation and validation;
- exact uniform scaling;
- lattice-window generation;
- full-disc and direct-link support;
- connected-subset enumeration and deduplication;
- sparse-phase evidence;
- exact manufactured dimensions;
- limiting-contact and flap evidence;
- deterministic review order.

It does not own:

- raster segmentation or tracing;
- SVG flattening, fill resolution, or Boolean repair;
- rotation, mirroring, or translation search;
- automatic product selection;
- final cutter-path quantisation;
- physical tolerance calibration;
- UI rendering, pricing, or fulfilment.

Any later geometry change to the manufactured contour requires a new review.

## 3. Guarded values

```text
dense lattice pitch             48 mm
half-pitch coordinate unit       24 mm
sparse lattice pitch             96 mm, obtained by thinning the dense lattice
magnet footprint                 closed disc, radius 12 mm
direct link                      radius-12 capsule around a 48 mm centre segment
boundary tangency                lawful
manufactured size step           12 mm
maximum lattice positions/axis   9
orientation                      fixed
scale                            uniform only
shape topology                   one simple closed solid polygon, no holes
```

The default band span is:

```text
span(b) = 24 + 48*(b-1) mm
```

Default candidate sizes are:

```text
S(b) = {span(b), span(b)+12, span(b)+24, span(b)+36}

band 2: 72, 84, 96, 108 mm
band 3: 120, 132, 144, 156 mm
band 4: 168, 180, 192, 204 mm
```

The manufactured scalar size is the polygon's maximum axis-aligned bbox dimension. The other dimension follows from the locked aspect ratio and is never independently rounded.

## 4. Input and canonical transform

Input is one integer-coordinate contour. A repeated closing vertex is optional. The engine MUST reject:

- fewer than three distinct vertices;
- non-adjacent repeated vertices;
- zero area;
- self-intersection or self-touching;
- overlapping adjacent edges or collinear backtracking;
- a bbox span beyond the configured exact-arithmetic bound.

It MUST NOT silently repair invalid input.

For canonical polygon `P`:

```text
widthSpan  = maxX-minX
heightSpan = maxY-minY
D          = max(widthSpan,heightSpan)
centre2    = (minX+maxX, minY+maxY)
```

At manufactured size `s`, source point `(x,y)` maps to:

```text
X = s*(2x-centre2.x)/(2D)
Y = s*(2y-centre2.y)/(2D)
```

No transformed vertex is rounded for a fit decision. Exact dimensions are:

```text
widthMm  = s*widthSpan/D
heightMm = s*heightSpan/D
```

Canonicalisation removes consecutive duplicates and in-between collinear vertices, normalises counter-clockwise winding, then rotates to the lexicographically smallest vertex. Equivalent translation, uniform source scaling, reversed winding, changed starting vertex, and optional closing duplicate MUST produce the same ordered option set.

## 5. Lattice windows and band identity

Coordinates use 24 mm units. A centred run of `n` dense positions is:

```text
R(n) = {-(n-1), -(n-3), ..., n-3, n-1}
```

For band `b`, enumerate every rectangular parent window `(runsX,runsY)` where:

```text
1 <= runsX <= b
1 <= runsY <= b
max(runsX,runsY) = b
```

Each option inherits the parent registration. Removing unsupported nodes MUST NOT recenter the lattice.

An option spans band `b` when:

```text
max(maxX24-minX24, maxY24-minY24) = 2*(b-1)
```

This prevents the same small arrangement from being relabelled as a larger band.

## 6. Exact support predicates

### 6.1 Magnet disc

A centre `q` is supported only when its complete closed radius-12 disc lies in the polygon. For a closed simple polygon this is:

1. `q` is inside or on the polygon; and
2. the minimum squared distance from `q` to every boundary segment is at least `12^2`.

For edge `[a,b]`, `v=b-a`, `w=q-a`, `L=v dot v`, `h=w dot v`:

```text
h <= 0    distance^2 = |w|^2
h >= L    distance^2 = |q-b|^2
otherwise distance^2 = (v cross w)^2/L
```

All comparisons are cross-multiplied integers. Equality passes. No epsilon is permitted.

### 6.2 Direct link

Two supported orthogonal 48 mm neighbours are linked only when the complete radius-12 capsule around their centre segment lies inside the polygon:

```text
[q1,q2] + closedDisc(0,12) subset of P
```

The reference checks segment location plus exact minimum segment-to-boundary distance. This proves one direct 24 mm-wide fabric connection. It does not claim that every possible curved corridor has been recognised.

## 7. Every lawful connected subset

At each legal size and parent window:

1. compute support for every node;
2. compute verified links for supported 48 mm neighbours;
3. enumerate every node subset;
4. reject subsets below the band's node floor;
5. reject a subset unless every selected node is supported;
6. reject it unless the selected graph is connected by verified links;
7. reject it unless it spans the band;
8. apply sparse policy;
9. emit the option with evidence.

Band 3 has at most nine parent nodes, hence at most `2^9=512` raw subsets per window. Band 4 is exercised by the prototype but its `2^16` raw subsets make it a review/benchmark case, not evidence of a production performance target.

Identical physical options found through overlapping parent windows MUST appear once. Identity is:

```text
band + size + sorted magnets + sorted verified links + sparse evidence
```

Every contributing parent window remains in `source_windows` as provenance.

Topology labels are evidence, never precedence:

- `Full`: a complete square lattice block;
- `Pair`: two nodes and one verified link;
- `LinkedThree`: three nodes connected by verified links;
- `Connected`: any other lawful connected subset.

No label selects or suppresses another option.

## 8. Sparse 96 mm evidence

Sparse nodes are residue-class thinnings of the same dense lattice. The polygon transform and physical layout do not move.

The calibrated prototype default is:

```text
mode                         ANY
engage from band             3
minimum active nodes         2
require 96 mm connectivity   true
```

Band 2 has no sparse engagement because a 96 mm pair plus two 12 mm radii needs 120 mm projected extent.

Modes:

- `DISABLED`: no sparse evidence;
- `FIXED`: the configured phase must pass and is reported;
- `ANY`: the physical option passes when at least one phase passes; every passing phase is reported on that option;
- `ALL`: every possible phase must pass; all are reported in canonical order.

A single sparse node never satisfies the default. Active sparse nodes must form the declared 96 mm-connected set using the same direct-capsule predicate.

## 9. Per-option evidence

Every emitted option contains:

- band and manufactured size;
- exact and display dimensions;
- contributing source windows;
- sorted magnet coordinates;
- sorted verified links;
- all passing/required sparse phases;
- one deterministic most-limiting disc or link contact;
- bbox overhang and coverage evidence for 12 mm and 24 mm;
- sampled tongue and narrow-limb diagnostics.

Contact ties resolve by contact kind, grid coordinates, then canonical boundary-edge index. Floating clearances are display-only; discrete identity and integer micrometre fields drive comparison and serialization.

## 10. Flap evidence and its limit

The padded grid box is the selected magnet bbox enlarged by 12 mm on every side. Per-side shape overhang beyond that box is clamped to zero:

```text
left   = max(0, paddedMinX-shapeMinX)
right  = max(0, shapeMaxX-paddedMaxX)
bottom = max(0, paddedMinY-shapeMinY)
top    = max(0, shapeMaxY-paddedMaxY)
```

Coverage at 12 or 24 passes only when all four overhangs are within that selected limit. Passing 24 does not imply that 12 passed.

The prototype additionally tests exact outward tongue capsules at outer magnet nodes and gap midpoints. These fields are named `sampled_tongue_*` because they do not prove continuous support across a whole side. A cove between witness positions can remain invisible. This is a known sufficiency gap, not a hidden guarantee.

`narrow_limb_exception_h` is reported when the bbox extent reaches `h` and no sampled full-width tongue passes. Equality at exactly 12 or 24 is included.

A production continuous-side or material-region measure remains required before sampled tongue evidence can be used as a complete flap/limb decision.

## 11. Deterministic order and no selector

Options are ordered only for stable browsing and serialization:

1. legal size ascending;
2. sorted magnet coordinates;
3. sorted verified links;
4. sparse phase evidence;
5. source-window provenance.

This is not a quality order. The engine exposes no winner, optimum, default option, or fallback. Manual review is the current product decision.

## 12. C++ and C/Wasm interfaces

C++:

```cpp
CanonicalPolygon canonicalize_and_validate(...);
BandSpec default_band_spec(int band, ...);
SolveResult solve_canonical(...);
SolveResult solve(...);
```

`solve_canonical` avoids retracing validation when a caller already owns a validated contour. A complete multi-band review should be computed once and cached by the flow layer.

C/Wasm:

```text
magfit_review_band_i32
magfit_review_bands_i32
```

Both stream options through a caller callback. This prevents an ABI array cap from silently truncating a lawful review set. A callback that refuses an option makes the call fail rather than report a partial successful result.

The C boundary MUST initialise counts on entry, reject invalid pointers/counts before indexing, and never allow C++ exceptions to escape.

A persistent prepared-shape handle, engine/policy hashes, exact cutter transform, and final manufactured contour are not in this prototype. Therefore this interface is review-capable but not yet a self-contained fulfilment API.

## 13. Acceptance suite

Required fixtures:

- 72 mm square exposes the full square and lawful pair subsets;
- every passing legal size remains present;
- a maximal cross does not hide its run and L subsets;
- overlapping parent windows deduplicate physical options and retain provenance;
- exact disc tangency passes;
- a missing direct capsule removes that link without deleting another connected option;
- band 2 contains no sparse phase;
- band 3 reports every passing phase under `ANY`;
- `ALL` rejects when any required phase fails;
- exact-threshold narrow limb evidence is reported;
- 18 mm overhang fails coverage 12 and passes coverage 24;
- band 4 full-square fixture is exercised;
- C ABI streams every option from single- and multi-band calls;
- translation, source scale, winding and start-index invariance;
- invalid input and C ABI errors fail loudly.

Release gaps that remain explicit:

- hidden-cove fixture proving the sampled-side limitation;
- persistent prepared C/Wasm lifecycle;
- self-contained fulfilment transform/provenance;
- Wasm round trip;
- sanitizers and cross-compiler matrix;
- real cut-out library applied review;
- target-device time and memory.

## 14. Measured prototype performance

Apple Clang Release, 1,000-vertex polygon, bands 2 and 3, 135 returned options:

```text
already-canonical enumeration     122.14 ms mean
validation plus enumeration       113.61 ms mean
8,100-point canonicalisation        1.37 ms, 5,872 retained vertices
```

The review workload is larger than the former winner-only solve because evidence is built for every option. These figures do not meet a one-frame interaction target and are not phone/Wasm certification.

The correct runtime shape is: compute after the cut-out changes, cache the complete answer, and perform zero geometry during review interaction.

Optimisation must preserve the exact option set. If required, proceed in this order:

1. cache scaled edges per size;
2. cache node/link/tongue queries across windows and subsets;
3. build evidence once per physical option primitive;
4. add exact broad-phase edge indexing;
5. benchmark 1,000 and 8,100-point real traces on target devices.

## 15. Prohibited implementation patterns

- stretching or independently rounding the cut-out dimensions;
- moving/recentring the lattice after nodes disappear;
- float epsilon for legal decisions;
- approximate circle buffers as exact support law;
- maximal-component-only extraction;
- first-fit or first-size return;
- ranking/topology labels that suppress variants;
- arbitrary UI filtering presented as engine truth;
- independent dense and sparse transforms;
- recomputation during pan, zoom, option navigation, or other interaction;
- silent contour repair;
- claiming sampled tongue evidence is continuous side proof;
- claiming nominal 12 mm CAD clearance is a calibrated production tolerance.

## 16. Prototype status

The package is an executable review prototype. Its exact geometry, finite-size evaluation, connected-subset enumeration, sparse evidence, C ABI streaming, and deterministic option order are testable now.

It is not yet the final production engine. Production requires applied manual review plus closure of the declared continuous-flap, prepared-runtime, fulfilment-output, and target-performance gaps. No selector is to be implemented until that evidence exists.
