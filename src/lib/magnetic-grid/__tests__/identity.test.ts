// §6.1 requires exact values to survive as decimal-string integers so "Node/browser/worker/cache
// bytes agree". The only thing that proves it is a round trip: what comes back must be the value
// that went in, for values chosen to break a lossy encoder — beyond double precision, negative,
// unnormalized, and the exact IEEE-754 bit pattern of a decimal that has no finite binary form.

import { describe, expect, it } from 'vitest'
import { cAdd, cInt, cMul, cSqrt, asQuadratic } from '../compute/certified-real'
import { decodeRational, encodeCertifiedExpression, encodeQuadraticAlgebraic, encodeRational } from '../compute/identity'
import { compareExact, ratFromInt, ratFromNumber, rational, type ExactRational } from '../compute/exact-real'
import { exactContour, toUnits } from '../compute/clearance'
import { exactRegions, publishCertifiedSum, type CertifiedSum } from '../compute/region'

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

describe('§6.1 canonical serialization of certified integral expressions', () => {
  const source = () => {
    const contour = exactContour({
      outer: { pts: [[0, 0], [100, 0], [100, 100], [0, 100]] },
      holes: [{ pts: [[40, 40], [60, 40], [60, 60], [40, 60]] }],
    })
    return exactRegions(contour, toUnits(12, contour)).regions[0].areaExpr
  }

  it('publishes actual CertifiedSum terms with directed bounds and stable proof identity', () => {
    const sum = source()
    const published = publishCertifiedSum(sum)!
    expect(published.expression[0]).toBe('certified-sum-v1')
    expect(published.expression.some((token) => token.startsWith('angle:'))).toBe(true)
    expect(published.proofId).toBe(`directed-bigint-interval-v1:${published.expressionHash}`)
    expect(compareExact(decodeRational(published.isolating[0]), decodeRational(published.isolating[1]))).toBeLessThanOrEqual(0)
  })

  it('is invariant to term traversal and associative/commutative exact-tree order', () => {
    const sum = source()
    const reversedExact = sum.exact.k === 'add' ? { k: 'add' as const, a: sum.exact.b, b: sum.exact.a } : sum.exact
    const reordered: CertifiedSum = { exact: reversedExact, angles: [...sum.angles].reverse() }
    expect(publishCertifiedSum(reordered)).toEqual(publishCertifiedSum(sum))
  })

  it('changes identity with real sweep geometry and never promotes an interval-only rational sum', () => {
    const sum = source()
    const [first, ...rest] = sum.angles
    const mutated: CertifiedSum = {
      exact: sum.exact,
      angles: [{ ...first, sweep: { ...first.sweep, cx: first.sweep.cx + BigInt(1) } }, ...rest],
    }
    expect(publishCertifiedSum(mutated)!.expressionHash).not.toBe(publishCertifiedSum(sum)!.expressionHash)
    const reversed: CertifiedSum = {
      exact: sum.exact,
      angles: [{ ...first, sweep: { ...first.sweep, from: first.sweep.to, to: first.sweep.from } }, ...rest],
    }
    expect(publishCertifiedSum(reversed)!.expressionHash).not.toBe(publishCertifiedSum(sum)!.expressionHash)
    expect(publishCertifiedSum({ exact: cInt(7), angles: [] })).toBeNull()
  })

  it('refuses invalid bounds and keeps proof identity stable across enclosure refinement', () => {
    const expression = ['certified-sum-v1', 'exact:rat(1/3)', 'angle:rat(2/1)@signed-sweep']
    expect(encodeCertifiedExpression({
      expression,
      isolating: [ratFromInt(2), ratFromInt(1)],
    })).toBeNull()

    const coarse = encodeCertifiedExpression({
      expression,
      isolating: [rational(BigInt(3), BigInt(1)), rational(BigInt(4), BigInt(1))],
    })!
    const refined = encodeCertifiedExpression({
      expression,
      isolating: [rational(BigInt(31), BigInt(10)), rational(BigInt(32), BigInt(10))],
    })!
    expect(refined.expressionHash).toBe(coarse.expressionHash)
    expect(refined.proofId).toBe(coarse.proofId)
    expect(refined.isolating).not.toEqual(coarse.isolating)
  })

  it('routes zero or cancelling angle residue away from CertifiedExpressionReal', () => {
    const sum = source()
    const sweep = sum.angles[0].sweep
    expect(publishCertifiedSum({ exact: cInt(7), angles: [{ weight: cInt(0), sweep }] })).toBeNull()
    expect(publishCertifiedSum({
      exact: cInt(7),
      angles: [{ weight: cInt(3), sweep }, { weight: cInt(-3), sweep }],
    })).toBeNull()
  })

  it('proves distinct signed quarter-turn cancellation but retains a full turn', () => {
    const point = (x: number, y: number) => ({ x: cInt(x), y: cInt(y) })
    const plus = { cx: BigInt(0), cy: BigInt(0), r: BigInt(1), from: point(1, 0), to: point(0, 1) }
    const minus = { cx: BigInt(10), cy: BigInt(0), r: BigInt(1), from: point(10, 1), to: point(11, 0) }
    expect(publishCertifiedSum({
      exact: cInt(7),
      angles: [{ weight: cInt(1), sweep: plus }, { weight: cInt(1), sweep: minus }],
    })).toBeNull()

    const fullTurn = [0, 10, 20, 30].map((cx) => ({
      weight: cInt(1),
      sweep: { cx: BigInt(cx), cy: BigInt(0), r: BigInt(1), from: point(cx + 1, 0), to: point(cx, 1) },
    }))
    expect(publishCertifiedSum({ exact: cInt(7), angles: fullTurn })).not.toBeNull()
  })

  it('retains the actual holed-square π residue and routes a no-hole square to Rational', () => {
    expect(publishCertifiedSum(source())).not.toBeNull()
    const contour = exactContour({ outer: { pts: [[0, 0], [72, 0], [72, 72], [0, 72]] }, holes: [] })
    const rationalArea = exactRegions(contour, toUnits(12, contour)).regions[0].areaExpr
    expect(rationalArea.angles).toEqual([])
    expect(publishCertifiedSum(rationalArea)).toBeNull()
  })
})
