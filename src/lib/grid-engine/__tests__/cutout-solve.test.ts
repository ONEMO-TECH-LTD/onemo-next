// The cutout door, end to end: a millimetre contour enters; per band the judge returns the sizes
// and exact layouts the flap law accepts. These tests encode WHY: placements obey the per-side
// flap bounds (12 tight / 24 outer), bands aim at their target counts, gravity holds the top,
// magnets keep lawful spacing, and the whole answer is deterministic.

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
  it('answers a square per band: flap law held, target counts aimed, spacing lawful', { timeout: 60000 }, () => {
    const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, square(100))
    expect(judged).not.toBeNull()
    const { bands } = judged!

    expect(bands.length).toBe(RELEASED_CALIBRATION.bands.length)
    for (const answer of bands.filter((b) => b.band.released)) {
      expect(answer.variants.length).toBeGreaterThanOrEqual(1)
      for (const variant of answer.variants) {
        expect(variant.sizeMM).toBeGreaterThanOrEqual(answer.band.minSizeMM)
        expect(variant.sizeMM).toBeLessThan(answer.band.maxSizeMM)
        expect(variant.sizeMM % 2).toBe(0)
        // THE MINIMUM-PAIR LAW: the pair is the floor (single in band 1); target is preference
        expect(variant.anchors.length).toBeGreaterThanOrEqual(
          Math.min(answer.band.targetMagnets, 2),
        )
        // THE FLAP LAW, proportional: sides bounded by the padded block's own span (capped by
        // the limb allowance); vertical carries the limb allowance
        expect(Math.max(variant.wrap.left, variant.wrap.right)).toBeLessThanOrEqual(
          Math.min(RELEASED_CALIBRATION.flapLimbMM, variant.wrap.gridExtentXMM),
        )
        expect(Math.max(variant.wrap.top, variant.wrap.bottom)).toBeLessThanOrEqual(
          RELEASED_CALIBRATION.flapLimbMM,
        )
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
      // the band's ANSWER (first variant) hits the tight tier on a plain square
      expect(answer.variants[0].tier).toBe('tight')
    }
  })

  it('holds the top of a concave freeform — gravity law in the ranking', { timeout: 60000 }, () => {
    const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, lShape(100))
    expect(judged).not.toBeNull()
    const released = judged!.bands.filter((b) => b.band.released)
    for (const answer of released) {
      expect(answer.variants.length).toBeGreaterThanOrEqual(1)
      const best = answer.variants[0]
      // the winning placement holds the top — within the gravity guard's bound
      expect(best.wrap.top).toBeLessThanOrEqual(RELEASED_CALIBRATION.flapMaxMM)
    }
  })

  it('is deterministic — the same shape answers byte-identically twice', { timeout: 60000 }, () => {
    const first = solveCutout(RELEASED, RELEASED_CALIBRATION, lShape(140))
    const second = solveCutout(RELEASED, RELEASED_CALIBRATION, lShape(140))
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('rejects a degenerate contour instead of guessing', () => {
    const degenerate: Contour = { outer: { pts: [[0, 0]] as Pt[] }, holes: [] }
    expect(solveCutout(RELEASED, RELEASED_CALIBRATION, degenerate)).toBeNull()
  })
})
