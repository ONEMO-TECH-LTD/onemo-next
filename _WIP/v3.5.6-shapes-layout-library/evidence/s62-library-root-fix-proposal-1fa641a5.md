# [Codex][SOLUTION] Root-fix patch contract for the layout library

Target: `1fa641a5`. This is a code prescription, not another verdict. Lead must verify each block against the current source, implement only where it still applies, and counter/reject with a failing proof if a smaller complete method exists.

## Counter to the proposed order

Do not land the catalogue before the outline convergence. A catalogue created while registry classes still use stored unit outlines and triangle uses `hullOutlineMM` freezes the split into the new public format.

Smallest complete order:

1. Make frames pitch-authoritative; delete `layoutAt`.
2. Land one outline producer and the fixed-padding contract; delete stored outlines, `aspect`, `boxMM`, and triangle-only outline math.
3. Move the two class implementations out of `class-spec.ts`; delete `LIBRARY_SHAPES` and use `classId` directly.
4. Emit `CatalogueEntry[]`, add the real classifier consumer, and move the UI to one resolved surface.
5. Delete aliases, wildcard exports, stale comments and the non-test.

No new circle/H entries until 1-4 pass. Otherwise the new entries become migration fixtures.

## 1. One pitch-authoritative population

### `library/rules.ts`

Replace `withSpacingModes` with:

```ts
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
```

### `library/frames.ts`

Replace the composed singleton with raw immutable data plus a pitch factory:

```ts
export const RAW_CLASS_FRAMES = {
  square: SQUARE_FRAMES,
  rectangle: RECTANGLE_FRAMES,
  diamond: DIAMOND_FRAMES,
} satisfies Record<RegistryFamily, readonly LibraryFrame[]>

export const registryFramesAt = (
  family: RegistryFamily, pitchMM: number,
): LibraryFrame[] => RAW_CLASS_FRAMES[family].map((frame) =>
  withSpacingModes(family, frame, pitchMM),
)
```

Delete `compose` and `CLASS_FRAMES`.

Make `LibraryFrame.layouts` readonly and type every corpus as `as const satisfies readonly LibraryFrame[]`; `registryFramesAt` remains the only place that creates a derived layout list.

### Registry class implementation

Use the requested pitch everywhere:

```ts
const frames = (pitchMM: number) => registryFramesAt(family, pitchMM)

const frameOf = (sel: LibrarySelection, pitchMM: number): LibraryFrame => {
  const frame = frames(pitchMM).find((x) => frameKeyOf(x) === sel.frameKey)
  if (!frame) throw new Error('library: unknown frameKey ' + sel.frameKey)
  return frame
}

// object members
typeOf: (sel, pitchMM) => subOf(frameOf(sel, pitchMM)),
variants: (typeId, pitchMM) => frames(pitchMM)
  .filter((frame) => subOf(frame) === typeId)
  .map(asVariant),
open: (current, pitchMM) => {
  const first = frames(pitchMM)[0]
  return {
    ...current,
    shapeId: family,
    geometryId: undefined,
    frameKey: frameKeyOf(first),
    layoutId: pickLayoutName(first, 'perimeter'),
  }
},
```

Delete `ClassSpec.layoutAt`, both implementations, and both downstream repairs:

```ts
// authoring.ts
const source = draft?.nodes ?? layout.nodes

// materialize.ts
const placed = place(frame, layout, sel.view, pitchMM)
```

This makes resolver, panel, authoring and canvas consume the same population instead of repairing it at the last moment.

## 2. One outline producer; one padding source

### `offset.ts`

Keep `insetRingMM` backward compatible for its other callers. Extract the generic capability it currently hides:

```ts
export type OffsetEnd = 'polygon' | 'round' | 'square'

const joinTypeOf = (join: OffsetJoin): JoinType =>
  join === 'sharp' ? JoinType.Miter
    : join === 'bevel' ? JoinType.Bevel
      : JoinType.Round

const endTypeOf = (end: OffsetEnd): EndType =>
  end === 'polygon' ? EndType.Polygon
    : end === 'round' ? EndType.Round
      : EndType.Square

export function offsetPathMM(
  pathMM: ReadonlyArray<Pt>, deltaMM: number,
  join: OffsetJoin, end: OffsetEnd,
): Pt[] | null {
  if (!pathMM.length) return null
  const flat: number[] = []
  for (const [x, y] of pathMM)
    flat.push(Math.round(x * SCALE), Math.round(y * SCALE))

  const paths = Clipper.inflatePaths(
    [Clipper.makePath(flat)],
    deltaMM * SCALE,
    joinTypeOf(join),
    endTypeOf(end),
    // `sharp` means no bevel fallback. Degenerate paths are rejected by the class validator.
    join === 'sharp' ? Number.MAX_SAFE_INTEGER : 2,
    MANUFACTURING_OFFSET_ARC_TOLERANCE_MM * SCALE,
  )
  if (!paths.length) return null
  let best = paths[0]
  for (const path of paths)
    if (Math.abs(Clipper.area(path)) > Math.abs(Clipper.area(best))) best = path
  return best.length < 3 ? null : best.map((p) => [p.x / SCALE, p.y / SCALE] as Pt)
}

export function insetRingMM(
  ringMM: ReadonlyArray<Pt>, deltaMM: number, join: OffsetJoin = 'round',
): Pt[] | null {
  if (ringMM.length < 3) return null
  return offsetPathMM(ringMM, deltaMM, join, 'polygon')
}
```

