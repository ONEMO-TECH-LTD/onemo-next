// grid-magnet-library-bridge.ts — THE ONE NARROW BRIDGE from the pure layout-library module to
// engine types. One conversion (`libraryArrangement` — stable IDs, truthful frame identity,
// mm nodes ready for wrapGroup) and the Stage preview composed from it. No solver policy, no
// UI imports; frame spans come from the classifier's own class floors, never a margin formula.

import type { Contour, Pt } from './types'
import type { GridResult } from './grid-magnet'
import { spotRadiusOf } from './grid-magnet-compute'
import { insetRingMM } from './offset'
import { MAGNET_DIA_SMALL_MM, RELEASED_PADDING_MM } from './grid-magnet-spec'
import {
  selectedRecords, transformLayout, kindOf, orientationOf, frameKeyOf, frameLabel, CLASS_RULES, layoutAtPitch,
  canonicalNode, convexHull,
  type LibrarySelection, type LibraryShapeId, type LibraryFamily,
} from './library'

export type { LibrarySelection } from './library'

export interface LibraryArrangement {
  /** WHICH geometry, for a class whose shape is its layout. Absent for fixed-outline classes. */
  geometryId?: string
  /** The canonical frame the selection named. */
  sourceFrameKey: string
  /** The ACTUAL frame identity after the view transform — what the pipeline must believe. */
  frameKey: string
  frameCols: number
  frameRows: number
  layoutId: string
  /** Node positions in mm, engine y-up — wrapGroup-ready local geometry. */
  nodesMM: readonly Pt[]
}

export interface LibraryStageModel {
  contour: Contour
  grid: GridResult
  title: string
  /** Why a population being drawn is not a saveable shape yet — null when it is. */
  error?: string | null
}

/** Selected records -> stable-ID arrangement in mm. The ONE conversion. Throws on unknown IDs. */
export function libraryArrangement(sel: LibrarySelection, pitchMM: number): LibraryArrangement {
  const { shape, frame, layout } = selectedRecords(sel, pitchMM)
  const frameCols = sel.view.transpose ? frame.rows : frame.cols
  const frameRows = sel.view.transpose ? frame.cols : frame.rows
  // 96mm is physical: the population is materialised for THIS pitch, never the canonical one.
  const t = transformLayout(frame, layoutAtPitch(shape.family, frame, layout, pitchMM), sel.view)
  // Engine space is y-up; library rows count downward from the top.
  const nodesMM: Pt[] = t.nodes.map(([ix, iy]) => [ix * pitchMM, (t.rows - 1 - iy) * pitchMM])
  return {
    geometryId: sel.geometryId,
    sourceFrameKey: frameKeyOf(frame), frameKey: frameCols + 'x' + frameRows,
    frameCols, frameRows,
    layoutId: layout.name,
    nodesMM,
  }
}

/** Preview metadata — AUTHORING DISPLAY ONLY, never part of the pipeline arrangement (Meta M1:
 *  the declared library family must not pre-empt Step-1's open recognition-source ruling). */
export function libraryPreview(sel: LibrarySelection, pitchMM: number, padMM: number = RELEASED_PADDING_MM): {
  shapeId: LibraryShapeId
  declaredFamily: LibraryFamily
  shapeCompatible: boolean
  outlineMM: Pt[]
} {
  const { shape } = selectedRecords(sel, pitchMM)
  const a = libraryArrangement(sel, pitchMM)
  // A DERIVED outline is the magnets' own hull pushed out by the padding — no stored shape, no
  // box, no re-centring. Its position is the answer, which is what makes it hug (Dan, 08-26).
  if (shape.outlineSource === 'arrangement-hull')
    return { shapeId: shape.id, declaredFamily: shape.family, shapeCompatible: true, outlineMM: hullOutline(a.nodesMM, padMM) }
  // The frame's physical span is CLASS POLICY — the class rules own it (the square/rectangle
  // class floor, the diamond's wrap-the-ring rule). The bridge asks; it does not re-derive.
  const rules = CLASS_RULES[shape.family]
  if (rules.source !== 'registry') throw new Error('library: ' + shape.family + ' has no box rule')
  const box0 = rules.boxMM(a.frameCols, a.frameRows, pitchMM, padMM)
  const w0 = box0.w, h0 = box0.h
  const shapeCompatible = shape.aspect === 'frame' || a.frameCols === a.frameRows
  const w = shapeCompatible ? w0 : Math.max(w0, h0)
  const h = shapeCompatible ? h0 : Math.max(w0, h0)
  const cx = (a.frameCols - 1) * pitchMM / 2, cy = (a.frameRows - 1) * pitchMM / 2
  const outlineMM: Pt[] = shape.outline.map(([ux, uy]) => [cx - w / 2 + ux * w, cy + h / 2 - uy * h])
  return { shapeId: shape.id, declaredFamily: shape.family, shapeCompatible, outlineMM }
}

/** A population being DRAWN is allowed to be nothing yet, one node, two, or briefly wrong: the
 *  canvas has to stay clickable. The corpus outline stands in until the drawn set is a triangle
 *  again, and the reason travels with it so the panel can refuse the save (QA F1). */
export function draftOutline(
  shape: { outlineSource: 'unit-shape' | 'arrangement-hull' },
  nodesMM: ReadonlyArray<Pt>, sel: LibrarySelection, pitchMM: number, padMM: number,
): { outlineMM: Pt[]; error: string | null } {
  const fallback = () => libraryPreview(sel, pitchMM, padMM).outlineMM
  if (shape.outlineSource !== 'arrangement-hull') return { outlineMM: fallback(), error: null }
  try { return { outlineMM: hullOutline(nodesMM, padMM), error: null } }
  catch (e) { return { outlineMM: fallback(), error: (e as Error).message } }
}

