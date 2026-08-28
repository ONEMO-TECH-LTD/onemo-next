// grid-magnet.ts — the engine bridge: computeGrid and the band snap, wiring spec + compute + logic.
// One import door for consumers; the modules stay behind it.

import type { Contour, GridConfig, GridResult, Pt } from './types'
export type { GridConfig, GridResult } from './types'
import { registerLayout } from './units/layout'
import { safeSegments } from './units/segment'
import { centeringAnchors, governMass } from './units/centring'
import { bbox } from './foundation/geometry'
import { centroidOf } from './units/centring'
import { latticeAt, spotRadiusOf } from './units/layout'
import {
  CENTRE_MODE,
  GOVERNOR,
  MASS_DEPTH_MM,
  MIN_EFFECT_MM,
  PADDING_FLOOR_MM,
  SNAP_STEP_MM,
} from './grid-magnet-spec'
import { contactPointsMM, maxPressMM } from './grid-magnet-compute'
import { fieldSpanMM } from './units/layout'
import { bandOf } from './units/layout'
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
  const segments0 = safeSegments(outer0, r0, Math.max(r0, cfg.massDepthMM ?? MASS_DEPTH_MM), cfg.segmentsDetail ?? 'full')
  const mode0 = (cfg.centreMode ?? CENTRE_MODE) as CentreMode
  const gov0 = (cfg.governor ?? GOVERNOR) as Governor
  const centres0 = cfg.centreOverrideMM ? [cfg.centreOverrideMM] : centeringAnchors(mode0, segments0, [(bb0.minX + bb0.maxX) / 2, (bb0.minY + bb0.maxY) / 2], centroidOf(outer0))
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

/** One holding rung in a band: the size and its seat count. */
export interface BandSnapPoint { sizeMM: number; count: number }

/** The walk range: the band as a RANGE; above the last band, up to the derived field span. */
function snapRange(cfg: GridConfig, fromMM: number): [number, number] {
  const band = bandOf(fromMM)
  if (band) return [band.minMM, band.maxMM]
  return [fromMM, fieldSpanMM(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))]
}

/** One pass over the band: the per-count contact sizes AND the best-seated rung (fallback). */
function bandWalk(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { points: BandSnapPoint[]; bestSeatedMM: number } {
  const [lo, hi] = snapRange(cfg, fromMM)
  const walkCfg: GridConfig = { ...cfg, segmentsDetail: 'light' }
  const solve = (mm: number): GridResult => {
    let g = cfg.solveCache?.get(mm)
    if (!g) { g = computeGrid(sized(mm), walkCfg); cfg.solveCache?.set(mm, g) }
    return g
  }
  // Counts already seating just below the band reached contact earlier — loose here, not rungs.
  const below = lo - stepMM >= MIN_EFFECT_MM ? solve(lo - stepMM).anchors.length : 0
  const points: BandSnapPoint[] = []
  const seen = new Set<number>()
  for (let c = 1; c <= below; c++) seen.add(c)
  const reach = spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
  let bestSeatedMM = lo, bestSeats = -1
  for (let mm = lo; mm <= hi; mm += stepMM) {
    const grid = solve(mm)
    const count = grid.anchors.length
    if (count > bestSeats) { bestSeats = count; bestSeatedMM = mm }
    // THE RIGID GATE (Dan): every disc must touch within the allowance — 0 = touch,
    // 1 = 1mm space — measured with one size-step of slack (the walk's own resolution).
    // A count whose layout leaves a disc floating past that is NOT an option here;
    // Auto mode adapts the allowance instead.
    const contour = sized(mm)
    const rigid = count >= 1
      && maxPressMM(contour.outer.pts, grid.anchors.map((a) => a.p), reach) <= stepMM
    if (rigid && !seen.has(count)) {
      seen.add(count)
      points.push({ sizeMM: mm, count })
    }
  }
  return { points, bestSeatedMM }
}

/**
 * Band snap under the contact law. `ladder` = one rung per magnet count at its contact size;
 * the landing pick is the smallest size at the band's maximum count. When no count reaches
 * contact inside the band, the best-seated size shows as an explicit fallback, never a fit.
 */
export function fitSizeInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { sizeMM: number; grid: GridResult; ladder: BandSnapPoint[]; pickIdx: number } {
  const { points, bestSeatedMM } = bandWalk(sized, cfg, fromMM, stepMM)
  const dispCfg: GridConfig = cfg
  if (points.length) {
    const maxCount = Math.max(...points.map((p) => p.count))
    const pickIdx = points.findIndex((p) => p.count === maxCount)
    return { sizeMM: points[pickIdx].sizeMM, grid: computeGrid(sized(points[pickIdx].sizeMM), dispCfg), ladder: points, pickIdx }
  }
  return { sizeMM: bestSeatedMM, grid: computeGrid(sized(bestSeatedMM), dispCfg), ladder: [], pickIdx: 0 }
}
