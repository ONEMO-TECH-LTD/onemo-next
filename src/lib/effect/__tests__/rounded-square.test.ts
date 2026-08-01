import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LAW,
  handleGridJob,
  gridLadderCacheKey,
  gridPlanCacheKey,
  planContourFromRecipe,
  resolveGridPlan,
  resolveGridPlanFromRecipe,
  stdShapeContour,
  type LadderRecipe,
  type PlanRecipe,
} from '../grid'
import {
  roundedSquareClearanceMM,
  roundedSquareContourMM,
} from '../rounded-square'
import { DEFAULT_ROUNDED_SQUARE_CALIBRATION } from '../effect-calibration'
import { MANUFACTURING_TOLERANCE_MM } from '../geometry-truth'
import { distanceToPreparedContour, prepareExactContour } from '../grid-prepared'
import type { Pt } from '../types'

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
    { radiusMM: 10, expectedSizeMM: 68 },
    { radiusMM: 12, expectedSizeMM: 70 },
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

  it('derives the magnetic base from padding and applies the frame only after construction', () => {
    const result = handleGridJob({
      operation: 'ladder',
      recipe: { kind: 'rounded-square', radiusMM: 12, minimumAnchors: 4 },
      law: DEFAULT_LAW,
      mode: 'standard',
      options: { pitchMM: 48, frameBufferMM: 3 },
    })
    if (result.operation !== 'ladder') throw new Error('expected ladder result')
    const rung = result.value.find(({ label }) => label === 'S')
    expect(rung).toMatchObject({ baseSizeMM: 70, sizeMM: 76, frameBufferMM: 3 })

    const delivered = resolveGridPlanFromRecipe({
      kind: 'rounded-square',
      sizeMM: rung!.baseSizeMM,
      radiusMM: 12,
    }, {
      mode: 'standard',
      pitchMM: 48,
      density: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      frameBufferMM: 3,
      maxGrowMM: 0,
      construction: rung!.construction,
    })
    const prepared = prepareExactContour(delivered.baseContourMM)
    const minimumSeatMM = Math.min(...delivered.grid.anchors.map(
      ({ p }) => distanceToPreparedContour(p, prepared),
    ))

    expect(delivered.grid.anchors).toHaveLength(4)
    expect(minimumSeatMM).toBeGreaterThanOrEqual(DEFAULT_LAW.paddingMM)
    expect(delivered.baseSizeMM).toBe(70)
    expect(delivered.publishedSizeMM).toBe(76)
    expect(delivered.frameBufferMM).toBe(3)
  })

  it('uses true rounded-corner tangency without relaxing the straight-edge padding floor', () => {
    const rounded = handleGridJob({
      operation: 'ladder',
      recipe: { kind: 'rounded-square', radiusMM: 10, minimumAnchors: 4 },
      law: DEFAULT_LAW,
      mode: 'standard',
      options: { pitchMM: 48 },
    })
    if (rounded.operation !== 'ladder') throw new Error('expected ladder result')
    const rung = rounded.value[0]
    const contour = roundedSquareContourMM(rung.baseSizeMM, rung.baseSizeMM, 10)
    const delivered = resolveGridPlanFromRecipe({
      kind: 'rounded-square',
      sizeMM: rung.baseSizeMM,
      radiusMM: 10,
    }, {
      mode: 'standard',
      pitchMM: 48,
      density: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
      construction: rung.construction,
    })
    const prepared = prepareExactContour(contour)
    let checkedCorners = 0
    for (const { p } of delivered.grid.anchors) {
      checkedCorners++
      expect(roundedSquareClearanceMM(p, 68, 68, 10)).toBe(10)
      expect(distanceToPreparedContour(p, prepared))
        .toBeGreaterThanOrEqual(10 - MANUFACTURING_TOLERANCE_MM)
    }
    expect(rung).toMatchObject({ baseSizeMM: 68, sizeMM: 68, points: 4 })
    expect(checkedCorners).toBe(4)

    const triangle = handleGridJob({
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'triangle' },
      law: DEFAULT_LAW,
      mode: 'standard',
      options: { pitchMM: 48, density: 'standard' },
    })
    if (triangle.operation !== 'ladder') throw new Error('expected triangle ladder result')
    expect(triangle.value.find(({ label }) => label === 'S'))
      .toMatchObject({ baseSizeMM: 92, points: 2 })

    // Straight edges have no inward curve proxy to forgive. The 90mm predecessor has a real
    // 9.971mm top seat and must stay rejected while the lawful 92mm triangle S remains present.
    const triangle90 = stdShapeContour('triangle', 90)
    const trianglePrepared = prepareExactContour(triangle90)
    const illegalTop: Pt = [45, 58]
    expect(distanceToPreparedContour(illegalTop, trianglePrepared)).toBeCloseTo(9.9711431703, 9)
    expect(resolveGridPlan(triangle90, {
      source: 'std',
      mode: 'standard',
      pitchMM: 48,
      density: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    }).grid.anchors).toHaveLength(1)
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
    expect(released.value[0]).toMatchObject({ label: 'S', sizeMM: 68, points: 4 })
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
