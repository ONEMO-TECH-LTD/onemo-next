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
        // NO COUNT GATE — any count that fits is lawful
        expect(variant.anchors.length).toBeGreaterThanOrEqual(1)
        // THE YARDSTICK LAW: flap never refuses — it is reported. Centering is enforced.
        expect(variant.wrap).toBeDefined()
        expect(Math.abs(variant.wrap.left - variant.wrap.right) / 2).toBeLessThanOrEqual(
          RELEASED_CALIBRATION.centerToleranceMM,
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
      // THE BAND COUNT LAW + COLUMN LAW: a ruled-count band answers with its ruled count
      // (band 2 = two magnets, canon); a free band on a square — a shape with true corners —
      // answers with a corners-class arrangement of four-plus magnets holding the top.
      const best = answer.variants[0]
      expect(best.wrap.top).toBeLessThanOrEqual(RELEASED_CALIBRATION.flapMaxMM)
      if (answer.band.targetMagnets > 0) {
        expect(best.anchors.length).toBe(answer.band.targetMagnets)
      } else {
        expect(best.anchors.length).toBeGreaterThanOrEqual(4)
        expect(best.wrap.maxSide).toBeLessThanOrEqual(RELEASED_CALIBRATION.flapMaxMM)
      }
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
