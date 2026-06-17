// Regression: the Detail dial's HARD PAGE FREEZE (Dan, 2026-06-11). The band-grow straight-
// snapper's accepted-run cursor jump (i = b + 1) could move BACKWARDS after backward growth +
// end trims, re-seeding the same stretch forever. fairTracedRing must terminate on every Detail
// value over a large noisy organic trace — the exact reproduced hang was detail=80, n=6000.

import { describe, test, expect } from 'vitest'
import { fairingFromDetail, fairTracedRing } from '../resolver'
import type { Vec2Px } from '../types'

function makeTrace(n: number, size: number): Vec2Px[] {
  const pts: Vec2Px[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const wob = 6 * Math.sin(9 * t) + 3 * Math.sin(23 * t + 1.3) + (((i * 2654435761) % 97) / 97 - 0.5) * 1.6
    const r = size * (0.38 + 0.06 * Math.sin(3 * t)) + wob
    const flat = t > 4.2 && t < 5.2 ? 0.04 * size : 0
    pts.push([size / 2 + r * Math.cos(t), size / 2 + (r - flat) * Math.sin(t)])
  }
  return pts
}

describe('outline-core — fairTracedRing termination (Detail-freeze regression)', () => {
  test('terminates on every Detail value over a large noisy trace, fast', () => {
    const raw = makeTrace(6000, 1000)
    for (let detail = 0; detail <= 100; detail += 5) {
      const t0 = performance.now()
      const faired = fairTracedRing(raw, fairingFromDetail(detail))
      expect(performance.now() - t0).toBeLessThan(2000) // a freeze is minutes; healthy is ~5ms
      expect(faired.length).toBeGreaterThan(100)
    }
  }, 30000)
})
