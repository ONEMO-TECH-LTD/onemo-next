// library/selection.ts — WHAT AM I POINTING AT. The single owner of selection resolution and
// of the draft-id convention. Both were re-implemented in the page and the panel; the page's
// copy guessed where this one is explicit, which is how a stale cross-class selection took the
// tab down (diamond had no 'perimeter', 08-25).

import { CLASS_FRAMES } from './frames'
import { CLASS_RULES } from './rules'
import { triangleById, triangleFrame, triangleFrameKey, trianglesOf, triangleFrameKeys, triangleTypeOf } from './triangle-frames'
import { TRIANGLE_LAYOUTS } from './corpus-triangle'
import { boundsOf, type TriangleLayout, type TriangleProductType } from './triangle-geometry'
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
export function selectedRecords(sel: LibrarySelection, pitchMM = 48): {
  shape: LibraryShape
  frame: LibraryFrame
  layout: LibraryLayout
} {
  const shape = LIBRARY_SHAPES.find((x) => x.id === sel.shapeId)
  if (!shape) throw new Error('library: unknown shapeId ' + sel.shapeId)
  if (CLASS_RULES[shape.family].framesFromGeometry) {
    const frame = triangleFrame(triangleById(geometryOf(sel)), pitchMM)
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

/** The frames a class offers for a selection. For the triangle they are materialised from the
 *  geometry the selection names; every other class reads its registry. One seam, no branch in
 *  the view. */
export function framesFor(sel: LibrarySelection, pitchMM = 48): LibraryFrame[] {
  const shape = LIBRARY_SHAPES.find((x) => x.id === sel.shapeId) ?? LIBRARY_SHAPES[0]
  if (shape.family !== 'triangle') return CLASS_FRAMES[shape.family]
  const type = (sel.layoutId && CLASS_RULES.triangle.subs.includes(subOfSel(sel))
    ? subOfSel(sel) : triangleTypeOf(triangleById(geometryOf(sel)))) as TriangleProductType
  return triangleFrameKeys(type).map((k) => triangleFrame(trianglesOf(type, k)[0], pitchMM))
}

const subOfSel = (sel: LibrarySelection): string =>
  triangleTypeOf(triangleById(geometryOf(sel)))

/** The geometry a triangle selection names — fail loud, never a silent first record. */
export function geometryOf(sel: LibrarySelection): string {
  if (!sel.geometryId) throw new Error('library: triangle selection carries no geometryId')
  return sel.geometryId
}

/** Every geometry offered for the selection's type and frame, with its product type. */
export function geometriesFor(sel: LibrarySelection): TriangleLayout[] {
  const shape = LIBRARY_SHAPES.find((x) => x.id === sel.shapeId)
  if (!shape || shape.family !== 'triangle') return []
  const t = triangleById(geometryOf(sel))
  return trianglesOf(triangleTypeOf(t), triangleFrameKey(t))
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
  if (shape.family === 'triangle') {
    const geo = triangleById(geometryOf(sel))
    const frame = triangleFrame(geo, pitchMM)
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
export interface PanelOption { id: string; active: boolean; next: LibrarySelection }
export interface GeometryOption extends PanelOption {
  nodes: ReadonlyArray<readonly [number, number]>
  cols: number
  rows: number
}
export interface PanelOptions {
  types: PanelOption[]
  frames: PanelOption[]
  geometries: GeometryOption[]
  frameLabel: string
}

export function panelOptions(
  sel: LibrarySelection, drafts: readonly LibraryDraft[] = [], pitchMM = 48,
): PanelOptions {
  const { shape, frame } = resolveSelection(sel, drafts, pitchMM)
  const rules = CLASS_RULES[shape.family]
  if (shape.family !== 'triangle') {
    const frames = CLASS_FRAMES[shape.family]
    const sub = rules.subOf(frame.cols, frame.rows)
    const jump = (f: LibraryFrame): LibrarySelection =>
      ({ ...sel, frameKey: frameKeyOf(f), layoutId: pickLayout(f, sel.layoutId) })
    return {
      types: rules.subs.map((id) => {
        const f0 = frames.find((f) => rules.subOf(f.cols, f.rows) === id) ?? frame
        return { id, active: sub === id, next: jump(f0) }
      }),
      frames: frames.filter((f) => rules.subOf(f.cols, f.rows) === sub).map((f) => ({
        id: frameKeyOf(f), active: frameKeyOf(f) === frameKeyOf(frame), next: jump(f),
      })),
      geometries: [],
      frameLabel: frameKeyOf(frame),
    }
  }
  const geo = triangleById(geometryOf(sel))
  const type = triangleTypeOf(geo)
  const frameKey = triangleFrameKey(geo)
  const toSel = (t: TriangleLayout): LibrarySelection => {
    const f = triangleFrame(t, pitchMM)
    return { ...sel, geometryId: t.id, frameKey: frameKeyOf(f), layoutId: pickLayout(f, sel.layoutId) }
  }
  return {
    types: rules.subs.map((id) => {
      const first = firstGeometryOf(id as TriangleProductType)
      return { id, active: id === type, next: toSel(first) }
    }),
    frames: triangleFrameKeys(type).map((k) => ({
      id: k, active: k === frameKey, next: toSel(trianglesOf(type, k)[0]),
    })),
    geometries: trianglesOf(type, frameKey).map((t) => {
      const b = boundsOf([...t.vertices])
      return { id: t.id, active: t.id === geo.id, nodes: t.vertices, cols: b.cols, rows: b.rows, next: toSel(t) }
    }),
    frameLabel: frameKey,
  }
}
