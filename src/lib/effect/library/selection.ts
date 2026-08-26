// library/selection.ts — WHAT AM I POINTING AT. The single owner of selection resolution and
// of the draft-id convention. Both were re-implemented in the page and the panel; the page's
// copy guessed where this one is explicit, which is how a stale cross-class selection took the
// tab down (diamond had no 'perimeter', 08-25).

import { CLASS_FRAMES } from './frames'
import { CLASS_RULES } from './rules'
import { LIBRARY_SHAPES } from './shapes'
import { frameKeyOf } from './transforms'
import { triangleById, triangleFrame, triangleTypeOf } from './triangle-frames'
import { TRIANGLE_LAYOUTS } from './corpus-triangle'
import type { TriangleLayout } from './triangle-geometry'
import type { TriangleProductType } from './triangle-types'
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
