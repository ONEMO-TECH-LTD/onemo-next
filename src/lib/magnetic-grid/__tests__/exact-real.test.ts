import { describe, expect, it } from 'vitest'
import {
  compareExact,
  ratAdd,
  ratDiv,
  ratFromInt,
  ratFromNumber,
  ratMul,
  ratSign,
  ratSq,
  ratSub,
  ratToNumber,
  rational,
  sqrtInterval,
} from '../compute/exact-real'

describe('exact-real', () => {
  it('normalizes sign and common factors', () => {
    expect(rational(BigInt(2), -BigInt(4))).toEqual({ n: -BigInt(1), d: BigInt(2) })
    expect(rational(-BigInt(6), -BigInt(9))).toEqual({ n: BigInt(2), d: BigInt(3) })
  })

  it('converts floats via their exact IEEE-754 bits', () => {
    expect(ratFromNumber(0.5)).toEqual({ n: BigInt(1), d: BigInt(2) })
    expect(ratFromNumber(-0.75)).toEqual({ n: -BigInt(3), d: BigInt(4) })
    expect(ratFromNumber(3)).toEqual({ n: BigInt(3), d: BigInt(1) })
    // 0.1 is NOT one tenth in IEEE-754 — the exact bit value must be preserved, not prettified.
    const tenth = ratFromNumber(0.1)
    expect(tenth.d).toBe(BigInt(1) << BigInt(55))
    expect(tenth.n).toBe(BigInt('3602879701896397'))
    expect(ratToNumber(tenth)).toBe(0.1)
  })

  it('field operations are exact where floats are not', () => {
    // 0.1 + 0.2 !== 0.3 in floats; exactly representing each bit value, arithmetic stays exact.
    const sum = ratAdd(ratFromNumber(0.1), ratFromNumber(0.2))
    expect(ratToNumber(sum)).toBe(0.1 + 0.2)
    expect(compareExact(ratMul(rational(BigInt(1), BigInt(3)), ratFromInt(3)), ratFromInt(1))).toBe(0)
    expect(compareExact(ratSub(ratFromInt(1), rational(BigInt(1), BigInt(3))), rational(BigInt(2), BigInt(3)))).toBe(0)
    expect(compareExact(ratDiv(ratFromInt(1), ratFromInt(3)), rational(BigInt(1), BigInt(3)))).toBe(0)
  })

  it('compares without float mediation', () => {
    // Adjacent doubles are distinct rationals — a float path would collapse them.
    const a = ratFromNumber(1)
    const b = ratFromNumber(1 + Number.EPSILON)
    expect(compareExact(a, b)).toBe(-1)
    expect(ratSign(ratSub(b, a))).toBe(1)
  })

  it('encloses square roots with certified rational bounds', () => {
    const { lo, hi } = sqrtInterval(ratFromInt(2))
    expect(compareExact(ratSq(lo), ratFromInt(2))).toBeLessThanOrEqual(0)
    expect(compareExact(ratSq(hi), ratFromInt(2))).toBeGreaterThanOrEqual(0)
    expect(ratToNumber(ratSub(hi, lo))).toBeLessThan(1e-11)
    const exact = sqrtInterval(ratFromInt(144))
    expect(compareExact(exact.lo, exact.hi)).toBe(0)
    expect(compareExact(exact.lo, ratFromInt(12))).toBe(0)
  })
})
