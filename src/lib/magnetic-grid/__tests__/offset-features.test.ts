import { describe, expect, it } from 'vitest'
import { buildExactOffsetFeatures } from '../compute/centre-evidence'
import { rational } from '../compute/exact-real'
import type { Contour } from '../spec'

describe('exact inward-offset primitives', () => {
  it('retains reflex, hole and triple-feature inputs without sampling', () => {
    const dumbbell: Contour = {
      outer: { pts: [[0,0],[.4,0],[.4,.4],[.6,.4],[.6,0],[1,0],[1,1],[.6,1],[.6,.6],[.4,.6],[.4,1],[0,1]] },
      holes: [{ pts: [[.1,.1],[.2,.1],[.2,.2],[.1,.2]] }],
    }
    const features = buildExactOffsetFeatures(dumbbell, rational(100), rational(12))
    expect(features.lines).toHaveLength(16)
    expect(features.vertices.filter((feature) => feature.reflex).length).toBeGreaterThan(0)
    expect(features.lines.filter((feature) => feature.ring === 'hole:0')).toHaveLength(4)
    expect(features.lines.every((feature) => feature.normalDenominatorSquared.numerator !== '0')).toBe(true)

    const triangle: Contour = { outer: { pts: [[0,0],[1,0],[0,1]] }, holes: [] }
    const triple = buildExactOffsetFeatures(triangle, rational(100), rational(12))
    expect(triple.lines).toHaveLength(3)
    expect(triple.vertices).toHaveLength(3)
  })
})
