import { describe, expect, it } from 'vitest'
import { getShape } from '../../shape-library'
import { makeSizer, normBaseContour } from '../../effect/magnetic-grid-bridge'
import { computeGrid as computeLegacy } from '../../effect/grid-origin'
import { computeGrid as computeLaw } from '../engine'

const comparisonConfig = {
  pitchMM: 48,
  paddingMM: 12,
  phaseStepMM: 1,
  massDepthMM: 16,
  centreMode: 2,
  governor: 0,
  plan: 'all6' as const,
  perimeterOnly: true,
}

describe('v3.5.1 frozen Centre at nonzero flap', () => {
  it('preserves Centre evidence while removing only legacy seat-margin double counting', () => {
    const base = normBaseContour(getShape('squircle', 1024, 1024), 1024)
    expect(base).not.toBeNull()
    const contour = makeSizer(base!, 0)(72)

    const flap0 = computeLaw(contour, 72, { ...comparisonConfig, flapMM: 0 })
    const flap4 = computeLaw(contour, 72, { ...comparisonConfig, flapMM: 4 })
    expect({
      centreMainMM: flap4.centreMainMM,
      centresMM: flap4.centresMM,
      segments: flap4.segments,
    }).toEqual({
      centreMainMM: flap0.centreMainMM,
      centresMM: flap0.centresMM,
      segments: flap0.segments,
    })

    const legacyWithoutDoubleCount = computeLegacy(contour, {
      ...comparisonConfig,
      circle: false,
      positioning: 1,
      flapMM: 4,
      seatMarginMM: 0,
    })
    expect(flap4.phaseMM).toEqual(legacyWithoutDoubleCount.phaseMM)
    expect(flap4.anchors).toEqual(legacyWithoutDoubleCount.anchors)

    // R15 line 129 replaces the old flap-as-seat-inflation path once Wrap is live.
    const legacyWithDoubleCount = computeLegacy(contour, {
      ...comparisonConfig,
      circle: false,
      positioning: 1,
      flapMM: 4,
      seatMarginMM: 4,
    })
    expect(legacyWithDoubleCount.anchors).not.toEqual(flap4.anchors)
  })
})
