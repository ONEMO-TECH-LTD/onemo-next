// foundation/geometry.ts — FOUNDATION: the primitives every unit stands on.
//
// Primitives with two or more real unit consumers, and nothing else. Moved byte-identical; only the
// imports below are new. Foundation lands FIRST because a unit cannot import something that does
// not exist yet — extracting a unit before its primitives is what produced the compute<->segment
// cycle on the first attempt. The two-or-more-unit-consumers rule is measured at the END of S2,
// on the landed architecture, not on each intermediate commit.
//
// Nothing here holds policy: no threshold, no ranking, no choice. Measurement only.

import type { BBox, Contour, Pt } from '../types'

export function bbox(pts: ReadonlyArray<Pt>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

/**
 * Bucketed edge index — accelerates nearest-edge distance and ray parity. Results are
 * BIT-IDENTICAL to the full scans: every edge that could be nearest is examined with the same
 * arithmetic, and edges a query skips contribute no ray crossing by construction. Built once
 * per outline array (WeakMap) — a solve reuses it across its thousands of queries.
 */
interface EdgeIdx {
  cell: number; ox: number; oy: number; cols: number; rows: number
  buckets: number[][]
  yBands: number[][]
  /** Chebyshev ring distance from each cell to the nearest edge-holding cell (BFS). */
  ring: Int16Array
  stamp: Int32Array
  tick: number
}
const EDGE_IDX = new WeakMap<object, EdgeIdx>()
function edgeIdxOf(outer: ReadonlyArray<Pt>): EdgeIdx {
  let idx = EDGE_IDX.get(outer as object)
  if (idx) return idx
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of outer) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const cell = Math.max(4, Math.max(maxX - minX, maxY - minY) / 32)
  const cols = Math.max(1, Math.ceil((maxX - minX) / cell) + 1)
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell) + 1)
  const buckets: number[][] = Array.from({ length: cols * rows }, () => [])
  const yBands: number[][] = Array.from({ length: rows }, () => [])
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const [ax, ay] = outer[j], [bx, by] = outer[i]
    const c0 = Math.max(0, Math.min(cols - 1, Math.floor((Math.min(ax, bx) - minX) / cell)))
    const c1 = Math.max(0, Math.min(cols - 1, Math.floor((Math.max(ax, bx) - minX) / cell)))
    const r0 = Math.max(0, Math.min(rows - 1, Math.floor((Math.min(ay, by) - minY) / cell)))
    const r1 = Math.max(0, Math.min(rows - 1, Math.floor((Math.max(ay, by) - minY) / cell)))
    for (let r = r0; r <= r1; r++) { for (let c = c0; c <= c1; c++) buckets[r * cols + c].push(i); yBands[r].push(i) }
  }
  // dedupe band lists (an edge may span several columns of the same row)
  for (let r = 0; r < rows; r++) yBands[r] = [...new Set(yBands[r])]
  // Ring field: multi-source BFS from edge cells — a deep query starts its scan at the ring
  // that can actually hold the nearest edge instead of expanding through empty space.
  const ring = new Int16Array(cols * rows).fill(-1)
  let frontier: number[] = []
  for (let i = 0; i < cols * rows; i++) if (buckets[i].length) { ring[i] = 0; frontier.push(i) }
  for (let d = 1; frontier.length; d++) {
    const next: number[] = []
    for (const cellIdx of frontier) {
      const cr0 = Math.floor(cellIdx / cols), cc0 = cellIdx % cols
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = cr0 + dr, c = cc0 + dc
        if (rr < 0 || rr >= rows || c < 0 || c >= cols) continue
        const k = rr * cols + c
        if (ring[k] === -1) { ring[k] = d; next.push(k) }
      }
    }
    frontier = next
  }
  idx = { cell, ox: minX, oy: minY, cols, rows, buckets, yBands, ring, stamp: new Int32Array(outer.length), tick: 0 }
  EDGE_IDX.set(outer as object, idx)
  return idx
}

function segDist2(outer: ReadonlyArray<Pt>, i: number, px: number, py: number): number {
  const j = i === 0 ? outer.length - 1 : i - 1
  const [ax, ay] = outer[j], [bx, by] = outer[i]
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  if (t < 0) t = 0; else if (t > 1) t = 1
  const ex = px - (ax + t * dx), ey = py - (ay + t * dy)
  return ex * ex + ey * ey
}

/** Float distance from a point to the outline's nearest edge — the prescreen metric. */
export function edgeDistMM(outer: ReadonlyArray<Pt>, pt: Pt): number {
  const idx = edgeIdxOf(outer)
  const [px, py] = pt
  const cc = Math.max(0, Math.min(idx.cols - 1, Math.floor((px - idx.ox) / idx.cell)))
  const cr = Math.max(0, Math.min(idx.rows - 1, Math.floor((py - idx.oy) / idx.cell)))
  const tick = ++idx.tick
  let best = Infinity
  const maxR = Math.max(idx.cols, idx.rows)
  const r0 = Math.max(0, idx.ring[cr * idx.cols + cc] - 1)
  for (let r = r0; ; r++) {
    // Once every unexamined edge is provably farther than the best, stop.
    if (r > r0) { const lb = (r - 1) * idx.cell; if (lb * lb > best || r > maxR + r0) break }
    for (let dr = -r; dr <= r; dr++) {
      const rr = cr + dr
      if (rr < 0 || rr >= idx.rows) continue
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue
        const c = cc + dc
        if (c < 0 || c >= idx.cols) continue
        for (const e of idx.buckets[rr * idx.cols + c]) {
          if (idx.stamp[e] === tick) continue
          idx.stamp[e] = tick
          const d2 = segDist2(outer, e, px, py)
          if (d2 < best) best = d2
        }
      }
    }
  }
  return Math.sqrt(best)
}

/** Even-odd ray parity via the y-band index — identical crossings to the full scan. */
export function pointInOuter(pt: Pt, outer: ReadonlyArray<Pt>): boolean {
  const idx = edgeIdxOf(outer)
  const band = Math.max(0, Math.min(idx.rows - 1, Math.floor((pt[1] - idx.oy) / idx.cell)))
  let inside = false
  for (const i of idx.yBands[band]) {
    const j = i === 0 ? outer.length - 1 : i - 1
    const [xi, yi] = outer[i]
    const [xj, yj] = outer[j]
    const crosses = (yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/** Inside MATERIAL: inside the outer ring AND outside every supplied hole. The two facts every
 *  hole-aware path needs, held once — segment, layout and wrap all consume them, so they belong
 *  here rather than being rediscovered three times. */
export function pointInContour(pt: Pt, contour: Contour): boolean {
  return pointInOuter(pt, contour.outer.pts)
    && !contour.holes.some((hole) => pointInOuter(pt, hole.pts))
}

/** Distance to the nearest MATERIAL boundary — the outer ring or any hole edge, whichever is
 *  closer. A hole edge is as real a boundary as the outline. */
export function edgeDistToContourMM(contour: Contour, pt: Pt): number {
  let distanceMM = edgeDistMM(contour.outer.pts, pt)
  for (const hole of contour.holes) {
    distanceMM = Math.min(distanceMM, edgeDistMM(hole.pts, pt))
  }
  return distanceMM
}
