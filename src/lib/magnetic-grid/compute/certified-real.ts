// Neutral certified reals (R14 §7.1b item 4: "CertifiedExpressionReal, evaluated by
// deterministic BigInt interval arithmetic with directed bounds"). A value is an exact expression
// over rationals; evaluation at a precision yields a dyadic interval proven to contain it.
// Ordering decisions succeed when intervals separate and refine on demand; a rational-only
// expression decides exactly; an expression the bounds cannot separate is reported undecided —
// never rounded into a verdict.

import type { Rational } from '../spec'
import { compareExact, isqrt, ratFromInt, ratSign, rational, sqrtInterval } from './exact-real'

export type CReal =
  | { readonly k: 'rat'; readonly v: Rational }
  | { readonly k: 'add' | 'sub' | 'mul' | 'div'; readonly a: CReal; readonly b: CReal }
  | { readonly k: 'neg' | 'sqrt'; readonly a: CReal }

export interface Interval { readonly lo: Rational; readonly hi: Rational }

export const cRat = (v: Rational): CReal => ({ k: 'rat', v })
export const cInt = (v: bigint | number): CReal => cRat(ratFromInt(v))
export const cAdd = (a: CReal, b: CReal): CReal => ({ k: 'add', a, b })
export const cSub = (a: CReal, b: CReal): CReal => ({ k: 'sub', a, b })
export const cMul = (a: CReal, b: CReal): CReal => ({ k: 'mul', a, b })
export const cDiv = (a: CReal, b: CReal): CReal => ({ k: 'div', a, b })
export const cNeg = (a: CReal): CReal => ({ k: 'neg', a })
/** Square root — stays exact when the operand is a rational perfect square (axis-aligned and
 *  Pythagorean edge lengths), so tangencies between such elements decide exactly. */
export const cSqrt = (a: CReal): CReal => {
  if (isRationalExpr(a)) {
    const v = exactRational(a)
    if (v.n >= 0n) {
      const rn = isqrt(v.n), rd = isqrt(v.d)
      if (rn * rn === v.n && rd * rd === v.d) return cRat(rational(rn, rd))
    }
  }
  return { k: 'sqrt', a }
}

export function isRationalExpr(e: CReal): boolean {
  if (e.k === 'rat') return true
  if (e.k === 'neg') return isRationalExpr(e.a)
  if (e.k === 'sqrt') return false
  return isRationalExpr(e.a) && isRationalExpr(e.b)
}

/** Exact value of a rational-only expression. */
export function exactRational(e: CReal): Rational {
  switch (e.k) {
    case 'rat': return e.v
    case 'neg': { const v = exactRational(e.a); return { n: -v.n, d: v.d } }
    case 'sqrt': throw new Error('exactRational: sqrt is not rational')
    default: {
      const a = exactRational(e.a), b = exactRational(e.b)
      if (e.k === 'add') return rational(a.n * b.d + b.n * a.d, a.d * b.d)
      if (e.k === 'sub') return rational(a.n * b.d - b.n * a.d, a.d * b.d)
      if (e.k === 'mul') return rational(a.n * b.n, a.d * b.d)
      return rational(a.n * b.d, a.d * b.n)
    }
  }
}

// Directed rounding to the dyadic grid 2^-bits: lower bound floors, upper bound ceils.
const floorDyadic = (r: Rational, bits: bigint): Rational => {
  const scale = 1n << bits
  let q = (r.n * scale) / r.d
  if (r.n < 0n && (r.n * scale) % r.d !== 0n) q -= 1n
  return rational(q, scale)
}
const ceilDyadic = (r: Rational, bits: bigint): Rational => {
  const scale = 1n << bits
  let q = (r.n * scale) / r.d
  if (r.n > 0n && (r.n * scale) % r.d !== 0n) q += 1n
  return rational(q, scale)
}
const iv = (lo: Rational, hi: Rational, bits: bigint): Interval => ({ lo: floorDyadic(lo, bits), hi: ceilDyadic(hi, bits) })
const add = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d)
const sub = (a: Rational, b: Rational) => rational(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d)
const div = (a: Rational, b: Rational) => rational(a.n * b.d, a.d * b.n)
const minR = (...xs: Rational[]) => xs.reduce((m, x) => (compareExact(x, m) < 0 ? x : m))
const maxR = (...xs: Rational[]) => xs.reduce((m, x) => (compareExact(x, m) > 0 ? x : m))

/** Certified enclosure of the expression at `bits` of dyadic precision. A rational-only
 *  expression is returned exactly, zero-width — rounding is only for radicals. */
export function evaluate(e: CReal, bits: bigint): Interval {
  if (e.k !== 'rat' && isRationalExpr(e)) { const v = exactRational(e); return { lo: v, hi: v } }
  switch (e.k) {
    case 'rat': return { lo: e.v, hi: e.v }
    case 'neg': { const a = evaluate(e.a, bits); return { lo: { n: -a.hi.n, d: a.hi.d }, hi: { n: -a.lo.n, d: a.lo.d } } }
    case 'sqrt': {
      const a = evaluate(e.a, bits)
      if (ratSign(a.hi) < 0) throw new Error('evaluate: sqrt of a negative enclosure')
      const lo = ratSign(a.lo) < 0 ? ratFromInt(0) : sqrtInterval(a.lo, 1n << bits).lo
      const hi = sqrtInterval(a.hi, 1n << bits).hi
      return iv(lo, hi, bits)
    }
    default: {
      const a = evaluate(e.a, bits), b = evaluate(e.b, bits)
      if (e.k === 'add') return iv(add(a.lo, b.lo), add(a.hi, b.hi), bits)
      if (e.k === 'sub') return iv(sub(a.lo, b.hi), sub(a.hi, b.lo), bits)
      if (e.k === 'mul') {
        const p = [mul(a.lo, b.lo), mul(a.lo, b.hi), mul(a.hi, b.lo), mul(a.hi, b.hi)]
        return iv(minR(...p), maxR(...p), bits)
      }
      if (ratSign(b.lo) <= 0 && ratSign(b.hi) >= 0) throw new Error('evaluate: division by an enclosure containing zero')
      const q = [div(a.lo, b.lo), div(a.lo, b.hi), div(a.hi, b.lo), div(a.hi, b.hi)]
      return iv(minR(...q), maxR(...q), bits)
    }
  }
}

