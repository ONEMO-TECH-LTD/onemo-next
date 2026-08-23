# Magnetic-grid product logic contract

**Layer version:** 1.0.0  
**Rules schema:** `magnetic-grid-product-logic/rules/v1`  
**Result schema:** `magnetic-grid-product-logic/result/v1`

## 1. Boundary

This package is the product-logic layer above the accepted measurement kernel and candidate enumerator.

It accepts plain immutable JSON documents from those layers. It does not import, bundle, call, rebuild, emulate, or version either upstream implementation.

The public operation is:

```ts
applyProductLogic(input: ApplyProductLogicInput): ProductLogicDocumentJson
```

Canonical serialization is:

```ts
serializeCanonical(value: unknown): string
```

The layer:

- performs no geometry;
- never calculates clearance, distance, position, region, mass, top material, or overhang;
- never creates, deletes, filters, hides, or selects a candidate;
- never ranks by size, family, population, position count, step width, clearance, or limiting contact;
- never interprets anchoring or registration;
- copies the complete candidate document into the result unchanged;
- resolves each candidate position’s kernel JSON Pointer, validates that the referenced `fits` fact is true, and copies the exact clearance and limiting-contact fact into that candidate’s evaluation.

The caller-side `single` family is accepted together with `run`, `rectangle-corners`, `corner-triangle`, and `full-window`. Family is reported only through the unchanged candidate document and has no built-in ordering effect.

## 2. Why additional rule inputs are mandatory

The two accepted upstream documents publish arrangement structure and exact disc facts. They do **not** publish:

- which material is “upper” for gravity;
- how much unsupported material constitutes tight or loose wrap;
- any decomposition of the shape into masses or regions;
- status boundaries;
- band-support sufficiency;
- arrangement strength for escalation.

The product layer therefore accepts caller judgements for those concepts. It does not derive them from coordinates, clearances, family, population, steps, or position count.

All explanatory `definition`, `basis`, `triggerInput`, `strengthInput`, and `policyInput` values are exact JSON. JavaScript `number` and `bigint` are rejected; numerical evidence must be encoded as canonical integer strings or exact rational objects.

## 3. Required inputs by rule

### 3.1 Gravity

Rule definition:

```ts
rules.gravity = {
  definitionId: string,
  definition: ExactJsonValue
}
```

Per candidate:

```ts
judgement.gravity = {
  holdsUpperMaterial: boolean,
  basis: ExactJsonValue
}
```

`true` ranks above `false`. No degree of upper support is inferred. A candidate with more positions does not receive an advantage.

The boolean is the smallest additional input capable of implementing the stated binary ruling. The caller owns the definition represented by `definitionId` and `definition`.

### 3.2 Tight wrap

Rule definition:

```ts
rules.tightWrap = {
  definitionId: string,
  definition: ExactJsonValue,
  comparator: OrderedValueComparatorInput
}
```

Per candidate:

```ts
judgement.tightWrap = {
  value: OrderedValueInput,
  basis: ExactJsonValue
}
```

Tight wrap is compared only when **both** candidates have `holdsUpperMaterial: true`. It never rehabilitates a gravity-failing candidate and never orders two gravity-failing candidates.

The caller may supply either:

- an exact rational value with an explicit `higher-is-better` or `lower-is-better` direction; or
- an explicit ordered class with a complete `bestToWorst` class list.

The layer does not know what the value measures.

### 3.3 Regional support

Rule definition:

```ts
rules.regionalSupport = {
  definitionId: string,
  definition: ExactJsonValue,
  comparator: OrderedValueComparatorInput,
  precedence:
    | "report-only"
    | "before-gravity"
    | "between-gravity-and-tight-wrap"
    | "after-tight-wrap"
}
```

Per candidate:

```ts
judgement.regionalSupport = {
  value: OrderedValueInput,
  basis: ExactJsonValue
}
```

Regional support remains a separate judgement in every output record. It affects ordering only at the exact supplied precedence position. `report-only` records differing regional values without allowing them to split a tier.

No region count, disc count, coordinate span, or position distance is substituted for this judgement.

### 3.4 Bands

Every kernel size occurrence is assigned exactly once:

```ts
rules.bands = {
  order: string[],
  sizeAssignments: {
    kernelSizeIndex: DecimalInteger,
    band: string
  }[]
}
```

`order` identifies which band is the immediate next band for escalation. It is not itself a candidate preference, and size is never used as an ordering value.

Duplicate size values remain distinct because assignment uses `kernelSizeIndex`.

### 3.5 Escalation

Escalation is optional because its trigger and target are not derivable.

When supplied, every band receives one explicit ruling:

```ts
{
  band: string,
  supportInsufficient: boolean,
  triggerDefinitionId: string,
  triggerInput: ExactJsonValue
}
```

Each active target is declared explicitly:

```ts
{
  sourceBand: string,
  targetBand: string,
  targetCandidateRef: string,
  strengthDefinitionId: string,
  strengthInput: ExactJsonValue
}
```

A promotion is valid only when:

- `sourceBand` is explicitly insufficient;
- `targetBand` is the immediate next band in `bands.order`; and
- the target candidate belongs to `targetBand`.

The declaration means exactly: that target candidate ranks above **every** candidate in `sourceBand`. It is applied before the ordinary judgement precedence because otherwise the stated “above every candidate” result could be defeated by another comparison.

No other next-band candidate is promoted. The layer does not infer strength from family, count, spread, clearance, size, or step width.

### 3.6 Status

Status is optional and never affects ordering.

The smallest non-invented input is one direct assignment per candidate:

