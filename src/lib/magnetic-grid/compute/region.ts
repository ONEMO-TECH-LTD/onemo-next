// Neutral exact region integrals (R14 §7.1b item 4): area and centroid of every legal region by
// Green's theorem over the offset-boundary pieces. Segment pieces integrate exactly; arc pieces
// integrate exactly in their endpoints' sines and cosines plus the certified sweep angle. The
// results are certified enclosures (exact rationals collapse to zero width). Loop orientation —
// the sign of the area — tells an island boundary from a hole boundary; holes are assigned to
// their island by exact ray parity.

import type { Rational } from '../spec'
import { angleBetween } from './angle'
import { cAdd, cDiv, cInt, cMul, cNeg, cSqrt, cSub, evaluate, signOf, type CReal, type Interval } from './certified-real'
import type { ExactContour } from './clearance'
import { compareExact, ratAdd, ratDiv, ratFromInt, ratMul, ratSign, ratSub, ratToNumber } from './exact-real'
import { offsetArrangement, traversed, type OffsetLoop, type P2 } from './offset'

export interface RegionIntegrals {
  /** certified signed area (units²): positive = counter-clockwise = island boundary */
  area: Interval
  /** certified first moments ∬x dA, ∬y dA (units³) */
  mx: Interval
  my: Interval
}

export interface ExactRegion {
  readonly outer: OffsetLoop
  readonly holes: readonly OffsetLoop[]
  /** certified area and centroid in mm / mm² */
  readonly areaMM2: Interval
  readonly centroidMM: { x: Interval; y: Interval }
  /** report-only decimals */
  readonly areaApproxMM2: number
  readonly centroidApproxMM: [number, number]
}

export interface ExactRegions {
  readonly regions: readonly ExactRegion[]
  readonly unresolved: boolean
  readonly reasons: readonly string[]
}

/** Exact containment in a region: inside its outer loop and outside every hole. */
export function regionContains(region: ExactRegion, p: P2, r: bigint): boolean | null {
  const outer = loopContains(region.outer, p, r)
  if (outer !== true) return outer
  for (const h of region.holes) {
    const inHole = loopContains(h, p, r)
    if (inHole === null) return null
    if (inHole) return false
  }
  return true
}

const BITS = 64n
const I = (lo: Rational, hi: Rational): Interval => ({ lo, hi })
const iAdd = (a: Interval, b: Interval): Interval => I(ratAdd(a.lo, b.lo), ratAdd(a.hi, b.hi))
const iSub = (a: Interval, b: Interval): Interval => I(ratSub(a.lo, b.hi), ratSub(a.hi, b.lo))
const iScale = (a: Interval, k: Rational): Interval => (ratSign(k) >= 0 ? I(ratMul(a.lo, k), ratMul(a.hi, k)) : I(ratMul(a.hi, k), ratMul(a.lo, k)))
const iOf = (e: CReal): Interval => evaluate(e, BITS)
const ZERO = I(ratFromInt(0), ratFromInt(0))
const half = (e: CReal) => cDiv(e, cInt(2))
const third = (e: CReal) => cDiv(e, cInt(3))
const sixth = (e: CReal) => cDiv(e, cInt(6))

/**
 * Green's theorem terms for a straight piece P→Q (exact), in the SAME gauge the arc terms use:
 * area = ½∮(x dy − y dx), Mx = ∮x²/2 dy, My = −∮y²/2 dx. The shoelace moment
 * (Px+Qx)·cross/6 is a different gauge — equivalent only when summed over an all-segment loop —
 * so mixing it with arc pieces leaves the area right and the centroid wrong.
 */
function segmentTerms(P: P2, Q: P2): RegionIntegrals {
  const crossPQ = cSub(cMul(P.x, Q.y), cMul(Q.x, P.y))
  const sqSum = (a: CReal, b: CReal) => cAdd(cAdd(cMul(a, a), cMul(a, b)), cMul(b, b))
  return {
    area: iOf(half(crossPQ)),
    mx: iOf(sixth(cMul(cSub(Q.y, P.y), sqSum(P.x, Q.x)))),
    my: iOf(cNeg(sixth(cMul(cSub(Q.x, P.x), sqSum(P.y, Q.y))))),
  }
}

