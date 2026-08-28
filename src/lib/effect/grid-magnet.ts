// grid-magnet.ts — the engine bridge: computeGrid and the band snap, wiring spec + compute + logic.
// One import door for consumers; the modules stay behind it.

import type { Contour, Pt } from './types'
import {
  BANDS,
  CENTRE_MODE,
  DEFAULT_PITCH_MM,
  GOVERNOR,
  MASS_DEPTH_MM,
  MIN_EFFECT_MM,
  PADDING_FLOOR_MM,
  PHASE_STEP_MM,
  POSITIONING,
  SNAP_STEP_MM,
  VOTING_ORDER,
} from './grid-magnet-spec'
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
  pointInMass,
  safeSegments,
  spotRadiusOf,
  type SafeSegment,
} from './grid-magnet-compute'
import {
  applyCoverage,
  assignSizes,
  bandOf,
  centeringAnchors,
  centeringRef,
  governMass,
  registrationScore,
  type VotingOrder,
  type Anchor,
  type CentreMode,
  type Governor,
  type MagnetPlan,
} from './grid-magnet-logic'

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

export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  /** How finely the lattice slides under the shape when searching registrations. */
  phaseStepMM?: number
  /** Manual calibration: force this registration (mm phase) instead of searching. */
  forcePhaseMM?: Pt
  /** Clearance a region must survive to count as a mass for centring. */
  massDepthMM?: number
  /** Centre mode — 0 box · 1 core · 2 masses · 3 weight · 4 deep · 5 top. */
  centreMode?: number
  /** Positioning law — 0 voting · 1 centre rules (parity-locked, no voting). */
  positioning?: number
  /** Which mass rules in Masses mode — 0 smallest · 1 deepest · 2 top. */
  governor?: number
  /** Baked governed centre for this size (anchor bake) — skips per-size anchor derivation.
   *  Positions are shape features and scale linearly; re-measuring per size is mesh noise. */
  centreOverrideMM?: Pt
  /** 'light' skips island outlines (display-only work) — used by walk-internal solves. */
  segmentsDetail?: 'full' | 'light'
  /** Voting dominance order — which force rules, admin-picked; spec default when absent. */
  votingOrder?: number
  /** Per-size solve reuse for band walks — owned by the caller (the worker). */
  solveCache?: Map<number, GridResult>
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — perimeter belt drops surrounded interior nodes
  /** The outline is a true circle: judge against the analytic curve, not its flattened chords. */
  circle?: boolean
}

export interface GridResult {
  anchors: Anchor[]
  pitchCentreMM: number
  /** Every lattice position at the chosen phase, seated or not. */
  lattice: Pt[]
  /** The phase the search chose, mm. */
  phaseMM: Pt
  /** Registration offset from the canonical phase, mm per axis — the pan class. */
  panMM: Pt
  /** The spot radius the erosion used — the padding, centre-measured. */
  spotRadiusMM: number
  /** Outline points where a disc touches (within one snap step of its margined edge). */
  contactsMM: Pt[]
  /** The legal area's islands with depth masses — what centring anchored on. */
  segments: SafeSegment[]
  /** The active centre-mode's candidate target(s) — drawn so the aim is visible. */
  centresMM: Pt[]
  /** THE centre that governed the winning layout — the main point of the centring system. */
  centreMainMM: Pt
}

/** Sweep the lattice phase at the placement step (ruled 1mm), seat exactly, score, apply coverage, report. */
/** Phase-dedupe key quantum — micron identity for slide phases, not a law value. */
const QUANTUM_KEY_MM = 0.001

const mod = (v: number, m: number) => ((v % m) + m) % m

