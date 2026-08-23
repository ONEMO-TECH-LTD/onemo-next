// Magnetic-grid engine: orchestration over spec, compute and Logic.
// One import door for consumers; the modules stay behind it.

import type { BandSnapPoint, CentreMode, Contour, Governor, GridConfig, GridResult, Placement, PlacementCandidate, Pt } from './spec'
import {
  CENTRE_MODE,
  DEFAULT_PITCH_MM,
  FLAP_MM,
  GOVERNOR,
  MASS_DEPTH_MM,
  MIN_EFFECT_MM,
  PADDING_FLOOR_MM,
  RELEASED_PADDING_MM,
} from './spec'
import {
  bbox,
  centroidOf,
  fieldSpanMM,
  latticeAt,
  makeSeatPredicate,
  measureCentreBranches,
  measureCentrePlacements,
  measureExtremeCorners,
  measureParity,
  measureWrap,
  safeSegments,
  splitPerimeter,
  spotRadiusOf,
} from './compute'
import {
  applyCoverage,
  assignSizes,
  bandOf,
  centrePhaseCandidates,
  centeringAnchors,
  chooseCentrePlacement,
  evaluateWrap,
  governMass,
  inspectionConcessions,
} from './logic'

export * from './spec'
export {
  fieldSpanMM,
  contourBoundaryTruth,
  latticeOver,
  safeSegments,
  scaleContour,
  spotRadiusOf,
} from './compute'
export { bandOf } from './logic'

/** Sweep the lattice phase at the placement step (ruled 1mm), seat exactly, score, apply coverage, report. */
const mod = (v: number, m: number) => ((v % m) + m) % m

export function computeGrid(contourMM: Contour, requestedSizeMM: number, cfg: GridConfig = {}): GridResult {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? RELEASED_PADDING_MM)
  // Coverage reach from a magnet centre: the spot plus the dialled flap allowance.
  const reach = spotRadiusOf(pad) + Math.max(0, cfg.flapMM ?? FLAP_MM)
  const plan = cfg.plan ?? 'all6'
  const perimeterOnly = cfg.perimeterOnly ?? true
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2

  const fits = makeSeatPredicate(outer, spotRadiusOf(pad))

  const massDepth = Math.max(spotRadiusOf(pad), cfg.massDepthMM ?? MASS_DEPTH_MM)
  const segments = safeSegments(outer, spotRadiusOf(pad), massDepth, cfg.segmentsDetail ?? 'full')

  // THE shape's centres — chosen by the centre-mode switch (logic's table). Every returned
  // point anchors the slide walk; single-target modes also fix the balance target.
  const mode = (cfg.centreMode ?? CENTRE_MODE) as CentreMode
  const governor = (cfg.governor ?? GOVERNOR) as Governor
  const centreMeasurements = measureCentreBranches(segments, [cx, cy], centroidOf(outer))
  const centres = centeringAnchors(mode, centreMeasurements)
  // Under CENTRE RULES one point rules outright; Masses names it via the governor switch.
  const midY = (bb.minY + bb.maxY) / 2
  const ruleTarget: Pt = mode === 2 ? (governMass(centreMeasurements.masses, governor, midY)?.centreMM ?? centres[0]) : centres[0]

  // One render-complete candidate per phase. The frozen Centre prescreen only SELECTS a phase;
  // the final Law population is the regenerated lattice filtered by the one signed whole-mm
  // clearance, Coverage and the magnet plan act on that population, and parity is measured.
  // The candidate's size is the caller's requested ladder size, never the (offset) geometry's bbox.
  const sizeMM = requestedSizeMM
  const candidateAt = (phaseMM: Pt, placement: Placement, canon: number): PlacementCandidate => {
    const lattice = latticeAt(bb, pitch, phaseMM[0], phaseMM[1])
    const law = measureWrap(contourMM, lattice, pitch, spotRadiusOf(pad))
    const coverage = applyCoverage(law.seated, perimeterOnly, splitPerimeter(law.seated, pitch))
    const anchors = assignSizes(measureExtremeCorners(coverage.seated, bbox(coverage.seated)), plan)
    const parity = measureParity(law.seated, ruleTarget, pitch)
    return {
      sizeMM, placement, phaseMM, lattice, canon, seated: law.seated, belt: law.belt, anchors, magnetCount: anchors.length,
      parityTrue: parity.parityTrue, centreErrorMM: parity.centreErrorMM, wrapMeasurement: law.wrapMeasurement,
    }
  }
  // CENTRE RULES — no voting. Parity is DERIVED from the bbox axis classes: each axis's class
  // fixes its magnet-line count, odd count puts a NODE on the centre, even count puts the GAP on
  // it. All four parity placements are measured and returned; the display pick keeps the frozen
  // Centre ordering (a parity seating more wins; at equal seats the canonical frame).
  const measured = fits ? measureCentrePlacements(bb, pitch, centrePhaseCandidates(ruleTarget, bb, pitch), fits, outer, reach) : []
  const candidates = measured.map((m, i) => candidateAt(m.phaseMM, { xHalf: i === 1 || i === 3, yHalf: i === 2 || i === 3 }, m.canon))
  const best = chooseCentrePlacement(measured)
  let display: PlacementCandidate
  let bestKx = 0, bestKy = 0
  if (fits && cfg.forcePhaseMM) {
    // Manual calibration: seat exactly at the given registration, no search. The centre law
    // is NOT satisfied by construction here — a hand-placed grid may sit anywhere — so its
    // truth is MEASURED and reported as a concession.
    const ox = mod(cfg.forcePhaseMM[0], pitch), oy = mod(cfg.forcePhaseMM[1], pitch)
    bestKx = mod(ox - (bb.maxX - bb.minX) / 2, pitch)
    bestKy = mod(oy - (bb.maxY - bb.minY) / 2, pitch)
    display = candidateAt([ox, oy], { xHalf: false, yHalf: false }, 0)
  } else {
    display = best ? candidates[measured.indexOf(best)] : candidateAt([0, 0], { xHalf: false, yHalf: false }, 0)
  }
  const mainCentre: Pt = fits ? ruleTarget : centres[0]

  const wrap = cfg.wrapMode === 'auto'
    ? evaluateWrap(display.wrapMeasurement, { mode: 'auto', capMM: Math.max(0, cfg.autoFlapCapMM ?? cfg.flapMM ?? FLAP_MM) })
    : evaluateWrap(display.wrapMeasurement, { mode: 'fixed', allowanceMM: Math.max(0, cfg.flapMM ?? FLAP_MM) })
  const concessions = inspectionConcessions({ parityTrue: display.parityTrue, centreErrorMM: display.centreErrorMM }, wrap)

  return {
    anchors: display.anchors,
    // Truth dots come only from returned witnesses on a lawful result; refusals draw none.
    contactsMM: wrap.status === 'lawful' ? wrap.witnesses.map((witness) => witness.outlinePointMM) : [],
    pitchCentreMM: pitch,
    lattice: display.lattice,
    phaseMM: display.phaseMM,
    panMM: [bestKx, bestKy],
    spotRadiusMM: spotRadiusOf(pad),
    segments,
    centresMM: [ruleTarget],
    centreMainMM: mainCentre,
    wrap,
    parityTrue: display.parityTrue,
    centreErrorMM: display.centreErrorMM,
    concessions,
    candidates,
  }
}