### `library/geometry.ts`

Move `convexHull` verbatim out of `triangle-geometry.ts`. A shared outline producer must not import a triangle module.

### New `library/outline.ts`

```ts
import { RELEASED_PADDING_MM } from '../grid-magnet-spec'
import { offsetPathMM } from '../offset'
import { convexHull } from './geometry'
import type { CornerMode, PointMM } from './types'

export function outlineFromLayout(
  nodesMM: readonly PointMM[],
  corners: CornerMode,
  boundaryMM?: readonly PointMM[],
): PointMM[] {
  const path = boundaryMM?.length ? [...boundaryMM] : convexHull(nodesMM)
  if (!path.length) throw new Error('library: empty population has no outline')
  const end = path.length >= 3 ? 'polygon' : corners === 'round' ? 'round' : 'square'
  const outline = offsetPathMM(path, RELEASED_PADDING_MM, corners, end)
  if (!outline) throw new Error('library: population has no outline')
  return outline
}
```

`boundaryMM` is topology, not a second outline algorithm. Current convex classes omit it. H/double-T provide one ordered concave boundary from their class module. The producer still owns the only offset.

Independent probe of the exact Clipper settings above at 12mm: point+round produced a 49-point 23.975×23.988 ring; a 48mm line+round produced 71.994×24; the 48×192 acute triangle stayed exactly 3 vertices; the concave H stayed 12 vertices at 168×168. Therefore round-size tests use manufacturing tolerance, not exact floating equality.

Delete:

- `LibraryShape.outline`
- `LibraryShape.aspect`
- `RegistryRules.boxMM`
- `boxByClassFloor`
- `hullOutlineMM`
- every `padMM` argument on `ClassSpec.outline`, materialisers, bridge and page

The bridge uses the fixed constant directly:

```ts
spotRadiusMM: spotRadiusOf(RELEASED_PADDING_MM),
```

Triangle chip size must measure `outlineFromLayout(mm, 'sharp')`; it must not run separate outline maths.

## 3. A real modular class contract

### `library/types.ts`

```ts
export type PointMM = readonly [number, number]
export type CornerMode = 'round' | 'sharp' | 'bevel'

export interface LibrarySelection {
  classId: LibraryFamily
  frameKey: string
  layoutId: string
  geometryId?: string
  view: LibraryTransform
}

export const DEFAULT_LIBRARY_SELECTION: LibrarySelection = {
  classId: 'square', frameKey: '3x3', layoutId: 'perimeter',
  view: { transpose: false, flipX: false, flipY: false },
}
```

Delete `LibraryShapeId`, `LibraryShape`, `LIBRARY_SHAPES`, `shapeId`, and `declaredFamily`. They describe the same identity twice and force the empty triangle outline sentinel.

### `library/class-spec.ts`

This file contains interfaces and registration only:

```ts
import { registryClass } from './registry-class'
import { triangleClass } from './triangle-class'
import type { LibraryFamily } from './types'

const CLASS_SPECS: Record<LibraryFamily, LibraryClass> = {
  square: registryClass('square'),
  rectangle: registryClass('rectangle'),
  diamond: registryClass('diamond'),
  triangle: triangleClass,
}

export const specOf = (classId: LibraryFamily): LibraryClass => CLASS_SPECS[classId]
```

Move, do not rewrite:

```text
registry-class.ts       registryClass and shared bounds/duplicate validation
triangle-class.ts       triangleClass only
triangle-types.ts       product grouping/names/activation only
triangle-frames.ts      population and frame assembly only
triangle-orientation.ts restsFlat/uprightView only
```

Each variant carries the complete geometry choice needed by both catalogue and admin. This lets the catalogue avoid `ClassControls.open/select`, and deletes the duplicated `frameOf`/`variantIdOf` lookup:

