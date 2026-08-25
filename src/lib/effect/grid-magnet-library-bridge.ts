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
import { classFloorMM, type AxisClass, type ShapeFamily } from './grid-magnet-class'

export type { LibrarySelection } from './grid-magnet-library'

export interface LibraryArrangement {
  shapeId: LibraryShapeId
  family: ShapeFamily
  /** The canonical frame the selection named. */
  sourceFrameKey: string
  /** The ACTUAL frame identity after the view transform — what the pipeline must believe. */
  frameKey: string
  frameCols: number
  frameRows: number
  /** 'prim:*' identity is preserved — a primitive never masquerades as a frame layout. */
  layoutId: string
  layoutKind: 'frame' | 'primitive'
  /** A square-aspect shape on a non-square frame is geometrically incompatible — marked,
   *  never stretched and never silently re-framed. */
  shapeCompatible: boolean
  /** Node positions in mm, engine y-up — wrapGroup-ready local geometry. */
  nodesMM: readonly Pt[]
  /** The shape outline in mm, engine y-up, spanning the frame's CLASS FLOORS. */
  outlineMM: readonly Pt[]
}

export interface LibraryStageModel {
  contour: Contour
  grid: GridResult
  title: string
}

/** Selected records -> stable-ID arrangement in mm. The ONE conversion. Throws on unknown IDs. */
export function libraryArrangement(sel: LibrarySelection, pitchMM: number): LibraryArrangement {
  const { shape, frame, layout, isPrimitive } = selectedRecords(sel)
  const frameCols = sel.view.transpose ? frame.rows : frame.cols
  const frameRows = sel.view.transpose ? frame.cols : frame.rows
  const cx = (frameCols - 1) * pitchMM / 2, cy = (frameRows - 1) * pitchMM / 2
  let nodesMM: Pt[]
  if (isPrimitive) {
    // The primitive keeps its ruled geometry AND the selected frame context: its group is
    // translated so its middle sits on the frame middle. The wrap solver re-centres the local
    // group itself, so this translation is display placement, not engine policy (QA F2).
    const raw: Pt[] = layout.nodes.map(([x, y]) => [x * pitchMM, y * pitchMM])
    const xs = raw.map((q) => q[0]), ys = raw.map((q) => q[1])
    const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2
    nodesMM = raw.map(([x, y]) => [x - mx + cx, y - my + cy])
  } else {
    const t = transformLayout(frame, layout, sel.view)
    nodesMM = t.nodes.map(([ix, iy]) => [ix * pitchMM, (t.rows - 1 - iy) * pitchMM])
  }
  // THE FRAME'S PHYSICAL SPAN IS THE CLASS FLOOR (QA F1): 24 + (lines-1)*pitch per axis — the
  // classifier's own law, so classifyShape(outline) returns exactly the selected frame.
  const w0 = classFloorMM(frameCols as AxisClass, pitchMM)
  const h0 = classFloorMM(frameRows as AxisClass, pitchMM)
  const shapeCompatible = shape.aspect === 'frame' || frameCols === frameRows
  const w = shapeCompatible ? w0 : Math.max(w0, h0)
  const h = shapeCompatible ? h0 : Math.max(w0, h0)
  const outlineMM: Pt[] = shape.outline.map(([ux, uy]) => [cx - w / 2 + ux * w, cy + h / 2 - uy * h])
  return {
    shapeId: shape.id, family: shape.family,
    sourceFrameKey: frameKeyOf(frame), frameKey: frameCols + 'x' + frameRows,
    frameCols, frameRows,
    layoutId: isPrimitive ? 'prim:' + layout.name : layout.name,
    layoutKind: isPrimitive ? 'primitive' : 'frame',
    shapeCompatible, nodesMM, outlineMM,
  }
}

/** The Stage preview — composes the arrangement. The lattice field stays the canvas's own. */
export function libraryStageModel(sel: LibrarySelection, pitchMM: number, padMM: number): LibraryStageModel {
  const a = libraryArrangement(sel, pitchMM)
  const contour: Contour = { outer: { pts: [...a.outlineMM] }, holes: [] }
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
  const title = `${a.shapeId} · ${a.layoutId} · ${a.frameKey} ${orientationOf(a.frameCols, a.frameRows)} ${kindOf(a.frameCols, a.frameRows)} · ${a.family} · ${a.nodesMM.length}⌾ · ${w}×${h} mm${a.shapeCompatible ? '' : ' · shape/frame mismatch'} · LIBRARY DRAFT`
  return { contour, grid, title }
}
