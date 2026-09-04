// foundation/path.ts — AN OUTLINE IS A PATH, NOT A POINT LIST.
//
// Dan, 2026-09-04: "we must use not polygons on curves it must be pure vector curve not polygon that
// chops in micro angles and straight lines" / "Fix it no polygons on canon and anywhere".
//
// Every curve in this geometry is the same thing: the rim offset of a polygon. Its exact form is
// straight segments parallel to the source edges, joined by CIRCULAR ARCS of exactly the rim radius
// centred on the source vertices. Nothing else — no beziers, no sampling, no tolerance. So the true
// outline needs exactly two segment kinds, and every measurement against it is closed form.
//
// What that removes, all of it compensation for chopping a curve into chords: the 25 micron shortfall
// that refused magnets touching a real edge, a blanket rim allowance, an outward micron rounding in
// the library's emitter, a turn-angle guess at whether an edge "was" a curve, and 63 catalogue
// records pinned as knowingly refused.
//
// Flattening still exists — Clipper is integer polygons by design, and a screen draws pixels — but it
// is a VIEW produced on demand from the path, never the source, and nothing measures against it.

import type { Pt } from '../types'

/** A step along the path, from the previous point to `to`.
 *
 *  An arc names the centre it turns about and which way; its radius is the distance from that
 *  centre, and both ends are equidistant from it by construction. This is what an offset produces.
 *
 *  A cubic carries its two control points — the authored curve of a preset or a cutout, exactly as
 *  vector-core holds it (a line is a cubic with no handles, and stays a line here). Distance to a
 *  cubic is the minimum of a quintic, found by bracketing and Newton to machine precision: no chord
 *  ever stands in for it. */
export type PathSeg =
  | { kind: 'line'; to: Pt }
  | { kind: 'arc'; to: Pt; centre: Pt; ccw: boolean }
  | { kind: 'cubic'; to: Pt; c1: Pt; c2: Pt }

/** A closed outline: where it starts, and the steps back round to that start. */
export interface OutlinePath {
  start: Pt
  segs: readonly PathSeg[]
}

const TAU = Math.PI * 2
const angleOf = (centre: Pt, p: Pt) => Math.atan2(p[1] - centre[1], p[0] - centre[0])
const radiusOf = (centre: Pt, p: Pt) => Math.hypot(p[0] - centre[0], p[1] - centre[1])

/** The sweep an arc turns through, always taken the way the arc actually goes. */
function sweepOf(centre: Pt, from: Pt, to: Pt, ccw: boolean): number {
  const a = angleOf(centre, from), b = angleOf(centre, to)
  const raw = ccw ? b - a : a - b
  const s = ((raw % TAU) + TAU) % TAU
  return s
}

/** Does this angle fall inside the arc's own sweep? Membership decides whether the nearest point on
 *  the circle is on the arc or whether an endpoint is nearest instead. */
function withinSweep(centre: Pt, from: Pt, to: Pt, ccw: boolean, angle: number): boolean {
  const a = angleOf(centre, from)
  const total = sweepOf(centre, from, to, ccw)
  const rel = ccw
    ? ((angle - a) % TAU + TAU) % TAU
    : ((a - angle) % TAU + TAU) % TAU
  return rel <= total
}

/** Walk the path as (from, seg) pairs, closing back to the start. */
export function eachSeg(path: OutlinePath, visit: (from: Pt, seg: PathSeg) => void): void {
  let from = path.start
  for (const seg of path.segs) { visit(from, seg); from = seg.to }
}

const distToSegment = (p: Pt, a: Pt, b: Pt): number => {
  const vx = b[0] - a[0], vy = b[1] - a[1]
  const len2 = vx * vx + vy * vy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2))
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy))
}

/** Distance to an arc: to the circle where the foot of the perpendicular lies on the arc, and to the
 *  nearer end otherwise. This is the whole reason the path exists — on a chopped curve this same
 *  question was answered by a chord sitting microns inside the real edge. */
