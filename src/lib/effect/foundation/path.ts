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

/** A step along the path, from the previous point to `to`. An arc also names the centre it turns
 *  about and which way; its radius is the distance from that centre, and both ends are equidistant
 *  from it by construction. */
export type PathSeg =
  | { kind: 'line'; to: Pt }
  | { kind: 'arc'; to: Pt; centre: Pt; ccw: boolean }

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

/** EXACT distance from a point to the outline. No tolerance, no sampling. */
export function distanceToPathMM(path: OutlinePath, p: Pt): number {
  let best = Infinity
  eachSeg(path, (from, seg) => {
    const d = seg.kind === 'line' ? distToSegment(p, from, seg.to) : distToArc(p, from, seg)
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
 *  this as truth is the defect the path exists to end. Arcs are sampled so no chord stands further
 *  than `tolMM` from the curve, on the OUTSIDE, so a flattened copy never reports a shape smaller
 *  than it is. */
export function flattenPath(path: OutlinePath, tolMM: number): Pt[] {
  const out: Pt[] = [path.start]
  eachSeg(path, (from, seg) => {
    if (seg.kind === 'line') { out.push(seg.to); return }
    const r = radiusOf(seg.centre, from)
    const sweep = sweepOf(seg.centre, from, seg.to, seg.ccw)
    const widest = 2 * Math.acos(Math.max(-1, Math.min(1, 1 / (1 + tolMM / r))))
    const steps = Math.max(1, Math.ceil(sweep / Math.max(widest, 1e-9)))
    const reach = r / Math.cos(sweep / steps / 2)
    const a0 = angleOf(seg.centre, from)
    for (let i = 0; i < steps; i++) {
      const t = a0 + (seg.ccw ? 1 : -1) * (i + 0.5) * (sweep / steps)
      out.push([seg.centre[0] + reach * Math.cos(t), seg.centre[1] + reach * Math.sin(t)])
    }
    out.push(seg.to)
  })
  if (out.length > 1) {
    const [fx, fy] = out[0], [lx, ly] = out[out.length - 1]
    if (Math.hypot(fx - lx, fy - ly) < 1e-9) out.pop()
  }
  return out
}
