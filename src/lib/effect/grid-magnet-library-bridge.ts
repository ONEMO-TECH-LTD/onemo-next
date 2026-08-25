// grid-magnet-library-bridge.ts — THE ONE NARROW BRIDGE from the pure layout-library module to
// engine types. One conversion (`libraryArrangement` — stable IDs, truthful frame identity,
// mm nodes ready for wrapGroup) and the Stage preview composed from it. No solver policy, no
// UI imports; frame spans come from the classifier's own class floors, never a margin formula.

import type { Contour, Pt } from './types'
import type { GridResult } from './grid-magnet'
import { spotRadiusOf } from './grid-magnet-compute'
import { MAGNET_DIA_SMALL_MM, RELEASED_PADDING_MM } from './grid-magnet-spec'
import {
  selectedRecords, transformLayout, kindOf, orientationOf, frameKeyOf, frameLabel, CLASS_RULES, layoutAtPitch,
  canonicalNode,
  type LibrarySelection, type LibraryShapeId, type LibraryFamily,
} from './library'

export type { LibrarySelection } from './library'

export interface LibraryArrangement {
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
}

/** Selected records -> stable-ID arrangement in mm. The ONE conversion. Throws on unknown IDs. */
export function libraryArrangement(sel: LibrarySelection, pitchMM: number): LibraryArrangement {
  const { shape, frame, layout } = selectedRecords(sel)
  const frameCols = sel.view.transpose ? frame.rows : frame.cols
  const frameRows = sel.view.transpose ? frame.cols : frame.rows
  // 96mm is physical: the population is materialised for THIS pitch, never the canonical one.
  const t = transformLayout(frame, layoutAtPitch(shape.family, frame, layout, pitchMM), sel.view)
  // Engine space is y-up; library rows count downward from the top.
  const nodesMM: Pt[] = t.nodes.map(([ix, iy]) => [ix * pitchMM, (t.rows - 1 - iy) * pitchMM])
  return {
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
  const { shape } = selectedRecords(sel)
  const a = libraryArrangement(sel, pitchMM)
  // The frame's physical span is CLASS POLICY — the class rules own it (the square/rectangle
  // class floor, the diamond's wrap-the-ring rule). The bridge asks; it does not re-derive.
  const box0 = CLASS_RULES[shape.family].boxMM(a.frameCols, a.frameRows, pitchMM, padMM)
  const w0 = box0.w, h0 = box0.h
  const shapeCompatible = shape.aspect === 'frame' || a.frameCols === a.frameRows
  const w = shapeCompatible ? w0 : Math.max(w0, h0)
  const h = shapeCompatible ? h0 : Math.max(w0, h0)
  const cx = (a.frameCols - 1) * pitchMM / 2, cy = (a.frameRows - 1) * pitchMM / 2
  const outlineMM: Pt[] = shape.outline.map(([ux, uy]) => [cx - w / 2 + ux * w, cy + h / 2 - uy * h])
  return { shapeId: shape.id, declaredFamily: shape.family, shapeCompatible, outlineMM }
}

/** The Stage preview — composes the arrangement. The lattice field stays the canvas's own. */
/** AUTHORING (Dan, 08-25 — sandbox drafts): a draft's own nodes drawn on the selected frame.
 *  Same conversion as the corpus path: y-down -> engine y-up, frame span from class floors. */
export function draftStageModel(
  sel: LibrarySelection, nodes: ReadonlyArray<readonly [number, number]>, pitchMM: number, padMM: number,
  frameCols: number, frameRows: number, title: string,
): LibraryStageModel {
  const pv = libraryPreview(sel, pitchMM, padMM)
  // A draft is canonical data like every corpus layout, so it goes through the SAME transform
  // and the same one y-flip — never straight to mm (QA F2).
  const t = transformLayout(
    { cols: frameCols, rows: frameRows, layouts: [] },
    { name: 'draft', nodes }, sel.view,
  )
  const nodesMM: Pt[] = t.nodes.map(([ix, iy]) => [ix * pitchMM, (t.rows - 1 - iy) * pitchMM])
  const contour: Contour = { outer: { pts: [...pv.outlineMM] }, holes: [] }
  const grid: GridResult = {
    anchors: nodesMM.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM })),
    pitchCentreMM: pitchMM,
    // An EMPTY draft still needs a clickable field: the canvas seeds its lattice from
    // anchors[0] ?? lattice[0], so a phase seed keeps the spots on screen with zero magnets.
    lattice: nodesMM.length ? [] : [[0, 0]],
    phaseMM: [0, 0],
    panMM: [0, 0],
    spotRadiusMM: spotRadiusOf(padMM),
    contactsMM: [],
    segments: [],
    centresMM: [],
    centreMainMM: [(t.cols - 1) * pitchMM / 2, (t.rows - 1) * pitchMM / 2],
  }
  return { contour, grid, title }
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
  const { w, h } = CLASS_RULES[pv.declaredFamily].boxMM(a.frameCols, a.frameRows, pitchMM, padMM)
  const title = `${pv.shapeId} · ${a.layoutId} · ${frameLabel(pv.declaredFamily, a.frameCols, a.frameRows)} ${orientationOf(a.frameCols, a.frameRows)} ${kindOf(a.frameCols, a.frameRows)} · ${pv.declaredFamily} · ${a.nodesMM.length}⌾ · ${w}×${h} mm${pv.shapeCompatible ? '' : ' · shape/frame mismatch'} · LIBRARY DRAFT`
  return { contour, grid, title }
}
