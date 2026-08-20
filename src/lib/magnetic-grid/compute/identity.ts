// §6.2: "identity.ts owns canonical serialization."
//
// This is the boundary between the BigInt arithmetic compute works in (§6.2, and the "deterministic
// BigInt interval arithmetic" §7.1b.4 assumes) and the decimal-string form §6.1 declares, whose
// stated purpose is that "Node/browser/worker/cache bytes agree" — the same form §6.4 canonicalizes
// identity with.
//
// Only values that are EXACTLY representable in the target form are converted here. A certified
// enclosure is not a rational and does not become one; it needs its own certificate, which is a
// later conversion family with its own proof.

import type { AlgebraicReal, Rational } from '../spec'
import { isqrt, ratFromInt, rational, sqrtInterval, type ExactRational } from './exact-real'

/** §6.1 `Rational` — decimal-string integers, normalized, lossless in both directions. */
export function encodeRational(value: ExactRational): Rational {
  return { numerator: value.n.toString(), denominator: value.d.toString() }
}

/** The inverse. Round-tripping any exact rational returns the identical value. */
export function decodeRational(value: Rational): ExactRational {
  return rational(BigInt(value.numerator), BigInt(value.denominator))
}

/** The exact single-quadratic-field source already produced by `asQuadratic`. */
export interface QuadraticSource {
  readonly a: ExactRational
  readonly b: ExactRational
  readonly k: bigint
}

const abs = (value: bigint) => (value < BigInt(0) ? -value : value)
const gcd = (a: bigint, b: bigint): bigint => {
  let x = abs(a), y = abs(b)
  while (y !== BigInt(0)) { const remainder = x % y; x = y; y = remainder }
  return x === BigInt(0) ? BigInt(1) : x
}
const lcm = (a: bigint, b: bigint) => abs(a / gcd(a, b) * b)

/**
 * §6.1 `AlgebraicReal` for one exact quadratic field.
 *
 * For x = a + b√k, the defining polynomial is (x-a)²-b²k. Coefficients are
 * cleared to primitive integers. The isolating interval is derived from directed
 * √k bounds and must lie strictly on one side of a, which excludes the conjugate.
 * A rational value or a source outside this exact representation is not promoted.
 */
export function encodeQuadraticAlgebraic(source: QuadraticSource): AlgebraicReal | null {
  const { a, b, k } = source
  if (b.n === BigInt(0) || k <= BigInt(0)) return null
  const squareRoot = isqrt(k)
  if (squareRoot * squareRoot === k) return null

  const c2 = ratFromInt(1)
  const c1 = rational(-BigInt(2) * a.n, a.d)
  const c0 = rational(a.n * a.n * b.d * b.d - b.n * b.n * k * a.d * a.d, a.d * a.d * b.d * b.d)
  const denominator = lcm(lcm(c0.d, c1.d), c2.d)
  let coefficients = [c0.n * (denominator / c0.d), c1.n * (denominator / c1.d), c2.n * (denominator / c2.d)]
  const common = coefficients.reduce((factor, value) => gcd(factor, value), BigInt(0))
  coefficients = coefficients.map((value) => value / common)
  if (coefficients[2] < BigInt(0)) coefficients = coefficients.map((value) => -value)

  // Isolate from the primitive polynomial, not from the source expression. Equivalent
  // representations (√2 and √8/2) must therefore publish identical bounds as well as coefficients.
  const [C, B, A] = coefficients
  const discriminant = B * B - BigInt(4) * A * C
  if (discriminant <= BigInt(0)) return null
  const root = sqrtInterval(ratFromInt(discriminant), BigInt(1) << BigInt(128))
  const denominator2 = BigInt(2) * A
  const lower: readonly [ExactRational, ExactRational] = [
    rational(-B * root.hi.d - root.hi.n, denominator2 * root.hi.d),
    rational(-B * root.lo.d - root.lo.n, denominator2 * root.lo.d),
  ]
  const upper: readonly [ExactRational, ExactRational] = [
    rational(-B * root.lo.d + root.lo.n, denominator2 * root.lo.d),
    rational(-B * root.hi.d + root.hi.n, denominator2 * root.hi.d),
  ]
  const isolating = b.n > BigInt(0) ? upper : lower

  return {
    polynomial: coefficients.map((value) => value.toString()),
    isolating: [encodeRational(isolating[0]), encodeRational(isolating[1])],
    rootIndex: b.n > BigInt(0) ? 1 : 0,
  }
}