```ts
export interface ClassVariant {
  id: string
  label: string
  accessibleLabel?: string
  frame: LibraryFrame
  view: LibraryTransform
  corners: CornerMode
  selection: Pick<LibrarySelection, 'classId' | 'frameKey' | 'geometryId'>
}

export interface ClassSpec {
  classId: LibraryFamily
  types: readonly ClassType[]
  variants(typeId: string, pitchMM: number): readonly ClassVariant[]
  variantOf(sel: LibrarySelection, pitchMM: number): ClassVariant
  boundaryOf?: (
    sel: LibrarySelection,
    nodesMM: readonly PointMM[],
  ) => readonly PointMM[] | undefined
  validateDraft(draft: DraftShape, frame: LibraryFrame): string[]
}
```

Registry variants set `selection: { classId, frameKey }`; triangle variants additionally set `geometryId`. `variantOf` is fail-loud and is the one lookup used by selection, materialisation and authoring. Delete `ClassSpec.frameOf`, `ClassControls.variantIdOf`, and the per-class `select` functions. Implement the two lookups as follows:

```ts
// registry-class.ts
const asVariant = (frame: LibraryFrame): ClassVariant => ({
  id: frameKeyOf(frame), label: rules.label(frame.cols, frame.rows),
  frame, view: NO_VIEW, corners: 'sharp',
  selection: { classId: family, frameKey: frameKeyOf(frame) },
})

const variantOf = (sel: LibrarySelection, pitchMM: number): ClassVariant => {
  const found = frames(pitchMM).map(asVariant).find((v) => v.id === sel.frameKey)
  if (!found) throw new Error('library: unknown frameKey ' + sel.frameKey)
  return found
}

// triangle-class.ts
const variantOf = (sel: LibrarySelection, pitchMM: number): ClassVariant => {
  const triangle = geoOf(sel)
  const group = trianglesOfType(triangleTypeOf(triangle))
  const index = group.findIndex((x) => x.id === triangle.id)
  const found = asVariant(triangle, pitchMM, index)
  if (sel.frameKey !== frameKeyOf(found.frame))
    throw new Error('library: frameKey ' + sel.frameKey + ' does not match geometry ' + triangle.id)
  return found
}
```

Triangle `asVariant` sets `corners: 'sharp'` and `selection: { classId: 'triangle', frameKey: frameKeyOf(frame), geometryId: triangle.id }`.

The generic admin transition is:

```ts
export const selectVariant = (
  current: LibrarySelection, variant: ClassVariant,
): LibrarySelection => ({
  ...current, ...variant.selection,
  layoutId: pickLayout(variant.frame, current.layoutId),
  view: { ...variant.view },
})
```

The remaining admin navigation members stay in `ClassControls`; the engine never imports them. `CatalogueEntry` below is the portable engine boundary.

### `library/selection.ts`

Delete `shapeOf`. Resolution starts from the selection's class:

```ts
const spec = specOf(sel.classId)
const variant = spec.variantOf(sel, pitchMM)
const frame = variant.frame
```

Return `spec` and `variant`, not a `LibraryShape`. Update options/authoring/materialisation to use those returned objects. No caller searches a parallel shape table.

## 4. Standard catalogue and one engine consumer

### New `library/catalogue.ts`

```ts
export interface CatalogueEntry {
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
}

const bounds = (points: readonly PointMM[]) => {
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y)
  return {
    widthMM: Math.max(...xs) - Math.min(...xs),
    heightMM: Math.max(...ys) - Math.min(...ys),
  }
}

const entryId = (...parts: string[]) => parts.map(encodeURIComponent).join('/')

export function catalogue(pitchMM: number): readonly CatalogueEntry[] {
  const out: CatalogueEntry[] = []
  for (const classId of LIBRARY_FAMILIES) {
    const spec = specOf(classId)
    for (const type of spec.types) for (const variant of spec.variants(type.id, pitchMM)) {
      for (const layout of variant.frame.layouts) {
        const sel: LibrarySelection = {
          ...DEFAULT_LIBRARY_SELECTION,
          ...variant.selection,
          layoutId: layout.name,
          view: { ...variant.view },
        }
        const m = materializeSelection(sel, pitchMM)
        const size = bounds(m.outlineMM)
        out.push({
          classId, typeId: type.id,
          id: entryId(classId, type.id, variant.id, layout.name),
          label: variant.accessibleLabel ?? `${type.label} · ${variant.label} · ${layout.name}`,
          pitchMM, corners: variant.corners,
          nodesMM: m.nodesMM, outlineMM: m.outlineMM,
          ...size, frameCols: m.frameCols, frameRows: m.frameRows,
        })
      }
    }
  }
  return out
}
```

