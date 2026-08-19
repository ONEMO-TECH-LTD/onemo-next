// grid-origin.ts — the engine bridge: computeGrid and the band snap, wiring spec + compute + logic.
// One import door for consumers; the modules stay behind it.

import type { Contour, Pt } from './types'
import {
  CENTRE_MODE,
  DEFAULT_PITCH_MM,
  FLAP_MM,
  MASS_DEPTH_MM,
  PADDING_FLOOR_MM,
  PHASE_STEP_MM,
} from './grid-origin-spec'
import {
  bbox,
  centroidOf,
  fieldSpanMM,
  flapExcessMM,
  flapVerts,
  latticeAt,
  makeCircleSeatPredicate,
  makeSeatPredicate,
  pointInMass,
  safeSegments,
  spotRadiusOf,
  type SafeSegment,
} from './grid-origin-compute'
import {
  applyCoverage,
  assignSizes,
  bandOf,
  centeringAnchors,
  centeringRef,
  isHolding,
  registrationScore,
  type Anchor,
  type CentreMode,
  type MagnetPlan,
} from './grid-origin-logic'

export * from './grid-origin-spec'
export {
  fieldSpanMM,
  latticeOver,
  safeSegments,
  scaleContour,
  spotRadiusOf,
  type SafeMass,
  type SafeSegment,
} from './grid-origin-compute'
export { bandOf, isHolding, type Anchor, type MagnetDia, type MagnetPlan } from './grid-origin-logic'

export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  /** How far material may extend past a spot's edge before it counts as a flap. 0 = edge-to-edge. */
  flapMM?: number
  /** How finely the lattice slides under the shape when searching registrations. */
  phaseStepMM?: number
  /** Manual calibration: force this registration (mm phase) instead of searching. */
  forcePhaseMM?: Pt
  /** Clearance a region must survive to count as a mass for centring. */
  massDepthMM?: number
  /** Centre mode — 0 box · 1 core · 2 masses · 3 weight · 4 deep · 5 top. */
  centreMode?: number
  /** 'light' skips island outlines (display-only work) — used by walk-internal solves. */
  segmentsDetail?: 'full' | 'light'
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — perimeter belt drops surrounded interior nodes
  /** The outline is a true circle: judge against the analytic curve, not its flattened chords. */
  circle?: boolean
}

export interface GridResult {
  anchors: Anchor[]
  /** Silhouette vertices with no magnet within reach — the band gate's evidence. */
  flaps: Pt[]
  pitchCentreMM: number
  /** Every lattice position at the chosen phase, seated or not. */
  lattice: Pt[]
  /** The phase the search chose, mm. */
  phaseMM: Pt
  /** Registration offset from the canonical phase, mm per axis — the pan class. */
  panMM: Pt
  /** The spot radius the erosion used — the padding, centre-measured. */
  spotRadiusMM: number
  /** The legal area's islands with depth masses — what centring anchored on. */
  segments: SafeSegment[]
  /** The active centre-mode's candidate target(s) — drawn so the aim is visible. */
  centresMM: Pt[]
  /** THE centre that governed the winning layout — the main point of the centring system. */
  centreMainMM: Pt
}

/** Sweep the lattice phase at the placement step (ruled 1mm), seat exactly, score, apply coverage, report. */
export function computeGrid(contourMM: Contour, cfg: GridConfig = {}): GridResult {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  // Coverage reach from a magnet centre: the spot plus the dialled flap allowance.
  const reach = spotRadiusOf(pad) + Math.max(0, cfg.flapMM ?? FLAP_MM)
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
  const centres = centeringAnchors(mode, segments, [cx, cy], centroidOf(outer))

  let bestSeated: Pt[] = []
  let bestOx = 0, bestOy = 0, bestKx = 0, bestKy = 0
  let mainCentre: Pt = centres[0]
  const mod = (v: number, m: number) => ((v % m) + m) % m
  if (fits && cfg.forcePhaseMM) {
    // Manual calibration: seat exactly at the given registration, no search.
    bestOx = mod(cfg.forcePhaseMM[0], pitch)
    bestOy = mod(cfg.forcePhaseMM[1], pitch)
    bestKx = mod(bestOx - (bb.maxX - bb.minX) / 2, pitch)
    bestKy = mod(bestOy - (bb.maxY - bb.minY) / 2, pitch)
    bestSeated = latticeAt(bb, pitch, bestOx, bestOy).filter(fits)
  } else if (fits) {
    // Phases: ONE full ladder swept from the first centre, plus each further mass centre's
    // EXACT slide (k=0) — the only slide of a second base the ladder doesn't already cover.
    // Every mass-centred registration is sampled at ANY step size without multiplying the walk.
    const phases = (bases: number[]): { p: number; k: number }[] => {
      const out: { p: number; k: number }[] = []
      const seen = new Set<number>()
      const push = (p: number, k: number) => {
        const id = Math.round(p * 1000)
        if (!seen.has(id)) { seen.add(id); out.push({ p, k }) }
      }
      for (let k = 0; k < pitch; k += phaseStep) push(mod(bases[0] + k, pitch), k)
      for (let i = 1; i < bases.length; i++) push(mod(bases[i], pitch), 0)
      return out
    }
    let bestScore = -Infinity
    for (const py of phases(centres.map((a) => a[1] - bb.minY))) {
      for (const px of phases(centres.map((a) => a[0] - bb.minX))) {
        const seat = latticeAt(bb, pitch, px.p, py.p).filter(fits)
        if (!seat.length) continue
        const excess = flapExcessMM(outer, seat, reach)
        // Balance target: mode 2 → the smallest mass that holds a seat governs (logic's rule),
        // containment against the mass's real outline; other modes → the mode's single centre.
        const ref = mode === 2 ? centeringRef(segments, seat, pointInMass) : null
        const inRef = ref ? seat.filter((p) => pointInMass(p, ref)) : seat
        const [tx, ty] = ref ? ref.centreMM : centres[0]
        let sx = 0, sy = 0; for (const p of inRef) { sx += p[0]; sy += p[1] }
        const balance = Math.hypot(sx / inRef.length - tx, sy / inRef.length - ty)
        const score = registrationScore(seat.length, excess, balance)
        if (score > bestScore) { bestScore = score; bestSeated = seat; bestOx = px.p; bestOy = py.p; bestKx = px.k; bestKy = py.k; mainCentre = [tx, ty] }
      }
    }
  }

  const lattice = latticeAt(bb, pitch, bestOx, bestOy)

  const coverage = applyCoverage(bestSeated, perimeterOnly, pitch)
  const anchors = assignSizes(coverage.seated, plan)

  const flaps: Pt[] = coverage.seated.length ? flapVerts(outer, coverage.seated, reach) : []

  return {
    anchors,
    flaps,
    pitchCentreMM: pitch,
    lattice,
    phaseMM: [bestOx, bestOy],
    panMM: [bestKx, bestKy],
    spotRadiusMM: spotRadiusOf(pad),
    segments,
    centresMM: centres,
    centreMainMM: mainCentre,
  }
}

