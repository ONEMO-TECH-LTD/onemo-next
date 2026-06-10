// vector-core/ops — points-on-demand editing ops (vector reset Run 6).
//
// Doctrine (Dan, locked): anchors hidden by default; "add point" inserts centered between two
// anchors, ON the curve, shape-preserving (Figma behavior); double-tap = a point exactly there;
// delete RE-FITS the two adjacent segments into a minimal bridge. Insert is EXACT — a de Casteljau
// split changes the representation, never the geometry. Blueprint: v3/blueprint/modules/vector-core.md.

import type { Vec2, VAnchor, VPath } from './types'
import { segments, segmentAt, cubicPoint, splitCubic, type VSegment } from './path'
import { fitCubicsOpen } from './fit'

export interface PathHit {
  /** segment index (anchors[seg] → anchors[seg+1]) */
  seg: number
  /** parameter on that segment */
  t: number
  point: Vec2
  dist: number
}

/** Nearest point on the path to p — exact projection on lines, coarse scan + ternary refine on cubics. */
export function nearestOnPath(path: VPath, p: Vec2): PathHit {
  const segs = segments(path)
  let best: PathHit = { seg: 0, t: 0, point: segs[0]?.a ?? p, dist: Infinity }
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (!s.c1 || !s.c2) {
      const vx = s.b.x - s.a.x, vy = s.b.y - s.a.y
      const L2 = vx * vx + vy * vy || 1e-12
      const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * vx + (p.y - s.a.y) * vy) / L2))
      const pt = { x: s.a.x + vx * t, y: s.a.y + vy * t }
      const d = Math.hypot(p.x - pt.x, p.y - pt.y)
      if (d < best.dist) best = { seg: i, t, point: pt, dist: d }
      continue
    }
    const at = (t: number) => cubicPoint(s.a, s.c1!, s.c2!, s.b, t)
    const distAt = (t: number) => { const q = at(t); return Math.hypot(p.x - q.x, p.y - q.y) }
    const S = 24
    let t0 = 0, d0 = Infinity
    for (let k = 0; k <= S; k++) {
      const d = distAt(k / S)
      if (d < d0) { d0 = d; t0 = k / S }
    }
    // ternary refine within the winning coarse window (distance is locally unimodal there)
    let lo = Math.max(0, t0 - 1 / S), hi = Math.min(1, t0 + 1 / S)
    for (let it = 0; it < 24; it++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3
      if (distAt(m1) < distAt(m2)) hi = m2
      else lo = m1
    }
    const t = (lo + hi) / 2
    const q = at(t)
    const d = Math.hypot(p.x - q.x, p.y - q.y)
    if (d < best.dist) best = { seg: i, t, point: q, dist: d }
  }
  return best
}

/** Parameter at half ARC LENGTH of a segment (lines: exactly 0.5) — "insert centered" semantics. */
function tAtHalfArc(s: VSegment): number {
  if (!s.c1 || !s.c2) return 0.5
  const S = 64
  const acc: number[] = [0]
  let prev = s.a
  for (let k = 1; k <= S; k++) {
    const q = cubicPoint(s.a, s.c1, s.c2, s.b, k / S)
    acc.push(acc[k - 1] + Math.hypot(q.x - prev.x, q.y - prev.y))
    prev = q
  }
  const half = acc[S] / 2
  for (let k = 1; k <= S; k++) {
    if (acc[k] >= half) return (k - 1 + (half - acc[k - 1]) / (acc[k] - acc[k - 1] || 1e-12)) / S
  }
  return 0.5
}

/**
 * Insert an anchor ON segment `seg` at parameter t — geometry-preserving by construction:
 * cubics split exactly (de Casteljau), lines gain a collinear corner anchor on the chord.
 * The new anchor sits at index seg+1.
 */
