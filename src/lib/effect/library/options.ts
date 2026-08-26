// library/options.ts — WHAT THE PANEL MAY OFFER. The view maps these to controls and nothing
// else: every option already carries the selection it produces and the words it reads, so
// class, frame, geometry, layout and view policy all stay here (Dan, 08-26: "no logic in UI
// shell and poage"). Resolution lives in selection.ts; the class answers live in class-spec.ts.

import { specOf, type LibraryClass } from './class-spec'
import { SPACING_MODES, isSpacingMode } from './rules'
import { LIBRARY_SHAPES } from './shapes'
import { transformLayout, viewName } from './transforms'
import { draftLayoutId, pickLayout, resolveSelection, draftsFor } from './selection'
import type { LibraryDraft } from './drafts'
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
  /** A control the class offers but this frame cannot serve. */
  disabled?: boolean
  /** A hand-authored layout rather than a corpus one. */
  custom?: boolean
}
export interface PanelOptions {
  types: PanelOption[]
  /** The offers a class makes. For a class whose shape IS its layout each offer is one
   *  geometry, so there is one block and not two. */
  frames: PanelOption[]
  orientations: PanelOption[]
  /** The populations this frame carries, plus the admin's own saved ones. */
  layouts: PanelOption[]
  /** The two physical spacings, with the ones this frame cannot serve marked. */
  spacing: PanelOption[]
}

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
  sel: LibrarySelection, frame: LibraryFrame, layout: LibraryLayout, spec: LibraryClass,
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
    const named = spec.orientations.find((o) => sameView(o.view, view))
    out.push({
      id: 'view' + out.length, label: named?.id ?? viewName(base, view),
      active: key === selectedKey, next: { ...sel, view: { ...view } },
    })
  }
  return out
}

/** The selection a class tab lands on. The page passes a family; the class decides the rest. */
export function selectionForFamily(
  current: LibrarySelection, family: LibraryFamily, pitchMM = 48,
): LibrarySelection {
  if (!LIBRARY_SHAPES.some((x) => x.family === family)) throw new Error('library: no shape for family ' + family)
  return specOf(family).open(current, pitchMM)
}

export function panelOptions(
  sel: LibrarySelection, drafts: readonly LibraryDraft[] = [], pitchMM = 48,
): PanelOptions {
  const { shape, frame, layout, draft } = resolveSelection(sel, drafts, pitchMM)
  const spec = specOf(shape.family)
  // a saved custom layout is deduped from ITS OWN population, not from the corpus layout the
  // resolver falls back to for a draft (QA F2)
  const visible: LibraryLayout = draft ? { name: draftLayoutId(draft.name), nodes: draft.nodes } : layout
  const orientations = orientationOptions(sel, frame, visible, spec, spec.baseView(sel, pitchMM))
  const type = spec.typeOf(sel, pitchMM)
  const variantId = spec.variantIdOf(sel)
  const layoutSel = (name: string): LibrarySelection => ({ ...sel, layoutId: name })
  const has = (name: string) => frame.layouts.some((l) => l.name === name)

  return {
    types: spec.types.map((t) => {
      const first = spec.variants(t.id, pitchMM)[0]
      return { id: t.id, label: t.label, active: t.id === type, next: spec.select(sel, first) }
    }),
    frames: spec.variants(type, pitchMM).map((v) => ({
      id: v.id, label: v.label, accessibleLabel: v.accessibleLabel,
      active: v.id === variantId, next: spec.select(sel, v),
    })),
    // a class with no named views of its own, and no turn that changes the picture, offers none
    orientations: spec.orientations.length || orientations.length > 1 ? orientations : [],
    // the 96mm mode is reached from the Spacing row, so it is not also a layout chip
    layouts: [
      ...frame.layouts.filter((l) => !isSpacingMode(l.name) || l.name === SPACING_MODES[0].layoutId).map((l) => ({
        id: l.name, label: l.name,
        active: sel.layoutId === l.name || (l.name === SPACING_MODES[0].layoutId && isSpacingMode(sel.layoutId)),
        next: layoutSel(l.name),
      })),
      ...draftsFor(sel, drafts, pitchMM).map((d) => ({
        id: d.id, label: d.name, custom: true,
        active: sel.layoutId === draftLayoutId(d.name), next: layoutSel(draftLayoutId(d.name)),
      })),
    ],
    spacing: SPACING_MODES.map((m) => ({
      id: m.layoutId, label: m.label, disabled: !has(m.layoutId),
      active: sel.layoutId === m.layoutId,
      next: layoutSel(has(m.layoutId) ? m.layoutId : pickLayout(frame, m.layoutId)),
    })),
  }
}
