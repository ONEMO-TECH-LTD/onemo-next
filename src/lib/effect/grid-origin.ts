// grid-origin.ts — the engine bridge: computeGrid, wiring spec + compute + logic.
// One import door for consumers; the modules stay behind it.

import type { Contour, Pt } from './types'
import {
  ANCHOR_BLEND_MAX_PCT,
  ANCHOR_BLEND_PCT,
  COVER_TIE_MM,
  DEFAULT_PITCH_MM,
  EDGE_REG_TOL_MM,
  FLAP_MM,
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
  PADDING_FLOOR_MM,
  PHASE_STEP_MM,
  RANK_ORDER,
} from './grid-origin-spec'
import {
  bbox,
  centroidMM,
  edgeRegistered,
  flapExcessMM,
  latticeAt,
  makeCircleSeatPredicate,
  makeSeatPredicate,
  spotRadiusOf,
} from './grid-origin-compute'
import {
  applyCoverage,
  assignSizes,
  betterLayout,
  type Anchor,
  type LayoutMeasure,
  type MagnetPlan,
  type RankOrder,
} from './grid-origin-logic'

export * from './grid-origin-spec'
export {
  fieldSpanMM,
  latticeOver,
  scaleContour,
  spotRadiusOf,
} from './grid-origin-compute'
export { type Anchor, type MagnetDia, type MagnetPlan, type RankOrder } from './grid-origin-logic'

export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  /** How far material may extend past a spot's edge before it counts as a flap. 0 = edge-to-edge. */
  flapMM?: number
  /** How finely the lattice slides under the shape when searching registrations. */
  phaseStepMM?: number
  /** Manual calibration: force this registration (mm phase) instead of searching. */
  forcePhaseMM?: Pt
  /** Grid anchor position: 0 = box centre, 100 = material weight centre, 50 = midpoint. */
  anchorBlendPct?: number
  /** Lab dials — spec defaults reproduce shipped behaviour. */
  rankOrder?: RankOrder
  edgeTolMM?: number
  coverTieMM?: number
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — perimeter belt drops surrounded interior nodes
  /** The outline is a true circle: judge against the analytic curve, not its flattened chords. */
  circle?: boolean
}

export interface GridResult {
  anchors: Anchor[]
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
  const phaseStep = Math.max(1, cfg.phaseStepMM ?? PHASE_STEP_MM)
  const plan = cfg.plan ?? 'all6'
  const perimeterOnly = cfg.perimeterOnly ?? true
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  // The anchor: where a node line is guaranteed to land, and what balance is measured against —
  // blended between the box centre (0) and the material's weight centre (100).
  const t = Math.min(ANCHOR_BLEND_MAX_PCT, Math.max(0, cfg.anchorBlendPct ?? ANCHOR_BLEND_PCT)) / ANCHOR_BLEND_MAX_PCT
  const bc: Pt = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
  const cc = centroidMM(outer)
  const centre: Pt = [bc[0] + (cc[0] - bc[0]) * t, bc[1] + (cc[1] - bc[1]) * t]
  const offX = centre[0] - bb.minX, offY = centre[1] - bb.minY

  const fits = cfg.circle
    ? makeCircleSeatPredicate((bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2, Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2, spotRadiusOf(pad))
    : makeSeatPredicate(outer, spotRadiusOf(pad))

  let bestSeated: Pt[] = []
  let bestOx = 0, bestOy = 0
  const mod = (v: number, m: number) => ((v % m) + m) % m
  if (fits && cfg.forcePhaseMM) {
    // Manual calibration: seat exactly at the given registration, no search.
    bestOx = mod(cfg.forcePhaseMM[0], pitch)
    bestOy = mod(cfg.forcePhaseMM[1], pitch)
    bestSeated = latticeAt(bb, pitch, bestOx, bestOy).filter(fits)
  } else if (fits) {
    // Phases anchored on the canonical registration: k=0 puts a node line on the anchor
    // (odd-count parity); the 24mm offset in the walk is the even-count parity. Mechanics still
    // choose among them; anchoring guarantees the canonical phases are sampled at ANY size.
    const phases = (off: number): number[] => {
      const out: number[] = []
      for (let k = 0; k < pitch; k += phaseStep) out.push(mod(off + k, pitch))
      return out
    }
    const order = cfg.rankOrder ?? (RANK_ORDER as RankOrder)
    const edgeTol = cfg.edgeTolMM ?? EDGE_REG_TOL_MM
    const coverTie = cfg.coverTieMM ?? COVER_TIE_MM
    let best: LayoutMeasure | null = null
    for (const oy of phases(offY)) {
      for (const ox of phases(offX)) {
        const seat = latticeAt(bb, pitch, ox, oy).filter(fits)
        if (!seat.length) continue
        const registered = edgeRegistered(bb, seat, spotRadiusOf(pad), edgeTol)
        // Edges-first order only: an unregistered candidate can never beat a registered best.
        if (order === 'edges' && best?.registered && !registered) continue
        let sx = 0, sy = 0; for (const p of seat) { sx += p[0]; sy += p[1] }
        const m: LayoutMeasure = {
          registered,
          excessMM: flapExcessMM(outer, seat, reach),
          seats: seat.length,
          balanceMM: Math.hypot(sx / seat.length - centre[0], sy / seat.length - centre[1]),
        }
        if (!best || betterLayout(m, best, order, coverTie)) { best = m; bestSeated = seat; bestOx = ox; bestOy = oy }
      }
    }
  }

  const lattice = latticeAt(bb, pitch, bestOx, bestOy)

  const coverage = applyCoverage(bestSeated, perimeterOnly, pitch)
  const anchors = assignSizes(coverage.seated, plan)

  let minD: number = MAGNET_DIA_LARGE_MM, maxD: number = MAGNET_DIA_SMALL_MM
  for (const a of anchors) { if (a.dia < minD) minD = a.dia; if (a.dia > maxD) maxD = a.dia }
  if (anchors.length === 0) { minD = MAGNET_DIA_SMALL_MM; maxD = MAGNET_DIA_SMALL_MM }

  return {
    anchors,
    pitchCentreMM: pitch,
    edgeRangeMM: [pitch + minD, pitch + maxD],
    lattice,
    phaseMM: [bestOx, bestOy],
    spotRadiusMM: spotRadiusOf(pad),
  }
}
