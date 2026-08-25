// grid-magnet-library-bridge.ts — THE ONE NARROW BRIDGE from the pure layout-library module to
// engine types. Two outputs around one conversion: `libraryArrangement` (stable-ID record with
// nodes in mm — the future pipeline hands its nodesMM straight to wrapGroup) and
// `libraryStageModel` (the Stage preview, composed from the arrangement). No solver policy,
// no UI imports; shapes and layouts are materialised from the pure module, never generated here.

import type { Contour, Pt } from './types'
import type { GridResult } from './grid-magnet'
import { spotRadiusOf } from './grid-magnet-compute'
import { MAGNET_DIA_SMALL_MM } from './grid-magnet-spec'
import {
  selectedRecords, transformLayout, kindOf, orientationOf, frameKeyOf,
  type LibrarySelection, type LibraryShapeId,
} from './grid-magnet-library'
import type { ShapeFamily } from './grid-magnet-class'

export type { LibrarySelection } from './grid-magnet-library'

export interface LibraryArrangement {
  shapeId: LibraryShapeId
  family: ShapeFamily
  frameKey: string
  layoutId: string
  cols: number
  rows: number
  /** Node positions in mm, engine y-up — wrapGroup-ready local geometry. */
  nodesMM: readonly Pt[]
  /** The selected shape's outline in mm, engine y-up, spanning the frame. */
  outlineMM: readonly Pt[]
}

export interface LibraryStageModel {
  contour: Contour
  grid: GridResult
  title: string
}

/** Selected records -> stable-ID arrangement in mm. The ONE conversion. */
export function libraryArrangement(sel: LibrarySelection, pitchMM: number): LibraryArrangement {
  const { shape, frame, layout, isPrimitive } = selectedRecords(sel)
  const t = isPrimitive
    ? { cols: Math.max(...layout.nodes.map(([x]) => x)) + 1, rows: Math.max(...layout.nodes.map(([, y]) => y)) + 1, nodes: layout.nodes.map(([x, y]) => [x, y] as [number, number]) }
    : transformLayout(frame, layout, sel.view)
  // Engine space is y-up; library rows count downward from the top.
  const nodesMM: Pt[] = t.nodes.map(([ix, iy]) => [ix * pitchMM, (t.rows - 1 - iy) * pitchMM])
  // The shape spans the frame plus the margin; 'square' aspect keeps a square span.
  const m = pitchMM * 0.75
  const spanW = (t.cols - 1) * pitchMM + 2 * m, spanH = (t.rows - 1) * pitchMM + 2 * m
  const side = Math.max(spanW, spanH)
  const w = shape.aspect === 'square' ? side : spanW
  const h = shape.aspect === 'square' ? side : spanH
  const cx = (t.cols - 1) * pitchMM / 2, cy = (t.rows - 1) * pitchMM / 2
  const outlineMM: Pt[] = shape.outline.map(([ux, uy]) => [cx - w / 2 + ux * w, cy + h / 2 - uy * h])
  return {
    shapeId: shape.id, family: shape.family, frameKey: frameKeyOf(frame), layoutId: layout.name,
    cols: t.cols, rows: t.rows, nodesMM, outlineMM,
  }
}

/** The Stage preview — composes the arrangement into the canvas's typed model. The lattice
 *  field stays the canvas's own (fieldSpots regenerates from anchors[0] + pitch). */
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
    centreMainMM: [(a.cols - 1) * pitchMM / 2, (a.rows - 1) * pitchMM / 2],
  }
  const span = `${(a.cols - 1) * pitchMM || pitchMM}×${(a.rows - 1) * pitchMM || pitchMM} mm`
  const title = `${a.shapeId} · ${a.layoutId} · ${a.cols}×${a.rows} ${orientationOf(a.cols, a.rows)} ${kindOf(a.cols, a.rows)} · ${a.family} · ${a.nodesMM.length}⌾ · ${span} · LIBRARY DRAFT`
  return { contour, grid, title }
}
