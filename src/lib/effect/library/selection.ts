// library/selection.ts — WHAT AM I POINTING AT. The single owner of selection resolution and
// of the draft-id convention. Both were re-implemented in the page and the panel; the page's
// copy guessed where this one is explicit, which is how a stale cross-class selection took the
// tab down (diamond had no 'perimeter', 08-25).
//
// It asks the class spec and tests nothing itself: which frame a selection names, and which
// stored drafts belong to it, are the spec's answers, not a branch here.

import { specOf } from './class-registry'
import type { ClassVariant, LibraryClass } from './class-contract'
import { frameKeyOf } from './transforms'
import type { LibraryDraft } from './drafts'
import type { LibraryFamily, LibraryFrame, LibraryLayout, LibrarySelection } from './types'

/** A hand-authored layout is named in a selection as 'draft:<name>'. One place, one spelling. */
const DRAFT_PREFIX = 'draft:'
export const DEFAULT_LIBRARY_SELECTION: LibrarySelection = {
  classId: 'square', frameKey: '3x3', layoutId: 'perimeter',
  view: { transpose: false, flipX: false, flipY: false },
}
export const draftLayoutId = (name: string): string => DRAFT_PREFIX + name
const isDraftLayout = (layoutId: string): boolean => layoutId.startsWith(DRAFT_PREFIX)
export const draftNameOf = (layoutId: string): string => layoutId.slice(DRAFT_PREFIX.length)

/** The layout a frame should land on: the preferred name when it carries it, else its first. */
export function pickLayout(frame: LibraryFrame, preferred: string): string {
  return frame.layouts.some((l) => l.name === preferred) ? preferred : frame.layouts[0].name
}

export const selectVariant = (current: LibrarySelection, variant: ClassVariant): LibrarySelection => ({
  ...current,
  ...variant.selection,
  layoutId: pickLayout(variant.frame, current.layoutId),
  view: { ...variant.view },
})

export interface ResolvedSelection {
  classId: LibraryFamily
  spec: LibraryClass
  variant: ClassVariant
  typeId: string
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
 *  threw when the pipeline resolved it (QA F4). */
export function resolveSelection(
  sel: LibrarySelection, drafts: readonly LibraryDraft[] = [], pitchMM: number,
): ResolvedSelection {
  const spec = specOf(sel.classId)
  const variant = spec.variantOf(sel, pitchMM)
  const frame = variant.frame
  const typeId = variant.typeId
  const frameKey = frameKeyOf(frame)
  const wantsDraft = isDraftLayout(sel.layoutId)
  // whether a stored draft belongs to this selection is the class's own rule: the triangle
  // counts the geometry, because two geometries on one frame must not answer for each other
  const draft = wantsDraft
    ? drafts.find((d) => spec.draftMatches(d, sel, frameKey) && d.name === draftNameOf(sel.layoutId)) ?? null
    : null
  if (wantsDraft && !draft)
    throw new Error(`library: unknown draft ${draftNameOf(sel.layoutId)} in ${frameKey}`)
  const layoutId = wantsDraft ? frame.layouts[0].name : pickLayout(frame, sel.layoutId)
  const layout = frame.layouts.find((l) => l.name === layoutId)!
  return { classId: sel.classId, spec, variant, typeId, frame, safeSel: { ...sel, frameKey, layoutId }, layout, draft }
}
