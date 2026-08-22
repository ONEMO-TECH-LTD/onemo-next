import { describe, expect, it } from 'vitest'
import {
  approximateExact,
  affineExact,
  canonicalExact,
  compareExact,
  compareExactToRational,
  multiplyRational,
  quadraticRootsWithin,
  rational,
  rationalFromNumber,
  signQuadraticAtExact,
  squareRational,
  sqrtMinusRational,
  subtractRational,
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
    const shifted = affineExact(roots[0], rational(1, 2), rational(-48))
    expect(approximateExact(shifted)).toBeCloseTo(12 * Math.SQRT2, 12)
    expect(compareExact(shifted, rational(0))).toBe(1)
    expect(signQuadraticAtExact(rational(1), rational(-192), rational(8064), roots[0])).toBe(0)
    const differentlyIsolated = quadraticRootsWithin(
      rational(2), rational(-384), rational(16128), rational(129), rational(131),
    )[0]
    expect('polynomial' in differentlyIsolated).toBe(true)
    if (!('polynomial' in differentlyIsolated)) return
    expect(canonicalExact(differentlyIsolated)).toBe(canonicalExact(roots[0]))
    expect(compareExactToRational(differentlyIsolated, rational(129))).toBe(1)
    expect(compareExactToRational(differentlyIsolated, rational(131))).toBe(-1)
    expect(compareExact(roots[0], {
      polynomial: ['2', '-384', '16128'],
      isolating: differentlyIsolated.isolating,
      rootIndex: 1,
    })).toBe(0)
  })

  it('publishes perfect-square quadratic roots as their canonical Rational value', () => {
    expect(quadraticRootsWithin(rational(1), rational(-48), rational(572), rational(25), rational(27))).toEqual([rational(26)])
    expect(quadraticRootsWithin(rational(1), rational(-28), rational(52), rational(25), rational(27))).toEqual([rational(26)])
  })

  it('refines beyond any fixed precision cap for close distinct roots', () => {
    const epsilon = rational(1, BigInt(1) << BigInt(420))
    const root = quadraticRootsWithin(rational(1), rational(0), rational(-2), rational(1), rational(2))[0]
    const shifted = quadraticRootsWithin(
      rational(1),
      multiplyRational(rational(-2), epsilon),
      subtractRational(squareRational(epsilon), rational(2)),
      rational(1),
      rational(2),
    )[0]
    expect(compareExact(root, shifted)).toBe(-1)
  })

  it('does not widen two roots sharing one integer interval across their vertex', () => {
    const tiny = rational(2, BigInt(1) << BigInt(842))
    const roots = quadraticRootsWithin(
      rational(1), rational(-3), subtractRational(rational(9, 4), tiny), rational(1), rational(2), 8,
    )
    expect(roots).toHaveLength(2)
    expect(roots.every((root) => 'polynomial' in root && root.isolating[0].numerator === '1' && root.isolating[1].numerator === '2')).toBe(false)
    expect(compareExact(roots[0], roots[1])).toBe(-1)
  })
})
