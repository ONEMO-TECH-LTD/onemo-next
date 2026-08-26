// library/selection.ts — WHAT AM I POINTING AT. The single owner of selection resolution and
// of the draft-id convention. Both were re-implemented in the page and the panel; the page's
// copy guessed where this one is explicit, which is how a stale cross-class selection took the
// tab down (diamond had no 'perimeter', 08-25).

import { CLASS_FRAMES } from './frames'
import { CLASS_RULES, type ClassRules, type RegistryRules } from './rules'
import { triangleById, triangleFrame, triangleFrameKey, trianglesOf, triangleFrameKeys, triangleTypeOf, uprightView } from './triangle-frames'
import { TRIANGLE_LAYOUTS } from './corpus-triangle'
import { boundsOf, type TriangleLayout, type TriangleProductType } from './triangle-geometry'
import { transformLayout, viewName } from './transforms'
import { LIBRARY_SHAPES } from './shapes'
import { frameKeyOf } from './transforms'
import type { LibraryDraft } from './drafts'
import type { LibraryFamily, LibraryFrame, LibraryLayout, LibrarySelection, LibraryShape, LibraryTransform } from './types'

/** A hand-authored layout is named in a selection as 'draft:<name>'. One place, one spelling. */
export const DRAFT_PREFIX = 'draft:'
export const draftLayoutId = (name: string): string => DRAFT_PREFIX + name
export const isDraftLayout = (layoutId: string): boolean => layoutId.startsWith(DRAFT_PREFIX)
export const draftNameOf = (layoutId: string): string => layoutId.slice(DRAFT_PREFIX.length)

/** The layout a frame should land on: the preferred name when it carries it, else its first. */
export function pickLayout(frame: LibraryFrame, preferred: string): string {
  return frame.layouts.some((l) => l.name === preferred) ? preferred : frame.layouts[0].name
}

/** STRICT — the pipeline's resolver. An unknown ID is an error, never a silent retarget to
 *  unrelated data (QA F3): stable IDs exist precisely so a stale identity cannot lie. */
export function selectedRecords(sel: LibrarySelection, pitchMM = 48): {
  shape: LibraryShape
  frame: LibraryFrame
  layout: LibraryLayout
} {
  const shape = LIBRARY_SHAPES.find((x) => x.id === sel.shapeId)
  if (!shape) throw new Error('library: unknown shapeId ' + sel.shapeId)
  if (CLASS_RULES[shape.family].source === 'geometry') {
    const geo = triangleById(geometryOf(sel))
    const frame = triangleFrame(geo, pitchMM)
    assertFrameKey(sel, geo.id, frame)
    const layout = frame.layouts.find((l) => l.name === sel.layoutId)
    if (!layout) throw new Error('library: unknown layoutId ' + sel.layoutId + ' in ' + sel.frameKey)
    return { shape, frame, layout }
  }
  const frame = CLASS_FRAMES[shape.family].find((f) => frameKeyOf(f) === sel.frameKey)
  if (!frame) throw new Error('library: unknown frameKey ' + sel.frameKey)
  const layout = frame.layouts.find((l) => l.name === sel.layoutId)
  if (!layout) throw new Error('library: unknown layoutId ' + sel.layoutId + ' in ' + sel.frameKey)
  return { shape, frame, layout }
}

/** The frame a geometry carries is not a matter of opinion: a selection that names a different
 *  one is a caller bug, exactly as an unknown frame is for the registry classes. Every
 *  module-owned transition already produces the truthful key. */
function assertFrameKey(sel: LibrarySelection, geometryId: string, frame: LibraryFrame): void {
  const actual = frameKeyOf(frame)
  if (sel.frameKey !== actual)
    throw new Error('library: frameKey ' + sel.frameKey + ' does not match geometry ' + geometryId + ' (' + actual + ')')
}

/** The geometry a triangle selection names — fail loud, never a silent first record. */
export function geometryOf(sel: LibrarySelection): string {
  if (!sel.geometryId) throw new Error('library: triangle selection carries no geometryId')
  return sel.geometryId
}

/** The first geometry of a product type — what a type tab lands on. */
export const firstGeometryOf = (type: TriangleProductType): TriangleLayout =>
  TRIANGLE_LAYOUTS.filter((x) => triangleTypeOf(x) === type)[0]

export interface ResolvedSelection {
  shape: LibraryShape
  frame: LibraryFrame
  /** A selection whose layout certainly exists on the frame — what the bridge is handed. */
  safeSel: LibrarySelection
  /** The corpus layout that selection names. */
  layout: LibraryLayout
  /** The hand-authored layout the selection names, when it names one that exists. */
  draft: LibraryDraft | null
}

/** The authoring view's resolver. It tolerates exactly ONE thing: a layout name the frame does
 *  not carry, because the admin deliberately carries a layout across frames and classes and
 *  every transition helper normalises it with pickLayout. Shape and frame are NOT guessed —
 *  an unknown one is a bug in the caller, and guessing produced a 'safe' selection that still
 *  threw when the pipeline resolved it (QA F4). Drafts match on class AND frame AND name. */
