# [Codex][QA-REJECT] Whole layout-library audit

## Verdict

**QA-REJECT.** The current surface works, but the code does not yet conform to the stated architecture. The largest defect is not visual: registry classes and triangle still resolve pitch-dependent populations through different assembly contracts. The claimed portable engine spec is also not an enforced boundary, and no standard engine catalogue exists yet.

During the audit Dan pinned the technical destination more tightly: one `CatalogueEntry` record, one producer that derives an outline from the disk layout using the one built-in `RELEASED_PADDING_MM` and a `corners` qualifier, one flat catalogue export, with the old unit outlines / `aspect` / `boxMM` / registry-versus-geometry outline split deleted. Padding is not a per-entry or per-call option. I have evaluated the current code against that latest settled target too.

This is a whole-codebase verdict at the actual current head, not a diff review. The requested SHA was `6c3c15e6`; the clean branch and the process on 4046 advanced first to `a6e85cae` and then to `1fa641a5` during the audit. I read the later diffs and re-read both changed files in full. The latest commit imports the released padding constant into `class-spec.ts` and corrects the manufacturing-offset comment; it does not close any finding below. This verdict is against `1fa641a5`. QA changed no code.

## Independent gates

- Read every file in `src/lib/effect/library/`, the bridge, the panel, every library-specific part of the page, and the full 1,237-line test file.
- `91/91` library tests and `529/529` effect tests pass at the actual head. The brief's `528` count was correct at `6c3c15e6`; the later orientation test makes the current count `529`.
- `tsc --noEmit` clean. Scoped ESLint clean.
- Live fallback on 4046: PID 20467 serves this exact worktree at `1fa641a5`; one `.gl-body`, one `.gl-vp`. Square, rectangle, diamond and triangle tabs render on the shared surface; current Pyramid is a pointed three-corner triangle; no segmented control overflows; zero console/page errors. Evidence: `/tmp/s62-library-audit-1fa641a5.png`.

## What is right

- The panel and page contain no literal `triangle`/`square`/`rectangle`/`diamond` decision branch. All four tabs use the same `LibraryPanel` and the same Stage call site.
- The bridge is now genuinely conversion-only: it consumes materialised millimetre geometry and builds engine `Contour`/`GridResult`; it does not resolve a selection, transform nodes or choose an outline.
- Selection, authoring transitions and materialisation each have a named owner. The saved-draft identity counterexample is now covered and passes.
- The triangle corpus, D4 identity, population generation, exact three-line offset and draft validation are materially stronger than the original build. The exhaustive triangle outline sweep is meaningful.
- The empty frame-table sentinel was removed. `CLASS_FRAMES` is restricted to registry classes by type.

Those are real improvements. They do not close the findings below.

## F1 — HIGH: pitch-dependent population assembly still has two contracts

**Evidence.** Registry frames have `perimeter-96` composed once at 48mm: `frames.ts:13-23` calls `withSpacingModes`, and `rules.ts:127-135` hardcodes `48`. Registry `frameOf` ignores the requested pitch, then `layoutAt` repairs only that one layout later (`class-spec.ts:136-160`). Triangle does the opposite: `frameOf` creates `triangleFrame(geometry, pitchMM)` at the requested pitch and `layoutAt` is a no-op (`class-spec.ts:209-244`).

The mismatch is observable without editing code. For square 5x5 `perimeter-96`, `frameOf` returns 8 nodes at every pitch while the eventual materialiser returns 4 at 24mm, 8 at 48mm and 16 at 96mm. `panelOptions` receives the unresolved layout before `layoutAt` (`options.ts:117-123`), so the option/orientation layer can reason about a different population from the canvas. Existing registry shapes hide this because their orientations are symmetric or explicitly named; H/double-T will not.

This is the additional geometric-assembly divergence beyond the already-known stored-outline versus derived-hull outline rule.

**Verbatim minimal fix.** Make `frameOf(selection, pitchMM)` authoritative for every class and delete the repair hook:

