// Neutral exact inward-offset arrangement (R14 §7.1b items 2–3). The legal region at clearance
// r is bounded by pieces of two kinds: each edge's offset line on its interior side, and a circle
// of radius r about each reflex vertex. Every pairwise intersection is computed once as a shared
// vertex; each element is cut at its vertices; a sub-piece survives only when its interior is at
// distance ≥ r from every other boundary feature; survivors chain into closed loops through the
// shared vertices. Coordinates are certified expressions — rational where possible, one square
// root where a circle is involved — and every decision is an exact sign test. A sign the bounds
// cannot settle makes the construction unresolved; it is never rounded into a loop.

import {
  approx, cAdd, cDiv, cInt, cMul, cNeg, cRat, cSqrt, cSub, compareCReal, evaluate, signOf, type CReal,
} from './certified-real'
import type { Rational } from '../spec'
import { nearSegments, segmentIndex, type ExactContour, type ExactSegment } from './clearance'
import { compareExact, ratAdd, ratFromInt, ratSub, rational } from './exact-real'

export interface P2 { readonly x: CReal; readonly y: CReal }

// R14 §7.3: certified pruning may change cost only. Both reductions — the exact 2r generator test
// on element pairs, and the indexed neighbourhood that validity is measured over — can be switched
// off, so the fixtures can compare a pruned arrangement against a full scan of every pair and every
// feature and demand byte-identical loops. Off, the construction is the naive O(n²)·O(n) one.
let pruningOn = true

/** Neutral pruning control. Disabling it changes cost, never a loop, vertex or refusal. */
export function offsetPruning(enabled: boolean): void { pruningOn = enabled }

export interface SharedVertex { readonly id: number; readonly p: P2 }

interface SegElem {
  readonly kind: 'seg'
  readonly id: number
  readonly feat: ExactSegment
  /** offset line p(t) = a + t·d */
  readonly a: P2
  readonly dx: bigint; readonly dy: bigint
  /**
   * The element's own span, junction to junction — NOT the nominal [0,1]. At a reflex vertex the
   * junction is the arc's tangency, which is the nominal end; at a convex vertex it is the miter
   * where the two offset lines meet, which lies OUTSIDE the nominal end whenever the edge is
   * shorter than r·cot(θ/2). Clipping to [0,1] therefore severed every corner of a densely traced
   * outline and left the loop open — the defect this span exists to remove.
   */
  t0: CReal
  t1: CReal
  startV: SharedVertex | null
  endV: SharedVertex | null
}
interface ArcElem {
  readonly kind: 'arc'
  readonly id: number
  readonly cx: bigint; readonly cy: bigint
  /** unit-free direction vectors of the arc's start and end (scaled normals), swept clockwise */
  readonly s: P2; readonly e: P2
  /** the two offset segments this arc joins — their lines are tangent to the circle at the junctions */
  readonly prevSeg: number; readonly nextSeg: number
  /** the arc's generating features: the two edges meeting at the reflex vertex (distance r by construction) */
  readonly feats: readonly [ExactSegment, ExactSegment]
  startV: SharedVertex | null
  endV: SharedVertex | null
}
type Elem = SegElem | ArcElem

export interface Piece {
  readonly elem: Elem
  readonly from: SharedVertex | null
  readonly to: SharedVertex | null
  /** representative interior point of the piece */
  readonly mid: P2
}

/** A piece as traversed along its loop: `reversed` means from `to` back to `from`. */
export interface OrientedPiece { readonly piece: Piece; readonly reversed: boolean }
export interface OffsetLoop { readonly pieces: readonly OrientedPiece[] }

export interface OffsetArrangement {
  readonly loops: readonly OffsetLoop[]
  /** a decision the certified bounds could not settle */
  readonly unresolved: boolean
  /** why — refusal evidence, one entry per undecided site */
  readonly reasons: readonly string[]
  readonly elements: number
}

const R2 = (r: bigint) => cInt(r * r)
const cBig = (v: bigint) => cInt(v)

// ---- exact helpers on certified coordinates -------------------------------------------------

