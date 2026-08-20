// Neutral exact region integrals (R14 §7.1b item 4): area and centroid of every legal region by
// Green's theorem over the offset-boundary pieces. Segment pieces integrate exactly; arc pieces
// integrate exactly in their endpoints' sines and cosines plus the certified sweep angle. The
// results are certified enclosures (exact rationals collapse to zero width). Loop orientation —
// the sign of the area — tells an island boundary from a hole boundary; holes are assigned to
// their island by exact ray parity.

import type { ExactRational } from './exact-real'
import type { CertifiedExpressionReal } from '../spec'
import { angleBetween } from './angle'
import { cAdd, cDiv, cInt, cMul, cNeg, cSqrt, cSub, evaluate, signOf, type CReal, type Interval } from './certified-real'
import type { ExactContour } from './clearance'
import { compareExact, ratAdd, ratDiv, ratFromInt, ratMul, ratSign, ratSub, ratToNumber } from './exact-real'
import { offsetArrangement, traversed, type OffsetLoop, type P2 } from './offset'
import { encodeCertifiedExpression } from './identity'

/**
 * One arc sweep: the signed angle a piece turns through, kept as the geometry that DEFINES it
 * rather than as a number. An angle is transcendental, so it has no exact algebraic value — but it
 * has an exact identity and can be enclosed to any precision on demand, which is what a certified
 * expression needs (R14 §7.1b item 4).
 */
export interface ArcSweep {
  readonly cx: bigint
  readonly cy: bigint
  readonly r: bigint
  readonly from: P2
  readonly to: P2
}

/**
 * A certified integral: an exact algebraic part plus angle-weighted parts, each an exact weight on
 * one sweep. Kept SYMBOLIC deliberately. Evaluating to an interval at a fixed precision — as this
 * did before — loses two things the engine needs: the ability to refine a comparison that did not
 * separate, and an identity that does not change when the precision does.
 */
export interface CertifiedSum {
  readonly exact: CReal
  readonly angles: ReadonlyArray<{ readonly weight: CReal; readonly sweep: ArcSweep }>
}

/** Canonical exact-expression identity for publication; add/mul order cannot change the bytes. */
function canonicalExpression(e: CReal): string {
  if (e.k === 'rat') return `rat(${e.v.n}/${e.v.d})`
  if (e.k === 'neg') return `neg(${canonicalExpression(e.a)})`
  if (e.k === 'sqrt') return `sqrt(${canonicalExpression(e.a)})`
  if (e.k === 'add' || e.k === 'mul') {
    const operator = e.k
    const operands: CReal[] = []
    const collect = (value: CReal) => {
      if (value.k === 'add') {
        if (operator === 'add') { collect(value.a); collect(value.b); return }
      } else if (value.k === 'mul') {
        if (operator === 'mul') { collect(value.a); collect(value.b); return }
      }
      operands.push(value)
    }
    collect(e)
    return `${operator}(${operands.map(canonicalExpression).sort().join(',')})`
  }
  if (e.k === 'sub' || e.k === 'div') return `${e.k}(${canonicalExpression(e.a)},${canonicalExpression(e.b)})`
  throw new Error('canonicalExpression: unsupported expression')
}

const canonicalPoint = (point: P2) => `${canonicalExpression(point.x)},${canonicalExpression(point.y)}`
const canonicalSweep = (sweep: ArcSweep) => [
  sweep.cx.toString(), sweep.cy.toString(), sweep.r.toString(),
  canonicalPoint(sweep.from), canonicalPoint(sweep.to),
].join('|')

/**
 * Publish only a real arc-bearing integral. Pure rational/algebraic expressions use their own
 * §6.1 variants; an invalid directed enclosure refuses instead of becoming a certificate.
 */
export function publishCertifiedSum(sum: CertifiedSum): CertifiedExpressionReal | null {
  if (!sum.angles.length) return null
  const expression = [
    'certified-sum-v1',
    `exact:${canonicalExpression(sum.exact)}`,
    ...sum.angles.map(({ weight, sweep }) => `angle:${canonicalExpression(weight)}@${canonicalSweep(sweep)}`).sort(),
  ]
  const isolating = evaluateSum(sum, BigInt(128))
  return encodeCertifiedExpression({ expression, isolating: [isolating.lo, isolating.hi] })
}

export interface RegionIntegrals {
  /** certified signed area (units²): positive = counter-clockwise = island boundary */
  area: CertifiedSum
  /** certified first moments ∬x dA, ∬y dA (units³) */
  mx: CertifiedSum
  my: CertifiedSum
}

