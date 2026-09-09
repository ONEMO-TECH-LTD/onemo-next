// pipeline/deliver-record.ts — a RELEASED RECORD through the delivery half of the pipeline, and
// nothing of the search half. Its own file so the bench can reach it directly, on the main thread,
// without loading the solver and its caches: a record is precomputed and must land at once, never
// behind a solve in the worker's queue (QA, 2026-09-09).

import { applyCoverage, assignSizes } from '@/lib/effect/grid-magnet-logic'
import { measureProtection } from '@/lib/effect/units/protection'
import { recordStageModel } from '@/lib/effect/grid-magnet-library-bridge'
import { LOCK_PROFILE, profileSnapshot, sealRequest } from '@/lib/effect/locks'
import type { GridSolve, RecordRequest } from './types'

/** A RELEASED RECORD, DELIVERED. The Library answered the search — magnets, outline, size are the
 *  record's — so nothing is classified, seated or wrapped. What every solve still owes the answer
 *  is the DELIVERY: the sealed profile over the caller's dials, the coverage rule over the magnets,
 *  the magnet plan's sizes, and the protection evidence measured on exactly what is delivered.
 *  Dropping those with the search is what put nine 3mm magnets under "Perimeter belt · All 8mm"
 *  (QA F1, 2026-09-09). */
export function deliverRecord(req: RecordRequest): GridSolve {
  const { record, cfg, settings: { protectionPaddingMM } } = sealRequest({ ...req, cfg: { ...req.cfg, pitchMM: req.record.pitchMM } })
  // a record is published AT a lattice; its pitch is its own, not a dial
  const pitchMM = record.pitchMM
  const stage = recordStageModel(record, pitchMM)
  const { seated } = applyCoverage(stage.grid.anchors.map((a) => a.p), cfg.perimeterOnly !== false, pitchMM)
  const anchors = assignSizes(seated, cfg.plan ?? 'all6')
  const grid = { ...stage.grid, anchors }
  const evidence = measureProtection(stage.contour, anchors.map((a) => a.p), pitchMM, protectionPaddingMM, anchors.map((a) => a.dia / 2))
  return {
    contour: stage.contour, grid, effSize: Math.max(record.widthMM, record.heightMM),
    rungs: [], selectedRungIndex: 0, segments: [], unprotected: evidence,
    profile: profileSnapshot(LOCK_PROFILE),
  }
}
