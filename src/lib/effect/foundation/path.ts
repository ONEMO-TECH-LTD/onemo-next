// foundation/path.ts — AN OUTLINE IS A PATH, NOT A POINT LIST.
//
// Dan, 2026-09-04: "we must use not polygons on curves it must be pure vector curve not polygon that
// chops in micro angles and straight lines" / "Fix it no polygons on canon and anywhere".
//
// Three segment kinds cover every outline this product makes. A LINE. A CIRCULAR ARC — what the rim
// offset of a polygon produces at each vertex, and so every canon outline. A CUBIC BEZIER — what a
// preset or a cutout is authored as in vector-core, carried through unchanged. Lines and arcs are
// measured in closed form; a cubic's nearest point and ray crossings are roots of small polynomials,
// found by certified isolation so none can be missed. No sampling, no tolerance, anywhere.
//
// What that removes, all of it compensation for chopping a curve into chords: the 25 micron shortfall
// that refused magnets touching a real edge, a blanket rim allowance, an outward micron rounding in
// the library's emitter, a turn-angle guess at whether an edge "was" a curve, and 63 catalogue
// records pinned as knowingly refused.
//
// Flattening still exists — Clipper is integer polygons by design, and a screen draws pixels — but it
// is a VIEW produced on demand from the path, never the source, and nothing measures against it.

import type { Pt } from '../types'
import { ringToVPath } from '@/lib/vector-core/fit'

/** A step along the path, from the previous point to `to`.
 *
 *  An arc names the centre it turns about and which way; its radius is the distance from that
 *  centre, and both ends are equidistant from it by construction. This is what an offset produces.
 *
 *  A cubic carries its two control points — the authored curve of a preset or a cutout, exactly as
 *  vector-core holds it (a line is a cubic with no handles, and stays a line here). Distance to a
 *  cubic is the minimum of a quintic whose roots are all found by certified isolation: no chord ever
 *  stands in for it, and no root goes unseen. */
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

const segDist2 = (p: Pt, a: Pt, b: Pt): number => {
  const vx = b[0] - a[0], vy = b[1] - a[1]
  const len2 = vx * vx + vy * vy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2))
  const dx = p[0] - (a[0] + t * vx), dy = p[1] - (a[1] + t * vy)
  return dx * dx + dy * dy
}
const distToSegment = (p: Pt, a: Pt, b: Pt): number => Math.sqrt(segDist2(p, a, b))

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
const cubicAt = (c: Cubic, t: number): Pt =>
  [bez(c.a[0], c.c1[0], c.c2[0], c.b[0], t), bez(c.a[1], c.c1[1], c.c2[1], c.b[1], t)]

// ── certified root isolation ──────────────────────────────────────────────────────────────────────
//
// A fixed grid of brackets is not exact: two sign changes inside one interval cancel and neither is
// seen. QA proved it with an S-bend whose true nearest point was missed by 0.635mm. The polynomials
// here are held in BERNSTEIN form on the interval under test, where the count of sign changes in
// the coefficients BOUNDS the number of roots (Descartes, variation-diminishing): zero changes means
// zero roots, certainly. An interval with changes is split at its midpoint by de Casteljau, exactly,
// until each root sits alone in an interval too small to hold another and is then bisected out.

/** Power-basis coefficients (index = power) → Bernstein coefficients of the same degree. */
function powerToBernstein(power: readonly number[]): number[] {
  const n = power.length - 1
  const binomial = (k: number, i: number) => { let r = 1; for (let j = 1; j <= i; j++) r = (r * (k - i + j)) / j; return r }
  return Array.from({ length: n + 1 }, (_, i) => {
    let s = 0
    for (let k = 0; k <= i; k++) s += (binomial(i, k) / binomial(n, k)) * power[k]
    return s
  })
}

