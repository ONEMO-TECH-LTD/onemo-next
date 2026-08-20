import { describe, expect, it } from 'vitest'
import { exactContour, insideContour, nearestDist2, segmentDist2, toMM, toUnits } from '../compute/clearance'
import { compareExact, ratFromInt, rational } from '../compute/exact-real'
import type { Contour } from '../spec'

const square = (mm: number): Contour => ({
  outer: { pts: [[0, 0], [mm, 0], [mm, mm], [0, mm]] },
  holes: [],
})

describe('exact clearance kernel', () => {
  it('lifts float coordinates losslessly to one integer unit', () => {
    const c = exactContour({ outer: { pts: [[0.5, 0.25], [1.75, 0.25], [1.75, 2], [0.5, 2]] }, holes: [] })
    expect(c.shift).toBe(2) // 0.25 = 1·2^-2 is the finest coordinate
    expect(c.unit).toBe(4n)
    expect(toUnits(12, c)).toBe(48n)
    expect(compareExact(toMM(48n, c), ratFromInt(12))).toBe(0)
    // an irreducible float like 0.1 lifts exactly via its 2^-55 bit pattern
    const fine = exactContour({ outer: { pts: [[0.1, 0], [1, 0], [1, 1]] }, holes: [] })
    expect(fine.shift).toBe(55)
    // segment 0 closes the ring (last point → first): its end is the 0.1 vertex
    expect(fine.segments[0].bx).toBe(3602879701896397n)
  })

  it('measures squared distance to a segment exactly, interior foot and endpoints', () => {
    const c = exactContour(square(10))
    const bottom = c.segments.find((s) => s.ay === 0n && s.by === 0n)!
    // point (3,4) above the bottom edge: perpendicular distance 4 → d² = 16
    expect(compareExact(segmentDist2(3n, 4n, bottom), ratFromInt(16))).toBe(0)
    // point (-3,4) past the left endpoint: distance to (0,0) → d² = 25
    expect(compareExact(segmentDist2(-3n, 4n, bottom), ratFromInt(25))).toBe(0)
    // oblique segment (0,0)-(4,3): point (4,0) → cross=12, len2=25 → d² = 144/25
    const oblique = exactContour({ outer: { pts: [[0, 0], [4, 3], [0, 3]] }, holes: [] }).segments[1] // (0,0)→(4,3)
    expect(compareExact(segmentDist2(4n, 0n, oblique), rational(144n, 25n))).toBe(0)
  })

  it('finds the nearest boundary and every segment binding a tie', () => {
    const c = exactContour(square(10))
    const centre = nearestDist2(5n, 5n, c)
    expect(compareExact(centre.d2, ratFromInt(25))).toBe(0)
    expect(centre.binding).toHaveLength(4) // equidistant from all four sides
    const offCentre = nearestDist2(2n, 5n, c)
    expect(compareExact(offCentre.d2, ratFromInt(4))).toBe(0)
    expect(offCentre.binding).toHaveLength(1)
  })

  it('decides containment by exact ray parity, holes included', () => {
    const ring: Contour = { outer: { pts: [[0, 0], [10, 0], [10, 10], [0, 10]] }, holes: [{ pts: [[4, 4], [6, 4], [6, 6], [4, 6]] }] }
    const c = exactContour(ring)
    expect(insideContour(2n, 2n, c)).toBe(true)
    expect(insideContour(5n, 5n, c)).toBe(false) // inside the hole
    expect(insideContour(12n, 5n, c)).toBe(false)
  })
})