export function computeGrid(contourMM: Contour, cfg: GridConfig = {}): GridResult {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  // Coverage reach from a magnet centre: the spot IS the allowance (flap deleted as a dupe).
  const reach = spotRadiusOf(pad)
  const phaseStep = Math.max(1, cfg.phaseStepMM ?? PHASE_STEP_MM)
  const plan = cfg.plan ?? 'all6'
  const perimeterOnly = cfg.perimeterOnly ?? true
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2

  const fits = cfg.circle
    ? makeCircleSeatPredicate(cx, cy, Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2, spotRadiusOf(pad))
    : makeSeatPredicate(outer, spotRadiusOf(pad))

  const massDepth = Math.max(spotRadiusOf(pad), cfg.massDepthMM ?? MASS_DEPTH_MM)
  const segments = safeSegments(outer, spotRadiusOf(pad), massDepth, cfg.segmentsDetail ?? 'full')

  // THE shape's centres — chosen by the centre-mode switch (logic's table). Every returned
  // point anchors the slide walk; single-target modes also fix the balance target.
  const mode = (cfg.centreMode ?? CENTRE_MODE) as CentreMode
  const positioning = cfg.positioning ?? POSITIONING
  const governor = (cfg.governor ?? GOVERNOR) as Governor
  const centres = cfg.centreOverrideMM ? [cfg.centreOverrideMM] : centeringAnchors(mode, segments, [cx, cy], centroidOf(outer))
  // Under CENTRE RULES one point rules outright; Masses names it via the governor switch.
  const allMasses = segments.flatMap((s) => (s.masses.length ? s.masses : [s]))
  const midY = (bb.minY + bb.maxY) / 2
  const ruleTarget: Pt = cfg.centreOverrideMM ?? (mode === 2 ? (governMass(allMasses, governor, midY)?.centreMM ?? centres[0]) : centres[0])

  let bestSeated: Pt[] = []
  let bestOx = 0, bestOy = 0, bestKx = 0, bestKy = 0
  let mainCentre: Pt = centres[0]
  if (fits && cfg.forcePhaseMM) {
    // Manual calibration: seat exactly at the given registration, no search.
    bestOx = mod(cfg.forcePhaseMM[0], pitch)
    bestOy = mod(cfg.forcePhaseMM[1], pitch)
    bestKx = mod(bestOx - (bb.maxX - bb.minX) / 2, pitch)
    bestKy = mod(bestOy - (bb.maxY - bb.minY) / 2, pitch)
    bestSeated = latticeAt(bb, pitch, bestOx, bestOy).filter(fits)
  } else if (fits && positioning === 1) {
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
  } else if (fits) {
    // Phases: ONE full ladder swept from the first centre, plus each further mass centre's
    // EXACT slide (k=0) — the only slide of a second base the ladder doesn't already cover.
    // Every mass-centred registration is sampled at ANY step size without multiplying the walk.
    const phases = (bases: number[]): { p: number; k: number }[] => {
      const out: { p: number; k: number }[] = []
      const seen = new Set<number>()
      const push = (p: number, k: number) => {
        const id = Math.round(p / QUANTUM_KEY_MM)
        if (!seen.has(id)) { seen.add(id); out.push({ p, k }) }
      }
      for (let k = 0; k < pitch; k += phaseStep) push(mod(bases[0] + k, pitch), k)
      for (let i = 1; i < bases.length; i++) push(mod(bases[i], pitch), 0)
      return out
    }
    // TWO-PASS SWEEP — same winner, a fraction of the work. Seat count sits on the top
    // dominance tier for every voting order that begins with magnets, so a slide below the
    // maximum count can never win: pass 1 counts seats per slide (cheap); pass 2 runs the
    // full scoring ONLY over the max-count slides, in the same iteration order, so winner
    // and tie-breaks are identical to the single-pass sweep. Orders that put another force
    // on top take the exact single-pass road instead.
    const pyList = phases(centres.map((a) => a[1] - bb.minY))
    const pxList = phases(centres.map((a) => a[0] - bb.minX))
    // Legality memo — every grid point is judged once; pass 2 re-reads, never re-measures.
    const memo = new Map<number, boolean>()
    const fitsM = (p: Pt): boolean => {
      // Micron identity — exact for any phase source, fractional mass centres included.
      const k = Math.round((p[0] - bb.minX) / QUANTUM_KEY_MM) * 2097152 + Math.round((p[1] - bb.minY) / QUANTUM_KEY_MM)
      const hit = memo.get(k)
      if (hit !== undefined) return hit
      const v = fits(p)
      memo.set(k, v)
      return v
    }
    let maxCount = 0
    const counts = new Int32Array(pyList.length * pxList.length)
    for (let yi = 0; yi < pyList.length; yi++) for (let xi = 0; xi < pxList.length; xi++) {
      let n = 0
      for (const p of latticeAt(bb, pitch, pxList[xi].p, pyList[yi].p)) if (fitsM(p)) n++
      counts[yi * pxList.length + xi] = n
      if (n > maxCount) maxCount = n
    }
    let bestScore = -Infinity
    for (let yi = 0; yi < pyList.length; yi++) {
      const py = pyList[yi]
      for (let xi = 0; xi < pxList.length; xi++) {
        if (counts[yi * pxList.length + xi] !== maxCount) continue
        const px = pxList[xi]
        const seat = latticeAt(bb, pitch, px.p, py.p).filter(fitsM)
        if (!seat.length) continue
        const excess = pressExcessMM(outer, seat, reach)
        // Balance target: mode 2 → the smallest mass that holds a seat governs (logic's rule),
        // containment against the mass's real outline; other modes → the mode's single centre.
        const ref = mode === 2 ? centeringRef(segments, seat, pointInMass, governor, midY) : null
        const inRef = ref ? seat.filter((p) => pointInMass(p, ref)) : seat
        const [tx, ty] = ref ? ref.centreMM : centres[0]
        let sx = 0, sy = 0; for (const p of inRef) { sx += p[0]; sy += p[1] }
        const balance = Math.hypot(sx / inRef.length - tx, sy / inRef.length - ty)
        const score = registrationScore(seat.length, excess, balance, cfg.votingOrder as VotingOrder | undefined)
        if (score > bestScore) { bestScore = score; bestSeated = seat; bestOx = px.p; bestOy = py.p; bestKx = px.k; bestKy = py.k; mainCentre = [tx, ty] }
      }
    }
  }

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
    spotRadiusMM: spotRadiusOf(pad),
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
