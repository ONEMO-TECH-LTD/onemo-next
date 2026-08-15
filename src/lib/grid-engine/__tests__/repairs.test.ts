// NAMED REGRESSION TESTS for the audit repairs (QA adjudication: the fixes were established by
// probes, not by tests that would fail on regression). Each test pins one repaired behaviour.

import { describe, expect, it } from 'vitest'

import { pointsOneComponent } from '../compute/structure'
import {
  RELEASED_CALIBRATION,
  applyCalibrationValue,
  applyGridValue,
  RELEASED,
  selectCalibrationOption,
} from '../spec'
import { solveCutout } from '../bridge'
import type { Contour, Pt } from '../compute/types'

describe('strip law — single-linkage connectivity, not the pairwise minimum', () => {
  it('two tight pairs far apart are disconnected islands', () => {
    // nearest-anchor distance is 48 in each pair, but the pairs sit 200mm apart
    const pts: Pt[] = [
      [0, 0],
      [0, 48],
      [200, 0],
      [200, 48],
    ]
    expect(pointsOneComponent(pts, RELEASED_CALIBRATION.stripLinkMM)).toBe(false)
  })

  it('a chain connects through its links', () => {
    const pts: Pt[] = [
      [0, 0],
      [0, 96],
      [0, 192],
    ]
    expect(pointsOneComponent(pts, RELEASED_CALIBRATION.stripLinkMM)).toBe(true)
  })

  it('the ruled canon triangle link (48x96 diagonal, 107.3mm) stays connected', () => {
    const pts: Pt[] = [
      [48, 0],
      [0, 96],
      [96, 96],
    ]
    expect(pointsOneComponent(pts, RELEASED_CALIBRATION.stripLinkMM)).toBe(true)
  })

  it('the 96x96 corner-fling diagonal (135.8mm) is disconnected', () => {
    const pts: Pt[] = [
      [0, 0],
      [96, 96],
    ]
    expect(pointsOneComponent(pts, RELEASED_CALIBRATION.stripLinkMM)).toBe(false)
  })
})

describe('guarded writers — refusal, never clamping or silent acceptance', () => {
  it('numeric writes outside bounds refuse', () => {
    expect(applyCalibrationValue(RELEASED_CALIBRATION, 'flapMaxMM', 500).refused).toBe('out-of-range')
    expect(applyCalibrationValue(RELEASED_CALIBRATION, 'stripLinkMM', 10).refused).toBe('out-of-range')
    expect(applyCalibrationValue(RELEASED_CALIBRATION, 'flapMaxMM', NaN).refused).toBe('not-a-number')
  })

  it('option writes outside the released set refuse', () => {
    expect(selectCalibrationOption(RELEASED_CALIBRATION, 'plan', 'invented').refused).toBe('options-only')
  })

  it('sealed grid values cannot be written by any route', () => {
    expect(applyGridValue(RELEASED, 'basePitchMM', 24).refused).toBe('sealed-in-code')
  })

  it('released template steps are deeply frozen', () => {
    const t = RELEASED_CALIBRATION.templates[1]
    expect(Object.isFrozen(t.steps)).toBe(true)
    expect(Object.isFrozen(t.steps[0])).toBe(true)
  })
})

describe('band fallback — preferences may relax, hold laws never', () => {
  it('no band winner ever violates gravity, vertical hold, or connectivity', { timeout: 300000 }, () => {
    // a shape hostile enough to force fallbacks: a wide shallow slab with a hanging tongue
    const contour: Contour = {
      outer: {
        pts: [
          [0, 0],
          [160, 0],
          [160, 40],
          [95, 40],
          [95, 110],
          [65, 110],
          [65, 40],
          [0, 40],
        ] as Pt[],
      },
      holes: [],
    }
    const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, contour)
    expect(judged).not.toBeNull()
    for (const band of judged!.bands) {
      const v = band.variants[0]
      if (!v) continue // NONE is an honest answer
      expect(v.wrap.top, `B${band.band.band} top`).toBeLessThanOrEqual(RELEASED_CALIBRATION.flapMaxMM)
      expect(v.wrap.bottom, `B${band.band.band} bottom`).toBeLessThanOrEqual(
        RELEASED_CALIBRATION.flapLimbMM,
      )
      expect(
        pointsOneComponent(
          v.anchors.map((a) => a.p),
          RELEASED_CALIBRATION.stripLinkMM,
        ),
        `B${band.band.band} connectivity`,
      ).toBe(true)
    }
  })
})
