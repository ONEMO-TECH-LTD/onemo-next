import { describe, expect, it } from 'vitest'
import { buildExactOffsetFeatures, evaluateAffineRadicalBounds, solveExactOffsetLineIntersections } from '../compute/centre-evidence'
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
    expect(features.lines.filter((feature) => feature.ring === 'hole:0')).toHaveLength(4)
    expect(features.lines.every((feature) => feature.normalDenominatorSquared.numerator !== '0')).toBe(true)

    const triangle: Contour = { outer: { pts: [[0,0],[1,0],[0,1]] }, holes: [] }
    const triple = buildExactOffsetFeatures(triangle, rational(100), rational(12))
    expect(triple.lines).toHaveLength(3)
    expect(triple.arcs).toHaveLength(0)
    expect(features.arcs.some((feature) => feature.ring === 'outer')).toBe(true)
    expect(features.arcs.filter((feature) => feature.ring === 'hole:0')).toHaveLength(4)
    expect(features.arcs.every((feature) => feature.startDenominatorSquared.numerator !== '0')).toBe(true)
    const intersections = solveExactOffsetLineIntersections(triple)
    expect(intersections).toHaveLength(3)
    for (const intersection of intersections) {
      const x = evaluateAffineRadicalBounds(intersection.point[0])
      const y = evaluateAffineRadicalBounds(intersection.point[1])
      expect(approximateExact(x[0])).toBeCloseTo(approximateExact(x[1]), 12)
      expect(approximateExact(y[0])).toBeCloseTo(approximateExact(y[1]), 12)
    }
  })

  it('solves translated oblique offset lines against the actual scale once', () => {
    const translated: Contour = { outer: { pts: [[2,3],[4,3],[2,5]] }, holes: [] }
    const features = buildExactOffsetFeatures(translated, rational(10), rational(1))
    const corner = solveExactOffsetLineIntersections(features).find((intersection) =>
      intersection.featureIds.includes('outer:line:0') && intersection.featureIds.includes('outer:line:1'))
    expect(corner).toBeDefined()
    const x = evaluateAffineRadicalBounds(corner!.point[0])
    const y = evaluateAffineRadicalBounds(corner!.point[1])
    expect(approximateExact(x[0])).toBeCloseTo(21, 12)
    expect(approximateExact(x[1])).toBeCloseTo(21, 12)
    expect(approximateExact(y[0])).toBeCloseTo(31, 12)
    expect(approximateExact(y[1])).toBeCloseTo(31, 12)
  })
})
