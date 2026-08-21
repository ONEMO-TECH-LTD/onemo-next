import { describe, expect, it } from 'vitest'
import {
  algebraicGeneratorProofs,
  certifyAlgebraicTuple,
  certifyAlgebraicTupleValue,
  certifyCandidateBackSubstitution,
  certifySqrtQuadraticExpression,
  contourIdentity,
  sha256Text,
  validateCertifiedExpressionIdentity,
  mergeCandidateBackSubstitutionProofs,
} from '../compute/identity'
import {
  approximateExact,
  compareExactToRational,
  quadraticRootsWithin,
  rational,
  constructRawAlgebraicTuple,
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

  it('evaluates dependent algebraic tuple coordinates exactly', () => {
    const generators = algebraicGeneratorProofs([
      sqrt2('a', true),
      {
        semanticSourceIdentity: 'b', definingPolynomial: ['1', '0', '-8'],
        representedRootIndex: 1, representedIsolating: [rational(2), rational(3)],
      },
    ])
    const values = generators.map((proof) => ({
      valueIdentity: proof.generatorIdentity,
      exact: {
        polynomial: proof.representedMinimalPolynomial,
        rootIndex: proof.representedRootIndex,
        isolating: proof.representedIsolating,
      },
      proof,
    }))
    const tuple = certifyAlgebraicTuple(values)
    expect(tuple.status).toBe('resolved')
    if (tuple.status !== 'resolved') return
    const identities = generators.map((proof) => proof.generatorIdentity)
    const reorderedTuple = certifyAlgebraicTuple([...values].reverse())
    expect(reorderedTuple).toEqual(tuple)

    const forgedCoordinate = {
      ...tuple.proof,
      coordinates: tuple.proof.coordinates.map((coordinate, index) => index === 0
        ? { ...coordinate, numerator: ['999'] }
        : coordinate),
    }
    expect(certifyAlgebraicTupleValue(
      forgedCoordinate,
      values,
      'forged-coordinate',
      [{ coefficient: '-2', powers: [1, 0] }, { coefficient: '1', powers: [0, 1] }],
      identities,
    )).toBeNull()

    const zeroDenominator = {
      ...tuple.proof,
      coordinates: tuple.proof.coordinates.map((coordinate, index) => index === 0
        ? { ...coordinate, denominator: ['0'] }
        : coordinate),
    }
    expect(certifyAlgebraicTupleValue(
      zeroDenominator,
      values,
      'zero-denominator',
      [{ coefficient: '1', powers: [1, 0] }],
      identities,
    )).toBeNull()
    const zero = certifyAlgebraicTupleValue(
      tuple.proof, values, 'b-minus-2a',
      [{ coefficient: '-2', powers: [1, 0] }, { coefficient: '1', powers: [0, 1] }],
      identities,
    )
    expect(zero?.disposition).toBe('ZERO')
  })

  it('distinguishes opposite conjugates and algebraic parameter tuples', () => {
    const conjugates = algebraicGeneratorProofs([sqrt2('a', true), sqrt2('b', false)])
    const conjugateValues = conjugates.map((proof) => ({
      valueIdentity: proof.generatorIdentity,
      exact: { polynomial: proof.representedMinimalPolynomial, rootIndex: proof.representedRootIndex, isolating: proof.representedIsolating },
      proof,
    }))
    const conjugateTuple = certifyAlgebraicTuple(conjugateValues)
    expect(conjugateTuple.status).toBe('resolved')
    if (conjugateTuple.status !== 'resolved') return
    const ids = conjugates.map((proof) => proof.generatorIdentity)
    expect(certifyAlgebraicTupleValue(conjugateTuple.proof, conjugateValues, 'sum', [
      { coefficient: '1', powers: [1, 0] }, { coefficient: '1', powers: [0, 1] },
    ], ids)?.disposition).toBe('ZERO')
    expect(certifyAlgebraicTupleValue(conjugateTuple.proof, conjugateValues, 'difference', [
      { coefficient: '1', powers: [1, 0] }, { coefficient: '-1', powers: [0, 1] },
    ], ids)?.disposition).toBe('NONZERO')

    const root3 = quadraticRootsWithin(rational(1), rational(0), rational(-3), rational(1), rational(2))[0]
    const sqrt2Proof = algebraicGeneratorProofs([sqrt2('a', true)])[0]
    const back = certifyCandidateBackSubstitution(
      'sqrt3', root3, 1, 'zero-sum',
      [
        { coefficient: '1', powers: [2, 0] }, { coefficient: '-3', powers: [0, 0] },
        { coefficient: '1', powers: [0, 2] }, { coefficient: '-2', powers: [0, 0] },
      ],
      [sqrt2Proof],
    )
    expect(back.status).toBe('resolved')
    if (back.status === 'resolved') expect(back.proof.disposition).toBe('VALID_ROOT')
    const candidateProof = algebraicGeneratorProofs([{
      semanticSourceIdentity: 'sqrt3', definingPolynomial: ['1', '0', '-3'],
      representedRootIndex: 1, representedIsolating: [rational(1), rational(2)],
    }])[0]
    const tupleValues = [
      { valueIdentity: candidateProof.generatorIdentity, exact: root3, proof: candidateProof },
      { valueIdentity: sqrt2Proof.generatorIdentity, exact: {
        polynomial: sqrt2Proof.representedMinimalPolynomial,
        rootIndex: sqrt2Proof.representedRootIndex,
        isolating: sqrt2Proof.representedIsolating,
      }, proof: sqrt2Proof },
    ]
    const algebraicTuple = certifyAlgebraicTuple(tupleValues)
    expect(algebraicTuple.status).toBe('resolved')
    if (algebraicTuple.status === 'resolved') {
      expect(certifyAlgebraicTupleValue(
        algebraicTuple.proof, tupleValues, 'x-minus-a',
        [{ coefficient: '1', powers: [1, 0] }, { coefficient: '-1', powers: [0, 1] }],
        [candidateProof.generatorIdentity, sqrt2Proof.generatorIdentity],
      )?.disposition).toBe('NONZERO')
    }
  })

  it('records rejected primitive vectors and fails closed on a zero coordinate denominator', () => {
    const generators = algebraicGeneratorProofs([sqrt2('a', true), sqrt2('b', false)])
    const values = generators.map((proof) => ({
      valueIdentity: proof.generatorIdentity,
      exact: { polynomial: proof.representedMinimalPolynomial, rootIndex: proof.representedRootIndex, isolating: proof.representedIsolating },
      proof,
    }))
    const raw = constructRawAlgebraicTuple(values)
    expect(raw).not.toBeNull()
    expect(raw!.rejectedCoefficientVectors.length).toBeGreaterThan(0)
    const tuple = certifyAlgebraicTuple(values)
    expect(tuple.status).toBe('resolved')
    if (tuple.status !== 'resolved') return
    const invalid = {
      ...tuple.proof,
      coordinates: tuple.proof.coordinates.map((coordinate, index) => index === 0
        ? { ...coordinate, denominator: tuple.proof.primitiveMinimalPolynomial }
        : coordinate),
    }
    expect(certifyAlgebraicTupleValue(
      invalid, values, 'denominator-mutation', [{ coefficient: '1', powers: [1, 0] }],
      generators.map((proof) => proof.generatorIdentity),
    )).toBeNull()
  })

  it('records and skips a non-separating primitive coefficient vector', () => {
    const conjugates = algebraicGeneratorProofs([sqrt2('left', true), sqrt2('right', false)])
    const values = conjugates.map((proof) => ({
      valueIdentity: proof.generatorIdentity,
      exact: {
        polynomial: proof.representedMinimalPolynomial,
        rootIndex: proof.representedRootIndex,
        isolating: proof.representedIsolating,
      },
      proof,
    }))
    const raw = constructRawAlgebraicTuple(values)
    expect(raw).not.toBeNull()
    expect(raw!.rejectedCoefficientVectors.length).toBeGreaterThan(0)
  })

  it('proves true multiplicity from original derivatives, not resultant multiplicity', () => {
    const generator = algebraicGeneratorProofs([sqrt2('g', true)])[0]
    const simple = certifyCandidateBackSubstitution(
      'x-zero', rational(0), 2, 'x-times-g-minus-3',
      [{ coefficient: '1', powers: [1, 1] }, { coefficient: '-3', powers: [1, 0] }],
      [generator],
    )
    expect(simple.status).toBe('resolved')
    if (simple.status === 'resolved') {
      expect(simple.proof.disposition).toBe('VALID_ROOT')
      expect(simple.proof.resultantMultiplicity).toBe(2)
      expect(simple.proof.trueMultiplicity).toBe(1)
    }
    const extraneous = certifyCandidateBackSubstitution(
      'x-zero', rational(0), 1, 'g-minus-3',
      [{ coefficient: '1', powers: [0, 1] }, { coefficient: '-3', powers: [0, 0] }],
      [generator],
    )
    expect(extraneous.status).toBe('resolved')
    if (extraneous.status === 'resolved') expect(extraneous.proof.disposition).toBe('EXTRANEOUS_ROOT')
    const double = certifyCandidateBackSubstitution(
      'x-zero', rational(0), 4, 'x-squared', [{ coefficient: '1', powers: [2] }], [],
    )
    expect(double.status).toBe('resolved')
    if (double.status === 'resolved') expect(double.proof.trueMultiplicity).toBe(2)
    const branch = certifyCandidateBackSubstitution(
      'x-zero', rational(0), 2, 'x-times-minimal',
      [{ coefficient: '1', powers: [1, 2] }, { coefficient: '-2', powers: [1, 0] }],
      [generator],
    )
    expect(branch.status).toBe('resolved')
    if (branch.status === 'resolved') expect(branch.proof.disposition).toBe('IDENTICALLY_ZERO_BRANCH')
  })

  it('merges agreeing duplicate roots and refuses disagreement without partial proofs', () => {
    const first = certifyCandidateBackSubstitution(
      'same-root', rational(0), 2, 'x', [{ coefficient: '1', powers: [1] }], [],
    )
    const second = certifyCandidateBackSubstitution(
      'same-root', rational(0), 3, 'x', [{ coefficient: '1', powers: [1] }], [],
    )
    const merged = mergeCandidateBackSubstitutionProofs([first, second])
    expect(merged.status).toBe('resolved')
    if (merged.status === 'resolved') expect(merged.proofs).toHaveLength(1)
    if (first.status !== 'resolved') return
    const conflict = mergeCandidateBackSubstitutionProofs([
      first,
      { status: 'resolved', proof: { ...first.proof, trueMultiplicity: 2 }, proofId: 'conflict' },
    ])
    expect(conflict).toEqual({
      status: 'unresolved', code: 'CENTRE_EVIDENCE_UNRESOLVED', proofs: [],
    })
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