const sumOf = (exact: CReal): CertifiedSum => ({ exact, angles: [] })
const sumAdd = (a: CertifiedSum, b: CertifiedSum): CertifiedSum => ({
  exact: cAdd(a.exact, b.exact),
  angles: [...a.angles, ...b.angles],
})
const SUM_ZERO: CertifiedSum = { exact: cInt(0), angles: [] }

// R14 §7.3: reuse changes cost only. The memo can be switched off so the fixtures can prove that
// enclosures, comparisons and refusals are identical with it disabled.
let sumMemo = new WeakMap<object, Map<string, Interval>>()
let sumMemoOn = true

/** Neutral cache control for certified sums. Disabling it changes cost, never a value. */
export function certifiedSumMemo(enabled: boolean): void {
  sumMemoOn = enabled
  sumMemo = new WeakMap()
}

/** Enclose a certified sum at a given precision; refinable simply by asking for more bits. */
export function evaluateSum(sum: CertifiedSum, bits: bigint): Interval {
  if (!sumMemoOn) return evaluateSumUncached(sum, bits)
  const key = bits.toString()
  let table = sumMemo.get(sum)
  const hit = table?.get(key)
  if (hit) return hit
  const value = evaluateSumUncached(sum, bits)
  if (!table) { table = new Map(); sumMemo.set(sum, table) }
  table.set(key, value)
  return value
}

function evaluateSumUncached(sum: CertifiedSum, bits: bigint): Interval {
  let total = evaluate(sum.exact, bits)
  for (const { weight, sweep } of sum.angles) {
    const u1 = { x: cSub(sweep.from.x, cInt(sweep.cx)), y: cSub(sweep.from.y, cInt(sweep.cy)) }
    const u2 = { x: cSub(sweep.to.x, cInt(sweep.cx)), y: cSub(sweep.to.y, cInt(sweep.cy)) }
    const cross = cSub(cMul(u1.x, u2.y), cMul(u1.y, u2.x))
    const dot = cAdd(cMul(u1.x, u2.x), cMul(u1.y, u2.y))
    const theta = angleBetween(cross, dot, bits)
    if (!theta) return { lo: ratFromInt(1), hi: ratFromInt(0) } // empty: the caller reports unresolved
    const w = evaluate(weight, bits)
    const products = [ratMul(w.lo, theta.lo), ratMul(w.lo, theta.hi), ratMul(w.hi, theta.lo), ratMul(w.hi, theta.hi)]
    total = {
      lo: ratAdd(total.lo, products.reduce((m, x) => (compareExact(x, m) < 0 ? x : m))),
      hi: ratAdd(total.hi, products.reduce((m, x) => (compareExact(x, m) > 0 ? x : m))),
    }
  }
  return total
}

/** Structural identity of a certified expression: precision-free, and equal for equal structure. */
export function expressionKey(e: CReal): string {
  switch (e.k) {
    case 'rat': return `${e.v.n}/${e.v.d}`
    case 'neg': return `-(${expressionKey(e.a)})`
    case 'sqrt': return `sqrt(${expressionKey(e.a)})`
    default: return `${e.k}(${expressionKey(e.a)},${expressionKey(e.b)})`
  }
}

/** Structural identity of a certified sum, including every sweep it depends on. */
export function sumKey(sum: CertifiedSum): string {
  const angles = sum.angles
    .map(({ weight, sweep }) => `${expressionKey(weight)}@${sweep.cx},${sweep.cy},${sweep.r},${expressionKey(sweep.from.x)},${expressionKey(sweep.from.y)},${expressionKey(sweep.to.x)},${expressionKey(sweep.to.y)}`)
    .sort()
  return `${expressionKey(sum.exact)}|${angles.join('+')}`
}

