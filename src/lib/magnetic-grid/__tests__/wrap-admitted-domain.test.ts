import { describe,expect,it } from 'vitest'
import { getShape } from '../../shape-library'
import { makeSizer,normBaseContour } from '../../effect/magnetic-grid-bridge'
import { computeGrid } from '../engine'
import { prepareContour } from '../compute/contact-root'
import { contourBoundaryTruth } from '../compute/identity'

describe('Wrap admitted product contour',()=>{
  it('carries the real comparison-shell squircle bytes and witness provenance end to end',()=>{
    const base=normBaseContour(getShape('squircle',1024,1024),1024)
    expect(base).not.toBeNull()
    const contour=makeSizer(base!,0)(72),truth=contourBoundaryTruth(contour),prepared=prepareContour(contour,truth)
    const grid=computeGrid(contour,{paddingMM:12,flapMM:0,wrapMode:'fixed',centreMode:2,governor:0,perimeterOnly:true})
    expect(prepared.source).toBe(contour)
    expect(prepared.boundary).toHaveLength(contour.outer.pts.length+contour.holes.reduce((sum,hole)=>sum+hole.pts.length,0))
    expect(grid.wrap.status).toBe('lawful')
    expect(grid.wrap.witnesses.length).toBeGreaterThan(0)
    expect(grid.wrap.witnesses[0].boundaryTruth).toEqual(truth)
    expect(grid.wrap.witnesses.every(witness=>witness.boundaryTruth.contourIdentity===truth.contourIdentity)).toBe(true)
    expect(grid.wrap.witnesses.every(witness=>prepared.boundary.some(element=>element.id===witness.outlineElementId))).toBe(true)
  })
})
