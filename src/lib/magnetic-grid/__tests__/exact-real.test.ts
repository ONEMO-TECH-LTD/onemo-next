import { describe, expect, it } from 'vitest'
import {
  approximateExact,
  affineExact,
  canonicalExact,
  compareExact,
  compareExactToRational,
  compareRational,
  multiplyRational,
  quadraticRootsWithin,
  rational,
  rationalFromNumber,
  signQuadraticAtExact,
  isolatePrimitiveIntegerRoots,
  addSparseIntegerPolynomials,
  normalizeSparseEliminationStep,
  decodeCanonicalMultivariatePolynomial,
  encodeCanonicalMultivariatePolynomial,
  encodeNormalizedSparseEliminationStep,
  projectFinalUnivariatePolynomial,
  pseudoRemainderSparseIntegerPolynomial,
  eliminateSparseGeneratorBySubresultants,
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
    expect(canonicalExact(differentlyIsolated)).not.toBe(canonicalExact(roots[0]))
    expect(compareExactToRational(differentlyIsolated, rational(129))).toBe(1)
    expect(compareExactToRational(differentlyIsolated, rational(131))).toBe(-1)
    expect(compareExact(roots[0], {
      polynomial: ['2', '-384', '16128'],
      isolating: differentlyIsolated.isolating,
      rootIndex: 1,
    })).toBe(0)
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
  it('factorizes multiplicity before isolating equal-end-sign roots',()=>{const roots=isolatePrimitiveIntegerRoots(['1','-8','22','-24','9'],rational(0),rational(5));expect(roots).toHaveLength(2);expect(roots.map(root=>root.multiplicity)).toEqual([2,2])})
  it('does not confuse an unrelated derivative critical point with multiplicity',()=>{const roots=isolatePrimitiveIntegerRoots(['1','0','-3','1'],rational(-3),rational(3));expect(roots).toHaveLength(3);expect(roots.map(root=>root.multiplicity)).toEqual([1,1,1])})
  it('globally orders disjoint square-free factors and exact midpoint roots',()=>{const roots=isolatePrimitiveIntegerRoots(['1','-8','23','-28','12'],rational(0),rational(5));expect(roots.map(root=>root.multiplicity)).toEqual([1,2,1]);for(let index=1;index<roots.length;index++)expect(compareRational(roots[index-1].isolating[1],roots[index].isolating[0])).toBe(-1);const midpoint=isolatePrimitiveIntegerRoots(['1','-2'],rational(0),rational(4));expect(midpoint).toHaveLength(1);expect(midpoint[0].isolating).toEqual([rational(2),rational(2)])})
  it('preserves raw relative coefficients until elimination-step normalization',()=>{const sum=addSparseIntegerPolynomials([{coefficient:'2',powers:[1]}],[{coefficient:'4',powers:[0]}]);expect(sum).toEqual([{coefficient:'2',powers:[1]},{coefficient:'4',powers:[0]}]);expect(normalizeSparseEliminationStep(sum)).toEqual({polynomial:[{coefficient:'1',powers:[1]},{coefficient:'2',powers:[0]}],removedIntegerContent:['2','1']})})
  it('encodes source terms canonically and rejects every noncanonical proof spelling',()=>{const source=[{coefficient:'1',powers:[1,0]},{coefficient:'1',powers:[1,0]},{coefficient:'4',powers:[0,0]}];expect(encodeCanonicalMultivariatePolynomial(source,2)).toEqual(['2|1,0','4|0,0']);expect(encodeCanonicalMultivariatePolynomial([...source].reverse(),2)).toEqual(['2|1,0','4|0,0']);for(const invalid of[['+2|1,0'],['02|1,0'],['-0|1,0'],['0|1,0'],['2|1'],['4|0,0','2|1,0'],['1|1,0','1|1,0'],['0']])expect(()=>decodeCanonicalMultivariatePolynomial(invalid,2)).toThrow();expect(decodeCanonicalMultivariatePolynomial(['2|1,0','4|0,0'],2)).toEqual([{coefficient:'2',powers:[1,0]},{coefficient:'4',powers:[0,0]}]);expect(decodeCanonicalMultivariatePolynomial([],2)).toEqual([])})
  it('normalizes only completed steps and records final projection slots',()=>{const step=encodeNormalizedSparseEliminationStep([{coefficient:'2',powers:[1,0,0]},{coefficient:'4',powers:[0,0,0]}],3);expect(step).toEqual({tokens:['1|1,0,0','2|0,0,0'],removedIntegerContent:['2','1']});expect(projectFinalUnivariatePolynomial(step.tokens,3)).toEqual({coefficients:['1','2'],removedExponentSlots:[1,2]})})
  it('computes exact multivariate pseudo-remainders without normalization loss',()=>{const dividend=[{coefficient:'1',powers:[0,2]},{coefficient:'1',powers:[1,0]}],divisor=[{coefficient:'1',powers:[0,1]},{coefficient:'-1',powers:[0,0]}];expect(pseudoRemainderSparseIntegerPolynomial(dividend,divisor,1)).toEqual([{coefficient:'1',powers:[1,0]},{coefficient:'1',powers:[0,0]}])})
  it('derives zero predicates and carries exact common-component cofactors pending back-substitution',()=>{const defining=[{coefficient:'1',powers:[0,1]},{coefficient:'-1',powers:[0,0]}],shared=[{coefficient:'1',powers:[1,1]},{coefficient:'-1',powers:[1,0]}],decomposed=eliminateSparseGeneratorBySubresultants(shared,defining,1,2);expect(decomposed.commonFactorDisposition).toBe('DECOMPOSED');expect(decomposed.commonComponentProofs).toEqual([{gcd:['1|0,1','-1|0,0'],predicateCofactor:['1|1,0'],definingCofactor:['1|0,0'],backSubstitutionDisposition:'PENDING'}]);expect(decomposed.resolved).toBe(false);expect(decomposed.unresolved).toBe(false);const zero=eliminateSparseGeneratorBySubresultants([],defining,1,2);expect(zero.commonFactorDisposition).toBe('IDENTICALLY_ZERO');expect(zero.zeroPolynomialProofSource).toEqual([]);expect(zero.resolved).toBe(true)})
})
