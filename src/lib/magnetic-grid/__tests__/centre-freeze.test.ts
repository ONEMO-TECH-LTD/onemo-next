import { describe, expect, it } from 'vitest'
import { SOLVER_DEFAULTS } from '../spec'
import { configWith } from './config'
import { getShape } from '../../shape-library'
import { makeSizer, normBaseContour } from '../../effect/magnetic-grid-bridge'
import { computeGrid as computeLegacy } from '../../effect/grid-origin'
import { computeGrid as computeLaw } from '../engine'

const comparisonConfig = {
  pitchMM: 48,
  paddingMM: 12,
  massDepthMM: 16,
  centreMode: 2,
  governor: 0,
  magnetPlan: 'all6' as const,
  coverage: 'perimeter' as const,
}

const policies = [
  { label: 'Box', centreMode: 0, governor: 0 },
  { label: 'Core', centreMode: 1, governor: 0 },
  { label: 'Weight', centreMode: 3, governor: 0 },
  { label: 'Deep', centreMode: 4, governor: 0 },
  { label: 'Top', centreMode: 5, governor: 0 },
  { label: 'Masses/smallest', centreMode: 2, governor: 0 },
  { label: 'Masses/deepest', centreMode: 2, governor: 1 },
  { label: 'Masses/top', centreMode: 2, governor: 2 },
  { label: 'Masses/top-small', centreMode: 2, governor: 3 },
] as const

const centreEvidence = (grid: ReturnType<typeof computeLaw> | ReturnType<typeof computeLegacy>) => ({
  centreMainMM: grid.centreMainMM,
  centresMM: grid.centresMM,
  segments: grid.segments,
})

const placement = (grid: ReturnType<typeof computeLaw> | ReturnType<typeof computeLegacy>) => ({
  phaseMM: grid.phaseMM,
  anchors: grid.anchors,
})

describe('v3.5.1 frozen Centre at nonzero flap', () => {
  it('preserves all nine Centre policies and removes only legacy seat-margin double counting', () => {
    const base = normBaseContour(getShape('squircle', 1024, 1024), 1024, SOLVER_DEFAULTS.contourFlattenRefMM)
    expect(base).not.toBeNull()
    const contour = makeSizer(base!, { outlineOffsetMM: 0 })(72)
    const doubleCountDeltas: string[] = []

    for (const policy of policies) {
      const cfg = { ...comparisonConfig, centreMode: policy.centreMode, governor: policy.governor }
      const donorCfg = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM, massDepthMM: cfg.massDepthMM, centreMode: cfg.centreMode, governor: cfg.governor, plan: cfg.magnetPlan, perimeterOnly: true, circle: false, positioning: 1 }
      const lawFlap0 = computeLaw(contour, 72, configWith({ ...cfg, flapLimitMM: 0 }))
      const frozenFlap0 = computeLegacy(contour, { ...donorCfg, flapMM: 0, seatMarginMM: 0 })
      expect(centreEvidence(lawFlap0), `${policy.label}: flap-0 Centre evidence`).toEqual(centreEvidence(frozenFlap0))

      const lawFlap4 = computeLaw(contour, 72, configWith({ ...cfg, flapLimitMM: 4 }))
      const donorWithoutDoubleCount = computeLegacy(contour, { ...donorCfg, flapMM: 4, seatMarginMM: 0 })
      expect(centreEvidence(lawFlap4), `${policy.label}: positive-flap Centre freeze`).toEqual(centreEvidence(lawFlap0))
      expect(centreEvidence(lawFlap4), `${policy.label}: donor Centre evidence`).toEqual(centreEvidence(donorWithoutDoubleCount))

      // The retired band walk inflated the seat by flap as well as granting the same Wrap allowance.
      const donorWithDoubleCount = computeLegacy(contour, { ...donorCfg, flapMM: 4, seatMarginMM: 4 })
      if (JSON.stringify(placement(donorWithDoubleCount)) !== JSON.stringify(placement(donorWithoutDoubleCount))) {
        doubleCountDeltas.push(policy.label)
      }
    }

    // The fixture must bite the removed legacy path, not merely compare two identical donors.
    expect(doubleCountDeltas.length).toBeGreaterThan(0)
  })

  it('M1: a positive Wrap allowance cannot enter Centre selection — star 128 Box is identical at flap 0 and flap 4', () => {
    const base = normBaseContour(getShape('star', 1024, 1024), 1024, SOLVER_DEFAULTS.contourFlattenRefMM)!
    const contour = makeSizer(base, { outlineOffsetMM: 0 })(128)
    const cfg = { pitchMM: 48, paddingMM: 12, centreMode: 0 as const, coverage: 'perimeter' as const }
    const flap0 = computeLaw(contour, 128, configWith({ ...cfg, flapLimitMM: 0 }))
    const flap4 = computeLaw(contour, 128, configWith({ ...cfg, flapLimitMM: 4 }))
    // v3.5.4: the flap limit is a FIT judgement — it may admit or refuse layouts, but it can never
    // move the governed anchor the layouts are judged against.
    expect(flap4.centreMainMM).toEqual(flap0.centreMainMM)
    expect(flap4.centresMM).toEqual(flap0.centresMM)
  })
})
