// grid-origin.ts — the engine bridge: computeGrid and the band snap, wiring spec + compute + logic.
// One import door for consumers; the modules stay behind it.

import type { BBox, BandSnapPoint, CentreMode, Contour, Governor, GridConfig, GridResult, Pt } from './spec'
import {
  BANDS,
  CENTRE_MODE,
  DEFAULT_PITCH_MM,
  FLAP_MM,
  GOVERNOR,
  AUTO_FLAP_STEP_MM,
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
  contactPointsMM,
  maxPressMM,
  pressExcessMM,
  latticeAt,
  makeCircleSeatPredicate,
  makeSeatPredicate,
  safeSegments,
  spotRadiusOf,
  TANGENT_GUARD_MM,
} from './centre-clone-compute'
import {
  applyCoverage,
  assignSizes,
  bandOf,
  centeringAnchors,
  governMass,
} from './centre-clone-logic'

export * from './spec'
export {
  fieldSpanMM,
  impliedFlapMM,
  latticeOver,
  safeSegments,
  scaleContour,
  spotRadiusOf,
} from './centre-clone-compute'
export { bandOf } from './centre-clone-logic'

/** Sweep the lattice phase at the placement step (ruled 1mm), seat exactly, score, apply coverage, report. */
/** Phase-dedupe key quantum — micron identity for slide phases, not a law value. */
const QUANTUM_KEY_MM = 0.001

const mod = (v: number, m: number) => ((v % m) + m) % m

/** THE CENTRE LAW as a predicate: per axis, an odd count of seated lines must put a NODE on
 *  the governed centre, an even count must put the GAP on it. Used to rank lawful placements
 *  and to MEASURE the truth of a hand-forced registration. */
