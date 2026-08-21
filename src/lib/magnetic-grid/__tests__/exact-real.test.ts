import { describe, expect, it } from 'vitest'
import {
  approximateExact,
  canonicalExact,
  compareExactToRational,
  quadraticRootsWithin,
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

  it('fails closed outside the admitted upward-quadratic larger-root representation', () => {
    const valid = sqrtMinusRational(rational(162), rational(12))
    expect('polynomial' in valid).toBe(true)
    if (!('polynomial' in valid)) return
    expect(() => compareExactToRational({ ...valid, rootIndex: 0 }, rational(0))).toThrow('unsupported algebraic comparison')
    expect(() => compareExactToRational({ ...valid, polynomial: ['-1', '0', '1'] }, rational(0))).toThrow('unsupported algebraic comparison')
    expect(() => compareExactToRational({ ...valid, polynomial: ['1', '0', '0', '-1'] }, rational(0))).toThrow('unsupported algebraic comparison')
    expect(() => compareExactToRational({ ...valid, isolating: [valid.isolating[1], valid.isolating[0]] }, rational(0))).toThrow('unsupported algebraic comparison')
  })

  it('isolates the exact non-integer diamond scale event inside B3', () => {
    const roots = quadraticRootsWithin(rational(1), rational(-192), rational(8064), rational(120), rational(167))
    expect(roots).toHaveLength(1)
    expect(roots[0]).toEqual({
      polynomial: ['1', '-192', '8064'],
      isolating: expect.any(Array),
      rootIndex: 1,
    })
    expect(approximateExact(roots[0])).toBeCloseTo(96 + 24 * Math.SQRT2, 12)
    expect(compareExactToRational(roots[0], rational(129))).toBe(1)
    expect(compareExactToRational(roots[0], rational(130))).toBe(-1)
  })
})