export interface ExactRegion {
  readonly outer: OffsetLoop
  readonly holes: readonly OffsetLoop[]
  /**
   * The certified integrals themselves, kept symbolic in units: a comparison that does not separate
   * can be refined further, and the expression's identity does not move when the precision does.
   */
  readonly areaExpr: CertifiedSum
  readonly momentExpr: { x: CertifiedSum; y: CertifiedSum }
  /** certified area and centroid in mm / mm², enclosed at the reporting precision */
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

const BITS = BigInt(64)
const I = (lo: ExactRational, hi: ExactRational): Interval => ({ lo, hi })
const iAdd = (a: Interval, b: Interval): Interval => I(ratAdd(a.lo, b.lo), ratAdd(a.hi, b.hi))
const iSub = (a: Interval, b: Interval): Interval => I(ratSub(a.lo, b.hi), ratSub(a.hi, b.lo))
const iScale = (a: Interval, k: ExactRational): Interval => (ratSign(k) >= 0 ? I(ratMul(a.lo, k), ratMul(a.hi, k)) : I(ratMul(a.hi, k), ratMul(a.lo, k)))
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
    area: sumOf(half(crossPQ)),
    mx: sumOf(sixth(cMul(cSub(Q.y, P.y), sqSum(P.x, Q.x)))),
    my: sumOf(cNeg(sixth(cMul(cSub(Q.x, P.x), sqSum(P.y, Q.y))))),
  }
}

/**
 * Green's theorem terms for a circular arc P→Q about (cx, cy) of radius r, swept by the signed
 * angle Δθ (certified). With s = sin θ = (y−cy)/r and c = cos θ = (x−cx)/r at each endpoint:
 *   ½∮(x dy − y dx) = ½[ r²Δθ + cx(Qy−Py) − cy(Qx−Px) ]
 *   ∮ x²/2 dy = ½[ cx² r(s₂−s₁) + 2cx r²(Δθ/2 + (s₂c₂−s₁c₁)/2) + r³((s₂−s₁) − (s₂³−s₁³)/3) ]
 *   −∮ y²/2 dx = ½[ cy² r(−(c₂−c₁)) + 2cy r²(Δθ/2 − (s₂c₂−s₁c₁)/2) + r³(−(c₂−c₁) + (c₂³−c₁³)/3) ]
 */
function arcTerms(P: P2, Q: P2, cx: bigint, cy: bigint, r: bigint): RegionIntegrals {
  const C = { x: cInt(cx), y: cInt(cy) }
  const R = cInt(r)
  const u1 = { x: cSub(P.x, C.x), y: cSub(P.y, C.y) }, u2 = { x: cSub(Q.x, C.x), y: cSub(Q.y, C.y) }
  const s1 = cDiv(u1.y, R), c1 = cDiv(u1.x, R), s2 = cDiv(u2.y, R), c2 = cDiv(u2.x, R)
  const r2 = cMul(R, R), r3 = cMul(r2, R)
  const cube = (e: CReal) => cMul(e, cMul(e, e))
  const ds = cSub(s2, s1), dc = cSub(c2, c1)
  const dsc = cSub(cMul(s2, c2), cMul(s1, c1))
  const sweep: ArcSweep = { cx, cy, r, from: P, to: Q }
  // The sweep angle stays symbolic: an angle has no exact algebraic value, but it has an exact
  // identity and encloses to any precision, so the integral remains a certified expression.
  return {
    // area: ½ r² Δθ + ½[cx(Qy−Py) − cy(Qx−Px)]
    area: {
      exact: half(cSub(cMul(C.x, cSub(Q.y, P.y)), cMul(C.y, cSub(Q.x, P.x)))),
      angles: [{ weight: half(r2), sweep }],
    },
    mx: {
      exact: half(cAdd(cAdd(cMul(cMul(C.x, C.x), cMul(R, ds)), cMul(cMul(cInt(2), cMul(C.x, r2)), half(dsc))), cMul(r3, cSub(ds, third(cSub(cube(s2), cube(s1))))))),
      angles: [{ weight: half(cMul(C.x, r2)), sweep }],
    },
    my: {
      exact: half(cAdd(cAdd(cMul(cMul(C.y, C.y), cMul(R, cSub(cInt(0), dc))), cMul(cMul(cInt(2), cMul(C.y, r2)), cSub(cInt(0), half(dsc)))), cMul(r3, cAdd(cSub(cInt(0), dc), third(cSub(cube(c2), cube(c1))))))),
      angles: [{ weight: half(cMul(C.y, r2)), sweep }],
    },
  }
}

