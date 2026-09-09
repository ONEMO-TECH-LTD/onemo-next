// pipeline/types.ts — the data-only boundary of the headless solve (T1).
import type { Contour, GridConfig, GridResult, SafeSegment, UnprotectedEvidence } from '../types'
import type { LockProfile } from '../locks'
import type { CatalogueEntry } from '../library'

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

/** A RELEASED RECORD to deliver — no search: the record's own magnets, outline and size, put through
 *  the same delivery every solve gets (coverage, magnet plan, protection, the sealed profile). The
 *  config carries only the delivery dials; padding, centring, governor and ruler are search dials and
 *  have nothing to act on here (QA F1, 2026-09-09). */
export interface RecordRequest {
  record: CatalogueEntry
  cfg: GridConfig
  settings: { protectionPaddingMM: number }
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
  /** THE SEALED PROFILE this answer was made under — which dials were locked, at what value. A record
   *  proves what was fixed when it was made (Dan, 2026-09-04: locks "go through into the spec as
   *  locked"). */
  profile: LockProfile
}
