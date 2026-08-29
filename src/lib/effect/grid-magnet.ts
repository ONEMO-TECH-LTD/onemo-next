// grid-magnet.ts — TEMPORARY S2 SEQUENCER SEAT and the public door.
//
// computeGrid no longer computes: it sequences segment -> centring -> layout and shapes the result.
// S3 moves the sequencing into pipeline/ and the shaping into adapters/, after which this file
// is deleted.

import type { Contour, GridConfig, GridResult, Pt } from './types'
export type { GridConfig, GridResult } from './types'
import { registerLayout } from './units/layout'
import { safeSegments } from './units/segment'
import { centeringAnchors, governMass } from './units/centring'
import { bbox } from './foundation/geometry'
import { contourCentroidOf } from './units/centring'
import { latticeAt, spotRadiusOf } from './units/layout'
import {
  CENTRE_MODE,
  GOVERNOR,
  MASS_DEPTH_MM,
  PADDING_FLOOR_MM,
  SNAP_STEP_MM,
} from './grid-magnet-spec'
import { contactPointsMM } from './grid-magnet-compute'
import { applyCoverage } from './units/layout'
import { assignSizes } from './grid-magnet-logic'
import type { CentreMode, Governor } from './types'

export * from './grid-magnet-spec'
export {
  fieldSpanMM,
  latticeOver,
  safeSegments,
  scaleContour,
  spotRadiusOf,
  type SafeMass,
  type SafeSegment,
} from './grid-magnet-compute'
export { bandOf, type Anchor, type MagnetDia, type MagnetPlan } from './grid-magnet-logic'

/** Sweep the lattice phase at the placement step (ruled 1mm), seat exactly, score, apply coverage, report. */


export function computeGrid(contourMM: Contour, cfg: GridConfig = {}): GridResult {
  // Placement is layout's; this door only shapes the result the bench and the ladder read.
  // Until the pipeline module exists (S3) this door sequences the units: segment measures, centring
  // names the target, layout places. No unit reaches sideways for any of it.
  const pad0 = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const r0 = spotRadiusOf(pad0)
  const outer0 = contourMM.outer.pts
  const bb0 = bbox(outer0)
  const segments0 = safeSegments(contourMM, r0, Math.max(r0, cfg.massDepthMM ?? MASS_DEPTH_MM), cfg.segmentsDetail ?? 'full')
  const mode0 = (cfg.centreMode ?? CENTRE_MODE) as CentreMode
  const gov0 = (cfg.governor ?? GOVERNOR) as Governor
  const centres0 = cfg.centreOverrideMM ? [cfg.centreOverrideMM] : centeringAnchors(mode0, segments0, [(bb0.minX + bb0.maxX) / 2, (bb0.minY + bb0.maxY) / 2], contourCentroidOf(contourMM))
  const masses0 = segments0.flatMap((x) => (x.masses.length ? x.masses : [x]))
  const midY0 = (bb0.minY + bb0.maxY) / 2
  const ruleTarget0: Pt = cfg.centreOverrideMM ?? (mode0 === 2 ? (governMass(masses0, gov0, midY0)?.centreMM ?? centres0[0]) : centres0[0])

  const { bb, pitch, reach, plan, perimeterOnly, outer, segments, centres, ruleTarget,
    bestSeated, bestOx, bestOy, bestKx, bestKy, mainCentre, positioning } =
    registerLayout(contourMM, cfg, { segments: segments0, centres: centres0, ruleTarget: ruleTarget0 })

  const lattice = latticeAt(bb, pitch, bestOx, bestOy)

  const coverage = applyCoverage(bestSeated, perimeterOnly, pitch)
  const anchors = assignSizes(coverage.seated, plan)


  return {
    anchors,
    // Tangency made visible: where each disc meets the outline, within one size step's slack.
    contactsMM: contactPointsMM(outer, coverage.seated, reach, SNAP_STEP_MM),
    pitchCentreMM: pitch,
    lattice,
    phaseMM: [bestOx, bestOy],
    panMM: [bestKx, bestKy],
    spotRadiusMM: reach,
    segments,
    centresMM: positioning === 1 ? [ruleTarget] : centres,
    centreMainMM: mainCentre,
  }
}

/** One holding rung in a band — retained only as the page's ladder view-model type until the
 *  adapter seam lands in S3. The walk that produced it is deleted. */
export interface BandSnapPoint { sizeMM: number; count: number }