const sub2 = (p: P2, q: P2): P2 => ({ x: cSub(p.x, q.x), y: cSub(p.y, q.y) })
const cross2 = (u: P2, v: P2): CReal => cSub(cMul(u.x, v.y), cMul(u.y, v.x))
const dot2 = (u: P2, v: P2): CReal => cAdd(cMul(u.x, v.x), cMul(u.y, v.y))
const pInt = (x: bigint, y: bigint): P2 => ({ x: cBig(x), y: cBig(y) })

/** Exact squared distance from a certified point to an integer segment. */
function dist2ToSegment(p: P2, s: ExactSegment): CReal | null {
  const dx = s.bx - s.ax, dy = s.by - s.ay
  const len2 = dx * dx + dy * dy
  const w = sub2(p, pInt(s.ax, s.ay))
  if (len2 === BigInt(0)) return dot2(w, w)
  const t = cAdd(cMul(w.x, cBig(dx)), cMul(w.y, cBig(dy))) // t·len2
  const sT = signOf(t)
  if (sT === null) return null
  if (sT <= 0) return dot2(w, w)
  const sEnd = signOf(cSub(t, cBig(len2)))
  if (sEnd === null) return null
  if (sEnd >= 0) { const u = sub2(p, pInt(s.bx, s.by)); return dot2(u, u) }
  const cr = cSub(cMul(w.x, cBig(dy)), cMul(w.y, cBig(dx)))
  return cDiv(cMul(cr, cr), cBig(len2))
}

// ---- element construction -------------------------------------------------------------------

function signedArea2(pts: Array<[bigint, bigint]>): bigint {
  let a = BigInt(0)
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  return a
}

/** Rings in (x,y) integer units with material on the LEFT of every edge: outer CCW, holes CW. */
function orientedRings(c: ExactContour): Array<{ ring: number; pts: Array<[bigint, bigint]> }> {
  const byRing = new Map<number, ExactSegment[]>()
  for (const s of c.segments) (byRing.get(s.ring) ?? byRing.set(s.ring, []).get(s.ring)!).push(s)
  const rings: Array<{ ring: number; pts: Array<[bigint, bigint]> }> = []
  for (const [ring, segs] of [...byRing.entries()].sort((a, b) => a[0] - b[0])) {
    const pts: Array<[bigint, bigint]> = segs.sort((a, b) => a.edge - b.edge).map((s) => [s.bx, s.by])
    const area = signedArea2(pts)
    const wantCCW = ring === 0
    if ((area > BigInt(0)) !== wantCCW) pts.reverse()
    rings.push({ ring, pts })
  }
  return rings
}

