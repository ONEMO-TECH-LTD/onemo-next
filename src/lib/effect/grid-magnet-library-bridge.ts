// grid-magnet-library-bridge.ts — THE ONE NARROW BRIDGE from the pure layout-library module to
// engine types. CONVERSION ONLY: it materialises what a selection names, flips y into engine
// space, and wraps the result in the engine's own record types. It chooses nothing — which
// outline a class draws, how a layout materialises at a pitch and what makes a hand-authored
// population sound are all the class spec's answers (Dan, 08-26: the library carries the class
// spec). No solver policy, no UI imports, no class branch of its own.

import type { Contour, Pt } from './types'
import type { GridResult } from './grid-magnet'
import { spotRadiusOf } from './grid-magnet-compute'
import { MAGNET_DIA_SMALL_MM, RELEASED_PADDING_MM } from './grid-magnet-spec'
import {
  selectedRecords, transformLayout, frameKeyOf, specOf,
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
  /** Why a population being drawn is not a saveable shape yet — null when it is. */
  error?: string | null
}

/** Selected records -> stable-ID arrangement in mm. The ONE conversion. Throws on unknown IDs. */
export function libraryArrangement(sel: LibrarySelection, pitchMM: number): LibraryArrangement {
  const { shape, frame, layout } = selectedRecords(sel, pitchMM)
  const frameCols = sel.view.transpose ? frame.rows : frame.cols
  const frameRows = sel.view.transpose ? frame.cols : frame.rows
  // 96mm is physical: the population is materialised for THIS pitch, never the canonical one.
  const t = transformLayout(frame, specOf(shape.family).layoutAt(frame, layout, pitchMM), sel.view)
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
  outlineMM: Pt[]
} {
  const { shape } = selectedRecords(sel, pitchMM)
  const a = libraryArrangement(sel, pitchMM)
  // The outline is CLASS POLICY and the class states it: the square/rectangle class floor, the
  // diamond's wrap-the-ring rule, the triangle's magnets-own-hull-pushed-out. The bridge asks
  // and converts; it does not choose between them and does not re-derive any of them.
  const outlineMM = specOf(shape.family)
    .outline(a.nodesMM, a.frameCols, a.frameRows, pitchMM, padMM)
    .map((q) => [q[0], q[1]] as Pt)
  return { shapeId: shape.id, declaredFamily: shape.family, outlineMM }
}

/** A population being DRAWN is allowed to be nothing yet, one node, two, or briefly wrong: the
 *  canvas has to stay clickable. The corpus outline stands in until the drawn set is a triangle
 *  again, and the reason travels with it so the panel can refuse the save (QA F1). */
export function draftOutline(
  family: LibraryFamily,
  nodesMM: ReadonlyArray<Pt>, sel: LibrarySelection, pitchMM: number, padMM: number,
  frameCols: number, frameRows: number,
): { outlineMM: Pt[]; error: string | null } {
  try {
    const out = specOf(family).outline(nodesMM, frameCols, frameRows, pitchMM, padMM)
    return { outlineMM: out.map((q) => [q[0], q[1]] as Pt), error: null }
  } catch (e) {
    return { outlineMM: libraryPreview(sel, pitchMM, padMM).outlineMM, error: (e as Error).message }
  }
}

/** The Stage preview — composes the arrangement. The lattice field stays the canvas's own. */
/** AUTHORING (Dan, 08-25 — sandbox drafts): a draft's own nodes drawn on the selected frame.
 *  Same conversion as the corpus path: y-down -> engine y-up, frame span from class floors. */
export function draftStageModel(
  sel: LibrarySelection, nodes: ReadonlyArray<readonly [number, number]>, pitchMM: number, padMM: number,
  frameCols: number, frameRows: number,
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
  const { outlineMM, error } = draftOutline(shape.family, nodesMM, sel, pitchMM, padMM, t.cols, t.rows)
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
  return { contour, grid, error }
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
  return { contour, grid }
}
