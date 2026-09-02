// pipeline/types.ts — the data-only boundary of the headless solve (T1).
import type { Contour, GridConfig, GridResult, SafeSegment, UnprotectedEvidence } from '../types'

export interface GridRequest {
  base: Contour
  offsetMM: number
  cfg: GridConfig
  mode: number
  /** Manual scale/pan: solve directly at sizeMM with cfg (carries forcePhaseMM). */
  manualBand?: boolean
  sizeMM: number
  stepSel: number | null
  /** Spec-owned settings that shape the answer's evidence but not its search or cache identity. */
  settings: { protectionPaddingMM: number }
  /** Admin compute scope. Band definitions remain complete; only enabled rows are measured. */
  activeBandIds?: number[]
}

/** Domain facts and domain decisions, never page projection. Field list copied from the worker's
 *  pre-postMessage result (T1 S1); `rungs` are the offered layouts as data, `selectedRungIndex` is the
 *  Rule-4 / manual selection the engine made, `classificationDiagnostics` the classifier's readout. */
export interface GridSolve {
  contour: Contour
  grid: GridResult
  effSize: number
  rungs: Array<{ sizeMM: number; count: number; offMM: number; roles: string[] }>
  selectedRungIndex: number
  segments: SafeSegment[]
  offMM?: number
  classificationDiagnostics?: { family: string; cols: number; rows: number; segWmm: number; segHmm: number }
  bandClass?: unknown
  bandClasses?: unknown
  recommendation?: unknown
  unprotected?: UnprotectedEvidence | null
  offers?: never[]
  diagnostic?: { reason: 'no-lawful-offer'; bestSeatedMM: number }
}