/** Every root of a polynomial in [0,1], given its Bernstein coefficients, to 1e-12 in t. */
function bernsteinRoots(coeffs: readonly number[]): number[] {
  const roots: number[] = []
  const variations = (c: readonly number[]) => {
    let v = 0, last = 0
    for (const x of c) { if (x === 0) continue; if (last !== 0 && (x < 0) !== (last < 0)) v++; last = x }
    return v
  }
  const split = (c: readonly number[]): [number[], number[]] => {
    const left: number[] = [], right: number[] = []
    let row = [...c]
    left.push(row[0]); right.unshift(row[row.length - 1])
    while (row.length > 1) {
      const next: number[] = []
      for (let i = 0; i < row.length - 1; i++) next.push((row[i] + row[i + 1]) / 2)
      row = next
      left.push(row[0]); right.unshift(row[row.length - 1])
    }
    return [left, right]
  }
  const evalAt = (c: readonly number[], t: number) => {
    let row = [...c]
    while (row.length > 1) {
      const next: number[] = []
      for (let i = 0; i < row.length - 1; i++) next.push(row[i] * (1 - t) + row[i + 1] * t)
      row = next
    }
    return row[0]
  }
  const record = (t: number) => { if (!roots.some((r) => Math.abs(r - t) < 1e-12)) roots.push(t) }
  const isolate = (c: readonly number[], lo: number, hi: number, depth: number): void => {
    // A ZERO END COEFFICIENT IS A ROOT AT THAT END. Descartes counts sign changes among the non-zero
    // coefficients, so a root that lands exactly on a subdivision point vanishes from the count:
    // QA's cusp, 3(t-1/2)^5, split first at exactly 1/2 and both halves read as root-free. The
    // Bernstein end coefficients ARE the polynomial's end values, so they are checked as such.
    if (c[0] === 0) record(lo)
    if (c[c.length - 1] === 0) record(hi)
    const v = variations(c)
    if (v === 0) return
    if (v === 1) {
      // exactly one simple root here: bisect it out on the polynomial's own values
      let a = lo, b = hi, fa = evalAt(coeffs, a)
      if (fa === 0) { record(a); return }
      for (let k = 0; k < 80 && b - a > 1e-13; k++) {
        const m = (a + b) / 2, fm = evalAt(coeffs, m)
        if (fm === 0) { a = b = m; break }
        if ((fm < 0) === (fa < 0)) { a = m; fa = fm } else b = m
      }
      record((a + b) / 2)
      return
    }
    if (depth >= 60 || hi - lo < 1e-12) {
      // still more than one variation in an interval too small to split: a MULTIPLE root, which
      // never separates. There is no sign change to bisect on, so the interval itself is the answer.
      record((lo + hi) / 2)
      return
    }
    const [l, r] = split(c)
    const mid = (lo + hi) / 2
    isolate(l, lo, mid, depth + 1)
    isolate(r, mid, hi, depth + 1)
  }
  isolate(coeffs, 0, 1, 0)
  return roots
}

/** Power-basis coefficients of one axis of a cubic, c0 + c1 t + c2 t² + c3 t³. */
const cubicPower = (a: number, c1: number, c2: number, b: number): [number, number, number, number] =>
  [a, 3 * (c1 - a), 3 * (a - 2 * c1 + c2), -a + 3 * c1 - 3 * c2 + b]

/** Multiply two power-basis polynomials. */
function polyMul(p: readonly number[], q: readonly number[]): number[] {
  const out = new Array<number>(p.length + q.length - 1).fill(0)
  for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) out[i + j] += p[i] * q[j]
  return out
}

/** Nearest distance from p to the cubic. The stationary points of |B(t)-p|² are the roots of a
 *  quintic, (B(t)-p)·B'(t); every one of them in [0,1] is found by certified isolation, and the
 *  minimum over those and the two endpoints is the distance. There is no chord and no grid in this
 *  answer, and no root can go unseen. */
function distToCubic(p: Pt, c: Cubic): number {
  const dist = (t: number) => { const q = cubicAt(c, t); return Math.hypot(q[0] - p[0], q[1] - p[1]) }
  let best = Math.min(dist(0), dist(1))
  let quintic: number[] = [0, 0, 0, 0, 0, 0]
  for (const axis of [0, 1] as const) {
    const pos = cubicPower(c.a[axis], c.c1[axis], c.c2[axis], c.b[axis])
    pos[0] -= p[axis]
    const vel = [pos[1], 2 * pos[2], 3 * pos[3]]
    const prod = polyMul(pos, vel)
    quintic = quintic.map((v, i) => v + (prod[i] ?? 0))
  }
  for (const t of bernsteinRoots(powerToBernstein(quintic))) best = Math.min(best, dist(t))
  return best
}