const PRECISIONS = [64n, 128n, 256n, 512n, 1024n]

/** A value in one quadratic field: a + b·√k with a, b rational and k a positive integer. */
export interface Quadratic { readonly a: Rational; readonly b: Rational; readonly k: bigint }

const qAdd = (x: Rational, y: Rational) => rational(x.n * y.d + y.n * x.d, x.d * y.d)
const qSub = (x: Rational, y: Rational) => rational(x.n * y.d - y.n * x.d, x.d * y.d)
const qMul = (x: Rational, y: Rational) => rational(x.n * y.n, x.d * y.d)
const qDiv = (x: Rational, y: Rational) => rational(x.n * y.d, x.d * y.n)
const qZero = ratFromInt(0)
const sameField = (p: Quadratic, q: Quadratic): bigint | null =>
  p.b.n === 0n ? q.k : q.b.n === 0n ? p.k : p.k === q.k ? p.k : null

/**
 * Exact normal form when the expression lives in a single quadratic field (at most one distinct
 * square root). Nested or mixed radicals return null and fall back to certified enclosures.
 */
export function asQuadratic(e: CReal): Quadratic | null {
  switch (e.k) {
    case 'rat': return { a: e.v, b: qZero, k: 1n }
    case 'neg': { const q = asQuadratic(e.a); return q && { a: { n: -q.a.n, d: q.a.d }, b: { n: -q.b.n, d: q.b.d }, k: q.k } }
    case 'sqrt': {
      const q = asQuadratic(e.a)
      if (!q || q.b.n !== 0n || q.a.n < 0n) return null
      // √(n/d) = √(n·d) / d
      const rad = q.a.n * q.a.d
      const root = isqrt(rad)
      if (root * root === rad) return { a: rational(root, q.a.d), b: qZero, k: 1n }
      return { a: qZero, b: rational(1n, q.a.d), k: rad }
    }
    default: {
      const p = asQuadratic(e.a), q = asQuadratic(e.b)
      if (!p || !q) return null
      const k = sameField(p, q)
      if (k === null) return null
      if (e.k === 'add') return { a: qAdd(p.a, q.a), b: qAdd(p.b, q.b), k }
      if (e.k === 'sub') return { a: qSub(p.a, q.a), b: qSub(p.b, q.b), k }
      if (e.k === 'mul') return { a: qAdd(qMul(p.a, q.a), qMul(qMul(p.b, q.b), ratFromInt(k))), b: qAdd(qMul(p.a, q.b), qMul(p.b, q.a)), k }
      // division: multiply by the conjugate; denominator a² − b²k is rational and non-zero unless q = 0
      const den = qSub(qMul(q.a, q.a), qMul(qMul(q.b, q.b), ratFromInt(k)))
      if (den.n === 0n) return null
      const num = { a: qSub(qMul(p.a, q.a), qMul(qMul(p.b, q.b), ratFromInt(k))), b: qSub(qMul(p.b, q.a), qMul(p.a, q.b)) }
      return { a: qDiv(num.a, den), b: qDiv(num.b, den), k }
    }
  }
}

/** Exact sign of a + b√k. */
export function quadraticSign(q: Quadratic): -1 | 0 | 1 {
  const sa = ratSign(q.a), sb = ratSign(q.b)
  if (sb === 0) return sa
  if (sa === 0) return sb
  if (sa === sb) return sa
  // opposite signs: compare a² against b²·k
  const c = compareExact(qMul(q.a, q.a), qMul(qMul(q.b, q.b), ratFromInt(q.k)))
  return c > 0 ? sa : c < 0 ? sb : 0
}

/**
 * Sign of an expression: exact for rational and single-radical expressions; otherwise decided by
 * refining enclosures until they exclude zero. `null` means the bounds could not separate within
 * the precision ladder — the caller must report unresolved, never pick a side.
 */
export function signOf(e: CReal): -1 | 0 | 1 | null {
  const q = asQuadratic(e)
  if (q) return quadraticSign(q)
  for (const bits of PRECISIONS) {
    const { lo, hi } = evaluate(e, bits)
    if (ratSign(lo) > 0) return 1
    if (ratSign(hi) < 0) return -1
  }
  return null
}

/** Three-way comparison through signOf(a − b). */
export const compareCReal = (a: CReal, b: CReal): -1 | 0 | 1 | null => signOf(cSub(a, b))

/** Report-only decimal from a 64-bit enclosure midpoint. */
export function approx(e: CReal): number {
  const { lo, hi } = evaluate(e, 64n)
  return (Number(lo.n) / Number(lo.d) + Number(hi.n) / Number(hi.d)) / 2
}
