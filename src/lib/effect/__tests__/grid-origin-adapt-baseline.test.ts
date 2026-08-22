import { describe, expect, it } from 'vitest'
import {
  bbox,
  centroidOf,
  impliedFlapMM,
  latticeAt,
  latticeOver,
  makeSeatPredicate,
  maxPressMM,
  scaleContour,
  splitPerimeter,
} from '../grid-origin-compute'
import { applyCoverage, assignSizes, bandOf, governMass } from '../grid-origin-logic'
import { autoFlapInBand, bandSnapPoints, computeGrid } from '../grid-origin'
import { fieldSpots, makeSizer, seatedSpots } from '../grid-origin-bridge'
import type { Contour, Pt } from '../types'

const square = (mm: number): Contour => ({
  outer: { pts: [[0, 0], [mm, 0], [mm, mm], [0, mm]] },
  holes: [],
})

describe('v3.5 ADAPT donor characterization', () => {
  it('pins numeric bbox/lattice/centroid/scale behavior and the hole-loss defect', () => {
    expect(bbox([[3, -2], [-4, 8], [1, 5]])).toEqual({ minX: -4, minY: -2, maxX: 3, maxY: 8 })
    const bounds = { minX: 0, minY: 0, maxX: 96, maxY: 48 }
    expect(latticeAt(bounds, 48, 24, 24)).toEqual([[24, 24], [72, 24]])
    expect(latticeOver(bounds, 48, [24, 24])).toEqual([[24, 24], [72, 24]])
    expect(centroidOf([[0, 0], [6, 0], [0, 6]])).toEqual([2, 2])
    const withHole: Contour = {
      outer: { pts: [[0, 0], [1, 0], [1, 1], [0, 1]] },
      holes: [{ pts: [[0.2, 0.2], [0.3, 0.2], [0.2, 0.3]] }],
    }
    expect(scaleContour(withHole, 96)).toEqual({
      outer: { pts: [[0, 0], [96, 0], [96, 96], [0, 96]] },
      holes: [],
    })
  })

  it('pins tangent/inside/outside seat answers', () => {
    const fits = makeSeatPredicate(square(72).outer.pts, 12)
    expect(fits).not.toBeNull()
    expect(fits!([12, 12])).toBe(true)
    expect(fits!([36, 36])).toBe(true)
    expect(fits!([11.999, 12])).toBe(false)
    expect(fits!([80, 80])).toBe(false)
  })

  it('pins worst-disc flap and belt partition semantics', () => {
    const corners: Pt[] = [[12, 12], [60, 12], [12, 60], [60, 60]]
    expect(maxPressMM(square(72).outer.pts, corners, 12)).toBe(0)
    expect(impliedFlapMM(square(72).outer.pts, corners, 12)).toBe(0)
    expect(maxPressMM(square(72).outer.pts, [...corners, [36, 36]], 12)).toBe(24)
    expect(impliedFlapMM(square(72).outer.pts, [...corners, [36, 36]], 12)).toBe(24)

    const nine = latticeAt({ minX: 0, minY: 0, maxX: 96, maxY: 96 }, 48, 0, 0)
    const split = splitPerimeter(nine, 48)
    expect(split.belt).toHaveLength(8)
    expect(split.interior).toEqual([[48, 48]])
  })

  it('pins band, governor, coverage, and magnet-plan policy outputs', () => {
    expect([24, 71, 72, 119, 120, 167, 168, 215, 216, 264, 265].map((mm) => bandOf(mm)?.id ?? null))
      .toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, null])
    const masses = [
      { id: 'small', areaMM2: 4, centreMM: [0, 2] as Pt, peakClearMM: 2 },
      { id: 'deep', areaMM2: 9, centreMM: [0, -2] as Pt, peakClearMM: 8 },
      { id: 'top', areaMM2: 16, centreMM: [0, 6] as Pt, peakClearMM: 4 },
    ]
    expect(governMass(masses, 0)?.id).toBe('small')
    expect(governMass(masses, 1)?.id).toBe('deep')
    expect(governMass(masses, 2)?.id).toBe('top')
    expect(governMass(masses, 3, 0)?.id).toBe('small')

    const nine = latticeAt({ minX: 0, minY: 0, maxX: 96, maxY: 96 }, 48, 0, 0)
    expect(applyCoverage(nine, false, 48).seated).toHaveLength(9)
    expect(applyCoverage(nine, true, 48).seated).toHaveLength(8)
    expect(assignSizes(nine, 'all6').every((anchor) => anchor.dia === 6)).toBe(true)
    expect(assignSizes(nine, 'all8').every((anchor) => anchor.dia === 8)).toBe(true)
    expect(assignSizes(nine, 'corners8').filter((anchor) => anchor.dia === 8)).toHaveLength(4)
  })

  it('pins first-count/no-repeat and whole-millimetre Auto compatibility', () => {
    const sized = (mm: number) => square(mm)
    expect(bandSnapPoints(sized, { positioning: 2, paddingMM: 12, flapMM: 0 }, 24, 1))
      .toEqual([{ sizeMM: 24, count: 1 }])
    const auto = autoFlapInBand(sized, { positioning: 2, paddingMM: 12 }, 24, 1, 4)
    expect(auto.flapMM).toBe(0)
    expect(auto.fit.ladder).toEqual([{ sizeMM: 24, count: 1 }])
  })

  it('pins pass-through sizing and bridge view mappings', () => {
    const base = square(1)
    expect(makeSizer(base, 0)(72)).toEqual(square(72))
    const grid = computeGrid(square(72), { positioning: 1, centreMode: 0, paddingMM: 12 })
    const seated = seatedSpots(grid)
    const field = fieldSpots(grid, { minX: 0, minY: 0, maxX: 72, maxY: 72 })
    expect(seated).toHaveLength(grid.anchors.length)
    expect(seated.every((spot) => spot.held)).toBe(true)
    expect(field.filter((spot) => spot.held).map(({ x, y }) => [x, y]))
      .toEqual(grid.anchors.map((anchor) => anchor.p))
  })
})
