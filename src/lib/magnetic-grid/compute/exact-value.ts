// R14 §7.1 — semantic comparison of serialized algebraic roots.
// Certificates are validated from their polynomial, isolating interval and real-root index before
// use. Equality is polynomial GCD evidence; ordering is certified interval refinement.

import type { AlgebraicReal, Rational } from '../spec'
import { compareExact, ratFromInt, rational, type ExactRational } from './exact-real'
import {
  countRealRoots, evaluatePolynomial, polynomialGcd, primitivePolynomial, refineIsolatingInterval,
  isSquareFreePolynomial,
} from './polynomial'

interface AlgebraicCertificate {
  polynomial: bigint[]
  interval: readonly [ExactRational, ExactRational]
  rootIndex: number
}

const decode = (value: Rational): ExactRational => rational(BigInt(value.numerator), BigInt(value.denominator))
const abs = (value: bigint) => (value < BigInt(0) ? -value : value)

function rootBound(polynomial: readonly bigint[]): bigint {
  const leading = abs(polynomial[polynomial.length - 1])
  let ratio = BigInt(0)
  for (const coefficient of polynomial.slice(0, -1)) {
    const magnitude = abs(coefficient)
    const ceiling = (magnitude + leading - BigInt(1)) / leading
    if (ceiling > ratio) ratio = ceiling
  }
  let bound = ratio + BigInt(1)
  while (evaluatePolynomial(polynomial, ratFromInt(-bound)).n === BigInt(0)
    || evaluatePolynomial(polynomial, ratFromInt(bound)).n === BigInt(0)) bound++
  return bound
}

function certificate(value: AlgebraicReal): AlgebraicCertificate | null {
  let parsed: bigint[]
  try { parsed = value.polynomial.map((coefficient) => BigInt(coefficient)) } catch { return null }
  const polynomial = primitivePolynomial(parsed)
  if (!polynomial || polynomial.length <= 1 || !isSquareFreePolynomial(polynomial)
    || !Number.isInteger(value.rootIndex) || value.rootIndex < 0) return null
  let interval: readonly [ExactRational, ExactRational]
  try { interval = [decode(value.isolating[0]), decode(value.isolating[1])] } catch { return null }

  if (compareExact(interval[0], interval[1]) === 0) {
    if (evaluatePolynomial(polynomial, interval[0]).n !== BigInt(0)) return null
  } else if (countRealRoots(polynomial, interval) !== 1) return null

  const bound = rootBound(polynomial)
  const floor = ratFromInt(-bound), ceiling = ratFromInt(bound)
  const total = countRealRoots(polynomial, [floor, ceiling])
  if (total === null || value.rootIndex >= total) return null
  const before = compareExact(interval[0], floor) <= 0 ? 0 : countRealRoots(polynomial, [floor, interval[0]])
  if (before === null || before !== value.rootIndex) return null
  return { polynomial, interval, rootIndex: value.rootIndex }
}

const samePolynomial = (left: readonly bigint[], right: readonly bigint[]) =>
  left.length === right.length && left.every((coefficient, index) => coefficient === right[index])

const commonRootInIntersection = (left: AlgebraicCertificate, right: AlgebraicCertificate): boolean | null => {
  const gcd = polynomialGcd(left.polynomial, right.polynomial)
  if (!gcd || gcd.length <= 1) return false
  const lo = compareExact(left.interval[0], right.interval[0]) >= 0 ? left.interval[0] : right.interval[0]
  const hi = compareExact(left.interval[1], right.interval[1]) <= 0 ? left.interval[1] : right.interval[1]
  const order = compareExact(lo, hi)
  if (order > 0) return false
  if (order === 0) return evaluatePolynomial(gcd, lo).n === BigInt(0)
  const roots = countRealRoots(gcd, [lo, hi])
  return roots === null ? null : roots === 1
}

/** Valid certificates compare totally; malformed certificates return null, never a guessed order. */
export function compareAlgebraicReal(leftValue: AlgebraicReal, rightValue: AlgebraicReal): -1 | 0 | 1 | null {
  let left = certificate(leftValue), right = certificate(rightValue)
  if (!left || !right) return null
  if (samePolynomial(left.polynomial, right.polynomial)) {
    if (left.rootIndex === right.rootIndex) return 0
    return left.rootIndex < right.rootIndex ? -1 : 1
  }

  const common = commonRootInIntersection(left, right)
  if (common === null) return null
  if (common) return 0

  for (;;) {
    if (compareExact(left.interval[1], right.interval[0]) < 0) return -1
    if (compareExact(right.interval[1], left.interval[0]) < 0) return 1
    const nextLeft: readonly [ExactRational, ExactRational] | null = compareExact(left.interval[0], left.interval[1]) === 0
      ? left.interval : refineIsolatingInterval(left.polynomial, left.interval, 1)
    const nextRight: readonly [ExactRational, ExactRational] | null = compareExact(right.interval[0], right.interval[1]) === 0
      ? right.interval : refineIsolatingInterval(right.polynomial, right.interval, 1)
    if (!nextLeft || !nextRight) return null
    left = { ...left, interval: nextLeft }
    right = { ...right, interval: nextRight }
  }
}