/**
 * Green's theorem terms for a circular arc P→Q about (cx, cy) of radius r, swept by the signed
 * angle Δθ (certified). With s = sin θ = (y−cy)/r and c = cos θ = (x−cx)/r at each endpoint:
 *   ½∮(x dy − y dx) = ½[ r²Δθ + cx(Qy−Py) − cy(Qx−Px) ]
 *   ∮ x²/2 dy = ½[ cx² r(s₂−s₁) + 2cx r²(Δθ/2 + (s₂c₂−s₁c₁)/2) + r³((s₂−s₁) − (s₂³−s₁³)/3) ]
 *   −∮ y²/2 dx = ½[ cy² r(−(c₂−c₁)) + 2cy r²(Δθ/2 − (s₂c₂−s₁c₁)/2) + r³(−(c₂−c₁) + (c₂³−c₁³)/3) ]
 */
function arcTerms(P: P2, Q: P2, cx: bigint, cy: bigint, r: bigint): RegionIntegrals | null {
  const C = { x: cInt(cx), y: cInt(cy) }
  const R = cInt(r)
  const u1 = { x: cSub(P.x, C.x), y: cSub(P.y, C.y) }, u2 = { x: cSub(Q.x, C.x), y: cSub(Q.y, C.y) }
  const cross = cSub(cMul(u1.x, u2.y), cMul(u1.y, u2.x)), dot = cAdd(cMul(u1.x, u2.x), cMul(u1.y, u2.y))
  const dTheta = angleBetween(cross, dot, BITS)
  if (!dTheta) return null
  const s1 = cDiv(u1.y, R), c1 = cDiv(u1.x, R), s2 = cDiv(u2.y, R), c2 = cDiv(u2.x, R)
  const r2 = cMul(R, R), r3 = cMul(r2, R)
  const cube = (e: CReal) => cMul(e, cMul(e, e))
  const ds = cSub(s2, s1), dc = cSub(c2, c1)
  const dsc = cSub(cMul(s2, c2), cMul(s1, c1))
  // area: ½ r² Δθ + ½[cx(Qy−Py) − cy(Qx−Px)]
  const areaExact = iOf(half(cSub(cMul(C.x, cSub(Q.y, P.y)), cMul(C.y, cSub(Q.x, P.x)))))
  const area = iAdd(iScale(dTheta, ratDiv(iOf(r2).lo, ratFromInt(2))), areaExact)
  // mx
  const mxExact = iOf(half(cAdd(cAdd(cMul(cMul(C.x, C.x), cMul(R, ds)), cMul(cMul(cInt(2), cMul(C.x, r2)), half(dsc))), cMul(r3, cSub(ds, third(cSub(cube(s2), cube(s1))))))))
  const mxTheta = iScale(dTheta, ratDiv(iOf(cMul(C.x, r2)).lo, ratFromInt(2))) // ½·2cx r²·Δθ/2 = cx r² Δθ / 2
  // my
  const myExact = iOf(half(cAdd(cAdd(cMul(cMul(C.y, C.y), cMul(R, cSub(cInt(0), dc))), cMul(cMul(cInt(2), cMul(C.y, r2)), cSub(cInt(0), half(dsc)))), cMul(r3, cAdd(cSub(cInt(0), dc), third(cSub(cube(c2), cube(c1))))))))
  const myTheta = iScale(dTheta, ratDiv(iOf(cMul(C.y, r2)).lo, ratFromInt(2)))
  return { area, mx: iAdd(mxExact, mxTheta), my: iAdd(myExact, myTheta) }
}

/** Signed integrals of one loop along its traversal. */
export function loopIntegrals(loop: OffsetLoop, r: bigint): RegionIntegrals | null {
  let area = ZERO, mx = ZERO, my = ZERO
  for (const op of loop.pieces) {
    const { from, to, arc } = traversed(op, r)
    const t = arc ? arcTerms(from, to, arc.cx, arc.cy, arc.r) : segmentTerms(from, to)
    if (!t) return null
    area = iAdd(area, t.area); mx = iAdd(mx, t.mx); my = iAdd(my, t.my)
  }
  return { area, mx, my }
}

