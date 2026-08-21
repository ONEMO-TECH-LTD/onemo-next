// Magnetic-grid engine: orchestration over spec, compute and Logic.
// One import door for consumers; the modules stay behind it.

import type { BandSnapPoint, CentreMode, Contour, Governor, GridConfig, GridResult, Pt } from './spec'
import {
  CENTRE_MODE,
  DEFAULT_PITCH_MM,
  FLAP_MM,
  GOVERNOR,
  MASS_DEPTH_MM,
  MIN_EFFECT_MM,
  PADDING_FLOOR_MM,
  RELEASED_PADDING_MM,
  CONTACT_TOLERANCE_MM,
} from './spec'
import {
  bbox,
  centroidOf,
  fieldSpanMM,
  latticeAt,
  makeCircleSeatPredicate,
  makeSeatPredicate,
  measureCentreBranches,
  measureCentrePlacements,
  measureExtremeCorners,
  measureWrap,
  rationalFromNumber,
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
} from './logic'

export * from './spec'
export {
  fieldSpanMM,
  latticeOver,
  safeSegments,
  scaleContour,
  spotRadiusOf,
} from './compute'
export { bandOf } from './logic'

/** Sweep the lattice phase at the placement step (ruled 1mm), seat exactly, score, apply coverage, report. */
const mod = (v: number, m: number) => ((v % m) + m) % m

export function computeGrid(contourMM: Contour, cfg: GridConfig = {}): GridResult {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? RELEASED_PADDING_MM)
  // Coverage reach from a magnet centre: the spot plus the dialled flap allowance.
  const reach = spotRadiusOf(pad) + Math.max(0, cfg.flapMM ?? FLAP_MM)
  const plan = cfg.plan ?? 'all6'
  const perimeterOnly = cfg.perimeterOnly ?? true
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2

  const fits = cfg.circle
    ? makeCircleSeatPredicate(cx, cy, Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2, spotRadiusOf(pad) + Math.max(0, cfg.seatMarginMM ?? 0))
    : makeSeatPredicate(outer, spotRadiusOf(pad) + Math.max(0, cfg.seatMarginMM ?? 0))

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

  let bestSeated: Pt[] = []
  let bestOx = 0, bestOy = 0, bestKx = 0, bestKy = 0
  let mainCentre: Pt = centres[0]
  if (fits && cfg.forcePhaseMM) {
    // Manual calibration: seat exactly at the given registration, no search. The centre law
    // is NOT satisfied by construction here — a hand-placed grid may sit anywhere — so its
    // truth is MEASURED and reported (pixel full-eval F1: silence read as compliance).
    bestOx = mod(cfg.forcePhaseMM[0], pitch)
    bestOy = mod(cfg.forcePhaseMM[1], pitch)
    bestKx = mod(bestOx - (bb.maxX - bb.minX) / 2, pitch)
    bestKy = mod(bestOy - (bb.maxY - bb.minY) / 2, pitch)
    bestSeated = latticeAt(bb, pitch, bestOx, bestOy).filter(fits)
    mainCentre = ruleTarget
  } else if (fits) {
    // CENTRE RULES — no voting. Parity is DERIVED from the bbox axis classes (canon §4/§6):
    // each axis's class fixes its magnet-line count, odd count puts a NODE on the centre,
    // even count puts the GAP on it — so a 108x91 (class 2x2) shape is judged as a 2x2 frame
    // whose centre IS the governed centre. Magnets still govern first: a parity seating more
    // wins; at EQUAL seats the canonical frame parity always beats the rest, and coverage
    // only sorts the non-canonical remainder. Centring is exact by construction.
    const measured = measureCentrePlacements(bb, pitch, centrePhaseCandidates(ruleTarget, bb, pitch), fits, outer, reach)
    const best = chooseCentrePlacement(measured)
    if (best) { bestSeated = best.seated; bestOx = best.phaseMM[0]; bestOy = best.phaseMM[1] }
    mainCentre = ruleTarget
  }

  const lattice = latticeAt(bb, pitch, bestOx, bestOy)

  const split = splitPerimeter(bestSeated, pitch)
  const belt = bestSeated.length <= 4 ? bestSeated : split.belt
  const coverage = applyCoverage(bestSeated, perimeterOnly, split)
  const anchors = assignSizes(measureExtremeCorners(coverage.seated, bbox(coverage.seated)), plan)
  const wrapMeasured = measureWrap(outer, belt, spotRadiusOf(pad))
  const wrap = cfg.wrapMode === 'auto'
    ? evaluateWrap(wrapMeasured, {
      mode: 'auto',
      cap: rationalFromNumber(Math.max(0, cfg.autoFlapCapMM ?? cfg.flapMM ?? FLAP_MM)),
      capApproxMM: Math.max(0, cfg.autoFlapCapMM ?? cfg.flapMM ?? FLAP_MM),
    })
    : evaluateWrap(wrapMeasured, {
      mode: 'fixed',
      allowance: rationalFromNumber(Math.max(0, cfg.flapMM ?? FLAP_MM)),
      allowanceApproxMM: Math.max(0, cfg.flapMM ?? FLAP_MM),
    })

  return {
    anchors,
    // Truth dots are projections stored by exact segment witnesses; no guard/tolerance can draw one.
    contactsMM: wrap.status === 'lawful' ? wrap.witnesses.map((witness) => witness.tangency.approximateMM) : [],
    pitchCentreMM: pitch,
    lattice,
    phaseMM: [bestOx, bestOy],
    panMM: [bestKx, bestKy],
    spotRadiusMM: spotRadiusOf(pad),
    segments,
    centresMM: [ruleTarget],
    centreMainMM: mainCentre,
    wrap,
  }
}

