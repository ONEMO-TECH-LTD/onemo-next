// freeshape — stroke capture math. PURE: raw pointer samples → uniform closed ring, or null when
// the stroke isn't a usable loop (contract gate 4: never guess a shape from an open stroke).

import type { StrokePoint, Vec2 } from './types'

export interface StrokeStats {
  perimeter: number
  diag: number // bbox diagonal — the scale reference every tolerance hangs off
}

export function strokeStats(pts: StrokePoint[]): StrokeStats {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, perimeter = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
    if (i > 0) perimeter += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)
  }
  return { perimeter, diag: Math.hypot(maxX - minX, maxY - minY) }
}

/** Closed = the pen came back near its start, relative to how far it travelled. */
export function isClosedLoop(pts: StrokePoint[], stats: StrokeStats, closeTolerance: number): boolean {
  if (pts.length < 8 || stats.perimeter <= 0) return false
  const gap = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y)
  return gap <= stats.perimeter * closeTolerance
}

/**
 * Uniform arc-length resample of the stroke AS A CLOSED RING (the seam between last and first
 * point is treated as one more segment). Even spacing is what makes the downstream measures
 * (corner windows, circularity, PCA) stable regardless of how fast the finger moved.
 */
export function resampleClosed(pts: StrokePoint[], spacing: number): Vec2[] {
  const n = pts.length
  if (n < 3 || spacing <= 0) return pts.map((p) => ({ x: p.x, y: p.y }))
  const seg: number[] = []
  let perim = 0
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    seg.push(l); perim += l
  }
  const count = Math.max(32, Math.round(perim / spacing))
  const step = perim / count
  const out: Vec2[] = []
  let si = 0, into = 0
  for (let k = 0; k < count; k++) {
    let target = k * step
    while (target > into + seg[si]) { into += seg[si]; si = (si + 1) % n }
    const a = pts[si], b = pts[(si + 1) % n]
    const t = seg[si] > 0 ? (target - into) / seg[si] : 0
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  return out
}
