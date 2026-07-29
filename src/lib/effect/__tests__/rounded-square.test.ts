import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LAW,
  handleGridJob,
  gridLadderCacheKey,
  gridPlanCacheKey,
  planContourFromRecipe,
  resolveGridPlan,
  type LadderRecipe,
  type PlanRecipe,
} from '../grid'
import {
  roundedSquareContourMM,
} from '../rounded-square'
import { DEFAULT_ROUNDED_SQUARE_CALIBRATION } from '../effect-calibration'
import { distanceToPreparedContour, prepareExactContour } from '../grid-prepared'

function topStraightInsetMM(sizeMM: number, radiusMM: number): number {
  const contour = roundedSquareContourMM(sizeMM, sizeMM, radiusMM)
  const top = contour.outer.pts
    .filter(([, y]) => Math.abs(y) < 1e-9)
    .map(([x]) => x)
  if (!top.length) throw new Error('rounded square has no exact top-edge vertices')
  return Math.min(...top)
}

describe('KAI-9837 rounded-square product geometry', () => {
  it('keeps the calibrated radius absolute instead of scaling it with the size', () => {
    const radiusMM = DEFAULT_ROUNDED_SQUARE_CALIBRATION.radiusMM
    for (const sizeMM of [70, 118, 214]) {
      expect(topStraightInsetMM(sizeMM, radiusMM), `${sizeMM}mm`).toBeCloseTo(radiusMM, 9)
    }
  })

  it.each([
    { radiusMM: 10, expectedSizeMM: 70 },
    { radiusMM: 12, expectedSizeMM: 71 },
    { radiusMM: 14, expectedSizeMM: 72 },
  ])(
    'derives the first four-corner S construction for radius $radiusMM at $expectedSizeMM',
    ({ radiusMM, expectedSizeMM }) => {
      const recipe: LadderRecipe = {
        kind: 'rounded-square',
        radiusMM,
        minimumAnchors: DEFAULT_ROUNDED_SQUARE_CALIBRATION.minimumAnchors,
      }
      const result = handleGridJob({
        operation: 'ladder',
        recipe,
        law: DEFAULT_LAW,
        mode: 'standard',
        options: { pitchMM: 48 },
      })
      if (result.operation !== 'ladder') throw new Error('expected ladder result')
      const rung = result.value.find(({ label }) => label === 'S')

      expect(rung).toMatchObject({ sizeMM: expectedSizeMM, points: 4 })
    },
    20_000,
  )

  it('grows against the canonical 11mm sizing inset, not the 10mm delivery floor', () => {
    const contour70 = roundedSquareContourMM(70, 70, 12)
    const delivered = resolveGridPlan(contour70, {
      mode: 'standard',
      pitchMM: 48,
      density: 'light',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    })
    const prepared = prepareExactContour(contour70)
    const minimumSeatMM = Math.min(...delivered.grid.anchors.map(
      ({ p }) => distanceToPreparedContour(p, prepared),
    ))

    expect(delivered.grid.anchors).toHaveLength(4)
    expect(minimumSeatMM).toBeGreaterThanOrEqual(DEFAULT_LAW.paddingMM)
    expect(minimumSeatMM).toBeLessThan(DEFAULT_LAW.paddingMM + DEFAULT_LAW.frameMM)

    const result = handleGridJob({
      operation: 'ladder',
      recipe: { kind: 'rounded-square', radiusMM: 12, minimumAnchors: 4 },
      law: DEFAULT_LAW,
      mode: 'standard',
      options: { pitchMM: 48 },
    })
    if (result.operation !== 'ladder') throw new Error('expected ladder result')
    expect(result.value.find(({ label }) => label === 'S')?.sizeMM).toBe(71)
  })

  it('keeps the released four-corner minimum in serialized recipe semantics', () => {
    const run = (minimumAnchors: number) => handleGridJob({
      operation: 'ladder',
      recipe: { kind: 'rounded-square', radiusMM: 10, minimumAnchors },
      law: DEFAULT_LAW,
      mode: 'standard',
      options: { pitchMM: 48 },
    })
    const unrestricted = run(1)
    const released = run(DEFAULT_ROUNDED_SQUARE_CALIBRATION.minimumAnchors)
    if (unrestricted.operation !== 'ladder' || released.operation !== 'ladder') {
      throw new Error('expected ladder results')
    }

    expect(unrestricted.value.some(({ points }) => points < 4)).toBe(true)
    expect(released.value.every(({ points }) => points >= 4)).toBe(true)
    expect(released.value[0]).toMatchObject({ label: 'S', sizeMM: 70, points: 4 })
  })

  it('carries the calibrated radius through plan materialization and cache identity', () => {
    const first: PlanRecipe = { kind: 'rounded-square', sizeMM: 70, radiusMM: 10 }
    const second: PlanRecipe = { kind: 'rounded-square', sizeMM: 70, radiusMM: 12 }
    const firstContour = planContourFromRecipe(first)

    expect(topStraightInsetMM(70, 10)).toBeCloseTo(10, 9)
    expect(firstContour).toEqual(roundedSquareContourMM(70, 70, 10))
    expect(gridPlanCacheKey(first)).not.toBe(gridPlanCacheKey(second))
    expect(gridLadderCacheKey({ kind: 'rounded-square', radiusMM: 10, minimumAnchors: 4 }))
      .not.toBe(gridLadderCacheKey({ kind: 'rounded-square', radiusMM: 12, minimumAnchors: 4 }))
    expect(gridLadderCacheKey({ kind: 'rounded-square', radiusMM: 10, minimumAnchors: 2 }))
      .not.toBe(gridLadderCacheKey({ kind: 'rounded-square', radiusMM: 10, minimumAnchors: 4 }))
  })
})
