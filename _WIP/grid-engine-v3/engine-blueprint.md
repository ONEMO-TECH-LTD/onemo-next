# Grid Engine Blueprint v3 — Finite Grid Candidates and Exact Disc Support

Status: build specification for [`engine-contract.md`](./engine-contract.md)
Scope: one portable engine that returns every measured cutout-variant family
Authority: the law book, contract and sealed [`engine-mathematics.md`](./engine-mathematics.md)

## 0. Purpose and boundary

The contract defines the answer. This blueprint defines one deterministic way to produce it.
Two builders using only these documents must generate the same candidate scales, support bits,
arrangements, families and canonical bytes.

Dan's requirements define product semantics. The formulae and module boundaries below are
`DERIVED` engineering mechanisms, independently falsified in the sealed mathematics paper.

The engine:

1. canonicalises one fixed-aspect outline and its six centre options once;
2. derives a finite scale set from bands, lattice spans and the locked aspect;
3. asks the exact full-disc support question once per candidate lattice position;
4. enumerates every connected admissible subset of the supported positions;
5. couples base and sparse arrangements at one scale and one registration;
6. publishes the locked-aspect dimensions and measured evidence;
7. returns every family in canonical order for manual review.

It contains no continuous scale solver, contact-event roots, lawful-scale intervals, size scan,
pair-box material-containment predicate, selector, ranking, shape deformation, free lattice pan,
or UI calculation.

Necessity: no parallel or superseded solver remains.
Sufficiency: §§1–11 define every settled computation required by EC-01 through EC-13.

## 1. Architecture

```text
grid-engine/
  contract.ts          request, answer and refusal types only
  canonical-outline.ts validation, integer-mm ring and immutable edges
  centres.ts           six centre constructions and canonical integer identities
  lattice.ts           fixed 48 lattice, 96 thinning, parity, windows and candidate scales
  support.ts           exact full-disc predicate and binding-contact evidence
  arrangements.ts      admissible connected subsets and canonical arrangement IDs
  evidence.ts          clearances, grid boxes, overhangs, extremities and limb candidates
  solve.ts             deterministic composition only
  canonical-output.ts  ordering, fingerprinting and byte-stable serialisation
grid-engine-runner/
  runner.ts            cache, cancellation and off-interaction invocation
grid-engine-oracle/
  oracle.ts            independent implementation sharing public types and fixtures only
```

- Geometry modules read guarded values from the request; no released value is locally defaulted.
- `solve.ts` orchestrates; it does not duplicate predicates.
- The runner never changes an answer.
- UI code requests, indexes and draws answers; it performs no engine mathematics.
- The oracle shares no production predicate, geometry helper or arrangement generator.

## 2. Public contract

### 2.1 Request

```text
SolveRequest {
  outline: PointMM[]
  spec: {
    basePitchMM: 48
    sparseFactor: 2
    paddingMM: 12
    atomMM: 12
    referenceSourceLengthMM: 400
    positionsPerAxis: 9
    bands: [2, 3]
    centreMethods: [box, oriented-box, area, perimeter, vertices, maximum-clearance]
  }
  flapLimitsMM: [12, 24]
}
```

There is no physical size, millimetre cap, target, shape name, rotation, lattice offset,
registration choice, ranking weight, tolerance or selector input. Every numeric field above is a
guarded value, including `atomMM` and `sparseFactor`.

### 2.2 Result

