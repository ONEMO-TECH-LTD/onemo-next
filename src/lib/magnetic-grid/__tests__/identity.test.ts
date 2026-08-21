import { describe, expect, it } from 'vitest'
import {
  algebraicGeneratorProofs,
  certifySqrtQuadraticExpression,
  contourIdentity,
  sha256Text,
  validateCertifiedExpressionIdentity,
} from '../compute/identity'
import {
  approximateExact,
  compareExactToRational,
  quadraticRootsWithin,
  rational,
} from '../compute/exact-real'
import type { Contour } from '../spec'

const contour = (points: [number, number][], holes: Contour['holes'] = []): Contour => ({
  outer: { pts: points }, holes,
})

const sqrt2 = (
  semanticSourceIdentity: string,
  positive: boolean,
  definingPolynomial: readonly string[] = ['1', '0', '-2'],
  isolating = positive ? [rational(1), rational(2)] as const : [rational(-2), rational(-1)] as const,
) => ({
  semanticSourceIdentity,
  definingPolynomial,
  representedRootIndex: positive ? 1 : 0,
  representedIsolating: isolating,
})

describe('Wrap canonical identity', () => {
  it('matches the SHA-256 known vector', () =>
    expect(sha256Text('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'))

  it('is stable for identical ordered bits and changes with order, content and holes', () => {
    const a = contour([[0, 0], [1, 0], [0, 1]])
    expect(contourIdentity(a)).toBe(contourIdentity(a))
    expect(contourIdentity(a)).not.toBe(contourIdentity(contour([[1, 0], [0, 0], [0, 1]])))
    expect(contourIdentity(a)).not.toBe(contourIdentity(contour(
      [[0, 0], [1, 0], [0, 1]],
      [{ pts: [[.1, .1], [.2, .1], [.1, .2]] }],
    )))
  })

  it('serializes, validates and replays a certified scale-coupled expression canonically', () => {
    const scale = quadraticRootsWithin(rational(1), rational(-192), rational(8064), rational(129), rational(131))[0]
    const value = certifySqrtQuadraticExpression(
      scale, [rational(1), rational(-192), rational(9216)], rational(0),
    )
    expect(approximateExact(value)).toBeCloseTo(24 * Math.SQRT2, 12)
    expect(compareExactToRational(value, rational(33))).toBe(1)
    expect(compareExactToRational(value, rational(34))).toBe(-1)
    expect(structuredClone(value)).toEqual(value)
    expect(certifySqrtQuadraticExpression(
      scale, [rational(1), rational(-192), rational(9216)], rational(0),
    )).toEqual(value)
    if (!('expressionHash' in value)) return
    validateCertifiedExpressionIdentity(value)
    expect(() => validateCertifiedExpressionIdentity({ ...value, expressionHash: '0'.repeat(64) })).toThrow()
    expect(() => validateCertifiedExpressionIdentity({ ...value, proofId: '0'.repeat(64) })).toThrow()
    expect(() => validateCertifiedExpressionIdentity({ ...value, isolating: [rational(0), rational(1)] })).toThrow()
    const expression = [...value.expression.slice(0, 5), JSON.stringify(rational(100))]
    const expressionHash = sha256Text(JSON.stringify(expression))
    const proofId = sha256Text(JSON.stringify(['sqrt-quadratic-proof-v1', expressionHash]))
    expect(() => validateCertifiedExpressionIdentity({
      ...value, expression, expressionHash, proofId,
    })).toThrow('certified expression bounds')
  })

  it('distinguishes conjugates under one semantic source', () => {
    const proofs = algebraicGeneratorProofs([sqrt2('shared', false), sqrt2('shared', true)])
    expect(proofs).toHaveLength(2)
    expect(proofs.map((proof) => proof.representedRootIndex).sort()).toEqual([0, 1])
    expect(proofs[0].generatorIdentity).not.toBe(proofs[1].generatorIdentity)
  })

  it('selects the same minimal factor through extra factors and isolator refinement', () => {
    const direct = algebraicGeneratorProofs([sqrt2('shared', true)])[0]
    const extra = algebraicGeneratorProofs([
      sqrt2('shared', true, ['1', '-3', '-2', '6']),
    ])[0]
    const refined = algebraicGeneratorProofs([
      sqrt2('shared', true, ['1', '0', '-2'], [rational(7, 5), rational(3, 2)]),
    ])[0]
    expect(extra.representedMinimalPolynomial).toEqual(['1', '0', '-2'])
    expect(extra.generatorIdentity).toBe(direct.generatorIdentity)
    expect(refined.generatorIdentity).toBe(direct.generatorIdentity)
    expect(algebraicGeneratorProofs([
      sqrt2('shared', true),
      sqrt2('shared', true, ['1', '-3', '-2', '6']),
      sqrt2('shared', true, ['1', '0', '-2'], [rational(7, 5), rational(3, 2)]),
    ])).toHaveLength(1)
  })

  it('refuses mismatched root indices and multi-factor isolators', () => {
    expect(() => algebraicGeneratorProofs([{
      ...sqrt2('bad-index', true), representedRootIndex: 0,
    }])).toThrow('root index')
    expect(() => algebraicGeneratorProofs([{
      ...sqrt2('ambiguous', true, ['1', '-3', '-2', '6']),
      representedIsolating: [rational(-2), rational(4)] as const,
    }])).toThrow('exactly one')
  })

  it('canonicalizes represented roots across polynomial and isolator representations', () => {
    const coarse = {
      semanticSourceIdentity: 'same-source',
      definingPolynomial: ['1', '0', '-2'],
      representedRootIndex: 1,
      representedIsolating: [rational(1), rational(2)] as const,
    }
    const refined = {
      ...coarse,
      representedIsolating: [rational(7, 5), rational(3, 2)] as const,
    }
    const extraFactor = {
      ...coarse,
      definingPolynomial: ['1', '-3', '-2', '6'],
    }
    const negative = {
      ...coarse,
      representedRootIndex: 0,
      representedIsolating: [rational(-2), rational(-1)] as const,
    }
    const otherSource = { ...coarse, semanticSourceIdentity: 'other-source' }

    const forward = algebraicGeneratorProofs([
      coarse,
      refined,
      extraFactor,
      negative,
      otherSource,
    ])
    const reversed = algebraicGeneratorProofs([
      otherSource,
      negative,
      extraFactor,
      refined,
      coarse,
    ])

    expect(forward).toEqual(reversed)
    expect(forward).toHaveLength(3)

    const samePositive = forward.find(
      (proof) => proof.semanticSourceIdentity === 'same-source'
        && proof.representedRootIndex === 1,
    )!
    expect(samePositive.normalizedDefiningPolynomial).toEqual(['1', '0', '-2'])
    expect(samePositive.representedMinimalPolynomial).toEqual(['1', '0', '-2'])
    expect(samePositive.representedIsolating).not.toEqual(coarse.representedIsolating)
    expect(samePositive.representedIsolating).not.toEqual(refined.representedIsolating)

    expect(new Set(forward.map((proof) => proof.generatorIdentity)).size).toBe(3)
  })

  it('rejects a repeated-factor defining polynomial instead of choosing a root', () => {
    expect(() => algebraicGeneratorProofs([{
      semanticSourceIdentity: 'repeated',
      definingPolynomial: ['1', '-2', '1'],
      representedRootIndex: 0,
      representedIsolating: [rational(0), rational(2)],
    }])).toThrow('square-free')
  })
})