/** One holding size in a band: the size, the seat count, and the layout's identity. */
export interface BandSnapPoint { sizeMM: number; count: number; sig: string }

/** Layout identity: the magnets' relative arrangement plus the registration (pan) class. */
function layoutSig(grid: GridResult): string {
  if (!grid.anchors.length) return 'none'
  const pts = grid.anchors.map((a) => a.p).slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let mx = Infinity, my = Infinity
  for (const p of pts) { if (p[0] < mx) mx = p[0]; if (p[1] < my) my = p[1] }
  return pts.map((p) => Math.round(p[0] - mx) + ',' + Math.round(p[1] - my)).join('|') + '@' + grid.panMM.join(',')
}

/** The walk range: the band as a RANGE; above the last band, up to the derived field span. */
function snapRange(cfg: GridConfig, fromMM: number): [number, number] {
  const band = bandOf(fromMM)
  if (band) return [band.minMM, band.maxMM]
  return [fromMM, fieldSpanMM(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))]
}

/**
 * Every holding size in the band, scanned at stepMM. The band is a RANGE: fit is not monotone,
 * so the whole range is walked and each size judged independently.
 */
export function bandSnapPoints(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): BandSnapPoint[] {
  const [lo, hi] = snapRange(cfg, fromMM)
  const walkCfg: GridConfig = { ...cfg, segmentsDetail: 'light' }
  const out: BandSnapPoint[] = []
  for (let mm = lo; mm <= hi; mm += stepMM) {
    const grid = computeGrid(sized(mm), walkCfg)
    if (isHolding(grid.anchors.length, grid.flaps.length)) out.push({ sizeMM: mm, count: grid.anchors.length, sig: layoutSig(grid) })
  }
  return out
}

/**
 * Band snap. `ladder` is every DISTINCT holding layout in the band — any count, arrangement or
 * pan variation — each at the smallest size where it appears; as honest as the free slider.
 * The landing pick (`pickIdx`) stays the smallest size at the band's MAXIMUM seated count.
 */
export function fitSizeInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { sizeMM: number; grid: GridResult; ladder: BandSnapPoint[]; pickIdx: number } {
  const points = bandSnapPoints(sized, cfg, fromMM, stepMM)
  if (points.length) {
    const maxCount = Math.max(...points.map((p) => p.count))
    const seen = new Set<string>()
    const ladder = points.filter((p) => !seen.has(p.sig) && (seen.add(p.sig), true))
    const pickSig = points.find((p) => p.count === maxCount)!.sig
    const pickIdx = ladder.findIndex((p) => p.sig === pickSig)
    return { sizeMM: ladder[pickIdx].sizeMM, grid: computeGrid(sized(ladder[pickIdx].sizeMM), cfg), ladder, pickIdx }
  }
  // Nothing in the band holds: best-seated rung as a fallback (walk light, final full).
  const [lo, hi] = snapRange(cfg, fromMM)
  const walkCfg: GridConfig = { ...cfg, segmentsDetail: 'light' }
  let best: { sizeMM: number; grid: GridResult } | null = null
  for (let mm = lo; mm <= hi; mm += stepMM) {
    const grid = computeGrid(sized(mm), walkCfg)
    if (!best || grid.anchors.length > best.grid.anchors.length) best = { sizeMM: mm, grid }
  }
  const pickMM = best ? best.sizeMM : lo
  return { sizeMM: pickMM, grid: computeGrid(sized(pickMM), cfg), ladder: [], pickIdx: 0 }
}
