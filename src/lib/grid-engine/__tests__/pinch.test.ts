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
import { pinchFactor } from '../ui/camera'

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

const FLOOR = 20
const CEILING = 408 // the 9x9 grid: (9-1) x 48 + 2 x 12

describe('a pinch is the same gesture however it is packetized', () => {
  it('lands on one size for 1x10, 10x1 and 100x0.1', () => {
    const from = 120
    const one = applyPackets(from, split(10, 1), FLOOR, CEILING).final
    const ten = applyPackets(from, split(10, 10), FLOOR, CEILING).final
    const hundred = applyPackets(from, split(10, 100), FLOOR, CEILING).final

    expect({ one, ten, hundred }).toEqual({ one: 133, ten: 133, hundred: 133 })
  })

  it('holds across packetizations in both directions and from several sizes', () => {
    for (const from of [20, 72, 120, 168, 300, 408]) {
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
    const { exact, final } = applyPackets(408, split(500, 50), FLOOR, CEILING)
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