```text
SolveResult {
  requestFingerprint
  outlineFacts
  centres[]
  families: MeasuredCutoutVariantFamily[]
  emptyScopes[]: { band, centreMethod, registration, reason }
  diagnostics: { outlinePointCount, candidateCount, familyCount, solveDurationMS }
}

MeasuredCutoutVariantFamily {
  familyId
  band
  centreMethod
  registration: { x: point | gap, y: point | gap }
  candidateScale: { numerator, denominator }
  manufactured: { longestSideEvenMM, widthMM, heightMM }
  populations: {
    base: PopulationEvidence
    sparse: PopulationEvidence
  }
  centreRelationships[]
  flapOutcomes[]
  classification: floor | intermediate | four-corner
  status: lawful | exception-pending
}

PopulationEvidence {
  pitchMM
  sourceWindows[]
  arrangementId
  magnets[]: { xMM, yMM, clearanceMM, bindingContact }
  gridBoxMM
  overhangMM: { left, right, top, bottom }
  overhangSpreadMM
  quadrantMinClearanceMM: {
    topLeft: number | null
    topRight: number | null
    bottomLeft: number | null
    bottomRight: number | null
  }
  quadrantMarginSpreadMM
  extremities[]
  outsideBoxZones[]
  fixing: { kind: twin-fix | multi-fix, sizeEligible }
}
```

Coordinates are returned in the selected shape frame: origin at the tested centre, `+x` right,
`+y` down. The answer contains every lawful family. It contains no offering ladder, winner,
rank, selected family or hidden presentation filter.

## 3. Canonical outline and centres

### 3.1 Material input

The upstream tracer supplies one solid outer ring and no holes. The engine accepts one simple
closed polygon only. It refuses fewer than three distinct vertices, zero area, self-intersection,
multiple rings or holes. Open C/crescent concavity remains a valid single solid ring.

Canonical intake:

0. scale the traced ring so its longest side equals `referenceSourceLengthMM=400` (`DERIVED`:
   source scale is arbitrary because answers use exact scale ratios; 400 is the sealed corpus
   reference and a guarded internal value, never a product-size input);
1. quantise outline coordinates to the ruled integer-millimetre product floor;
2. remove the repeated closing vertex and consecutive duplicates;
3. remove exactly collinear intermediate vertices without changing the boundary;
4. reject remaining zero-length edges and repeated non-adjacent vertices;
5. orient counter-clockwise by exact signed-area sign;
6. rotate to the lexicographically smallest vertex, breaking ties by the following sequence;
7. build immutable edges with endpoint, vector, squared length and bounding box.

Transparent image margin never enters the outline, scale or answer.

### 3.2 Centre identities

The six methods remain independent visible options; none is a default or winner.

| Method | Definition |
|---|---|
| `box` | axis-aligned outline-bounding-box midpoint |
| `oriented-box` | centre of the minimum-area enclosing rectangle of the convex hull |
| `area` | signed-area polygon centroid |
| `perimeter` | edge-length-weighted mean of edge midpoints |
| `vertices` | arithmetic mean of canonical vertices |
| `maximum-clearance` | integer-mm interior point of greatest exact boundary clearance |

The five analytic constructions compute their ideal point and round half-up per axis. Maximum
clearance is defined directly on integer-mm interior points; ties take smallest `y`, then smallest
`x`. Centre quantisation is consequential and is reported, never described as negligible. All
centres are computed once per canonical outline and cached.

## 4. One lattice and its finite windows

### 4.1 Base lattice and registration

The physical lattice is fixed. In the selected shape frame, one axis is registered:

- `point`: `..., -96, -48, 0, 48, 96, ...`
- `gap`: `..., -120, -72, -24, 24, 72, 120, ...`

Odd runs contain `0` and therefore use point registration. Even runs straddle `0` and use gap
registration. Row and column registration are independent.

### 4.2 Sparse thinning

The sparse population hides points from that same base lattice; it never creates or recentres a
second 96mm lattice.

- odd sparse three-run: `{-96, 0, 96}`;
- even sparse pair, phase 0: `{-72, 24}`;
- even sparse pair, phase 1: `{-24, 72}`.

Both even phases are separate options. In two dimensions, x and y phases form their Cartesian
product. `{-48,48}` is forbidden: neither point belongs to either thinning of the fixed gap lattice.

### 4.3 Band-scoped windows

For band `b in {2,3}`, enumerate every centred rectangular window with
`1 <= rows <= b` and `1 <= columns <= b`, separately for base and sparse populations and every
lawful sparse phase. A band-2 family may never use a three-row or three-column window even when
the same physical scale also has band-3 provenance.

Each window carries its band, rows, columns, population, phase and per-axis registration.