function distToArc(p: Pt, from: Pt, seg: Extract<PathSeg, { kind: 'arc' }>): number {
  const { centre, to, ccw } = seg
  const r = radiusOf(centre, from)
  const d = Math.hypot(p[0] - centre[0], p[1] - centre[1])
  if (d > 0 && withinSweep(centre, from, to, ccw, angleOf(centre, p))) return Math.abs(d - r)
  return Math.min(Math.hypot(p[0] - from[0], p[1] - from[1]), Math.hypot(p[0] - to[0], p[1] - to[1]))
}

// ── cubic Béziers, exactly ─────────────────────────────────────────────────────────────────────────

type Cubic = { a: Pt; c1: Pt; c2: Pt; b: Pt }
const cubicOf = (from: Pt, seg: Extract<PathSeg, { kind: 'cubic' }>): Cubic => ({ a: from, c1: seg.c1, c2: seg.c2, b: seg.to })

/** B(t), one axis. */
const bez = (a: number, c1: number, c2: number, b: number, t: number): number => {
  const u = 1 - t
  return u * u * u * a + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * b
}
/** B'(t), one axis. */
const bezD = (a: number, c1: number, c2: number, b: number, t: number): number => {
  const u = 1 - t
  return 3 * u * u * (c1 - a) + 6 * u * t * (c2 - c1) + 3 * t * t * (b - c2)
}
/** B''(t), one axis. */
const bezDD = (a: number, c1: number, c2: number, b: number, t: number): number =>
  6 * (1 - t) * (c2 - 2 * c1 + a) + 6 * t * (b - 2 * c2 + c1)

const cubicAt = (c: Cubic, t: number): Pt =>
  [bez(c.a[0], c.c1[0], c.c2[0], c.b[0], t), bez(c.a[1], c.c1[1], c.c2[1], c.b[1], t)]

/** Nearest distance from p to the cubic. d(t)² is a sextic whose derivative is a quintic; it is
 *  bracketed on a fixed grid of the parameter and polished with Newton in each bracket, then the
 *  endpoints are checked too. Converges to machine precision — there is no chord in this answer. */
function distToCubic(p: Pt, c: Cubic): number {
  const f = (t: number) => {                      // d/dt of |B(t) - p|² / 2
    const x = bez(c.a[0], c.c1[0], c.c2[0], c.b[0], t) - p[0]
    const y = bez(c.a[1], c.c1[1], c.c2[1], c.b[1], t) - p[1]
    return x * bezD(c.a[0], c.c1[0], c.c2[0], c.b[0], t) + y * bezD(c.a[1], c.c1[1], c.c2[1], c.b[1], t)
  }
  const fD = (t: number) => {
    const x = bez(c.a[0], c.c1[0], c.c2[0], c.b[0], t) - p[0]
    const y = bez(c.a[1], c.c1[1], c.c2[1], c.b[1], t) - p[1]
    const dx = bezD(c.a[0], c.c1[0], c.c2[0], c.b[0], t), dy = bezD(c.a[1], c.c1[1], c.c2[1], c.b[1], t)
    return dx * dx + dy * dy + x * bezDD(c.a[0], c.c1[0], c.c2[0], c.b[0], t) + y * bezDD(c.a[1], c.c1[1], c.c2[1], c.b[1], t)
  }
  const dist = (t: number) => { const q = cubicAt(c, t); return Math.hypot(q[0] - p[0], q[1] - p[1]) }
  let best = Math.min(dist(0), dist(1))
  const N = 16
  let prevT = 0, prevF = f(0)
  for (let i = 1; i <= N; i++) {
    const t = i / N, ft = f(t)
    if ((prevF <= 0 && ft >= 0) || (prevF >= 0 && ft <= 0)) {
      // a stationary point of the distance lies in [prevT, t]: Newton from the midpoint, bisect-guarded
      let lo = prevT, hi = t, x = (lo + hi) / 2
      for (let k = 0; k < 40; k++) {
        const fx = f(x), dfx = fD(x)
        let nx = dfx !== 0 ? x - fx / dfx : (lo + hi) / 2
        if (!(nx > lo && nx < hi)) nx = (lo + hi) / 2
        if ((f(lo) <= 0) === (fx <= 0)) lo = x; else hi = x
        if (Math.abs(nx - x) < 1e-13) { x = nx; break }
        x = nx
      }
      best = Math.min(best, dist(x))
    }
    prevT = t; prevF = ft
  }
  return best
}

