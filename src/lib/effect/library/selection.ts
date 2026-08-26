// library/selection.ts — WHAT AM I POINTING AT. The single owner of selection resolution and
// of the draft-id convention. Both were re-implemented in the page and the panel; the page's
// copy guessed where this one is explicit, which is how a stale cross-class selection took the
// tab down (diamond had no 'perimeter', 08-25).
//
// It asks the class spec and tests nothing itself: which frame a selection names, and which
// stored drafts belong to it, are the spec's answers, not a branch here.

import { specOf } from './class-spec'
import { LIBRARY_SHAPES } from './shapes'
import { frameKeyOf } from './transforms'
import type { LibraryDraft } from './drafts'
import type { LibraryFrame, LibraryLayout, LibrarySelection, LibraryShape } from './types'

/** A hand-authored layout is named in a selection as 'draft:<name>'. One place, one spelling. */
export const DRAFT_PREFIX = 'draft:'
export const draftLayoutId = (name: string): string => DRAFT_PREFIX + name
export const isDraftLayout = (layoutId: string): boolean => layoutId.startsWith(DRAFT_PREFIX)
export const draftNameOf = (layoutId: string): string => layoutId.slice(DRAFT_PREFIX.length)

/** The layout a frame should land on: the preferred name when it carries it, else its first. */
export function pickLayout(frame: LibraryFrame, preferred: string): string {
  return frame.layouts.some((l) => l.name === preferred) ? preferred : frame.layouts[0].name
}

const shapeOf = (sel: LibrarySelection): LibraryShape => {
  const shape = LIBRARY_SHAPES.find((x) => x.id === sel.shapeId)
  if (!shape) throw new Error('library: unknown shapeId ' + sel.shapeId)
  return shape
}

/** STRICT — the pipeline's resolver. An unknown ID is an error, never a silent retarget to
 *  unrelated data (QA F3): stable IDs exist precisely so a stale identity cannot lie. */
export function selectedRecords(sel: LibrarySelection, pitchMM = 48): {
  shape: LibraryShape
  frame: LibraryFrame
  layout: LibraryLayout
} {
  const shape = shapeOf(sel)
  const frame = specOf(shape.family).frameOf(sel, pitchMM)
  const layout = frame.layouts.find((l) => l.name === sel.layoutId)
  if (!layout) throw new Error('library: unknown layoutId ' + sel.layoutId + ' in ' + sel.frameKey)
  return { shape, frame, layout }
}

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
 *  threw when the pipeline resolved it (QA F4). */
export function resolveSelection(
  sel: LibrarySelection, drafts: readonly LibraryDraft[] = [], pitchMM = 48,
): ResolvedSelection {
  const shape = shapeOf(sel)
  const spec = specOf(shape.family)
  const frame = spec.frameOf(sel, pitchMM)
  const frameKey = frameKeyOf(frame)
  const wantsDraft = isDraftLayout(sel.layoutId)
  // whether a stored draft belongs to this selection is the class's own rule: the triangle
  // counts the geometry, because two geometries on one frame must not answer for each other
  const draft = wantsDraft
    ? drafts.find((d) => spec.draftMatches(d, sel, frameKey) && d.name === draftNameOf(sel.layoutId)) ?? null
    : null
  const layoutId = wantsDraft ? frame.layouts[0].name : pickLayout(frame, sel.layoutId)
  const layout = frame.layouts.find((l) => l.name === layoutId)!
  return { shape, frame, safeSel: { ...sel, frameKey, layoutId }, layout, draft }
}

/** Every stored draft the panel should list for this selection. */
export function draftsFor(
  sel: LibrarySelection, drafts: readonly LibraryDraft[], pitchMM = 48,
): LibraryDraft[] {
  const shape = shapeOf(sel)
  const spec = specOf(shape.family)
  const frameKey = frameKeyOf(spec.frameOf(sel, pitchMM))
  return drafts.filter((d) => spec.draftMatches(d, sel, frameKey))
}
