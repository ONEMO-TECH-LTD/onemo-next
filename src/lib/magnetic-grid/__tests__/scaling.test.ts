import { describe, expect, it, vi } from 'vitest'
import { getShape } from '../../shape-library'
import { makeSizer, normBaseContour } from '../../effect/magnetic-grid-bridge'
import { reduceBandLadders } from '../logic'
import * as engine from '../engine'
import { autoFlapInBand, computeGrid, fitSizeInBand, solveBands } from '../engine'
import type { Contour, Placement, PlacementCandidate, WrapMeasurement } from '../spec'

const square = (side: number): Contour => ({
  outer: { pts: [[-side / 2, -side / 2], [side / 2, -side / 2], [side / 2, side / 2], [-side / 2, side / 2]] },
  holes: [],
})
const diamond = (axisRadius: number): Contour => ({ outer: { pts: [[0, axisRadius], [axisRadius, 0], [0, -axisRadius], [-axisRadius, 0]] }, holes: [] })
const fixed0 = { paddingMM: 12, centreMode: 0, perimeterOnly: true, flapMM: 0, wrapMode: 'fixed' as const }

/** Synthetic candidate: only the fields the reducer reads matter. */
const cand = (sizeMM: number, magnetCount: number, requiredFlapMM: number | null, o: Partial<PlacementCandidate> & { placement?: Placement } = {}): PlacementCandidate => {
  const wrapMeasurement: WrapMeasurement = requiredFlapMM === null
    ? { status: 'refused', requiredFlapMM: null, witnesses: [], refusal: { code: 'NO_WRAPPED_LAYOUT_IN_BAND', reason: 'empty-belt' } }
    : { status: 'measured', requiredFlapMM, witnesses: [], refusal: null }
  return {
    sizeMM, placement: { xHalf: false, yHalf: false }, phaseMM: [0, 0], lattice: [], canon: 2, seated: magnetCount ? [[0, 0]] : [], belt: [],
    anchors: [], magnetCount, parityTrue: true, centreErrorMM: 0, wrapMeasurement, ...o,
  }
}
const fixed = { mode: 'fixed' as const, allowanceMM: 0 }
const rungsOf = (bands: ReturnType<typeof reduceBandLadders>) => bands.map((b) => b.rungs.map((r) => [r.sizeMM, r.magnetCount, r.layouts.length]))

describe('v3.5.3 scaling — reduceBandLadders (synthetic)', () => {
  it('publishes each next count once at its smallest accepted even size; counts strictly increase; no cross-band repeat', () => {
    const bands = reduceBandLadders([
      cand(24, 1, 0), cand(26, 1, 0), cand(30, 2, 0), cand(28, 2, 1),   // 2 is lawful first at 30 (28 needs 1)
      cand(72, 1, 0), cand(72, 2, 0), cand(72, 4, 0), cand(74, 3, 0),  // 1, 2 owned by B1; 3 after 4 is not strictly greater
      cand(120, 8, 0), cand(168, 12, 0),
    ], fixed)
    expect(rungsOf(bands)).toEqual([[[24, 1, 1], [30, 2, 1]], [[72, 4, 1]], [[120, 8, 1]], [[168, 12, 1]]])
    expect(bands.map((b) => b.refusal)).toEqual([null, null, null, null])
  })

  it('a lawful lower count survives a higher count\'s refusal; a count is owned by the first band that accepts it', () => {
    const bands = reduceBandLadders([cand(24, 1, 0), cand(40, 2, 3), cand(72, 2, 0), cand(72, 4, 0)], fixed)
    expect(rungsOf(bands)).toEqual([[[24, 1, 1]], [[72, 2, 1], [72, 4, 1]], [], []])
    expect(bands[2].refusal).toEqual({ code: 'NO_CENTRE' })
  })

  it('keeps every co-lawful placement; vertical eliminates horizontal on an otherwise-equal pair only', () => {
    const h: Placement = { xHalf: true, yHalf: false }, v: Placement = { xHalf: false, yHalf: true }, both: Placement = { xHalf: true, yHalf: true }
    const tie = reduceBandLadders([cand(72, 2, 0, { placement: h }), cand(72, 2, 0, { placement: v }), cand(72, 2, 0, { placement: both })], fixed)
    expect(tie[1].rungs[0].layouts.map((l) => l.candidate.placement)).toEqual([v, both])
    const unequal = reduceBandLadders([cand(72, 2, 0, { placement: h }), cand(72, 2, 1, { placement: v })], { mode: 'fixed', allowanceMM: 1 })
    expect(unequal[1].rungs[0].layouts.map((l) => l.candidate.placement)).toEqual([v, h])
  })

  it('Auto keeps the minimum whole-mm allowance and its ties within the cap; the cap refuses typed', () => {
    const auto = reduceBandLadders([cand(72, 4, 2), cand(72, 4, 1, { placement: { xHalf: true, yHalf: true } }), cand(72, 4, 1, { placement: { xHalf: false, yHalf: true } })], { mode: 'auto', capMM: 3 })
    expect(auto[1].rungs[0].layouts.map((l) => l.wrap.appliedFlapMM)).toEqual([1, 1])
    expect(reduceBandLadders([cand(72, 4, 2)], { mode: 'auto', capMM: 1 })[1].refusal).toEqual({ code: 'AUTO_FLAP_CAP_EXCEEDED' })
  })

  it('refusals are typed: nothing seated, nothing centred, nothing wrapped, or every count already owned', () => {
    expect(reduceBandLadders([cand(24, 0, null)], fixed)[0].refusal).toEqual({ code: 'NO_CENTRE' })
    expect(reduceBandLadders([cand(24, 1, 0, { parityTrue: false })], fixed)[0].refusal).toEqual({ code: 'NO_PARITY_LAWFUL_PLACEMENT' })
    expect(reduceBandLadders([cand(24, 1, 0, { centreErrorMM: 1 })], fixed)[0].refusal).toEqual({ code: 'NO_PARITY_LAWFUL_PLACEMENT' })
    expect(reduceBandLadders([cand(24, 1, 2)], fixed)[0].refusal).toEqual({ code: 'WRAP_EXCEEDS_ALLOWANCE' })
    expect(reduceBandLadders([cand(24, 1, 0), cand(72, 1, 0)], fixed)[1].refusal).toEqual({ code: 'NO_WRAPPED_LAYOUT_IN_BAND' })
  })
})