/** All t in [0,1] where B_y(t) = y, by subdivision on the cubic's y-polynomial then bisection —
 *  robust where a closed-form cubic solver loses digits. */
function cubicRootsY(c: Cubic, y: number): number[] {
  const g = (t: number) => bez(c.a[1], c.c1[1], c.c2[1], c.b[1], t) - y
  const roots: number[] = []
  const N = 24
  for (let i = 0; i < N; i++) {
    let lo = i / N, hi = (i + 1) / N
    let glo = g(lo), ghi = g(hi)
    if (glo === 0) { roots.push(lo); continue }
    if ((glo < 0) === (ghi < 0)) continue
    for (let k = 0; k < 60; k++) {
      const m = (lo + hi) / 2, gm = g(m)
      if ((gm < 0) === (glo < 0)) { lo = m; glo = gm } else { hi = m; ghi = gm }
    }
    roots.push((lo + hi) / 2)
  }
  if (g(1) === 0) roots.push(1)
  return roots
}

/** Parameter values where one axis of the cubic is stationary — where its bounds can lie. */
function cubicExtremaT(a: number, c1: number, c2: number, b: number): number[] {
  // B'(t) = 3[(c1-a)(1-t)² + 2(c2-c1)(1-t)t + (b-c2)t²]  → quadratic in t
  const A = (b - c2) - 2 * (c2 - c1) + (c1 - a)
  const B = 2 * ((c2 - c1) - (c1 - a))
  const C = c1 - a
  const out: number[] = []
  if (Math.abs(A) < 1e-12) { if (Math.abs(B) > 1e-12) out.push(-C / B) }
  else {
    const disc = B * B - 4 * A * C
    if (disc >= 0) { const s = Math.sqrt(disc); out.push((-B + s) / (2 * A), (-B - s) / (2 * A)) }
  }
  return out.filter((t) => t > 0 && t < 1)
}

/** EXACT distance from a point to the outline. No tolerance, no sampling. */
export function distanceToPathMM(path: OutlinePath, p: Pt): number {
  let best = Infinity
  eachSeg(path, (from, seg) => {
    const d = seg.kind === 'line' ? distToSegment(p, from, seg.to)
      : seg.kind === 'arc' ? distToArc(p, from, seg)
      : distToCubic(p, cubicOf(from, seg))
    if (d < best) best = d
  })
  return best
}

/** Inside test by ray casting, with arcs crossed analytically rather than through their chords: the
 *  horizontal ray at p[1] meets a circle at two known points, each counted only if it lies on the
 *  arc's own sweep and to the right of p.
 *
 *  The half-open rule that stops a crossing on a segment JOIN being counted twice is the line case's,
 *  carried over exactly. A line whose start sits on the ray counts only if it leaves upward, and one
 *  whose end sits on the ray counts only if it arrived from above. An arc's direction at the hit says
 *  the same thing: dy/dθ is r·cos θ, signed by which way it turns. Tangent, where that is zero, is a
 *  touch and not a crossing. Without this a magnet centre in a pill read as OUTSIDE its own shape,
 *  because the cap's arc ended on the ray at the very point the straight side left it. */