```ts
// rules.ts
export function withSpacingModes(
  family: RegistryFamily, frame: LibraryFrame, pitchMM: number,
): LibraryFrame {
  const i = frame.layouts.findIndex((l) => l.name === SPACING_BASE)
  if (i < 0) return frame
  const nodes = REGISTRY_RULES[family].spacing96(frame, frame.layouts[i].nodes, pitchMM)
  if (!nodes.length) return frame
  const layouts = [...frame.layouts]
  layouts.splice(i + 1, 0, { name: SPACING_96, nodes })
  return { ...frame, layouts }
}

// frames.ts
export const registryFramesAt = (family: RegistryFamily, pitchMM: number): LibraryFrame[] =>
  RAW_CLASS_FRAMES[family].map((frame) => withSpacingModes(family, frame, pitchMM))

// registry spec
const frames = (pitchMM: number) => registryFramesAt(family, pitchMM)
const frameOf = (sel: LibrarySelection, pitchMM: number) => {
  const frame = frames(pitchMM).find((x) => frameKeyOf(x) === sel.frameKey)
  if (!frame) throw new Error('library: unknown frameKey ' + sel.frameKey)
  return frame
}
```

Then delete `ClassSpec.layoutAt`, the registry repair branch, the triangle no-op branch, and both calls to `layoutAt` in `materialize.ts` and `authoring.ts`. Add one counterexample test asserting the resolved and rendered 5x5 `perimeter-96` populations are the same at 24/48/96mm for every class.

## F2 — HIGH: the portable class seam is a central monolith, not a portable module contract

**Evidence.** `class-spec.ts` is 306 lines and imports the registry tables, shape table, triangle corpus, triangle geometry, triangle product taxonomy and triangle assembly (`class-spec.ts:15-29`). It contains both class factories, triangle chip-size calculation, triangle outline geometry, product labels, draft validation and the central registry (`class-spec.ts:127-306`). A fifth class is easiest to add by putting a third special factory in this file.

The advertised engine/admin split is decorative. `ClassSpec` contains product labels/variants, takes `LibrarySelection`, and includes draft validation (`class-spec.ts:64-82`). `ClassControls` is intersected back into it and `specOf` always returns the full `LibraryClass` (`class-spec.ts:84-108,298-306`). No production consumer requests the narrow `ClassSpec`; the engine bridge imports the materialiser, not this contract. The test named "engine-facing contract" only checks that `class-spec.ts` does not directly import `drafts.ts` (`grid-layout-library.test.ts:1114-1119`), so it cannot detect UI/admin members in the alleged engine contract.

`triangle-frames.ts` also has more than one job: product activation/retirement and grouping (`24-146`), population/frame assembly (`87-115`), draft-shape validation (`148-172`) and presentation orientation (`176-239`).

The latest commit exposes another split contract: triangle chip sizes use the imported fixed `RELEASED_PADDING_MM`, while `ClassSpec.outline` and both materialisers still accept an arbitrary `padMM`. The label and produced outline therefore have different padding inputs even though the comment says padding has one home (`class-spec.ts:66-79,189-205`; `materialize.ts:49-90`). The current locked 12mm UI hides it. Delete `padMM` from `ClassSpec.outline`, `materializeSelection`, `materializeDraft` and their callers; the one outline producer imports `RELEASED_PADDING_MM`. Chip size must measure that producer's output, not calculate through a separate padding argument.

**Verbatim minimal fix.** Move existing code; do not rewrite it or add a facade:

```text
class-spec.ts          interfaces + CLASS_SPECS + specOf only
registry-class.ts      registrySpec only
triangle-class.ts      triangleSpec only
outline.ts             the one disk-layout + corners + boundary outline producer
triangle-types.ts      product names + RETIRED/isActive/triangleTypeOf/trianglesOfType
triangle-frames.ts     triangleById/trianglePerimeter96/triangleFrame only
triangle-orientation.ts restsFlat/uprightView only
```

