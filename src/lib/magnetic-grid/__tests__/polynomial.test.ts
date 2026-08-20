import { describe, expect, it } from 'vitest'
import { compareExact, ratFromInt, rational, ratSign } from '../compute/exact-real'
import {
  countRealRoots, evaluatePolynomial, intervalWidth, primitivePolynomial, refineIsolatingInterval,
  sturmSequence,
} from '../compute/polynomial'

describe('R14 §7.1 exact polynomial root kernel', () => {
  it('normalizes primitive integer content without changing roots', () => {
    expect(primitivePolynomial([BigInt(4), BigInt(0), -BigInt(2)])).toEqual([-BigInt(2), BigInt(0), BigInt(1)])
    expect(primitivePolynomial([BigInt(0), BigInt(0)])).toBeNull()
  })

  it('counts and refines the unique positive root of x²-2', () => {
    const p = [-BigInt(2), BigInt(0), BigInt(1)]
    expect(sturmSequence(p)).toHaveLength(3)
    // p'(0)=0, but 0 is not a root of p: Sturm variations must skip that intermediate zero.
    expect(countRealRoots(p, [ratFromInt(0), ratFromInt(2)])).toBe(1)
    expect(countRealRoots(p, [ratFromInt(1), ratFromInt(2)])).toBe(1)
    const refined = refineIsolatingInterval(p, [ratFromInt(1), ratFromInt(2)], 80)!
    expect(compareExact(intervalWidth(refined), intervalWidth([ratFromInt(1), ratFromInt(2)]) )).toBe(-1)
    expect(ratSign(evaluatePolynomial(p, refined[0]))).toBe(-1)
    expect(ratSign(evaluatePolynomial(p, refined[1]))).toBe(1)
  })

  it('counts every cubic root in the requested interval', () => {
    // (x-1)(x-2)(x-3) = x³-6x²+11x-6
    const p = [-BigInt(6), BigInt(11), -BigInt(6), BigInt(1)]
    expect(countRealRoots(p, [ratFromInt(0), ratFromInt(4)])).toBe(3)
    expect(countRealRoots(p, [ratFromInt(0), rational(BigInt(3), BigInt(2))])).toBe(1)
    expect(countRealRoots(p, [rational(BigInt(3), BigInt(2)), rational(BigInt(5), BigInt(2))])).toBe(1)
    expect(countRealRoots(p, [rational(BigInt(5), BigInt(2)), ratFromInt(4)])).toBe(1)
  })

  it('collapses exactly when bisection lands on a rational root', () => {
    const p = [-BigInt(2), BigInt(1)]
    const refined = refineIsolatingInterval(p, [ratFromInt(1), ratFromInt(3)], 4)!
    expect(refined).toEqual([ratFromInt(2), ratFromInt(2)])
  })

  it('refuses invalid, no-root, multi-root and root-endpoint intervals', () => {
    const p = [-BigInt(1), BigInt(0), BigInt(1)] // roots -1,+1
    expect(refineIsolatingInterval(p, [ratFromInt(-2), ratFromInt(2)], 2)).toBeNull()
    expect(refineIsolatingInterval(p, [ratFromInt(2), ratFromInt(3)], 2)).toBeNull()
    expect(countRealRoots(p, [ratFromInt(1), ratFromInt(3)])).toBeNull()
    expect(countRealRoots(p, [ratFromInt(3), ratFromInt(2)])).toBeNull()
  })

  it('keeps separated roots of x³-x distinct', () => {
    const p = [BigInt(0), -BigInt(1), BigInt(0), BigInt(1)]
    expect(countRealRoots(p, [ratFromInt(-2), rational(-BigInt(1), BigInt(2))])).toBe(1)
    expect(countRealRoots(p, [rational(-BigInt(1), BigInt(2)), rational(BigInt(1), BigInt(2))])).toBe(1)
    expect(countRealRoots(p, [rational(BigInt(1), BigInt(2)), ratFromInt(2)])).toBe(1)
  })
})
