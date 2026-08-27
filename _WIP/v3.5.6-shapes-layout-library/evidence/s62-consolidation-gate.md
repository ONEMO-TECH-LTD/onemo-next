# [Codex][CONSOLIDATION GATE] REJECT — six executable ambiguities remain

The consolidation captured the large decisions correctly: two live inputs only, library-only
law, five LAW-0 gates, 9-zone direction, class packages before the producer, transitional-table
deletion, OutlineRecipe rotation, catalogue before surface, matcher honesty, and zero final
todos. I cannot ACK it yet because six lines still make the sole executable prescription
contradictory or incomplete.

## F1 — Step 1 does not say which non-LAW-0 gates are staged

Evidence: build spec lines 19-23 gives the correct generic todo rule, but lines 27-33 names
only LAW 0 and topology as todos while ordering the final AST matrix, constant ownership and
registration invariants implemented at current head. Those gates cannot be active at Step 1:

- final zone 0-5 ownership and registration do not exist until Step 2;
- `padMM` and the old outline owners deliberately remain until Step 3;
- catalogue identity/matcher do not exist until Step 4;
- surface, barrel, shell and CSS laws do not become true until Step 5.

The builder protocol says it must stop rather than decide this activation boundary itself.

Minimal replacement after line 33:

```text
Activation schedule is fixed, not inferred:
- STEP 1 active: retired-token gate, AST-tautology gate, current exact-position proof,
  and the bounded dead-export/comment/test repairs listed in STEP 1.
- STEP 2 activates contracts/classes/registry/service zones 0-5, registration invariants,
  class-policy isolation, fail-loud variant identity, readonly corpus/no sentinels,
  no React/Next/JSX in zones 0-5, and no runtime pitch default.
- STEP 3 activates constant ownership/no padMM, one outline producer, topology/size/clearance.
- STEP 4 activates LAW 0 C1-C5 and catalogue identity/matcher gates.
- STEP 5 activates surface/barrel/shell/bridge/CSS gates and the full caller-equality gate.
Every not-yet-active test title names exactly that owning step; zero todos after STEP 5.
```

Split matrix/identity gates by owned zone/capability where necessary; do not keep one giant
todo until Step 5.

## F2 — `typeOf` and the materialised class identity were dropped

Evidence: build spec lines 87-93 lists ClassControls without `typeOf`, although current
`options.ts:123` calls `spec.typeOf(sel, pitchMM)`. Lines 97-99 rename `LibrarySelection` only;
current `MaterializedLibrary` still has both `shapeId` and `declaredFamily`. Deleting
`LibraryShapeId` without replacing that record leaves the service contract inconsistent.

Replace the shorthand contracts with exact executable signatures:

```ts
export interface ClassSpec {
  classId: LibraryFamily
  types: readonly ClassType[]
  variants(typeId: string, pitchMM: number): readonly ClassVariant[]
  variantOf(sel: LibrarySelection, pitchMM: number): ClassVariant
  boundaryOf?(
    sel: LibrarySelection,
    nodesMM: readonly PointMM[],
  ): readonly PointMM[] | undefined
  validateDraft(draft: DraftShape, frame: LibraryFrame): string[]
}

export interface ClassControls {
  typeOf(sel: LibrarySelection, pitchMM: number): string
  open(current: LibrarySelection, pitchMM: number): LibrarySelection
  orientations: readonly { id: string; view: LibraryTransform }[]
  baseView(sel: LibrarySelection, pitchMM: number): LibraryTransform
  draftMatches(draft: DraftIdentity, sel: LibrarySelection, frameKey: string): boolean
  draftIdParts(sel: LibrarySelection, frameKey: string): DraftIdentity
}
```

`selectVariant` is one standalone generic transition, not a ClassControls member.

Add the materialised rename explicitly:

```ts
export interface MaterializedLibrary {
  classId: LibraryFamily
  // existing geometry fields
}
```

Delete `shapeId` and `declaredFamily` from `MaterializedLibrary` and all callers; one class
identity survives everywhere.

## F3 — two import-matrix edges are impossible as written

Evidence:

- architecture line 48 says zone 0 permits no imports, but `class-contract.ts` must type-import
  the selections/frames/transforms declared in `types.ts`, also zone 0;
- architecture lines 56 and 81 say bridge imports the barrel only, while build-spec lines
  130-132 explicitly require `RELEASED_PADDING_MM` from `grid-magnet-spec` for engine spot
  conversion.

Replace the rows/law with:

```text
zone 0 contracts: type-only imports from zone 0 and approved external type modules; no runtime imports.
zone 8 shell/adapter: page and panel runtime library imports come from the barrel only.
The bridge imports the barrel, engine types, and named physical constants from
grid-magnet-spec; it imports no library internals and makes no geometry or selection decision.

LAW 7: page/panel import the library barrel only. Bridge imports are limited to the barrel,
engine types, and grid-magnet-spec constants; all three remain free of resolver/materialiser/spec queries.
```

`MaterializedLibrary` is already barrel-exported, so delete the direct-internal
“materialized types type-only” exception.

## F4 — Step 4's supposedly exact `CatalogueEntry` is not valid TypeScript

Evidence: build spec lines 145-147 uses untyped shorthand (`classId; typeId; ...`) even though
historical documents are now non-executable. The architecture file has the valid exact V1;
the sole executable spec should not make the builder reconstruct it.

Copy the architecture declaration verbatim into Step 4:

```ts
export type CatalogueEntry = Readonly<{
  classId: LibraryFamily
  typeId: string
  id: string
  label: string
  pitchMM: number
  corners: CornerMode
  nodesMM: readonly PointMM[]
  outlineMM: readonly PointMM[]
  widthMM: number
  heightMM: number
  frameCols: number
  frameRows: number
}>
```

## F5 — the diamond 3x3 numeric gate is false at the stated tolerance

Evidence: build spec lines 134-136 asks for raw `130x130` within `0.05mm`. The shared producer's
actual ruled size at 48mm pitch is:

```ts
2 * (48 + 12 * Math.SQRT2) // 129.941125...
```

That differs from 130 by about `0.0589mm`, so the prescribed correct implementation fails the
prescribed gate.

Replace the clause with:

```text
diamond 3x3 raw size = 2 * (48 + RELEASED_PADDING_MM * Math.SQRT2), within the
manufacturing tolerance; its rounded UI label is 130x130.
```

Keep 33.94 as the rounded 1x1 statement or assert `24 * Math.SQRT2` directly.

## F6 — “move verbatim, do not rewrite” conflicts with Step 2's required API edits

Evidence: build spec line 65 forbids rewriting, while lines 75-105 require new contracts,
identity renames, table deletion and lookup replacement. A literal executor must stop.

Replace line 65 with:

```text
Move existing policy/helper bodies verbatim wherever their signature and ownership remain
valid. Make only the contract and identity edits explicitly listed below; preserve behaviour
through the move. Do not reimplement working geometry or population algorithms.
```

## Verdict

**Necessity — shrink:** no new plan layer. Six textual corrections inside the two consolidated
inputs; no historical document returns to the execution set.

**Sufficiency — partial:** the consolidation carries the architecture and build scope, but it
is not executable without interpretation until F1-F6 are corrected. REJECT pending those
edits; no builder dispatch yet.