/** The walk range: the band as a RANGE; above the last band, up to the derived field span. */
function snapRange(cfg: GridConfig, fromMM: number): [number, number] {
  const band = bandOf(fromMM)
  if (band) return [band.minMM, band.maxMM]
  return [fromMM, fieldSpanMM(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? RELEASED_PADDING_MM))]
}

/**
 * THE CONTACT LAW (Dan, 2026-08-19): "the scale must be scaling up and down until edges touch
 * the disc — this is zero flap." Every disc wears the allowance as an invisible margin, and a
 * band option is a magnet COUNT at its CONTACT size — the smallest size where that count still
 * seats against the margined discs. No wrap test: the seat geometry IS the law. A count whose
 * contact lies below the band belongs to the band below, not here worn loose.
 */
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
  const walkCfg: GridConfig = { ...cfg, segmentsDetail: 'light', seatMarginMM: 0 }
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
  let bestSeatedMM = lo, bestSeats = -1
  for (let mm = lo; mm <= hi; mm += stepMM) {
    const grid = solve(mm)
    const count = grid.anchors.length
    if (count > bestSeats) { bestSeats = count; bestSeatedMM = mm }
    if (count >= 1 && !seen.has(count)) {
      // Bisect (mm - stepMM, mm] for the smallest lawful size holding this count — its gap is
      // minimal by construction; the law then judges THAT size.
      let lo2 = Math.max(MIN_EFFECT_MM, mm - stepMM), hi2 = mm
      for (let it = 0; it < 8 && hi2 - lo2 > CONTACT_TOLERANCE_MM / 2; it++) {
        const midMM = (lo2 + hi2) / 2
        const gm = computeGrid(sized(midMM), walkCfg)
        if (gm.anchors.length >= count) hi2 = midMM; else lo2 = midMM
      }
      // Keep the refined size exact — rounding it back to a coarse grid re-introduces the
      // very slack the bisection removed (display rounds, the law does not).
      const rungMM = hi2
      const gr = computeGrid(sized(rungMM), walkCfg)
      const ok = gr.anchors.length === count && gr.wrap.status === 'lawful'
      if (ok) { seen.add(count); points.push({ sizeMM: rungMM, count }) }
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
  const dispCfg: GridConfig = { ...cfg, seatMarginMM: 0 }
  if (points.length) {
    const maxCount = Math.max(...points.map((p) => p.count))
    const pickIdx = points.findIndex((p) => p.count === maxCount)
    return { sizeMM: points[pickIdx].sizeMM, grid: computeGrid(sized(points[pickIdx].sizeMM), dispCfg), ladder: points, pickIdx }
  }
  return { sizeMM: bestSeatedMM, grid: computeGrid(sized(bestSeatedMM), dispCfg), ladder: [], pickIdx: 0 }
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
  const flapMM = fit.grid.wrap.status === 'lawful' ? fit.grid.wrap.appliedFlapApproxMM : cap
  return { flapMM, fit }
}
