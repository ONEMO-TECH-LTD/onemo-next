// grid-magnet-library-bridge.ts — THE ONE NARROW BRIDGE from the pure layout-library module to
// the engine's display contract. The ONLY place library records meet engine types. The admin
// panel never imports the engine; the engine never imports the admin UI. No solver policy here —
// a selected record becomes a typed Stage model, nothing is decided.

import type { Contour, Pt } from './types'
import type { GridResult } from './grid-magnet'
import { spotRadiusOf } from './grid-magnet-compute'
import { MAGNET_DIA_SMALL_MM } from './grid-magnet-spec'
import {
  LAYOUT_LIBRARY, transformLayout, kindOf, orientationOf,
  type LibraryTransform,
} from './grid-magnet-library'
import type { ShapeFamily } from './grid-magnet-class'

export interface LibrarySelection {
  frameIndex: number
  layoutIndex: number
  family: ShapeFamily
  view: LibraryTransform
}

export interface LibraryStageModel {
  contour: Contour
  grid: GridResult
  title: string
}

/** A representative demonstration outline per family — display geometry only, engine y-up.
 *  square = the plain sheet · round = corner-padded sheet · triangle = a tee (partial box). */
function demoOutline(family: ShapeFamily, x0: number, y0: number, x1: number, y1: number, m: number): Pt[] {
  if (family === 'round') {
    const c = m
    return [
      [x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c],
      [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c],
    ]
  }
  if (family === 'triangle') {
    const w = x1 - x0
    const sx0 = x0 + w * 0.3, sx1 = x1 - w * 0.3
    const yTop = y1, yBar = y1 - (y1 - y0) * 0.45
    return [
      [x0, yTop], [x1, yTop], [x1, yBar], [sx1, yBar],
      [sx1, y0], [sx0, y0], [sx0, yBar], [x0, yBar],
    ]
  }
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
}

/** Selected library record -> the existing canvas's typed model. The lattice field is left
 *  empty on purpose: the canvas regenerates the displayed field from anchors[0] + pitch
 *  (fieldSpots) — one lattice implementation, never a second recipe. */
export function libraryStageModel(sel: LibrarySelection, pitchMM: number, padMM: number): LibraryStageModel {
  const frame = LAYOUT_LIBRARY[Math.max(0, Math.min(sel.frameIndex, LAYOUT_LIBRARY.length - 1))]
  const layout = frame.layouts[Math.max(0, Math.min(sel.layoutIndex, frame.layouts.length - 1))]
  const { cols, rows, nodes } = transformLayout(frame, layout, sel.view)
  // Engine space is y-up; library rows count downward from the top.
  const pts: Pt[] = nodes.map(([ix, iy]) => [ix * pitchMM, (rows - 1 - iy) * pitchMM])
  const m = pitchMM * 0.75
  const x0 = -m, x1 = (cols - 1) * pitchMM + m
  const y0 = -m, y1 = (rows - 1) * pitchMM + m
  const contour: Contour = { outer: { pts: demoOutline(sel.family, x0, y0, x1, y1, m) }, holes: [] }
  const grid: GridResult = {
    anchors: pts.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM })),
    pitchCentreMM: pitchMM,
    lattice: [],
    phaseMM: [0, 0],
    panMM: [0, 0],
    spotRadiusMM: spotRadiusOf(padMM),
    contactsMM: [],
    segments: [],
    centresMM: [],
    centreMainMM: [(cols - 1) * pitchMM / 2, (rows - 1) * pitchMM / 2],
  }
  const span = `${(cols - 1) * pitchMM || pitchMM}×${(rows - 1) * pitchMM || pitchMM} mm`
  const title = `${layout.name} · ${cols}×${rows} ${orientationOf(cols, rows)} ${kindOf(cols, rows)} · ${sel.family} demo · ${pts.length}⌾ · ${span} · LIBRARY DRAFT`
  return { contour, grid, title }
}