function buildElements(c: ExactContour, r: bigint, nextVertexId: () => number): { elems: Elem[]; feats: ExactSegment[]; problems: string[] } {
  const elems: Elem[] = []
  const feats: ExactSegment[] = []
  const problems: string[] = []
  let id = 0
  for (const { ring, pts } of orientedRings(c)) {
    const n = pts.length
    const edgeSeg: ExactSegment[] = []
    for (let i = 0; i < n; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n]
      const s: ExactSegment = { ax, ay, bx, by, minX: ax < bx ? ax : bx, maxX: ax > bx ? ax : bx, minY: ay < by ? ay : by, maxY: ay > by ? ay : by, ring, edge: i }
      edgeSeg.push(s); feats.push(s)
    }
    const segElems: SegElem[] = []
    for (let i = 0; i < n; i++) {
      const s = edgeSeg[i]
      const dx = s.bx - s.ax, dy = s.by - s.ay
      const len = cSqrt(cBig(dx * dx + dy * dy))
      // left normal (−dy, dx) scaled to length r
      const nx = cDiv(cMul(cBig(-dy), cBig(r)), len), ny = cDiv(cMul(cBig(dx), cBig(r)), len)
      const seg: SegElem = { kind: 'seg', id: id++, feat: s, a: { x: cAdd(cBig(s.ax), nx), y: cAdd(cBig(s.ay), ny) }, dx, dy, t0: cInt(0), t1: cInt(1), startV: null, endV: null }
      segElems.push(seg); elems.push(seg)
    }
    for (let i = 0; i < n; i++) {
      const incoming = edgeSeg[(i + n - 1) % n], outgoing = edgeSeg[i]
      const turn = (incoming.bx - incoming.ax) * (outgoing.by - outgoing.ay) - (incoming.by - incoming.ay) * (outgoing.bx - outgoing.ax)
      const segIn0 = segElems[(i + n - 1) % n], segOut0 = segElems[i]
      if (turn > BigInt(0)) {
        // Convex: the two offset lines meet at the miter. That point is the junction and it defines
        // both elements' spans, wherever it falls relative to the nominal ends.
        const det = segIn0.dx * segOut0.dy - segIn0.dy * segOut0.dx
        if (det === BigInt(0)) continue
        const w = sub2(segOut0.a, segIn0.a)
        const tIn = cDiv(cSub(cMul(w.x, cBig(segOut0.dy)), cMul(w.y, cBig(segOut0.dx))), cBig(det))
        const tOut = cDiv(cSub(cMul(w.x, cBig(segIn0.dy)), cMul(w.y, cBig(segIn0.dx))), cBig(det))
        const p: P2 = { x: cAdd(segIn0.a.x, cMul(tIn, cBig(segIn0.dx))), y: cAdd(segIn0.a.y, cMul(tIn, cBig(segIn0.dy))) }
        const j: SharedVertex = { id: nextVertexId(), p }
        segIn0.endV = j; segIn0.t1 = tIn
        segOut0.startV = j; segOut0.t0 = tOut
        continue
      }
      if (turn === BigInt(0)) {
        // Collinear neighbours. Same direction is a straight continuation: the offset lines coincide,
        // so the junction is the offset of the shared vertex and there is no gap to bridge — and it
        // must be built here, because an intersection solve returns nothing for parallel lines and
        // the two elements would keep null ends and open the loop. A 180° REVERSAL is not that: the
        // outline doubles back on itself, the two offsets sit on opposite sides, and there is no
        // junction to build — that is refused rather than given one edge's normal.
        const dIn = { x: incoming.bx - incoming.ax, y: incoming.by - incoming.ay }
        const dOut = { x: outgoing.bx - outgoing.ax, y: outgoing.by - outgoing.ay }
        if (dIn.x * dOut.x + dIn.y * dOut.y < BigInt(0)) {
          problems.push(`ring ${ring} vertex ${i} reverses direction: the outline doubles back and has no offset junction`)
          continue
        }
        const [vx, vy] = pts[i]
        const d = dOut
        const len = cSqrt(cBig(d.x * d.x + d.y * d.y))
        const p: P2 = {
          x: cAdd(cBig(vx), cDiv(cMul(cBig(-d.y), cBig(r)), len)),
          y: cAdd(cBig(vy), cDiv(cMul(cBig(d.x), cBig(r)), len)),
        }
        const j: SharedVertex = { id: nextVertexId(), p }
        segIn0.endV = j; segOut0.startV = j
        continue
      }
      // reflex vertex: arc of radius r from the incoming edge's left normal to the outgoing edge's, clockwise
      const [vx, vy] = pts[i]
      const n1 = pInt(-(incoming.by - incoming.ay), incoming.bx - incoming.ax)
      const n2 = pInt(-(outgoing.by - outgoing.ay), outgoing.bx - outgoing.ax)
      const segIn = segIn0, segOut = segOut0
      const arc: ArcElem = { kind: 'arc', id: id++, cx: vx, cy: vy, s: n1, e: n2, prevSeg: segIn.id, nextSeg: segOut.id, feats: [incoming, outgoing], startV: null, endV: null }
      // junctions are known by construction (the offset lines are tangent to the circle there) —
      // built as shared vertices, never rediscovered through a degenerate double root
      const j1: SharedVertex = { id: nextVertexId(), p: arcPoint(arc, n1, r) }
      const j2: SharedVertex = { id: nextVertexId(), p: arcPoint(arc, n2, r) }
      segIn.endV = j1; arc.startV = j1
      segOut.startV = j2; arc.endV = j2
      elems.push(arc)
    }
  }
  return { elems, feats, problems }
}

// ---- arc geometry: positions on a clockwise arc of span < π, by exact signs ------------------

