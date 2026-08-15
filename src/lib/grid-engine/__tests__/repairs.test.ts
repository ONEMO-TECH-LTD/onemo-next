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

describe('band fallback — proven to RUN, not just to be lawful (QA base-closure F2)', () => {
  it('a narrow column forces band 4 through the fallback: the stepping law forbids echoing a lower band, so an echoed-yet-lawful answer can only come from the fallback branch', { timeout: 300000 }, () => {
    // 55:220 aspect — one anchor column only. The 96-spaced 3-run spans 192+24 > every
    // band-4 size (cap 214), so band 4 has NO fresh arrangement: every candidate's identity
    // already answered a lower band. The normal path (stepUp echo filter) must empty; only
    // the fallback may answer — and it answers with a lower band's identity, lawfully.
    const contour: Contour = {
      outer: {
        pts: [
          [0, 0],
          [55, 0],
          [55, 220],
          [0, 220],
        ] as Pt[],
      },
      holes: [],
    }
    const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, contour)
    expect(judged).not.toBeNull()
    const b3 = judged!.bands.find((b) => b.band.band === 3)!.variants[0]
    const b4 = judged!.bands.find((b) => b.band.band === 4)!.variants[0]
    expect(b3).toBeDefined()
    expect(b4, 'band 4 must still answer (every band answers)').toBeDefined()
    // the proof the fallback ran: band 4 repeats band 3's arrangement, which the stepping
    // law bars from the normal offer path on a stepUp band
    expect(b4.layout, 'echoed arrangement = fallback branch').toBe(b3.layout)
    expect(b4.topHangMM ?? b4.wrap.top).toBeLessThanOrEqual(RELEASED_CALIBRATION.flapMaxMM)
    expect(b4.wrap.bottom).toBeLessThanOrEqual(RELEASED_CALIBRATION.flapLimbMM)
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
      expect(v.topHangMM ?? v.wrap.top, `B${band.band.band} top`).toBeLessThanOrEqual(RELEASED_CALIBRATION.flapMaxMM)
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
