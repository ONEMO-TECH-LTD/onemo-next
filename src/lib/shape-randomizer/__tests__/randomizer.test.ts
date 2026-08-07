import { describe, expect, it } from 'vitest'
import { FAMILY_NAMES, balanceScore, frameSubject, insideRing, mulberry32, randomShape, rollUntilBalanced } from '../index'

describe('shape-randomizer', () => {
  it('is deterministic: same (family, seed) → identical ring', () => {
    for (const family of FAMILY_NAMES) {
      const a = randomShape({ family, seed: 1234 })
      const b = randomShape({ family, seed: 1234 })
      expect(a.ring).toEqual(b.ring)
      const c = randomShape({ family, seed: 1235 })
      expect(a.ring).not.toEqual(c.ring)
    }
  })

  it('every family yields a closed, in-bounds, positive-area ring', () => {
    for (const family of FAMILY_NAMES) {
      for (const seed of [1, 42, 987654]) {
        const { ring } = randomShape({ family, seed })
        expect(ring.length).toBeGreaterThan(100)
        let area = 0
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length]
          area += a.x * b.y - b.x * a.y
          expect(a.x).toBeGreaterThan(-0.05); expect(a.x).toBeLessThan(1.05)
          expect(a.y).toBeGreaterThan(-0.05); expect(a.y).toBeLessThan(1.05)
        }
        expect(Math.abs(area) / 2).toBeGreaterThan(0.05)
      }
    }
  })

  it('frameSubject + gate: subject box is contained with margin', () => {
    const subject = { cx: 500, cy: 400, w: 300, h: 220 }
    const r = rollUntilBalanced({ family: 'blob', seed: 77, subject, marginFrac: 0.18 })
    expect(r.score).toBeGreaterThan(0)
    // containment is part of the score contract — verify independently at the corners
    for (const [x, y] of [[350, 290], [650, 290], [350, 510], [650, 510]] as const)
      expect(insideRing(r.ring, x, y)).toBe(true)
  })

  it('balance gate rejects a degenerate sliver', () => {
    const sliver = Array.from({ length: 128 }, (_, i) => ({ x: i / 128, y: 0.5 + (i % 2) * 0.001 }))
    expect(balanceScore(sliver)).toBeLessThan(0.7)
  })

  it('mulberry32 stream is stable', () => {
    const r = mulberry32(42)
    const seq = [r(), r(), r()]
    const r2 = mulberry32(42)
    expect([r2(), r2(), r2()]).toEqual(seq)
  })
})