/** Signed integrals of one loop along its traversal. */
export function loopIntegrals(loop: OffsetLoop, r: bigint): RegionIntegrals {
  let area = SUM_ZERO, mx = SUM_ZERO, my = SUM_ZERO
  for (const op of loop.pieces) {
    const { from, to, arc } = traversed(op, r)
    const t = arc ? arcTerms(from, to, arc.cx, arc.cy, arc.r) : segmentTerms(from, to)
    area = sumAdd(area, t.area); mx = sumAdd(mx, t.mx); my = sumAdd(my, t.my)
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
    // orientation is a sign question, so it refines until it separates rather than accepting one
    // fixed precision — a loop whose sign is genuinely undecidable is reported, never assumed
    let sign = 0
    for (const bits of [BITS, BITS * BigInt(4), BITS * BigInt(16)]) {
      const enclosure = evaluateSum(l.integrals.area, bits)
      if (compareExact(enclosure.lo, enclosure.hi) > 0) break // empty: sweep on the branch cut
      sign = ratSign(enclosure.lo) > 0 ? 1 : ratSign(enclosure.hi) < 0 ? -1 : 0
      if (sign !== 0) break
    }
    if (sign === 0) { unresolved = true; reasons.push('loop orientation undecidable'); continue }
    ;(sign > 0 ? outers : holes).push(l)
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
    let areaExpr = o.integrals.area, mxExpr = o.integrals.mx, myExpr = o.integrals.my
    for (const h of mine) {
      areaExpr = sumAdd(areaExpr, h.integrals.area)
      mxExpr = sumAdd(mxExpr, h.integrals.mx)
      myExpr = sumAdd(myExpr, h.integrals.my)
    }
    const area = evaluateSum(areaExpr, BITS), mx = evaluateSum(mxExpr, BITS), my = evaluateSum(myExpr, BITS)
    const areaMM2 = I(ratDiv(area.lo, u2), ratDiv(area.hi, u2))
    // centroid = moment / area; area is certified strictly positive for an outer loop, moments may
    // have either sign — divide by all four endpoint quotients, then convert units³/units² → mm
    const perUnit = ratFromInt(unit)
    const cxU = iDivPos(mx, area), cyU = iDivPos(my, area)
    const cx = I(ratDiv(cxU.lo, perUnit), ratDiv(cxU.hi, perUnit)), cy = I(ratDiv(cyU.lo, perUnit), ratDiv(cyU.hi, perUnit))
    regions.push({
      outer: o.loop, holes: mine.map((h) => h.loop),
      areaExpr, momentExpr: { x: mxExpr, y: myExpr },
      areaMM2, centroidMM: { x: cx, y: cy },
      areaApproxMM2: (ratToNumber(areaMM2.lo) + ratToNumber(areaMM2.hi)) / 2,
      centroidApproxMM: [(ratToNumber(cx.lo) + ratToNumber(cx.hi)) / 2, (ratToNumber(cy.lo) + ratToNumber(cy.hi)) / 2],
    })
  }
  return { regions, unresolved, reasons }
}

/**
 * Exact comparison of two certified integrals.
 *
 * Structural key equality is not enough and never was: two expressions can denote the same value
 * while being written differently — the dumbbell's mirrored lobes have identical areas built from
 * different coordinates. What makes the comparison exact is that an angle's VALUE is decidable even
 * though the angle is transcendental: two sweeps subtend the same angle exactly when their
 * (cross, dot) pairs are proportional with matching signs, which is an algebraic test.
 *
 * So the difference is normalized by grouping its angle terms into provably-equal sweep classes and
 * summing the weights in each. Every class whose weight is exactly zero disappears — including all
 * of them, for two congruent regions — and what remains is either a purely algebraic value whose
 * sign is exact, or a genuine residue that is enclosed and refined instead.
 */
export function compareCertifiedSum(a: CertifiedSum, b: CertifiedSum): -1 | 0 | 1 | null {
  const difference: CertifiedSum = {
    exact: cSub(a.exact, b.exact),
    angles: [...a.angles, ...b.angles.map(({ weight, sweep }) => ({ weight: cNeg(weight), sweep }))],
  }
  // group by provably equal sweep angle
  const classes: Array<{ sweep: ArcSweep; weight: CReal }> = []
  for (const term of difference.angles) {
    // Every class is examined before giving up: an undecidable comparison against one class must
    // not pre-empt a PROVEN match against another, or the verdict would depend on the order the
    // terms happened to arrive in. Only when nothing matches and something was undecidable is the
    // grouping genuinely unresolved.
    let target = -1
    let undecided = false
    for (let index = 0; index < classes.length; index++) {
      const same = sweepsAgree(classes[index].sweep, term.sweep)
      if (same === null) { undecided = true; continue }
      if (same) { target = index; break }
    }
    if (target >= 0) classes[target].weight = cAdd(classes[target].weight, term.weight)
    else if (undecided) return null
    else classes.push({ sweep: term.sweep, weight: term.weight })
  }
  const residue = classes.filter((entry) => signOf(entry.weight) !== 0)
  if (residue.some((entry) => signOf(entry.weight) === null)) return null
  // every angle cancelled: the difference is algebraic and its sign is exact
  if (!residue.length) return signOf(difference.exact)
  // otherwise refine the enclosure of what is left; equality here is not provable, only refuted
  const remaining: CertifiedSum = { exact: difference.exact, angles: residue.map((entry) => ({ weight: entry.weight, sweep: entry.sweep })) }
  for (const bits of [BITS, BITS * BigInt(4), BITS * BigInt(16)]) {
    const enclosure = evaluateSum(remaining, bits)
    if (compareExact(enclosure.lo, enclosure.hi) > 0) return null
    if (ratSign(enclosure.lo) > 0) return 1
    if (ratSign(enclosure.hi) < 0) return -1
  }
  return null
}

