import { describe, expect, it } from 'vitest'
import { constructExactLegalIslands } from '../compute/centre-evidence'
import { rational } from '../compute/exact-real'
import type { Contour } from '../spec'

describe('exact SAFE_TOPOLOGY for scaling', () => {
  it('splits and reconnects a concave neck at its exact clearance event', () => {
    const dumbbell: Contour = {
      outer: { pts: [[0,0],[.4,0],[.4,.4],[.6,.4],[.6,0],[1,0],[1,1],[.6,1],[.6,.6],[.4,.6],[.4,1],[0,1]] },
      holes: [],
    }
    expect(constructExactLegalIslands(dumbbell, rational(100), rational(12)).islands).toHaveLength(2)
    expect(constructExactLegalIslands(dumbbell, rational(121), rational(12)).islands).toHaveLength(1)
  })

  it('preserves a supplied hole as a topological boundary', () => {
    const holed: Contour = {
      outer: { pts: [[0,0],[1,0],[1,1],[0,1]] },
      holes: [{ pts: [[.4,.4],[.6,.4],[.6,.6],[.4,.6]] }],
    }
    const result = constructExactLegalIslands(holed, rational(100), rational(12))
    expect(result.islands).toHaveLength(1)
    expect(result.islands[0].holes).toHaveLength(1)
  })

  it('retains a triple-feature clearance maximum', () => {
    const triangle: Contour = { outer: { pts: [[0,0],[1,0],[0,1]] }, holes: [] }
    const result = constructExactLegalIslands(triangle, rational(100), rational(12))
    expect(result.islands).toHaveLength(1)
  })
})
