// draw/recognizer — $-family point-cloud matcher (clean-room $P/$Q class: Vatavu, Anthony &
// Wobbrock's published method — uniform resample, centroid+scale normalize, weighted greedy
// cloud distance over rotated start indices, best of both directions). Deterministic, offline,
// sub-ms against our ~20-shape library; can never hallucinate a shape we don't have.
// Orientation-sensitive BY DESIGN (blueprint modules/draw.md — rotated variants addable later).

import type { Vec2 } from '@/lib/vector-core'

export const CLOUD_N = 32

export interface StrokeTemplate {
  kind: string
  /** normalized cloud (CLOUD_N points, centroid at origin, longest bbox side = 1) */
  points: Vec2[]
}

export interface DrawMatch {
  kind: string
  /** normalized cloud distance — 0 is a perfect match */
  score: number
}

/** Uniform arc-length resample of an open or closed point sequence to n points. */
export function resampleStroke(points: Vec2[], n = CLOUD_N): Vec2[] {
  if (points.length < 2) return points.slice()
  let total = 0
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  const step = total / (n - 1)
  if (!(step > 0)) return Array.from({ length: n }, () => ({ ...points[0] }))
  const out: Vec2[] = [{ ...points[0] }]
  let acc = 0
  let prev = points[0]
  for (let i = 1; i < points.length && out.length < n; ) {
    const d = Math.hypot(points[i].x - prev.x, points[i].y - prev.y)
    if (acc + d >= step) {
      const t = (step - acc) / (d || 1e-12)
      const q = { x: prev.x + (points[i].x - prev.x) * t, y: prev.y + (points[i].y - prev.y) * t }
      out.push(q)
      prev = q
      acc = 0
    } else {
      acc += d
      prev = points[i]
      i++
    }
  }
  while (out.length < n) out.push({ ...points[points.length - 1] })
  return out
}

/** Normalize a stroke into a comparable cloud: resample → centroid at origin → longest side = 1. */
export function normalizeStroke(points: Vec2[], n = CLOUD_N): Vec2[] {
  const pts = resampleStroke(points, n)
  let cx = 0, cy = 0
  for (const p of pts) { cx += p.x; cy += p.y }
  cx /= pts.length; cy /= pts.length
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const s = Math.max(maxX - minX, maxY - minY) || 1
  return pts.map((p) => ({ x: (p.x - cx) / s, y: (p.y - cy) / s }))
}

function greedyMatch(a: Vec2[], b: Vec2[], start: number): number {
  const n = a.length
  const matched = new Array<boolean>(n).fill(false)
  let sum = 0
  for (let i = 0; i < n; i++) {
    const idx = (i + start) % n
    let best = Infinity, bj = 0
    for (let j = 0; j < n; j++) {
      if (matched[j]) continue
      const dx = a[idx].x - b[j].x, dy = a[idx].y - b[j].y
      const d = dx * dx + dy * dy
      if (d < best) { best = d; bj = j }
    }
    matched[bj] = true
    sum += (1 - i / n) * Math.sqrt(best) // early matches weigh more (the $P weighting)
  }
  return sum
}

/** Cloud distance between two NORMALIZED clouds — min over start alignments, both directions. */
export function cloudDistance(a: Vec2[], b: Vec2[]): number {
  const n = a.length
  const step = Math.max(1, Math.floor(Math.sqrt(n)))
  let best = Infinity
  for (let s = 0; s < n; s += step) {
    best = Math.min(best, greedyMatch(a, b, s), greedyMatch(b, a, s))
  }
  return best / n
}

/**
 * Match a raw stroke against the template set. Returns the best candidate when it clears the
 * acceptance threshold, else null — the ghost preview decides what happens next; the recognizer
 * never commits anything.
 */
export function recognizeStroke(stroke: Vec2[], templates: StrokeTemplate[], threshold = 0.12): DrawMatch | null {
  if (stroke.length < 8 || !templates.length) return null
  // closure gate: we snap closed silhouettes only — an open stroke is not a shape attempt
  // (and clouds can't tell a straight line from a thin lens; geometry can)
  {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of stroke) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const size = Math.max(maxX - minX, maxY - minY) || 1
    const a = stroke[0], b = stroke[stroke.length - 1]
    if (Math.hypot(a.x - b.x, a.y - b.y) > size * 0.3) return null
  }
  const cloud = normalizeStroke(stroke)
  let best: DrawMatch | null = null
  for (const t of templates) {
    const score = cloudDistance(cloud, t.points)
    if (!best || score < best.score) best = { kind: t.kind, score }
  }
  return best && best.score <= threshold ? best : null
}
