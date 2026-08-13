# Magnetic-Grid Measurement Kernel Contract

**Contract version:** 1.0.0  
**Wire schemas:** `magnetic-grid-measurement-kernel/lattice/v1` and `magnetic-grid-measurement-kernel/straight-capsule/v1`  
**Implementation:** TypeScript, ECMAScript 2022, zero package dependencies

## 1. Purpose and boundary

This package is a pure geometric measurement kernel. It accepts one simple polygon, an entirely runtime-supplied geometric parameter set, and requested sizes. It returns exact geometric facts.

It does **not** decide which size, position, subset, density, arrangement, or result is desirable. It contains no product dimensions, product bands, layout rules, phase rules, sparse-grid rules, ranking, tolerance policy, flap interpretation, rounding, publication logic, or manufacturing approval logic.

The two exported measurement operations are:

```ts
measureLattice(input: MeasureLatticeInput): LatticeMeasurementDocumentJson

measureStraightCapsule(
  input: MeasureStraightCapsuleInput,
): StraightCapsuleMeasurementJson
```

The deterministic serializer is:

```ts
serializeCanonical(value: unknown): string
```

An optional non-authoritative display helper is also exported:

```ts
approximateSqrtRational(value: RationalJson): number
```

No geometric decision uses that display helper or any floating-point operation.

## 2. Why the transform is supplied explicitly

A scalar called `size` does not, by itself, define a polygon transform. A caller must define:

- which source measure the scalar refers to;
- the source point about which scaling occurs;
- the physical point to which that source point maps.

The kernel therefore does not infer a bounding-box dimension, centre, centroid, or registration point. The runtime specification supplies a `sizeTransform`:

```ts
interface UniformSizeTransformInput {
  sourceSize: IntegerInput;
  sourceAnchor: RationalPointInput;
  targetAnchor: RationalPointInput;
}
```

For requested size `s`, the exact transform is:

\[
T_s(p)=a_t+\frac{s}{S}(p-a_s),
\]

where:

- \(S\) is `sourceSize`;
- \(a_s\) is `sourceAnchor`;
- \(a_t\) is `targetAnchor`.

Every one of these values is supplied at runtime. If a higher layer wants a maximum-bounding-box measure and bounding-box-centred scaling, that layer computes and supplies the corresponding numbers. The kernel itself contains no such rule.

The transform is uniform, aspect-locked, and orientation-preserving because `size` and `sourceSize` must both be positive.

## 3. Exact input types

### 3.1 Integer input

Every geometric integer is supplied as either:

```ts
type IntegerInput = bigint | string;
```

A string must be a canonical base-10 integer:

- valid: `"0"`, `"7"`, `"-19"`;
- invalid: `"01"`, `"+7"`, `"-0"`, `"7.0"`, exponential notation, whitespace.

JavaScript `number` is deliberately not accepted for geometric input.

### 3.2 Rational input

A rational is supplied as two exact integers:

```ts
interface RationalInput {
  numerator: IntegerInput;
  denominator: IntegerInput;
}
```

The denominator must be positive. The implementation reduces every rational by its greatest common divisor for exact canonical output. This is arithmetic normalisation, not geometric repair.

### 3.3 Polygon input

```ts
interface CanonicalPolygonInput {
  vertices: readonly IntegerPointInput[];
}
```

The input contract is one simple, solid, hole-free polygon cycle. The final vertex must not repeat the first vertex.

The kernel validates and rejects, rather than repairs:

- fewer than three vertices;
- a repeated closing vertex;
- duplicate vertices;
- zero-length edges;
- zero signed area;
- adjacent-edge backtracking overlap;
- any non-adjacent edge crossing or touching.

Consecutive collinear vertices are permitted when they do not backtrack. They are retained; the kernel never simplifies or removes them.

### 3.4 Lattice input

```ts
interface LatticeParametersInput {
  pitch: IntegerInput;
  origin: RationalPointInput;
  fieldExtent: {
    minColumn: IntegerInput;
    maxColumn: IntegerInput;
    minRow: IntegerInput;
    maxRow: IntegerInput;
  };
}
```

`pitch` must be positive. `fieldExtent` is an inclusive rectangle of integer lattice indices. For column \(i\) and row \(j\), the exact physical centre is:

\[
q_{i,j}=o+(i\,p,\;j\,p),
\]

where \(o\) is `origin` and \(p\) is `pitch`.

The kernel enumerates every index in the supplied rectangle. It does not hide, thin, select, group, or classify positions.

The output order is deterministic row-major enumeration:

1. rows from `minRow` through `maxRow`;
2. within each row, columns from `minColumn` through `maxColumn`.

