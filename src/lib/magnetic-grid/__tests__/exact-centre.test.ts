import { describe, expect, it } from 'vitest'
import { exactBoxCentre, exactMaterialCentroid } from '../compute'
import type { Contour } from '../spec'

const squareWithHole = (): Contour => ({
  outer: { pts: [[0, 0], [10, 0], [10, 10], [0, 10]] },
  holes: [{ pts: [[6, 2], [8, 2], [8, 4], [6, 4]] }],
})

describe('exact Centre ruler', () => {
  it('derives box centre from exact input coordinates', () => {
    expect(exactBoxCentre(squareWithHole())?.approximateMM).toEqual([5, 5])
  })

  it('subtracts holes regardless of winding', () => {
    const contour = squareWithHole()
    const forward = exactMaterialCentroid(contour)
    const reversed = exactMaterialCentroid({
      ...contour,
      holes: [{ pts: [...contour.holes[0].pts].reverse() }],
    })
    expect(forward).toEqual(reversed)
    expect(forward?.approximateMM[0]).toBeCloseTo(4.916666666666667, 14)
    expect(forward?.approximateMM[1]).toBeCloseTo(5.083333333333333, 14)
  })

  it('refuses zero-area material instead of applying an epsilon fallback', () => {
    expect(exactMaterialCentroid({ outer: { pts: [[0, 0], [1, 0], [2, 0]] }, holes: [] })).toBeNull()
  })
})