## 5. Finite candidate scales

Let the canonical source bounding box be `(W,H)`, longest side `L=max(W,H)`. For a window whose
padded magnet extents are `(gx,gy)`, choose its binding axis without division:

```text
x binds iff gx*H >= gy*W       // equality deterministically chooses x
```

The grid supplies the candidate manufactured values on that axis. For pitch `p` and operational
band `b`, with `P=paddingMM` and `A=atomMM`:

```text
G(b,p) = (b-1)*p + 2P
D(b,p) = { G(b,p) + k*A | k=0..p/A-1 }
```

Use the union over bands 2 and 3, not a window-local ladder:

```text
48mm: 72..108 step12  union  120..156 step12
96mm: 120..204 step12 union  216..300 step12
```

For each window and each `T` in its population's union, derive a scale:

```text
sigma = T/W when x binds
sigma = T/H when y binds
```

The canonical candidate set is the deduplicated union of those reduced integer fractions across
every band-scoped window and both populations. Preserve the complete band provenance set on each
scale. After forming that union, every band-scoped base and sparse window is evaluated at every
canonical scale belonging to that band; window spans choose only candidate generation's binding
axis and never narrow the final scale set. The count-derived field ceiling remains
`(positionsPerAxis-1)*basePitchMM + 2*paddingMM`; candidates exceeding it on either manufactured
dimension are absent.

This finite set is the whole solve domain. No scale between candidates is searched or published.

## 6. Exact full-disc support

At one candidate scale, a returned lattice coordinate `q` is relative to the selected centre.
Let `M_sigma={sigma*(p-Ck) | p is on the source outline}` and `R=paddingMM`. Evaluate `q` against
that uniformly scaled polygon. This preserves the aspect exactly. A magnet is supported exactly
when `q` is inside or on `M_sigma` and no scaled boundary edge enters the open radius-`R` disc:

```text
supported(q) iff inside(q,M_sigma) and minEdgeDistanceSquared(q,M_sigma) >= R^2
```

Equality is lawful. For edge `v -> w`, endpoint branches compare exact squared distance with
`R^2`. When the perpendicular projection lies in the segment interior, compare:

```text
cross(w-v, q-v)^2 >= R^2 * |w-v|^2
```

Ordinary Number arithmetic may reject or accept only outside a proved forward-error bound.
Inside that uncertainty band the same comparison is completed with BigInt/rational arithmetic.
A distance transform may prefilter only where it is proved identical to this predicate; it never
decides a near-boundary case. The real PILL tangency at scale `12/25`, offset `(-48,0)`, is a
permanent closed-boundary fixture.

Evaluate and cache one support bit per `(outline, centre, reduced scale, population coordinate)`
before arrangement enumeration. Nearest clearance and the lexicographically first binding edge
are computed as evidence from the same supported position, not as a second decision predicate.
Pair boxes have no role in material support.

## 7. Arrangement grammar and family composition

### 7.1 Every admissible subset

For each band-scoped window at one candidate scale, let `S` be its supported positions. Enumerate
every subset `A of S` satisfying all three conditions:

1. `|A| >= 2`;
2. every selected magnet has a selected horizontal or vertical neighbour exactly one population
   pitch away;
3. the induced adjacency graph of `A` is connected.

This returns a pair, L, run, rectangle and every other connected partial independently. It never
collapses them into the maximal surviving component. Isolated magnets and diagonal-only pairs are
excluded by the pair floor.

Connectivity is `DERIVED-AND-REPLACEABLE`: disconnected unions remain the named butterfly
product question. The current answer emits each connected component's admissible subsets
separately and never silently combines them. Dropping the connectivity predicate is the only
grammar change if Dan later rules disconnected pair unions to be one product.

Deduplicate within `(band, centre, population, registration, scale)` by final per-axis
registration plus the coordinate set, not by source window or sparse phase. Retain all source
windows as provenance on the one canonical arrangement.

### 7.2 Classification

- `floor`: exactly two magnets — one pair;
- `four-corner`: exactly four magnets at the corners of their own outermost rectangle;
- `intermediate`: every other lawful occurrence.

