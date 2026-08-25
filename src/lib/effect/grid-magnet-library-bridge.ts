// grid-magnet-library-bridge.ts — THE ONE NARROW BRIDGE from the pure layout-library module to
// engine types. One conversion (`libraryArrangement` — stable IDs, truthful frame identity,
// mm nodes ready for wrapGroup) and the Stage preview composed from it. No solver policy, no
// UI imports; frame spans come from the classifier's own class floors, never a margin formula.

import type { Contour, Pt } from './types'
import type { GridResult } from './grid-magnet'
import { spotRadiusOf } from './grid-magnet-compute'
import { MAGNET_DIA_SMALL_MM } from './grid-magnet-spec'
import {
  selectedRecords, transformLayout, kindOf, orientationOf, frameKeyOf,
  type LibrarySelection, type LibraryShapeId,
} from './grid-magnet-library'
import { classFloorMM, type AxisClass } from './grid-magnet-class'

export type { LibrarySelection } from './grid-magnet-library'

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
  const { frame, layout } = selectedRecords(sel)
  const frameCols = sel.view.transpose ? frame.rows : frame.cols
  const frameRows = sel.view.transpose ? frame.cols : frame.rows
  const t = transformLayout(frame, layout, sel.view)
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
export function libraryPreview(sel: LibrarySelection, pitchMM: number): {
  shapeId: LibraryShapeId
  declaredFamily: string
  shapeCompatible: boolean
  outlineMM: Pt[]
} {
  const { shape } = selectedRecords(sel)
  const a = libraryArrangement(sel, pitchMM)
  // THE FRAME'S PHYSICAL SPAN IS THE CLASS FLOOR (QA F1): 24 + (lines-1)*pitch per axis.
  const w0 = classFloorMM(a.frameCols as AxisClass, pitchMM)
  const h0 = classFloorMM(a.frameRows as AxisClass, pitchMM)
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
  const pv = libraryPreview(sel, pitchMM)
  const nodesMM: Pt[] = nodes.map(([ix, iy]) => [ix * pitchMM, (frameRows - 1 - iy) * pitchMM])
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
    centreMainMM: [(frameCols - 1) * pitchMM / 2, (frameRows - 1) * pitchMM / 2],
  }
  return { contour, grid, title }
}

/** mm point -> lattice node index in the selected frame (y-down canon), or null off-frame. */
export function nodeAtMM(pMM: readonly [number, number], pitchMM: number, frameRows: number): [number, number] | null {
  const ix = Math.round(pMM[0] / pitchMM)
  const iyUp = Math.round(pMM[1] / pitchMM)
  const iy = frameRows - 1 - iyUp
  return [ix, iy]
}

export function libraryStageModel(sel: LibrarySelection, pitchMM: number, padMM: number): LibraryStageModel {
  const a = libraryArrangement(sel, pitchMM)
  const pv = libraryPreview(sel, pitchMM)
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
  const w = classFloorMM(a.frameCols as AxisClass, pitchMM), h = classFloorMM(a.frameRows as AxisClass, pitchMM)
  const title = `${pv.shapeId} · ${a.layoutId} · ${a.frameKey} ${orientationOf(a.frameCols, a.frameRows)} ${kindOf(a.frameCols, a.frameRows)} · ${pv.declaredFamily} · ${a.nodesMM.length}⌾ · ${w}×${h} mm${pv.shapeCompatible ? '' : ' · shape/frame mismatch'} · LIBRARY DRAFT`
  return { contour, grid, title }
}