`triangle-class.ts` exports `triangleSpec` only; delete `hullOutlineMM` after the shared producer proves the same three-corner clearance. Each class module exports one object implementing the same contract; `class-spec.ts` registers objects and contains no triangle geometry, outline math or product labels. Move unaffected blocks verbatim first. This is the smallest structural change that prevents the next class from extending the monolith while obeying the one-producer ruling.

Also remove the remaining empty-outline sentinel. `LibraryShape` currently requires `outline`/`aspect`, so triangle is registered as `outline: []` (`types.ts:20-29`, `shapes.ts:5-10`) and a test blesses it (`grid-layout-library.test.ts:629-636`). Per Dan's settled catalogue target, delete `LIBRARY_SHAPES`, `LibraryShape.aspect` and `RegistryRules.boxMM`; do not move the unit outlines into another registry. The catalogue stores the generated millimetre layout-plus-outline pair, and every live outline comes from the same producer.

## F3 — HIGH: no standard engine catalogue exists; two aliases currently pretend it does

**Evidence.** `MaterializedLibrary` is a render/authoring record. It mixes stable geometry with `error` and `seedMM` (`materialize.ts:16-33`), omits stable product type, variant, selected view and pitch identity, and carries both `shapeId` and `declaredFamily`. It is not a catalogue row an engine classifier can enumerate or persist.

`libraryArrangement` and `libraryPreview` are identical wrappers around `materializeSelection` (`grid-magnet-library-bridge.ts:61-70`). Neither has a production caller; only the test file uses them. The preview comment says declared family is authoring-only, but `libraryArrangement` returns the same `declaredFamily` field. That is a direct comment/API contradiction.

The only library-to-engine family expectation is a local `ENGINE_FAMILY` map inside a test (`grid-layout-library.test.ts:72-78`). There is no production feed into `classifyShape` and no catalogue enumerator. Therefore the honest pipeline state is:

```text
selection -> class resolution -> nodes/outline mm -> Stage adapter    EXISTS
class catalogue -> standard records -> engine classifier             DOES NOT EXIST
```

**Verbatim minimal fix.** Delete the two test-only aliases now. Land the one record Dan specified, with one flat export and its real classifier consumer:

```ts
export interface CatalogueEntry {
  classId: LibraryFamily
  typeId: string
  id: string
  label: string
  pitchMM: number
  corners: 'round' | 'sharp' | 'bevel'
  nodesMM: readonly PointMM[]
  outlineMM: readonly PointMM[]
  widthMM: number
  heightMM: number
  frameCols: number
  frameRows: number
}

export function catalogue(pitchMM: number): readonly CatalogueEntry[]
```

`catalogue()` enumerates every class x type x variant through the same pitch-correct frame/materialisation path from F1 and the one built-in released padding. Keep preview-only `error`/`seedMM` in a separate `AuthoringPreview` type. Freeze the produced `{nodesMM, outlineMM}` pair for a shipped preset; keep the generator live for authoring. The engine integration test must call `classifyShape(entry.outlineMM, entry.pitchMM)` over every record; do not keep a test-local mapping as a substitute for a production contract.

### F3a — the one-producer plan is right, but current Clipper wiring and `nodesMM[]` alone are insufficient

The current `insetRingMM` cannot do the point/line cases the lead had just described. It returns `null` for fewer than three points and always calls Clipper with `EndType.Polygon` (`offset.ts:27-37`). Clipper2 itself supports a single point and open paths with round/square caps, but this wrapper does not expose them. Calling `convexHull(nodesMM)` also cannot generate H or double-T because it fills their notches.

The minimal producer input therefore needs one optional boundary order, not another per-class branch or a new recipe framework:

```ts
export function outlineFromLayout(
  nodesMM: readonly PointMM[],
  corners: 'round' | 'sharp' | 'bevel',
  boundaryMM?: readonly PointMM[],
): readonly PointMM[]
```

