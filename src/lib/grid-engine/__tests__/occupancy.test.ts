// The three properties compute exists to have. Each is here because something
// real broke on it, in this project or in the published tools that solve the
// same problem.

import { describe, expect, it } from 'vitest'
import { holds, locate, prepare, type Pt } from '../compute/geometry'
import { scan } from '../compute/occupancy'

const square = (n: number): Pt[] => [[0, 0], [n, 0], [n, n], [0, n]]
const q = 0.001
const quanta = (mm: number) => Math.round(mm / q)

describe('the square standard IS the gate', () => {
  // Canon logic-spec §5.1: the square is the calibration control and every other
  // class is a stated derivation from it — "measured by squares is the easiest".
  // §7 then says the canon table IS the regression gate. It was never built, and
  // that absence is exactly how two engines shipped while the square went wrong:
  // v3.2 could not see these sizes at all, and the GPT Pro build answered a
  // 264mm square with a three-magnet L.
  //
  // Nothing is proposed from a list here. The count is whatever the material
  // carries, and the material is a square.
  const STANDARD: ReadonlyArray<readonly [number, number]> = [
    [24, 1],   // one point
    [72, 4],   // 2x2
    [120, 9],  // 3x3
    [168, 16], // 4x4
    [216, 25], // 5x5
  ]

  for (const [sizeMM, expected] of STANDARD) {
    it(`${sizeMM}mm square carries ${expected}`, () => {
      const reading = scan(square(100), {
        sizesMM: [sizeMM],
        latticeMM: 48,
        radiusMM: 12,
        phaseStepMM: 1,
      }).readings[0]!
      const richest = reading.arrangements[0]
      expect(richest, `${sizeMM}mm carried nothing at all`).toBeDefined()
      expect(richest!.count).toBe(expected)
    })
  }

  it('the richest set is a filled block, not a subset of one', () => {
    // The 3x3 must be nine points in a full block. A nine-count that was not a
    // block would mean the sweep found something that is not the square standard.
    const reading = scan(square(100), {
      sizesMM: [120], latticeMM: 48, radiusMM: 12, phaseStepMM: 1,
    }).readings[0]!
    const expectedBlock = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => `${i},${j}`)).sort().join(' ')
    expect(reading.arrangements[0]!.signature).toBe(expectedBlock)
  })
})

describe('tangency is legal, and it is legal EXACTLY', () => {
  // Product Base §2: "Boundary tangency is legal." Dan, 2026-08-17, on finding a
  // 0.05mm omission bound in the shipped engine: "the disk can sit on the same
  // overlapping 0 line with the shape outline and must".
  //
  // This is the whole reason the arithmetic is integer. Every published tool that
  // solves this family compares with an epsilon — SVGnest ships TOL = 1e-9,
  // libnfporb ships NFP_EPSILON = 1e-8 and offers exact rationals only behind a
  // compile flag. An epsilon here does not merely blur the answer: it deletes it,
  // because the shape standards are the cases with zero margin.

  it('a disc exactly r from the edge is inside — 24mm square, r=12', () => {
    const shape = prepare(square(24), q)
    expect(holds(shape, [quanta(12), quanta(12)], quanta(12))).toBe(true)
  })

  it('one quantum closer than r is NOT inside', () => {
    // The other half of the property. A test that only proves acceptance would
    // pass on an engine that accepts everything.
    const shape = prepare(square(24), q)
    expect(holds(shape, [quanta(12) - 1, quanta(12)], quanta(12))).toBe(false)
  })

  it('all four corners of the 72mm square are tangent and all four hold', () => {
    const shape = prepare(square(72), q)
    for (const [x, y] of [[12, 12], [60, 12], [12, 60], [60, 60]]) {
      expect(holds(shape, [quanta(x), quanta(y)], quanta(12)), `${x},${y}`).toBe(true)
    }
  })

  it('a point ON the outline is reported ON, not guessed either way', () => {
    // SVGnest reaches the same conclusion independently: its point-in-polygon
    // returns a third state for the boundary rather than folding it into
    // inside/outside. Folding it is how a lawful answer becomes an absent one.
    const shape = prepare(square(24), q)
    expect(locate(shape, [0, quanta(12)])).toBe('ON')
    expect(locate(shape, [quanta(12), quanta(12)])).toBe('IN')
    expect(locate(shape, [-1, quanta(12)])).toBe('OUT')
  })
})

describe('what the module refuses to answer', () => {
  // An engine that answers everything is the one that invents. These are the
  // inputs it must reject rather than interpret.

  it('a ring that collapses below three distinct vertices is refused', () => {
    expect(() => prepare([[0, 0], [0.0001, 0], [0.0002, 0]], 1)).toThrow(/three distinct/)
  })

  it('a ring enclosing no area is refused', () => {
    expect(() => prepare([[0, 0], [10, 0], [20, 0]], q)).toThrow(/no area/)
  })

  it('a non-finite coordinate is refused, not coerced', () => {
    expect(() => prepare([[0, 0], [Number.NaN, 0], [10, 10]], q)).toThrow(/non-finite/)
  })
})