/**
 * Exact ray-parity containment of a point in a loop.
 *
 * The ray direction is CHOSEN, not fixed: a ray through a shared vertex is counted by both of the
 * pieces meeting there and flips the answer (the axis ray through the dumbbell's neck-arc junction
 * did exactly that). Each vertex rules out at most one slope, so among finitely many candidate
 * slopes one is certified to miss every vertex, and along it every crossing is a strict interior
 * hit. Tangential touches of an arc are not crossings and change no parity.
 */
export function loopContains(loop: OffsetLoop, p: P2, r: bigint): boolean | null {
  const spans = loop.pieces.map((op) => traversed(op, r))
  const vertices: P2[] = spans.flatMap((s) => [s.from, s.to])

  let dir: { x: CReal; y: CReal } | null = null
  for (let k = 0; k <= vertices.length + 1 && !dir; k++) {
    for (const cand of [{ x: cInt(1), y: cInt(k) }, { x: cInt(1), y: cInt(-k) }]) {
      let clear = true
      for (const v of vertices) {
        // ray hits v iff cross(dir, v − p) = 0 and the hit is forward; reject on either 0 or unknown
        const cross = cSub(cMul(cand.x, cSub(v.y, p.y)), cMul(cand.y, cSub(v.x, p.x)))
        const s = signOf(cross)
        if (s === null) return null
        if (s === 0) { clear = false; break }
      }
      if (clear) { dir = cand; break }
    }
  }
  if (!dir) return null

  let crossings = 0
  for (const { from, to, arc } of spans) {
    if (!arc) {
      // p + t·dir = from + s·(to − from), strict interior 0 < s < 1 and forward t > 0
      const ex = cSub(to.x, from.x), ey = cSub(to.y, from.y)
      const det = cSub(cMul(dir.x, ey), cMul(dir.y, ex))
      const sDet = signOf(det)
      if (sDet === null) return null
      if (sDet === 0) continue // parallel; a collinear piece would have put a vertex on the ray
      // p + t·dir = from + s·e, w = from − p  ⇒  s = (w × dir)/(dir × e),  t = (w × e)/(dir × e)
      const wx = cSub(from.x, p.x), wy = cSub(from.y, p.y)
      const s = cDiv(cSub(cMul(wx, dir.y), cMul(wy, dir.x)), det)
      const t = cDiv(cSub(cMul(wx, ey), cMul(wy, ex)), det)
      const s0 = signOf(s), s1 = signOf(cSub(cInt(1), s)), st = signOf(t)
      if (s0 === null || s1 === null || st === null) return null
      if (s0 > 0 && s1 > 0 && st > 0) crossings++
      continue
    }
    // |p + t·dir − C|² = r² → quadratic in t
    const fx = cSub(p.x, cInt(arc.cx)), fy = cSub(p.y, cInt(arc.cy))
    const A = cAdd(cMul(dir.x, dir.x), cMul(dir.y, dir.y))
    const B = cMul(cInt(2), cAdd(cMul(fx, dir.x), cMul(fy, dir.y)))
    const C = cSub(cAdd(cMul(fx, fx), cMul(fy, fy)), cInt(arc.r * arc.r))
    const disc = cSub(cMul(B, B), cMul(cInt(4), cMul(A, C)))
    const sd = signOf(disc)
    if (sd === null) return null
    if (sd <= 0) continue // miss, or tangential touch: no parity change
    const root = cSqrt(disc)
    for (const t of [cDiv(cSub(cSub(cInt(0), B), root), cMul(cInt(2), A)), cDiv(cAdd(cSub(cInt(0), B), root), cMul(cInt(2), A))]) {
      const st = signOf(t)
      if (st === null) return null
      if (st <= 0) continue
      const q: P2 = { x: cAdd(p.x, cMul(t, dir.x)), y: cAdd(p.y, cMul(t, dir.y)) }
      // strictly inside the traversed sweep (span < π): u is strictly between from and to
      const u = { x: cSub(q.x, cInt(arc.cx)), y: cSub(q.y, cInt(arc.cy)) }
      const uf = { x: cSub(from.x, cInt(arc.cx)), y: cSub(from.y, cInt(arc.cy)) }
      const ut = { x: cSub(to.x, cInt(arc.cx)), y: cSub(to.y, cInt(arc.cy)) }
      const c1 = signOf(cSub(cMul(uf.x, u.y), cMul(uf.y, u.x)))
      const c2 = signOf(cSub(cMul(u.x, ut.y), cMul(u.y, ut.x)))
      if (c1 === null || c2 === null) return null
      if (c1 !== 0 && c1 === c2) crossings++
    }
  }
  return crossings % 2 === 1
}

