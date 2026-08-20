import { describe, expect, it } from 'vitest'
import { angleBetween, atanInterval, piInterval } from '../compute/angle'
import { cInt, cSqrt } from '../compute/certified-real'
import { compareExact, ratFromInt, ratToNumber, rational } from '../compute/exact-real'

const width = (i: { lo: { n: bigint; d: bigint }; hi: { n: bigint; d: bigint } }) => ratToNumber(i.hi) - ratToNumber(i.lo)
// JS Math constants are themselves rounded (Math.PI/3 is 2e-16 below π/3); a certified enclosure
// tighter than that cannot "contain" the float, so compare to within one float ulp of the bounds.
const contains = (i: { lo: { n: bigint; d: bigint }; hi: { n: bigint; d: bigint } }, v: number) =>
  ratToNumber(i.lo) - 4e-16 <= v && v <= ratToNumber(i.hi) + 4e-16 && width(i) < 1e-14

describe('certified angles', () => {
  it('encloses π tightly by Machin', () => {
    const pi = piInterval(BigInt(64))
    expect(contains(pi, Math.PI)).toBe(true)
    expect(width(pi)).toBeLessThan(1e-15)
    // the enclosure is rational and certified: π = 3.1415926535897932384626433… lies strictly inside
    expect(compareExact(pi.lo, rational(BigInt('31415926535897932384626'), BigInt('10000000000000000000000')))).toBeLessThanOrEqual(0)
    expect(compareExact(pi.hi, rational(BigInt('31415926535897932384627'), BigInt('10000000000000000000000')))).toBeGreaterThanOrEqual(0)
  })

  it('encloses atan across the reduction boundary', () => {
    for (const x of [0.25, 1, 3, -0.5, -7]) {
      const i = atanInterval(rational(BigInt(Math.round(x * 4)), BigInt(4)), BigInt(64))
      expect(contains(i, Math.atan(x))).toBe(true)
      expect(width(i)).toBeLessThan(1e-14)
    }
    expect(atanInterval(ratFromInt(0), BigInt(64))).toEqual({ lo: ratFromInt(0), hi: ratFromInt(0) })
  })

  it('angle between directions from exact cross and dot, all quadrants that do not cross the cut', () => {
    // u=(1,0), v=(1,1): cross=1, dot=1 → π/4
    expect(contains(angleBetween(cInt(1), cInt(1), BigInt(64))!, Math.PI / 4)).toBe(true)
    // cross=1, dot=0 → π/2 ; cross=-1, dot=0 → −π/2
    expect(contains(angleBetween(cInt(1), cInt(0), BigInt(64))!, Math.PI / 2)).toBe(true)
    expect(contains(angleBetween(cInt(-1), cInt(0), BigInt(64))!, -Math.PI / 2)).toBe(true)
    // cross=√3, dot=1 → π/3, with an irrational cross
    expect(contains(angleBetween(cSqrt(cInt(3)), cInt(1), BigInt(64))!, Math.PI / 3)).toBe(true)
    // cross=1, dot=-1 → 3π/4 (dot negative, cross positive branch)
    expect(contains(angleBetween(cInt(1), cInt(-1), BigInt(64))!, 3 * Math.PI / 4)).toBe(true)
    // exactly opposite directions sit on the branch cut: refused, not guessed
    expect(angleBetween(cInt(0), cInt(-1), BigInt(64))).toBeNull()
  })
})
