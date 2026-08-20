import { describe, expect, it } from 'vitest'
import { approx, cAdd, cDiv, cInt, cMul, cRat, cSqrt, cSub, compareCReal, evaluate, exactRational, isRationalExpr, signOf } from '../compute/certified-real'
import { compareExact, rational } from '../compute/exact-real'

describe('certified reals', () => {
  it('decides rational expressions exactly, never by enclosure', () => {
    const third = cDiv(cInt(1), cInt(3))
    const e = cSub(cMul(third, cInt(3)), cInt(1)) // (1/3)·3 − 1 = 0 exactly
    expect(isRationalExpr(e)).toBe(true)
    expect(signOf(e)).toBe(0)
    expect(compareExact(exactRational(cAdd(third, third)), rational(BigInt(2), BigInt(3)))).toBe(0)
  })

  it('separates irrational values by refining certified enclosures', () => {
    const root2 = cSqrt(cInt(2))
    // √2 > 1.4142135623 and < 1.4142135624 — both decided by enclosure, no float
    expect(compareCReal(root2, cRat(rational(BigInt(14142135623), BigInt(10000000000))))).toBe(1)
    expect(compareCReal(root2, cRat(rational(BigInt(14142135624), BigInt(10000000000))))).toBe(-1)
    const { lo, hi } = evaluate(root2, BigInt(128))
    expect(compareExact(lo, hi)).toBeLessThan(0)
    expect(Math.abs(approx(root2) - Math.SQRT2)).toBeLessThan(1e-15)
  })

  it('decides radical identities exactly, and still refuses what leaves the field', () => {
    // √2·√2 − 2 lives in one quadratic field: exactly zero, certified
    expect(signOf(cSub(cMul(cSqrt(cInt(2)), cSqrt(cInt(2))), cInt(2)))).toBe(0)
    // √2·√3 − √6 spans two radicals and is exactly zero. Enclosures can never show that — they can
    // only fail to exclude zero — so this is decided by the multi-radical field, which reduces the
    // radicands to coprime atoms and finds every coefficient zero.
    expect(signOf(cSub(cMul(cSqrt(cInt(2)), cSqrt(cInt(3))), cSqrt(cInt(6))))).toBe(0)
    // A nested radical leaves that field, so the enclosure ladder answers instead — which it can do
    // whenever the value is nonzero: √(1+√2) ≈ 1.5538 > 1.
    expect(signOf(cSub(cSqrt(cAdd(cInt(1), cSqrt(cInt(2)))), cInt(1)))).toBe(1)
    // But a nested radical that is exactly ZERO is beyond both routes — 3+2√2 = (1+√2)², so this
    // vanishes, and no enclosure can ever exclude zero. Reported unknown, never guessed.
    expect(signOf(cSub(cSqrt(cAdd(cInt(3), cMul(cInt(2), cSqrt(cInt(2))))), cAdd(cInt(1), cSqrt(cInt(2)))))).toBeNull()
    // and a genuine single-field ordering: 3√2 vs 4 → 3√2 > 4 because 18 > 16
    expect(signOf(cSub(cMul(cInt(3), cSqrt(cInt(2))), cInt(4)))).toBe(1)
  })

  it('enclosures are directed: lower bound floors, upper bound ceils', () => {
    const e = cDiv(cInt(1), cInt(3))
    const coarse = evaluate(cAdd(cSqrt(cInt(2)), e), BigInt(8))
    const fine = evaluate(cAdd(cSqrt(cInt(2)), e), BigInt(64))
    expect(compareExact(coarse.lo, fine.lo)).toBeLessThanOrEqual(0)
    expect(compareExact(coarse.hi, fine.hi)).toBeGreaterThanOrEqual(0)
  })
})
