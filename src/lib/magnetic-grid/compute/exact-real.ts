// Neutral exact arithmetic. Rationals over BigInt; no float ever decides a comparison.
// Supplied float coordinates convert losslessly via their IEEE-754 bit pattern (R14 §7.1).

import type { Rational } from '../spec'

const ZERO = 0n
const ONE = 1n

const babs = (v: bigint): bigint => (v < ZERO ? -v : v)

const gcd = (a: bigint, b: bigint): bigint => {
  let x = babs(a), y = babs(b)
  while (y !== ZERO) { const t = x % y; x = y; y = t }
  return x === ZERO ? ONE : x
}

/** Normalized rational: denominator positive, terms coprime. */
export function rational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === ZERO) throw new Error('rational: zero denominator')
  const sign = denominator < ZERO ? -ONE : ONE
  const n = numerator * sign
  const d = denominator * sign
  const g = gcd(n, d)
  return { n: n / g, d: d / g }
}

export const ratFromInt = (v: bigint | number): Rational => rational(BigInt(v), ONE)

/** Exact conversion of a finite JS number via its IEEE-754 bits — no rounding, no quantum. */
export function ratFromNumber(value: number): Rational {
  if (!Number.isFinite(value)) throw new Error('ratFromNumber: non-finite input')
  if (Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) return ratFromInt(value)
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  const bits = view.getBigUint64(0)
  const sign = bits >> 63n === ONE ? -ONE : ONE
  const exponent = Number((bits >> 52n) & 0x7ffn)
  const fraction = bits & 0xfffffffffffffn
  // subnormal: value = ±fraction × 2^-1074 · normal: ±(2^52+fraction) × 2^(exponent-1075)
  const mantissa = exponent === 0 ? fraction : (ONE << 52n) | fraction
  const shift = exponent === 0 ? -1074 : exponent - 1075
  return shift >= 0
    ? rational(sign * mantissa * (ONE << BigInt(shift)), ONE)
    : rational(sign * mantissa, ONE << BigInt(-shift))
}

export const ratAdd = (a: Rational, b: Rational): Rational => rational(a.n * b.d + b.n * a.d, a.d * b.d)
export const ratSub = (a: Rational, b: Rational): Rational => rational(a.n * b.d - b.n * a.d, a.d * b.d)
export const ratMul = (a: Rational, b: Rational): Rational => rational(a.n * b.n, a.d * b.d)
export const ratDiv = (a: Rational, b: Rational): Rational => rational(a.n * b.d, a.d * b.n)
export const ratNeg = (a: Rational): Rational => ({ n: -a.n, d: a.d })
export const ratSq = (a: Rational): Rational => rational(a.n * a.n, a.d * a.d)

/** Exact three-way comparison — the only ordering the law layer may consume. */
export function compareExact(a: Rational, b: Rational): -1 | 0 | 1 {
  const left = a.n * b.d
  const right = b.n * a.d
  return left < right ? -1 : left > right ? 1 : 0
}

export const ratSign = (a: Rational): -1 | 0 | 1 => (a.n < ZERO ? -1 : a.n > ZERO ? 1 : 0)
export const ratMin = (a: Rational, b: Rational): Rational => (compareExact(a, b) <= 0 ? a : b)
export const ratMax = (a: Rational, b: Rational): Rational => (compareExact(a, b) >= 0 ? a : b)

/** Report-only decimal — never enters a verdict. */
export const ratToNumber = (a: Rational): number => Number(a.n) / Number(a.d)

/** Floor integer square root. */
export const isqrt = (v: bigint): bigint => {
  if (v < ZERO) throw new Error('isqrt: negative')
  if (v < 2n) return v
  let x = ONE << BigInt(Math.ceil(v.toString(2).length / 2))
  for (;;) {
    const step = (x + v / x) >> 1n
    if (step >= x) return x
    x = step
  }
}

/**
 * Certified enclosure of √q: rational [lo, hi] with lo² ≤ q ≤ hi², width ≤ 1/scale.
 * Directed integer square roots on a scaled numerator — never a float path.
 */
export function sqrtInterval(q: Rational, scale: bigint = 1_000_000_000_000n): { lo: Rational; hi: Rational } {
  if (ratSign(q) < 0) throw new Error('sqrtInterval: negative operand')
  if (q.n === ZERO) return { lo: ratFromInt(0), hi: ratFromInt(0) }
  // √(n/d) = √(n·d)/d — one integer radicand, scaled for precision.
  const radicand = q.n * q.d * scale * scale
  const root = isqrt(radicand)
  const lo = rational(root, q.d * scale)
  const exact = root * root === radicand
  const hi = exact ? lo : rational(root + ONE, q.d * scale)
  return { lo, hi }
}
