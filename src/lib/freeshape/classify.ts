// freeshape — shape classification. PURE geometric measures on the uniform closed ring — no
// template matching, no AI (o-necessity: four invariants beat a gesture-template dependency for
// closed shapes). Wide-window corner detection tolerates finger wobble that per-sample turning
// angles (vector-core cornerIndices) would mistake for corners on a noisy stroke.

import type { ShapeVerdict, Vec2 } from './types'

export interface Classification {
  verdict: ShapeVerdict
  /** ring indices of detected corner apexes (rect: 4, triangle: 3) — feeds the harmonizer */
  corners: number[]
  centroid: Vec2
  /** PCA of the ring: unit major axis + the two half-extents */
  axis: Vec2
  major: number
  minor: number
  /** the de-wobbled ring every measure was taken on — the drawn INTENT; harmonize fits this */
  smoothed: Vec2[]
}


export function ringArea(ring: Vec2[]): number {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

export function ringPerimeter(ring: Vec2[]): number {
  let p = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    p += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return p
}

function centroidOf(ring: Vec2[]): Vec2 {
  let x = 0, y = 0
  for (const p of ring) { x += p.x; y += p.y }
  return { x: x / ring.length, y: y / ring.length }
}

/** Principal axis + half-extents via 2×2 covariance eigenvectors. */
function pca(ring: Vec2[], c: Vec2): { axis: Vec2; major: number; minor: number } {
  let xx = 0, xy = 0, yy = 0
  for (const p of ring) { const dx = p.x - c.x, dy = p.y - c.y; xx += dx * dx; xy += dx * dy; yy += dy * dy }
  const tr = xx + yy, det = xx * yy - xy * xy
  const l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det))
  const axis = Math.abs(xy) > 1e-9 ? { x: l1 - yy, y: xy } : (xx >= yy ? { x: 1, y: 0 } : { x: 0, y: 1 })
  const al = Math.hypot(axis.x, axis.y) || 1
  const u = { x: axis.x / al, y: axis.y / al }
  let maj = 0, min = 0
  for (const p of ring) {
    const dx = p.x - c.x, dy = p.y - c.y
    maj = Math.max(maj, Math.abs(dx * u.x + dy * u.y))
    min = Math.max(min, Math.abs(-dx * u.y + dy * u.x))
  }
  return { axis: u, major: maj, minor: min }
}

/**
 * Wide-window corner detection: turn angle between the k-back and k-forward chords at each sample;
 * local maxima above the threshold, clustered (one apex per cluster). Window ≈ 5% of the ring
 * rides over wobble that per-sample detectors read as corners.
 */
export function detectCorners(ring: Vec2[], thresholdDeg = 55): number[] {
  const n = ring.length
  const k = Math.max(2, Math.round(n * 0.05))
  const thr = (thresholdDeg * Math.PI) / 180
  const turn: number[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const a = ring[(i - k + n) % n], p = ring[i], b = ring[(i + k) % n]
    const v1x = p.x - a.x, v1y = p.y - a.y, v2x = b.x - p.x, v2y = b.y - p.y
    const l1 = Math.hypot(v1x, v1y) || 1e-9, l2 = Math.hypot(v2x, v2y) || 1e-9
    turn[i] = Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2))))
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    if (turn[i] < thr) continue
    // local max within the window → the cluster's apex
    let isMax = true
    for (let d = 1; d <= k && isMax; d++) {
      if (turn[(i + d) % n] > turn[i] || turn[(i - d + n) % n] > turn[i]) isMax = false
    }
    if (isMax) out.push(i)
  }
  // merge apexes closer than the window (equal-turn plateaus produce twins)
  const merged: number[] = []
  for (const i of out) {
    if (merged.length && ((i - merged[merged.length - 1] + n) % n) <= k) continue
    merged.push(i)
  }
  if (merged.length > 1 && ((merged[0] - merged[merged.length - 1] + n) % n) <= k) merged.pop()
  return merged
}

/** Circular moving average — strips finger tremor so measures see the drawn INTENT. A wobbly
 *  circle's raw perimeter is inflated by the jitter itself (circularity read 0.67 for a clear
 *  circle before this), while area/centroid barely move — smoothing fixes the ratio honestly. */
export function smoothRing(ring: Vec2[], k: number): Vec2[] {
  const n = ring.length
  if (n < 5 || k < 1) return ring
  const out: Vec2[] = new Array(n)
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0
    for (let d = -k; d <= k; d++) { const p = ring[(i + d + n) % n]; x += p.x; y += p.y }
    out[i] = { x: x / (2 * k + 1), y: y / (2 * k + 1) }
  }
  return out
}

/** Classify the uniform closed ring. Thresholds are starting constants (tuned by tests). */
export function classify(rawRing: Vec2[]): Classification {
  const ring = smoothRing(rawRing, Math.max(2, Math.round(rawRing.length * 0.03)))
  const centroid = centroidOf(ring)
  const { axis, major, minor } = pca(ring, centroid)
  const A = ringArea(ring), P = ringPerimeter(ring)
  const circularity = P > 0 ? (4 * Math.PI * A) / (P * P) : 0
  const corners = detectCorners(ring)
  const axisRatio = major > 0 ? minor / major : 1
  // rectangularity: area vs the PCA-aligned bounding rect (robust to rotation)
  const rectangularity = major > 0 && minor > 0 ? A / (4 * major * minor) : 0

  let verdict: ShapeVerdict = 'blob'
  if (corners.length === 3 && circularity < 0.85) verdict = 'triangle'
  else if (corners.length === 4 && rectangularity > 0.72) verdict = 'rect'
  else if (corners.length <= 1 && circularity > 0.8) verdict = axisRatio > 0.82 ? 'circle' : 'ellipse'
  return { verdict, corners, centroid, axis, major, minor, smoothed: ring }
}

/** Angle helper exported for the harmonizer (ellipse orientation). */
export const axisAngle = (axis: Vec2): number => Math.atan2(axis.y, axis.x)
