# [Codex][RECONCILIATION] Final winning prescription before builder dispatch

Yes. Section D makes more than the old block-3 file list stale. The builder must not be asked
to interpret four documents containing old text plus overrides; its own protocol says to stop
on conflict, and the current inputs contain real conflicts.

## Minimal diff to the planning artifacts

Edit only two live inputs:

1. Rewrite `/tmp/s62-architecture-draft.md` as present truth. Replace the old zone table,
   unreliable gates and superseded laws in place; delete the `ADOPTED HARDENING ... overrides`
   appendix. Do not land a law containing both the rejected rule and its override.
2. Make `/tmp/s62-build-spec-library-rootfix.md` the sole executable prescription. Remove the
   old proposal, adoption record and QA report from the builder's required source list. They
   remain evidence, not instructions. Fold the winning clauses below into the build spec.

This is smaller and safer than editing four historical records into agreement.

## Other stale parts and exact winning replacements

### 1. Step order

The old `outline -> class split` order is no longer executable. `outlineFromLayout` now needs
the class-owned `OutlineRecipe`, while the current `ClassVariant` has no recipe and the current
materialiser only knows `ClassSpec.outline`. Adding a temporary recipe/lookup to the monolithic
`class-spec.ts` and moving it one commit later is churn.

Winning order:

1. Scaffold gates plus current violations/proof repairs.
2. Split contracts/registry and move each class's policy into its self-contained class module;
   add `OutlineRecipe` to `ClassVariant`. Preserve current outline behaviour in this move.
3. Land the one shared outline producer and delete every per-class/stored outline algorithm.
4. Land the frozen catalogue plus real matcher.
5. Land the resolved UI surface, conversion-only bridge and narrow barrel.

Outline convergence still precedes the catalogue, which was the load-bearing ordering rule.

### 2. Scaffold commit cannot intentionally fail its mandatory pre-commit gate

The current spec says Step 0 may fail, Step 0.5 later repairs it, but also requires the full
effect suite green before every commit. Both cannot be true.

Replace Steps 0 and 0.5 with one commit:

> Land the consolidated architecture document and architecture gate file; run the new gates
> against the untouched head and record the expected failures; repair the bounded current-head
> violations and the two Step-1 proof defects in the same step; commit only after every gate
> whose production prerequisite exists is green. Gates whose prerequisite is introduced by a
> later named step are `test.todo` with that step in the title, activated in that same later
> commit. Final state after Step 5: zero architecture-gate todos.

Do not claim “the gate suite fully green” while future-contract todos remain; say “all active
gates green”.

### 3. Architecture path and source count

The build spec's `src/lib/effect/ARCHITECTURE.md` is stale. The library-only law belongs at:

```text
src/lib/effect/library/ARCHITECTURE.md
```

Delete “read BOTH” and the three historical instruction files. The builder reads the final
build spec and the consolidated architecture draft only.

### 4. Final class structure

Delete the old instruction `class-spec.ts = interfaces + registration`. It encodes the cycle
the adopted matrix rejects.

Final owners:

```text
types.ts                  shared domain data only
class-contract.ts         OutlineRecipe, ClassVariant, ClassSpec, ClassControls, LibraryClass
class-registry.ts         CLASS_SPECS + specOf only
registry-class.ts         shared constructor; accepts a complete class config
square-class.ts           square policy + its corpus/config
rectangle-class.ts        rectangle policy + its corpus/config
diamond-class.ts          diamond policy + its corpus/config
triangle-class.ts         triangle policy + its support modules
```

`corpus-*.ts` remains literal data. `registry-class.ts` may reuse generic mechanics but must
not read `RAW_CLASS_FRAMES`, `REGISTRY_RULES`, or any global per-class switch/table. Adding a
class is its corpus/class package plus one `class-registry.ts` line.

Consequently, the landed Step-1 structures `RegistryFamily`, `REGISTRY_FAMILIES`,
`RAW_CLASS_FRAMES`, `REGISTRY_RULES`, and the global `registryFramesAt(family, pitch)` are
transitional, not final architecture. Move their data/policy into the owning class packages
and delete the parallel maps. The pitch-authoritative behaviour remains inside each class or
the shared constructor.