`materializeSelection` must call exactly:

```ts
const boundaryMM = spec.boundaryOf?.(sel, placed.nodesMM)
const outlineMM = outlineFromLayout(placed.nodesMM, variant.corners, boundaryMM)
```

### New engine-side consumer `grid-magnet-library-catalogue.ts`

```ts
import { catalogue } from './library'
import { classifyShape, shapeFamilyOf } from './grid-magnet-class'
import type { Pt } from './types'

export const classifiedLibraryCatalogue = (pitchMM: number) =>
  catalogue(pitchMM).map((entry) => {
    const outer = entry.outlineMM.map(([x, y]) => [x, y] as Pt)
    return {
      entry,
      frameClass: classifyShape(outer, entry.pitchMM),
      shapeFamily: shapeFamilyOf(outer),
    }
  })

export function catalogueCandidates(outer: readonly Pt[], pitchMM: number) {
  const targetFrame = classifyShape(outer, pitchMM)
  const targetFamily = shapeFamilyOf(outer)
  return classifiedLibraryCatalogue(pitchMM).filter(({ frameClass, shapeFamily }) =>
    shapeFamily === targetFamily
      && frameClass.cx === targetFrame.cx
      && frameClass.cy === targetFrame.cy,
  )
}
```

Delete the test-local `ENGINE_FAMILY` substitute. If product class IDs and classifier families intentionally differ, store the classifier result beside the entry; do not pretend equality.

`classifiedLibraryCatalogue()` alone is only a production-shaped helper. The catalogue is not **fed into the engine** until the positioning pipeline consumes `catalogueCandidates()` as its offer population. The current `solve.worker.ts` still enumerates `wrapBandLadder()` independently. Do not claim engine integration merely because the matcher exists or because a test calls it. When the Step-1 offer contract is authorised, the replacement point is that branch: classify once, take `catalogueCandidates(outer, pitchMM)`, and enumerate those entries instead of rebuilding an unrelated population. Until then report `catalogue contract landed; runtime consumption pending`.

## 5. Clean shell and conversion-only bridge

### New `library/surface.ts`

```ts
export interface LibrarySurface {
  classId: LibraryFamily
  materialized: MaterializedLibrary
  options: PanelOptions
  isDraft: boolean
}

export function librarySurface(
  sel: LibrarySelection,
  drafts: readonly LibraryDraft[],
  edit: LibraryEdit | null,
  pitchMM: number,
): LibrarySurface {
  const resolved = resolveSelection(sel, drafts, pitchMM)
  const nodes = edit?.nodes ?? resolved.draft?.nodes
  return {
    classId: resolved.spec.classId,
    materialized: nodes
      ? materializeDraft(sel, nodes, pitchMM)
      : materializeSelection(resolved.safeSel, pitchMM),
    options: panelOptions(sel, drafts, pitchMM),
    isDraft: resolved.draft !== null,
  }
}
```

### Bridge

It accepts geometry; it does not create it:

```ts
export function libraryStageModel(
  materialized: MaterializedLibrary, pitchMM: number,
): LibraryStageModel {
  return toStage(materialized, pitchMM)
}
```

Delete `draftStageModel`, `libraryArrangement`, `libraryPreview`, and both materialiser imports from the bridge.

### Page and panel

The page computes one surface and passes it down:

```ts
const library = useMemo(() => tab === 'library'
  ? librarySurface(librarySel, drafts, edit, pitch)
  : null,
  [tab, librarySel, drafts, edit, pitch],
)

const libraryModel = useMemo(() => library
  ? libraryStageModel(library.materialized, pitch)
  : null,
  [library, pitch],
)
```

Family-tab active state is `library?.classId === classId`. `isDraft` is `library?.isDraft`. The page imports neither resolver nor materialiser.

`LibraryPanel` receives `options: PanelOptions`; delete its `sel`, `drafts`, `pitch` props and its `panelOptions` import. Every Type block uses one class:

```tsx
<div className="gl-lib gl-libtypes">
  {options.types.map(/* existing button mapping */)}
</div>
```

Responsive wrapping belongs to `.gl-libtypes`; never switch markup from option count.

## 6. Removal-failing proof gates

Add these before calling the rework complete:

