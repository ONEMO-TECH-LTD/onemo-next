// The pinch must not care how the browser chops up a gesture.
//
// The defect this locks: the handler rounded EVERY wheel packet before keeping the fraction, so the
// same physical pinch landed somewhere different depending on packetization. Measured on the served
// page at 16aeb68e, total delta 10 from 120mm:
//
//   1 event of 10      ->  133
//   10 events of 1     ->  130
//   100 events of 0.1  ->  120     (no movement at all)
//
// The rule is multiplicative so packets compose exactly; the caller accumulates against an unrounded
// size and rounds only what it shows. Both halves are exercised here.

import { describe, expect, it } from 'vitest'
import { pinchFactor, viewBox } from '../ui/camera'
import { bandSpan, minShapeSpan } from '../bridge'
import { RELEASED } from '../spec'

/** What the shell does with a stream of packets: accumulate exact, publish rounded. */
const applyPackets = (startMM: number, packets: number[], floor: number, ceiling: number) => {
  let exact = startMM
  const shown: number[] = []
  for (const d of packets) {
    exact = Math.min(ceiling, Math.max(floor, exact * pinchFactor(d)))
    shown.push(Math.round(exact))
  }
  return { exact, shown, final: Math.round(exact) }
}

const split = (total: number, count: number) => Array.from({ length: count }, () => total / count)

/**
 * THE BOUNDS COME FROM THE UNIT, through the same two functions the shell clamps with.
 *
 * They were `20` and `408`, typed in. Both were wrong the moment a law moved: the floor had already
 * become 24 when the unit took ownership of one minimum shape size, and the ceiling is a derived
 * quantity — change the padding, the pitch or the row count and 408 is simply a stale number that
 * the test would keep asserting. A test that hardcodes what it is meant to protect cannot fail when
 * the law it protects changes, which is the whole defect class this suite exists to catch.
 *
 * Mirrored exactly on `page.tsx`: `minShapeSpan(spec)` and `bandSpan(spec, positionsPerAxis)`.
 */
const FLOOR = Math.round(minShapeSpan(RELEASED))
const CEILING = Math.round(bandSpan(RELEASED, RELEASED.grid.positionsPerAxis))

describe('a pinch is the same gesture however it is packetized', () => {
  it('lands on one size for 1x10, 10x1 and 100x0.1', () => {
    const from = 120
    const one = applyPackets(from, split(10, 1), FLOOR, CEILING).final
    const ten = applyPackets(from, split(10, 10), FLOOR, CEILING).final
    const hundred = applyPackets(from, split(10, 100), FLOOR, CEILING).final

    expect({ one, ten, hundred }).toEqual({ one: 133, ten: 133, hundred: 133 })
  })

  it('holds across packetizations in both directions and from several sizes', () => {
    for (const from of [FLOOR, 72, 120, 168, 300, CEILING]) {
      for (const total of [-40, -10, -1, 1, 10, 40]) {
        const sizes = [1, 2, 5, 10, 100, 1000].map(
          (n) => applyPackets(from, split(total, n), FLOOR, CEILING).final,
        )
        expect(new Set(sizes).size, `from ${from}mm, total ${total}, got ${sizes.join('/')}`).toBe(1)
      }
    }
  })

  it('MOVES on a slow high-resolution pinch — the reported stall', () => {
    // A hundred packets of 0.1 is a real trackpad, not a synthetic case.
    const { final, shown } = applyPackets(120, split(10, 100), FLOOR, CEILING)
    expect(final).not.toBe(120)
    // and it arrives in whole-millimetre steps rather than one jump at the end
    expect(new Set(shown).size).toBeGreaterThan(5)
  })
})

describe('bounds hold at the exact size, not just the shown one', () => {
  it('stops at the 9x9 ceiling however hard it is squeezed', () => {
    const { exact, final } = applyPackets(CEILING, split(500, 50), FLOOR, CEILING)
    expect(final).toBe(CEILING)
    // clamped EXACT, so one spread leaves the ceiling immediately instead of unwinding an overshoot
    expect(exact).toBe(CEILING)
    expect(applyPackets(exact, [-10], FLOOR, CEILING).final).toBeLessThan(CEILING)
  })

  it('stops at the floor however hard it is spread', () => {
    const { exact, final } = applyPackets(72, split(-500, 50), FLOOR, CEILING)
    expect(final).toBe(FLOOR)
    expect(exact).toBe(FLOOR)
    expect(applyPackets(exact, [10], FLOOR, CEILING).final).toBeGreaterThan(FLOOR)
  })
})

describe('the bounds track the law rather than a literal', () => {
  // The point of deriving them. Move a law value and both bounds move with it; a hardcoded 20/408
  // would sail through every assertion above while the shell clamped somewhere else entirely.
  const at = (grid: Partial<typeof RELEASED.grid>) => {
    const spec = { ...RELEASED, grid: { ...RELEASED.grid, ...grid } }
    return {
      floor: Math.round(minShapeSpan(spec)),
      ceiling: Math.round(bandSpan(spec, spec.grid.positionsPerAxis)),
    }
  }

  it('is the released 9x9 lattice today', () => {
    // Stated once, here, as the current answer — not spread through the file as magic numbers.
    expect(at({})).toEqual({ floor: 24, ceiling: 408 })
  })

  it('follows the padding: the floor IS the magnet spot', () => {
    expect(at({ paddingMM: 10 }).floor).toBe(20)
    expect(at({ paddingMM: 15 }).floor).toBe(30)
  })

  it('follows the row count and the pitch', () => {
    expect(at({ positionsPerAxis: 5 }).ceiling).toBe(4 * 48 + 24)
    expect(at({ positionsPerAxis: 11 }).ceiling).toBe(10 * 48 + 24)
    expect(at({ pitchMM: 96, basePitchMM: 96 }).ceiling).toBe(8 * 96 + 24)
  })
})

describe('the factor itself', () => {
  it('composes: any split of a delta multiplies to the same factor', () => {
    const whole = pinchFactor(7)
    const split3 = pinchFactor(3) * pinchFactor(2) * pinchFactor(2)
    expect(split3).toBeCloseTo(whole, 12)
  })

  it('is 1 for no movement, and inverts', () => {
    expect(pinchFactor(0)).toBe(1)
    expect(pinchFactor(5) * pinchFactor(-5)).toBeCloseTo(1, 12)
  })

  it('squeeze grows the shape and spread shrinks it — the inverted model', () => {
    expect(pinchFactor(10)).toBeGreaterThan(1)
    expect(pinchFactor(-10)).toBeLessThan(1)
  })
})

describe('a dead zoom cannot kill the view', () => {
  const frame = { x: -60, y: -60, w: 120, h: 120 }
  const finite = (b: { x: number; y: number; w: number; h: number }) =>
    [b.x, b.y, b.w, b.h].every(Number.isFinite) && b.w > 0 && b.h > 0

  it('0 / Inf / NaN still frame the sticker', () => {
    for (const z of [0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(finite(viewBox(frame, z, 1)), `zoom ${z}`).toBe(true)
    }
  })
})
