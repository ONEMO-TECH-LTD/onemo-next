// grid-magnet.ts — TEMPORARY S2 SEQUENCER SEAT and the public door.
//
// computeGrid no longer computes: it sequences segment -> centring -> layout and shapes the result.
// S3 moves the sequencing into pipeline/ and the shaping into adapters/, after which this file
// is deleted.

import type { Contour, GridConfig, GridResult, Pt } from './types'
export type { GridConfig, GridResult } from './types'
import { registerLayout } from './units/layout'
import { classificationSeedMM, legalUnionBoxMM } from './units/classifier'
import { safeSegments } from './units/segment'
import { centeringAnchors, governMass } from './units/centring'
import { bbox } from './foundation/geometry'
import { contourCentroidOf } from './units/centring'
import { latticeAt, spotRadiusOf } from './units/layout'
import {
  BANDS,
  CENTRE_MODE,
  GOVERNOR,
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
export { bandOf, bandOuterMM, legalOfOuterMM, type Anchor, type MagnetDia, type MagnetPlan } from './grid-magnet-logic'

/** Sweep the lattice phase at the placement step (ruled 1mm), seat exactly, score, apply coverage, report. */


/** ONE ROW PER BAND — what the classifier MEASURES. Dan, 2026-08-30: "classifier must know no
 *  count at this step, it must just send the sweeper the outer/inner box dimensions in each band".
 *
 *  So there is no grid here, no magnet count, no position arithmetic and no knowledge of the
 *  lattice. Two boxes and a centre. Counting positions, fitting a layout and dropping what will not
 *  hold belong to the lookup, the sweep and wrap.
 *
 *  It is a NUDGE, not a stage: it decides no size and rejects nothing. */
export interface BandClass {
  bandId: number
  /** The trial size this row was measured at — the middle of the band's outline range. */
  seedMM: number
  /** The shape's own bounding box at that size. */
  outerWidthMM: number
  outerHeightMM: number
  /** Where a magnet CENTRE may sit, once the 12mm rim comes off every edge and hole. */
  legalWidthMM: number
  legalHeightMM: number
  /** The governed centre at that size — what a layout gets placed on. */
  anchorMM: Pt
}

/** Measure the shape at every band's trial size. The caller supplies the anchor query, exactly as
 *  wrap does — this sequences units, it does not reach sideways for a centre. */
export function classifyBands(
  sized: (mm: number) => Contour, cfg: GridConfig, anchorAt?: (mm: number) => Pt,
): BandClass[] {
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const r = spotRadiusOf(pad)
  const rows: BandClass[] = []
  for (const band of BANDS) {
    // No board skip. A trial size past the board is not an error and guards nothing — the previous
    // skip was invented, and it silently deleted B9-B11 because the size ceiling still reads the
    // COLUMN count for both axes and so believes the board is square.
    const seedMM = classificationSeedMM(band, pad)
    const contour = sized(seedMM)
    const legal = legalUnionBoxMM(safeSegments(contour, r, 'light'))
    if (!legal) continue                      // nothing can hold a magnet at that size
    const bb = bbox(contour.outer.pts)
    rows.push({
      bandId: band.id, seedMM,
      outerWidthMM: bb.maxX - bb.minX, outerHeightMM: bb.maxY - bb.minY,
      legalWidthMM: legal.maxX - legal.minX, legalHeightMM: legal.maxY - legal.minY,
      anchorMM: anchorAt ? anchorAt(seedMM) : [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2],
    })
  }
  return rows
}


export function computeGrid(contourMM: Contour, cfg: GridConfig = {}): GridResult {
  // Placement is layout's; this door only shapes the result the bench and the ladder read.
  // Until the pipeline module exists (S3) this door sequences the units: segment measures, centring
  // names the target, layout places. No unit reaches sideways for any of it.
  const pad0 = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const r0 = spotRadiusOf(pad0)
  const outer0 = contourMM.outer.pts
  const bb0 = bbox(outer0)
  const segments0 = safeSegments(contourMM, r0, cfg.segmentsDetail ?? 'full')
  const mode0 = (cfg.centreMode ?? CENTRE_MODE) as CentreMode
  const gov0 = (cfg.governor ?? GOVERNOR) as Governor
  const centres0 = cfg.centreOverrideMM ? [cfg.centreOverrideMM] : centeringAnchors(mode0, segments0, [(bb0.minX + bb0.maxX) / 2, (bb0.minY + bb0.maxY) / 2], contourCentroidOf(contourMM))
  const masses0 = segments0.flatMap((x) => (x.masses.length ? x.masses : [x]))
  const midY0 = (bb0.minY + bb0.maxY) / 2
  const ruleTarget0: Pt = cfg.centreOverrideMM ?? (mode0 === 2 ? (governMass(masses0, gov0, midY0)?.centreMM ?? centres0[0]) : centres0[0])

  const { bb, pitch, reach, plan, perimeterOnly, outer, segments, ruleTarget,
    bestSeated, bestOx, bestOy, bestKx, bestKy, mainCentre } =
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
    centresMM: [ruleTarget],
    centreMainMM: mainCentre,
  }
}

/** One holding rung in a band — retained only as the page's ladder view-model type until the
 *  adapter seam lands in S3. The walk that produced it is deleted. */
export interface BandSnapPoint { sizeMM: number; count: number }