The label is descriptive only. It never sorts, selects, discards or gates. A four-corner family
may be absent. Which applied family is optimal is decided manually outside this engine.

### 7.3 Couple populations

For each `(band, centre, reduced scale, registration)`, cross-product every canonical base
arrangement with every canonical sparse arrangement. A family exists only when:

- both arrangements satisfy the pair floor;
- they share the same physical reduced scale, never merely the same ladder value or rounded size;
- their x and y registrations match exactly.

The population windows, phases, extents, coordinates and magnet counts may differ. Coupling two
registrations would place the shape twice against the lattice and is forbidden.

### 7.4 Publication

For scale `sigma`:

```text
longestExact = sigma*L
longestSideEvenMM = smallest even integer >= longestExact
```

The longest side is rounded upward, never nearest or downward. Width and height are derived from
the same `sigma` and locked aspect; the non-longest side is never independently rounded. The
candidate must already be lawful; publication never moves to another scale and never creates a
family outside the candidate set.

### 7.5 Twin-fix

Exactly two magnets is `twin-fix`; three or more is `multi-fix`. Twin-fix size eligibility is:

```text
twinFixBaseSpanMM = (4-1)*basePitchMM + 2*paddingMM
twinFixLimitMM = twinFixBaseSpanMM + max(flapLimitsMM)
sizeEligible = longestSideEvenMM < twinFixLimitMM
```

There is no aspect, elongation or shape-name condition. An ineligible twin fix remains reported.
The limit never constrains multi-fix families.

## 8. Evidence

### 8.1 Centre relationship

For selected centre `Ck`, tested centre `Cl` and arrangement `A` in shape-frame coordinates:

```text
zl = sigma*(Cl-Ck)
mu = mean(q for q in A)
delta = mu-zl
```

Return `zl`, `mu`, `delta` and `|delta|` for every tested centre and both populations. These are
comparison evidence only, never an equality, argmin, selector or pass gate.

### 8.2 Grid box and flap

For each population independently:

```text
gridBox = [min qx-P, max qx+P] x [min qy-P, max qy+P]
left   = max(0, gridBox.left-shapeLeft)
right  = max(0, shapeRight-gridBox.right)
top    = max(0, gridBox.top-shapeTop)
bottom = max(0, shapeBottom-gridBox.bottom)
spread = max(left,right,top,bottom)-min(left,right,top,bottom)
```

Nothing inside the grid box is flap. Pair boxes and their union may be returned as extent/layout
evidence, but they are never required to lie inside material and never determine support.

Report 12mm and 24mm outcomes separately. A family passes one switch only when both populations'
four overhangs are within that switch. Passing 24 does not imply passing 12.

For each side, return all boundary points or collinear segments attaining the shape bound. Split
the outline boundary at grid-box crossings into maximal outside-box chains. A chain containing a
side extremity is a `limb-candidate`; others are `unsupported-zone`. No numeric definition of
`trivial` is invented and no exception is silently approved.

Flap is intentionally a bounding-box measure: equal outline extrema yield equal flap evidence;
concavity inside the box is invisible to it. Exact full-disc support remains the material test.

For each population also return the four per-quadrant minimum magnet clearances and their spread.
The manufactured shape bounding box is split at the tested centre. Quadrants use a deterministic
half-open ownership rule: `x<0` is left and otherwise right; `y<0` is top and otherwise bottom.
An empty quadrant reports `null` and is excluded from the numeric spread; one non-empty quadrant
therefore has spread `0`. Flap spread and quadrant-margin spread are distinct measures (sealed
C11); neither is a gate.

## 9. Canonical identity and determinism

Canonical arrangement coordinates sort by `(y,x)` and encode `x,y` joined with `;` between pairs,
with no trailing separator. Arrangement identity is:

```text
registrationX,registrationY|coordinateList
```

Family identity is:

```text
band|reducedScale|baseArrangementId|sparseArrangementId
```

