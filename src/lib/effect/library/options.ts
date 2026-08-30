// library/options.ts — WHAT THE PANEL MAY OFFER. The view maps these to controls and nothing
// else: every option already carries the selection it produces and the words it reads, so
// class, frame, geometry, layout and view policy all stay here (Dan, 08-26: "no logic in UI
// shell and poage"). Resolution lives in selection.ts; classes answer through class-registry.ts.

import { specOf } from './class-registry'
import type { FrameOrientation, LibraryClass } from './class-contract'
import { frameKeyOf, transformLayout, viewName } from './transforms'
import { draftLayoutId, selectVariant, type ResolvedSelection } from './selection'
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
/** HOW THE ADMIN IS BROWSING — which band and which way round, independent of what is selected.
 *  A filter over the listing, never a transform of a record: portrait and landscape are separate
 *  published layouts, so choosing one narrows the list rather than turning anything (Dan,
 *  2026-08-30). Null on either axis means "all". */
export interface LibraryBrowse {
  bandId: number | null
  orientation: FrameOrientation | null
}

export const DEFAULT_LIBRARY_BROWSE: LibraryBrowse = { bandId: null, orientation: null }

/** A browse chip. Same idiom as PanelOption: it carries the state it produces. */
export interface BrowseOption {
  id: string
  label: string
  active: boolean
  next: LibraryBrowse
}

export interface PanelOptions {
  types: PanelOption[]
  /** The bands this class's frames actually occupy, plus "all". Empty when there is only one. */
  bands: BrowseOption[]
  /** portrait / landscape, offered only when the class publishes both. Empty otherwise — a square
   *  class has no such choice, and a row with one button is not a choice either. */
  frameOrientations: BrowseOption[]
  /** The offers a class makes. For a class whose shape IS its layout each offer is one
   *  geometry, so there is one block and not two. */
  frames: PanelOption[]
  orientations: PanelOption[]
  /** The frame's canon population, plus the admin's own saved ones. The belt, the corners and
   *  the 96mm spacing are not offered here: they are filters the engine applies (Dan, 08-29). */
  layouts: PanelOption[]
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
const MIRROR_ORDER = ['mirror horizontal', 'mirror vertical', 'mirror down-diagonal', 'mirror up-diagonal']
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

/** The band and orientation rows, and the frames that survive them. Filtering lives HERE and not
 *  in the panel: the view renders options and holds no class logic (Dan, 08-26 "no logic in UI
 *  shell and page"), and deciding which frames a band contains is exactly that logic. */
function browseRows(
  variants: readonly { bandId: number | null; orientation: FrameOrientation }[], browse: LibraryBrowse,
): { bands: BrowseOption[]; frameOrientations: BrowseOption[]; applied: LibraryBrowse } {
  const ids = [...new Set(variants.map((v) => v.bandId).filter((b): b is number => b !== null))]
    .sort((a, b) => a - b)
  const bands: BrowseOption[] = ids.length > 1 ? [
    { id: 'band-all', label: 'all', active: browse.bandId === null, next: { ...browse, bandId: null } },
    ...ids.map((id) => ({
      id: 'band' + id, label: 'B' + id, active: browse.bandId === id, next: { ...browse, bandId: id },
    })),
  ] : []
  // only a class publishing BOTH ways round has a choice to offer
  const ways = new Set(variants.map((v) => v.orientation))
  const frameOrientations: BrowseOption[] = ways.has('portrait') && ways.has('landscape') ? [
    { id: 'o-all', label: 'all', active: browse.orientation === null, next: { ...browse, orientation: null } },
    { id: 'o-portrait', label: 'portrait', active: browse.orientation === 'portrait', next: { ...browse, orientation: 'portrait' } },
    { id: 'o-landscape', label: 'landscape', active: browse.orientation === 'landscape', next: { ...browse, orientation: 'landscape' } },
  ] : []
  // A FILTER THAT IS NOT OFFERED MUST NOT FILTER. Carrying "portrait" from the rectangle tab into
  // the square tab emptied the list — squares are neither portrait nor landscape, so every chip
  // was excluded by a control the class never showed. Same for a band this class does not reach.
  const applied: LibraryBrowse = {
    bandId: browse.bandId !== null && ids.includes(browse.bandId) ? browse.bandId : null,
    orientation: frameOrientations.length ? browse.orientation : null,
  }
  return { bands, frameOrientations, applied }
}

export function panelOptionsResolved(
  sel: LibrarySelection, drafts: readonly LibraryDraft[], pitchMM: number, resolved: ResolvedSelection,
  browse: LibraryBrowse = DEFAULT_LIBRARY_BROWSE,
): PanelOptions {
  const { spec, variant, typeId: type, frame, layout, draft } = resolved
  // a saved custom layout is deduped from ITS OWN population, not from the corpus layout the
  // resolver falls back to for a draft (QA F2)
  const visible: LibraryLayout = draft ? { name: draftLayoutId(draft.name), nodes: draft.nodes } : layout
  const orientations = orientationOptions(sel, frame, visible, spec, spec.baseView(sel, pitchMM))
  const variantId = variant.id
  const layoutSel = (name: string): LibrarySelection => ({ ...sel, layoutId: name })
  const allVariants = spec.variants(type, pitchMM)
  const rows = browseRows(allVariants, browse)

  return {
    // a class with one type offers no choice, so its chip is inert. WHICH controls are inert is
    // the library's answer; the view counted the options itself and decided (law 14).
    types: spec.types.map((t) => {
      const first = spec.variants(t.id, pitchMM)[0]
      return {
        id: t.id, label: t.label, active: t.id === type,
        disabled: spec.types.length === 1, next: selectVariant(sel, first),
      }
    }),
    bands: rows.bands,
    frameOrientations: rows.frameOrientations,
    frames: allVariants
      .filter((v) => (rows.applied.bandId === null || v.bandId === rows.applied.bandId)
        && (rows.applied.orientation === null || v.orientation === rows.applied.orientation))
      .map((v) => ({
        id: v.id, label: v.label, accessibleLabel: v.accessibleLabel,
        active: v.id === variantId, next: selectVariant(sel, v),
      })),
    // a class with no named views of its own, and no turn that changes the picture, offers none
    // CANON IS LOCKED: a square or rectangle record's orientation is part of what it is, so the
    // page offers no turn (Dan, 2026-08-30). Presets keep the transform row — for them a turn
    // genuinely is a view of one record.
    orientations: spec.catalogueRole === 'canon' ? []
      : spec.orientations.length || orientations.length > 1 ? orientations : [],
    layouts: [
      ...frame.layouts.map((l) => ({
        id: l.name, label: l.name, active: sel.layoutId === l.name, next: layoutSel(l.name),
      })),
      ...drafts.filter((d) => spec.draftMatches(d, sel, frameKeyOf(frame))).map((d) => ({
        id: d.id, label: d.name, custom: true,
        active: sel.layoutId === draftLayoutId(d.name), next: layoutSel(draftLayoutId(d.name)),
      })),
    ],
  }
}
