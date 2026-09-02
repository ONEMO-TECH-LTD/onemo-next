// adapters/gridViewModel.ts — projects the engine's GridSolve onto the bench page model (T1 S2).
// Identity on day one: every value the page shows is the same value the worker posted before; only
// the OWNERSHIP moved. Never calls judge or classifier — selectedRungIndex and
// classificationDiagnostics are engine decisions carried through, not recomputed.

import type { Contour, GridResult, SafeSegment, UnprotectedEvidence } from '../types'
import type { GridSolve } from '../pipeline/types'
import type { Band } from '../grid-magnet-spec'
import { bandOuterMM } from '../grid-magnet'

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
