// draw/fit — keep-raw vectorisation: the user's hand, faithfully (blueprint draw.md — "the
// wobble preserved faithfully as true, manufacturable curves"). One light jitter pass (sensor
// noise dies, intentional wobble survives), then corners-where-drawn + ONE Schneider fit at a
// tolerance tied to the stroke's own size — zoom level can never change precision.

import type { Vec2, VShape } from '@/lib/vector-core'
import { ringToVPath } from '@/lib/vector-core'
import { fairTracedRing, fairingFromDetail, BEN_DEFAULT_DETAIL, type Vec2Px } from '@/lib/outline-core'
import { resampleStroke } from './recognizer'

/** Close an open stroke into a ring (drops a trailing point that already returned to the start). */
function closeStroke(stroke: Vec2[]): Vec2[] {
  const pts = stroke.slice()
  const a = pts[0], b = pts[pts.length - 1]
  let size = 0
  {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of pts) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    size = Math.max(maxX - minX, maxY - minY)
  }
  if (Math.hypot(a.x - b.x, a.y - b.y) < size * 0.04) pts.pop()
  return pts
}

/** Faithful vector fit of a drawn stroke: corners where the hand drew corners, curves elsewhere. */
export function vectoriseStroke(stroke: Vec2[]): VShape | null {
  if (stroke.length < 8) return null
  const ring0 = closeStroke(stroke)
  if (ring0.length < 8) return null
  // dense uniform ring + two 3-tap average passes — sensor jitter dies under the fit tolerance;
  // straw-based corner detection below is smear-tolerant, and intentional wobble (tens-of-px
  // wavelengths) passes through the short averaging window untouched
  let smooth = resampleStroke([...ring0, ring0[0]], 256)
  smooth.pop()
  const n = smooth.length
  for (let pass = 0; pass < 2; pass++) {
    smooth = smooth.map((_, i) => {
      const a = smooth[(i - 1 + n) % n], b = smooth[i], c = smooth[(i + 1) % n]
      return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 }
    })
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of smooth) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const diag = Math.hypot(maxX - minX, maxY - minY) || 1
  // IStraw-class corner detection (blueprint: plain per-sample angles over-fire on noisy hands):
  // measure the turn over a WIDE straw (±k samples) where jitter reads ~6°, a drawn corner ~90°,
  // and a smooth wave stays below the bar — then non-max suppress within the straw window.
  const corners = strawCorners(smooth, Math.max(3, Math.round(n / 42)), 55)
  // diag/200 ≈ 0.1mm at product scale — under cutter kerf; intent survives, jitter can't split.
  const path = ringToVPath(smooth, 40, diag / 200, corners)
  return path.anchors.length >= 3 ? { paths: [path] } : null
}

/** Corner indices on a closed ring via straw angles + non-maximum suppression. */
function strawCorners(ring: Vec2[], k: number, thresholdDeg: number): number[] {
  const n = ring.length
  const ang = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const a = ring[(i - k + n) % n], p = ring[i], b = ring[(i + k) % n]
    const v1x = p.x - a.x, v1y = p.y - a.y, v2x = b.x - p.x, v2y = b.y - p.y
    const l1 = Math.hypot(v1x, v1y) || 1e-12, l2 = Math.hypot(v2x, v2y) || 1e-12
    const dot = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2)))
    ang[i] = (Math.acos(dot) * 180) / Math.PI
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    if (ang[i] < thresholdDeg) continue
    let isMax = true
    for (let d = 1; d <= k; d++) {
      if (ang[(i - d + n) % n] > ang[i] || ang[(i + d) % n] >= ang[i]) { isMax = false; break }
    }
    if (isMax) out.push(i)
  }
  return out
}

/**
 * BEN-style CORRECTION of a drawn stroke (KAI-8949 — Dan's model: take the DRAWN path and
 * auto-adjust it to remove flagrant imperfections → smooth shapes, not jittery lines; it corrects
 * what was drawn, it does NOT substitute a stock shape). The exact machinery Magic uses on the AI
 * trace — the Dan-tuned fairing engine → one Schneider fit — pointed at the hand-drawn ring.
 */
export function correctStroke(stroke: Vec2[]): VShape | null {
  if (stroke.length < 8) return null
  const ring0 = closeStroke(stroke)
  if (ring0.length < 8) return null
  const faired = fairTracedRing(ring0.map((p) => [p.x, p.y] as Vec2Px), fairingFromDetail(BEN_DEFAULT_DETAIL))
  if (faired.length < 3) return null
  const path = ringToVPath(faired.map(([x, y]) => ({ x, y })), 30, 0.35)
  return path.anchors.length >= 3 ? { paths: [path] } : null
}
