import { describe, expect, it } from 'vitest'
import { measureParity } from '../compute/seat'
import { centrePhaseCandidates } from '../logic'
import { computeGrid } from '../engine'
import type { Contour, Pt } from '../spec'

const square = (side: number): Contour => ({
  outer: { pts: [[-side / 2, -side / 2], [side / 2, -side / 2], [side / 2, side / 2], [-side / 2, side / 2]] },
  holes: [],
})
const fixed0 = { paddingMM: 12, centreMode: 0, perimeterOnly: true, flapMM: 0, wrapMode: 'fixed' as const }

describe('v3.5.3 S2 — every size solve returns all four placements, render-complete', () => {
  it('returns four candidates carrying phase, lattice, populations, count, parity, centre error and measurement', () => {
    const grid = computeGrid(square(72), fixed0)
    expect(grid.candidates).toHaveLength(4)
    for (const c of grid.candidates) {
      expect(c.sizeMM).toBe(72)
      expect(c.phaseMM).toHaveLength(2)
      expect(c.lattice.length).toBeGreaterThan(0)
      expect(c.anchors.length).toBe(c.magnetCount)
      expect(['measured', 'refused']).toContain(c.wrapMeasurement.status)
      expect(Number.isInteger(c.centreErrorMM)).toBe(true)
    }
    // the display pick is one of the four, and its public fields come from it
    const display = grid.candidates.find((c) => c.phaseMM[0] === grid.phaseMM[0] && c.phaseMM[1] === grid.phaseMM[1])!
    expect(display).toBeDefined()
    expect(grid.lattice).toEqual(display.lattice)
    expect(grid.anchors).toEqual(display.anchors)
    expect(grid.parityTrue).toBe(display.parityTrue)
    expect(grid.centreErrorMM).toBe(display.centreErrorMM)
  })

  it('S2-c: placement labels are derived from the declared centrePhaseCandidates order — a reorder would relabel and fail here', () => {
    const contour = square(72)
    const grid = computeGrid(contour, fixed0)
    const canonical = grid.candidates.find((c) => !c.placement.xHalf && !c.placement.yHalf)!
    const pitch = grid.pitchCentreMM
    const shifted = (a: number, b: number) => Math.abs((((a - b) % pitch) + pitch) % pitch - pitch / 2) < 1e-9
    for (const c of grid.candidates) {
      expect(shifted(c.phaseMM[0], canonical.phaseMM[0])).toBe(c.placement.xHalf)
      expect(shifted(c.phaseMM[1], canonical.phaseMM[1])).toBe(c.placement.yHalf)
    }
    // the declared order: canonical, x-shifted, y-shifted, both — and canon 2/1/1/0
    const declared = centrePhaseCandidates([0, 0], { minX: -36, minY: -36, maxX: 36, maxY: 36 }, pitch)
    expect(declared.map((d) => d.canon)).toEqual([2, 1, 1, 0])
    expect(grid.candidates.map((c) => [c.placement.xHalf, c.placement.yHalf])).toEqual([[false, false], [true, false], [false, true], [true, true]])
  })

  it('S2-a: parity is measured per axis — odd line count needs a node on the centre, even needs the gap', () => {
    const pitch = 48
    // one line on x (odd) with the centre on the node → true; on the gap → false
    expect(measureParity([[0, 0]], [0, 0], pitch)).toEqual({ parityTrue: true, centreErrorMM: 0 })
    expect(measureParity([[0, 0]], [24, 0], pitch)).toEqual({ parityTrue: false, centreErrorMM: 24 })
    // two lines on x (even) with the centre on the gap → true; on a node → false
    expect(measureParity([[-24, 0], [24, 0]], [0, 0], pitch)).toEqual({ parityTrue: true, centreErrorMM: 0 })
    expect(measureParity([[-24, 0], [24, 0]], [24, 0], pitch)).toEqual({ parityTrue: false, centreErrorMM: 24 })
    // y axis independently
    expect(measureParity([[0, -24], [0, 24]], [0, 0], pitch)).toEqual({ parityTrue: true, centreErrorMM: 0 })
    expect(measureParity([[0, -24], [0, 24]], [0, 24], pitch)).toEqual({ parityTrue: false, centreErrorMM: 24 })
    // S2-b: the miss is reported on the 1 mm ruler and never changes the parity verdict
    expect(measureParity([[0, 0]], [0.4, 0], pitch)).toEqual({ parityTrue: true, centreErrorMM: 0 })
    expect(measureParity([[0, 0]], [0.6, 0], pitch)).toEqual({ parityTrue: true, centreErrorMM: 1 })
    expect(measureParity([], [0, 0], pitch)).toEqual({ parityTrue: false, centreErrorMM: 0 })
  })

  it('concessions are measured: a hand-placed grid reports CENTRE; a refused wrap reports WRAP; the canonical square reports none', () => {
    const clean = computeGrid(square(24), fixed0)
    expect(clean.concessions).toEqual([])
    expect(clean.parityTrue).toBe(true)
    // hand-placed 3 mm off the centre node on a 72 square: parity still holds, the miss is reported and is a concession
    const forced = computeGrid(square(72), { ...fixed0, forcePhaseMM: [39, 36] as Pt })
    expect(forced.anchors.length).toBeGreaterThan(0)
    expect(forced.parityTrue).toBe(true)
    expect(forced.centreErrorMM).toBe(3)
    expect(forced.concessions).toContain('CENTRE')
    // hand-placed so far that nothing seats: parity cannot hold and the concession is still reported
    const empty = computeGrid(square(24), { ...fixed0, forcePhaseMM: [5, 0] as Pt })
    expect(empty.anchors).toEqual([])
    expect(empty.concessions).toEqual(['CENTRE', 'WRAP'])
    const refused = computeGrid(square(26), fixed0)
    expect(refused.concessions).toEqual(['WRAP'])
  })

  it('Coverage changes output anchors only — every candidate keeps its seated set, belt and measurement', () => {
    const perimeter = computeGrid(square(120), { ...fixed0, perimeterOnly: true })
    const full = computeGrid(square(120), { ...fixed0, perimeterOnly: false })
    expect(full.candidates.map((c) => c.seated)).toEqual(perimeter.candidates.map((c) => c.seated))
    expect(full.candidates.map((c) => c.belt)).toEqual(perimeter.candidates.map((c) => c.belt))
    expect(full.candidates.map((c) => c.wrapMeasurement)).toEqual(perimeter.candidates.map((c) => c.wrapMeasurement))
    expect(full.anchors.length).toBeGreaterThan(perimeter.anchors.length)
  })
})