This order is only a serialization convention; it is not a geometric ranking.

### 3.5 Disc input

```ts
interface KernelParametersInput {
  lattice: LatticeParametersInput;
  discDiameter: IntegerInput;
  sizeTransform: UniformSizeTransformInput;
}
```

`discDiameter` must be positive. Its exact radius is:

\[
r=\frac{\text{discDiameter}}{2}.
\]

Odd diameters are supported exactly; the radius then has denominator 2.

### 3.6 Size list

```ts
interface MeasureLatticeInput {
  polygon: CanonicalPolygonInput;
  parameters: KernelParametersInput;
  sizes: readonly IntegerInput[];
}
```

Every size must be positive. The input array is preserved exactly:

- no sorting;
- no deduplication;
- no early exit;
- no monotonicity assumption;
- no comparison between sizes.

If the same size appears twice, it is evaluated twice and returned twice in the same positions in the output array.

## 4. Per-position disc measurement

For a transformed closed polygon region \(P_s\) and a lattice centre \(q\), define the exact boundary clearance:

\[
\delta(q,P_s)=\min_{x\in\partial P_s}\lVert q-x\rVert_2.
\]

The kernel returns:

- exact centre coordinates;
- exact point location: `inside`, `boundary`, or `outside`;
- exact clearance;
- `fits`;
- every co-limiting boundary contact.

The full disc fits exactly when:

\[
q\in\operatorname{interior}(P_s)
\quad\text{and}\quad
\delta(q,P_s)\ge r.
\]

The comparison is closed. Equality passes, so boundary tangency of the disc counts as fit.

A centre on the polygon boundary is reported as `boundary`, not `inside`. Because the radius must be positive, such a centre cannot pass the full-disc test.

### 4.1 Exact point-to-segment distance

For polygon edge \([a,b]\), let:

\[
v=b-a,\qquad w=q-a,\qquad L=v\cdot v,\qquad h=w\cdot v.
\]

The squared distance is:

\[
d^2(q,[a,b])=
\begin{cases}
\lVert w\rVert^2, & h\le 0,\\
\lVert q-b\rVert^2, & h\ge L,\\
\dfrac{(v\times w)^2}{L}, & 0<h<L.
\end{cases}
\]

No square root is used to determine the minimum or the fit fact. Fractions are compared by cross-multiplication.

### 4.2 Exact clearance representation

Euclidean clearance is generally irrational even when every input is integral. The exact output is therefore algebraic:

```json
{
  "kind": "sqrt-rational",
  "radicand": {
    "numerator": "49",
    "denominator": "4"
  }
}
```

This represents exactly:

\[
\sqrt{49/4}=7/2.
\]

The numerator and denominator are reduced and the denominator is positive.

### 4.3 Limiting contacts

The nearest boundary point need not be unique. The kernel returns **all** exact co-limiting contacts in `limitingContacts`; no contact is treated as commercially preferred.

A boundary feature is either:

```ts
{ kind: "vertex"; vertexIndex: DecimalInteger }
```

or:

```ts
{
  kind: "edge";
  edgeIndex: DecimalInteger;
  startVertexIndex: DecimalInteger;
  endVertexIndex: DecimalInteger;
}
```

Each contact also returns the exact closest `boundaryPoint`.

Endpoint projections are represented as vertex contacts. Interior projections are represented as edge contacts.

## 5. Straight-capsule measurement

The second operation receives one size and two lattice positions:

```ts
interface MeasureStraightCapsuleInput {
  polygon: CanonicalPolygonInput;
  parameters: KernelParametersInput;
  size: IntegerInput;
  first: LatticePositionInput;
  second: LatticePositionInput;
}
```

The positions are evaluated exactly as supplied. They are not required to lie within `fieldExtent`; `fieldExtent` controls only the first operation’s enumeration.

For exact lattice centres \(q_1,q_2\), the tested capsule is:

\[
C=[q_1,q_2]\oplus B_r,
\]

where \([q_1,q_2]\) is the closed straight centreline segment and \(B_r\) is the closed radius-\(r\) disc. This is the straight strip of full disc width with closed semicircular end caps.

The capsule fits exactly when:

\[
q_1,q_2\in\operatorname{interior}(P_s)
\quad\text{and}\quad
\operatorname{dist}([q_1,q_2],\partial P_s)\ge r.
\]

Equality passes.

Because \(r>0\), the distance condition also guarantees that the centreline does not cross the boundary. If a concave polygon has both endpoints inside but the straight centreline exits and re-enters the polygon, the centreline intersects the boundary, its boundary distance is zero, and the capsule fails.

For two closed planar segments, exact minimum distance is:

