// R14 §7.1 — semantic comparison of serialized algebraic roots.
// Certificates are validated from their polynomial, isolating interval and real-root index before
// use. Equality is polynomial GCD evidence; ordering is certified interval refinement.

import type { AlgebraicReal, CertifiedExpressionReal, Rational } from '../spec'
import { cAdd, cDiv, cMul, cNeg, cRat, cSqrt, cSub, type CReal } from './certified-real'
import { compareExact, ratFromInt, rational, type ExactRational } from './exact-real'
import { encodeCertifiedExpression } from './identity'
import {
  countRealRoots, evaluatePolynomial, polynomialGcd, primitivePolynomial, refineIsolatingInterval,
  isSquareFreePolynomial,
} from './polynomial'
import { evaluateSum, publishCertifiedSum, type ArcSweep, type CertifiedSum } from './region'

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

class ExpressionParser {
  private offset = 0
  constructor(private readonly source: string) {}

  private take(value: string) {
    if (!this.source.startsWith(value, this.offset)) throw new Error(`expected ${value}`)
    this.offset += value.length
  }
  private integer(): bigint {
    const match = /^-?\d+/.exec(this.source.slice(this.offset))
    if (!match) throw new Error('expected integer')
    this.offset += match[0].length
    return BigInt(match[0])
  }
  expression(): CReal {
    if (this.source.startsWith('rat(', this.offset)) {
      this.take('rat('); const numerator = this.integer(); this.take('/'); const denominator = this.integer(); this.take(')')
      return cRat(rational(numerator, denominator))
    }
    for (const unary of ['neg', 'sqrt'] as const) {
      if (!this.source.startsWith(`${unary}(`, this.offset)) continue
      this.take(`${unary}(`); const value = this.expression(); this.take(')')
      return unary === 'neg' ? cNeg(value) : cSqrt(value)
    }
    for (const operation of ['add', 'mul'] as const) {
      if (!this.source.startsWith(`${operation}(`, this.offset)) continue
      this.take(`${operation}(`)
      const values = [this.expression()]
      while (this.source[this.offset] === ',') { this.take(','); values.push(this.expression()) }
      this.take(')')
      if (values.length < 2) throw new Error(`${operation} needs two operands`)
      return values.slice(1).reduce((left, right) => operation === 'add' ? cAdd(left, right) : cMul(left, right), values[0])
    }
    for (const operation of ['sub', 'div'] as const) {
      if (!this.source.startsWith(`${operation}(`, this.offset)) continue
      this.take(`${operation}(`); const left = this.expression(); this.take(','); const right = this.expression(); this.take(')')
      return operation === 'sub' ? cSub(left, right) : cDiv(left, right)
    }
    throw new Error('unsupported expression token')
  }
  point(): { x: CReal; y: CReal } {
    const x = this.expression(); this.take(','); const y = this.expression()
    return { x, y }
  }
  done() { return this.offset === this.source.length }
}

const parseExpression = (source: string): CReal | null => {
  try { const parser = new ExpressionParser(source); const value = parser.expression(); return parser.done() ? value : null } catch { return null }
}
const parsePoint = (source: string): { x: CReal; y: CReal } | null => {
  try { const parser = new ExpressionParser(source); const value = parser.point(); return parser.done() ? value : null } catch { return null }
}

function parseAngle(token: string): { weight: CReal; sweep: ArcSweep } | null {
  if (!token.startsWith('angle:')) return null
  const separator = token.indexOf('@', 6)
  if (separator < 0) return null
  const weight = parseExpression(token.slice(6, separator))
  const fields = token.slice(separator + 1).split('|')
  if (!weight || fields.length !== 5) return null
  try {
    const from = parsePoint(fields[3]), to = parsePoint(fields[4])
    if (!from || !to) return null
    return { weight, sweep: { cx: BigInt(fields[0]), cy: BigInt(fields[1]), r: BigInt(fields[2]), from, to } }
  } catch { return null }
}

/** Strict reconstruction of the full canonical expression tokens; malformed proofs refuse. */
export function decodeCertifiedExpression(value: CertifiedExpressionReal): CertifiedSum | null {
  const tokens = value.expression.map(String)
  if (tokens.length < 3 || tokens[0] !== 'certified-sum-v1' || !tokens[1].startsWith('exact:')) return null
  const angleTokens = tokens.slice(2)
  if (angleTokens.some((token, index) => index > 0 && angleTokens[index - 1] > token)) return null
  let isolating: readonly [ExactRational, ExactRational]
  try { isolating = [decode(value.isolating[0]), decode(value.isolating[1])] } catch { return null }
  const identity = encodeCertifiedExpression({ expression: tokens, isolating })
  if (!identity || identity.expressionHash !== value.expressionHash || identity.proofId !== value.proofId) return null
  const exact = parseExpression(tokens[1].slice(6))
  const angles = angleTokens.map(parseAngle)
  if (!exact || angles.some((term) => term === null)) return null
  const sum: CertifiedSum = { exact, angles: angles as Array<{ weight: CReal; sweep: ArcSweep }> }
  const canonical = publishCertifiedSum(sum)
  if (!canonical || canonical.expression.length !== tokens.length
    || canonical.expression.some((token, index) => token !== tokens[index])) return null
  const enclosure = evaluateSum(sum, BigInt(128))
  if (compareExact(enclosure.lo, isolating[0]) < 0 || compareExact(enclosure.hi, isolating[1]) > 0) return null
  return sum
}

/** Re-evaluate a validated certificate at the requested precision; identity never participates. */
export function evaluateCertifiedExpression(
  value: CertifiedExpressionReal,
  bits: bigint,
): readonly [ExactRational, ExactRational] | null {
  if (bits <= BigInt(0)) return null
  const sum = decodeCertifiedExpression(value)
  if (!sum) return null
  const enclosure = evaluateSum(sum, bits)
  return compareExact(enclosure.lo, enclosure.hi) <= 0 ? [enclosure.lo, enclosure.hi] : null
}
