// grid-magnet-wrap-compute.ts — COMPUTE: wrap. Self-contained, exact.
//
// ONE job: add N magnets, shrink the shape onto them.
//
// Method (Clipper2, the recommended geometry route — no physics loop, no iteration artifacts):
//
//   1. Deflate the outline by the disc radius. The remaining region is exactly where a magnet
//      CENTRE is allowed to sit.
//   2. The magnets are a rigid group with local offsets L1..Ln, so the grid origin O is valid iff
//      every O+Li lies in that region — i.e. iff O lies in the INTERSECTION of the region
//      translated by each -Li.
//   3. Non-empty intersection ⟺ the group fits at this size. Empty ⟺ it does not.
//   4. Binary-search the size for the smallest one that still fits. That is the tightest wrap,
//      computed rather than converged on, so it cannot stop early or jitter.
//
// Deliberately disconnected from the rest of the engine: no centring modes, no governing mass, no
// safe-area islands, no voting, no coverage, no flap. Inputs are the outline, the pitch and the
// radius. Nothing here reads a policy.

import { Clipper, FillRule, JoinType, EndType, type Paths64 } from '@countertype/clipper2-ts'
import type { Contour, Pt } from './types'
import { DEFAULT_PITCH_MM, MAGNET_DIA_SMALL_MM, MAGNET_DIA_LARGE_MM, PADDING_FLOOR_MM } from './grid-magnet-spec'
import type { GridResult } from './grid-magnet'
import type { SafeSegment } from './grid-magnet-compute'

/** mm → integer microns; Clipper64 is integer-robust. */
const S = 1000

export interface WrapConfig {
  pitchMM?: number
  paddingMM?: number
  magnetDiaMM?: number
}

export interface WrapAt {
  count: number
  sizeMM: number
  points: Pt[]
  originMM: Pt
  gapsMM: number[]
}

function box(pts: ReadonlyArray<Pt>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

function inside(o: ReadonlyArray<Pt>, px: number, py: number): boolean {
  let hit = false
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const xi = o[i][0], yi = o[i][1], xj = o[j][0], yj = o[j][1]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

function nearestDist(o: ReadonlyArray<Pt>, px: number, py: number): number {
  let bd = Infinity
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const ax = o[j][0], ay = o[j][1]
    const abx = o[i][0] - ax, aby = o[i][1] - ay
    const ab2 = abx * abx + aby * aby
    let t = ab2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / ab2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const vx = px - (ax + t * abx), vy = py - (ay + t * aby)
    const d2 = vx * vx + vy * vy
    if (d2 < bd) bd = d2
  }
  return Math.sqrt(bd)
}

/** Where a magnet centre may sit: the outline deflated by the disc radius. */
function seatRegion(outer: ReadonlyArray<Pt>, radiusMM: number): Paths64 | null {
  const flat: number[] = []
  for (const [x, y] of outer) flat.push(Math.round(x * S), Math.round(y * S))
  const region = Clipper.inflatePaths([Clipper.makePath(flat)], -radiusMM * S, JoinType.Round, EndType.Polygon, 2, 0.05 * S)
  return region && region.length ? region : null
}

/** Every grid origin at which the whole rigid group is seated — empty when it cannot fit. */
function validOrigins(region: Paths64, group: ReadonlyArray<Pt>): Paths64 | null {
  let acc: Paths64 | null = null
  for (const [lx, ly] of group) {
    const shifted = Clipper.translatePaths(region, Math.round(-lx * S), Math.round(-ly * S))
    acc = acc === null ? shifted : Clipper.intersect(acc, shifted, FillRule.NonZero)
    if (!acc || acc.length === 0) return null
  }
  return acc && acc.length ? acc : null
}

/** A representative origin from the valid set — the one nearest a preferred point. */
function pickOrigin(valid: Paths64, towards: Pt): Pt {
  let best: Pt = towards, bd = Infinity
  for (const path of valid) {
    // vertices, plus each edge midpoint, is plenty to land inside a small valid region
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[(i + 1) % path.length]
      const cands: Pt[] = [
        [Number(a.x) / S, Number(a.y) / S],
        [(Number(a.x) + Number(b.x)) / (2 * S), (Number(a.y) + Number(b.y)) / (2 * S)],
      ]
      for (const c of cands) {
        const d = (c[0] - towards[0]) ** 2 + (c[1] - towards[1]) ** 2
        if (d < bd) { bd = d; best = c }
      }
    }
  }
  return best
}

