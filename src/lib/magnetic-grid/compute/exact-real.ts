// Neutral exact arithmetic. Rationals over BigInt; no float ever decides a comparison.
// Supplied float coordinates convert losslessly via their IEEE-754 bit pattern (R14 §7.1).

/**
 * The compute-internal exact rational: BigInt terms, normalized here. §6.2 gives `exact-real.ts`
 * ownership of "rational/algebraic values and comparisons", and it is deliberately NOT the public
 * `ExactRational` of §6.1 — that one carries decimal-string integers because its stated purpose is that
 * "Node/browser/worker/cache bytes agree" (§6.1) and §6.4 canonicalizes identity the same way.
 * Arithmetic stays in BigInt; conversion happens at that boundary.
 */
export interface ExactRational { readonly n: bigint; readonly d: bigint }
export interface ExactPointValue { readonly x: ExactRational; readonly y: ExactRational }
export interface Bounds { readonly lo: ExactRational; readonly hi: ExactRational }

const ZERO = BigInt(0)
const ONE = BigInt(1)

const babs = (v: bigint): bigint => (v < ZERO ? -v : v)

const gcd = (a: bigint, b: bigint): bigint => {
  let x = babs(a), y = babs(b)
  while (y !== ZERO) { const t = x % y; x = y; y = t }
  return x === ZERO ? ONE : x
}

/** Normalized rational: denominator positive, terms coprime. */
export function rational(numerator: bigint, denominator: bigint): ExactRational {
  if (denominator === ZERO) throw new Error('rational: zero denominator')
  const sign = denominator < ZERO ? -ONE : ONE
  const n = numerator * sign
  const d = denominator * sign
  const g = gcd(n, d)
  return { n: n / g, d: d / g }
}

export const ratFromInt = (v: bigint | number): ExactRational => rational(BigInt(v), ONE)

/** Exact conversion of a finite JS number via its IEEE-754 bits — no rounding, no quantum. */
export function ratFromNumber(value: number): ExactRational {
  if (!Number.isFinite(value)) throw new Error('ratFromNumber: non-finite input')
  if (Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) return ratFromInt(value)
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  const bits = view.getBigUint64(0)
  const sign = bits >> BigInt(63) === ONE ? -ONE : ONE
  const exponent = Number((bits >> BigInt(52)) & BigInt('0x7ff'))
  const fraction = bits & BigInt('0xfffffffffffff')
  // subnormal: value = ±fraction × 2^-1074 · normal: ±(2^52+fraction) × 2^(exponent-1075)
  const mantissa = exponent === 0 ? fraction : (ONE << BigInt(52)) | fraction
  const shift = exponent === 0 ? -1074 : exponent - 1075
  return shift >= 0
    ? rational(sign * mantissa * (ONE << BigInt(shift)), ONE)
    : rational(sign * mantissa, ONE << BigInt(-shift))
}

export const ratAdd = (a: ExactRational, b: ExactRational): ExactRational => rational(a.n * b.d + b.n * a.d, a.d * b.d)
export const ratSub = (a: ExactRational, b: ExactRational): ExactRational => rational(a.n * b.d - b.n * a.d, a.d * b.d)
export const ratMul = (a: ExactRational, b: ExactRational): ExactRational => rational(a.n * b.n, a.d * b.d)
export const ratDiv = (a: ExactRational, b: ExactRational): ExactRational => rational(a.n * b.d, a.d * b.n)
export const ratNeg = (a: ExactRational): ExactRational => ({ n: -a.n, d: a.d })
export const ratSq = (a: ExactRational): ExactRational => rational(a.n * a.n, a.d * a.d)

/** Exact three-way comparison — the only ordering the law layer may consume. */
export function compareExact(a: ExactRational, b: ExactRational): -1 | 0 | 1 {
  const left = a.n * b.d
  const right = b.n * a.d
  return left < right ? -1 : left > right ? 1 : 0
}

export const ratSign = (a: ExactRational): -1 | 0 | 1 => (a.n < ZERO ? -1 : a.n > ZERO ? 1 : 0)
export const ratMin = (a: ExactRational, b: ExactRational): ExactRational => (compareExact(a, b) <= 0 ? a : b)
export const ratMax = (a: ExactRational, b: ExactRational): ExactRational => (compareExact(a, b) >= 0 ? a : b)

/** Report-only decimal — never enters a verdict. */
export const ratToNumber = (a: ExactRational): number => Number(a.n) / Number(a.d)

/** Floor integer square root. */
export const isqrt = (v: bigint): bigint => {
  if (v < ZERO) throw new Error('isqrt: negative')
  if (v < BigInt(2)) return v
  let x = ONE << BigInt(Math.ceil(v.toString(2).length / 2))
  for (;;) {
    const step = (x + v / x) >> BigInt(1)
    if (step >= x) return x
    x = step
  }
}

/**
 * Certified enclosure of √q: rational [lo, hi] with lo² ≤ q ≤ hi², width ≤ 1/scale.
 * Directed integer square roots on a scaled numerator — never a float path.
 */
const DEFAULT_SQRT_SCALE = BigInt('1000000000000')
export function sqrtInterval(q: ExactRational, scale: bigint = DEFAULT_SQRT_SCALE): { lo: ExactRational; hi: ExactRational } {
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
