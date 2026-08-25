// library/selection.ts — WHAT AM I POINTING AT. The single owner of selection resolution and
// of the draft-id convention. Both were re-implemented in the page and the panel; the page's
// copy guessed where this one is explicit, which is how a stale cross-class selection took the
// tab down (diamond had no 'perimeter', 08-25).

import { CLASS_FRAMES } from './frames'
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

/** STRICT — the pipeline's resolver. An unknown ID is an error, never a silent retarget to
 *  unrelated data (QA F3): stable IDs exist precisely so a stale identity cannot lie. */
export function selectedRecords(sel: LibrarySelection): {
  shape: LibraryShape
  frame: LibraryFrame
  layout: LibraryLayout
} {
  const shape = LIBRARY_SHAPES.find((x) => x.id === sel.shapeId)
  if (!shape) throw new Error('library: unknown shapeId ' + sel.shapeId)
  const frame = CLASS_FRAMES[shape.family].find((f) => frameKeyOf(f) === sel.frameKey)
  if (!frame) throw new Error('library: unknown frameKey ' + sel.frameKey)
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

/** TOLERANT — the authoring view's resolver. The admin drives the panel by hand and carries a
 *  selection across class switches, so the view lands on something real instead of throwing.
 *  A draft matches on class AND frame AND name — matching on name alone let a square draft
 *  answer for a diamond of the same frame. */
export function resolveSelection(
  sel: LibrarySelection, drafts: readonly LibraryDraft[] = [],
): ResolvedSelection {
  const shape = LIBRARY_SHAPES.find((x) => x.id === sel.shapeId) ?? LIBRARY_SHAPES[0]
  const frames = CLASS_FRAMES[shape.family]
  const frame = frames.find((f) => frameKeyOf(f) === sel.frameKey) ?? frames[0]
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
