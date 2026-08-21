import { describe,expect,it } from 'vitest'
import { certifySqrtQuadraticExpression,contourIdentity,sha256Text } from '../compute/identity'
import { approximateExact,compareExactToRational,quadraticRootsWithin,rational } from '../compute/exact-real'
import type { Contour } from '../spec'
const contour=(points:[number,number][],holes:Contour['holes']=[]):Contour=>({outer:{pts:points},holes})
describe('Wrap canonical identity',()=>{
  it('matches the SHA-256 known vector',()=>expect(sha256Text('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'))
  it('is stable for identical ordered bits and changes with order, content and holes',()=>{const a=contour([[0,0],[1,0],[0,1]]);expect(contourIdentity(a)).toBe(contourIdentity(a));expect(contourIdentity(a)).not.toBe(contourIdentity(contour([[1,0],[0,0],[0,1]])));expect(contourIdentity(a)).not.toBe(contourIdentity(contour([[0,0],[1,0],[0,1]],[{pts:[[.1,.1],[.2,.1],[.1,.2]]}])))})
  it('serializes and replays a certified scale-coupled expression canonically',()=>{const scale=quadraticRootsWithin(rational(1),rational(-192),rational(8064),rational(129),rational(131))[0];const value=certifySqrtQuadraticExpression(scale,[rational(1),rational(-192),rational(9216)],rational(0));expect(approximateExact(value)).toBeCloseTo(24*Math.SQRT2,12);expect(compareExactToRational(value,rational(33))).toBe(1);expect(compareExactToRational(value,rational(34))).toBe(-1);expect(structuredClone(value)).toEqual(value);expect(certifySqrtQuadraticExpression(scale,[rational(1),rational(-192),rational(9216)],rational(0))).toEqual(value)})
})
