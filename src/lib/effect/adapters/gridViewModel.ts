// adapters/gridViewModel.ts — projects the engine's GridSolve onto the bench page model (T1 S2).
// Identity on day one: every value the page shows is the same value the worker posted before; only
// the OWNERSHIP moved. Never calls judge or classifier — selectedRungIndex and
// classificationDiagnostics are engine decisions carried through, not recomputed.

import type { Contour, GridResult, SafeSegment, UnprotectedEvidence } from '../types'
import type { GridSolve } from '../pipeline/types'
import type { Band } from '../grid-magnet-spec'
import { bandOuterMM, pathToSvgD, type OutlinePath } from '../grid-magnet'

/** The bench model exactly as the page consumes it. */
export interface GridPageModel {
  contour: Contour
  grid: GridResult
  effSize: number
  ladder: Array<{ sizeMM: number; count: number; offMM: number; roles: string[] }>
  idx: number
  segments: SafeSegment[]
  offMM?: number
  recog?: { family: string; cols: number; rows: number; segWmm: number; segHmm: number }
  unprotected?: UnprotectedEvidence | null
  bandClass?: { bandId: number; seedMM: number; legalWidthMM: number; legalHeightMM: number; rulerWidthMM: number; rulerHeightMM: number } | null
  bandClasses?: unknown
  recommendation?: { cols: number; rows: number; count: number } | null
  offers?: never[]
  diagnostic?: { reason: 'no-lawful-offer'; bestSeatedMM: number }
}

export function toPageModel(solve: GridSolve): GridPageModel {
  const { rungs, selectedRungIndex, classificationDiagnostics, ...rest } = solve
  return {
    ...(rest as Omit<GridPageModel, 'ladder' | 'idx' | 'recog'>),
    ladder: rungs,
    idx: selectedRungIndex,
    ...(classificationDiagnostics !== undefined ? { recog: classificationDiagnostics } : {}),
  }
}

/** The outline range a band spans for the shell's manual-size controls — a delegate to the engine's
 *  own conversion (units/layout), so the page holds no engine arithmetic (T2). */
export function bandRangeForControl(band: Band, paddingMM: number): { minMM: number; maxMM: number } {
  return bandOuterMM(band, paddingMM)
}

/** THE OUTLINE AS THE SCREEN SHOULD DRAW IT: the exact path where the ring has one — arcs as `A`,
 *  cubics as `C` — and the point view only for a ring born as points. The shell stroked the flattened
 *  view and at zoom it read as a polygon, because it was one (Dan, 2026-09-05: "it is absolute
 *  polygonal line"). Engine millimetres are y-up; the screen is y-down, so the path is flipped here. */
export function outlineSvgD(contour: Contour): string {
  if (contour.outer.path) return pathToSvgD(contour.outer.path, { flipY: true })
  return 'M ' + contour.outer.pts.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join(' L ') + ' Z'
}

/** Any exact path, as the screen draws it — same flip as the outline. */
export function svgDOf(path: OutlinePath): string {
  return pathToSvgD(path, { flipY: true })
}
