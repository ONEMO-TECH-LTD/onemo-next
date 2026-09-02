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
  /** Display-only protector input. It deliberately lives outside GridConfig. */
  protectionPaddingMM?: number
  /** Admin compute scope. Band definitions remain complete; only enabled rows are measured. */
  activeBandIds?: number[]
}

/** S1: exactly what the worker posted as `model` — the projection split arrives in S2. */
export interface GridSolve {
  contour: Contour
  grid: GridResult
  effSize: number
  ladder: Array<{ sizeMM: number; count: number; offMM: number; roles: string[] }>
  idx: number
  segments: SafeSegment[]
  offMM?: number
  recog?: { family: string; cols: number; rows: number; segWmm: number; segHmm: number }
  bandClass?: unknown
  bandClasses?: unknown
  recommendation?: unknown
  unprotected?: UnprotectedEvidence | null
  offers?: never[]
  diagnostic?: { reason: 'no-lawful-offer'; bestSeatedMM: number }
}