/** The walk range: the band as a RANGE; above the last band, up to the derived field span. */
function snapRange(cfg: GridConfig, fromMM: number): [number, number] {
  const band = bandOf(fromMM)
  if (band) return [band.minMM, band.maxMM]
  return [fromMM, fieldSpanMM(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? RELEASED_PADDING_MM))]
}

/** Pre-scaling diagnostic call boundary. Exact Wrap is already measured in every returned grid. */
export function bandSnapPoints(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): BandSnapPoint[] {
  return bandWalk(sized, cfg, fromMM, stepMM).points
}

/** One pass over the band: the per-count contact sizes AND the best-seated rung (fallback). */
function bandWalk(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { points: BandSnapPoint[]; bestSeatedMM: number } {
  const [lo, hi] = snapRange(cfg, fromMM)
  // Interim scaling candidate generator only. Exact Wrap is evaluated by computeGrid;
  // this sampled walk never measures or grants contact.
  const walkCfg: GridConfig = { ...cfg, segmentsDetail: 'light' }
  const solve = (mm: number): GridResult => {
    let g = cfg.solveCache?.get(mm)
    if (!g) { g = computeGrid(sized(mm), mm, walkCfg); cfg.solveCache?.set(mm, g) }
    return g
  }
  // Counts already seating just below the band reached contact earlier — loose here, not rungs.
  const below = lo - stepMM >= MIN_EFFECT_MM ? solve(lo - stepMM).anchors.length : 0
  const points: BandSnapPoint[] = []
  const seen = new Set<number>()
  for (let c = 1; c <= below; c++) seen.add(c)
  let bestSeatedMM = lo, bestSeats = -1
  for (let mm = lo; mm <= hi; mm += stepMM) {
    const grid = solve(mm)
    const count = grid.anchors.length
    if (count > bestSeats) { bestSeats = count; bestSeatedMM = mm }
    if (count >= 1 && !seen.has(count)) {
      if (grid.wrap.status === 'lawful') {
        seen.add(count)
        points.push({ sizeMM: mm, count })
      }
    }
  }
  return { points, bestSeatedMM }
}

/** Pre-scaling diagnostic band output; no production scaling claim is made in this phase. */
export function fitSizeInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { sizeMM: number; grid: GridResult; ladder: BandSnapPoint[]; pickIdx: number } {
  const { points, bestSeatedMM } = bandWalk(sized, cfg, fromMM, stepMM)
  if (points.length) {
    const maxCount = Math.max(...points.map((p) => p.count))
    const pickIdx = points.findIndex((p) => p.count === maxCount)
    return { sizeMM: points[pickIdx].sizeMM, grid: computeGrid(sized(points[pickIdx].sizeMM), points[pickIdx].sizeMM, cfg), ladder: points, pickIdx }
  }
  return { sizeMM: bestSeatedMM, grid: computeGrid(sized(bestSeatedMM), bestSeatedMM, cfg), ladder: [], pickIdx: 0 }
}

/**
 * Exact Auto Wrap: the geometry derives its worst-belt requirement once; Logic compares it
 * to the cap. No allowance scan or millimetre grant exists in this replacement body.
 */
export function autoFlapInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number, maxFlapMM: number,
  cacheFor?: (flapMM: number) => Map<number, GridResult> | undefined,
): { flapMM: number; fit: ReturnType<typeof fitSizeInBand> } {
  const cap = Math.max(0, maxFlapMM)
  const fit = fitSizeInBand(sized, {
    ...cfg,
    wrapMode: 'auto',
    autoFlapCapMM: cap,
    solveCache: cacheFor?.(cap),
  }, fromMM, stepMM)
  const flapMM = fit.grid.wrap.status === 'lawful' ? fit.grid.wrap.appliedFlapMM : cap
  return { flapMM, fit }
}
