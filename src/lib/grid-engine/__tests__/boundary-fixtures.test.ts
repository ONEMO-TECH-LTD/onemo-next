// BOUNDARY FIXTURES — one step below, exactly on, and one step above every threshold
// (R3 §13.4 / Meta's plan row / QA's knife-edge finding: rule results may change only through
// a stated boundary, never by backend accident). This file covers every PURE threshold —
// predicates and guarded writers. Solve-level boundary shapes (a wrap engineered to exactly
// 28.0mm) require exact seat construction and ride with Phase 1's certified placement.

import { describe, expect, it } from 'vitest'

import {
  pointsOneComponent,
  pointsFillBlock,
  pointsMirrorSymmetric,
  waistRatio,
} from '../compute/structure'
import { RELEASED, RELEASED_CALIBRATION, applyCalibrationValue, applyGridValue } from '../spec'
import type { Pt } from '../compute/types'

describe('strip link bound — below/on/above', () => {
  const cap = RELEASED_CALIBRATION.stripLinkMM
  const pair = (d: number): Pt[] => [
    [0, 0],
    [d, 0],
  ]
  it(`link ${cap - 0.02} (below) connects`, () => {
    expect(pointsOneComponent(pair(cap - 0.02), cap)).toBe(true)
  })
  it(`link ${cap} (exactly on) connects — closed bound, tangency passes`, () => {
    expect(pointsOneComponent(pair(cap), cap)).toBe(true)
  })
  it(`link ${cap + 0.02} (above) is disconnected`, () => {
    expect(pointsOneComponent(pair(cap + 0.02), cap)).toBe(false)
  })
})

describe('filled-block quantization — the half-cell rounding boundary', () => {
  const cell = 24
  it('offsets just under the half-cell boundary stay one column', () => {
    const pts: Pt[] = [
      [0, 0],
      [11.9, 48],
    ]
    // 11.9/24 rounds to 0 — same column, 1x2 block
    expect(pointsFillBlock(pts, cell)).toBe(true)
  })
  it('offsets just over the half-cell boundary become two columns — not a block', () => {
    const pts: Pt[] = [
      [0, 0],
      [12.1, 48],
    ]
    // 12.1/24 rounds to 1 — a 2x2 grid with only 2 points
    expect(pointsFillBlock(pts, cell)).toBe(false)
  })
})

describe('mirror-symmetry tolerance — below/above the exact-reflection bound', () => {
  // a mid point offset δ from the set's centre reflects 2δ away from itself
  const trio = (deltaMM: number): Pt[] => [
    [0, 0],
    [40, 0],
    [20 + deltaMM, 10],
  ]
  it('reflection error 8e-7 (below tol) is symmetric', () => {
    expect(pointsMirrorSymmetric(trio(4e-7))).toBe(true)
  })
  it('reflection error 4e-6 (above tol) is not', () => {
    expect(pointsMirrorSymmetric(trio(2e-6))).toBe(false)
  })
})

describe('waist ratio — exact arithmetic at the classification boundary value', () => {
  it('mid/end of exactly the released threshold returns it exactly', () => {
    const t = RELEASED_CALIBRATION.structureWaistRatio
    const rows = [
      { span: 100 },
      { span: 100 },
      { span: 100 * t },
      { span: 100 * t },
      { span: 100 },
      { span: 100 },
    ]
    expect(waistRatio(rows)).toBeCloseTo(t, 12)
  })
})

describe('guarded writer bounds — min/max accepted, one step outside refused', () => {
  const NUMERIC: Array<[Parameters<typeof applyCalibrationValue>[1], number, number]> = [
    ['flapTightMM', 0, 60],
    ['flapMaxMM', 0, 80],
    ['flapLimbMM', 0, 120],
    ['sweepStepMM', 1, 48],
    ['centerToleranceMM', 0, 60],
    ['sizeStepMM', 2, 48],
    ['symmetryTolFrac', 0, 1],
    ['structureWaistRatio', 0, 1],
    ['structureTaperCorr', 0, 1],
    ['structureDiagSlope', 0, 1],
    ['structureMassRatio', 0, 1],
    ['optionsPerBand', 1, 12],
    ['bandSizeStepMM', 0, 96],
    ['stripLinkMM', 48, 136],
    ['cornersMinExtentMM', 24, 216],
    ['structureScanlines', 8, 96],
    ['massFieldSamples', 8, 128],
    ['maxTestedMM', 20, 1000],
  ]
  for (const [key, min, max] of NUMERIC) {
    it(`${key}: [${min}, ${max}] closed, outside refused`, () => {
      expect(applyCalibrationValue(RELEASED_CALIBRATION, key, min).refused).toBeUndefined()
      expect(applyCalibrationValue(RELEASED_CALIBRATION, key, max).refused).toBeUndefined()
      expect(applyCalibrationValue(RELEASED_CALIBRATION, key, min - 0.001).refused).toBe('out-of-range')
      expect(applyCalibrationValue(RELEASED_CALIBRATION, key, max + 0.001).refused).toBe('out-of-range')
    })
  }

  it('grid paddingMM: [1, 60] closed, outside refused', () => {
    expect(applyGridValue(RELEASED, 'paddingMM', 1).refused).toBeUndefined()
    expect(applyGridValue(RELEASED, 'paddingMM', 60).refused).toBeUndefined()
    expect(applyGridValue(RELEASED, 'paddingMM', 0.999).refused).toBe('out-of-range')
    expect(applyGridValue(RELEASED, 'paddingMM', 60.001).refused).toBe('out-of-range')
  })
})