/** All t in [0,1] where B_y(t) = y — the same certified isolation on the cubic's y-polynomial. */
function cubicRootsY(c: Cubic, y: number): number[] {
  const power = cubicPower(c.a[1], c.c1[1], c.c2[1], c.b[1])
  power[0] -= y
  return bernsteinRoots(powerToBernstein(power))
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

/** A segment's bounding box — an arc's from its own extremes, a cubic's from its control net (which
 *  contains the curve). Cheap, and only ever used to SKIP work: a segment whose box is already further
 *  than the best distance found cannot hold the nearest point. */
function segBox(from: Pt, seg: PathSeg): { minX: number; minY: number; maxX: number; maxY: number } {
  if (seg.kind === 'cubic') return {
    minX: Math.min(from[0], seg.c1[0], seg.c2[0], seg.to[0]), maxX: Math.max(from[0], seg.c1[0], seg.c2[0], seg.to[0]),
    minY: Math.min(from[1], seg.c1[1], seg.c2[1], seg.to[1]), maxY: Math.max(from[1], seg.c1[1], seg.c2[1], seg.to[1]),
  }
  if (seg.kind === 'line') return {
    minX: Math.min(from[0], seg.to[0]), maxX: Math.max(from[0], seg.to[0]),
    minY: Math.min(from[1], seg.to[1]), maxY: Math.max(from[1], seg.to[1]),
  }
  const r = radiusOf(seg.centre, from)
  const box = { minX: Math.min(from[0], seg.to[0]), maxX: Math.max(from[0], seg.to[0]), minY: Math.min(from[1], seg.to[1]), maxY: Math.max(from[1], seg.to[1]) }
  for (let q = 0; q < 4; q++) {
    const a = q * Math.PI / 2
    if (!withinSweep(seg.centre, from, seg.to, seg.ccw, a)) continue
    const x = seg.centre[0] + r * Math.cos(a), y = seg.centre[1] + r * Math.sin(a)
    if (x < box.minX) box.minX = x; if (x > box.maxX) box.maxX = x
    if (y < box.minY) box.minY = y; if (y > box.maxY) box.maxY = y
  }
  return box
}

/** SQUARED distance from a point to a box — zero inside it. A lower bound on the distance to anything
 *  in it, and squared so a query never pays for a square root it only compares. */
const box2 = (p: Pt, b: { minX: number; minY: number; maxX: number; maxY: number }): number => {
  const dx = Math.max(b.minX - p[0], 0, p[0] - b.maxX), dy = Math.max(b.minY - p[1], 0, p[1] - b.maxY)
  return dx * dx + dy * dy
}

/** HOW FAR A SUB-CURVE CAN STRAY FROM ITS OWN CHORD. The classical bound: a cubic lies within
 *  (3/4) of the greater control-point offset from the chord. Taken once per piece at build, it lets a
 *  query answer with chord arithmetic — the same arithmetic a polygon would use — and reach for the
 *  exact curve mathematics only where the bound admits the piece could hold the true nearest point.
 *  Nothing is approximated: the bound decides only whether an exact solve is NEEDED. */
function chordDeviation(c: Cubic): number {
  const dx = c.b[0] - c.a[0], dy = c.b[1] - c.a[1]
  const len = Math.hypot(dx, dy)
  if (len < 1e-12) return Math.max(
    Math.hypot(c.c1[0] - c.a[0], c.c1[1] - c.a[1]), Math.hypot(c.c2[0] - c.a[0], c.c2[1] - c.a[1]))
  const off = (q: Pt) => Math.abs((q[0] - c.a[0]) * dy - (q[1] - c.a[1]) * dx) / len
  return 0.75 * Math.max(off(c.c1), off(c.c2))
}

/** Split a cubic at t — de Casteljau, exact: the two halves ARE the curve, not an approximation. */
function splitCubic(c: Cubic, t: number): [Cubic, Cubic] {
  const m = (p: Pt, q: Pt): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
  const ab = m(c.a, c.c1), bc = m(c.c1, c.c2), cd = m(c.c2, c.b)
  const abbc = m(ab, bc), bccd = m(bc, cd), mid = m(abbc, bccd)
  return [{ a: c.a, c1: ab, c2: abbc, b: mid }, { a: mid, c1: bccd, c2: cd, b: c.b }]
}

type Piece = { box: { minX: number; minY: number; maxX: number; maxY: number } } & (
  | { kind: 'line'; from: Pt; to: Pt }
  | { kind: 'arc'; from: Pt; seg: Extract<PathSeg, { kind: 'arc' }> }
  /** `dev` bounds how far this sub-curve strays from its own chord — the standard control-point
   *  bound, exact enough to be trusted as a bound and cheap enough to be taken once. */
  | { kind: 'cubic'; c: Cubic; dev: number; monotoneY: boolean })

/** A path prepared for distance queries, computed ONCE. Two things happen here, both for speed only:
 *  every piece's bounding box is built up front (a solve asks the same outline for millions of
 *  distances), and every cubic is split into four — exactly, by de Casteljau — so that a query's
 *  bound rules out most of the curve before paying for a single quintic root isolation. The answer is
 *  identical either way; only the number of exact solves changes. Keyed on the path object, so a
 *  rebuilt path is a different entry and nothing can go stale. */
const prepared = new WeakMap<OutlinePath, Prepared>()
/** A path's own size, measured once — the scale the inside test nudges its scan line by. */
const spans = new WeakMap<OutlinePath, number>()
/** A fine point view kept WITH the path, for one purpose: a tight starting bound for distance
 *  queries. Its vertices lie ON the curve, so the distance to it is never less than the distance to
 *  the curve, and never more than `POLY_TOL_MM` beyond it — which is all a bound has to be. Seeding
 *  from the segment ENDS instead left the bound so loose on a long curve that almost every piece
 *  survived pruning and paid for a quintic; a blob's largest band took twenty seconds where it used
 *  to take four (Dan, 2026-09-05: "B4 on Bot is 38 sec ... it was 4-5 sec before"). */
const POLY_TOL_MM = 0.05
const polys = new WeakMap<OutlinePath, Pt[]>()
const polyOf = (path: OutlinePath): Pt[] => {
  let v = polys.get(path)
  if (!v) { v = flattenPath(path, POLY_TOL_MM); polys.set(path, v) }
  return v
}
const cubicBox = (c: Cubic) => ({
  minX: Math.min(c.a[0], c.c1[0], c.c2[0], c.b[0]), maxX: Math.max(c.a[0], c.c1[0], c.c2[0], c.b[0]),
  minY: Math.min(c.a[1], c.c1[1], c.c2[1], c.b[1]), maxY: Math.max(c.a[1], c.c1[1], c.c2[1], c.b[1]),
})
interface Prepared {
  pieces: Piece[]
  /** A uniform grid over the outline: for each cell, the pieces whose box touches it. */
  cell: number; x0: number; y0: number; nx: number; ny: number
  bins: Int32Array[]
  stamp: Int32Array
  token: number
  /** Per-query scratch, allocated with the outline: a distance query runs millions of times and must
   *  not allocate. */
  lower: Float64Array
  cand: Int32Array
}

function piecesOf(path: OutlinePath): Prepared {
  let w = prepared.get(path)
  if (w) return w
  const pieces: Piece[] = []
  eachSeg(path, (from, seg) => {
    if (seg.kind === 'line') { pieces.push({ kind: 'line', from, to: seg.to, box: segBox(from, seg) }); return }
    if (seg.kind === 'arc') { pieces.push({ kind: 'arc', from, seg, box: segBox(from, seg) }); return }
    // THREE LEVELS of exact halving. A sub-curve's box is its control net, which on a long curve
    // stands clear of the curve itself and so survives pruning it should not; halving tightens the
    // net quadratically, and it is paid once per outline, not per query.
    let level: Cubic[] = [cubicOf(from, seg)]
    for (let i = 0; i < 2; i++) level = level.flatMap((q) => splitCubic(q, 0.5))
    for (const q of level) pieces.push({
      kind: 'cubic', c: q, box: cubicBox(q), dev: chordDeviation(q),
      // no turning point in y: the curve's own y-range is then exactly its endpoints', and a ray
      // between them crosses it once and only once
      monotoneY: cubicExtremaT(q.a[1], q.c1[1], q.c2[1], q.b[1]).length === 0,
    })
  })
  // THE INDEX. A solve asks one outline for millions of distances, and every one of them used to walk
  // every piece — which is why a blob's largest band went from four seconds to nearly forty once the
  // pieces were curves (Dan, 2026-09-05). A uniform grid makes a query touch only what is near it.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const q of pieces) {
    if (q.box.minX < x0) x0 = q.box.minX; if (q.box.maxX > x1) x1 = q.box.maxX
    if (q.box.minY < y0) y0 = q.box.minY; if (q.box.maxY > y1) y1 = q.box.maxY
  }
  const span = Math.max(x1 - x0, y1 - y0, 1e-9)
  const target = Math.max(8, Math.min(48, Math.round(Math.sqrt(pieces.length) * 2)))
  const cell = span / target
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell) + 1), ny = Math.max(1, Math.ceil((y1 - y0) / cell) + 1)
  const lists: number[][] = Array.from({ length: nx * ny }, () => [])
  pieces.forEach((q, i) => {
    const ax = Math.max(0, Math.min(nx - 1, Math.floor((q.box.minX - x0) / cell)))
    const bx = Math.max(0, Math.min(nx - 1, Math.floor((q.box.maxX - x0) / cell)))
    const ay = Math.max(0, Math.min(ny - 1, Math.floor((q.box.minY - y0) / cell)))
    const by = Math.max(0, Math.min(ny - 1, Math.floor((q.box.maxY - y0) / cell)))
    for (let gy = ay; gy <= by; gy++) for (let gx = ax; gx <= bx; gx++) lists[gy * nx + gx].push(i)
  })
  w = {
    pieces, cell, x0, y0, nx, ny,
    bins: lists.map((l) => Int32Array.from(l)),
    stamp: new Int32Array(pieces.length), token: 0,
    lower: new Float64Array(pieces.length),
    cand: new Int32Array(pieces.length),
  }
  prepared.set(path, w)
  return w
}

