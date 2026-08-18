// grid-origin.ts — THE ENGINE'S OWN BRIDGE: the solve, assembled from the three modules.
//
// SPEC (grid-origin-spec) holds every value · COMPUTE (grid-origin-compute) does all geometry and
// arithmetic · LOGIC (grid-origin-logic) applies the policies. This file wires them into the two
// calls a surface makes — computeGrid and fitSizeToGrid — and re-exports the module surface so
// consumers keep one door.
//
// (Born 2026-07-20 as a 239-line monolith; split on Dan's module law, 2026-08-18, behaviour kept.)

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
  fieldSpanMM,
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
  magnetRadiusMM,
  registrationScore,
  verdictIssues,
  type Anchor,
  type MagnetDia,
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
export { magnetRadiusMM, type Anchor, type MagnetDia, type MagnetPlan } from './grid-origin-logic'

export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  pattern?: GridPattern
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — magnetic belt (drop redundant interior)
}

export interface GridResult {
  anchors: Anchor[]
  candidates: Pt[]      // interior points dropped by perimeter mode (faint viz)
  flaps: Pt[]
  ok: boolean
  issues: string[]
  pitchCentreMM: number
  edgeRangeMM: [number, number]
  applicationPadMM: number
  /** Slots with material that couldn't seat, flanked by seated neighbours — unbalanced holes. */
  gaps: number
  /** Every lattice position at the chosen phase, seated or not — the field the shape was judged against. */
  lattice: Pt[]
  /** The phase the search chose, in millimetres — what makes latticeOver answerable elsewhere. */
  phaseMM: Pt
  /** The spot's true radius — the padding, centre-measured, the erosion's own figure. */
  spotRadiusMM: number
}

/**
 * The solve: sweep the lattice phase on the grid's own 12mm increment, seat with the exact
 * predicate, judge registrations by logic's score, apply coverage policy, report.
 */
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

  // Phase sweep on the grid's own increment — includes the centred registrations by construction.
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
 * Sizing ADAPTS: scan UP from the selected size and return the first size whose grid seats the
 * target count. Step and ceiling are spec values; the target is logic's. (Slated for band rungs.)
 */
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
