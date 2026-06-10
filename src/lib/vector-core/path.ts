// vector-core kernel math — segment semantics, evaluation, adaptive flatten, SVG emit, transform.
// Pure functions over plain data; no DOM, no three.js, no app imports (the swap-test boundary).

import type { Vec2, VAnchor, VPath, VShape } from './types'

/** Segment i of a closed path: line when neither facing handle exists, else cubic. */
export interface VSegment {
  a: Vec2
  b: Vec2
  /** control points — present only for cubic segments */
  c1?: Vec2
  c2?: Vec2
}

export function segmentAt(path: VPath, i: number): VSegment {
  const n = path.anchors.length
  const A = path.anchors[i % n]
  const B = path.anchors[(i + 1) % n]
  const hasCurve = !!A.hOut || !!B.hIn
  if (!hasCurve) return { a: A.p, b: B.p }
  // SVG semantics: a missing handle collapses onto its endpoint.
  return { a: A.p, b: B.p, c1: A.hOut ?? A.p, c2: B.hIn ?? B.p }
}

export function segments(path: VPath): VSegment[] {
  return path.anchors.map((_, i) => segmentAt(path, i))
}

/** Point on a cubic at t (de Casteljau-equivalent closed form). */
export function cubicPoint(a: Vec2, c1: Vec2, c2: Vec2, b: Vec2, t: number): Vec2 {
  const u = 1 - t
  const uu = u * u, tt = t * t
  const w0 = uu * u, w1 = 3 * uu * t, w2 = 3 * u * tt, w3 = tt * t
  return {
    x: w0 * a.x + w1 * c1.x + w2 * c2.x + w3 * b.x,
    y: w0 * a.y + w1 * c1.y + w2 * c2.y + w3 * b.y,
  }
}

/** Max distance of the control points from the chord — the standard flatness bound. */
function flatness(a: Vec2, c1: Vec2, c2: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1e-12
  const dist = (p: Vec2) => Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len
  // control-net distance bounds curve-to-chord distance (within a constant ≤ 1)
  return Math.max(dist(c1), dist(c2))
}

function flattenCubicInto(a: Vec2, c1: Vec2, c2: Vec2, b: Vec2, tol: number, depth: number, out: Vec2[]): void {
  if (depth >= 18 || flatness(a, c1, c2, b) <= tol) {
    out.push(b)
    return
  }
  // de Casteljau split at t = 0.5
  const ab = mid(a, c1), bc = mid(c1, c2), cd = mid(c2, b)
  const abbc = mid(ab, bc), bccd = mid(bc, cd)
  const m = mid(abbc, bccd)
  flattenCubicInto(a, ab, abbc, m, tol, depth + 1, out)
  flattenCubicInto(m, bccd, cd, b, tol, depth + 1, out)
}

const mid = (p: Vec2, q: Vec2): Vec2 => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })

/**
 * Flatten a closed path to a polyline at chord tolerance `tol` (same units as the path).
 * THE only path→points door; consumers (mesh, payload, validators) choose their own tolerance.
 * Lines emit their endpoint only — straights never subdivide.
 */
export function flattenPath(path: VPath, tol: number): Vec2[] {
  const out: Vec2[] = []
  const segs = segments(path)
  if (!segs.length) return out
  out.push({ ...segs[0].a })
  for (const s of segs) {
    if (s.c1 && s.c2) flattenCubicInto(s.a, s.c1, s.c2, s.b, tol, 0, out)
    else out.push({ ...s.b })
  }
  out.pop() // closing point duplicates the start in a closed ring
  return out
}

export function flattenShape(shape: VShape, tol: number): Vec2[][] {
  return shape.paths.map((p) => flattenPath(p, tol))
}

/** True SVG path data — C for curves, L for lines, Z to close. The shape's native serialization. */
export function toSVGPathD(path: VPath, precision = 3): string {
  const segs = segments(path)
  if (!segs.length) return ''
  const f = (v: number) => v.toFixed(precision)
  let d = `M ${f(segs[0].a.x)} ${f(segs[0].a.y)}`
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (s.c1 && s.c2) {
      d += ` C ${f(s.c1.x)} ${f(s.c1.y)} ${f(s.c2.x)} ${f(s.c2.y)} ${f(s.b.x)} ${f(s.b.y)}`
    } else if (i < segs.length - 1) {
      d += ` L ${f(s.b.x)} ${f(s.b.y)}`
    }
    // a final straight segment is implied by Z — no redundant closing L
  }
  return d + ' Z'
}

export function shapeToSVGPathD(shape: VShape, precision = 3): string {
  return shape.paths.map((p) => toSVGPathD(p, precision)).join(' ')
}

/** Map every anchor AND its handles through `fn` — exact for affine transforms of Béziers. */
export function transformPath(path: VPath, fn: (p: Vec2) => Vec2): VPath {
  return {
    anchors: path.anchors.map((a) => ({
      p: fn(a.p),
      hIn: a.hIn ? fn(a.hIn) : a.hIn,
      hOut: a.hOut ? fn(a.hOut) : a.hOut,
      corner: a.corner,
    })),
  }
}

export function transformShape(shape: VShape, fn: (p: Vec2) => Vec2): VShape {
  return { paths: shape.paths.map((p) => transformPath(p, fn)) }
}

/** Tight bbox via flatten at fine tolerance (exact bbox of cubics needs root-finding — not yet needed). */
export function shapeBBox(shape: VShape, tol = 0.1): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const ring of flattenShape(shape, tol)) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Corner fillet (exact arcs-as-cubics) on CORNER anchors whose BOTH adjacent segments are
 * straight lines (square/polygon corners). Curve-curve corners (e.g. heart cusps) are left
 * untouched here — that general fillet is a later op. radius ≤ each leg's half-length (clamped).
 * 90° corner reproduces the kappa constant exactly (k = 4/3·tan(α/4)·r).
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

const norm = (v: Vec2): Vec2 => {
  const l = Math.hypot(v.x, v.y) || 1e-12
  return { x: v.x / l, y: v.y / l }
}

export function signedArea(ring: Vec2[]): number {
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    s += a.x * b.y - b.x * a.y
  }
  return s / 2
}
