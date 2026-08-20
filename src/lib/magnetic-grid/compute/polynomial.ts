// R14 §7.1 — exact integer-polynomial and Sturm root-refinement kernel.
// Coefficients are ascending. Every division/evaluation uses normalized BigInt rationals;
// no number, tolerance or sampled sign can enter a root count.

import {
  compareExact, ratAdd, ratDiv, ratFromInt, ratMul, ratNeg, ratSign, ratSub, rational,
  type ExactRational,
} from './exact-real'

export type IntegerPolynomial = readonly bigint[]
type RationalPolynomial = ExactRational[]

const ZERO = BigInt(0)
const ONE = BigInt(1)
const abs = (value: bigint) => (value < ZERO ? -value : value)
const gcd = (a: bigint, b: bigint): bigint => {
  let x = abs(a), y = abs(b)
  while (y !== ZERO) { const remainder = x % y; x = y; y = remainder }
  return x === ZERO ? ONE : x
}
const lcm = (a: bigint, b: bigint) => abs(a / gcd(a, b) * b)

const trimInteger = (input: readonly bigint[]): bigint[] => {
  const result = [...input]
  while (result.length > 1 && result[result.length - 1] === ZERO) result.pop()
  return result.length ? result : [ZERO]
}
const trimRational = (input: readonly ExactRational[]): RationalPolynomial => {
  const result = [...input]
  while (result.length > 1 && result[result.length - 1].n === ZERO) result.pop()
  return result.length ? result : [ratFromInt(0)]
}
const isZero = (input: readonly ExactRational[]) => trimRational(input).every((value) => value.n === ZERO)

/** Primitive, content-canonical integer polynomial with positive leading coefficient. */
export function primitivePolynomial(input: IntegerPolynomial): bigint[] | null {
  let coefficients = trimInteger(input)
  if (coefficients.every((value) => value === ZERO)) return null
  const common = coefficients.reduce((factor, value) => gcd(factor, value), ZERO)
  coefficients = coefficients.map((value) => value / common)
  if (coefficients[coefficients.length - 1] < ZERO) coefficients = coefficients.map((value) => -value)
  return coefficients
}

/** Exact Horner evaluation at a rational point. */
export function evaluatePolynomial(polynomial: IntegerPolynomial, x: ExactRational): ExactRational {
  let value = ratFromInt(0)
  for (let index = polynomial.length - 1; index >= 0; index--) {
    value = ratAdd(ratMul(value, x), ratFromInt(polynomial[index]))
  }
  return value
}

const derivative = (polynomial: IntegerPolynomial): bigint[] => {
  if (polynomial.length <= 1) return [ZERO]
  return polynomial.slice(1).map((value, index) => value * BigInt(index + 1))
}
const asRational = (polynomial: IntegerPolynomial): RationalPolynomial => polynomial.map(ratFromInt)

function divideRational(dividend: RationalPolynomial, divisor: RationalPolynomial): { remainder: RationalPolynomial } {
  const denominator = trimRational(divisor)
  if (isZero(denominator)) throw new Error('divideRational: zero divisor')
  let remainder = trimRational(dividend)
  while (!isZero(remainder) && remainder.length >= denominator.length) {
    const shift = remainder.length - denominator.length
    const factor = ratDiv(remainder[remainder.length - 1], denominator[denominator.length - 1])
    const updated = [...remainder]
    for (let index = 0; index < denominator.length; index++) {
      updated[index + shift] = ratSub(updated[index + shift], ratMul(factor, denominator[index]))
    }
    remainder = trimRational(updated)
  }
  return { remainder }
}

const rationalPolynomialToPrimitive = (polynomial: RationalPolynomial): bigint[] | null => {
  const reduced = trimRational(polynomial)
  if (isZero(reduced)) return null
  const denominator = reduced.reduce((value, coefficient) => lcm(value, coefficient.d), ONE)
  return primitivePolynomial(reduced.map((coefficient) => coefficient.n * (denominator / coefficient.d)))
}