The Step-1 registry-key regression test is also transitional. When `RAW_CLASS_FRAMES` dies,
replace it with the adopted registry invariant over `LIBRARY_FAMILIES` and `CLASS_SPECS`; do
not retain a dead global map to keep its test alive. The exact-position 24/48/96 test remains.

### 5. Variant outline contract

The old `ClassVariant.corners` field and every old two-argument outline call are stale.

```ts
export interface OutlineRecipe {
  corners: CornerMode
  /** Square cap orientation for a single point; ignored for round points and paths. */
  pointRotationDeg?: number
}

export interface ClassVariant {
  id: string
  label: string
  accessibleLabel?: string
  frame: LibraryFrame
  view: LibraryTransform
  outline: OutlineRecipe
  selection: Pick<LibrarySelection, 'classId' | 'frameKey' | 'geometryId'>
}
```

Square singleton states `pointRotationDeg: 0`; diamond singleton states `45`. All sharp
multi-point variants can use the same recipe because point rotation is ignored for paths.
`boundaryOf` remains ordered concave topology only.

The one producer signature is:

```ts
outlineFromLayout(
  nodesMM: readonly PointMM[],
  recipe: OutlineRecipe,
  boundaryMM?: readonly PointMM[],
): PointMM[]
```

Replace every old test call such as `outlineFromLayout(nodes, 'sharp')` with
`outlineFromLayout(nodes, { corners: 'sharp' })`.

### 6. Catalogue declaration and materialisation

The old mutable `interface CatalogueEntry` is stale against LAW 0. Use the exact frozen V1
shape:

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

Catalogue output keeps `corners`, not the internal recipe. Exact replacements:

```ts
corners: variant.outline.corners

const boundaryMM = spec.boundaryOf?.(sel, placed.nodesMM)
const outlineMM = outlineFromLayout(placed.nodesMM, variant.outline, boundaryMM)
```

`pointRotationDeg` affects the already-materialised `outlineMM`; it is not a thirteenth public
field.

### 7. LAW 0 deliverables belong in Step 4, not Step 0

Step 4 must explicitly add and activate all five gates, not the old `toBeDefined` sweep:

- exact V1 type plus readonly declaration check;
- exact runtime keys on every entry;
- recursive data-only validation plus JSON round-trip;
- `CATALOGUE_FORMAT_VERSION = 1` plus a checked-in
  `src/lib/effect/__tests__/fixtures/catalogue-identity.v1.json` semantic manifest;
- finite classifier result plus `catalogueCandidates(...).some(id)` at 24/48/96.

The manifest freezes `id`, `classId`, `typeId`, `corners`, `frameCols`, `frameRows`, and
lexicographically sorted 48mm `nodesMM`. At all three pitches ids are unique and the id set is
the same. No cross-class disk dedupe.

### 8. Static gates

Delete every instruction to implement Block 6's regex source gates. The only winning gate is
the adopted TypeScript-AST import/export/dynamic-import resolver with the 9-zone matrix.

Likewise delete the bare-number scan, class-module count, broad retired-word scan and soft
line-count enforcement. Use constant ownership, registration invariants, the exact retired
token list, no React/Next/JSX in zones 0-6, and the AST tautology gate.

### 9. Historical adoption record

The adoption record's `boundaryOf` singleton mechanism is stale and conflicts with the
accepted `pointRotationDeg`. It must not remain in the builder's instruction set. Keep it only
as history; the consolidated build spec carries the winning mechanism.

### 10. Final status language

The matcher is compatibility, not engine consumption. No `solve.worker.ts` change belongs in
this build. Final report wording remains exactly:

```text
catalogue contract landed; runtime consumption pending
```

## Necessity / sufficiency

**Necessity — shrink:** two live planning files, not four layered instruction sources; merge
the scaffold/fix commits; delete temporary global class tables during the class-package step;
do not add a second public outline-recipe field to CatalogueEntry.

**Sufficiency — delivers in full:** the reconciled order covers the current proof defects,
acyclic portable class packages, one population and materialisation path, one outline producer,
the exact frozen/data-only/stable matcher contract, clean shell/bridge, and honest non-integration
status. No remaining old-proposal clause should be executable by reference.