export function pointInPath(path: OutlinePath, p: Pt): boolean {
  const NEAR = 1e-9
  let crossings = 0
  eachSeg(path, (from, seg) => {
    if (seg.kind === 'line') {
      const [ax, ay] = from, [bx, by] = seg.to
      if ((ay > p[1]) !== (by > p[1])) {
        const x = ax + ((p[1] - ay) / (by - ay)) * (bx - ax)
        if (x > p[0]) crossings++
      }
      return
    }
    if (seg.kind === 'cubic') {
      // the ray meets the curve where B_y(t) = p[1]; each root is a crossing if it is to the right,
      // with the same half-open rule via the curve's direction there
      const c = cubicOf(from, seg)
      for (const t of cubicRootsY(c, p[1])) {
        const x = bez(c.a[0], c.c1[0], c.c2[0], c.b[0], t)
        if (x <= p[0]) continue
        const rise = bezD(c.a[1], c.c1[1], c.c2[1], c.b[1], t)
        if (Math.abs(rise) < NEAR) continue
        if (t < NEAR) { if (rise > 0) crossings++; continue }
        if (t > 1 - NEAR) { if (rise < 0) crossings++; continue }
        crossings++
      }
      return
    }
    const { centre, to, ccw } = seg
    const r = radiusOf(centre, from)
    const dy = p[1] - centre[1]
    if (Math.abs(dy) > r) return
    const dx = Math.sqrt(Math.max(0, r * r - dy * dy))
    const total = sweepOf(centre, from, to, ccw)
    const a0 = angleOf(centre, from)
    for (const x of [centre[0] + dx, centre[0] - dx]) {
      if (x <= p[0]) continue
      const theta = Math.atan2(p[1] - centre[1], x - centre[0])
      const rel = ccw ? ((theta - a0) % TAU + TAU) % TAU : ((a0 - theta) % TAU + TAU) % TAU
      if (rel > total + NEAR) continue
      const rise = (ccw ? 1 : -1) * Math.cos(theta)
      if (Math.abs(rise) < NEAR) continue               // tangent: touches, never crosses
      if (rel < NEAR) { if (rise > 0) crossings++; continue }            // the arc leaves here
      if (rel > total - NEAR) { if (rise < 0) crossings++; continue }    // the arc arrives here
      crossings++
    }
  })
  return crossings % 2 === 1
}

/** The outline's true extent. An arc reaches its axis extreme wherever that direction falls inside
 *  its sweep, which a point list can only approach. */
export function pathBoundsMM(path: OutlinePath): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const take = (x: number, y: number) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  take(path.start[0], path.start[1])
  eachSeg(path, (from, seg) => {
    take(seg.to[0], seg.to[1])
    if (seg.kind === 'cubic') {
      const c = cubicOf(from, seg)
      for (const t of [...cubicExtremaT(c.a[0], c.c1[0], c.c2[0], c.b[0]), ...cubicExtremaT(c.a[1], c.c1[1], c.c2[1], c.b[1])]) {
        const q = cubicAt(c, t); take(q[0], q[1])
      }
      return
    }
    if (seg.kind !== 'arc') return
    const r = radiusOf(seg.centre, from)
    const axes: Array<[number, Pt]> = [
      [0, [seg.centre[0] + r, seg.centre[1]]], [Math.PI / 2, [seg.centre[0], seg.centre[1] + r]],
      [Math.PI, [seg.centre[0] - r, seg.centre[1]]], [-Math.PI / 2, [seg.centre[0], seg.centre[1] - r]],
    ]
    for (const [angle, at] of axes)
      if (withinSweep(seg.centre, from, seg.to, seg.ccw, angle)) take(at[0], at[1])
  })
  return { minX, minY, maxX, maxY }
}

/** THE EXACT OFFSET OF A CONVEX RING by `radiusMM`, as a path. Each edge moves out along its own
 *  normal; each vertex becomes an arc of exactly `radiusMM` about that vertex, joining the two
 *  displaced edges. That IS the offset — it is not an approximation of one.
 *
 *  Convex only, and deliberately: a reflex vertex makes the raw offset self-intersect and the
 *  trimming that resolves it is a different problem. Every canon outline is the convex hull of its
 *  magnets, so canon needs none of it.
 *
 *  Degenerate rings are the same construction: one point gives a full circle, two give a stadium. */