describe('v3.5.3 scaling — fixture 3 on real shapes', () => {
  it('square: 1@24; 2 and 4@72; 8@120; 12@168 — all even, strictly increasing, no repeat', () => {
    const solved = solveBands(square, fixed0)
    expect(rungsOf(solved.bands)).toEqual([[[24, 1, 1]], [[72, 2, 1], [72, 4, 1]], [[120, 8, 1]], [[168, 12, 1]]])
    // the 2-magnet rung is the vertical pair (horizontal eliminated by gravity)
    expect(solved.bands[1].rungs[0].layouts[0].candidate.placement).toEqual({ xHalf: false, yHalf: true })
    expect(solved.gridsBySize.size).toBe(96)
    for (const size of solved.gridsBySize.keys()) expect(size % 2).toBe(0)
  })

  it('square-rotated diamond: 1@34 (air 0.02 reads 0)', () => {
    const solved = solveBands((mm) => diamond(mm / 2), fixed0)
    expect(solved.bands[0].rungs[0]).toMatchObject({ sizeMM: 34, magnetCount: 1 })
  })

  it('squircle preset publishes 8 in B4', () => {
    const base = normBaseContour(getShape('squircle', 1024, 1024), 1024)!
    const solved = solveBands(makeSizer(base, 0), { ...fixed0, centreMode: 2 })
    expect(solved.bands[3].rungs.map((r) => r.magnetCount)).toContain(8)
  })

  it('autoFlapInBand is the same solve under the Auto policy (no scan)', () => {
    const solved = autoFlapInBand((mm) => diamond(mm / 2), { paddingMM: 12, centreMode: 0, perimeterOnly: true }, 2)
    const first = solved.bands[0].rungs[0]
    expect(first.magnetCount).toBe(1)
    expect(first.layouts[0].wrap.appliedFlapMM).toBeLessThanOrEqual(2)
  })
})

describe('v3.5.3 scaling — stored rendering (fixture 6)', () => {
  it('fitSizeInBand renders a stored co-lawful layout with zero compute calls and the offset contour intact', () => {
    const base = normBaseContour(getShape('square', 1024, 1024), 1024)!
    const sized = makeSizer(base, 1)                         // outline offset 1 mm: the solved contour is the offset one
    const solved = solveBands(sized, fixed0)
    const spy = vi.spyOn(engine, 'computeGrid')
    const b2 = solved.bands[1]
    expect(b2.rungs.length).toBeGreaterThan(0)
    const rung = b2.rungs[0]
    const grids = rung.layouts.map((_, i) => fitSizeInBand(solved, 2, 0, i))
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
    for (const [i, g] of grids.entries()) {
      expect(g.phaseMM).toEqual(rung.layouts[i].candidate.phaseMM)
      expect(g.lattice).toEqual(rung.layouts[i].candidate.lattice)
      expect(g.anchors).toEqual(rung.layouts[i].candidate.anchors)
      expect(g.wrap).toEqual(rung.layouts[i].wrap)
      expect(g.contactsMM).toEqual(rung.layouts[i].wrap.witnesses.map((w) => w.outlinePointMM))
      expect(g.concessions).toEqual([])
      expect(g.segments).toBe(solved.gridsBySize.get(rung.sizeMM)!.segments)
    }
    // every rung's stored candidate carries the requested size, never the offset bbox
    for (const band of solved.bands) for (const r of band.rungs) for (const l of r.layouts) expect(l.candidate.sizeMM).toBe(r.sizeMM)
    expect(() => fitSizeInBand(solved, 2, 99, 0)).toThrow()
  })

  it('two co-lawful placements at one rung render distinct phase and lattice, each equal to its own stored candidate', () => {
    // measured: the square-rotated diamond publishes a B3 rung at 130 mm with count 4 and two co-lawful layouts
    const solved = solveBands((mm) => diamond(mm / 2), fixed0)
    const b3 = solved.bands[2]
    const rung = b3.rungs.find((r) => r.sizeMM === 130 && r.magnetCount === 4)!
    expect(rung).toBeDefined()
    expect(rung.layouts).toHaveLength(2)
    const idx = b3.rungs.indexOf(rung)
    const a = fitSizeInBand(solved, 3, idx, 0), b = fitSizeInBand(solved, 3, idx, 1)
    expect(a.phaseMM).not.toEqual(b.phaseMM)
    expect(a.lattice).not.toEqual(b.lattice)
    expect(a.phaseMM).toEqual(rung.layouts[0].candidate.phaseMM)
    expect(a.lattice).toEqual(rung.layouts[0].candidate.lattice)
    expect(b.phaseMM).toEqual(rung.layouts[1].candidate.phaseMM)
    expect(b.lattice).toEqual(rung.layouts[1].candidate.lattice)
    expect(a.anchors).toHaveLength(4)
    expect(b.anchors).toHaveLength(4)
  })
})
