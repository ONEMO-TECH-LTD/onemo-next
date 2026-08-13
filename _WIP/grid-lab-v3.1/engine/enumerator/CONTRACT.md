# Neutral Candidate Enumerator Contract

**Contract version:** 1.0.0  
**Input grammar schema:** `magnetic-grid-candidate-enumerator/grammar/v1`  
**Output schema:** `magnetic-grid-candidate-enumerator/candidates/v1`  
**Kernel input schema:** `magnetic-grid-measurement-kernel/lattice/v1`

## 1. Boundary

This package is the combinatorial layer directly above the accepted magnetic-grid measurement kernel.

It accepts:

1. one kernel lattice-measurement document, unchanged; and
2. one explicit arrangement grammar.

It returns every candidate established by those facts and that grammar.

It performs no geometry. It does not call the kernel, measure distance, inspect polygon edges, infer missing positions, recalculate coordinates, score, rank, prune, select, label, approve, or return a winner. A kernel position is held exactly when its published `fits` fact is `true`.

The public operation is:

```ts
enumerateCandidates(
  input: EnumerateCandidatesInput,
): CandidateEnumerationDocumentJson
```

Canonical serialization is:

```ts
serializeCanonical(value: unknown): string
```

## 2. Explicit populations

The brief refers to base and sparse populations but does not define a wire representation for a population. This contract does not infer one from physical coordinates, lattice pitch, anchoring, or registration semantics. Each population is supplied as exact data:

```ts
interface PopulationInput {
  id: string;
  origin: {
    column: IntegerInput;
    row: IntegerInput;
  };
  indexStep: IntegerInput;
}
```

`id` is the caller-owned population identity. It must be non-empty and unique in the grammar. `indexStep` must be positive.

A kernel lattice index `(column, row)` belongs to the population exactly when there are integers `u` and `v` such that:

```text
column = origin.column + u * indexStep
row    = origin.row    + v * indexStep
```

`u` and `v` are population coordinates. The enumerator intersects this caller-defined population with the exact field positions published by the kernel document. It does not report or infer population origin, phase, registration, density, or physical meaning.

A population not representable by this single isotropic congruence class requires a different explicit grammar schema; this implementation does not approximate or infer it.

## 3. Two ambiguities remain caller data

Two sentences in the supplied prose admit materially different formal readings. The enumerator does not choose between them.

### 3.1 Run spacing

“Evenly spaced” can mean either:

- only consecutive population positions; or
- any positive whole number of population steps, permitting unused population positions between members.

The grammar must supply exactly one:

```ts
stepDomain:
  | "unit-population-step-only"
  | "any-positive-whole-population-step"
```

Under either reading, no run is required to be maximal. Every qualifying two-or-more-member run, including qualifying subruns, is returned. A larger run never suppresses a smaller one.

### 3.2 A 1 × 1 full window

The brief explicitly confirms a `1 × 2` full window but does not state whether `r = 1` and `c = 1` is lawful. The grammar must supply:

```ts
oneByOne: "include" | "exclude"
```

This changes only whether a held population point is ALSO emitted as a 1 x 1 full-window candidate. It never affects the `single` candidate, which exists for every held position regardless.

## 4. Authoritative families

The grammar contains exactly these five family keys. Missing keys, unknown family keys, or family extensions are rejected.

### 4.0 `single`

One candidate per held population position, containing exactly that position, with steps
`0,0`. It is emitted for every held position of every supplied population, independently
of the `full-window` `oneByOne` rule: a lone held position is always a `single`, and is
additionally a `1 x 1` full window when that rule includes them. The two records share a
position set but differ in family, so candidate identity keeps them distinct.

### 4.1 `run`

A run is a complete finite arithmetic progression of at least two held population positions.

For consecutive members, let the population-coordinate increment be `(du, dv)`. It is lawful exactly when one of these holds:

```text
du > 0 and dv = 0                 horizontal
du = 0 and dv > 0                 vertical
du > 0 and |dv| = du              either diagonal slope
```

The direction convention removes reverse duplicates only. It is not a preference.

For `unit-population-step-only`, the non-zero magnitude is exactly one. For `any-positive-whole-population-step`, it may be any positive integer.

Candidate `steps` are this signed per-member increment:

```json
{ "column": "1", "row": "-1" }
```

### 4.2 `rectangle-corners`

For every `u0 < u1` and `v0 < v1`, the candidate exists when all four population positions are held:

```text
(u0, v0), (u1, v0), (u0, v1), (u1, v1)
```

The side spans may be any positive whole number of population steps, independently. All interior and edge-intermediate positions are unused and are not queried for held status.

Candidate `steps` are the positive side spans:

```text
column = u1 - u0
row    = v1 - v0
```

### 4.3 `corner-triangle`