export function resolveSelection(
  sel: LibrarySelection, drafts: readonly LibraryDraft[] = [], pitchMM = 48,
): ResolvedSelection {
  const shape = LIBRARY_SHAPES.find((x) => x.id === sel.shapeId)
  if (!shape) throw new Error('library: unknown shapeId ' + sel.shapeId)
  // The triangle's frame IS its geometry: one materialised frame, not a registry lookup.
  if (CLASS_RULES[shape.family].source === 'geometry') {
    const geo = triangleById(geometryOf(sel))
    const frame = triangleFrame(geo, pitchMM)
    assertFrameKey(sel, geo.id, frame)
    const frameKey = frameKeyOf(frame)
    const wantsDraft = isDraftLayout(sel.layoutId)
    const draft = wantsDraft
      ? drafts.find((d) => d.className === 'triangle' && d.frameKey === frameKey
          && d.geometryId === geo.id && d.name === draftNameOf(sel.layoutId)) ?? null
      : null
    const layoutId = wantsDraft ? frame.layouts[0].name : pickLayout(frame, sel.layoutId)
    const layout = frame.layouts.find((l) => l.name === layoutId)!
    return { shape, frame, safeSel: { ...sel, frameKey, layoutId }, layout, draft }
  }
  const frames = CLASS_FRAMES[shape.family]
  const frame = frames.find((f) => frameKeyOf(f) === sel.frameKey)
  if (!frame) throw new Error('library: unknown frameKey ' + sel.frameKey)
  const frameKey = frameKeyOf(frame)
  const wantsDraft = isDraftLayout(sel.layoutId)
  const draft = wantsDraft
    ? drafts.find((d) => d.className === shape.family && d.frameKey === frameKey
        && d.name === draftNameOf(sel.layoutId)) ?? null
    : null
  const layoutId = wantsDraft ? frame.layouts[0].name : pickLayout(frame, sel.layoutId)
  const layout = frame.layouts.find((l) => l.name === layoutId)!
  return { shape, frame, safeSel: { ...sel, frameKey, layoutId }, layout, draft }
}

/** THE PANEL'S OPTIONS — every control the library offers for a selection, already normalised.
 *  The view maps these to buttons; it never asks what class it is looking at (Dan, 08-25:
 *  "no fucking logic in the ui either"). Each option carries the selection it produces. */
export interface PanelOption {
  id: string
  /** What the control reads. Product labels are the module's to decide, not the view's. */
  label: string
  active: boolean
  next: LibrarySelection
}
export interface GeometryOption extends PanelOption {
  nodes: ReadonlyArray<readonly [number, number]>
  cols: number
  rows: number
  /** Distinguishes two layouts sharing a frame, for the eye and for a screen reader. */
  accessibleLabel: string
}
export interface PanelOptions {
  types: PanelOption[]
  frames: PanelOption[]
  geometries: GeometryOption[]
  orientations: PanelOption[]
}

const TYPE_LABEL: Record<string, string> = { peak: 'Peak', wedge: 'Wedge', sail: 'Sail' }
const label = (id: string) => TYPE_LABEL[id] ?? id

/** The eight lattice views, as the library's own transform. */
const ALL_VIEWS: readonly LibraryTransform[] = [
  { transpose: false, flipX: false, flipY: false }, { transpose: true, flipX: false, flipY: false },
  { transpose: false, flipX: true, flipY: true }, { transpose: true, flipX: true, flipY: true },
  { transpose: false, flipX: true, flipY: false }, { transpose: true, flipX: true, flipY: false },
  { transpose: false, flipX: false, flipY: true }, { transpose: true, flipX: false, flipY: true },
]
const sameView = (a: LibraryTransform, b: LibraryTransform) =>
  a.transpose === b.transpose && a.flipX === b.flipX && a.flipY === b.flipY

const transformedKey = (frame: LibraryFrame, layout: LibraryLayout, view: LibraryTransform): string => {
  const t = transformLayout(frame, layout, view)
  return t.cols + 'x' + t.rows + '|' + t.nodes.map(([x, y]) => x + ',' + y).sort().join(' ')
}

/** THE DISTINCT ORIENTATIONS of the selected population. Views producing an identical node set
 *  are one option — and the ACTIVE one is chosen by that same equivalence, because a selection
 *  can hold a transform whose representative was kept under a different one, which left every
 *  button unpressed (QA F2). */
