// The solve, checked against the canon Dan can verify by eye and against the shape that broke the
// rule it replaces.
//
// The square is the control: it must land exactly on its band spans, because tangency is lawful.
// The butterfly is the evidence: it holds its magnets at sizes where the superseded box-interior
// rule rejected it, which is the whole reason the material test is the disc and not the box.

import { describe, expect, it } from 'vitest'
import { solveShape } from '../bridge'
import {
  candidateSizesMM,
  centredRun,
  discSupported,
  flapOf,
  gridBoxOf,
  layoutsFor,
  runSpanMM,
  sizesPerWindow,
  solveOutline,
  type OutlineMM,
} from '../solver'
import { LAUNCH_PITCHES_MM, OPERATIONAL_BANDS, RELEASED } from '../spec'

const square = (side: number): OutlineMM => [
  [0, 0],
  [side, 0],
  [side, side],
  [0, side],
]

/** A waisted shape: wide top and bottom, narrow middle. The butterfly's defining feature. */
const waisted = (): OutlineMM => [
  [0, 0],
  [100, 0],
  [100, 40],
  [60, 50],
  [100, 60],
  [100, 100],
  [0, 100],
  [0, 60],
  [40, 50],
  [0, 40],
]

const grid = RELEASED.grid

describe('the size domain comes from the grid, not the shape', () => {
  it('a band window is exactly one pitch wide, stepped by the atom', () => {
    // Consecutive band spans differ by one pitch — each extra magnet adds a pitch, padding is fixed.
    expect(runSpanMM(48, 12, 3) - runSpanMM(48, 12, 2)).toBe(48)
    expect(runSpanMM(96, 12, 3) - runSpanMM(96, 12, 2)).toBe(96)
    // So the number of candidate sizes in a band is the pitch over the atom. Four, and eight.
    expect(sizesPerWindow(grid, 48)).toBe(4)
    expect(sizesPerWindow(grid, 96)).toBe(8)
  })

  it('every candidate size is a whole number of atoms — no decimals exist', () => {
    for (const pitch of LAUNCH_PITCHES_MM) {
      for (const layout of layoutsFor(OPERATIONAL_BANDS)) {
        for (const size of candidateSizesMM(grid, pitch, layout, 137, 211)) {
          expect(size % grid.paddingMM).toBe(0)
        }
      }
    }
  })

  it('the whole domain for one shape is ninety-six candidates', () => {
    const result = solveShape(RELEASED, square(100))
    expect(result.candidatesTested).toBe(96)
  })
})

describe('the canon a human can check by eye', () => {
  it('a square holds its band spans exactly — tangency is lawful', () => {
    for (const [magnets, span] of [
      [2, 72],
      [3, 120],
    ] as const) {
      expect(runSpanMM(grid.basePitchMM, grid.paddingMM, magnets)).toBe(span)
      const outline = square(span)
      const centres = centredRun(span / 2, grid.basePitchMM, magnets)
      for (const x of centres) {
        for (const y of centres) {
          expect(discSupported([x, y], outline, grid.paddingMM)).toBe(true)
        }
      }
    }
  })

  it('a square one atom smaller does not hold — the span is a floor, not a preference', () => {
    const outline = square(72 - grid.paddingMM)
    const centres = centredRun((72 - grid.paddingMM) / 2, grid.basePitchMM, 2)
    expect(discSupported([centres[0], centres[0]], outline, grid.paddingMM)).toBe(false)
  })

  it("a square's flap is zero at every band, because the square IS its own grid box", () => {
    for (const magnets of [2, 3]) {
      const span = runSpanMM(grid.basePitchMM, grid.paddingMM, magnets)
      const centres = centredRun(span / 2, grid.basePitchMM, magnets)
      const points = centres.flatMap((x) => centres.map((y) => [x, y] as [number, number]))
      const box = gridBoxOf(points, grid.paddingMM)
      const flap = flapOf({ x: 0, y: 0, w: span, h: span }, box)
      expect(flap).toEqual({ left: 0, right: 0, top: 0, bottom: 0 })
    }
  })

  it('registration falls out of the count and is never selected', () => {
    // An even run straddles the centre; an odd run puts a magnet on it.
    expect(centredRun(0, 48, 2)).toEqual([-24, 24])
    expect(centredRun(0, 48, 3)).toEqual([-48, 0, 48])
  })
})

describe('a waisted shape holds its magnets even though it cuts the grid box', () => {
  it('the disc test passes where a box-interior test would fail', () => {
    const outline = waisted()
    const result = solveOutline(RELEASED, outline, OPERATIONAL_BANDS, [grid.basePitchMM])
    const held = result.variants.filter((v) => v.holds && v.cols === 2 && v.rows === 2)
    expect(held.length).toBeGreaterThan(0)

    // The waist genuinely crosses the region between the magnets: the midpoint of the two left
    // magnets is off material, so any rule requiring the box's interior to be fabric rejects this.
    const v = held[0]
    const [a, b] = v.magnets
    const midpoint: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const scaled = outline.map(([x, y]) => {
      const scale = v.bindingMM / 100
      return [x * scale, y * scale] as [number, number]
    })
    expect(discSupported(midpoint, scaled, grid.paddingMM)).toBe(false)
  })
})

describe('the pair floor and the classification', () => {
  it('never offers a single magnet', () => {
    for (const layout of layoutsFor(OPERATIONAL_BANDS)) {
      expect(layout.cols * layout.rows).toBeGreaterThanOrEqual(2)
    }
  })

  it('calls exactly two magnets a twin fix and three or more a multi fix', () => {
    const result = solveShape(RELEASED, square(100))
    for (const v of result.variants) {
      expect(v.classification).toBe(v.magnetCount === 2 ? 'twin-fix' : 'multi-fix')
    }
  })
})

describe('blindness — changing an input rederives everything', () => {
  it('halving the padding halves the spot and moves every candidate size', () => {
    const halved = { ...RELEASED, grid: { ...grid, paddingMM: grid.paddingMM / 2 } }
    expect(runSpanMM(48, halved.grid.paddingMM, 2)).toBe(60)
    expect(sizesPerWindow(halved.grid, 48)).toBe(8)
    const before = solveShape(RELEASED, square(100)).candidatesTested
    const after = solveShape(halved, square(100)).candidatesTested
    expect(after).not.toBe(before)
  })
})
