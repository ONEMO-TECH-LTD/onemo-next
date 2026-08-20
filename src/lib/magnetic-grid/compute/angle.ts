// Neutral certified angles (R14 §7.1b item 4: arc integrals are CertifiedExpressionReal values
// evaluated by BigInt interval arithmetic). atan is an alternating series whose remainder is
// bounded by its first omitted term; π comes from Machin's formula with the same bound. Every
// bound is rounded outward on a dyadic grid — no float enters.

import type { ExactRational } from './exact-real'
import { compareExact, ratAdd, ratDiv, ratFromInt, ratMul, ratSign, ratSub, rational } from './exact-real'
import { evaluate, type CReal, type Interval } from './certified-real'

const floorD = (r: ExactRational, bits: bigint): ExactRational => {
  const s = BigInt(1) << bits
  let q = (r.n * s) / r.d
  if (r.n < BigInt(0) && (r.n * s) % r.d !== BigInt(0)) q -= BigInt(1)
  return rational(q, s)
}
const ceilD = (r: ExactRational, bits: bigint): ExactRational => {
  const s = BigInt(1) << bits
  let q = (r.n * s) / r.d
  if (r.n > BigInt(0) && (r.n * s) % r.d !== BigInt(0)) q += BigInt(1)
  return rational(q, s)
}
const out = (lo: ExactRational, hi: ExactRational, bits: bigint): Interval => ({ lo: floorD(lo, bits), hi: ceilD(hi, bits) })

/**
 * atan of an exact rational with 0 ≤ x ≤ 1, enclosed to `bits` precision, by Euler's series
 *   atan(x) = Σ_k  [2^(2k) (k!)² / (2k+1)!] · x^(2k+1) / (1+x²)^(k+1)
 * All terms are positive and the ratio of consecutive terms is (2k/(2k+1))·q ≤ q with
 * q = x²/(1+x²) ≤ 1/2, so the tail after term k is at most term_k · q/(1−q). Exact rationals
 * throughout; only the final bounds are rounded, outward.
 */
function atanSmall(x: ExactRational, bits: bigint): Interval {
  if (ratSign(x) === 0) return { lo: ratFromInt(0), hi: ratFromInt(0) }
  const x2 = ratMul(x, x)
  const onePlus = ratAdd(ratFromInt(1), x2)
  const q = ratDiv(x2, onePlus)
  const tailFactor = ratDiv(q, ratSub(ratFromInt(1), q))
  let term = ratDiv(x, onePlus) // k = 0
  let sum = term
  const target = rational(BigInt(1), BigInt(1) << (bits + BigInt(4)))
  for (let k = 1; k < 100000; k++) {
    // term_k = term_{k−1} · (2k / (2k+1)) · q
    term = ratMul(term, ratMul(rational(BigInt(2 * k), BigInt(2 * k + 1)), q))
    sum = ratAdd(sum, term)
    const tail = ratMul(term, tailFactor)
    if (compareExact(tail, target) < 0) return out(sum, ratAdd(sum, tail), bits)
  }
  throw new Error('atanSmall: did not converge')
}

/** π by Machin: π = 16·atan(1/5) − 4·atan(1/239). */
export function piInterval(bits: bigint): Interval {
  const a = atanSmall(rational(BigInt(1), BigInt(5)), bits + BigInt(6))
  const b = atanSmall(rational(BigInt(1), BigInt(239)), bits + BigInt(6))
  const lo = ratSub(ratMul(ratFromInt(16), a.lo), ratMul(ratFromInt(4), b.hi))
  const hi = ratSub(ratMul(ratFromInt(16), a.hi), ratMul(ratFromInt(4), b.lo))
  return out(lo, hi, bits)
}

/** atan of an exact rational of any magnitude. */
export function atanInterval(x: ExactRational, bits: bigint): Interval {
  const s = ratSign(x)
  if (s === 0) return { lo: ratFromInt(0), hi: ratFromInt(0) }
  const ax = s < 0 ? { n: -x.n, d: x.d } : x
  let r: Interval
  if (compareExact(ax, ratFromInt(1)) <= 0) r = atanSmall(ax, bits)
  else {
    // atan(x) = π/2 − atan(1/x) for x > 0
    const pi = piInterval(bits + BigInt(2))
    const inner = atanSmall(ratDiv(ratFromInt(1), ax), bits + BigInt(2))
    r = out(ratSub(ratDiv(pi.lo, ratFromInt(2)), inner.hi), ratSub(ratDiv(pi.hi, ratFromInt(2)), inner.lo), bits)
  }
  return s < 0 ? { lo: { n: -r.hi.n, d: r.hi.d }, hi: { n: -r.lo.n, d: r.lo.d } } : r
}

/**
 * Enclosure of the signed angle from direction u to direction v, in (−π, π], given the exact
 * (certified) cross and dot products of the two directions. Angle = atan2(cross, dot).
 */
export function angleBetween(cross: CReal, dot: CReal, bits: bigint): Interval | null {
  const c = evaluate(cross, bits + BigInt(8)), d = evaluate(dot, bits + BigInt(8))
  const pi = piInterval(bits + BigInt(2))
  const half = (i: Interval): Interval => ({ lo: ratDiv(i.lo, ratFromInt(2)), hi: ratDiv(i.hi, ratFromInt(2)) })
  // dot strictly positive: atan(cross/dot), monotone in cross and in 1/dot — enclose by corners
  if (ratSign(d.lo) > 0) {
    const q = [ratDiv(c.lo, d.lo), ratDiv(c.lo, d.hi), ratDiv(c.hi, d.lo), ratDiv(c.hi, d.hi)]
    const lo = q.reduce((m, x) => (compareExact(x, m) < 0 ? x : m)), hi = q.reduce((m, x) => (compareExact(x, m) > 0 ? x : m))
    return out(atanInterval(lo, bits).lo, atanInterval(hi, bits).hi, bits)
  }
  // cross strictly positive: π/2 − atan(dot/cross)
  if (ratSign(c.lo) > 0) {
    const q = [ratDiv(d.lo, c.lo), ratDiv(d.lo, c.hi), ratDiv(d.hi, c.lo), ratDiv(d.hi, c.hi)]
    const lo = q.reduce((m, x) => (compareExact(x, m) < 0 ? x : m)), hi = q.reduce((m, x) => (compareExact(x, m) > 0 ? x : m))
    const h = half(pi)
    return out(ratSub(h.lo, atanInterval(hi, bits).hi), ratSub(h.hi, atanInterval(lo, bits).lo), bits)
  }
  // cross strictly negative: −π/2 − atan(dot/cross)  (cross < 0 so dot/cross flips sign)
  if (ratSign(c.hi) < 0) {
    const q = [ratDiv(d.lo, c.lo), ratDiv(d.lo, c.hi), ratDiv(d.hi, c.lo), ratDiv(d.hi, c.hi)]
    const lo = q.reduce((m, x) => (compareExact(x, m) < 0 ? x : m)), hi = q.reduce((m, x) => (compareExact(x, m) > 0 ? x : m))
    const h = half(pi)
    return out(ratSub({ n: -h.hi.n, d: h.hi.d }, atanInterval(hi, bits).hi), ratSub({ n: -h.lo.n, d: h.lo.d }, atanInterval(lo, bits).lo), bits)
  }
  // dot ≤ 0 with cross straddling zero: the angle is near ±π and the branch cut — undecidable here
  return null
}