/** direction vector of a point relative to the arc centre */
const dirOn = (arc: ArcElem, p: P2): P2 => sub2(p, pInt(arc.cx, arc.cy))
/** is direction u on the clockwise sweep from s to e (span < π)? null when undecidable */
function onSweep(arc: ArcElem, u: P2): boolean | null {
  const a = signOf(cross2(arc.s, u)), b = signOf(cross2(u, arc.e))
  if (a === null || b === null) return null
  return a <= 0 && b <= 0
}
/** u strictly before v along the clockwise sweep */
function cwBefore(u: P2, v: P2): boolean | null {
  const s = signOf(cross2(u, v))
  return s === null ? null : s < 0
}
const arcPoint = (arc: ArcElem, u: P2, r: bigint): P2 => {
  // point on the circle in direction u: c + r·u/|u|
  const len = cSqrt(dot2(u, u))
  return { x: cAdd(cBig(arc.cx), cDiv(cMul(u.x, cBig(r)), len)), y: cAdd(cBig(arc.cy), cDiv(cMul(u.y, cBig(r)), len)) }
}

// ---- intersections ---------------------------------------------------------------------------

type Hit = { p: P2; tA?: CReal; tB?: CReal } // parameters where defined (segments)

function segSeg(a: SegElem, b: SegElem): Hit[] | null {
  const det = a.dx * b.dy - a.dy * b.dx
  if (det === BigInt(0)) return []
  // a.a + t·da = b.a + u·db  → solve by Cramer on certified coordinates
  const w = sub2(b.a, a.a)
  const t = cDiv(cSub(cMul(w.x, cBig(b.dy)), cMul(w.y, cBig(b.dx))), cBig(det))
  const u = cDiv(cSub(cMul(w.x, cBig(a.dy)), cMul(w.y, cBig(a.dx))), cBig(det))
  const p: P2 = { x: cAdd(a.a.x, cMul(t, cBig(a.dx))), y: cAdd(a.a.y, cMul(t, cBig(a.dy))) }
  return [{ p, tA: t, tB: u }]
}

/** line p(t)=a+t·d against circle |p−c|²=r²: quadratic in t */
function segArc(seg: SegElem, arc: ArcElem, r: bigint): Hit[] | null {
  const f = sub2(seg.a, pInt(arc.cx, arc.cy))
  const A = cBig(seg.dx * seg.dx + seg.dy * seg.dy)
  const B = cMul(cInt(2), cAdd(cMul(f.x, cBig(seg.dx)), cMul(f.y, cBig(seg.dy))))
  const C = cSub(dot2(f, f), R2(r))
  const disc = cSub(cMul(B, B), cMul(cInt(4), cMul(A, C)))
  const sd = signOf(disc)
  if (sd === null) return null
  if (sd < 0) return []
  const hits: Hit[] = []
  const roots = sd === 0 ? [cDiv(cNeg(B), cMul(cInt(2), A))] : [
    cDiv(cSub(cNeg(B), cSqrt(disc)), cMul(cInt(2), A)),
    cDiv(cAdd(cNeg(B), cSqrt(disc)), cMul(cInt(2), A)),
  ]
  for (const t of roots) {
    const p: P2 = { x: cAdd(seg.a.x, cMul(t, cBig(seg.dx))), y: cAdd(seg.a.y, cMul(t, cBig(seg.dy))) }
    const on = onSweep(arc, dirOn(arc, p))
    if (on === null) return null
    if (on) hits.push({ p, tA: t })
  }
  return hits
}

function arcArc(a: ArcElem, b: ArcElem, r: bigint): Hit[] | null {
  const dx = b.cx - a.cx, dy = b.cy - a.cy
  const d2 = dx * dx + dy * dy
  if (d2 === BigInt(0) || d2 > BigInt(4) * r * r) return []
  // equal radii: radical line at the midpoint, half-chord h = √(r² − d²/4)
  const h2 = cSub(R2(r), cRat(rational(d2, BigInt(4))))
  const sh = signOf(h2)
  if (sh === null) return null
  if (sh < 0) return []
  const mx = cRat(rational(BigInt(2) * a.cx + dx, BigInt(2))), my = cRat(rational(BigInt(2) * a.cy + dy, BigInt(2)))
  const len = cSqrt(cBig(d2))
  const hits: Hit[] = []
  const offsets = sh === 0 ? [cInt(0)] : [cSqrt(h2), cNeg(cSqrt(h2))]
  for (const h of offsets) {
    const p: P2 = { x: cAdd(mx, cDiv(cMul(cBig(-dy), h), len)), y: cAdd(my, cDiv(cMul(cBig(dx), h), len)) }
    const onA = onSweep(a, dirOn(a, p)), onB = onSweep(b, dirOn(b, p))
    if (onA === null || onB === null) return null
    if (onA && onB) hits.push({ p })
  }
  return hits
}