```ts
it.each([24, 48, 96])('resolved population is rendered verbatim at %imm', (pitchMM) => {
  for (const classId of LIBRARY_FAMILIES) {
    const spec = specOf(classId)
    for (const type of spec.types) for (const variant of spec.variants(type.id, pitchMM))
      for (const layout of variant.frame.layouts) {
        const selected: LibrarySelection = {
          ...DEFAULT_LIBRARY_SELECTION, ...variant.selection,
          layoutId: layout.name, view: { ...variant.view },
        }
        const transformed = transformLayout(variant.frame, layout, selected.view)
        const expected = transformed.nodes.map(([x, y]) =>
          [x * pitchMM, (transformed.rows - 1 - y) * pitchMM],
        )
        expect(materializeSelection(selected, pitchMM).nodesMM).toEqual(expected)
      }
  }
})

it('one outline producer handles point, line, convex, acute and concave inputs', () => {
  const sizeOf = (points: readonly PointMM[]) => {
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y)
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
  }
  const h: PointMM[] = [
    [0, 0], [48, 0], [48, 48], [96, 48], [96, 0], [144, 0],
    [144, 144], [96, 144], [96, 96], [48, 96], [48, 144], [0, 144],
  ]
  const acute: PointMM[] = [[0, 0], [0, 192], [48, 0]]
  const circle = sizeOf(outlineFromLayout([[0, 0]], 'round'))
  const pill = sizeOf(outlineFromLayout([[0, 0], [48, 0]], 'round'))
  expect(circle[0]).toBeCloseTo(24, 1); expect(circle[1]).toBeCloseTo(24, 1)
  expect(pill[0]).toBeCloseTo(72, 1); expect(pill[1]).toBeCloseTo(24, 1)
  expect(outlineFromLayout(acute, 'sharp')).toHaveLength(3)
  expect(outlineFromLayout(h, 'sharp', h).length).toBeGreaterThan(4)
})

it.each([24, 48, 96])('the engine consumes every catalogue entry at %imm', (pitchMM) => {
  const entries = catalogue(pitchMM)
  expect(entries.length).toBeGreaterThan(0)
  for (const entry of entries) {
    const outer = entry.outlineMM.map(([x, y]) => [x, y] as Pt)
    expect(classifyShape(outer, entry.pitchMM)).toBeDefined()
    expect(entry.widthMM).toBeGreaterThan(0)
    expect(entry.heightMM).toBeGreaterThan(0)
  }
})
```

Also retain the exhaustive triangle clearance sweep, but route it through `outlineFromLayout`; that proves the shared producer did not reintroduce clipped corners.

Source gates:

```ts
expect(read(PAGE)).not.toMatch(/resolveSelection|materialize|panelOptions|specOf/)
expect(read(PANEL)).not.toMatch(/panelOptions|resolveSelection|specOf|types\.length/)
expect(read(BRIDGE)).not.toMatch(/materialize|resolveSelection|specOf/)
expect(allLibrarySource).not.toMatch(/LIBRARY_SHAPES|\.aspect|boxMM|hullOutlineMM|layoutAt/)
```

Replace the non-proving triangle test with the valid before/after materialisation counterexample from the QA report. Rename `libraryIntegrity` to `registryIntegrity` or extend it across `catalogue()`; do not keep a whole-library name for a registry-only check.

## 7. Final public surface

Replace wildcard exports with runtime contracts only:

```ts
export type { CornerMode, LibraryFamily, LibrarySelection } from './types'
export { DEFAULT_LIBRARY_SELECTION, LIBRARY_FAMILIES } from './types'
export type { CatalogueEntry } from './catalogue'
export { catalogue } from './catalogue'
export type { LibrarySurface } from './surface'
export { librarySurface } from './surface'
export type { PanelOption, PanelOptions } from './options'
export { selectionForFamily } from './options'
export type { LibraryEdit } from './authoring'
export { startAdd, startEdit, saveEdit, deleteEdit, toggleNodeAt } from './authoring'
export type { LibraryDraft } from './drafts'
export { DRAFT_STORE_KEY } from './drafts'
export type { MaterializedLibrary } from './materialize'
```

Tests import internal owners by direct file path. Delete `kindOf`, `orientationOf`, the bridge aliases, public `CLASS_SPECS`, and the retired primitive/applicability comments.

## Necessity / sufficiency

**Necessity — no extra framework:** this moves existing class code, adds only the missing shared producer/catalogue/surface contracts, and deletes the parallel tables, repair hook, aliases and wildcard surface that caused the findings.

**Sufficiency — library full, runtime feed explicitly gated:** this delivers one pitch-correct population, one fixed-padding outline producer, modular class-owned policy, one shared UI surface, one flat catalogue, and a production classifier matcher. The engine-feed directive remains partial until the authorised Step-1 positioning branch actually consumes that matcher; an uncalled helper or test is not completion. After that wiring, new shapes are data/class modules without UI, page, bridge or producer branches.