/**
 * The legal regions of a contour at clearance `rUnits`: islands with their holes, each with
 * certified area and centroid.
 */
export function exactRegions(c: ExactContour, rUnits: bigint): ExactRegions {
  const arr = offsetArrangement(c, rUnits)
  const reasons = [...arr.reasons]
  let unresolved = arr.unresolved
  const loops = arr.loops.map((loop) => ({ loop, integrals: loopIntegrals(loop, rUnits) }))
  const outers: typeof loops = [], holes: typeof loops = []
  for (const l of loops) {
    if (!l.integrals) { unresolved = true; reasons.push('loop integral undecidable (arc sweep on the branch cut)'); continue }
    const s = ratSign(l.integrals.area.lo) > 0 ? 1 : ratSign(l.integrals.area.hi) < 0 ? -1 : 0
    if (s === 0) { unresolved = true; reasons.push('loop orientation undecidable'); continue }
    ;(s > 0 ? outers : holes).push(l)
  }
  const unit = c.unit
  const u2 = ratFromInt(unit * unit)
  // sign-aware interval division by a strictly positive denominator interval: all four quotients
  const iDivPos = (num: Interval, den: Interval): Interval => {
    const q = [ratDiv(num.lo, den.lo), ratDiv(num.lo, den.hi), ratDiv(num.hi, den.lo), ratDiv(num.hi, den.hi)]
    return I(q.reduce((m, x) => (compareExact(x, m) < 0 ? x : m)), q.reduce((m, x) => (compareExact(x, m) > 0 ? x : m)))
  }
  const regions: ExactRegion[] = []
  for (const o of outers) {
    const mine = holes.filter((h) => {
      const probe = h.loop.pieces[0].piece.mid
      const inside = loopContains(o.loop, probe, rUnits)
      if (inside === null) { unresolved = true; reasons.push('hole nesting undecidable'); return false }
      return inside
    })
    let area = o.integrals!.area, mx = o.integrals!.mx, my = o.integrals!.my
    for (const h of mine) { area = iAdd(area, h.integrals!.area); mx = iAdd(mx, h.integrals!.mx); my = iAdd(my, h.integrals!.my) }
    const areaMM2 = I(ratDiv(area.lo, u2), ratDiv(area.hi, u2))
    // centroid = moment / area; area is certified strictly positive for an outer loop, moments may
    // have either sign — divide by all four endpoint quotients, then convert units³/units² → mm
    const perUnit = ratFromInt(unit)
    const cxU = iDivPos(mx, area), cyU = iDivPos(my, area)
    const cx = I(ratDiv(cxU.lo, perUnit), ratDiv(cxU.hi, perUnit)), cy = I(ratDiv(cyU.lo, perUnit), ratDiv(cyU.hi, perUnit))
    regions.push({
      outer: o.loop, holes: mine.map((h) => h.loop),
      areaMM2, centroidMM: { x: cx, y: cy },
      areaApproxMM2: (ratToNumber(areaMM2.lo) + ratToNumber(areaMM2.hi)) / 2,
      centroidApproxMM: [(ratToNumber(cx.lo) + ratToNumber(cx.hi)) / 2, (ratToNumber(cy.lo) + ratToNumber(cy.hi)) / 2],
    })
  }
  return { regions, unresolved, reasons }
}
