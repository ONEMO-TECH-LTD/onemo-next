// §6.1 requires exact values to survive as decimal-string integers so "Node/browser/worker/cache
// bytes agree". The only thing that proves it is a round trip: what comes back must be the value
// that went in, for values chosen to break a lossy encoder — beyond double precision, negative,
// unnormalized, and the exact IEEE-754 bit pattern of a decimal that has no finite binary form.

import { describe, expect, it } from 'vitest'
import { cAdd, cInt, cMul, cSqrt, asQuadratic } from '../compute/certified-real'
import { decodeRational, encodeQuadraticAlgebraic, encodeRational } from '../compute/identity'
import { compareExact, ratFromInt, ratFromNumber, rational, type ExactRational } from '../compute/exact-real'

describe('§6.1 canonical serialization of exact rationals', () => {
  const cases: ReadonlyArray<{ id: string; value: ExactRational }> = [
    { id: 'zero', value: rational(BigInt(0), BigInt(1)) },
    { id: 'unit', value: rational(BigInt(1), BigInt(1)) },
    { id: 'negative', value: rational(BigInt(-7), BigInt(3)) },
    { id: 'unnormalized input', value: rational(BigInt(6), BigInt(-4)) },
    { id: 'beyond double precision', value: rational(BigInt('90071992547409919'), BigInt('90071992547409921')) },
    { id: 'the exact bits of 0.1', value: ratFromNumber(0.1) },
    { id: 'a 200-digit numerator', value: rational(BigInt('9'.repeat(200)), BigInt('7'.repeat(199))) },
  ]

  it('round-trips every exact rational unchanged', () => {
    for (const { id, value } of cases) {
      const returned = decodeRational(encodeRational(value))
      expect(compareExact(returned, value), `${id} value`).toBe(0)
      // identical terms, not merely an equal ratio — the encoding is canonical
      expect(returned.n, `${id} numerator`).toBe(value.n)
      expect(returned.d, `${id} denominator`).toBe(value.d)
    }
  })

  it('encodes to decimal strings, since that is what makes bytes agree across runtimes', () => {
    const encoded = encodeRational(rational(BigInt(-7), BigInt(3)))
    expect(encoded).toEqual({ numerator: '-7', denominator: '3' })
    // a 200-digit term survives as digits, which is the point: no float, no exponent form
    const big = encodeRational(rational(BigInt('9'.repeat(200)), BigInt(1)))
    expect(big.numerator).toHaveLength(200)
    expect(big.numerator).not.toContain('e')
  })
})

describe('§6.1 canonical serialization of single-field algebraic reals', () => {
  it('publishes the exact primitive polynomial, isolating interval and root index', () => {
    const positive = encodeQuadraticAlgebraic(asQuadratic(cSqrt(cInt(2)))!)!
    const negative = encodeQuadraticAlgebraic(asQuadratic(cMul(cInt(-1), cSqrt(cInt(2))))!)!
    expect(positive.polynomial).toEqual(['-2', '0', '1'])
    expect(positive.rootIndex).toBe(1)
    expect(negative.polynomial).toEqual(['-2', '0', '1'])
    expect(negative.rootIndex).toBe(0)
    expect(compareExact(decodeRational(positive.isolating[0]), ratFromInt(0))).toBe(1)
    expect(compareExact(decodeRational(negative.isolating[1]), ratFromInt(0))).toBe(-1)
  })

  it('canonicalizes equivalent quadratic expressions to identical public evidence', () => {
    const direct = asQuadratic(cSqrt(cInt(12)))!
    const equivalent = asQuadratic(cMul(cInt(2), cSqrt(cInt(3))))!
    expect(encodeQuadraticAlgebraic(equivalent)).toEqual(encodeQuadraticAlgebraic(direct))

    const shifted = encodeQuadraticAlgebraic(asQuadratic(cAdd(cInt(1), cMul(cInt(2), cSqrt(cInt(3)))))!)!
    expect(shifted.polynomial).toEqual(['-11', '-2', '1'])
  })

  it('refuses rational or unrepresented sources instead of promoting an interval', () => {
    expect(encodeQuadraticAlgebraic(asQuadratic(cInt(7))!)).toBeNull()
    expect(encodeQuadraticAlgebraic({ a: ratFromInt(0), b: ratFromInt(1), k: BigInt(4) })).toBeNull()
    expect(encodeQuadraticAlgebraic({ a: ratFromInt(0), b: ratFromInt(1), k: BigInt(-2) })).toBeNull()
  })
})