/** THE DERIVED OUTLINE: connect the magnet centres, push the edges out by the padding. The
 *  result's position is authoritative — it is never re-centred on the group's box, which is
 *  exactly why the earlier stored-triangle attempt did not hug its magnets. */
export function hullOutline(nodesMM: ReadonlyArray<Pt>, padMM: number): Pt[] {
  const hull = convexHull(nodesMM)
  if (hull.length < 3) throw new Error('triangle: collinear population')
  if (hull.length !== 3) throw new Error('triangle: hull has ' + hull.length + ' vertices')
  const out = insetRingMM(hull, padMM, 'sharp')
  if (!out) throw new Error('triangle: 12mm outline collapsed')
  return out
}

/** The Stage preview — composes the arrangement. The lattice field stays the canvas's own. */
/** AUTHORING (Dan, 08-25 — sandbox drafts): a draft's own nodes drawn on the selected frame.
 *  Same conversion as the corpus path: y-down -> engine y-up, frame span from class floors. */
export function draftStageModel(
  sel: LibrarySelection, nodes: ReadonlyArray<readonly [number, number]>, pitchMM: number, padMM: number,
  frameCols: number, frameRows: number, title: string,
): LibraryStageModel {
  const { shape } = selectedRecords(sel, pitchMM)
  // A draft is canonical data like every corpus layout, so it goes through the SAME transform
  // and the same one y-flip — never straight to mm (QA F2).
  const t = transformLayout(
    { cols: frameCols, rows: frameRows, layouts: [] },
    { name: 'draft', nodes }, sel.view,
  )
  const nodesMM: Pt[] = t.nodes.map(([ix, iy]) => [ix * pitchMM, (t.rows - 1 - iy) * pitchMM])
  // A derived outline follows the DRAWN magnets, so adding a node outside the hull changes the
  // shape and adding one inside or on an edge does not.
  const { outlineMM, error } = draftOutline(shape, nodesMM, sel, pitchMM, padMM)
  const contour: Contour = { outer: { pts: [...outlineMM] }, holes: [] }
  const grid: GridResult = {
    anchors: nodesMM.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM })),
    pitchCentreMM: pitchMM,
    // An EMPTY draft still needs a clickable field, and it has to land where the magnets the
    // admin just saw were: the canvas seeds from anchors[0] ?? lattice[0], so with nothing
    // drawn we seed from the selected layout's own first node instead of the mm origin.
    lattice: nodesMM.length ? [] : [libraryArrangement(sel, pitchMM).nodesMM[0] ?? [0, 0]],
    phaseMM: [0, 0],
    panMM: [0, 0],
    spotRadiusMM: spotRadiusOf(padMM),
    contactsMM: [],
    segments: [],
    centresMM: [],
    centreMainMM: [(t.cols - 1) * pitchMM / 2, (t.rows - 1) * pitchMM / 2],
  }
  return { contour, grid, title, error }
}

export { canonicalNode }

/** mm point -> lattice node index in the selected frame (y-down canon), or null off-frame.
 *  The canvas draws the infinite lattice, so a click can land anywhere: without this bound an
 *  authored layout could hold nodes outside its own frame and be saved (QA F1). */
export function nodeAtMM(
  pMM: readonly [number, number], pitchMM: number, frameCols: number, frameRows: number,
): [number, number] | null {
  const ix = Math.round(pMM[0] / pitchMM)
  const iyUp = Math.round(pMM[1] / pitchMM)
  const iy = frameRows - 1 - iyUp
  if (ix < 0 || ix >= frameCols || iy < 0 || iy >= frameRows) return null
  return [ix, iy]
}

export function libraryStageModel(sel: LibrarySelection, pitchMM: number, padMM: number): LibraryStageModel {
  const a = libraryArrangement(sel, pitchMM)
  const pv = libraryPreview(sel, pitchMM, padMM)
  const contour: Contour = { outer: { pts: [...pv.outlineMM] }, holes: [] }
  const grid: GridResult = {
    anchors: a.nodesMM.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM })),
    pitchCentreMM: pitchMM,
    lattice: [],
    phaseMM: [0, 0],
    panMM: [0, 0],
    spotRadiusMM: spotRadiusOf(padMM),
    contactsMM: [],
    segments: [],
    centresMM: [],
    centreMainMM: [(a.frameCols - 1) * pitchMM / 2, (a.frameRows - 1) * pitchMM / 2],
  }
  // the readout is the ACTUAL outline, never a box approximation
  const xs = pv.outlineMM.map((q) => q[0]), ys = pv.outlineMM.map((q) => q[1])
  const w = Math.round(Math.max(...xs) - Math.min(...xs)), h = Math.round(Math.max(...ys) - Math.min(...ys))
  const title = `${pv.shapeId} · ${a.layoutId} · ${frameLabel(pv.declaredFamily, a.frameCols, a.frameRows)} ${orientationOf(a.frameCols, a.frameRows)} ${kindOf(a.frameCols, a.frameRows)} · ${pv.declaredFamily} · ${a.nodesMM.length}⌾ · ${w}×${h} mm${pv.shapeCompatible ? '' : ' · shape/frame mismatch'} · LIBRARY DRAFT`
  return { contour, grid, title }
}