- zero if they intersect or touch;
- otherwise the minimum of the four endpoint-to-opposite-segment distances.

The kernel applies this against every polygon edge and returns:

- both exact endpoint centres and point locations;
- `centrelineIntersectsBoundary`;
- exact centreline-to-boundary clearance;
- `fits`;
- a deterministic exact witness set for the minimum, including both the exact `boundaryPoint` and exact `centrelinePoint`.

When the closest locus is a continuous interval—for example, a centreline parallel to a polygon edge—the output does not sample that interval. It returns finite exact witness pairs generated at the limiting interval endpoints. These witnesses prove the exact minimum without pretending that a continuum is a finite list.

If both requested positions are identical, the operation remains defined: the capsule degenerates exactly to one disc.

## 6. BigInt work-coordinate construction

For each requested size, the engine constructs one positive common denominator \(D_s\) that is divisible by every denominator needed by:

- the uniform transform;
- both source-anchor coordinates;
- both target-anchor coordinates;
- both lattice-origin coordinates;
- the half-diameter radius.

Every transformed polygon vertex, lattice centre, and disc radius is then represented as a `BigInt` integer in work coordinates:

\[
X_{work}=D_s X_{physical}.
\]

This has three consequences:

1. point-in-polygon predicates use only integer orientation signs;
2. nearest-feature calculations use integer dot and cross products;
3. disc and capsule comparisons use squared values and exact cross-multiplication.

The work denominator is an internal implementation detail and does not enter policy or output interpretation.

No epsilon, tolerance, approximate orientation, approximate distance, or rounded geometric comparison exists anywhere in the decision path.

## 7. Spatial acceleration

The implementation builds a deterministic axis-aligned bounding-box hierarchy over transformed polygon edges for each size.

The hierarchy is used only to prune edges whose exact bounding-box lower bound is already greater than the exact current minimum distance. Equality is never pruned, because equal-distance features must be returned as co-limiting contacts.

This acceleration cannot alter a geometric result. Its worst-case measurement complexity remains linear in the edge count per query, while typical nearest-boundary queries examine a smaller subset.

Polygon validity checking is exact and currently worst-case quadratic in vertex count because all non-adjacent edge pairs are checked once. The polygon is validated once per exported operation, not once per requested size or lattice position.

## 8. Canonical witness indexing and invariance

The polygon geometry is not repaired or simplified. For deterministic feature indices only, the validated cycle receives a representation normalisation:

1. preserve every vertex and every adjacency;
2. orient the cycle counter-clockwise;
3. rotate the cycle so the lexicographically smallest `(x, y)` vertex is index 0.

This operation changes neither the polygon region nor any edge. It makes witness indices invariant under:

- reversed winding of the same cycle;
- a different starting vertex;
- uniform translation of the source coordinate frame, when `sourceAnchor` is translated by the same amount.

Adding, deleting, snapping, or simplifying vertices is a different polygon and is not made invariant. In particular, adding an otherwise redundant collinear vertex can legitimately change edge and vertex witness indices because the boundary representation changed.

## 9. Byte-stable output

All authoritative output numerics are canonical decimal strings or reduced rational objects. No `number`, `NaN`, infinity, negative zero, exponent notation, or implementation-dependent float formatting appears in exact output.

`serializeCanonical` produces deterministic UTF-8 JSON text by:

- sorting object keys lexicographically;
- preserving schema-defined array order;
- preserving input size order;
- preserving row-major lattice enumeration;
- sorting co-limiting contacts by canonical feature and exact point solely for serialization stability;
- rejecting JavaScript `number` and raw `bigint` values in the serialized object.

The serializer emits no insignificant whitespace and no trailing newline.

Calling the same operation with the same exact input and serializing it with `serializeCanonical` produces the same bytes.

## 10. Lattice output schema

Conceptually:

```ts
interface LatticeMeasurementDocumentJson {
  schema: "magnetic-grid-measurement-kernel/lattice/v1";
  sizes: readonly {
    size: DecimalInteger;
    scale: RationalJson;
    positions: readonly {
      column: DecimalInteger;
      row: DecimalInteger;
      center: RationalPointJson;
      centerLocation: "boundary" | "inside" | "outside";
      clearance: SqrtRationalJson;
      fits: boolean;
      limitingContacts: readonly PointBoundaryContactJson[];
    }[];
  }[];
}
```

There is one position record for every lattice index in the supplied field, for every occurrence in the supplied size list.

## 11. Straight-capsule output schema

Conceptually:

```ts
interface StraightCapsuleMeasurementJson {
  schema: "magnetic-grid-measurement-kernel/straight-capsule/v1";
  size: DecimalInteger;
  scale: RationalJson;
  first: CapsuleEndpointJson;
  second: CapsuleEndpointJson;
  centrelineIntersectsBoundary: boolean;
  clearance: SqrtRationalJson;
  fits: boolean;
  limitingContacts: readonly CapsuleBoundaryContactJson[];
}
```

No interpretation is attached to the two positions beyond the exact straight-capsule geometry.

## 12. Deterministic rejection

Invalid input throws `KernelInputError`, which includes:

```ts
class KernelInputError extends Error {
  code: KernelInputErrorCode;
  path: string;
}
```

The available error codes are declared in `src/errors.ts`. No invalid polygon or malformed numeric value is silently repaired, rounded, clamped, reordered into a different geometry, or accepted through an epsilon.

The only cycle normalisation is the explicitly documented winding/start-index normalisation used after validity has already been established.

## 13. Explicit exclusions

The kernel contains none of the following:

| Excluded concern | Owner |
|---|---|
| bands or size ranges | specification/logic layer |
| candidate generation | specification/logic layer |
| size selection | logic layer |
| layout construction | logic layer |
| connected-subset discovery | logic layer |
| density or thinning | specification/logic layer |
| parity or phase | specification/logic layer |
| minimum contact count | logic layer |
| ranking or tie preference between results | logic layer |
| flap calculation or interpretation | separate measurement/logic layer |
| manufacturing tolerance | specification/approval layer |
| rounding or publication | specification/logic layer |
| tracing, simplification, snapping, or repair | upstream canonical-geometry layer |
| labels such as pass tier, band, SKU, or approval | logic/product layer |

The boolean `fits` is only the exact geometric predicate requested by this contract. It is not a manufacturing approval or product-selection label.

## 14. Golden fixtures

The fixture manifest is `fixtures/manifest.json`. Every expected file is the exact output of `serializeCanonical` and is compared byte-for-byte by `test/golden.test.mjs`.

### 14.1 Exact tangency and ±1 physical unit

The primary fixtures use:

- source square from `-10` to `10` on both axes;
- runtime scale `21/20`, producing boundaries at `±21/2`;
- runtime disc diameter `7`, producing radius `7/2`.

For the right-side disc tests:

| Fixture | Centre x | Exact clearance | Relation to radius | `fits` |
|---|---:|---:|---:|---:|
| boundary exact | `7` | `7/2` | equal | `true` |
| minus one | `8` | `5/2` | radius − 1 | `false` |
| plus one | `6` | `9/2` | radius + 1 | `true` |

The end-cap straight-capsule fixtures use endpoints `(-7,0)` and `(7,0)`, then `±8`, then `±6`, giving the same exact boundary, minus-one, and plus-one facts.

A second straight-capsule series holds the horizontal centreline endpoints at `x = ±5` and moves the centreline through `y = 7`, `8`, and `6`. This verifies exact lateral-strip tangency and the same ±1 facts against the top polygon edge.

### 14.2 Representation invariance

Three lattice inputs point to the same expected byte file:

- reversed winding;
- rotated start index;
- source polygon translated while `sourceAnchor` is translated identically.

The golden updater rejects these fixtures if they produce different canonical bytes.

### 14.3 Rational transform and lattice origin

A separate fixture uses rational source and target anchors together with a rational lattice origin. Its transformed right boundary is exactly `459/40`, its lattice centre is exactly `319/40`, and its clearance remains exactly `7/2`. This exercises the full common-denominator transform rather than only an integer anchor.

### 14.4 Concavity

Additional fixtures verify that:

- lattice positions in two arms of a concave U-shape are measured independently;
- a position in the open notch is `outside` even though its boundary clearance is positive;
- a straight capsule whose two endpoints are inside separate arms fails because its centreline crosses the notch boundary.

## 15. Build and verification

The package has empty `dependencies` and `devDependencies` objects. Generated ECMAScript and declaration files are included in `dist/`.

To rebuild from TypeScript source, use a TypeScript compiler available on the system:

```bash
npm run build
```

To regenerate canonical expected outputs and verify shared invariance fixtures:

```bash
npm run golden:update
```

To compile and run the complete test suite:

```bash
npm test
```

The tests use only Node’s built-in test, assertion, filesystem, URL, and path modules.

## 16. File map

```text
CONTRACT.md
package.json
tsconfig.json
src/
  arithmetic.ts
  engine.ts
  errors.ts
  geometry.ts
  index.ts
  polygon.ts
  serialize.ts
  types.ts
fixtures/
  manifest.json
  inputs/
  expected/
scripts/
  clean.mjs
  update-golden.mjs
test/
  golden.test.mjs
dist/
  generated JavaScript and .d.ts files
```
