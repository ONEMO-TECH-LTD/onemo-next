// library/options.ts — WHAT THE PANEL MAY OFFER. The view maps these to controls and nothing
// else: every option already carries the selection it produces and the words it reads, so
// class, frame, geometry, layout and view policy all stay here (Dan, 08-26: "no logic in UI
// shell and poage"). Resolution lives in selection.ts; classes answer through class-registry.ts.

import { specOf } from './class-registry'
import type { LibraryClass } from './class-contract'
import { SPACING_MODES, isSpacingMode } from './rules'
import { transformLayout, viewName } from './transforms'
import { draftLayoutId, pickLayout, draftsFor, selectVariant, type ResolvedSelection } from './selection'
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
  // Several transforms can draw the SAME picture — a shape symmetric about its vertical axis
  // is flipped top-to-bottom by both "mirror horizontal" and a 180 degree turn. Collect every
  // view per picture, then name the picture by the SIMPLEST transform that reaches it: a
  // rotation if one does, and a mirror only when no rotation will (Dan, 08-26: "why orientation
  // has 3 buttons with degrees and 1 mirror horizontal text button when logical to just say
  // 180?"). Keeping whichever view came first named the matrix, not the result.
  const groups = new Map<string, LibraryTransform[]>()
  for (const view of [base, ...ALL_VIEWS]) {
    const key = transformedKey(frame, layout, view)
    const g = groups.get(key)
    if (g) g.push(view); else groups.set(key, [view])
  }
  const picked = [...groups].map(([key, views]) => {
    // a class that names its own views wins; then plain turns, in order; then mirrors
    const best = views.reduce((a, b) => (rankOf(a, base, spec) <= rankOf(b, base, spec) ? a : b))
    return { key, view: best, rank: rankOf(best, base, spec) }
  })
  // and they READ in that order too, so the row is always 0, 90, 180, 270, then any mirrors
  picked.sort((a, b) => a.rank - b.rank)
  return picked.map(({ key, view }, i) => {
    const named = spec.orientations.find((o) => sameView(o.view, view))
    return {
      id: 'view' + i, label: named?.id ?? viewName(base, view),
      active: key === selectedKey, next: { ...sel, view: { ...view } },
    }
  })
}

/** How plainly a transform describes a picture: a class's own name first, then the four turns
 *  in order, then the mirrors. Lower is plainer. */
const TURN_ORDER = ['0°', '90°', '180°', '270°']
const MIRROR_ORDER = ['mirror horizontal', 'mirror vertical', 'mirror diagonal ↘', 'mirror diagonal ↗']
function rankOf(view: LibraryTransform, base: LibraryTransform, spec: LibraryClass): number {
  if (spec.orientations.some((o) => sameView(o.view, view))) return -1
  const i = TURN_ORDER.indexOf(viewName(base, view))
  return i >= 0 ? i : 10 + MIRROR_ORDER.indexOf(viewName(base, view))
}

/** The selection a class tab lands on. The page passes a family; the class decides the rest. */
export function selectionForFamily(
  current: LibrarySelection, family: LibraryFamily, pitchMM: number,
): LibrarySelection {
  return specOf(family).open(current, pitchMM)
}

export function panelOptionsResolved(
  sel: LibrarySelection, drafts: readonly LibraryDraft[], pitchMM: number, resolved: ResolvedSelection,
): PanelOptions {
  const { classId, frame, layout, draft } = resolved
  const spec = specOf(classId)
  // a saved custom layout is deduped from ITS OWN population, not from the corpus layout the
  // resolver falls back to for a draft (QA F2)
  const visible: LibraryLayout = draft ? { name: draftLayoutId(draft.name), nodes: draft.nodes } : layout
  const orientations = orientationOptions(sel, frame, visible, spec, spec.baseView(sel, pitchMM))
  const type = spec.typeOf(sel, pitchMM)
  const variantId = spec.variantOf(sel, pitchMM).id
  const layoutSel = (name: string): LibrarySelection => ({ ...sel, layoutId: name })
  const has = (name: string) => frame.layouts.some((l) => l.name === name)

  return {
    types: spec.types.map((t) => {
      const first = spec.variants(t.id, pitchMM)[0]
      return { id: t.id, label: t.label, active: t.id === type, next: selectVariant(sel, first) }
    }),
    frames: spec.variants(type, pitchMM).map((v) => ({
      id: v.id, label: v.label, accessibleLabel: v.accessibleLabel,
      active: v.id === variantId, next: selectVariant(sel, v),
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