```ts
rules.statusPolicy = {
  policyId: string,
  definition: ExactJsonValue,
  assignments: {
    candidateRef: string,
    status: string,
    policyInput: ExactJsonValue
  }[]
}
```

When no status policy is supplied, every candidate returns:

```json
{ "kind": "not-supplied" }
```

No labels, thresholds, or classifications are guessed.

## 4. Ordering law

For each candidate pair, the layer applies the first supplied rule that separates the pair:

1. an active explicit escalation promotion, if one governs that pair;
2. regional support, when its precedence is `before-gravity`;
3. gravity;
4. regional support, when its precedence is `between-gravity-and-tight-wrap`;
5. tight wrap, only when both candidates satisfy gravity;
6. regional support, when its precedence is `after-tight-wrap`.

With `report-only`, regional support is omitted from this comparison sequence but remains in every evaluation.

If no active rule separates two candidates, they tie. There is no fallback comparison by candidate ID, source order, size, family, population, position count, coordinates, steps, clearance, or status.

### Tierability

The requested output is a sequence of disjoint ranked tiers. Such tiers are mathematically possible only when the supplied pairwise rulings form a strict weak order: unresolved comparison must be transitive, and the strict order must contain no cycle.

The layer validates this. If, for example, supplied rules imply `A > B`, `B > C`, but `A` and `C` are unresolved, no disjoint tier partition can honestly satisfy all three statements. The operation throws `NonTierableOrderingError` rather than inventing a tie-break or silently discarding a ruling.

Within a tier, candidate references appear in source candidate order for canonical serialization only. That array order carries no preference.

## 5. Output

The result contains:

- `candidateDocument`: an exact structural copy of the complete supplied candidate document;
- `ruleDefinitions`: the exact validated definitions and policies used;
- `evaluations`: one record per candidate, in source candidate order;
- `ordering.tiers`: highest to lowest supplied-rule tier;
- `ordering.boundaries`: one record per adjacent tier boundary.

Each candidate evaluation includes:

- its source candidate pointer and ID;
- its explicit band;
- every referenced kernel position fact, including exact clearance and limiting witnesses;
- gravity, tight-wrap, and regional-support values and bases;
- the regional precedence;
- escalation inputs relevant to that candidate;
- assigned status or the explicit fact that no status policy was supplied.

Each tier boundary contains every candidate-pair separation across that adjacent boundary and the exact deciding rule and values. No candidate is marked winner, answer, default, preferred, or selected by the engine.

## 6. Exactness and determinism

- Exact rational comparison uses `BigInt` cross multiplication.
- Ordered classes use the caller’s complete explicit class order.
- No epsilon exists.
- JavaScript floating point is absent from all product-value, identity, validity, and ordering paths.
- Array indexes are used only to address immutable document arrays.
- Canonical JSON sorts object keys lexicographically and preserves schema array order.
- Identical parsed inputs produce byte-identical canonical output.

## 7. Definitions deliberately left to the caller

The package implements the smallest explicit inputs above because the following seemingly small definitions fail on different shapes.

### “Upper material”

- **Topmost coordinate strip:** simple, but a decorative antenna can become the only “upper” material and disqualify a layout supporting the main body.
- **Top region with an area threshold:** ignores antennas, but the threshold is a product value absent from the documents.
- **Top semantic mass:** can match human judgement, but requires a caller-owned mass model or annotations.

The package therefore accepts only the final per-candidate boolean and its exact basis.

### “Wraps most closely”

- **Axis-aligned bounding-box overhang:** cheap, but a thin limb can enlarge the box without representing substantial unsupported material.
- **Unsupported area outside a support hull:** captures quantity, but can prefer a broad low support pattern that fails gravity.
- **Per-region or per-side vector:** preserves structure, but requires an explicit comparison order when one candidate is better on one component and worse on another.

The package accepts an exact caller-owned rational or ordered class and does not choose the measure.

### “A mass of the shape”

- **Connected visual lobes:** unstable under a narrow bridge.
- **Connected regions after a clearance erosion:** mechanically meaningful, but the accepted candidate and lattice documents do not publish that region topology.
- **Semantic masses:** can reflect artwork meaning, but are not geometric facts and may require labels.

The package accepts an independent regional-support value and basis. It never derives masses from magnet spacing or candidate position count.

### Status boundary

- **One scalar threshold:** cannot express a candidate that passes gravity but fails one mandatory region.
- **Conjunctive thresholds:** can express mandatory conditions, but the conditions and thresholds are product rules not supplied here.
- **Direct assignments:** are the smallest sufficient, lossless inputs when the classification policy lives outside this layer.

This implementation uses direct assignments.

### Escalation trigger

- **Best regional value below a threshold:** requires a regional scale and threshold.
- **No candidate with acceptable status:** couples escalation to a status model that may not exist.
- **Explicit band ruling:** states the product decision without introducing a proxy.

This implementation uses an explicit boolean ruling per band.

### Escalation strength

- **More positions:** fails when additional positions remain in one unsupported mass.
- **Wider span:** fails when wider means looser wrap.
- **Family priority:** fails when the same useful position set appears under more than one family.
- **Regional coverage:** may be correct, but only if the caller’s mass model says so.

This implementation accepts explicit promoted target candidates with exact strength bases.

## 8. Acceptance oracles

Decided examples are test oracles for an externally supplied rule set. They are not runtime measurement inputs and cannot define missing regions, status boundaries, or metrics. A test should provide the explicit judgements and policies, run `applyProductLogic`, and assert only the oracle’s required tier relations.
