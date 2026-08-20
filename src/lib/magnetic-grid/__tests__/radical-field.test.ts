// The multi-radical sign kernel decides values that live in several square roots at once — the
// case the offset arrangement produces at a convex miter, where one point carries two edges' length
// radicals and a third edge's crossing adds another. Interval refinement can prove such a value
// nonzero but never zero, so the whole point of this kernel is the equalities.
//
// Its soundness rests on one invariant: radicands are reduced to PAIRWISE COPRIME atoms, none of
// them a perfect square. Radicands are not independent generators — √2·√3 and √6 are the same
// number — and every oracle below is a way that invariant can fail. Each is asserted in both
// operand orders and, where a quotient can express the same identity, as a quotient too.

import { describe, expect, it } from 'vitest'
import {
  cAdd, cDiv, cInt, cMul, cNeg, cRat, cSqrt, cSub, canonicalRadicalAtoms, radicalFieldSign, type CReal,
} from '../compute/certified-real'
import { rational } from '../compute/exact-real'

const sq = (v: number | bigint) => cSqrt(cInt(v))
const ratOf = (n: number, d: number) => cRat(rational(BigInt(n), BigInt(d)))

describe('multi-radical exact sign', () => {
  it('proves the dependency identities — the falsifiers for an independent-generator model', () => {
    const zeros: ReadonlyArray<{ id: string; e: CReal }> = [
      // the direct falsifier: √2·√3 and √6 must be one value, not two generators
      { id: 'sqrt2*sqrt3 - sqrt6', e: cSub(cMul(sq(2), sq(3)), sq(6)) },
      { id: 'sqrt6 - sqrt2*sqrt3', e: cSub(sq(6), cMul(sq(2), sq(3))) },
      // square factors must leave the radical exactly, with no factoring cutoff
      { id: 'sqrt12 - 2*sqrt3', e: cSub(sq(12), cMul(cInt(2), sq(3))) },
      { id: '2*sqrt3 - sqrt12', e: cSub(cMul(cInt(2), sq(3)), sq(12)) },
      { id: 'sqrt50 - 5*sqrt2', e: cSub(sq(50), cMul(cInt(5), sq(2))) },
      // a large square factor: 1009² · 2, well beyond any trial-division cutoff
      { id: 'sqrt(1009^2*2) - 1009*sqrt2', e: cSub(sq(BigInt(1009) * BigInt(1009) * BigInt(2)), cMul(cInt(1009), sq(2))) },
      // products that share a factor: √6·√10 = 2√15
      { id: 'sqrt6*sqrt10 - 2*sqrt15', e: cSub(cMul(sq(6), sq(10)), cMul(cInt(2), sq(15))) },
      { id: '2*sqrt15 - sqrt6*sqrt10', e: cSub(cMul(cInt(2), sq(15)), cMul(sq(6), sq(10))) },
      // three-way overlap, the shape a miter comparison actually takes
      { id: 'sqrt2*sqrt3*sqrt5 - sqrt30', e: cSub(cMul(cMul(sq(2), sq(3)), sq(5)), sq(30)) },
      { id: 'sqrt(1/2) - sqrt2/2', e: cSub(cSqrt(ratOf(1, 2)), cDiv(sq(2), cInt(2))) },
      { id: 'sqrt(8/9) - 2*sqrt2/3', e: cSub(cSqrt(ratOf(8, 9)), cDiv(cMul(cInt(2), sq(2)), cInt(3))) },
    ]
    for (const { id, e } of zeros) {
      expect(radicalFieldSign(e), id).toBe(0)
      expect(radicalFieldSign(cNeg(e)), `-(${id})`).toBe(0)
    }
  })

  it('decides the same identities as quotients, where the radical sits below the line', () => {
    // an offset normal is literally a vector over √(len²), so radical denominators are the norm
    const quotients: ReadonlyArray<{ id: string; e: CReal; sign: -1 | 0 | 1 }> = [
      { id: 'sqrt6/sqrt2 - sqrt3', e: cSub(cDiv(sq(6), sq(2)), sq(3)), sign: 0 },
      { id: 'sqrt3 - sqrt6/sqrt2', e: cSub(sq(3), cDiv(sq(6), sq(2))), sign: 0 },
      { id: '1/sqrt2 - sqrt2/2', e: cSub(cDiv(cInt(1), sq(2)), cDiv(sq(2), cInt(2))), sign: 0 },
      { id: 'sqrt12/sqrt3 - 2', e: cSub(cDiv(sq(12), sq(3)), cInt(2)), sign: 0 },
      { id: '(sqrt2+sqrt3)/(sqrt2+sqrt3) - 1', e: cSub(cDiv(cAdd(sq(2), sq(3)), cAdd(sq(2), sq(3))), cInt(1)), sign: 0 },
      // a two-term radical denominator, cleared by conjugates: 1/(√3−√2) = √3+√2
      { id: '1/(sqrt3-sqrt2) - (sqrt3+sqrt2)', e: cSub(cDiv(cInt(1), cSub(sq(3), sq(2))), cAdd(sq(3), sq(2))), sign: 0 },
      { id: '5/sqrt5 - sqrt5', e: cSub(cDiv(cInt(5), sq(5)), sq(5)), sign: 0 },
    ]
    for (const { id, e, sign } of quotients) expect(radicalFieldSign(e), id).toBe(sign)
  })

  it('gets genuinely nonzero values right, so the kernel is not simply answering zero', () => {
    const signed: ReadonlyArray<{ id: string; e: CReal; sign: -1 | 1 }> = [
      { id: 'sqrt2 + sqrt3 - sqrt5', e: cSub(cAdd(sq(2), sq(3)), sq(5)), sign: 1 },
      { id: 'sqrt5 - sqrt2 - sqrt3', e: cSub(sq(5), cAdd(sq(2), sq(3))), sign: -1 },
      { id: 'sqrt2 + sqrt3 - sqrt10', e: cSub(cAdd(sq(2), sq(3)), sq(10)), sign: -1 },
      { id: '3*sqrt2 - 4', e: cSub(cMul(cInt(3), sq(2)), cInt(4)), sign: 1 },
      { id: 'sqrt6*sqrt10 - 2*sqrt15 + tiny', e: cAdd(cSub(cMul(sq(6), sq(10)), cMul(cInt(2), sq(15))), ratOf(1, 1000000)), sign: 1 },
      { id: 'sqrt(2) - 1.41421356', e: cSub(sq(2), ratOf(141421356, 100000000)), sign: 1 },
      { id: 'sqrt(2) - 1.41421357', e: cSub(sq(2), ratOf(141421357, 100000000)), sign: -1 },
    ]
    for (const { id, e, sign } of signed) {
      expect(radicalFieldSign(e), id).toBe(sign)
      expect(radicalFieldSign(cNeg(e)), `-(${id})`).toBe(-sign as -1 | 1)
    }
  })

  it('is order-independent: the same value decides the same way however it is written', () => {
    // operand-order permutations of one identity, since the atom set is built from a traversal
    const forms: CReal[] = [
      cSub(cAdd(cMul(sq(2), sq(3)), sq(5)), cAdd(sq(6), sq(5))),
      cSub(cAdd(sq(5), cMul(sq(3), sq(2))), cAdd(sq(5), sq(6))),
      cAdd(cSub(cMul(sq(3), sq(2)), sq(6)), cSub(sq(5), sq(5))),
      cSub(cAdd(sq(5), sq(6)), cAdd(cMul(sq(2), sq(3)), sq(5))),
    ]
    for (const e of forms) expect(radicalFieldSign(e)).toBe(0)
    // and a shape where an atom must SPLIT: √6 seen first, then √2 — 6 must become 2·3
    expect(radicalFieldSign(cSub(cMul(sq(6), sq(2)), cMul(cInt(2), sq(3))))).toBe(0)
    expect(radicalFieldSign(cSub(cMul(sq(2), sq(6)), cMul(cInt(2), sq(3))))).toBe(0)
    // the same, with the splitting radicand introduced last
    expect(radicalFieldSign(cSub(cMul(cInt(2), sq(3)), cMul(sq(6), sq(2))))).toBe(0)
  })

  it('reports unknown rather than guessing when the value leaves the field', () => {
    // a nested radical is outside this representation entirely
    expect(radicalFieldSign(cSub(cSqrt(cAdd(cInt(1), sq(2))), cInt(1)))).toBeNull()
    // and a negative radicand is not a real value at all
    expect(radicalFieldSign(cSqrt(cInt(-4)))).toBeNull()
  })

  it('reduces radicands to pairwise-coprime, square-free atoms', () => {
    // The sign recursion compares a² against b²k, which is valid however the atoms relate, so a
    // wrong reduction does not have to show up in a sign. The invariant is therefore asserted on
    // its own: every pair coprime, none a perfect square, and no radicand left undecomposed.
    const gcdOf = (a: bigint, b: bigint): bigint => (b === BigInt(0) ? a : gcdOf(b, a % b))
    const cases: ReadonlyArray<{ id: string; e: CReal; expect: bigint[] }> = [
      { id: '2,3 then 6', e: cSub(cMul(sq(2), sq(3)), sq(6)), expect: [BigInt(2), BigInt(3)] },
      { id: '6 then 2', e: cSub(cMul(sq(6), sq(2)), cMul(cInt(2), sq(3))), expect: [BigInt(2), BigInt(3)] },
      { id: '12 alone reduces to 3', e: cSub(sq(12), cMul(cInt(2), sq(3))), expect: [BigInt(3)] },
      { id: '50 alone reduces to 2', e: cSub(sq(50), cMul(cInt(5), sq(2))), expect: [BigInt(2)] },
      { id: 'large square factor', e: cSub(sq(BigInt(1009) * BigInt(1009) * BigInt(2)), cMul(cInt(1009), sq(2))), expect: [BigInt(2)] },
      { id: '6 and 10 split to 2,3,5', e: cSub(cMul(sq(6), sq(10)), cMul(cInt(2), sq(15))), expect: [BigInt(2), BigInt(3), BigInt(5)] },
    ]
    for (const { id, e, expect: wanted } of cases) {
      const atoms = canonicalRadicalAtoms(e)
      expect(atoms, id).toEqual(wanted)
      for (const atom of atoms!) {
        const root = BigInt(Math.round(Math.sqrt(Number(atom))))
        expect(root * root === atom, `${id}: atom ${atom} is a perfect square`).toBe(false)
      }
      for (let i = 0; i < atoms!.length; i++) for (let j = i + 1; j < atoms!.length; j++) {
        expect(gcdOf(atoms![i], atoms![j]), `${id}: atoms ${atoms![i]},${atoms![j]} share a factor`).toBe(BigInt(1))
      }
    }
  })
})
