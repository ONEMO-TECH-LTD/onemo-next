// The cutout door, end to end: a millimetre contour enters, the lifted v1 engine answers with
// grid-first sizes per band and the exact magnet layout each size seats. These tests encode WHY:
// sizes are grid-dictated (even, in-band, derived from lattice extents), layouts are lawful
// (anchors seated, spacing at least two paddings), and the answer is deterministic.

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
  it('answers a square with grid-dictated sizes inside the released bands', () => {
    const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, square(100))
    expect(judged).not.toBeNull()
    const { rungs, bands } = judged!

    // The ladder is the grid's authority: extents step by the base pitch from one magnet spot.
    expect(rungs.length).toBeGreaterThanOrEqual(3)
    for (const rung of rungs) {
      expect(rung.sizeMM % 2).toBe(0) // published sizes are even — a law, not a habit
      expect(rung.gridExtentMM).toBeGreaterThanOrEqual(2 * RELEASED.grid.paddingMM)
    }

    // Each released band delivers at least one manufacturable variant for a plain square.
    for (const answer of bands.filter((b) => b.band.released)) {
      expect(answer.variants.length).toBeGreaterThanOrEqual(1)
      for (const variant of answer.variants) {
        expect(variant.sizeMM).toBeGreaterThanOrEqual(answer.band.minSizeMM)
        expect(variant.sizeMM).toBeLessThan(answer.band.maxSizeMM)
        expect(variant.anchors.length).toBeGreaterThanOrEqual(1)
        expect(variant.ok).toBe(true)
        // no two magnets closer than two paddings — their application rings never overlap
        const padFloor = 2 * RELEASED.grid.paddingMM - 1e-6
        for (let i = 0; i < variant.anchors.length; i++)
          for (let j = i + 1; j < variant.anchors.length; j++) {
            const a = variant.anchors[i].p
            const b = variant.anchors[j].p
            expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(padFloor)
          }
        // every magnet is a released diameter
        for (const anchor of variant.anchors) {
          expect([RELEASED.magnet.smallMM, RELEASED.magnet.largeMM]).toContain(anchor.dia)
        }
      }
    }
  })

  it('holds a concave freeform fully — zero unheld outline on every delivered variant', () => {
    const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, lShape(100))
    expect(judged).not.toBeNull()
    const released = judged!.bands.filter((b) => b.band.released)
    const variants = released.flatMap((b) => b.variants)
    expect(variants.length).toBeGreaterThanOrEqual(1)
    for (const variant of variants) {
      expect(variant.ok).toBe(true)
      expect(variant.uncoveredMM).toBe(0)
      expect(variant.flaps.length).toBe(0)
    }
  })

  it('is deterministic — the same shape answers byte-identically twice', () => {
    const first = solveCutout(RELEASED, RELEASED_CALIBRATION, lShape(140))
    const second = solveCutout(RELEASED, RELEASED_CALIBRATION, lShape(140))
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('rejects a degenerate contour instead of guessing', () => {
    const degenerate: Contour = { outer: { pts: [[0, 0]] as Pt[] }, holes: [] }
    expect(solveCutout(RELEASED, RELEASED_CALIBRATION, degenerate)).toBeNull()
  })
})
