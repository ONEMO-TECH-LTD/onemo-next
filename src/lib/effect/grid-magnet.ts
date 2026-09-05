// grid-magnet.ts — TEMPORARY S2 SEQUENCER SEAT and the public door.
//
// computeGrid no longer computes: it sequences segment -> centring -> layout and shapes the result.
// S3 moves the sequencing into pipeline/ and the shaping into adapters/, after which this file
// is deleted.

import type { Contour, GridConfig, GridResult, Pt } from './types'
export type { GridConfig, GridResult } from './types'
import { bandOuterMM } from './grid-magnet-logic'
import { registerLayout } from './units/layout'
import { classificationSeedMM, legalRegionBoxMM } from './units/classifier'
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
  type Band,
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
// The screen draws what the engine measured, so the engine's own path serialiser is part of the door:
// the alternative is a second one in the shell, which is how the drawn outline became a polygon.
export { pathToSvgD, type OutlinePath } from './foundation/path'

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
  /** The selected ruler's dimensions, supplied to the catalogue matcher. */
  rulerWidthMM: number
  rulerHeightMM: number
  /** The governed centre at that size — what a layout gets placed on. */
  anchorMM: Pt
}

/** Measure the shape at every band's trial size. The caller supplies the anchor query, exactly as
 *  wrap does — this sequences units, it does not reach sideways for a centre. */
export function classifyBands(
  sized: (mm: number) => Contour, cfg: GridConfig, anchorAt?: (mm: number) => Pt,
  bands: ReadonlyArray<Band> = BANDS,
): BandClass[] {
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const r = spotRadiusOf(pad)
  const rows: BandClass[] = []
  for (const band of bands) {
    // No board skip. A trial size past the board is not an error and guards nothing — the previous
    // skip was invented, and it silently deleted B9-B11 because the size ceiling still reads the
    // COLUMN count for both axes and so believes the board is square.
    //
    // THE MIDPOINT PROBE CAN MISS (Butterfly B1, 2026-09-02): a shape too thin to seat anything at
    // the band's middle can still seat a frame at its ceiling, and one empty probe was disqualifying
    // the whole band into the free-grid fallback. When the middle holds no legal region, the band's
    // ceiling is probed before the band is called empty. Shapes that classify at the middle are
    // untouched.
    const midMM = classificationSeedMM(band, pad)
    const ceilMM = bandOuterMM(band, pad).maxMM
    const seedMM = legalRegionBoxMM(sized(midMM), r) ? midMM : ceilMM
    const contour = sized(seedMM)
    // THE EXACT LEGAL BOX, from the same Clipper2 inward offset that seating and wrap use — not
    // from the 2mm segmentation mesh. QA proved the mesh box is not transform-invariant: a 7-point
    // polygon read 239.18mm (no band) and its horizontal mirror 238.81mm (B5), with mirrored
    // disagreement up to 5.97mm across 1,000 shapes. A shape's band must not change when you flip
    // it, so the ruler cannot be a sampled display field.
    const bb = bbox(contour.outer.pts)
    // WHICH RULER — 'legal' is released; 'outer' is the test instrument Dan asked for so both can
    // be tried on the same shape. The legal box remains a separate measured fact in either mode;
    // selecting outer changes only what the matcher reads.
    const legal = legalRegionBoxMM(contour, r)
    const ruler = (cfg.classifierRuler ?? 'legal') === 'outer' ? bb : legal
    if (!ruler || ruler.maxX < ruler.minX || ruler.maxY < ruler.minY) continue
    rows.push({
      bandId: band.id, seedMM,
      outerWidthMM: bb.maxX - bb.minX, outerHeightMM: bb.maxY - bb.minY,
      legalWidthMM: legal ? legal.maxX - legal.minX : 0,
      legalHeightMM: legal ? legal.maxY - legal.minY : 0,
      rulerWidthMM: ruler.maxX - ruler.minX, rulerHeightMM: ruler.maxY - ruler.minY,
      anchorMM: anchorAt ? anchorAt(seedMM) : [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2],
    })
  }
  return rows
}


export function computeGrid(
  contourMM: Contour, cfg: GridConfig = {},
  /** A suggested layout's offsets about its own middle — the search's starting points. */
  canonLocalMM?: ReadonlyArray<Pt>,
): GridResult {
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
    bestSeated, bestOx, bestOy, bestKx, bestKy, mainCentre, seatings, canonSeatings } =
    registerLayout(contourMM, cfg, { segments: segments0, centres: centres0, ruleTarget: ruleTarget0 },
      canonLocalMM)

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
    legalBoxMM: legalRegionBoxMM(contourMM, r0),
    centresMM: [ruleTarget],
    centreMainMM: mainCentre,
    // Search registrations stay raw; coverage is output processing for the drawn answer only.
    seatings,
    // NO BELT ON THE SUGGESTED LAYOUT: a 3x3 IS nine magnets, and thinning it to a ring means the
    // answer returned is not the record that was looked up.
    canonSeatings,
  }
}

/** One holding rung in a band — retained only as the page's ladder view-model type until the
 *  adapter seam lands in S3. The walk that produced it is deleted. */
export interface BandSnapPoint { sizeMM: number; count: number }
