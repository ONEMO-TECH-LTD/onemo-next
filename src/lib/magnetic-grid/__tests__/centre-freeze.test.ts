import { describe, expect, it } from 'vitest'
import { getShape } from '../../shape-library'
import { makeSizer, normBaseContour } from '../../effect/magnetic-grid-bridge'
import { computeGrid as computeLegacy } from '../../effect/grid-origin'
import { computeGrid as computeLaw } from '../engine'
import { bbox, makeSeatPredicate, measureCentrePlacements } from '../compute/seat'
import { centrePhaseCandidates, chooseCentrePlacement } from '../logic'

const comparisonConfig = {
  pitchMM: 48,
  paddingMM: 12,
  massDepthMM: 16,
  centreMode: 2,
  governor: 0,
  plan: 'all6' as const,
  perimeterOnly: true,
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
    const base = normBaseContour(getShape('squircle', 1024, 1024), 1024)
    expect(base).not.toBeNull()
    const contour = makeSizer(base!, 0)(72)
    const doubleCountDeltas: string[] = []

    for (const policy of policies) {
      const cfg = { ...comparisonConfig, centreMode: policy.centreMode, governor: policy.governor }
      const lawFlap0 = computeLaw(contour, 72, { ...cfg, flapMM: 0 })
      const frozenFlap0 = computeLegacy(contour, { ...cfg, circle: false, positioning: 1, flapMM: 0, seatMarginMM: 0 })
      expect(centreEvidence(lawFlap0), `${policy.label}: flap-0 Centre evidence`).toEqual(centreEvidence(frozenFlap0))
      expect(placement(lawFlap0), `${policy.label}: flap-0 placement`).toEqual(placement(frozenFlap0))

      const lawFlap4 = computeLaw(contour, 72, { ...cfg, flapMM: 4 })
      const donorWithoutDoubleCount = computeLegacy(contour, { ...cfg, circle: false, positioning: 1, flapMM: 4, seatMarginMM: 0 })
      expect(centreEvidence(lawFlap4), `${policy.label}: positive-flap Centre freeze`).toEqual(centreEvidence(lawFlap0))
      expect(centreEvidence(lawFlap4), `${policy.label}: donor Centre evidence`).toEqual(centreEvidence(donorWithoutDoubleCount))
      expect(placement(lawFlap4), `${policy.label}: authorised no-double-count placement`).toEqual(placement(donorWithoutDoubleCount))

      // The retired band walk inflated the seat by flap as well as granting the same Wrap allowance.
      const donorWithDoubleCount = computeLegacy(contour, { ...cfg, circle: false, positioning: 1, flapMM: 4, seatMarginMM: 4 })
      if (JSON.stringify(placement(donorWithDoubleCount)) !== JSON.stringify(placement(donorWithoutDoubleCount))) {
        doubleCountDeltas.push(policy.label)
        expect(placement(lawFlap4), `${policy.label}: delta is only seat-margin removal`).not.toEqual(placement(donorWithDoubleCount))
      }
    }

    // The fixture must bite the removed legacy path, not merely compare two identical donors.
    expect(doubleCountDeltas.length).toBeGreaterThan(0)
  })

  it('M1: a positive Wrap allowance cannot enter Centre selection — star 128 Box is identical at flap 0 and flap 4', () => {
    const base = normBaseContour(getShape('star', 1024, 1024), 1024)!
    const contour = makeSizer(base, 0)(128)
    const cfg = { pitchMM: 48, paddingMM: 12, centreMode: 0, perimeterOnly: true }
    const flap0 = computeLaw(contour, 128, { ...cfg, flapMM: 0 })
    const flap4 = computeLaw(contour, 128, { ...cfg, flapMM: 4 })
    expect(flap4.centreMainMM).toEqual(flap0.centreMainMM)
    expect(flap4.phaseMM).toEqual(flap0.phaseMM)
    expect(flap4.anchors).toEqual(flap0.anchors)
    // the mutation bites: feeding spot + flap into the frozen tie-break would move the selected phase
    const outer = contour.outer.pts, bb = bbox(outer), fits = makeSeatPredicate(outer, 12)!
    const target = flap0.centreMainMM
    const pick = (reach: number) => chooseCentrePlacement(measureCentrePlacements(bb, 48, centrePhaseCandidates(target, bb, 48), fits, outer, reach))!.phaseMM
    expect(pick(12)).toEqual(flap0.phaseMM)
    expect(pick(12 + 4)).not.toEqual(flap0.phaseMM)
  })
})