/** EXACT distance from a point to the outline. No tolerance, no sampling.
 *
 *  Every segment is still measured exactly; a segment is only SKIPPED when its bounding box is
 *  already further away than the best exact distance found so far, which no point inside it can beat.
 *  On a traced cutout — dozens of cubics, each costing a quintic root isolation — this is the
 *  difference between a solve in seconds and one in minutes, and it cannot change an answer. */
export function distanceToPathMM(path: OutlinePath, p: Pt): number {
  const g = piecesOf(path)
  const { pieces, cell, x0, y0, nx, ny, bins, lower } = g
  const token = ++g.token
  const stamp = g.stamp
  // NEAR FIRST, AND CHEAPLY. The index says which pieces are close; the chord bound says which of
  // those could hold the nearest point; only those are solved exactly. Every step is a bound, so the
  // answer is the same one an exhaustive exact search gives — what changes is that a solve walked
  // every piece and paid for a quintic on several of them, tens of thousands of times per band.
  let bestUpper = Infinity
  let count = 0
  const cand = g.cand
  const cx = Math.max(0, Math.min(nx - 1, Math.floor((p[0] - x0) / cell)))
  const cy = Math.max(0, Math.min(ny - 1, Math.floor((p[1] - y0) / cell)))
  const reach = nx + ny
  for (let r = 0; r <= reach; r++) {
    if (r > 0 && count > 0) {
      const inner = (r - 1) * cell
      if (bestUpper <= inner) break
    }
    const gx0 = cx - r, gx1 = cx + r, gy0 = cy - r, gy1 = cy + r
    if (gx1 < 0 || gy1 < 0 || gx0 >= nx || gy0 >= ny) { if (count > 0) break; else continue }
    for (let gy = gy0; gy <= gy1; gy++) {
      if (gy < 0 || gy >= ny) continue
      const edgeRow = gy === gy0 || gy === gy1
      for (let gx = gx0; gx <= gx1; gx++) {
        if (gx < 0 || gx >= nx) continue
        if (!edgeRow && gx !== gx0 && gx !== gx1) continue
        const bin = bins[gy * nx + gx]
        for (let k = 0; k < bin.length; k++) {
          const i = bin[k]
          if (stamp[i] === token) continue
          stamp[i] = token
          const q = pieces[i]
          if (q.kind === 'cubic') {
            const d = Math.sqrt(segDist2(p, q.c.a, q.c.b))
            lower[i] = d - q.dev
            if (d + q.dev < bestUpper) bestUpper = d + q.dev
          } else {
            const d = q.kind === 'line' ? distToSegment(p, q.from, q.to) : distToArc(p, q.from, q.seg)
            lower[i] = d
            if (d < bestUpper) bestUpper = d
          }
          cand[count++] = i
        }
      }
    }
  }
  let best = bestUpper
  for (let k = 0; k < count; k++) {
    const i = cand[k]
    const q = pieces[i]
    if (q.kind !== 'cubic' || lower[i] >= best) continue
    const d = distToCubic(p, q.c)
    if (d < best) best = d
  }
  return best
}

