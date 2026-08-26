// library/options.ts — WHAT THE PANEL MAY OFFER. The view maps these to controls and nothing
// else: every option already carries the selection it produces, so class, frame, geometry and
// view policy stay here. Resolution lives in selection.ts; this is the layer above it.

import { CLASS_FRAMES } from './frames'
import { CLASS_RULES, type ClassRules, type RegistryRules } from './rules'
import { LIBRARY_SHAPES } from './shapes'
import { frameKeyOf, transformLayout, viewName } from './transforms'
import { firstGeometryOf, geometryOf, pickLayout, resolveSelection } from './selection'
import { restsFlat, triangleById, triangleFrame, trianglesOfType, triangleTypeOf, uprightView } from './triangle-frames'
import { boundsOf, type TriangleLayout } from './triangle-geometry'
import type { TriangleProductType } from './triangle-types'
import type { LibraryDraft } from './drafts'
import { draftLayoutId } from './selection'
import type {
  LibraryFamily, LibraryFrame, LibraryLayout, LibrarySelection, LibraryTransform,
} from './types'

/** THE PANEL'S OPTIONS — every control the library offers for a selection, already normalised.
 *  The view maps these to buttons; it never asks what class it is looking at (Dan, 08-25:
 *  "no fucking logic in the ui either"). Each option carries the selection it produces. */
export interface PanelOption {
  id: string
  /** What the control reads. Product labels are the module's to decide, not the view's. */
  label: string
  active: boolean
  next: LibrarySelection
  /** Distinguishes two options that would otherwise read alike. */
  accessibleLabel?: string
}
export interface PanelOptions {
  types: PanelOption[]
  /** The frames a class offers. For a class whose shape IS its layout, each frame is one
   *  geometry and carries its nodes so the chip can draw it — one block, not two. */
  frames: PanelOption[]
  orientations: PanelOption[]
}

const TYPE_LABEL: Record<string, string> = {
  pyramid: 'Pyramid', arrowhead: 'Arrowhead', mountain: 'Mountain', needle: 'Needle',
  slice: 'Slice', wedge: 'Wedge', ramp: 'Ramp', pennant: 'Pennant', sail: 'Sail', fin: 'Fin',
}
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
      // a class with no named views of its own offers none
      orientations: rules.orientations.length ? orientations : [],
    }
  }
  const geo = triangleById(geometryOf(sel))
  const type = triangleTypeOf(geo)
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
    // one chip per geometry: for this class the frame IS the shape, so a second picker would
    // be two controls for one choice
    frames: trianglesOfType(type).map((t, i) => {
      const b = boundsOf([...t.vertices])
      return {
        id: t.id, label: rules.label(b.cols, b.rows), active: t.id === geo.id,
        accessibleLabel: label(type) + ' ' + (i + 1) + ' · ' + rules.label(b.cols, b.rows)
          + (restsFlat(t) ? '' : ' · diagonal'),
        next: toSel(t),
      }
    }),
    orientations,
  }
}

const subOf = (rules: RegistryRules, f: LibraryFrame) => rules.subOf(f.cols, f.rows)
