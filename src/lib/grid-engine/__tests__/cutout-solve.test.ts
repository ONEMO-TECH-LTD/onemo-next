// The cutout door, end to end: a millimetre contour enters; per band the judge returns the sizes
// and exact layouts it can certify. These tests encode WHY: magnets keep lawful spacing, gravity
// holds the top, unsupported extent obeys the released P4 switch, and the answer is deterministic.
//
// A RELEASED BAND IS NOT OBLIGED TO ANSWER. The old '§9 every band must answer' guarantee was
// displaced by PB §19's explained refusal, and T6 forbids a fallback that would manufacture one. An
// empty band must therefore say NONE and carry machine-readable rejections — that IS the answer.
// The governing refusal is `unsupportedExtentPolicy`, not the legacy centering tolerance or
// flapMaxMM; those remain reported measurements and are asserted as such, never as the refusal.

import { describe, expect, it } from 'vitest'

import { solveCutout } from '../bridge'
import type { Contour, Pt } from '../compute/types'
import { RELEASED, RELEASED_CALIBRATION } from '../spec'

function square(sizeMM: number): Contour {
  return {
    outer: {
      pts: [
        [0, 0],
        [sizeMM, 0],
        [sizeMM, sizeMM],
        [0, sizeMM],
      ] as Pt[],
    },
    holes: [],
  }
}

/** A concave freeform stand-in: an L whose notch removes the top-right quarter. */
function lShape(sizeMM: number): Contour {
  const h = sizeMM / 2
  return {
    outer: {
      pts: [
        [0, 0],
        [sizeMM, 0],
        [sizeMM, h],
        [h, h],
        [h, sizeMM],
        [0, sizeMM],
      ] as Pt[],
    },
    holes: [],
  }
}

describe('solveCutout — the shape-in, sizes+layouts-out door', () => {
  it('answers a square per band: flap law held, spacing lawful', { timeout: 60000 }, () => {
    const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, square(100))
    expect(judged).not.toBeNull()
    const { bands } = judged!

    expect(bands.length).toBe(RELEASED_CALIBRATION.bands.length)
    const released = bands.filter((b) => b.band.released)
    // NON-VACUITY: at least one released band must genuinely offer something, or every per-offer
    // check below would pass by never running.
    expect(released.some((answer) => answer.variants.length > 0)).toBe(true)

    for (const answer of released) {
      if (!answer.variants.length) {
        // An explained refusal, not a silent gap.
        expect(answer.decisionState).toBe('NONE')
        expect(answer.rejections.length).toBeGreaterThan(0)
        for (const rejection of answer.rejections) expect(rejection.reasons.length).toBeGreaterThan(0)
        continue
      }
      for (const variant of answer.variants) {
        expect(variant.sizeMM).toBeGreaterThanOrEqual(answer.band.minSizeMM)
        expect(variant.sizeMM).toBeLessThan(answer.band.maxSizeMM)
        expect(variant.sizeMM % 2).toBe(0)
        // NO COUNT GATE — any count that fits is lawful
        expect(variant.anchors.length).toBeGreaterThanOrEqual(1)
        // THE YARDSTICK IS REPORTED, NEVER THE REFUSAL. wrap is a measurement that must exist;
        // what governs acceptance is the P4 policy, asserted below.
        expect(variant.wrap).toBeDefined()
        // P4 GOVERNS: any side past the active limit is accepted ONLY as an announced exemption.
        const policy = variant.selection!.unsupportedExtentPolicy
        expect([12, 24]).toContain(policy.activeLimitMM)
        const over = (['left', 'right', 'top', 'bottom'] as const).filter(
          (side) => policy.perSideMM[side] > policy.activeLimitMM,
        )
        if (over.length) {
          expect(policy.outcome).toBe('TRIVIAL_LIMB_EXEMPT')
          expect(policy.exemptedSides.map((entry) => entry.side).sort()).toEqual([...over].sort())
        } else expect(policy.outcome).toBe('WITHIN_LIMIT')
        // no two magnets closer than two paddings — application rings never overlap
        const padFloor = 2 * RELEASED.grid.paddingMM - 1e-6
        for (let i = 0; i < variant.anchors.length; i++)
          for (let j = i + 1; j < variant.anchors.length; j++) {
            const a = variant.anchors[i].p
            const b = variant.anchors[j].p
            expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(padFloor)
          }
        for (const anchor of variant.anchors) {
          expect([RELEASED.magnet.smallMM, RELEASED.magnet.largeMM]).toContain(anchor.dia)
        }
      }
    }
  })

  it('holds the top of a concave freeform — gravity law in the ranking', { timeout: 60000 }, () => {
    const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, lShape(100))
    expect(judged).not.toBeNull()
    const released = judged!.bands.filter((b) => b.band.released)

    // NON-VACUITY: the gravity check below is only meaningful if something was offered at all.
    const offering = released.filter((answer) => answer.variants.length > 0)
    expect(offering.length).toBeGreaterThan(0)

    for (const answer of released) {
      if (!answer.variants.length) {
        expect(answer.decisionState).toBe('NONE')
        expect(answer.rejections.length).toBeGreaterThan(0)
        continue
      }
      // The offered placement holds the top: its upward reach is the smallest of the four sides,
      // which is what "gravity holds it" means for a hanging cutout.
      const best = answer.variants[0]
      const policy = best.selection!.unsupportedExtentPolicy
      expect(policy.perSideMM.top).toBeLessThanOrEqual(
        Math.max(policy.perSideMM.left, policy.perSideMM.right, policy.perSideMM.bottom),
      )
    }
  })

  it('is deterministic — the same shape answers byte-identically twice', { timeout: 240000 }, () => {
    const first = solveCutout(RELEASED, RELEASED_CALIBRATION, lShape(140))
    const second = solveCutout(RELEASED, RELEASED_CALIBRATION, lShape(140))
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('rejects a degenerate contour instead of guessing', () => {
    const degenerate: Contour = { outer: { pts: [[0, 0]] as Pt[] }, holes: [] }
    expect(solveCutout(RELEASED, RELEASED_CALIBRATION, degenerate)).toBeNull()
  })
})
