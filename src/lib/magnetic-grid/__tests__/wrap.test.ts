import { describe, expect, it } from 'vitest'
import { measureWrap } from '../compute/wrap-measurement'
import { nearestOutlineMM } from '../compute/seat'
import { evaluateWrap } from '../logic'
import { bandSnapPoints, computeGrid, fitSizeInBand } from '../engine'
import type { Contour, WrapMeasurement } from '../spec'

const square = (side: number): Contour => ({
  outer: { pts: [[-side / 2, -side / 2], [side / 2, -side / 2], [side / 2, side / 2], [-side / 2, side / 2]] },
  holes: [],
})

const diamond = (axisRadius: number): Contour => ({
  outer: { pts: [[0, axisRadius], [axisRadius, 0], [0, -axisRadius], [-axisRadius, 0]] },
  holes: [],
})

const holed: Contour = {
  outer: { pts: [[-20, -20], [20, -20], [20, 20], [-20, 20]] },
  holes: [{ pts: [[-5, -5], [5, -5], [5, 5], [-5, 5]] }],
}

const baseConfig = { paddingMM: 12, centreMode: 0, perimeterOnly: true } as const
const fixed0 = { ...baseConfig, flapMM: 0, wrapMode: 'fixed' as const }

describe('v3.5.3 Wrap on the 1 mm ruler', () => {
  it('square 24 is lawful at flap 0 with four co-nearest witnesses at clearance 0', () => {
    const grid = computeGrid(square(24), fixed0)
    expect(grid.wrap.status).toBe('lawful')
    if (grid.wrap.status !== 'lawful') return
    expect(grid.wrap.requiredFlapMM).toBe(0)
    expect(grid.wrap.witnesses).toHaveLength(4)
    expect(new Set(grid.wrap.witnesses.map((w) => JSON.stringify(w.beltAnchorMM))).size).toBe(1)
    expect(new Set(grid.wrap.witnesses.map((w) => JSON.stringify(w.outlinePointMM))).size).toBe(4)
    expect(grid.wrap.witnesses.every((w) => w.clearanceMM === 0)).toBe(true)
    expect(grid.contactsMM).toEqual(grid.wrap.witnesses.map((w) => w.outlinePointMM))
  })

  it('square 26 at pitch 48 requires 1; a clearance of exactly 0.5 reads 1 and refuses flap 0', () => {
    const s26 = computeGrid(square(26), { ...fixed0, pitchMM: 48 })
    expect(s26.wrap).toMatchObject({ status: 'refused', code: 'WRAP_EXCEEDS_ALLOWANCE', requiredFlapMM: 1, allowedFlapMM: 0 })
    expect(s26.contactsMM).toEqual([])
    const s25 = computeGrid(square(25), fixed0)
    expect(s25.wrap).toMatchObject({ status: 'refused', requiredFlapMM: 1 })
    expect(computeGrid(square(25), { ...fixed0, flapMM: 1 }).wrap).toMatchObject({ status: 'lawful', requiredFlapMM: 1, appliedFlapMM: 1 })
  })

  it('diamond 34 seats with 0.02 mm of air, reads 0 and is lawful at flap 0; diamond 36 requires 1', () => {
    const d34 = computeGrid(diamond(17), fixed0)
    expect(d34.wrap).toMatchObject({ status: 'lawful', requiredFlapMM: 0 })
    expect(nearestOutlineMM(diamond(17), [0, 0]).distMM).toBeGreaterThan(12)
    expect(computeGrid(diamond(18), fixed0).wrap).toMatchObject({ status: 'refused', code: 'WRAP_EXCEEDS_ALLOWANCE', requiredFlapMM: 1 })
  })

  it('signed ruler: −0.49 reads 0 and stays seated; −0.51 reads −1 and is not admitted', () => {
    const nearMiss = measureWrap(square(23.02), [[0, 0]], 48, 12)
    expect(nearMiss.seated).toEqual([[0, 0]])
    expect(nearMiss.wrapMeasurement).toMatchObject({ status: 'measured', requiredFlapMM: 0 })
    const miss = measureWrap(square(22.98), [[0, 0]], 48, 12)
    expect(miss.seated).toEqual([])
    expect(miss.wrapMeasurement).toMatchObject({ status: 'refused', refusal: { code: 'NO_WRAPPED_LAYOUT_IN_BAND', reason: 'empty-belt' } })
  })

  it('applies the same −0.49/−0.51 ruler thresholds at a hole boundary', () => {
    const nearMiss = measureWrap(holed, [[0, 8.51]], 48, 4)
    expect(nearMiss.seated).toEqual([[0, 8.51]])
    expect(nearMiss.wrapMeasurement).toMatchObject({ status: 'measured', requiredFlapMM: 0 })
    const miss = measureWrap(holed, [[0, 8.49]], 48, 4)
    expect(miss.seated).toEqual([])
    expect(miss.wrapMeasurement).toMatchObject({ status: 'refused', refusal: { code: 'NO_WRAPPED_LAYOUT_IN_BAND', reason: 'empty-belt' } })
  })

  it('an anchor centre inside a hole or outside the ring is signed negative before the radius and never admitted', () => {
    const inHole = measureWrap(holed, [[0, 0]], 48, 4)
    expect(inHole.seated).toEqual([])
    const outside = measureWrap(square(24), [[100, 0]], 48, 4)
    expect(outside.seated).toEqual([])
    // a large unsigned distance cannot rescue either: the material sign comes first
    expect(nearestOutlineMM(square(24), [100, 0]).distMM).toBeGreaterThan(4)
  })

  it('a hole segment can be the binding witness and Auto returns the minimum within its cap', () => {
    const law = measureWrap(holed, [[0, 10]], 48, 4)
    expect(law.wrapMeasurement).toMatchObject({ status: 'measured', requiredFlapMM: 1 })
    if (law.wrapMeasurement.status !== 'measured') return
    expect(law.wrapMeasurement.witnesses).toHaveLength(1)
    expect(law.wrapMeasurement.witnesses[0].outlinePointMM).toEqual([0, 5])
    expect(evaluateWrap(law.wrapMeasurement, { mode: 'auto', capMM: 3 })).toMatchObject({ status: 'lawful', appliedFlapMM: 1 })
    expect(evaluateWrap(law.wrapMeasurement, { mode: 'auto', capMM: 0 })).toMatchObject({ status: 'refused', code: 'AUTO_FLAP_CAP_EXCEEDED' })
    const auto = computeGrid(diamond(18), { ...baseConfig, wrapMode: 'auto', autoFlapCapMM: 1 })
    expect(auto.wrap).toMatchObject({ status: 'lawful', requiredFlapMM: 1, appliedFlapMM: 1 })
    expect(computeGrid(diamond(18), { ...baseConfig, wrapMode: 'auto', autoFlapCapMM: 0 }).wrap).toMatchObject({ status: 'refused', code: 'AUTO_FLAP_CAP_EXCEEDED' })
  })

  it('an invalid boundary and an empty belt refuse with null allowance evidence, and Logic never invents one', () => {
    const degenerate = measureWrap({ outer: { pts: [] }, holes: [] }, [[0, 0]], 48, 4).wrapMeasurement
    expect(degenerate).toEqual({ status: 'refused', requiredFlapMM: null, witnesses: [], refusal: { code: 'NO_WRAPPED_LAYOUT_IN_BAND', reason: 'invalid-boundary' } })
    const empty = measureWrap(square(24), [], 48, 12).wrapMeasurement
    expect(empty).toMatchObject({ status: 'refused', requiredFlapMM: null, refusal: { reason: 'empty-belt' } })
    for (const measured of [degenerate, empty]) {
      const verdict = evaluateWrap(measured, { mode: 'fixed', allowanceMM: 0 })
      expect(verdict).toEqual({ status: 'refused', code: 'NO_WRAPPED_LAYOUT_IN_BAND', reason: measured.refusal!.reason, requiredFlapMM: null, allowedFlapMM: null, witnesses: [] })
    }
    const mutated = { ...degenerate, requiredFlapMM: 0 } as unknown as WrapMeasurement
    expect(evaluateWrap(mutated, { mode: 'fixed', allowanceMM: 0 })).toMatchObject({ requiredFlapMM: null })
  })

  it('refuses a malformed or non-finite hole as an invalid complete boundary', () => {
    const invalidHoles: Contour['holes'] = [
      { pts: [[0, 0], [1, 0]] },
      { pts: [[0, 0], [1, 0], [Number.NaN, 1]] },
    ]
    for (const hole of invalidHoles) {
      expect(measureWrap({ ...square(24), holes: [hole] }, [[0, 0]], 48, 4).wrapMeasurement).toEqual({
        status: 'refused', requiredFlapMM: null, witnesses: [],
        refusal: { code: 'NO_WRAPPED_LAYOUT_IN_BAND', reason: 'invalid-boundary' },
      })
    }
  })

  it('Coverage changes the output population only; the seated set, belt and every witness are identical', () => {
    const perimeter = computeGrid(square(120), { ...fixed0, perimeterOnly: true })
    const full = computeGrid(square(120), { ...fixed0, perimeterOnly: false })
    expect(full.anchors.length).toBeGreaterThan(perimeter.anchors.length)
    expect(full.wrap).toEqual(perimeter.wrap)
    expect(full.contactsMM).toEqual(perimeter.contactsMM)
  })

  it('the interim band path publishes only evaluated even sizes', () => {
    const sized = (mm: number): Contour => ({
      outer: { pts: [[0, 0], [mm, 0], [mm, mm * 0.7], [0, mm * 0.7]] },
      holes: [],
    })
    expect(bandSnapPoints(sized, {
      pitchMM: 48, paddingMM: 12, flapMM: 4, centreMode: 0,
    }, 24, 2)).toEqual([{ sizeMM: 36, count: 1 }])
  })

  it('the existing band caller returns the same Wrap verdict as direct fixed-size inspection', () => {
    const sized = (side: number) => square(side)
    const fit = fitSizeInBand(sized, fixed0, 24, 2)
    expect(fit.grid.wrap).toEqual(computeGrid(sized(fit.sizeMM), fixed0).wrap)
  })
})