Default `boundaryMM` to the convex hull for current convex layouts; H/double-T supply their ordered concave boundary. One or two boundary points use Clipper's open-path end type, three or more use `EndType.Polygon`; every call uses `RELEASED_PADDING_MM`. A line becomes a pill, a point becomes a circle or square according to `corners`, and an ordered H/double-T boundary preserves its notch. `sharp` must not inherit the current miter-limit-2 clipping. The flat `CatalogueEntry` stores only the finished millimetre nodes/outline; boundary order is class-spec input, not engine output.

## F4 — MEDIUM: the page and panel are shared, but they are not clean shells and the Type layout differs by class

**Evidence.** The page resolves the selection, decides corpus versus saved/custom materialisation and chooses which identity to pass (`page.tsx:122-130`). It resolves again inside every family-tab map and again for `isDraft` (`page.tsx:355-360,445-463`). The panel imports and executes `panelOptions` itself (`LibraryPanel.tsx:9,35`) and changes the Type control from segmented row to chip grid when the class has more than three types (`LibraryPanel.tsx:45-50`). That is why triangle gets a different Type layout even though the standing rule says every tab uses the same UI layout.

No literal class name is hardcoded in either UI file; that part is clean. The remaining leak is state/domain orchestration, not class comparisons.

**Verbatim minimal fix.** Add one pure UI adapter and no class-specific hook:

```ts
export interface LibrarySurface {
  materialized: MaterializedLibrary
  options: PanelOptions
  isDraft: boolean
}

export function librarySurface(
  sel: LibrarySelection, drafts: readonly LibraryDraft[], edit: LibraryEdit | null,
  pitchMM: number,
): LibrarySurface {
  const resolved = resolveSelection(sel, drafts, pitchMM)
  const nodes = edit?.nodes ?? resolved.draft?.nodes
  return {
    materialized: nodes
      ? materializeDraft(sel, nodes, pitchMM)
      : materializeSelection(resolved.safeSel, pitchMM),
    options: panelOptions(sel, drafts, pitchMM),
    isDraft: resolved.draft !== null,
  }
}
```

The page calls this once and threads state/actions. `LibraryPanel` receives `options` and `isDraft`; it imports no resolver/options function. Render every Type block with the same class (`gl-lib` or one agreed common class) and delete `opts.types.length > 3 ? ...`. Event handlers and React state remain in the shell; selection/materialisation decisions do not.

## F5 — MEDIUM: stale documentation and a non-proving test remain in the supposedly conformance-clean suite

**Evidence.** Confirmed current drift includes:

- `types.ts:36` still advertises deleted `prim:<name>` selections.
- `drafts.ts:19` names deleted `LAYOUT_LIBRARY`.
- `corpus-triangle.ts:5-6` claims the retired Peak/Wedge/Sail 14/17/48 catalogue.
- `triangle-frames.ts:195-197` still says ten types; current product has six.
- `rules.ts:1-2` claims a classifier bridge shares these rules; none does.
- `class-spec.ts:7-13` says the engine bridge asks the spec and every member is an existing function by reference; neither is true now.
- The test-file header still promises primitive-removal coverage (`grid-layout-library.test.ts:1-3`). Test names/comments still say Peak and Sail (`562,589,725`) after those names were retired.

The test `"a node on an edge or inside leaves the outline unchanged; one outside changes it"` (`grid-layout-library.test.ts:638-651`) never calls the outline with the changed population. It only asserts that a canonical triangle ID changed. For the first Wedge it moves `[0,0]` onto `[0,1]`, creating a duplicate point, so it does not even represent the valid changed triangle named by the title. An outline regression cannot make this test fail.

`libraryIntegrity()` says the library/corpus checks itself but iterates only `CLASS_FRAMES` (`integrity.ts:1-31`); triangle is excluded. Its test title presents the result as whole-library integrity (`grid-layout-library.test.ts:118-121`).

**Verbatim minimal fix.** Replace the non-test with a valid materialised counterexample:

```ts
it('moving one corner changes the derived triangle outline', () => {
  const selection = triSel('tri:0,0;0,2;2,0', 'corners')
  const before = materializeDraft(selection, [[0, 0], [0, 2], [2, 0]], 48)
  const after = materializeDraft(selection, [[0, 0], [0, 2], [2, 1]], 48)
  expect(before.error).toBeNull()
  expect(after.error).toBeNull()
  expect(after.outlineMM).not.toEqual(before.outlineMM)
})
```

Rename `libraryIntegrity` to `registryIntegrity` unless it actually aggregates every class. Remove the stale text listed above; keep only present-tense contracts and invariants. After each deletion, grep the retired concept across library, bridge and tests. Add the F1 24/48/96 resolved-versus-rendered counterexample; that is the conformance test currently missing.

## F6 — LOW: the public surface and mutability are wider than the actual product

**Evidence.** `library/index.ts:3-18` wildcard-exports all 16 implementation modules. Production has only three barrel consumers: the page, panel and bridge. `kindOf` and `orientationOf` have no production caller. `libraryArrangement` and `libraryPreview` have no production caller. `CLASS_SPECS` and `hullOutlineMM` do not need to be public. Test convenience has become public API.

The corpus comments say literal data is never mutated, but `LibraryFrame.layouts`, `SQUARE_FRAMES`, `RECTANGLE_FRAMES`, `DIAMOND_FRAMES`, `LIBRARY_SHAPES` and rule arrays are mutable exports (`types.ts:3-5`; corpus declarations; `shapes.ts:5`; `rules.ts:89`). The type system does not enforce the claim.

**Verbatim minimal fix.** Replace the wildcard barrel with the exact runtime surface:

```ts
export { LIBRARY_FAMILIES } from './types'
export type { LibraryFamily, LibrarySelection } from './types'
export { DRAFT_STORE_KEY } from './drafts'
export type { LibraryDraft } from './drafts'
export { startAdd, startEdit, saveEdit, deleteEdit, toggleNodeAt } from './authoring'
export type { LibraryEdit } from './authoring'
export { panelOptions, selectionForFamily } from './options'
export type { PanelOption, PanelOptions } from './options'
export { resolveSelection } from './selection'
export { materializeSelection, materializeDraft } from './materialize'
export type { MaterializedLibrary } from './materialize'
```

Tests import internal owners directly. Delete `kindOf`, `orientationOf`, the duplicate bridge aliases, and unnecessary exports on `CLASS_SPECS`/`hullOutlineMM`. Make corpus interfaces and arrays readonly (`readonly layouts`, `readonly nodes`, `as const satisfies readonly ...[]`).

## Forward-readiness verdict

- **Circle/oval/pill:** Clipper2 can produce them from a point/open path with round caps, but the current wrapper cannot; it is closed-polygon-only.
- **H/double-T:** a convex hull cannot represent them. The shared producer needs an explicit ordered concave boundary, not a class special case and not nodes alone.
- **Adding them cleanly:** not yet. A class is registered across parallel tables in `types.ts`, `shapes.ts`, `frames.ts`, `rules.ts`, `class-spec.ts` and hardcoded tests. The central class-spec and stale sentinel make another special case easy.
- **Same geometric assembly:** not yet. Even before the known outline-source difference, registry and triangle disagree on when a pitch-dependent population becomes authoritative (F1).
- **Engine catalogue:** absent. Selection-to-mm geometry exists; catalogue enumeration and classifier consumption do not (F3).

Do not add the new entries until F1-F3a are closed. Otherwise circle/oval/pill/H will harden the current seams and force another structural rewrite immediately afterward.

## Necessity / sufficiency

**Necessity — shrink:** the result still carries unnecessary public exports, two identical bridge aliases, two production-dead taxonomy helpers, an empty-outline sentinel and historical comment/test residue. F6 and the deletion portions of F2/F5 are required subtraction, not optional cleanup.

**Sufficiency — partial:** the library visibly works for the four current classes, but it does not yet deliver the full directive: one authoritative population-assembly path, a clean shell/page, portable per-class modules, and one standard catalogue consumed by the engine are missing. Therefore no QA clear.
