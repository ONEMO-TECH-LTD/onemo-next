// grid-origin.ts — the engine bridge: computeGrid and the band snap, wiring spec + compute + logic.
// One import door for consumers; the modules stay behind it.

import type { Contour, Pt } from './types'
import {
  DEFAULT_PITCH_MM,
  FLAP_MM,
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
  MIN_EFFECT_MM,
  PADDING_FLOOR_MM,
  PHASE_STEP_MM,
} from './grid-origin-spec'
import {
  bbox,
  centroidMM,
  fieldSpanMM,
  flapExcessMM,
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
  /** How finely the lattice slides under the shape when searching registrations. */
  phaseStepMM?: number
  /** Manual calibration: force this registration (mm phase) instead of searching. */
  forcePhaseMM?: Pt
  /** Grid anchor: centroid balances the MATERIAL (default — coincides with bbox on regular
   *  shapes); bbox balances the FRAME. An A/B instrument, not two behaviours to maintain. */
  center?: 'centroid' | 'bbox'
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — perimeter belt drops surrounded interior nodes
  /** The outline is a true circle: judge against the analytic curve, not its flattened chords. */
  circle?: boolean
}

export interface GridResult {
  anchors: Anchor[]
  /** Silhouette vertices past reach — the band holding gate reads this; not a user-facing verdict. */
  flaps: Pt[]
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
  // The anchor: where a node line is guaranteed to land, and what balance is measured against.
  // Centroid = the material's balance point; bbox = the frame's. Identical on regular shapes.
  const centre: Pt = (cfg.center ?? 'centroid') === 'bbox'
    ? [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
    : centroidMM(outer)
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
    let bestScore = -Infinity
    for (const oy of phases(offY)) {
      for (const ox of phases(offX)) {
        const seat = latticeAt(bb, pitch, ox, oy).filter(fits)
        if (!seat.length) continue
        const excess = flapExcessMM(outer, seat, reach)
        let sx = 0, sy = 0; for (const p of seat) { sx += p[0]; sy += p[1] }
        const balance = Math.hypot(sx / seat.length - centre[0], sy / seat.length - centre[1])
        const score = registrationScore(seat.length, excess, balance)
        if (score > bestScore) { bestScore = score; bestSeated = seat; bestOx = ox; bestOy = oy }
      }
    }
  }

  const lattice = latticeAt(bb, pitch, bestOx, bestOy)

  const coverage = applyCoverage(bestSeated, perimeterOnly, pitch)
  const anchors = assignSizes(coverage.seated, plan)

  const flaps: Pt[] = coverage.seated.length ? flapVerts(outer, coverage.seated, reach) : []

  let minD: number = MAGNET_DIA_LARGE_MM, maxD: number = MAGNET_DIA_SMALL_MM
  for (const a of anchors) { if (a.dia < minD) minD = a.dia; if (a.dia > maxD) maxD = a.dia }
  if (anchors.length === 0) { minD = MAGNET_DIA_SMALL_MM; maxD = MAGNET_DIA_SMALL_MM }

  return {
    anchors,
    flaps,
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
  return [fromMM, fieldSpanMM(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))]
}

/**
 * Band snap. A VARIANT is a magnet COUNT whose SNUGGEST size — measured globally, from the
 * smallest effect up — falls inside this band's range. A count that already seats below the
 * band floor is the previous band's answer stretched loose, never this band's variant.
 * The landing pick (`pickIdx`) is the band's maximum-count variant at its snug size.
 */
export function fitSizeInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { sizeMM: number; grid: GridResult; ladder: BandSnapPoint[]; pickIdx: number } {
  const [lo, hi] = snapRange(cfg, fromMM)
  const scanLo = bandOf(fromMM) ? MIN_EFFECT_MM : lo
  // Global snug scan: the first (smallest) size each count seats at.
  const snug = new Map<number, number>()
  for (let mm = scanLo; mm <= hi; mm += stepMM) {
    const grid = computeGrid(sized(mm), cfg)
    const c = grid.anchors.length
    if (isHolding(c) && !snug.has(c)) snug.set(c, mm)
  }
  const ladder: BandSnapPoint[] = [...snug.entries()]
    .filter(([, mm]) => mm >= lo && mm <= hi)
    .map(([count, sizeMM]) => ({ sizeMM, count }))
    .sort((a, b) => a.sizeMM - b.sizeMM)
  if (ladder.length) {
    const maxCount = Math.max(...ladder.map((p) => p.count))
    const pickIdx = ladder.findIndex((p) => p.count === maxCount)
    return { sizeMM: ladder[pickIdx].sizeMM, grid: computeGrid(sized(ladder[pickIdx].sizeMM), cfg), ladder, pickIdx }
  }
  // No count unlocks in this band: best-seated rung as a fallback.
  let best: { sizeMM: number; grid: GridResult } | null = null
  for (let mm = lo; mm <= hi; mm += stepMM) {
    const grid = computeGrid(sized(mm), cfg)
    if (!best || grid.anchors.length > best.grid.anchors.length) best = { sizeMM: mm, grid }
  }
  const pick = best ?? { sizeMM: lo, grid: computeGrid(sized(lo), cfg) }
  return { ...pick, ladder: [], pickIdx: 0 }
}
