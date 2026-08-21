import { describe, expect, it } from 'vitest'
import {
  approximateExact,
  canonicalExact,
  compareExactToRational,
  rational,
  rationalFromNumber,
  sqrtMinusRational,
} from '../compute/exact-real'

describe('Wrap exact-real support', () => {
  it('preserves the exact IEEE-754 input value', () => {
    expect(rationalFromNumber(0.5)).toEqual({ numerator: '1', denominator: '2' })
    expect(approximateExact(rationalFromNumber(0.1))).toBe(0.1)
  })

  it('returns rational zero for the exact square contact', () => {
    expect(sqrtMinusRational(rational(144), rational(12))).toEqual(rational(0))
  })

  it('isolates the diamond minimum exactly and compares it to rational caps', () => {
    const required = sqrtMinusRational(rational(162), rational(12))
    expect('polynomial' in required).toBe(true)
    expect(approximateExact(required)).toBeCloseTo(18 / Math.sqrt(2) - 12, 14)
    expect(compareExactToRational(required, rationalFromNumber(0.7))).toBe(1)
    expect(compareExactToRational(required, rational(1))).toBe(-1)
    expect(canonicalExact(required)).toBe(canonicalExact(required))
  })
})