export function insertAnchorAt(path: VPath, seg: number, t: number): VPath {
  const n = path.anchors.length
  const s = segmentAt(path, seg)
  const out = path.anchors.map((a) => ({ ...a }))
  if (!s.c1 || !s.c2) {
    const at = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t }
    out.splice(seg + 1, 0, { p: at, hIn: null, hOut: null, corner: true })
    return { anchors: out }
  }
  const sp = splitCubic(s.a, s.c1, s.c2, s.b, t)
  out[seg % n] = { ...out[seg % n], hOut: sp.first[1] }
  out[(seg + 1) % n] = { ...out[(seg + 1) % n], hIn: sp.second[2] }
  out.splice(seg + 1, 0, { p: sp.first[3], hIn: sp.first[2], hOut: sp.second[1], corner: false })
  return { anchors: out }
}

/** Insert centered between two anchors — at the segment's half-arc-length point, ON the curve. */
export function insertAnchorCentered(path: VPath, seg: number): VPath {
  return insertAnchorAt(path, seg, tAtHalfArc(segmentAt(path, seg)))
}

/**
 * Delete an anchor and RE-FIT the two adjacent segments into a minimal bridge (one least-squares
 * Schneider fit through both segments' true geometry, end tangents preserved so smooth joins stay
 * smooth). Two straight sides need no fit — the bridge is the chord. Keeps the ring valid (≥3).
 */
export function deleteAnchorRefit(path: VPath, idx: number, maxError?: number): VPath {
  const n = path.anchors.length
  if (n <= 3) return path
  const prev = (idx - 1 + n) % n
  const next = (idx + 1) % n
  const sIn = segmentAt(path, prev) // prev → idx
  const sOut = segmentAt(path, idx) // idx → next
  const drop = () => ({ anchors: path.anchors.filter((_, i) => i !== idx).map((a) => ({ ...a })) })
  if ((!sIn.c1 || !sIn.c2) && (!sOut.c1 || !sOut.c2)) return drop()
  // sample both segments into ONE open polyline (joint point not duplicated)
  const pts: Vec2[] = [{ ...sIn.a }]
  const K = 32
  for (const s of [sIn, sOut]) {
    if (s.c1 && s.c2) for (let k = 1; k <= K; k++) pts.push(cubicPoint(s.a, s.c1, s.c2, s.b, k / K))
    else pts.push({ ...s.b })
  }
  const dir = (from: Vec2, to: Vec2): Vec2 => {
    const l = Math.hypot(to.x - from.x, to.y - from.y) || 1e-12
    return { x: (to.x - from.x) / l, y: (to.y - from.y) / l }
  }
  // end tangents: keep the surviving neighbors' existing directions
  const tHat1 = sIn.c1 && Math.hypot(sIn.c1.x - sIn.a.x, sIn.c1.y - sIn.a.y) > 1e-9 ? dir(sIn.a, sIn.c1) : dir(sIn.a, sIn.b)
  const tHat2 = sOut.c2 && Math.hypot(sOut.c2.x - sOut.b.x, sOut.c2.y - sOut.b.y) > 1e-9 ? dir(sOut.b, sOut.c2) : dir(sOut.b, sOut.a)
  const chord = Math.hypot(sOut.b.x - sIn.a.x, sOut.b.y - sIn.a.y) || 1
  const fitted = fitCubicsOpen(pts, tHat1, tHat2, maxError ?? chord / 100)
  if (!fitted.length) return drop()
  const out: VAnchor[] = []
  for (let i = 0; i < n; i++) {
    if (i === idx) {
      // fit joints (if the bridge needed more than one cubic) become smooth anchors in place
      for (let k = 0; k + 1 < fitted.length; k++) out.push({ p: fitted[k].p1, hIn: fitted[k].c2, hOut: fitted[k + 1].c1, corner: false })
      continue
    }
    const a: VAnchor = { ...path.anchors[i] }
    if (i === prev) a.hOut = fitted[0].c1
    if (i === next) a.hIn = fitted[fitted.length - 1].c2
    out.push(a)
  }
  return { anchors: out }
}