/** Do two sweeps subtend exactly the same signed angle? Decided by exact algebra, never by value. */
function sweepsAgree(a: ArcSweep, b: ArcSweep): boolean | null {
  const parts = (sweep: ArcSweep) => {
    const u1 = { x: cSub(sweep.from.x, cInt(sweep.cx)), y: cSub(sweep.from.y, cInt(sweep.cy)) }
    const u2 = { x: cSub(sweep.to.x, cInt(sweep.cx)), y: cSub(sweep.to.y, cInt(sweep.cy)) }
    return {
      cross: cSub(cMul(u1.x, u2.y), cMul(u1.y, u2.x)),
      dot: cAdd(cMul(u1.x, u2.x), cMul(u1.y, u2.y)),
    }
  }
  const first = parts(a), second = parts(b)
  // atan2(c1,d1) = atan2(c2,d2) ⟺ c1·d2 = c2·d1 with the same quadrant, i.e. matching signs
  const crossProduct = signOf(cSub(cMul(first.cross, second.dot), cMul(second.cross, first.dot)))
  if (crossProduct === null) return null
  if (crossProduct !== 0) return false
  const crossSigns = [signOf(first.cross), signOf(second.cross)]
  const dotSigns = [signOf(first.dot), signOf(second.dot)]
  if (crossSigns.some((sign) => sign === null) || dotSigns.some((sign) => sign === null)) return null
  return crossSigns[0] === crossSigns[1] && dotSigns[0] === dotSigns[1]
}

/**
 * Canonical identity of one loop: the ORDERED cycle of its traversed pieces, each described by its
 * generator, its exact endpoints and the direction it is traversed in, then normalized by rotation
 * so the same cycle identifies the same however it was entered.
 *
 * A set of generating features is NOT enough — two different surviving regions can be built from the
 * same generators, and deduplicating them also discards piece domains, traversal direction, arc
 * sweeps and loop connectivity. Everything that distinguishes one region from another is kept here.
 */
function loopIdentity(loop: OffsetLoop, r: bigint): string {
  const pieces = loop.pieces.map((op) => {
    const { from, to, arc } = traversed(op, r)
    const element = op.piece.elem
    const generator = element.kind === 'seg'
      ? `s:${element.feat.ax},${element.feat.ay}|${element.feat.bx},${element.feat.by}`
      : `a:${element.cx},${element.cy},${r}`
    const span = `${expressionKey(from.x)},${expressionKey(from.y)}>${expressionKey(to.x)},${expressionKey(to.y)}`
    return `${generator}#${span}#${arc ? 'arc' : 'seg'}${op.reversed ? '-' : '+'}`
  })
  if (!pieces.length) return ''
  // rotation-normalized: the cycle is the same object however it was entered
  let best: string | null = null
  for (let start = 0; start < pieces.length; start++) {
    const rotation = [...pieces.slice(start), ...pieces.slice(0, start)].join(';')
    if (best === null || rotation < best) best = rotation
  }
  return best!
}

/**
 * Canonical identity of a region: its outer cycle, its holes' cycles sorted among themselves, and
 * the identities of its certified integrals. Two regions identify alike exactly when they are the
 * same region, whatever order their input arrived in.
 */
export function regionIdentity(region: ExactRegion, r: bigint): string {
  const holes = region.holes.map((hole) => loopIdentity(hole, r)).sort()
  return [
    `outer:${loopIdentity(region.outer, r)}`,
    `holes:${holes.join('|')}`,
    `area:${sumKey(region.areaExpr)}`,
    `mx:${sumKey(region.momentExpr.x)}`,
    `my:${sumKey(region.momentExpr.y)}`,
  ].join('~')
}
