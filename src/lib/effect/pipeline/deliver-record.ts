// pipeline/deliver-record.ts — a RELEASED RECORD through the delivery half of the pipeline, and
// nothing of the search half. Its own file so the bench can reach it directly, on the main thread,
// without loading the solver and its caches: a record is precomputed and must land at once, never
// behind a solve in the worker's queue (QA, 2026-09-09).

import { applyCoverage, assignSizes } from '@/lib/effect/grid-magnet-logic'
import { measureProtection } from '@/lib/effect/units/protection'
import { recordStageModel } from '@/lib/effect/grid-magnet-library-bridge'
import { LOCK_PROFILE, profileSnapshot, sealRequest } from '@/lib/effect/locks'
import { grownContour } from '@/lib/effect/offset'
import { EDGE_PADDING_MM, RELEASED_PADDING_MM, SHAPE_RADIUS_MM } from '@/lib/effect/grid-magnet-spec'
import { paddingDiscSpec } from '@/lib/effect/foundation/padding-disc'
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
  // THE LINE'S PADDING IS ITS OWN — read straight from the request, never recomputed from the
  // disc. Deriving it from `paddingDisc.halfMM` is what made a canon record's outline follow the
  // cell, so a 24mm disc inside a 144mm effect could not be expressed at all (Dan, 2026-09-22).
  const paddingDisc = paddingDiscSpec(RELEASED_PADDING_MM, {
    shape: cfg.paddingShape, radiusMM: cfg.paddingRadiusMM, discOffsetMM: cfg.discOffsetMM,
  })
  const edgePaddingMM = Math.max(0, cfg.edgePaddingMM ?? EDGE_PADDING_MM)
  const contour = grownContour(stage.contour, edgePaddingMM, cfg.shapeRadiusMM ?? SHAPE_RADIUS_MM)
  const { seated } = applyCoverage(stage.grid.anchors.map((a) => a.p), cfg.perimeterOnly !== false, pitchMM)
  const anchors = assignSizes(seated, cfg.plan ?? 'all6')
  // THE SAME PADDING VARIANT a searched shape gets — the edge padding and the disc apply to every
  // shape, canon and wrapped alike (Dan, 2026-09-22). Without this a released record drew circles
  // while its outline had already been grown.
  const grid = { ...stage.grid, anchors, paddingDisc }
  const evidence = measureProtection(contour, anchors.map((a) => a.p), pitchMM, protectionPaddingMM, anchors.map((a) => a.dia / 2))
  return {
    // the legal area is the PUBLISHED record's — the edge padding grows material, never where a
    // magnet may sit, so an overlay drawn from the grown outline told Dan the legal area doubled
    contour, legalContour: stage.contour, grid, effSize: Math.max(record.widthMM, record.heightMM) + 2 * edgePaddingMM,
    rungs: [], selectedRungIndex: 0, segments: [], unprotected: evidence,
    profile: profileSnapshot(LOCK_PROFILE),
  }
}
