// vector-core fillet — TEST FIXTURE ONLY (KAI-9071, invariant 2: one fillet engine).
// The old hand-rolled corner fillet; production rounds via the Paper kernel. No production
// caller — moved out of the production path.ts into this test fixture in the v5.5.1 de-slop.

import type { Vec2, VAnchor, VPath, VShape } from '../types'

const norm = (v: Vec2): Vec2 => {
  const l = Math.hypot(v.x, v.y) || 1e-12
  return { x: v.x / l, y: v.y / l }
}

/**
 * Corner fillet (exact arcs-as-cubics) on CORNER anchors whose BOTH adjacent segments are
 * straight lines (square/polygon corners). radius ≤ each leg's half-length (clamped); 90° = kappa.
 * (L6) TEST FIXTURE only — no production caller. Production corner-round is the Paper kernel.
 */
export function filletPath(path: VPath, radius: number): VPath {
  if (radius <= 0) return path
  const n = path.anchors.length
  const out: VAnchor[] = []
  for (let i = 0; i < n; i++) {
    const A = path.anchors[(i - 1 + n) % n]
    const B = path.anchors[i]
    const C = path.anchors[(i + 1) % n]
    const inLine = !A.hOut && !B.hIn
    const outLine = !B.hOut && !C.hIn
    if (!B.corner || !inLine || !outLine) {
      out.push(B)
      continue
    }
    const u = norm({ x: B.p.x - A.p.x, y: B.p.y - A.p.y }) // incoming direction
    const w = norm({ x: C.p.x - B.p.x, y: C.p.y - B.p.y }) // outgoing direction
    const dot = Math.max(-1, Math.min(1, -u.x * w.x - u.y * w.y))
    const theta = Math.acos(dot) // interior angle at B
    if (theta < 1e-3 || Math.PI - theta < 1e-3) { out.push(B); continue } // degenerate / straight
    const legIn = Math.hypot(B.p.x - A.p.x, B.p.y - A.p.y) / 2
    const legOut = Math.hypot(C.p.x - B.p.x, C.p.y - B.p.y) / 2
    const dMax = Math.min(legIn, legOut)
    let d = radius / Math.tan(theta / 2)
    let r = radius
    if (d > dMax) { d = dMax; r = d * Math.tan(theta / 2) } // clamp radius to fit the legs
    const alpha = Math.PI - theta // swept arc angle
    const k = (4 / 3) * Math.tan(alpha / 4) * r
    const P1: Vec2 = { x: B.p.x - u.x * d, y: B.p.y - u.y * d }
    const P2: Vec2 = { x: B.p.x + w.x * d, y: B.p.y + w.y * d }
    out.push({ p: P1, hIn: null, hOut: { x: P1.x + u.x * k, y: P1.y + u.y * k }, corner: false })
    out.push({ p: P2, hIn: { x: P2.x - w.x * k, y: P2.y - w.y * k }, hOut: null, corner: false })
  }
  return { anchors: out }
}

export function filletShape(shape: VShape, radius: number): VShape {
  return { paths: shape.paths.map((p) => filletPath(p, radius)) }
}
