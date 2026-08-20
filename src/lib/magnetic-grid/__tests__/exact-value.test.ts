import { describe, expect, it } from 'vitest'
import { cInt, cMul, cSqrt, asQuadratic } from '../compute/certified-real'
import { compareAlgebraicReal } from '../compute/exact-value'
import { encodeQuadraticAlgebraic } from '../compute/identity'

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
