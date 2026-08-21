import { describe,expect,it } from 'vitest'
import { getShape } from '../../shape-library'
import { makeSizer,normBaseContour } from '../../effect/magnetic-grid-bridge'
import { computeGrid } from '../engine'
import { measureWrap,prepareContour } from '../compute/contact-root'
import { certifyContactWitness,contourBoundaryTruth } from '../compute/identity'
import { canonicalExact,rational } from '../compute/exact-real'

describe('Wrap admitted product contour',()=>{
  it('carries the real comparison-shell squircle bytes and witness provenance',()=>{
    const base=normBaseContour(getShape('squircle',1024,1024),1024)
    expect(base).not.toBeNull()
    const contour=makeSizer(base!,0)(72),truth=contourBoundaryTruth(contour),prepared=prepareContour(contour,truth)
    const measured=measureWrap(prepared,[[26,26]],12),witnesses=measured.witnesses.map(certifyContactWitness)
    expect(prepared.source).toBe(contour)
    expect(prepared.boundary).toHaveLength(contour.outer.pts.length+contour.holes.reduce((sum,hole)=>sum+hole.pts.length,0))
    expect(measured.refusal).toBeNull()
    expect(witnesses.length).toBeGreaterThan(0)
    expect(witnesses[0].boundaryTruth).toEqual(truth)
    expect(witnesses.every(witness=>witness.boundaryTruth.contourIdentity===truth.contourIdentity)).toBe(true)
    expect(witnesses.every(witness=>prepared.boundary.some(element=>element.id===witness.outlineElementId))).toBe(true)
    expect(structuredClone(witnesses)).toEqual(witnesses)
  })
  it('makes the live square24 contour contact exactly and preserves supplied holes while scaling',()=>{
    const base=normBaseContour(getShape('square',1024,1024),1024)!,contour=makeSizer(base,0)(24)
    const grid=computeGrid(contour,{paddingMM:12,flapMM:0,wrapMode:'fixed',centreMode:0,perimeterOnly:true})
    expect(Math.max(...contour.outer.pts.map(point=>point[0]))-Math.min(...contour.outer.pts.map(point=>point[0]))).toBe(24)
    expect(grid.wrap.status).toBe('lawful')
    expect(grid.wrap.requiredFlapApproxMM).toBe(0)
    expect(grid.wrap.witnesses.length).toBeGreaterThan(0)
    expect(canonicalExact(grid.wrap.witnesses[0].scale.exact)).toBe(canonicalExact(rational(24)))
    const raw={outer:{pts:base.outer.pts.map(([x,y])=>[x*24,y*24] as [number,number])},holes:[]}
    const rawGrid=computeGrid(raw,{paddingMM:12,flapMM:0,wrapMode:'fixed',centreMode:0,perimeterOnly:true})
    expect(canonicalExact(rawGrid.wrap.witnesses[0].scale.exact)).not.toBe(canonicalExact(rational(24)))
    const holed={outer:{pts:[[0,0],[1,0],[1,1],[0,1]] as [number,number][]},holes:[{pts:[[.25,.25],[.75,.25],[.75,.75],[.25,.75]] as [number,number][]}]}
    const scaled=makeSizer(holed,0)(24)
    expect(scaled.holes).toHaveLength(1)
    expect(scaled.holes[0].pts).toHaveLength(4)
  })
  it('keeps the public 12mm default, magnet-plan positions and outline identity truthful',()=>{
    const base=normBaseContour(getShape('square',1024,1024),1024)!,plain=makeSizer(base,0)(72),offset=makeSizer(base,1)(72)
    const all6=computeGrid(plain,{centreMode:0,perimeterOnly:true,flapMM:0,wrapMode:'fixed',plan:'all6'})
    const all8=computeGrid(plain,{centreMode:0,perimeterOnly:true,flapMM:0,wrapMode:'fixed',plan:'all8'})
    expect(all6.spotRadiusMM).toBe(12)
    expect(all6.anchors.map(anchor=>anchor.p)).toEqual(all8.anchors.map(anchor=>anchor.p))
    expect(all6.wrap.witnesses.map(witness=>witness.beltAnchorId)).toEqual(all8.wrap.witnesses.map(witness=>witness.beltAnchorId))
    expect(contourBoundaryTruth(plain).contourIdentity).not.toBe(contourBoundaryTruth(offset).contourIdentity)
  })
})