function orientationOptions(
  sel: LibrarySelection, frame: LibraryFrame, layout: LibraryLayout, rules: ClassRules,
  base: LibraryTransform,
): PanelOption[] {
  const selectedKey = transformedKey(frame, layout, sel.view)
  const seen = new Set<string>()
  const out: PanelOption[] = []
  // the presented view leads the list and IS 0 degrees; the rest are turns from it
  for (const view of [base, ...ALL_VIEWS]) {
    const key = transformedKey(frame, layout, view)
    if (seen.has(key)) continue
    seen.add(key)
    const named = rules.source === 'registry'
      ? rules.orientations.find((o) => sameView(o.view, view)) : undefined
    out.push({
      id: 'view' + out.length, label: named?.id ?? viewName(base, view),
      active: key === selectedKey, next: { ...sel, view: { ...view } },
    })
  }
  return out
}

/** The selection a class tab lands on: its first shape, its first geometry where the class has
 *  one, that geometry's frame, and a layout the frame actually carries. The page passes IDs. */
export function selectionForFamily(
  current: LibrarySelection, family: LibraryFamily, pitchMM = 48,
): LibrarySelection {
  const shape = LIBRARY_SHAPES.find((x) => x.family === family)
  if (!shape) throw new Error('library: no shape for family ' + family)
  const rules = CLASS_RULES[family]
  if (rules.source === 'registry') {
    const f0 = CLASS_FRAMES[family][0]
    return { ...current, shapeId: shape.id, geometryId: undefined, frameKey: frameKeyOf(f0), layoutId: pickLayout(f0, 'perimeter') }
  }
  const geo = firstGeometryOf(rules.subs[0] as TriangleProductType)
  const f0 = triangleFrame(geo, pitchMM)
  return {
    ...current, shapeId: shape.id, geometryId: geo.id, frameKey: frameKeyOf(f0),
    layoutId: pickLayout(f0, 'perimeter'), view: uprightView(geo),
  }
}

export function panelOptions(
  sel: LibrarySelection, drafts: readonly LibraryDraft[] = [], pitchMM = 48,
): PanelOptions {
  const { shape, frame, layout, draft } = resolveSelection(sel, drafts, pitchMM)
  const rules = CLASS_RULES[shape.family]
  // a saved custom layout is deduped from ITS OWN population, not from the corpus layout the
  // resolver falls back to for a draft (QA F2)
  const visible: LibraryLayout = draft ? { name: draftLayoutId(draft.name), nodes: draft.nodes } : layout
  // a class that materialises its own frames presents its geometry upright, and that is 0°
  const base: LibraryTransform = rules.source === 'geometry'
    ? uprightView(triangleById(geometryOf(sel)))
    : { transpose: false, flipX: false, flipY: false }
  const orientations = orientationOptions(sel, frame, visible, rules, base)
  if (rules.source === 'registry') {
    const frames = CLASS_FRAMES[shape.family]
    const sub = subOf(rules, frame)
    const jump = (f: LibraryFrame): LibrarySelection =>
      ({ ...sel, frameKey: frameKeyOf(f), layoutId: pickLayout(f, sel.layoutId) })
    return {
      types: rules.subs.map((id) => {
        const f0 = frames.find((f) => subOf(rules, f) === id) ?? frame
        return { id, label: label(id), active: sub === id, next: jump(f0) }
      }),
      frames: frames.filter((f) => subOf(rules, f) === sub).map((f) => ({
        // the class labels its own frames — the diamond reads by magnets per side, not by the
        // lattice patch it occupies
        id: frameKeyOf(f), label: rules.label(f.cols, f.rows),
        active: frameKeyOf(f) === frameKeyOf(frame), next: jump(f),
      })),
      geometries: [],
      // a class with no named views of its own offers none
      orientations: rules.orientations.length ? orientations : [],
    }
  }
  const geo = triangleById(geometryOf(sel))
  const type = triangleTypeOf(geo)
  const frameKey = triangleFrameKey(geo)
  const toSel = (t: TriangleLayout): LibrarySelection => {
    const f = triangleFrame(t, pitchMM)
    // a new geometry opens standing on its longest side, not in its de-duplication form
    return {
      ...sel, geometryId: t.id, frameKey: frameKeyOf(f),
      layoutId: pickLayout(f, sel.layoutId), view: uprightView(t),
    }
  }
  return {
    types: rules.subs.map((id) => {
      const first = firstGeometryOf(id as TriangleProductType)
      return { id, label: label(id), active: id === type, next: toSel(first) }
    }),
    frames: triangleFrameKeys(type).map((k) => {
      const [c, r] = k.split('x').map(Number)
      return { id: k, label: rules.label(c, r), active: k === frameKey, next: toSel(trianglesOf(type, k)[0]) }
    }),
    geometries: trianglesOf(type, frameKey).map((t, i) => {
      const b = boundsOf([...t.vertices])
      return {
        id: t.id, label: rules.label(b.cols, b.rows), active: t.id === geo.id,
        accessibleLabel: label(type) + ' layout ' + (i + 1) + ' · ' + rules.label(b.cols, b.rows),
        nodes: t.vertices, cols: b.cols, rows: b.rows, next: toSel(t),
      }
    }),
    orientations,
  }
}

const subOf = (rules: RegistryRules, f: LibraryFrame) => rules.subOf(f.cols, f.rows)
