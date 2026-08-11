import type { PointMM } from '../engine'

interface Rational {
  numerator: bigint
  denominator: bigint
}

const power10 = (exponent: number): bigint => 10n ** BigInt(exponent)

/** Exact rational representation of the finite decimal carried by a JavaScript number. */
export function rationalOf(value: number): Rational {
  if (!Number.isFinite(value)) throw new RangeError('Coordinate must be finite.')
  const negative = value < 0 || Object.is(value, -0)
  const [coefficient, exponentText] = Math.abs(value).toString().toLowerCase().split('e')
  const exponent = Number(exponentText ?? 0)
  const [whole, fraction = ''] = coefficient.split('.')
  const digits = BigInt(`${whole}${fraction}` || '0')
  const decimalExponent = exponent - fraction.length
  const numerator = (negative ? -digits : digits) * (decimalExponent > 0 ? power10(decimalExponent) : 1n)
  const denominator = decimalExponent < 0 ? power10(-decimalExponent) : 1n
  return { numerator, denominator }
}

const subtract = (a: Rational, b: Rational): Rational => ({
  numerator: a.numerator * b.denominator - b.numerator * a.denominator,
  denominator: a.denominator * b.denominator,
})

const add = (a: Rational, b: Rational): Rational => ({
  numerator: a.numerator * b.denominator + b.numerator * a.denominator,
  denominator: a.denominator * b.denominator,
})

const multiply = (a: Rational, b: Rational): Rational => ({
  numerator: a.numerator * b.numerator,
  denominator: a.denominator * b.denominator,
})

export function exactOrientation(a: PointMM, b: PointMM, c: PointMM): -1 | 0 | 1 {
  const ax = rationalOf(a[0]); const ay = rationalOf(a[1])
  const bx = rationalOf(b[0]); const by = rationalOf(b[1])
  const cx = rationalOf(c[0]); const cy = rationalOf(c[1])
  const determinant = subtract(
    multiply(subtract(bx, ax), subtract(cy, ay)),
    multiply(subtract(by, ay), subtract(cx, ax)),
  ).numerator
  return determinant < 0n ? -1 : determinant > 0n ? 1 : 0
}

export function exactSignedAreaSign(points: ReadonlyArray<PointMM>): -1 | 0 | 1 {
  let sum: Rational = { numerator: 0n, denominator: 1n }
  for (let index = 0; index < points.length; index++) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    sum = add(sum, subtract(
      multiply(rationalOf(a[0]), rationalOf(b[1])),
      multiply(rationalOf(b[0]), rationalOf(a[1])),
    ))
  }
  return sum.numerator < 0n ? -1 : sum.numerator > 0n ? 1 : 0
}