// ---- the arrangement -------------------------------------------------------------------------

interface Cut { v: SharedVertex; t?: CReal; u?: P2 } // seg: param t · arc: direction

export function offsetArrangement(c: ExactContour, r: bigint): OffsetArrangement {
  let vid = 0
  const { elems, feats, problems } = buildElements(c, r, () => vid++)
  let unresolved = false
  const reasons: string[] = []
  const fail = (why: string) => { unresolved = true; reasons.push(why) }
  for (const why of problems) fail(why)
  const cuts = new Map<number, Cut[]>()
  for (const e of elems) cuts.set(e.id, [])
  const addCut = (e: Elem, v: SharedVertex, hit: Hit, which: 'A' | 'B') => {
    if (e.kind === 'seg') cuts.get(e.id)!.push({ v, t: which === 'A' ? hit.tA : hit.tB })
    else cuts.get(e.id)!.push({ v, u: dirOn(e, hit.p) })
  }

  // EXACT PAIR PRUNE (changes no answer). Now that every element carries its true junction-to-
  // junction span, its certified extent bounds where it can be — so two elements whose extents are
  // provably disjoint cannot cross, whatever their generators do. That matters: a generator-based
  // 2r test is NOT sound once lines run out to a miter, because a point on the extension is at
  // distance r from the supporting line while being farther than r from the finite segment
  // (Grid-Meta). The extents are directed rational bounds, never floats, and an arc's extent is its
  // centre box at radius r.
  type Box = { minX: Rational; minY: Rational; maxX: Rational; maxY: Rational }
  const rr = ratFromInt(r)
  const extent = (e: Elem): Box => {
    if (e.kind === 'arc') {
      const cx = ratFromInt(e.cx), cy = ratFromInt(e.cy)
      return { minX: ratSub(cx, rr), maxX: ratAdd(cx, rr), minY: ratSub(cy, rr), maxY: ratAdd(cy, rr) }
    }
    const at = (t: CReal) => ({
      x: evaluate(cAdd(e.a.x, cMul(t, cBig(e.dx))), BigInt(24)),
      y: evaluate(cAdd(e.a.y, cMul(t, cBig(e.dy))), BigInt(24)),
    })
    const s0 = at(e.t0), s1 = at(e.t1)
    const lo = (v: Rational[]) => v.reduce((m, x) => (compareExact(x, m) < 0 ? x : m))
    const hi = (v: Rational[]) => v.reduce((m, x) => (compareExact(x, m) > 0 ? x : m))
    return {
      minX: lo([s0.x.lo, s1.x.lo]), maxX: hi([s0.x.hi, s1.x.hi]),
      minY: lo([s0.y.lo, s1.y.lo]), maxY: hi([s0.y.hi, s1.y.hi]),
    }
  }
  const ext = new Map<number, Box>(elems.map((e) => [e.id, extent(e)]))
  const tooFarApart = (a: Elem, b: Elem): boolean => {
    if (!pruningOn) return false
    const A = ext.get(a.id)!, B = ext.get(b.id)!
    return compareExact(A.maxX, B.minX) < 0 || compareExact(B.maxX, A.minX) < 0
      || compareExact(A.maxY, B.minY) < 0 || compareExact(B.maxY, A.minY) < 0
  }
  // Construction identities are never re-solved. Two nonparallel offset lines meet exactly once, so
  // when that point is the miter junction they already share, re-deriving it only produces a span
  // comparison between two forms that are equal BY CONSTRUCTION — the one comparison certified
  // bounds can never settle, and the source of every undecidable span report on a traced outline.
  // Restricted to two straight elements on purpose: two nonparallel lines meet EXACTLY once, so a
  // shared junction accounts for their only crossing. Two equal-radius arcs can meet twice, so a
  // shared vertex proves nothing about a second intersection and they are still solved in full.
  const sharesJunction = (a: Elem, b: Elem): boolean => {
    if (a.kind !== 'seg' || b.kind !== 'seg') return false
    for (const va of [a.startV, a.endV]) {
      if (!va) continue
      if (va === b.startV || va === b.endV) return true
    }
    return false
  }
  for (let i = 0; i < elems.length; i++) for (let j = i + 1; j < elems.length; j++) {
    if (tooFarApart(elems[i], elems[j])) continue
    if (sharesJunction(elems[i], elems[j])) continue
    const a = elems[i], b = elems[j]
    // an arc and its two adjacent offset segments meet only at their built junctions (tangency)
    if (a.kind === 'arc' && (a.prevSeg === b.id || a.nextSeg === b.id)) continue
    if (b.kind === 'arc' && (b.prevSeg === a.id || b.nextSeg === a.id)) continue
    const arcSegHits = a.kind === 'arc' && b.kind === 'seg' ? segArc(b, a, r) : null
    const hits: Hit[] | null = a.kind === 'seg' && b.kind === 'seg' ? segSeg(a, b)
      : a.kind === 'seg' && b.kind === 'arc' ? segArc(a, b, r)
        : a.kind === 'arc' && b.kind === 'seg' ? (arcSegHits === null ? null : arcSegHits.map((h) => ({ p: h.p, tB: h.tA })))
          : arcArc(a as ArcElem, b as ArcElem, r)
    if (hits === null) { fail(`intersection ${a.kind}${a.id}×${b.kind}${b.id} undecidable`); continue }
    // A cut records where two offset CURVES cross. A hit on one element's infinite line but outside
    // the other's span is not such a crossing — the other curve is not there — so it splits a piece
    // at a parameter where nothing about its validity changes. Requiring the hit on BOTH spans
    // removes those spurious vertices; it cannot remove a real one, because a genuine crossing lies
    // on both curves by definition.
    const onSpan = (e: Elem, hit: Hit, which: 'A' | 'B'): boolean | null => {
      if (e.kind === 'seg') {
        const t = which === 'A' ? hit.tA : hit.tB
        if (!t) return null
        const lo = signOf(cSub(t, e.t0)), hi = signOf(cSub(e.t1, t))
        if (lo === null || hi === null) return null
        return lo >= 0 && hi >= 0
      }
      return onSweep(e, dirOn(e, hit.p))
    }
    for (const hit of hits) {
      // An endpoint already built by construction is recognised by IDENTITY first: if the hit is one
      // of these elements' own junction points, its membership is known and no numeric comparison is
      // attempted. Only genuinely new points are measured against the spans.
      const atKnownEnd = (e: Elem): SharedVertex | null => {
        for (const v of [e.startV, e.endV]) {
          if (!v) continue
          const sx = signOf(cSub(v.p.x, hit.p.x)), sy = signOf(cSub(v.p.y, hit.p.y))
          if (sx === 0 && sy === 0) return v
        }
        return null
      }
      const knownA = atKnownEnd(a), knownB = atKnownEnd(b)
      const onA = knownA ? true : onSpan(a, hit, 'A')
      const onB = knownB ? true : onSpan(b, hit, 'B')
      if (onA === null || onB === null) { fail(`span membership at ${a.kind}${a.id}×${b.kind}${b.id} undecidable`); continue }
      if (!onA || !onB) continue
      // Three or more curves through one point (collinear edges, symmetric corners) must share ONE
      // vertex: reuse a vertex already on either element when its point is exactly the same.
      let v: SharedVertex | null = null
      let coincidence: 'no' | 'yes' | 'undecidable' = 'no'
      const known: SharedVertex[] = [...cuts.get(a.id)!, ...cuts.get(b.id)!].map((k) => k.v)
      for (const e of [a, b]) { if (e.startV) known.push(e.startV); if (e.endV) known.push(e.endV) }
      for (const kv of known) {
        const sx = signOf(cSub(kv.p.x, hit.p.x)), sy = signOf(cSub(kv.p.y, hit.p.y))
        if (sx === 0 && sy === 0) { v = kv; coincidence = 'yes'; break }
        if (sx === null || sy === null) coincidence = 'undecidable'
      }
      if (!v && coincidence === 'undecidable') { fail(`coincidence at ${a.kind}${a.id}×${b.kind}${b.id} undecidable`); continue }
      if (!v) v = { id: vid++, p: hit.p }
      // a cut that coincides with an element's own junction is that junction — never a second stop
      const already = (e: Elem) => e.startV === v || e.endV === v || cuts.get(e.id)!.some((k) => k.v === v)
      if (!already(a)) addCut(a, v, hit, 'A')
      if (!already(b)) addCut(b, v, hit, 'B')
    }
  }

  // split each element at its cuts and keep the sub-pieces at distance ≥ r from every feature
  // Validity asks one question — is any feature nearer than r? — so only features whose bounding box
  // reaches within r of the point can answer it. The index returns exactly those; every feature it
  // omits is provably farther, so the verdict is identical to scanning the whole contour.
  const index = segmentIndex(feats, r > BigInt(0) ? r : BigInt(1))
  const candidatesNear = (p: P2): readonly ExactSegment[] | null => {
    if (!pruningOn) return feats
    const ix = evaluate(p.x, BigInt(16)), iy = evaluate(p.y, BigInt(16))
    const floorI = (v: Rational) => (v.n >= BigInt(0) ? v.n / v.d : -((-v.n + v.d - BigInt(1)) / v.d))
    const ceilI = (v: Rational) => (v.n >= BigInt(0) ? (v.n + v.d - BigInt(1)) / v.d : -((-v.n) / v.d))
    return nearSegments(index, floorI(ix.lo) - BigInt(1), floorI(iy.lo) - BigInt(1), ceilI(ix.hi) + BigInt(1), ceilI(iy.hi) + BigInt(1), r)
  }
  const valid = (p: P2, own: readonly ExactSegment[]): boolean | null => {
    const scope = candidatesNear(p)
    if (scope === null) return null
    for (const f of scope) {
      if (own.includes(f)) continue
      const d2 = dist2ToSegment(p, f)
      if (d2 === null) return null
      const s = signOf(cSub(d2, R2(r)))
      if (s === null) return null
      if (s < 0) return false
    }
    return true
  }
  const pieces: Piece[] = []
  for (const e of elems) {
    const list = cuts.get(e.id)!
    if (e.kind === 'seg') {
      // keep cuts inside the element's own junction-to-junction span; order by t
      const inSpan = list.filter((k) => { const lo = signOf(cSub(k.t!, e.t0)), hi = signOf(cSub(e.t1, k.t!)); if (lo === null || hi === null) { fail(`seg${e.id} cut span undecidable`); return false } return lo >= 0 && hi >= 0 })
      inSpan.sort((p, q) => { const s = compareCReal(p.t!, q.t!); if (s === null) { fail(`seg${e.id} cut order undecidable`); return 0 } return s })
      const stops: Array<{ v: SharedVertex | null; t: CReal }> = [{ v: e.startV, t: e.t0 }, ...inSpan.map((k) => ({ v: k.v, t: k.t! })), { v: e.endV, t: e.t1 }]
      for (let k = 0; k + 1 < stops.length; k++) {
        const tm = cDiv(cAdd(stops[k].t, stops[k + 1].t), cInt(2))
        const mid: P2 = { x: cAdd(e.a.x, cMul(tm, cBig(e.dx))), y: cAdd(e.a.y, cMul(tm, cBig(e.dy))) }
        const ok = valid(mid, [e.feat])
        if (ok === null) { fail(`seg${e.id} piece ${k} validity undecidable`); continue }
        if (ok) pieces.push({ elem: e, from: stops[k].v, to: stops[k + 1].v, mid })
      }
    } else {
      const onArc = list.filter((k) => { const on = onSweep(e, k.u!); if (on === null) { fail(`arc${e.id} cut sweep undecidable`); return false } return on })
      onArc.sort((p, q) => { const b = cwBefore(p.u!, q.u!); if (b === null) { fail(`arc${e.id} cut order undecidable`); return 0 } return b ? -1 : 1 })
      const stops: Array<{ v: SharedVertex | null; u: P2 }> = [{ v: e.startV, u: e.s }, ...onArc.map((k) => ({ v: k.v, u: k.u! })), { v: e.endV, u: e.e }]
      for (let k = 0; k + 1 < stops.length; k++) {
        // bisector direction of two directions within a half-turn: normalised sum
        const u0 = stops[k].u, u1 = stops[k + 1].u
        const l0 = cSqrt(dot2(u0, u0)), l1 = cSqrt(dot2(u1, u1))
        const um: P2 = { x: cAdd(cDiv(u0.x, l0), cDiv(u1.x, l1)), y: cAdd(cDiv(u0.y, l0), cDiv(u1.y, l1)) }
        const mid = arcPoint(e, um, r)
        const ok = valid(mid, e.feats)
        if (ok === null) { fail(`arc${e.id} piece ${k} validity undecidable`); continue }
        if (ok) pieces.push({ elem: e, from: stops[k].v, to: stops[k + 1].v, mid })
      }
    }
  }

  // chain pieces into loops through shared vertices (identity, never numeric matching)
  const byVertex = new Map<number, Piece[]>()
  for (const p of pieces) for (const v of [p.from, p.to]) if (v) (byVertex.get(v.id) ?? byVertex.set(v.id, []).get(v.id)!).push(p)
  for (const [id, ps] of byVertex) if (ps.length !== 2) fail(`vertex ${id} has ${ps.length} incident pieces: ${ps.map((q) => q.elem.kind + q.elem.id).join(',')}`)
  const used = new Set<Piece>()
  const loops: OffsetLoop[] = []
  for (const start of pieces) {
    if (used.has(start) || !start.from || !start.to) continue
    const loop: OrientedPiece[] = []
    let cur: Piece | undefined = start
    let enter: SharedVertex | null = start.from
    let closed = false
    while (cur && !used.has(cur)) {
      used.add(cur)
      const reversed: boolean = cur.from !== enter
      loop.push({ piece: cur, reversed })
      const exit: SharedVertex | null = reversed ? cur.from : cur.to
      if (!exit) break
      if (exit === start.from) { closed = true; break }
      const onward: Piece | undefined = (byVertex.get(exit.id) ?? []).find((q) => q !== cur && !used.has(q))
      enter = exit; cur = onward
    }
    if (closed && loop.length) loops.push({ pieces: loop })
    else fail(`open chain from ${start.elem.kind}${start.elem.id} (${loop.length} pieces)`)
  }
  return { loops, unresolved, reasons, elements: elems.length }
}

