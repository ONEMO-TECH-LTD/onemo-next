// grid-origin.ts — the engine bridge: computeGrid and the band snap, wiring spec + compute + logic.
// One import door for consumers; the modules stay behind it.

import type { Contour, Pt } from './types'
import {
  ANCHOR_BLEND_MAX_PCT,
  ANCHOR_BLEND_PCT,
  COVER_TIE_MM,
  DEFAULT_PITCH_MM,
  EDGE_REG_TOL_MM,
  FLAP_MM,
  GATE_LOOSE_MM,
  GATE_MODE,
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
  MIN_EFFECT_MM,
  PADDING_FLOOR_MM,
  PHASE_STEP_MM,
  RANK_ORDER,
  VARIANT_MODE,
} from './grid-origin-spec'
import {
  bbox,
  centroidMM,
  edgeRegistered,
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
  betterLayout,
  entersBand,
  type Anchor,
  type GateMode,
  type LayoutMeasure,
  type MagnetPlan,
  type RankOrder,
  type VariantMode,
} from './grid-origin-logic'

export * from './grid-origin-spec'
export {
  fieldSpanMM,
  latticeOver,
  scaleContour,
  spotRadiusOf,
} from './grid-origin-compute'
export { bandOf, type Anchor, type GateMode, type MagnetDia, type MagnetPlan, type RankOrder, type VariantMode } from './grid-origin-logic'

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
  gateMode?: GateMode
  gateLooseMM?: number
  variantMode?: VariantMode
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — perimeter belt drops surrounded interior nodes
  /** The outline is a true circle: judge against the analytic curve, not its flattened chords. */
  circle?: boolean
}

export interface GridResult {
  anchors: Anchor[]
  /** Silhouette vertices past reach — the band entry rule reads this; not a user-facing verdict. */
  flaps: Pt[]
  /** Mean mm the silhouette sits past reach for the delivered layout — the 'most' gate's measure. */
  excessMM: number
  pitchCentreMM: number
  edgeRangeMM: [number, number]
  /** Every lattice position at the chosen phase, seated or not. */
  lattice: Pt[]
  /** The phase the search chose, mm. */
  phaseMM: Pt
  /** Registration offset from the canonical phase, mm per axis — the pan class. */
  panMM: Pt
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
  let bestOx = 0, bestOy = 0, bestKx = 0, bestKy = 0
  const mod = (v: number, m: number) => ((v % m) + m) % m
  if (fits && cfg.forcePhaseMM) {
    // Manual calibration: seat exactly at the given registration, no search.
    bestOx = mod(cfg.forcePhaseMM[0], pitch)
    bestOy = mod(cfg.forcePhaseMM[1], pitch)
    bestKx = mod(bestOx - offX, pitch)
    bestKy = mod(bestOy - offY, pitch)
    bestSeated = latticeAt(bb, pitch, bestOx, bestOy).filter(fits)
  } else if (fits) {
    // Phases anchored on the canonical registration: k=0 puts a node line on the anchor
    // (odd-count parity); the 24mm offset in the walk is the even-count parity. Mechanics still
    // choose among them; anchoring guarantees the canonical phases are sampled at ANY size.
    const phases = (off: number): { p: number; k: number }[] => {
      const out: { p: number; k: number }[] = []
      for (let k = 0; k < pitch; k += phaseStep) out.push({ p: mod(off + k, pitch), k })
      return out
    }
    const order = cfg.rankOrder ?? (RANK_ORDER as RankOrder)
    const edgeTol = cfg.edgeTolMM ?? EDGE_REG_TOL_MM
    const coverTie = cfg.coverTieMM ?? COVER_TIE_MM
    let best: LayoutMeasure | null = null
    for (const py of phases(offY)) {
      for (const px of phases(offX)) {
        const seat = latticeAt(bb, pitch, px.p, py.p).filter(fits)
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
        if (!best || betterLayout(m, best, order, coverTie)) { best = m; bestSeated = seat; bestOx = px.p; bestOy = py.p; bestKx = px.k; bestKy = py.k }
      }
    }
  }

  const lattice = latticeAt(bb, pitch, bestOx, bestOy)

  const coverage = applyCoverage(bestSeated, perimeterOnly, pitch)
  const anchors = assignSizes(coverage.seated, plan)

  const flaps: Pt[] = coverage.seated.length ? flapVerts(outer, coverage.seated, reach) : []
  const excessMM = coverage.seated.length ? flapExcessMM(outer, coverage.seated, reach) : 0

  let minD: number = MAGNET_DIA_LARGE_MM, maxD: number = MAGNET_DIA_SMALL_MM
  for (const a of anchors) { if (a.dia < minD) minD = a.dia; if (a.dia > maxD) maxD = a.dia }
  if (anchors.length === 0) { minD = MAGNET_DIA_SMALL_MM; maxD = MAGNET_DIA_SMALL_MM }

  return {
    anchors,
    flaps,
    excessMM,
    pitchCentreMM: pitch,
    edgeRangeMM: [pitch + minD, pitch + maxD],
    lattice,
    phaseMM: [bestOx, bestOy],
    panMM: [bestKx, bestKy],
    spotRadiusMM: spotRadiusOf(pad),
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
 * Band snap — one walk, no re-scans. The entry rule (gate) decides which sizes join the list;
 * the variant rule decides what counts as its own step, each at its smallest size; the landing
 * pick (`pickIdx`) stays the smallest size at the band's MAXIMUM seated count.
 */
export function fitSizeInBand(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, stepMM: number,
): { sizeMM: number; grid: GridResult; points: BandSnapPoint[]; ladder: BandSnapPoint[]; pickIdx: number } {
  const [lo, hi] = snapRange(cfg, fromMM)
  const gate = cfg.gateMode ?? (GATE_MODE as GateMode)
  const loose = cfg.gateLooseMM ?? GATE_LOOSE_MM
  const variant = cfg.variantMode ?? (VARIANT_MODE as VariantMode)
  // 'newcount' homes each count at its globally snuggest size, so its scan starts at the floor.
  const scanLo = variant === 'newcount' && bandOf(fromMM) ? MIN_EFFECT_MM : lo
  const points: BandSnapPoint[] = []
  let bestAny: { sizeMM: number; grid: GridResult } | null = null
  for (let mm = scanLo; mm <= hi; mm += stepMM) {
    const grid = computeGrid(sized(mm), cfg)
    if (mm >= lo && (!bestAny || grid.anchors.length > bestAny.grid.anchors.length)) bestAny = { sizeMM: mm, grid }
    if (entersBand(gate, grid.anchors.length, grid.flaps.length, grid.excessMM, loose)) {
      points.push({ sizeMM: mm, count: grid.anchors.length, sig: layoutSig(grid) })
    }
  }
  const seen = new Set<string>()
  const keyOf = (p: BandSnapPoint) => variant === 'layout' ? p.sig : String(p.count)
  const ladder = points
    .filter((p) => !seen.has(keyOf(p)) && (seen.add(keyOf(p)), true))
    .filter((p) => p.sizeMM >= lo)
  if (ladder.length) {
    const maxCount = Math.max(...ladder.map((p) => p.count))
    const pickIdx = ladder.findIndex((p) => p.count === maxCount)
    return { sizeMM: ladder[pickIdx].sizeMM, grid: computeGrid(sized(ladder[pickIdx].sizeMM), cfg), points, ladder, pickIdx }
  }
  const pick = bestAny ?? { sizeMM: lo, grid: computeGrid(sized(lo), cfg) }
  return { ...pick, points, ladder: [], pickIdx: 0 }
}
