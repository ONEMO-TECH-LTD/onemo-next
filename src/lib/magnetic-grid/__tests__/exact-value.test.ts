import { describe, expect, it } from 'vitest'
import { cInt, cMul, cSqrt, asQuadratic } from '../compute/certified-real'
import { compareAlgebraicReal, decodeCertifiedExpression, evaluateCertifiedExpression } from '../compute/exact-value'
import { decodeRational, encodeCertifiedExpression, encodeQuadraticAlgebraic } from '../compute/identity'
import { exactContour, toUnits } from '../compute/clearance'
import { exactRegions, publishCertifiedSum } from '../compute/region'
import { compareExact, ratSub } from '../compute/exact-real'

const algebraic = (expression: ReturnType<typeof cSqrt>) => encodeQuadraticAlgebraic(asQuadratic(expression)!)!

describe('R14 §7.1 AlgebraicReal comparison', () => {
  it('orders conjugate and distinct algebraic roots', () => {
    const positive = algebraic(cSqrt(cInt(2)))
    const negative = encodeQuadraticAlgebraic(asQuadratic(cMul(cInt(-1), cSqrt(cInt(2))))!)!
    const root3 = algebraic(cSqrt(cInt(3)))
    expect(compareAlgebraicReal(negative, positive)).toBe(-1)
    expect(compareAlgebraicReal(positive, negative)).toBe(1)
    expect(compareAlgebraicReal(positive, root3)).toBe(-1)
    expect(compareAlgebraicReal(root3, positive)).toBe(1)
  })

  it('refines overlapping valid isolators until distinct roots separate', () => {
    const root2 = algebraic(cSqrt(cInt(2)))
    const root3 = algebraic(cSqrt(cInt(3)))
    const overlap = [
      { numerator: '1', denominator: '1' },
      { numerator: '2', denominator: '1' },
    ] as const
    expect(compareAlgebraicReal({ ...root2, isolating: overlap }, { ...root3, isolating: overlap })).toBe(-1)
  })

  it('proves one shared root across different square-free defining polynomials', () => {
    const root2 = algebraic(cSqrt(cInt(2)))
    // (x²-2)(x-3) = x³-3x²-2x+6; sorted roots are -√2, √2, 3.
    const extended = { ...root2, polynomial: ['6', '-2', '-3', '1'], rootIndex: 1 }
    expect(compareAlgebraicReal(root2, extended)).toBe(0)
    expect(compareAlgebraicReal(extended, root2)).toBe(0)
  })

  it('refuses corrupt root indices and non-isolating intervals', () => {
    const root2 = algebraic(cSqrt(cInt(2)))
    expect(compareAlgebraicReal({ ...root2, rootIndex: 0 }, root2)).toBeNull()
    expect(compareAlgebraicReal({
      ...root2,
      isolating: [
        { numerator: '-2', denominator: '1' },
        { numerator: '2', denominator: '1' },
      ],
    }, root2)).toBeNull()
    expect(compareAlgebraicReal({
      ...root2,
      polynomial: ['4', '0', '-4', '0', '1'], // (x²-2)²: one location, repeated factor
    }, root2)).toBeNull()
    expect(compareAlgebraicReal({ ...root2, polynomial: ['not-an-integer'] }, root2)).toBeNull()
  })
})

describe('R14 §7.1b.4 CertifiedExpression reconstruction and refinement', () => {
  const published = () => {
    const contour = exactContour({
      outer: { pts: [[0, 0], [100, 0], [100, 100], [0, 100]] },
      holes: [{ pts: [[40, 40], [60, 40], [60, 60], [40, 60]] }],
    })
    return publishCertifiedSum(exactRegions(contour, toUnits(12, contour)).regions[0].areaExpr)!
  }

  it('reconstructs the actual full token stream and refines it at increasing precision', () => {
    const value = published()
    expect(decodeCertifiedExpression(value)).not.toBeNull()
    const coarse = evaluateCertifiedExpression(value, BigInt(64))!
    const fine = evaluateCertifiedExpression(value, BigInt(256))!
    expect(compareExact(fine[0], coarse[0])).toBeGreaterThanOrEqual(0)
    expect(compareExact(fine[1], coarse[1])).toBeLessThanOrEqual(0)
    expect(compareExact(ratSub(fine[1], fine[0]), ratSub(coarse[1], coarse[0]))).toBeLessThanOrEqual(0)
  })

  it('refuses corrupted grammar, proof identity, token order and excluding bounds', () => {
    const value = published()
    const forged = (expression: readonly string[]) => encodeCertifiedExpression({
      expression,
      isolating: [decodeRational(value.isolating[0]), decodeRational(value.isolating[1])],
    })!
    expect(decodeCertifiedExpression(forged([...value.expression.slice(0, 2), 'angle:not-valid']))).toBeNull()
    const point = (x: number, y: number) => ({ x: cInt(x), y: cInt(y) })
    const twoTerm = publishCertifiedSum({
      exact: cInt(7),
      angles: [
        { weight: cInt(1), sweep: { cx: BigInt(0), cy: BigInt(0), r: BigInt(1), from: point(1, 0), to: point(0, 1) } },
        { weight: cInt(1), sweep: { cx: BigInt(10), cy: BigInt(0), r: BigInt(5), from: point(15, 0), to: point(13, 4) } },
      ],
    })!
    expect(twoTerm.expression).toHaveLength(4)
    expect(decodeCertifiedExpression(twoTerm)).not.toBeNull()
    const reversedAngles = twoTerm.expression.slice(2).reverse().map(String)
    const reversedCertificate = encodeCertifiedExpression({
      expression: [twoTerm.expression[0], twoTerm.expression[1], ...reversedAngles].map(String),
      isolating: [decodeRational(twoTerm.isolating[0]), decodeRational(twoTerm.isolating[1])],
    })!
    expect(decodeCertifiedExpression(reversedCertificate)).toBeNull()
    const noncanonical = value.expression.map((token, index) => index === 1
      ? token.replace(/\/(\d+)/, (_match, digits: string) => `/0${digits}`)
      : token)
    expect(noncanonical).not.toEqual(value.expression)
    expect(decodeCertifiedExpression(forged(noncanonical))).toBeNull()

    expect(decodeCertifiedExpression({ ...value, expressionHash: `corrupt:${value.expressionHash}` })).toBeNull()
    expect(decodeCertifiedExpression({ ...value, proofId: `corrupt:${value.proofId}` })).toBeNull()
    expect(decodeCertifiedExpression({
      ...value,
      isolating: [{ numerator: '0', denominator: '1' }, { numerator: '1', denominator: '1' }],
      expressionHash: value.expressionHash,
      proofId: value.proofId,
    })).toBeNull()
    expect(evaluateCertifiedExpression(value, BigInt(0))).toBeNull()
  })
})