Complete family IDs sort by raw code-unit order. Each newline-terminated ID enters the per-key
SHA-256. Canonical output has fixed field/array order, locale-independent number formatting,
normalised `-0`, and refuses non-finite or undefined values. Timing is excluded from canonical
answer bytes and the request fingerprint covers outline plus every guarded value.

No randomness, locale, clock, map iteration order, source-window order or worker scheduling may
change the answer.

## 10. Runner and performance

Fingerprint the canonical outline and all guarded inputs. A cache hit returns the immutable
answer. A miss runs once outside interaction; publish only if its fingerprint remains current.
Cache a bounded number of complete results and expose read-only indices for browsing.

Pinch, resize, pan, drag, camera movement and family browsing invoke neither centre computation
nor solve. A worker is a measured escalation only if the cached runner still causes a real
main-thread stall; it is never a second engine or mandatory architecture.

Subset count is finite: a window of at most nine positions has at most `2^9` subsets before the
pair and connectivity filters. No count becomes pruning. The headless gate records candidate
count, family count, canonical bytes, peak memory, wall time, exact-fallback count and cache-hit
time on every real cutout. The UI virtualises the returned list; it does not reduce it.

## 11. Verification and build order

### 11.1 Independent gates

The oracle independently regenerates:

- canonical candidate fractions and band provenance;
- base and sparse coordinates, including both even sparse phases;
- exact support bits;
- every admissible connected subset;
- same-scale, same-registration families;
- upward-even publication and locked-aspect dimensions;
- per-population grid boxes and overhangs;
- canonical family IDs and hashes.

Permanent attacks:

- staggered-gaps: proves intersection of support sets, not max of first fits;
- BOT four-corner at 144: proves the union of band ladders;
- PILL tangency at `12/25`: proves closed exact support;
- DUCK first coupled family at 204: proves same-registration coupling;
- Butterfly four discs from 130: proves disc support, not box-interior containment;
- square/circle arithmetic, winding/start-index invariance, open concavity, notch, limb,
  diagonal-only pair, degeneracy and every guarded-value mutation;
- disconnected wing pairs: proves and displays the replaceable connectivity boundary.

The sealed evidence baseline is 26,852 exact support verdicts and 330 `(shape,scale,band)` family
keys. Independent implementations reproduce every settled key byte-for-byte; disconnected-union
alternatives are reported separately as the named product boundary, never blended into the
baseline.

### 11.2 Applied and performance proof

Run all seven saved cutouts through all six centres, both bands, both populations and both flap
switches. The proof surface steps through every returned family and draws only returned geometry:
fixed-aspect outline, discs, coordinates, grid boxes, overhangs, extremities and binding contacts.
An independent SVG probe recomputes them without production helpers.

Prove process, worktree and commit provenance. On the current build, script pinch, resize, pan,
drag, camera movement and browsing; centre/solver invocation count must remain zero. Observe the
same interaction on the product surface and capture it.

### 11.3 Build order

1. public types, canonical outline and canonical serialisation;
2. independent candidate/support oracle and permanent fixtures;
3. centres, fixed lattice, sparse phases and band-scoped windows;
4. candidate-scale generation and exact support cache;
5. admissible subset enumeration, deduplication, coupling and publication;
6. evidence, flap, limb and twin-fix records;
7. complete headless seven-cutout run and byte-for-byte oracle gate;
8. cached off-interaction runner and performance proof;
9. applied proof surface and independent SVG probe;
10. Builder, QA and Meta run EC-01 through EC-13 on one frozen snapshot.

The raw engine is not blocked on centre selection, size-ladder thinning, optimal ordering or
disconnected unions. It returns the settled complete connected option space for manual review and
keeps the named connectivity boundary visible. No production integration is part of this build.

## Closing gate

A `CLEAR` requires all three:

- **Necessity:** no element can be removed without losing a required answer or proof.
- **Sufficiency:** every settled size, layout, coordinate, support fact and measurement is
  computable without an unstated choice.
- **Provenance:** every product decision is Dan's; every engineering derivation is labelled and
  independently falsified; every unresolved product boundary stays visible and non-selecting.
