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

/** Map every anchor AND its handles through `fn` — exact for affine transforms of Béziers.
 *  Carries the V4 stable `id` (VD9): a move/rotate/stretch keeps each anchor's identity, so its
 *  per-anchor adjustments (radius/curve) survive the transform. */
export function transformPath(path: VPath, fn: (p: Vec2) => Vec2): VPath {
  return {
    anchors: path.anchors.map((a) => ({
      p: fn(a.p),
      hIn: a.hIn ? fn(a.hIn) : a.hIn,
      hOut: a.hOut ? fn(a.hOut) : a.hOut,
      corner: a.corner,
      id: a.id,
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

/** General de Casteljau split of a cubic at t — both halves exact. */
export function splitCubic(a: Vec2, c1: Vec2, c2: Vec2, b: Vec2, t: number): { first: [Vec2, Vec2, Vec2, Vec2]; second: [Vec2, Vec2, Vec2, Vec2] } {
  const lerp = (p: Vec2, q: Vec2): Vec2 => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
  const ab = lerp(a, c1), bc = lerp(c1, c2), cd = lerp(c2, b)
  const abbc = lerp(ab, bc), bccd = lerp(bc, cd)
  const m = lerp(abbc, bccd)
  return { first: [a, ab, abbc, m], second: [m, bccd, cd, b] }
}

/**
 * Corner fillet (exact arcs-as-cubics) on CORNER anchors whose BOTH adjacent segments are
 * straight lines (square/polygon corners). Curve-aware corners ride filletPathSmart below.
 * radius ≤ each leg's half-length (clamped). 90° corner reproduces kappa exactly.
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

/**
 * CURVE-AWARE corner fillet (Run 5 — Radius on every corner class): rounds CORNER anchors whose
 * adjacent segments may be lines OR cubics (heart cusps, Magic-trace corners). Each side is
 * trimmed back from the corner by ~`radius` (along the segment), and the gap is bridged with one
 * cubic shaped as a circular arc between the trim tangents (k = 4/3·tan(α/4)·R_eff — exact for
 * line-line, arc-quality for curves). Falls through to the exact line-line fillet when both
 * sides are straight. `only` filters by anchor index — single-corner Radius (Run 6).
 */
export function filletPathSmart(path: VPath, radius: number, only?: (anchorIndex: number) => boolean): VPath {
  if (radius <= 0) return path
  const n = path.anchors.length
  if (n < 3) return path
  // Work on explicit segments so trims rewrite handles precisely.
  const segs = segments(path)
  type Side = { trimT: number; point: Vec2; tangent: Vec2; seg: VSegment; isLine: boolean }
  /** walk a segment from one end until ~dist from that end; return trim point + outward tangent */
  const trim = (seg: VSegment, fromEnd: 'a' | 'b', dist: number): Side | null => {
    const isLine = !seg.c1 || !seg.c2
    if (isLine) {
      const from = fromEnd === 'b' ? seg.b : seg.a
      const to = fromEnd === 'b' ? seg.a : seg.b
      const L = Math.hypot(to.x - from.x, to.y - from.y)
      const d = Math.min(dist, L / 2)
      const t = d / (L || 1e-12)
      const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
      const tangent = { x: (to.x - from.x) / (L || 1e-12), y: (to.y - from.y) / (L || 1e-12) }
      return { trimT: fromEnd === 'b' ? 1 - t : t, point, tangent, seg, isLine }
    }
    const c1 = seg.c1!, c2 = seg.c2!
    const cornerPt = fromEnd === 'b' ? seg.b : seg.a
    // sample to find the parameter at ~dist from the corner end (capped at half the segment)
    const S = 48
    let best: { t: number; p: Vec2 } | null = null
    for (let i = 1; i <= S / 2; i++) {
      const t = fromEnd === 'b' ? 1 - i / S : i / S
      const p = cubicPoint(seg.a, c1, c2, seg.b, t)
      if (Math.hypot(p.x - cornerPt.x, p.y - cornerPt.y) >= dist) { best = { t, p }; break }
    }
    if (!best) {
      const t = fromEnd === 'b' ? 0.5 : 0.5
      best = { t, p: cubicPoint(seg.a, c1, c2, seg.b, t) }
    }
    // tangent pointing AWAY from the corner
    const eps = 0.001
    const t2 = fromEnd === 'b' ? Math.max(0, best.t - eps) : Math.min(1, best.t + eps)
    const p2 = cubicPoint(seg.a, c1, c2, seg.b, t2)
    const L = Math.hypot(p2.x - best.p.x, p2.y - best.p.y) || 1e-12
    return { trimT: best.t, point: best.p, tangent: { x: (p2.x - best.p.x) / L, y: (p2.y - best.p.y) / L }, seg, isLine }
  }
  const out: VAnchor[] = []
  for (let i = 0; i < n; i++) {
    const B = path.anchors[i]
    if (!B.corner || (only && !only(i))) { out.push({ ...B }); continue }
    const inSeg = segs[(i - 1 + n) % n] // ends at B
    const outSeg = segs[i] // starts at B
    const sIn = trim(inSeg, 'b', radius)
    const sOut = trim(outSeg, 'a', radius)
    if (!sIn || !sOut) { out.push({ ...B }); continue }
    // arc between the trims: angle between arrival direction (-sIn.tangent) and departure (sOut.tangent)
    const arrive = { x: -sIn.tangent.x, y: -sIn.tangent.y }
    const dotv = Math.max(-1, Math.min(1, arrive.x * sOut.tangent.x + arrive.y * sOut.tangent.y))
    const alpha = Math.acos(dotv) // turn at the (rounded) corner
    if (alpha < 1e-3) { out.push({ ...B }); continue }
    const chord = Math.hypot(sOut.point.x - sIn.point.x, sOut.point.y - sIn.point.y)
    const Reff = chord / (2 * Math.sin(Math.min(Math.PI - 1e-3, alpha) / 2) || 1e-12)
    const k = (4 / 3) * Math.tan(alpha / 4) * Reff
    // rewrite the INCOMING segment's tail: previous anchor keeps its handle; trim point becomes P1
    const prevOut = out.length ? out[out.length - 1] : null
    if (!sIn.isLine) {
      const sp = splitCubic(sIn.seg.a, sIn.seg.c1!, sIn.seg.c2!, sIn.seg.b, sIn.trimT)
      if (prevOut) prevOut.hOut = sp.first[1]
      out.push({ p: sp.first[3], hIn: sp.first[2], hOut: { x: sIn.point.x + arrive.x * k, y: sIn.point.y + arrive.y * k }, corner: false })
    } else {
      out.push({ p: sIn.point, hIn: null, hOut: { x: sIn.point.x + arrive.x * k, y: sIn.point.y + arrive.y * k }, corner: false })
    }
    // P2 with the OUTGOING segment's head rewritten
    if (!sOut.isLine) {
      const sp = splitCubic(sOut.seg.a, sOut.seg.c1!, sOut.seg.c2!, sOut.seg.b, sOut.trimT)
      out.push({ p: sp.second[0], hIn: { x: sOut.point.x - sOut.tangent.x * k, y: sOut.point.y - sOut.tangent.y * k }, hOut: sp.second[1], corner: false })
      // the NEXT anchor's hIn must become the split's c2 — patch when we reach it
      pendingHInPatch.set((i + 1) % n, sp.second[2])
    } else {
      out.push({ p: sOut.point, hIn: { x: sOut.point.x - sOut.tangent.x * k, y: sOut.point.y - sOut.tangent.y * k }, hOut: null, corner: false })
    }
  }
  // apply hIn patches for anchors following a trimmed outgoing cubic
  for (const [idx, hIn] of pendingHInPatch) {
    // find the emitted anchor whose position matches the original anchor idx
    const orig = path.anchors[idx]
    const hit = out.find((a) => Math.hypot(a.p.x - orig.p.x, a.p.y - orig.p.y) < 1e-9)
    if (hit && !hit.corner) hit.hIn = hIn
    else if (hit) hit.hIn = hIn
  }
  pendingHInPatch.clear()
  return { anchors: out }
}
const pendingHInPatch = new Map<number, Vec2>()

export function filletShapeSmart(shape: VShape, radius: number): VShape {
  return { paths: shape.paths.map((p) => filletPathSmart(p, radius)) }
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
