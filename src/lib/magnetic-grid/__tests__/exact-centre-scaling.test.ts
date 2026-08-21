import { describe, expect, it } from 'vitest'
import { exactBoxTargetCoefficient, exactWeightTargetCoefficient } from '../compute/centre-evidence'
import { rational } from '../compute/exact-real'
import type { Contour } from '../spec'

describe('exact affine Centre evidence for scaling', () => {
  it('constructs Box and Weight from the supplied shape before magnets', () => {
    const contour: Contour = {
      outer: { pts: [[0, 0], [1, 0], [1, 1], [0, 1]] },
      holes: [],
    }
    expect(exactBoxTargetCoefficient(contour)).toEqual([rational(1, 2), rational(1, 2)])
    expect(exactWeightTargetCoefficient(contour)).toEqual([rational(1, 2), rational(1, 2)])
  })

  it('subtracts an asymmetric hole from exact material weight regardless of winding', () => {
    const outer: Contour['outer'] = { pts: [[0, 0], [4, 0], [4, 4], [0, 4]] }
    const clockwiseHole: Contour['outer'] = { pts: [[2, 0], [2, 2], [4, 2], [4, 0]] }
    const counterClockwiseHole: Contour['outer'] = { pts: [...clockwiseHole.pts].reverse() }
    const expected = [rational(5, 3), rational(7, 3)]
    expect(exactWeightTargetCoefficient({ outer, holes: [clockwiseHole] })).toEqual(expected)
    expect(exactWeightTargetCoefficient({ outer, holes: [counterClockwiseHole] })).toEqual(expected)
  })
})