function parityHolds(seat: ReadonlyArray<Pt>, target: Pt, bb: BBox, pitch: number): boolean {
  if (!seat.length) return false
  const lines = (axis: 0 | 1) => new Set(seat.map((s) => Math.round(s[axis] / QUANTUM_KEY_MM))).size
  const onNode = (axis: 0 | 1) => {
    const off = mod(seat[0][axis] - target[axis], pitch)
    return off < pitch / 4 || off > pitch * 3 / 4
  }
  void bb
  return (lines(0) % 2 === 1) === onNode(0) && (lines(1) % 2 === 1) === onNode(1)
}

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
  const centres = centeringAnchors(mode, segments, [cx, cy], centroidOf(outer))
  // Under CENTRE RULES one point rules outright; Masses names it via the governor switch.
  const allMasses = segments.flatMap((s) => (s.masses.length ? s.masses : [s]))
  const midY = (bb.minY + bb.maxY) / 2
  const ruleTarget: Pt = mode === 2 ? (governMass(allMasses, governor, midY)?.centreMM ?? centres[0]) : centres[0]

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
    void parityHolds(bestSeated, ruleTarget, bb, pitch)
  } else if (fits) {
    // CENTRE RULES — no voting. Parity is DERIVED from the bbox axis classes (canon §4/§6):
    // each axis's class fixes its magnet-line count, odd count puts a NODE on the centre,
    // even count puts the GAP on it — so a 108x91 (class 2x2) shape is judged as a 2x2 frame
    // whose centre IS the governed centre. Magnets still govern first: a parity seating more
    // wins; at EQUAL seats the canonical frame parity always beats the rest, and coverage
    // only sorts the non-canonical remainder. Centring is exact by construction.
    const bxc = ruleTarget[0] - bb.minX, byc = ruleTarget[1] - bb.minY
    const half = pitch / 2
    const clsOf = (side: number) => bandOf(side)?.id ?? BANDS[BANDS.length - 1].id
    const canX = clsOf(bb.maxX - bb.minX) % 2 === 1 ? bxc : bxc + half
    const canY = clsOf(bb.maxY - bb.minY) % 2 === 1 ? byc : byc + half
    const otherX = canX === bxc ? bxc + half : bxc
    const otherY = canY === byc ? byc + half : byc
    // canon = how many axes carry their class-derived parity (2 = the full canonical frame).
    const cands: Array<[number, number, number]> = [
      [canX, canY, 2], [otherX, canY, 1], [canX, otherY, 1], [otherX, otherY, 0],
    ]
    let best: { seats: number; canon: number; excess: number } | null = null
    for (const [px, py, canon] of cands) {
      const ox = mod(px, pitch), oy = mod(py, pitch)
      const seat = latticeAt(bb, pitch, ox, oy).filter(fits)
      if (!seat.length) continue
      const excess = pressExcessMM(outer, seat, reach)
      const wins = !best
        || seat.length > best.seats
        || (seat.length === best.seats && canon > best.canon)
        || (seat.length === best.seats && canon === best.canon && excess < best.excess)
      if (wins) { best = { seats: seat.length, canon, excess }; bestSeated = seat; bestOx = ox; bestOy = oy }
    }
    mainCentre = ruleTarget
  }

  const lattice = latticeAt(bb, pitch, bestOx, bestOy)

  const coverage = applyCoverage(bestSeated, perimeterOnly, pitch)
  const anchors = assignSizes(coverage.seated, plan)


  return {
    anchors,
    // THE TRUTH DOT (Dan: "the dot shows touch but lies"): a dot means the DISC touches the
    // edge — spot radius only, exact-tangency slack. The amber ring tells the allowance story.
    contactsMM: contactPointsMM(outer, coverage.seated, spotRadiusOf(pad), TANGENT_GUARD_MM),
    pitchCentreMM: pitch,
    lattice,
    phaseMM: [bestOx, bestOy],
    panMM: [bestKx, bestKy],
    spotRadiusMM: spotRadiusOf(pad),
    segments,
    centresMM: [ruleTarget],
    centreMainMM: mainCentre,
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
  const margin = Math.max(0, cfg.flapMM ?? FLAP_MM)
  const walkCfg: GridConfig = { ...cfg, segmentsDetail: 'light', seatMarginMM: margin }
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
  const reach = spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? RELEASED_PADDING_MM)) + margin
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
    // Wrap is BELT-scoped (interior discs can never touch) and the centre law must be TRUE —
    // a parity-conceded layout is never a rung; size reconciles (the keystone).
    // THE GATE IS THE LAW'S OWN TOLERANCE (pixel full-eval F2): `<= stepMM` granted the walk's
    // resolution as hidden slack, so flap 0 admitted non-touching layouts. A count's rung is
    // the SMALLEST size where it seats lawfully — refined below the walk step so true contact
    // is found, not approximated.
    const pressAt = (c: Contour, g: GridResult) =>
      maxPressMM(c.outer.pts, applyCoverage(g.anchors.map((a) => a.p), true, cfg.pitchMM ?? DEFAULT_PITCH_MM).seated, reach)
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
      const ok = gr.anchors.length === count && pressAt(sized(rungMM), gr) <= CONTACT_TOLERANCE_MM
      if (ok) { seen.add(count); points.push({ sizeMM: rungMM, count }) }
    }
    void contour
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
  const margin = Math.max(0, cfg.flapMM ?? FLAP_MM)
  const dispCfg: GridConfig = { ...cfg, seatMarginMM: margin }
  if (points.length) {
    const maxCount = Math.max(...points.map((p) => p.count))
    const pickIdx = points.findIndex((p) => p.count === maxCount)
    return { sizeMM: points[pickIdx].sizeMM, grid: computeGrid(sized(points[pickIdx].sizeMM), dispCfg), ladder: points, pickIdx }
  }
  return { sizeMM: bestSeatedMM, grid: computeGrid(sized(bestSeatedMM), dispCfg), ladder: [], pickIdx: 0 }
}

/**
 * AUTO FLAP (micro-module, Dan 2026-08-19): a band tries the snuggest law first — allowance 0 —
 * and grants itself only as much margin as it needs to produce a contact variant, scanning up
 * in AUTO_FLAP_STEP_MM steps to the dialled max. Reuses the band walk untouched; the chosen
 * allowance is reported so the panel and margin rings can show it.
 */
export function autoFlapInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number, maxFlapMM: number,
  cacheFor?: (flapMM: number) => Map<number, GridResult> | undefined,
): { flapMM: number; fit: ReturnType<typeof fitSizeInBand> } {
  const cap = Math.max(0, maxFlapMM)
  let last: ReturnType<typeof fitSizeInBand> | null = null
  for (let f = 0; f <= cap; f += AUTO_FLAP_STEP_MM) {
    last = fitSizeInBand(sized, { ...cfg, flapMM: f, solveCache: cacheFor?.(f) }, fromMM, stepMM)
    if (last.ladder.length) return { flapMM: f, fit: last }
  }
  if (cap % AUTO_FLAP_STEP_MM !== 0) {
    const fit = fitSizeInBand(sized, { ...cfg, flapMM: cap, solveCache: cacheFor?.(cap) }, fromMM, stepMM)
    if (fit.ladder.length) return { flapMM: cap, fit }
    last = fit
  }
  return { flapMM: cap, fit: last! }
}
