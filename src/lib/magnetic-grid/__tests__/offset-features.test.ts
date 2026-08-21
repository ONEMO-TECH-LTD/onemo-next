import { describe, expect, it } from 'vitest'
import { buildExactOffsetArrangement, buildExactOffsetFeatures, compareOffsetExpressions, evaluateOffsetExpressionBounds, solveExactOffsetIntersections, solveExactOffsetLineIntersections, type ExactOffsetExpression } from '../compute/centre-evidence'
import { approximateExact, rational } from '../compute/exact-real'
import type { Contour } from '../spec'

describe('exact inward-offset primitives', () => {
  it('retains reflex, hole and triple-feature inputs without sampling', () => {
    const dumbbell: Contour = {
      outer: { pts: [[0,0],[.4,0],[.4,.4],[.6,.4],[.6,0],[1,0],[1,1],[.6,1],[.6,.6],[.4,.6],[.4,1],[0,1]] },
      holes: [{ pts: [[.1,.1],[.2,.1],[.2,.2],[.1,.2]] }],
    }
    const features = buildExactOffsetFeatures(dumbbell, rational(100), rational(12))
    expect(features.lines).toHaveLength(16)
    expect(features.arcs.length).toBeGreaterThan(0)
    expect(features.lines.filter((feature) => feature.ring.startsWith('hole:'))).toHaveLength(4)
    expect(features.lines.every((feature) => feature.normalDenominatorSquared.numerator !== '0')).toBe(true)

    const triangle: Contour = { outer: { pts: [[0,0],[1,0],[0,1]] }, holes: [] }
    const triple = buildExactOffsetFeatures(triangle, rational(100), rational(12))
    expect(triple.lines).toHaveLength(3)
    expect(triple.arcs).toHaveLength(0)
    expect(features.arcs.some((feature) => feature.ring.startsWith('outer:'))).toBe(true)
    expect(features.arcs.filter((feature) => feature.ring.startsWith('hole:'))).toHaveLength(4)
    expect(features.arcs.every((feature) => feature.startDenominatorSquared.numerator !== '0')).toBe(true)
    const intersections = solveExactOffsetLineIntersections(triple)
    expect(intersections).toHaveLength(3)
    for (const intersection of intersections) {
      const x = evaluateOffsetExpressionBounds(intersection.point[0])
      const y = evaluateOffsetExpressionBounds(intersection.point[1])
      expect(approximateExact(x[0])).toBeCloseTo(approximateExact(x[1]), 12)
      expect(approximateExact(y[0])).toBeCloseTo(approximateExact(y[1]), 12)
    }
  })

  it('solves translated oblique offset lines against the actual scale once', () => {
    const translated: Contour = { outer: { pts: [[2,3],[4,3],[2,5]] }, holes: [] }
    const features = buildExactOffsetFeatures(translated, rational(10), rational(1))
    const corner = solveExactOffsetLineIntersections(features).find((intersection) => {
      const x=evaluateOffsetExpressionBounds(intersection.point[0]),y=evaluateOffsetExpressionBounds(intersection.point[1])
      return Math.abs(approximateExact(x[0])-21)<1e-9&&Math.abs(approximateExact(y[0])-31)<1e-9
    })
    expect(corner).toBeDefined()
    const x = evaluateOffsetExpressionBounds(corner!.point[0])
    const y = evaluateOffsetExpressionBounds(corner!.point[1])
    expect(approximateExact(x[0])).toBeCloseTo(21, 12)
    expect(approximateExact(x[1])).toBeCloseTo(21, 12)
    expect(approximateExact(y[0])).toBeCloseTo(31, 12)
    expect(approximateExact(y[1])).toBeCloseTo(31, 12)
  })
  it('normalizes ring rotation and winding before feature identity',()=>{const a:Contour={outer:{pts:[[0,0],[1,0],[1,1],[0,1]]},holes:[{pts:[[.2,.2],[.4,.2],[.4,.4],[.2,.4]]}]},b:Contour={outer:{pts:[[1,1],[1,0],[0,0],[0,1]]},holes:[{pts:[[.4,.4],[.4,.2],[.2,.2],[.2,.4]]}]};const fa=buildExactOffsetFeatures(a,rational(100),rational(12)),fb=buildExactOffsetFeatures(b,rational(100),rational(12));expect(fa.lines.map(x=>x.id)).toEqual(fb.lines.map(x=>x.id));expect(fa.arcs.map(x=>x.id)).toEqual(fb.arcs.map(x=>x.id))})
  it('uses exact full-sequence order and canonical identical-hole ordinals',()=>{const near=2+Number.EPSILON,outerA:{pts:Contour['outer']['pts']}={pts:[[2,0],[10,0],[10,1],[near,1],[2,1]]},outerB:{pts:Contour['outer']['pts']}={pts:[[near,1],[10,1],[10,0],[2,0],[2,1]]},hole:Contour['outer']={pts:[[3,.2],[4,.2],[4,.4],[3,.4]]};const a=buildExactOffsetFeatures({outer:outerA,holes:[hole,{pts:[...hole.pts]}]},rational(10),rational(1)),b=buildExactOffsetFeatures({outer:outerB,holes:[{pts:[...hole.pts].reverse()},hole]},rational(10),rational(1));expect(a.lines.map(x=>x.id)).toEqual(b.lines.map(x=>x.id));const holeRings=[...new Set(a.lines.filter(x=>x.ring.startsWith('hole:')).map(x=>x.ring))];expect(holeRings).toHaveLength(2);expect(holeRings[0]).not.toBe(holeRings[1])})
  it('closes semantic equality and returns unresolved instead of looping',()=>{const a:ExactOffsetExpression={op:'exact',value:rational(2)},b:ExactOffsetExpression={op:'exact',value:rational(3)},c:ExactOffsetExpression={op:'exact',value:rational(5)},zero:ExactOffsetExpression={op:'exact',value:rational(0)};expect(compareOffsetExpressions({op:'add',left:{op:'add',left:a,right:b},right:c},{op:'add',left:a,right:{op:'add',left:c,right:b}})).toBe(0);expect(compareOffsetExpressions({op:'sqrt',value:{op:'exact',value:rational(4)}},a)).toBe(0);expect(compareOffsetExpressions({op:'divide',left:zero,right:zero},a)).toBeNull()})
  it('solves and sweep-trims reflex line-circle junctions',()=>{const notch:Contour={outer:{pts:[[0,0],[1,0],[1,1],[.6,1],[.6,.5],[.4,.5],[.4,1],[0,1]]},holes:[]};const features=buildExactOffsetFeatures(notch,rational(100),rational(12));const solved=solveExactOffsetIntersections(features);expect(solved.intersections.some(x=>x.kind==='line-circle')).toBe(true);expect(solved.unresolved).toEqual([])})
  it('builds traversal-order-invariant directed faces',()=>{const notch:Contour={outer:{pts:[[0,0],[1,0],[1,1],[.6,1],[.6,.5],[.4,.5],[.4,1],[0,1]]},holes:[]};const f=buildExactOffsetFeatures(notch,rational(100),rational(12)),a=buildExactOffsetArrangement(f),b=buildExactOffsetArrangement({lines:[...f.lines].reverse(),arcs:[...f.arcs].reverse()});expect(a.unresolved).toEqual([]);expect(b.unresolved).toEqual([]);expect(a.loops.map(x=>x.length).sort()).toEqual(b.loops.map(x=>x.length).sort())})
})