/** report-only coordinates of a loop's piece midpoints */
export const loopApprox = (loop: OffsetLoop): Array<[number, number]> => loop.pieces.map(({ piece }) => [approx(piece.mid.x), approx(piece.mid.y)])

/** Exact endpoints of a traversed piece, in traversal order; arc pieces expose centre and radius. */
export function traversed(op: OrientedPiece, r: bigint): { from: P2; to: P2; arc: { cx: bigint; cy: bigint; r: bigint } | null } {
  const { piece, reversed } = op
  const e = piece.elem
  const endpoint = (v: SharedVertex | null, atStart: boolean): P2 => {
    if (v) return v.p
    // nominal element end with no shared vertex (convex corner trimmed the rest away)
    if (e.kind === 'seg') {
      const t = atStart ? e.t0 : e.t1
      return { x: cAdd(e.a.x, cMul(t, cBig(e.dx))), y: cAdd(e.a.y, cMul(t, cBig(e.dy))) }
    }
    return arcPoint(e, atStart ? e.s : e.e, r)
  }
  const a = endpoint(piece.from, true), b = endpoint(piece.to, false)
  return { from: reversed ? b : a, to: reversed ? a : b, arc: e.kind === 'arc' ? { cx: e.cx, cy: e.cy, r } : null }
}
export type { Elem }

/** The boundary features that can be nearest to an interior point: every edge (material on its
 *  left after orientation) and every reflex vertex. Convex vertices never generate interior
 *  clearance and are excluded. */
export function boundaryFeatures(c: ExactContour): { edges: ExactSegment[]; reflex: Array<{ x: bigint; y: bigint }> } {
  const edges: ExactSegment[] = []
  const reflex: Array<{ x: bigint; y: bigint }> = []
  for (const { ring, pts } of orientedRings(c)) {
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n]
      edges.push({ ax, ay, bx, by, minX: ax < bx ? ax : bx, maxX: ax > bx ? ax : bx, minY: ay < by ? ay : by, maxY: ay > by ? ay : by, ring, edge: i })
    }
    for (let i = 0; i < n; i++) {
      const [px, py] = pts[(i + n - 1) % n], [vx, vy] = pts[i], [qx, qy] = pts[(i + 1) % n]
      const turn = (vx - px) * (qy - vy) - (vy - py) * (qx - vx)
      if (turn < BigInt(0)) reflex.push({ x: vx, y: vy })
    }
  }
  return { edges, reflex }
}