/** Add `count` magnets and wrap the shape around them. */
export function wrap(
  sized: (mm: number) => Contour, cfg: WrapConfig, count: number, minMM: number, maxMM: number,
): WrapAt | null {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const want = Math.max(1, Math.round(count))
  const half = pitch / 2

  // Candidate rigid groups: the `want` seats nearest the group centre. Four lattice parities
  // (node or gap on the centre, per axis) and both tie-break orders, so a pair can lie along
  // either axis. Every candidate is measured; the one that wraps smallest wins.
  const groups: Pt[][] = []
  const span = Math.ceil(Math.sqrt(want)) + 2
  for (const ox of [0, half]) for (const oy of [0, half]) {
    const all: Pt[] = []
    for (let ix = -span; ix <= span; ix++) for (let iy = -span; iy <= span; iy++)
      all.push([ox + ix * pitch, oy + iy * pitch])
    for (const axis of [0, 1]) {
      const sorted = [...all].sort((a, b) => {
        const da = Math.hypot(a[0], a[1]), db = Math.hypot(b[0], b[1])
        if (Math.abs(da - db) > 1e-9) return da - db
        return axis === 0 ? a[0] - b[0] || a[1] - b[1] : a[1] - b[1] || a[0] - b[0]
      })
      groups.push(sorted.slice(0, want))
    }
  }

  /** Does this group fit at this size, and if so where? */
  const fitAt = (group: Pt[], mm: number): Pt | null => {
    const outer = sized(mm).outer.pts
    const region = seatRegion(outer, radius)
    if (!region) return null
    const valid = validOrigins(region, group)
    if (!valid) return null
    const bb = box(outer)
    return pickOrigin(valid, [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2])
  }

  let won: { size: number; origin: Pt; group: Pt[] } | null = null
  for (const group of groups) {
    if (!fitAt(group, maxMM)) continue                 // cannot hold this group at any size
    // Smallest size that still fits — exact to 0.01 mm.
    let lo = minMM, hi = maxMM
    if (fitAt(group, lo)) hi = lo
    else while (hi - lo > 0.01) {
      const mid = (lo + hi) / 2
      if (fitAt(group, mid)) hi = mid; else lo = mid
    }
    const origin = fitAt(group, hi)
    if (!origin) continue
    if (!won || hi < won.size) won = { size: hi, origin, group }
  }
  if (!won) return null

  const outer = sized(won.size).outer.pts
  const pts = won.group.map(([lx, ly]) => [won!.origin[0] + lx, won!.origin[1] + ly] as Pt)
  return {
    count: pts.length,
    sizeMM: Math.round(won.size * 100) / 100,
    points: pts,
    originMM: won.origin,
    gapsMM: pts.map((p) => Math.max(0, nearestDist(outer, p[0], p[1]) - radius)),
  }
}

/** The wrapped answer as the canvas draws it. Display only — nothing is decided here. */
export function wrapGrid(
  sized: (mm: number) => Contour, cfg: WrapConfig, at: WrapAt,
): { contour: Contour; grid: GridResult } {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const dia = cfg.magnetDiaMM === MAGNET_DIA_LARGE_MM ? MAGNET_DIA_LARGE_MM : MAGNET_DIA_SMALL_MM
  const contour = sized(at.sizeMM)
  const bb = box(contour.outer.pts)
  const seed = at.points[0] ?? at.originMM
  const reach = Math.ceil(Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / pitch) + 2
  const lattice: Pt[] = []
  for (let ix = -reach; ix <= reach; ix++) for (let iy = -reach; iy <= reach; iy++)
    lattice.push([seed[0] + ix * pitch, seed[1] + iy * pitch])
  const mod = (v: number, m: number) => ((v % m) + m) % m
  return {
    contour,
    grid: {
      anchors: at.points.map((p) => ({ p, dia })),
      pitchCentreMM: pitch,
      lattice,
      phaseMM: [mod(seed[0] - bb.minX, pitch), mod(seed[1] - bb.minY, pitch)],
      panMM: [0, 0],
      spotRadiusMM: radius,
      contactsMM: at.points.filter((_, i) => (at.gapsMM[i] ?? Infinity) <= 0.6),
      segments: [],
      centresMM: [at.originMM],
      centreMainMM: at.originMM,
    },
  }
}


/** One offerable layout: a wrapped size and the magnets that hold the shape at it. */
