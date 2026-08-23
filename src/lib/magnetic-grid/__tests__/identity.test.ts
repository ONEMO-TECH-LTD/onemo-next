import { describe,expect,it } from 'vitest'
import { contourIdentity } from '../compute/identity'
import type { Contour } from '../spec'
const contour=(points:[number,number][],holes:Contour['holes']=[]):Contour=>({outer:{pts:points},holes})
describe('contour identity',()=>{
  it('is the canonical ordered coordinate string: stable for identical bits, changed by order, content and holes',()=>{
    const a=contour([[0,0],[1,0],[0,1]])
    expect(contourIdentity(a)).toBe(contourIdentity(a))
    expect(contourIdentity(a)).toBe('[["outer",[[0,0],[1,0],[0,1]]]]')
    expect(contourIdentity(a)).not.toBe(contourIdentity(contour([[1,0],[0,0],[0,1]])))
    expect(contourIdentity(a)).not.toBe(contourIdentity(contour([[0,0],[1,0],[0,1.0000001]])))
    expect(contourIdentity(a)).not.toBe(contourIdentity(contour([[0,0],[1,0],[0,1]],[{pts:[[.1,.1],[.2,.1],[.1,.2]]}])))
  })
})
