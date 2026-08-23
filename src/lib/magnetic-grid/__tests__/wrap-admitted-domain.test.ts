import { describe,expect,it } from 'vitest'
import { getShape } from '../../shape-library'
import { makeSizer,normBaseContour } from '../../effect/magnetic-grid-bridge'
import { computeGrid } from '../engine'
import { nearestOutlineMM } from '../compute/seat'
import { contourBoundaryTruth } from '../compute/identity'

describe('Wrap admitted product contour',()=>{
  it('squircle 72 is lawful at flap 0 in every centre mode; its sub-ruler residue is below the ruler',()=>{
    const base=normBaseContour(getShape('squircle',1024,1024),1024)
    expect(base).not.toBeNull()
    const contour=makeSizer(base!,0)(72)
    let sawResidue=false
    for(const centreMode of [0,1,2,3,4,5]){
      const grid=computeGrid(contour,{paddingMM:12,flapMM:0,wrapMode:'fixed',centreMode,perimeterOnly:true})
      expect(grid.wrap,`centre mode ${centreMode}`).toMatchObject({status:'lawful',requiredFlapMM:0})
      expect(grid.anchors.length).toBeGreaterThan(0)
      for(const anchor of grid.anchors)if(nearestOutlineMM(contour,anchor.p).distMM<12)sawResidue=true
    }
    expect(sawResidue).toBe(true)
  })
  it('makes the live square24 contour lawful at flap 0 and preserves supplied holes while scaling',()=>{
    const base=normBaseContour(getShape('square',1024,1024),1024)!,contour=makeSizer(base,0)(24)
    const grid=computeGrid(contour,{paddingMM:12,flapMM:0,wrapMode:'fixed',centreMode:0,perimeterOnly:true})
    expect(Math.max(...contour.outer.pts.map(point=>point[0]))-Math.min(...contour.outer.pts.map(point=>point[0]))).toBe(24)
    expect(grid.wrap).toMatchObject({status:'lawful',requiredFlapMM:0})
    expect(grid.wrap.witnesses.length).toBeGreaterThan(0)
    const holed={outer:{pts:[[0,0],[1,0],[1,1],[0,1]] as [number,number][]},holes:[{pts:[[.25,.25],[.75,.25],[.75,.75],[.25,.75]] as [number,number][]}]}
    const scaled=makeSizer(holed,0)(24)
    expect(scaled.holes).toHaveLength(1)
    expect(scaled.holes[0].pts).toHaveLength(4)
  })
  it('keeps the public 12mm default, magnet-plan positions and outline identity truthful',()=>{
    const base=normBaseContour(getShape('square',1024,1024),1024)!,plain=makeSizer(base,0)(72),offset=makeSizer(base,1)(72)
    const all6=computeGrid(plain,{centreMode:0,perimeterOnly:true,flapMM:0,wrapMode:'fixed',plan:'all6'})
    const all8=computeGrid(plain,{centreMode:0,perimeterOnly:true,flapMM:0,wrapMode:'fixed',plan:'all8'})
    const corners8=computeGrid(plain,{centreMode:0,perimeterOnly:true,flapMM:0,wrapMode:'fixed',plan:'corners8'})
    expect(all6.spotRadiusMM).toBe(12)
    for(const grid of [all8,corners8]){
      expect(grid.anchors.map(anchor=>anchor.p)).toEqual(all6.anchors.map(anchor=>anchor.p))
      expect(grid.wrap).toEqual(all6.wrap)
      expect(grid.contactsMM).toEqual(all6.contactsMM)
    }
    expect(corners8.anchors.map(anchor=>anchor.dia)).not.toEqual(all6.anchors.map(anchor=>anchor.dia))
    expect(contourBoundaryTruth(plain).contourIdentity).not.toBe(contourBoundaryTruth(offset).contourIdentity)
  })
})
