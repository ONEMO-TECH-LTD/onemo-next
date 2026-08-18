// grid-origin.ts — the engine bridge: computeGrid and the band snap, wiring spec + compute + logic.
// One import door for consumers; the modules stay behind it.

import type { Contour, Pt } from './types'
import {
  DEFAULT_PITCH_MM,
  FLAP_MM,
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
  PADDING_FLOOR_MM,
  PHASE_STEP_MM,
} from './grid-origin-spec'
import {
  bbox,
  fieldSpanMM,
  flapVerts,
  latticeAt,
  makeCircleSeatPredicate,
  makeSeatPredicate,
  spotRadiusOf,
} from './grid-origin-compute'
import {
  applyCoverage,
  assignSizes,
  bandOf,
  isHolding,
  registrationScore,
  verdictIssues,
  type Anchor,
  type MagnetPlan,
} from './grid-origin-logic'

export * from './grid-origin-spec'
export {
  fieldSpanMM,
  latticeOver,
  scaleContour,
  spotRadiusOf,
} from './grid-origin-compute'
export { bandOf, isHolding, type Anchor, type MagnetDia, type MagnetPlan } from './grid-origin-logic'

export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  /** How far material may extend past a spot's edge before it counts as a flap. 0 = edge-to-edge. */
  flapMM?: number
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — perimeter belt drops surrounded interior nodes
  /** The outline is a true circle: judge against the analytic curve, not its flattened chords. */
  circle?: boolean
}

export interface GridResult {
  anchors: Anchor[]
  /** Silhouette vertices with no magnet within reach. */
  flaps: Pt[]
  ok: boolean
  issues: string[]
  pitchCentreMM: number
  edgeRangeMM: [number, number]
  /** Every lattice position at the chosen phase, seated or not. */
  lattice: Pt[]
  /** The phase the search chose, mm. */
  phaseMM: Pt
  /** The spot radius the erosion used — the padding, centre-measured. */
  spotRadiusMM: number
}

/** Sweep the lattice phase on the 12mm increment, seat exactly, score, apply coverage, report. */
export function computeGrid(contourMM: Contour, cfg: GridConfig = {}): GridResult {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  // Coverage reach from a magnet centre: the spot plus the dialled flap allowance.
  const reach = spotRadiusOf(pad) + Math.max(0, cfg.flapMM ?? FLAP_MM)
  const plan = cfg.plan ?? 'all6'
  const perimeterOnly = cfg.perimeterOnly ?? true
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2

  const fits = cfg.circle
    ? makeCircleSeatPredicate(cx, cy, Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2, spotRadiusOf(pad))
    : makeSeatPredicate(outer, spotRadiusOf(pad))

  let bestSeated: Pt[] = []
  let bestOx = 0, bestOy = 0
  if (fits) {
    // Phases anchored on the canonical registration: k=0 puts a node line on the bbox centre
    // (odd-count parity); the 24mm offset in the walk is the even-count parity. Mechanics still
    // choose among them; anchoring guarantees the canonical phases are sampled at ANY size.
    const mod = (v: number, m: number) => ((v % m) + m) % m
    const phases = (span: number): number[] => {
      const out: number[] = []
      for (let k = 0; k < pitch; k += PHASE_STEP_MM) out.push(mod(span / 2 + k, pitch))
      return out
    }
    let bestScore = -Infinity
    for (const oy of phases(bb.maxY - bb.minY)) {
      for (const ox of phases(bb.maxX - bb.minX)) {
        const seat = latticeAt(bb, pitch, ox, oy).filter(fits)
        if (!seat.length) continue
        const flapCount = flapVerts(outer, seat, reach).length
        let sx = 0, sy = 0; for (const p of seat) { sx += p[0]; sy += p[1] }
        const balance = Math.hypot(sx / seat.length - cx, sy / seat.length - cy)
        const score = registrationScore(seat.length, flapCount, balance)
        if (score > bestScore) { bestScore = score; bestSeated = seat; bestOx = ox; bestOy = oy }
      }
    }
  }

  const lattice = latticeAt(bb, pitch, bestOx, bestOy)

  const coverage = applyCoverage(bestSeated, perimeterOnly, pitch)
  const anchors = assignSizes(coverage.seated, plan)

  const flaps: Pt[] = coverage.seated.length ? flapVerts(outer, coverage.seated, reach) : []
  const issues = verdictIssues(!fits, coverage.seated.length, flaps.length, pad)

  let minD: number = MAGNET_DIA_LARGE_MM, maxD: number = MAGNET_DIA_SMALL_MM
  for (const a of anchors) { if (a.dia < minD) minD = a.dia; if (a.dia > maxD) maxD = a.dia }
  if (anchors.length === 0) { minD = MAGNET_DIA_SMALL_MM; maxD = MAGNET_DIA_SMALL_MM }

  return {
    anchors,
    flaps,
    ok: issues.length === 0,
    issues,
    pitchCentreMM: pitch,
    edgeRangeMM: [pitch + minD, pitch + maxD],
    lattice,
    phaseMM: [bestOx, bestOy],
    spotRadiusMM: spotRadiusOf(pad),
  }
}

/** One holding size in a band: the size and how many magnets it seats. */
export interface BandSnapPoint { sizeMM: number; count: number }

/** The walk range: the band as a RANGE; above the last band, up to the derived field span. */
function snapRange(cfg: GridConfig, fromMM: number): [number, number] {
  const band = bandOf(fromMM)
  if (band) return [band.minMM, band.maxMM]
  return [fromMM, fieldSpanMM(cfg.pitchMM ?? DEFAULT_PITCH_MM, Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))]
}

/**
 * Every holding size in the band, scanned at stepMM. The band is a RANGE: fit is not monotone,
 * so the whole range is walked and each size judged independently.
 */
export function bandSnapPoints(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): BandSnapPoint[] {
  const [lo, hi] = snapRange(cfg, fromMM)
  const out: BandSnapPoint[] = []
  for (let mm = lo; mm <= hi; mm += stepMM) {
    const grid = computeGrid(sized(mm), cfg)
    if (isHolding(grid.anchors.length, grid.flaps.length)) out.push({ sizeMM: mm, count: grid.anchors.length })
  }
  return out
}

/**
 * Band snap: the pick is the smallest size achieving the band's MAXIMUM seated count.
 * `ladder` is every holding size at that count, smallest to biggest — the band's fit steps.
 */
export function fitSizeInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { sizeMM: number; grid: GridResult; points: BandSnapPoint[]; ladder: BandSnapPoint[] } {
  const points = bandSnapPoints(sized, cfg, fromMM, stepMM)
  if (points.length) {
    const maxCount = Math.max(...points.map((p) => p.count))
    const ladder = points.filter((p) => p.count === maxCount)
    return { sizeMM: ladder[0].sizeMM, grid: computeGrid(sized(ladder[0].sizeMM), cfg), points, ladder }
  }
  // Nothing in the band holds: best-seated rung as a fallback.
  const [lo, hi] = snapRange(cfg, fromMM)
  let best: { sizeMM: number; grid: GridResult } | null = null
  for (let mm = lo; mm <= hi; mm += stepMM) {
    const grid = computeGrid(sized(mm), cfg)
    if (!best || grid.anchors.length > best.grid.anchors.length) best = { sizeMM: mm, grid }
  }
  const pick = best ?? { sizeMM: lo, grid: computeGrid(sized(lo), cfg) }
  return { ...pick, points, ladder: [] }
}
