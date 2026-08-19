// grid-origin-compute.ts — COMPUTE: geometry and arithmetic. Values come from spec or the caller.

import type { Contour, Pt } from './types'
import { pointInPolygon } from './attachment'
import { holds, prepare } from '@/lib/grid-engine/compute/geometry'
import { DEFAULT_PITCH_MM, FIELD_POSITIONS_PER_AXIS } from './grid-origin-spec'

export type BBox = { minX: number; minY: number; maxX: number; maxY: number }

export function bbox(pts: ReadonlyArray<Pt>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

export function dist(a: Pt, b: Pt): number { return Math.hypot(a[0] - b[0], a[1] - b[1]) }

/** Spot radius = the padding, measured from the magnet centre. */
export function spotRadiusOf(padMM: number): number {
  return padMM
}

/** Full field span: the fixed 9×9 board on the base 48 grid, plus one spot either side — 408 at
 *  12 padding. Pitch never changes the board: 96 skips points on it, 24 adds points within it. */
export function fieldSpanMM(padMM: number): number {
  return (FIELD_POSITIONS_PER_AXIS - 1) * DEFAULT_PITCH_MM + 2 * spotRadiusOf(padMM)
}

/** Axis positions at `step` with a phase offset, spanning [min, max]. */
function axisFrom(min: number, max: number, step: number, phase: number): number[] {
  if (step <= 0 || max <= min) return [(min + max) / 2]
  const res: number[] = []
  let x = min + (((phase % step) + step) % step)
  while (x - step >= min - 1e-6) x -= step
  for (; x <= max + 1e-6; x += step) if (x >= min - 1e-6) res.push(x)
  return res
}

/** Lattice across a region at phase (ox, oy). */
export function latticeAt(bb: BBox, pitch: number, ox: number, oy: number): Pt[] {
  const out: Pt[] = []
  for (const x of axisFrom(bb.minX, bb.maxX, pitch, ox))
    for (const y of axisFrom(bb.minY, bb.maxY, pitch, oy)) out.push([x, y])
  return out
}

/** The same lattice generator over an arbitrary region. */
export function latticeOver(region: BBox, pitch: number, phase: Pt): Pt[] {
  return latticeAt(region, pitch, phase[0], phase[1])
}

/** Float distance from a point to the outline's nearest edge — the prescreen metric. */
function edgeDistMM(outer: ReadonlyArray<Pt>, pt: Pt): number {
  let min = Infinity
  const [px, py] = pt
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const [ax, ay] = outer[j], [bx, by] = outer[i]
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
    if (t < 0) t = 0; else if (t > 1) t = 1
    const ex = px - (ax + t * dx), ey = py - (ay + t * dy)
    const d2 = ex * ex + ey * ey
    if (d2 < min) min = d2
  }
  return Math.sqrt(min)
}

/**
 * Seat predicate for one outline: centre at least `spotRadiusMM` from every boundary point,
 * tangency passing by equality (exact integer arithmetic, micron quantum).
 * A float prescreen answers the clear cases; only points within a guard band of the exact
 * threshold fall through to the integer test — the answer never changes, only the cost.
 * Null for a degenerate outline.
 */
export function makeSeatPredicate(
  outer: ReadonlyArray<Pt>,
  spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const QUANTUM = 0.001
  const GUARD = 0.05
  let prep: ReturnType<typeof prepare>
  try { prep = prepare(outer, QUANTUM) } catch { return null }
  const rQ = Math.round(spotRadiusMM / QUANTUM)
  return (pt: Pt) => {
    const d = edgeDistMM(outer, pt)
    if (d > spotRadiusMM + GUARD) return pointInPolygon(pt, outer as Pt[])
    if (d < spotRadiusMM - GUARD) return false
    return holds(prep, [Math.round(pt[0] / QUANTUM), Math.round(pt[1] / QUANTUM)], rQ)
  }
}

/**
 * Seat predicate for a TRUE CIRCLE (centre c, radius R): the disc of radius r fits iff
 * |p−c|² ≤ (R−r)² — integer microns, tangency by equality. A flattened polygon's chords sit
 * microns inside the curve and wrongly refuse the zero-margin case; the analytic form cannot.
 */
export function makeCircleSeatPredicate(
  cx: number, cy: number, R: number, spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const q = (v: number) => Math.round(v * 1000)
  const slack = q(R) - q(spotRadiusMM)
  if (slack < 0) return null
  const cqx = q(cx), cqy = q(cy), s2 = slack * slack
  return (pt: Pt) => {
    const dx = q(pt[0]) - cqx, dy = q(pt[1]) - cqy
    return dx * dx + dy * dy <= s2
  }
}

