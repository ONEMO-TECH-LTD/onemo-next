// grid-origin.ts — the engine bridge: computeGrid and fitSizeToGrid, wiring spec + compute + logic.
// One import door for consumers; the modules stay behind it.

import type { Contour, Pt } from './types'
import {
  DEFAULT_PITCH_MM,
  PADDING_FLOOR_MM,
  PHASE_STEP_MM,
  SNAP_MAX_MM,
  SNAP_STEP_MM,
  TARGET_ANCHORS,
  MIN_ANCHORS,
} from './grid-origin-spec'
import {
  bbox,
  countGaps,
  flapVerts,
  latticeAt,
  makeSeatPredicate,
  neighbourStep,
  spotRadiusOf,
  type GridPattern,
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
  type GridPattern,
} from './grid-origin-compute'
export { bandOf, isHolding, magnetRadiusMM, type Anchor, type MagnetDia, type MagnetPlan } from './grid-origin-logic'

export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  pattern?: GridPattern
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — perimeter belt drops surrounded interior nodes
}

export interface GridResult {
  anchors: Anchor[]
  /** Interior nodes dropped by perimeter mode. */
  candidates: Pt[]
  /** Silhouette vertices with no magnet within reach. */
  flaps: Pt[]
  ok: boolean
  issues: string[]
  pitchCentreMM: number
  edgeRangeMM: [number, number]
  applicationPadMM: number
  /** Slots with material that couldn't seat, flanked by seated neighbours. */
  gaps: number
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
  const pattern = cfg.pattern ?? 'standard'
  const plan = cfg.plan ?? 'all6'
  const perimeterOnly = cfg.perimeterOnly ?? true
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2

  const fits = makeSeatPredicate(outer, spotRadiusOf(pad))

  let bestSeated: Pt[] = []
  let bestOx = 0, bestOy = 0
  if (fits) {
    let bestScore = -Infinity
    for (let oy = 0; oy < pitch; oy += PHASE_STEP_MM) {
      for (let ox = 0; ox < pitch; ox += PHASE_STEP_MM) {
        const seat = latticeAt(bb, pitch, pattern, ox, oy).filter(fits)
        if (!seat.length) continue
        const flapCount = flapVerts(outer, seat, pitch).length
        let sx = 0, sy = 0; for (const p of seat) { sx += p[0]; sy += p[1] }
        const balance = Math.hypot(sx / seat.length - cx, sy / seat.length - cy)
        const score = registrationScore(seat.length, flapCount, balance)
        if (score > bestScore) { bestScore = score; bestSeated = seat; bestOx = ox; bestOy = oy }
      }
    }
  }

  const lattice = latticeAt(bb, pitch, pattern, bestOx, bestOy)
  const gaps = countGaps(outer, lattice, bestSeated, pitch)

  const coverage = applyCoverage(bestSeated, perimeterOnly, pitch, pattern, neighbourStep)
  const anchors = assignSizes(coverage.seated, plan)

  const flaps: Pt[] = coverage.seated.length ? flapVerts(outer, coverage.seated, pitch) : []
  const issues = verdictIssues(!fits, coverage.seated.length, flaps.length, pad)

  let minD = 8, maxD = 6
  for (const a of anchors) { if (a.dia < minD) minD = a.dia; if (a.dia > maxD) maxD = a.dia }
  if (anchors.length === 0) { minD = 6; maxD = 6 }

  return {
    anchors,
    candidates: coverage.interior,
    flaps,
    ok: issues.length === 0,
    issues,
    pitchCentreMM: pitch,
    edgeRangeMM: [pitch + minD, pitch + maxD],
    applicationPadMM: pad,
    gaps,
    lattice,
    phaseMM: [bestOx, bestOy],
    spotRadiusMM: spotRadiusOf(pad),
  }
}

/**
 * Band snap: walk every rung of the size's band and return the first that HOLDS (any pattern —
 * single, pair, 2x2, rows — whatever the material carries). Fit is not monotone on concave shapes,
 * so no early bail on failures; if no rung holds, the best-seated rung in the band is returned.
 */
export function fitSizeInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { sizeMM: number; grid: GridResult; snapped: boolean } {
  const band = bandOf(fromMM)
  const lo = band ? band.minMM : fromMM
  const hi = band ? band.maxMM : SNAP_MAX_MM
  const start = Math.max(lo, Math.round(fromMM))
  let best: { sizeMM: number; grid: GridResult } | null = null
  for (let mm = start; mm <= hi; mm += stepMM) {
    const grid = computeGrid(sized(mm), cfg)
    if (isHolding(grid.anchors.length, grid.flaps.length)) return { sizeMM: mm, grid, snapped: mm !== start }
    if (!best || grid.anchors.length > best.grid.anchors.length) best = { sizeMM: mm, grid }
  }
  if (best) return { ...best, snapped: best.sizeMM !== start }
  const grid = computeGrid(sized(start), cfg)
  return { sizeMM: start, grid, snapped: false }
}

/** Scan the size upward until the target count seats. Step/ceiling from spec, target from logic. */
export function fitSizeToGrid(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number,
  opts: { target?: number; maxMM?: number; step?: number } = {},
): { sizeMM: number; grid: GridResult; snapped: boolean } {
  const target = opts.target ?? TARGET_ANCHORS
  const maxMM = opts.maxMM ?? SNAP_MAX_MM
  const step = opts.step ?? SNAP_STEP_MM
  const start = Math.round(fromMM)
  let fallback: { sizeMM: number; grid: GridResult } | null = null
  for (let mm = start; mm <= maxMM; mm += step) {
    const grid = computeGrid(sized(mm), cfg)
    if (!fallback && grid.anchors.length >= MIN_ANCHORS) fallback = { sizeMM: mm, grid }
    if (grid.anchors.length >= target) return { sizeMM: mm, grid, snapped: mm !== start }
  }
  if (fallback) return { ...fallback, snapped: fallback.sizeMM !== start }
  return { sizeMM: maxMM, grid: computeGrid(sized(maxMM), cfg), snapped: true }
}