For every axis-aligned four-corner frame, each three-corner subset is an independent candidate when those three selected corners are held.

The fourth corner is not a member. Its held status is irrelevant. When all four corners are held, all four distinct corner-triangle candidates are returned.

Candidate `steps` are the enclosing rectangle’s positive side spans.

### 4.4 `full-window`

For every inclusive population-coordinate rectangle `[u0, u1] × [v0, v1]`, a full-window candidate exists exactly when every population position in that block is published by the kernel and has `fits: true`.

`1 × n` and `n × 1` blocks are lawful. The `1 × 1` case follows the explicit `oneByOne` grammar fact.

Candidate `steps` are non-negative block spans:

```text
column = u1 - u0
row    = v1 - v0
```

## 5. No arbitrary-subset search

Enumeration is bounded by:

- the exact finite field published in each kernel size entry;
- the supplied regular populations; and
- the five algorithms above.

The implementation never iterates the powerset of held positions.

No candidate is removed because another candidate:

- has more members;
- uses the same members under another family;
- uses the same members under another population; or
- encloses or contains it.

Deduplication occurs only when family, population identity, per-axis steps, and canonical position set are all identical within the same source-size occurrence.

## 6. Size identity

The accepted kernel preserves caller size order and permits duplicate size values. A value alone therefore does not identify a size occurrence.

Every candidate carries:

```ts
interface CandidateSizeJson {
  kernelSizeIndex: DecimalInteger;
  value: DecimalInteger;
  kernelFactRef: string;
}
```

Example:

```json
{
  "kernelSizeIndex": "2",
  "value": "120",
  "kernelFactRef": "/sizes/2"
}
```

`kernelSizeIndex` is the zero-based occurrence in the supplied document. Nothing is sorted or deduplicated across size entries.

## 7. Candidate record

```ts
interface CandidateJson {
  id: string;
  size: CandidateSizeJson;
  family:
    | "run"
    | "rectangle-corners"
    | "corner-triangle"
    | "full-window";
  population: string;
  steps: {
    column: DecimalInteger;
    row: DecimalInteger;
  };
  positions: readonly {
    column: DecimalInteger;
    row: DecimalInteger;
    center: RationalPointJson;
    kernelFactRef: string;
  }[];
}
```

Every index and centre value is copied from the supporting kernel position fact. The enumerator does not reconstruct a centre from pitch, origin, size, or neighbouring facts.

`kernelFactRef` is an RFC 6901 JSON Pointer into the supplied measurement document, for example:

```text
/sizes/0/positions/7
```

The output does not duplicate or reinterpret clearance, limiting-contact, anchoring, registration, or density semantics.

## 8. Canonical identity

The authoritative candidate identity is exactly:

- family;
- population ID;
- per-axis steps; and
- canonical position set.

Size is intentionally not part of this identity because the supplied identity sentence excludes it. The pair `(candidate.size.kernelSizeIndex, candidate.id)` identifies one occurrence in an output document.

Positions are canonicalised in numeric row-major order. The ID is collision-free and inspectable:

```text
candidate:v1:<canonical JSON of family, population, steps and position set>
```

It is not a hash. No floating-point, encoding guess, random value, timestamp, platform value, or collision assumption enters identity.

## 9. Canonical order and serialization

The output array order is:

1. source size occurrence order from the kernel document; then
2. ascending canonical candidate ID within that size occurrence.

This is a serialization order only. It is not ranking and carries no preference.

Canonical JSON:

- emits object keys lexicographically;
- preserves schema-defined array order;
- represents exact numeric values as canonical decimal strings;
- rejects JavaScript `number`, `bigint`, `undefined`, functions, symbols, and unsupported values in output serialization.

Identical input bytes produce identical canonical output bytes.

## 10. Missing facts and invalid input

The enumerator validates that every kernel size entry publishes one complete rectangular lattice-index field and that all size entries cover the same field.

If a family requires a position fact inside that published field and the fact is absent, enumeration throws `MissingKernelFactError`, naming:

- source size index;
- missing column;
- missing row; and
- the expected fact reference.

It does not treat absence as `fits: false`, infer the value, call geometry, or continue with a partial answer.

The grammar is exact and closed. Silent repair, unknown family substitution, duplicate population IDs, non-positive population steps, non-canonical integer strings, and malformed kernel documents are rejected.

## 11. Arithmetic discipline

All lattice indices, population origins, population steps, population coordinates, family increments, spans, and size occurrence values are represented and compared with `BigInt` or canonical decimal strings.

No epsilon and no floating-point value enters population membership, held-position validity, family validity, candidate identity, deduplication, or supporting-fact selection. ECMAScript array iteration and sort callbacks are used only as container mechanics; their numeric indices never become geometric or candidate arithmetic.