/** Primitive polynomial GCD over Q[x], used to prove shared algebraic roots. */
export function polynomialGcd(left: IntegerPolynomial, right: IntegerPolynomial): bigint[] | null {
  const a0 = primitivePolynomial(left), b0 = primitivePolynomial(right)
  if (!a0 || !b0) return null
  let a = asRational(a0), b = asRational(b0)
  while (!isZero(b)) {
    const remainder = divideRational(a, b).remainder
    a = b
    b = remainder
  }
  return rationalPolynomialToPrimitive(a)
}

/** R14 §7.1 certificate check: repeated polynomial factors are forbidden. */
export function isSquareFreePolynomial(input: IntegerPolynomial): boolean {
  const polynomial = primitivePolynomial(input)
  if (!polynomial || polynomial.length <= 1) return false
  const common = polynomialGcd(polynomial, derivative(polynomial))
  return common !== null && common.length === 1
}

/** Exact Sturm chain. The input must be non-constant and square-free at its isolated roots. */
export function sturmSequence(input: IntegerPolynomial): readonly RationalPolynomial[] | null {
  const polynomial = primitivePolynomial(input)
  if (!polynomial || polynomial.length <= 1) return null
  const sequence: RationalPolynomial[] = [asRational(polynomial), asRational(derivative(polynomial))]
  while (!isZero(sequence[sequence.length - 1])) {
    const { remainder } = divideRational(sequence[sequence.length - 2], sequence[sequence.length - 1])
    if (isZero(remainder)) break
    sequence.push(remainder.map(ratNeg))
  }
  return sequence
}

const evaluateRationalPolynomial = (polynomial: RationalPolynomial, x: ExactRational): ExactRational => {
  let value = ratFromInt(0)
  for (let index = polynomial.length - 1; index >= 0; index--) value = ratAdd(ratMul(value, x), polynomial[index])
  return value
}

function variations(sequence: readonly RationalPolynomial[], x: ExactRational): number | null {
  let previous: -1 | 1 | null = null
  let count = 0
  for (const polynomial of sequence) {
    const sign = ratSign(evaluateRationalPolynomial(polynomial, x))
    if (sign === 0) continue // Sturm variations skip zero members after endpoint validity is proved
    if (previous !== null && sign !== previous) count++
    previous = sign
  }
  return previous === null ? null : count
}

/** Number of distinct real roots in the open rational interval; null for invalid/root endpoints. */
export function countRealRoots(
  polynomial: IntegerPolynomial,
  interval: readonly [ExactRational, ExactRational],
): number | null {
  const [lo, hi] = interval
  if (compareExact(lo, hi) >= 0) return null
  if (ratSign(evaluatePolynomial(polynomial, lo)) === 0 || ratSign(evaluatePolynomial(polynomial, hi)) === 0) return null
  const sequence = sturmSequence(polynomial)
  if (!sequence) return null
  const left = variations(sequence, lo), right = variations(sequence, hi)
  return left === null || right === null ? null : left - right
}

/** Refine a certified one-root interval by exact Sturm bisection. */
export function refineIsolatingInterval(
  polynomial: IntegerPolynomial,
  interval: readonly [ExactRational, ExactRational],
  steps = 1,
): readonly [ExactRational, ExactRational] | null {
  let lo = interval[0], hi = interval[1]
  if (countRealRoots(polynomial, [lo, hi]) !== 1) return null
  for (let step = 0; step < steps; step++) {
    const mid = ratDiv(ratAdd(lo, hi), ratFromInt(2))
    const atMid = ratSign(evaluatePolynomial(polynomial, mid))
    if (atMid === 0) return [mid, mid]
    const left = countRealRoots(polynomial, [lo, mid])
    if (left === 1) { hi = mid; continue }
    const right = countRealRoots(polynomial, [mid, hi])
    if (right === 1) { lo = mid; continue }
    return null
  }
  return [lo, hi]
}

/** Exact interval width, used only by proof tests and refinement callers. */
export const intervalWidth = (interval: readonly [ExactRational, ExactRational]) => ratSub(interval[1], interval[0])

/** Canonical rational midpoint helper for callers that need another exact split. */
export const intervalMidpoint = (interval: readonly [ExactRational, ExactRational]) =>
  rational(interval[0].n * interval[1].d + interval[1].n * interval[0].d, BigInt(2) * interval[0].d * interval[1].d)