export function offsetConvexRingPath(ring: readonly Pt[], radiusMM: number): OutlinePath {
  if (!ring.length) throw new Error('path: empty ring has no offset')
  if (!(radiusMM > 0)) throw new Error('path: offset radius must be positive')
  if (ring.length === 1) {
    const [c] = ring
    const right: Pt = [c[0] + radiusMM, c[1]], left: Pt = [c[0] - radiusMM, c[1]]
    return { start: right, segs: [
      { kind: 'arc', to: left, centre: c, ccw: true },
      { kind: 'arc', to: right, centre: c, ccw: true },
    ] }
  }
  // the ring is counter-clockwise, so the outward normal of a->b is (dy, -dx) normalised
  const ccwRing = signedArea(ring) >= 0 ? ring : [...ring].reverse()
  const n = ccwRing.length
  const outward = (a: Pt, b: Pt): Pt => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len === 0) throw new Error('path: ring has a repeated point')
    return [dy / len * radiusMM, -dx / len * radiusMM]
  }
  const segs: PathSeg[] = []
  const same = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9
  let start: Pt | null = null
  let cur: Pt | null = null
  for (let i = 0; i < n; i++) {
    const a = ccwRing[i], b = ccwRing[(i + 1) % n]
    const [ox, oy] = outward(a, b)
    const from: Pt = [a[0] + ox, a[1] + oy], to: Pt = [b[0] + ox, b[1] + oy]
    if (start === null) start = from
    // A vertex the ring does not actually turn at needs no arc: the two displaced edges already
    // meet. Emitting a zero-length one is not merely redundant — it reads as a crossing to the ray
    // cast, and put a pill's middle magnet outside its own shape.
    else if (!same(cur as Pt, from)) segs.push({ kind: 'arc', to: from, centre: a, ccw: true })
    segs.push({ kind: 'line', to })
    cur = to
  }
  // close: the arc about the first vertex, back to where the walk began
  if (!same(cur as Pt, start as Pt)) segs.push({ kind: 'arc', to: start as Pt, centre: ccwRing[0], ccw: true })
  return { start: start as Pt, segs }
}

function signedArea(ring: readonly Pt[]): number {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

/** A POINT VIEW of the path, for the two things that genuinely cannot hold a curve: Clipper's integer
 *  booleans, and drawing. Never for measurement — that is what `distanceToPathMM` is for, and taking
 *  this as truth is the defect the path exists to end. Vertices lie ON the curve, no chord stands
 *  further than `tolMM` from it, and every arc's axis extremes are vertices, so the view's bounding
 *  box is the path's exactly. */
export function flattenPath(path: OutlinePath, tolMM: number): Pt[] {
  const out: Pt[] = [path.start]
  const flattenCubic = (c: Cubic, depth: number): void => {
    // control-net distance from the chord bounds curve-to-chord distance — the standard flatness test
    const dx = c.b[0] - c.a[0], dy = c.b[1] - c.a[1], len = Math.hypot(dx, dy) || 1e-12
    const off = (q: Pt) => Math.abs((q[0] - c.a[0]) * dy - (q[1] - c.a[1]) * dx) / len
    if (depth >= 18 || Math.max(off(c.c1), off(c.c2)) <= tolMM) { out.push(c.b); return }
    const m = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
    const ab = m(c.a, c.c1), bc = m(c.c1, c.c2), cd = m(c.c2, c.b), abbc = m(ab, bc), bccd = m(bc, cd), mid = m(abbc, bccd)
    flattenCubic({ a: c.a, c1: ab, c2: abbc, b: mid }, depth + 1)
    flattenCubic({ a: mid, c1: bccd, c2: cd, b: c.b }, depth + 1)
  }
  eachSeg(path, (from, seg) => {
    if (seg.kind === 'line') { out.push(seg.to); return }
    if (seg.kind === 'cubic') { flattenCubic(cubicOf(from, seg), 0); return }
    const r = radiusOf(seg.centre, from)
    const sweep = sweepOf(seg.centre, from, seg.to, seg.ccw)
    const a0 = angleOf(seg.centre, from)
    const dir = seg.ccw ? 1 : -1
    // Vertices ON the curve, at a spacing that keeps every chord within tolMM of it — and always at
    // the arc's axis extremes, so the view's bounding box is the path's exactly. A view that bulged
    // 25 microns past the true cap laid the engine's lattice 25 microns off and lost a whole row.
    const widest = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tolMM / r)))
    const steps = Math.max(1, Math.ceil(sweep / Math.max(widest, 1e-9)))
    // the axis directions that fall inside this sweep, as offsets along it
    const axes: number[] = []
    for (let k = -4; k <= 4; k++) {
      const wrapped = ((dir * ((k * Math.PI) / 2 - a0)) % TAU + TAU) % TAU
      if (wrapped > 1e-9 && wrapped < sweep - 1e-9) axes.push(wrapped)
    }
    const emit = (rel: number) => {
      const t = a0 + dir * rel
      out.push([seg.centre[0] + r * Math.cos(t), seg.centre[1] + r * Math.sin(t)])
    }
    // walk the regular subdivision in order, dropping each axis extreme into the gap it falls in
    for (let i = 1; i <= steps; i++) {
      const lo = ((i - 1) * sweep) / steps, hi = (i * sweep) / steps
      for (const a of axes) if (a > lo + 1e-9 && a < hi - 1e-9) emit(a)
      if (i < steps) emit(hi)
    }
    out.push(seg.to)
  })
  if (out.length > 1) {
    const [fx, fy] = out[0], [lx, ly] = out[out.length - 1]
    if (Math.hypot(fx - lx, fy - ly) < 1e-9) out.pop()
  }
  return out
}