/** Silhouette vertices further than `reach` from the nearest magnet (flap-risk edge). */
export function flapVerts(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number): Pt[] {
  const out: Pt[] = []
  for (const v of outer) {
    let nd = Infinity
    for (const a of seated) { const d = dist(v, a); if (d < nd) nd = d; if (nd <= reach) break }
    if (nd > reach) out.push(v)
  }
  return out
}

/** Mean distance silhouette vertices sit PAST `reach`, mm. 0 = fully wrapped. Graded, so a
 *  placement covering more material scores better even when nothing is fully covered. */
export function flapExcessMM(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number): number {
  if (!outer.length || !seated.length) return 0
  let sum = 0
  for (const v of outer) {
    let nd = Infinity
    for (const a of seated) { const d = dist(v, a); if (d < nd) nd = d; if (nd <= reach) break }
    if (nd > reach) sum += nd - reach
  }
  return sum / outer.length
}

/** One connected island of the legal magnet-centre area, measured on a coarse mesh. */
export interface SafeSegment {
  areaMM2: number
  centreMM: Pt
  bbox: BBox
  /** Mesh spacing the island was measured at — the drawing draws one cell per point. */
  cellMM: number
  /** The yes-points of the mesh belonging to this island. */
  cells: Pt[]
}

/**
 * The legal area's separate islands. The seat predicate is sampled on a mesh over the bbox and
 * touching yes-cells are grouped (4-neighbour flood). A MEASUREMENT for display and scoring —
 * every magnet's legality stays the exact per-point test, never this mesh.
 */
export function safeSegments(outer: ReadonlyArray<Pt>, spotRadiusMM: number): SafeSegment[] {
  const fits = makeSeatPredicate(outer, spotRadiusMM)
  if (!fits) return []
  const step = 3 // mesh resolution, mm — measurement grain, not a law value
  const bb = bbox(outer)
  const nx = Math.max(1, Math.round((bb.maxX - bb.minX) / step) + 1)
  const ny = Math.max(1, Math.round((bb.maxY - bb.minY) / step) + 1)
  const at = (ix: number, iy: number): Pt => [bb.minX + ix * step, bb.minY + iy * step]
  const flag = new Uint8Array(nx * ny)
  for (let iy = 0; iy < ny; iy++)
    for (let ix = 0; ix < nx; ix++)
      if (fits(at(ix, iy))) flag[iy * nx + ix] = 1
  const seen = new Uint8Array(nx * ny)
  const out: SafeSegment[] = []
  for (let start = 0; start < nx * ny; start++) {
    if (!flag[start] || seen[start]) continue
    const stack = [start]
    seen[start] = 1
    const cells: Pt[] = []
    let sx = 0, sy = 0
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    while (stack.length) {
      const i = stack.pop()!
      const ix = i % nx, iy = (i / nx) | 0
      const p = at(ix, iy)
      cells.push(p)
      sx += p[0]; sy += p[1]
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]
      if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]
      const near = [i - 1, i + 1, i - nx, i + nx]
      for (const j of near) {
        if (j < 0 || j >= nx * ny || seen[j] || !flag[j]) continue
        const jx = j % nx
        if (Math.abs(jx - ix) > 1) continue // row wrap
        seen[j] = 1
        stack.push(j)
      }
    }
    out.push({
      areaMM2: cells.length * step * step,
      centreMM: [sx / cells.length, sy / cells.length],
      bbox: { minX, minY, maxX, maxY },
      cellMM: step,
      cells,
    })
  }
  out.sort((a, b) => a.areaMM2 - b.areaMM2)
  return out
}

/** Split seated nodes into perimeter belt and fully-surrounded interior. */
export function splitPerimeter(seated: ReadonlyArray<Pt>, step: number): { belt: Pt[]; interior: Pt[] } {
  const R = step * 1.45
  const belt: Pt[] = [], interior: Pt[] = []
  for (let i = 0; i < seated.length; i++) {
    const p = seated[i]
    let l = false, r = false, u = false, d = false
    for (let j = 0; j < seated.length; j++) {
      if (j === i) continue
      const dx = seated[j][0] - p[0], dy = seated[j][1] - p[1]
      if (Math.hypot(dx, dy) > R) continue
      if (dx > 1) r = true; else if (dx < -1) l = true
      if (dy > 1) u = true; else if (dy < -1) d = true
    }
    if (l && r && u && d) interior.push(p); else belt.push(p)
  }
  return { belt, interior }
}

/** Scale a normalized contour (longest side = 1mm) to a real longest side in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  return { outer: { pts: base.outer.pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt) }, holes: [] }
}