/** DOES THIS POINT CLEAR THE OUTLINE BY `minMM`? The seat predicate asks exactly this, millions of
 *  times in a phase sweep, and asking it as "compute the distance, then compare" pays for the nearest
 *  point on the whole outline when almost every candidate is settled by one piece. Here a piece whose
 *  chord bound puts it certainly nearer than `minMM` ends the question immediately, and only a piece
 *  whose bound straddles the threshold is solved exactly. Same answer, a fraction of the work.
 *
 *  It walks pieces in index order rather than by locality: a failing candidate usually fails on the
 *  first nearby piece, and the ring search's own bookkeeping costs more than the scan it saves here. */
export function clearsPathBy(path: OutlinePath, p: Pt, minMM: number): boolean {
  const { pieces } = piecesOf(path)
  const min2 = minMM * minMM
  const ambiguous: number[] = []
  for (let i = 0; i < pieces.length; i++) {
    const q = pieces[i]
    if (q.kind === 'cubic') {
      // the chord's own box already answers for a piece that is far away
      if (box2(p, q.box) >= min2) continue
      const d = Math.sqrt(segDist2(p, q.c.a, q.c.b))
      if (d + q.dev < minMM) return false            // certainly nearer than the clearance asked for
      if (d - q.dev < minMM) ambiguous.push(i)       // the bound straddles it: needs the exact answer
    } else {
      if (box2(p, q.box) >= min2) continue
      const d = q.kind === 'line' ? distToSegment(p, q.from, q.to) : distToArc(p, q.from, q.seg)
      if (d < minMM) return false
    }
  }
  for (const i of ambiguous) {
    const q = pieces[i] as Extract<Piece, { kind: 'cubic' }>
    if (distToCubic(p, q.c) < minMM) return false
  }
  return true
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
 *  because the cap's arc ended on the ray at the very point the straight side left it.
 *
 *  THE RAY IS NUDGED OFF EVERY EXACT COINCIDENCE. Those rules are exact in real arithmetic and a
 *  coin-toss in floating point whenever the ray runs exactly through a vertex, a join, or a curve's
 *  own extreme — which is not a rare accident but the common case, because a mesh is laid out FROM
 *  the shape's bounding box and its first row therefore sits precisely on the lowest point. Getting
 *  it wrong there flips parity for the whole row: a traced duck grew a legal island 2mm outside
 *  itself and the engine centred the layout on it (Dan, 2026-09-05). Lifting the scan line by a
 *  billionth of the shape's own height — far below any manufacturing scale, far above float noise —
 *  removes every coincidence at once, and cannot change which side of an edge a real point is on. */
export function pointInPath(path: OutlinePath, p: Pt): boolean {
  const NEAR = 1e-9
  // The nudge is a property of the SHAPE, not of the query: computing the bounds — which walks every
  // segment and solves each curve's extremes — on every inside test made a blob's solve take half a
  // minute (Dan, Safari, 2026-09-05: "31 sec blob b4"). One measurement per outline, kept with it.
  let span = spans.get(path)
  if (span === undefined) {
    const b = pathBoundsMM(path)
    span = Math.max(b.maxY - b.minY, b.maxX - b.minX)
    spans.set(path, span)
  }
  p = [p[0], p[1] + (span > 0 ? span * 1e-9 : 1e-12)]
  let crossings = 0
  // THE SUB-CURVES DECIDE MOST CROSSINGS WITHOUT BEING SOLVED. A piece with no turning point in y
  // spans exactly its endpoints' y-range, so a ray between them meets it once: if the piece lies
  // wholly to the right the crossing counts, wholly to the left it does not, and only a piece the ray
  // actually enters needs its roots. Solving every curve instead made a phase sweep pay for certified
  // root isolation on candidates a comparison settles (Dan, 2026-09-05: the blob's largest band).
  const { pieces } = piecesOf(path)
  for (const q of pieces) {
    if (q.kind !== 'cubic') continue
    if (q.monotoneY) {
      const y0 = q.c.a[1], y1 = q.c.b[1]
      const lo = y0 < y1 ? y0 : y1, hi = y0 < y1 ? y1 : y0
      if (p[1] <= lo || p[1] > hi) continue           // the ray misses this piece entirely
      if (q.box.maxX <= p[0]) continue                // it lies behind the ray's origin
      if (q.box.minX > p[0]) { crossings++; continue } // it lies wholly ahead: exactly one crossing
    }
    for (const t of cubicRootsY(q.c, p[1])) {
      const x = bez(q.c.a[0], q.c.c1[0], q.c.c2[0], q.c.b[0], t)
      if (x <= p[0]) continue
      const rise = bezD(q.c.a[1], q.c.c1[1], q.c.c2[1], q.c.b[1], t)
      if (t < NEAR) { if (rise > 0) crossings++; continue }
      if (t > 1 - NEAR) { if (rise < 0) crossings++; continue }
      // A TOUCH IS NOT A CROSSING: where the ray runs through a curve's own extreme the root is
      // double and the curve turns back without passing through. The sign either side says which.
      const yOff = (u: number) => bez(q.c.a[1], q.c.c1[1], q.c.c2[1], q.c.b[1], u) - p[1]
      const h = 1e-6
      const before = yOff(Math.max(0, t - h)), after = yOff(Math.min(1, t + h))
      if (before === 0 || after === 0) { if (Math.abs(rise) >= NEAR) crossings++; continue }
      if (before * after > 0) continue
      crossings++
    }
  }
  eachSeg(path, (from, seg) => {
    if (seg.kind === 'cubic') return                    // answered above, piece by piece
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
    if (seg.kind === 'cubic') {
      // A cubic's axis extremes lie between subdivision points, so a plain flatten's bounding box
      // sits inside the true one — the pipeline scaled a centre against that box and landed 2.9um
      // off the exact centroid. Split at every extremum first, exactly (de Casteljau), so each is a
      // vertex; then flatten each piece. Same rule the arcs already follow.
      const c = cubicOf(from, seg)
      const cuts = [...cubicExtremaT(c.a[0], c.c1[0], c.c2[0], c.b[0]), ...cubicExtremaT(c.a[1], c.c1[1], c.c2[1], c.b[1])]
        .filter((t) => t > 1e-9 && t < 1 - 1e-9)
      let rest: Cubic = c, consumed = 0
      // walk the cuts in increasing t without sorting (foundation holds no ordering): take the least remaining each time
      const pending = [...cuts]
      while (pending.length) {
        let k = 0
        for (let i = 1; i < pending.length; i++) if (pending[i] < pending[k]) k = i
        const t = pending.splice(k, 1)[0]
        const local = (t - consumed) / (1 - consumed)
        const lerp = (p: Pt, q: Pt): Pt => [p[0] + (q[0] - p[0]) * local, p[1] + (q[1] - p[1]) * local]
        const ab = lerp(rest.a, rest.c1), bc = lerp(rest.c1, rest.c2), cd = lerp(rest.c2, rest.b)
        const abbc = lerp(ab, bc), bccd = lerp(bc, cd), m = lerp(abbc, bccd)
        flattenCubic({ a: rest.a, c1: ab, c2: abbc, b: m }, 0)
        rest = { a: m, c1: bccd, c2: cd, b: rest.b }
        consumed = t
      }
      flattenCubic(rest, 0)
      return
    }
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

// ── exact area and centroid ───────────────────────────────────────────────────────────────────────
//
// Green's theorem over the path: A = ½∮(x dy − y dx), Cx = (1/2A)∮x² dy, Cy = −(1/2A)∮y² dx. A line's
// terms are closed-form, an arc's are the standard trigonometric integrals, and a cubic's are exact
// polynomial integrals in t — x·y' is degree five, x²·y' and y²·x' degree eight. The centring unit and
// grid-core's prepared contour used to take the centroid of the flattened view, so a curved shape's
// centre moved with how finely it happened to be chopped (QA @a81dc93f, F4).

/** ∫₀¹ of a power-basis polynomial. */
const integrate01 = (poly: readonly number[]) => poly.reduce((s, a, k) => s + a / (k + 1), 0)

/** Signed area (positive for a counter-clockwise path) and the area centroid, exact. */
export function pathAreaCentroidMM(path: OutlinePath): { areaMM2: number; centroid: Pt } {
  let twiceA = 0, mx = 0, my = 0       // ∮(x dy − y dx), ∮x² dy, ∮y² dx
  eachSeg(path, (from, seg) => {
    if (seg.kind === 'line') {
      const [ax, ay] = from, [bx, by] = seg.to
      twiceA += ax * by - bx * ay
      mx += (by - ay) * (ax * ax + ax * bx + bx * bx) / 3
      my += (bx - ax) * (ay * ay + ay * by + by * by) / 3
      return
    }
    if (seg.kind === 'cubic') {
      const c = cubicOf(from, seg)
      const x = cubicPower(c.a[0], c.c1[0], c.c2[0], c.b[0]), y = cubicPower(c.a[1], c.c1[1], c.c2[1], c.b[1])
      const dx = [x[1], 2 * x[2], 3 * x[3]], dy = [y[1], 2 * y[2], 3 * y[3]]
      twiceA += integrate01(polyMul(x, dy)) - integrate01(polyMul(y, dx))
      mx += integrate01(polyMul(polyMul(x, x), dy))
      my += integrate01(polyMul(polyMul(y, y), dx))
      return
    }
    const { centre: [cx, cy], to, ccw } = seg
    const r = radiusOf(seg.centre, from)
    const t0 = angleOf(seg.centre, from)
    const t1 = t0 + (ccw ? 1 : -1) * sweepOf(seg.centre, from, to, ccw)
    const S = Math.sin, C = Math.cos
    const d = (f: (t: number) => number) => f(t1) - f(t0)
    twiceA += r * r * (t1 - t0) + cx * r * d(S) - cy * r * (d(C))
    // ∫(cx + r cosθ)² r cosθ dθ
    mx += cx * cx * r * d(S) + 2 * cx * r * r * d((t) => t / 2 + S(2 * t) / 4) + r * r * r * d((t) => S(t) - S(t) ** 3 / 3)
    // ∫(cy + r sinθ)² (−r sinθ) dθ
    my += -(cy * cy * r * d((t) => -C(t)) + 2 * cy * r * r * d((t) => t / 2 - S(2 * t) / 4) + r * r * r * d((t) => -C(t) + C(t) ** 3 / 3))
  })
  const areaMM2 = twiceA / 2
  if (Math.abs(areaMM2) < 1e-9) {
    const b = pathBoundsMM(path)
    return { areaMM2, centroid: [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2] }
  }
  return { areaMM2, centroid: [mx / (2 * areaMM2), -my / (2 * areaMM2)] }
}

/** THE PATH AS SVG — arcs as `A`, cubics as `C`, lines as `L`. The screen draws the true curve; it
 *  does not draw a polygon of it (Dan, 2026-09-05: "why is the pill outline on the zoom look uneven
 *  and wobbly like the polygon" — because the shell was still drawing the flattened view). `flipY`
 *  mirrors the engine's y-up millimetres onto the screen's y-down: the picture is the same picture,
 *  so an arc that turns counter-clockwise still turns counter-clockwise on screen, which in SVG's
 *  y-down convention is sweep-flag 0. */
export function pathToSvgD(path: OutlinePath, opts: { flipY?: boolean; precision?: number } = {}): string {
  const flip = opts.flipY ? -1 : 1
  const f = (v: number) => v.toFixed(opts.precision ?? 4)
  const P = (p: Pt) => `${f(p[0])} ${f(p[1] * flip)}`
  let d = `M ${P(path.start)}`
  eachSeg(path, (from, seg) => {
    if (seg.kind === 'line') { d += ` L ${P(seg.to)}`; return }
    if (seg.kind === 'cubic') { d += ` C ${P(seg.c1)} ${P(seg.c2)} ${P(seg.to)}`; return }
    const r = radiusOf(seg.centre, from)
    const sweep = sweepOf(seg.centre, from, seg.to, seg.ccw)
    // SVG draws sweep-flag 1 in its positive-angle direction, which on a y-down screen is clockwise.
    // A ccw arc in y-up mm is ccw on screen either way (the flip mirrors the whole picture), so its
    // flag is 0 when flipped and 1 when not.
    const sweepFlag = (seg.ccw ? 1 : 0) ^ (opts.flipY ? 1 : 0)
    const largeArc = sweep > Math.PI ? 1 : 0
    d += ` A ${f(r)} ${f(r)} 0 ${largeArc} ${sweepFlag} ${P(seg.to)}`
  })
  return d + ' Z'
}

/** THE INWARD OFFSET OF AN OFFSET — exact, for the paths this product makes. Every canon outline is a
 *  convex ring grown by the rim: lines joined by arcs of one radius R about the ring's vertices. Its
 *  legal area — where a magnet centre may sit — is that same construction with radius R − rim about
 *  the same centres, and when R − rim reaches zero the arcs vanish and the legal area IS the ring of
 *  centres, a true polygon with truly straight sides. The segment unit drew this from a 2mm marching
 *  mesh pulled onto the field, which at zoom read as facets (Dan, 2026-09-05: "every line in the
 *  engine now wobbly"). Null for a path with a cubic in it or with arcs of unequal radius — there is
 *  no exact inset for those yet, and the caller keeps its mesh. */
export function insetOffsetPath(path: OutlinePath, insetMM: number): OutlinePath | null {
  const centres: Pt[] = []
  let radius: number | null = null
  let ok = true
  eachSeg(path, (from, seg) => {
    if (seg.kind === 'cubic') { ok = false; return }
    if (seg.kind !== 'arc') return
    const r = radiusOf(seg.centre, from)
    if (radius === null) radius = r
    else if (Math.abs(r - radius) > 1e-9) ok = false
    if (!centres.some((c) => Math.hypot(c[0] - seg.centre[0], c[1] - seg.centre[1]) < 1e-9)) centres.push(seg.centre)
  })
  if (!ok) return null
  if (radius === null) return insetConvexPolygonPath(path, insetMM)
  if (!centres.length) return null
  const inner = radius - insetMM
  if (inner > 1e-9) return offsetConvexRingPath(centres, inner)
  if (centres.length === 1) return null            // a single disc shrunk past its centre: no area
  const ring = centres.length === 2 ? centres : centres
  return { start: ring[0], segs: [...ring.slice(1).map((p): PathSeg => ({ kind: 'line', to: p })), { kind: 'line', to: ring[0] }] }
}

/** The inset of an all-line CONVEX polygon — a square, a rectangle, a triangle, a diamond — is the
 *  polygon whose sides are the same lines moved inward: exact, and truly straight. Each new vertex is
 *  where two moved sides meet. Null for a concave polygon (its inset trims itself and is not this
 *  construction) or one shrunk past existence. */
function insetConvexPolygonPath(path: OutlinePath, insetMM: number): OutlinePath | null {
  const verts: Pt[] = [path.start]
  for (const seg of path.segs) if (seg.kind === 'line') verts.push(seg.to)
  if (Math.hypot(verts[0][0] - verts[verts.length - 1][0], verts[0][1] - verts[verts.length - 1][1]) < 1e-9) verts.pop()
  const n = verts.length
  if (n < 3) return null
  const ccw = signedArea(verts) >= 0 ? verts : [...verts].reverse()
  // convex: every turn goes the same way
  for (let i = 0; i < n; i++) {
    const a = ccw[i], b = ccw[(i + 1) % n], c = ccw[(i + 2) % n]
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-9) return null
  }
  // side i runs a->b; its inward normal (for a counter-clockwise ring) is (-dy, dx)
  const moved = ccw.map((a, i) => {
    const b = ccw[(i + 1) % n]
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy)
    const nx = -dy / len * insetMM, ny = dx / len * insetMM
    return { p: [a[0] + nx, a[1] + ny] as Pt, d: [dx, dy] as Pt }
  })
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const A = moved[(i - 1 + n) % n], B = moved[i]     // the vertex between side i-1 and side i
    const det = A.d[0] * B.d[1] - A.d[1] * B.d[0]
    if (Math.abs(det) < 1e-12) return null
    const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / det
    out.push([A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t])
  }
  // shrunk past existence: a moved side that now runs backwards has crossed its opposite
  for (let i = 0; i < n; i++) {
    const a = out[i], b = out[(i + 1) % n]
    if ((b[0] - a[0]) * moved[i].d[0] + (b[1] - a[1]) * moved[i].d[1] <= 1e-9) return null
  }
  return { start: out[0], segs: [...out.slice(1).map((p): PathSeg => ({ kind: 'line', to: p })), { kind: 'line', to: out[0] }] }
}

/** A CURVE THROUGH EXACT SAMPLES. Where an outline exists only as points that were each placed ON a
 *  true curve — the legal area's edge pulled onto the exact clearance field, a cutout's traced edge —
 *  this fits smooth cubic chains through them within `tolMM`, true corners kept as corners. It is the
 *  Studio's own fit (the Schneider fit behind its Simplify and its generators), so a curve the engine
 *  draws and a curve the Studio draws are the same kind of curve. It is not a conversion of chords:
 *  the samples are on the curve and the fit is bounded to them, never to the chords between them
 *  (Dan, 2026-09-05: "if you convert polygon into the path it will be dirty"). */
export function pathFromRingFit(ring: readonly Pt[], tolMM: number, cornerDeg = 60): OutlinePath {
  if (ring.length < 3) throw new Error('path: a fit needs at least three samples')
  const fitted = ringToVPath(ring.map(([x, y]) => ({ x, y })), cornerDeg, tolMM)
  // a sliver too small to hold a curve between its corners fits to nothing: it IS its corners
  const anchors = fitted.anchors.length >= 2 ? fitted.anchors : ring.map(([x, y]) => ({ p: { x, y } }))
  return pathFromAnchors(anchors, (v) => [v.x, v.y])
}