/** THE DOOR FROM VECTOR TRUTH: a vector-core path becomes the engine's path with nothing lost. Lines
 *  stay lines, cubics stay cubics, and `map` is the caller's px→mm affine (scale and y-flip), which is
 *  exact on a Bézier when applied to its control points — the same fact transformShape relies on.
 *  This replaces flattening at the door (geometry-truth's contourFromShape), which was the one place
 *  the whole path-native product line was ever turned into chords. */
export function pathFromAnchors(
  anchors: ReadonlyArray<{ p: { x: number; y: number }; hIn?: { x: number; y: number } | null; hOut?: { x: number; y: number } | null }>,
  map: (v: { x: number; y: number }) => Pt,
): OutlinePath {
  if (anchors.length < 2) throw new Error('path: a closed path needs at least two anchors')
  const n = anchors.length
  const segs: PathSeg[] = []
  for (let i = 0; i < n; i++) {
    const A = anchors[i], B = anchors[(i + 1) % n]
    const to = map(B.p)
    if (!A.hOut && !B.hIn) { segs.push({ kind: 'line', to }); continue }
    // SVG semantics: a missing handle collapses onto its endpoint — exactly as vector-core's segmentAt
    segs.push({ kind: 'cubic', to, c1: map(A.hOut ?? A.p), c2: map(B.hIn ?? B.p) })
  }
  return { start: map(anchors[0].p), segs }
}

/** A uniform scale about the origin — exact on every segment kind: a line's ends scale, an arc's
 *  centre and ends scale (so its radius does), a cubic's control points scale. This is how a path
 *  survives normalisation and sizing, where a point list used to be all that came through. */
export function scalePath(path: OutlinePath, k: number): OutlinePath {
  const s = (p: Pt): Pt => [p[0] * k, p[1] * k]
  return {
    start: s(path.start),
    segs: path.segs.map((seg) => seg.kind === 'line' ? { kind: 'line', to: s(seg.to) }
      : seg.kind === 'arc' ? { kind: 'arc', to: s(seg.to), centre: s(seg.centre), ccw: seg.ccw }
      : { kind: 'cubic', to: s(seg.to), c1: s(seg.c1), c2: s(seg.c2) }),
  }
}
