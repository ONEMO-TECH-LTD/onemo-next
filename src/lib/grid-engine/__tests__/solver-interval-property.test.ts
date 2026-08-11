// PROPERTY FIXTURE — permanent, per grid-pixel's freeze-2 QA (B1). The interval construction must
// agree with the complete containment predicate at EVERY sampled scale on adversarial concave
// polygons. Freeze-2's incremental status walk lost whole lawful intervals (live PILL: zero
// families vs 6,907) while the unit suite stayed green — this fixture is what was missing. Any
// future optimised sweep must pass it unchanged before replacing the complete evaluation.

import { describe, expect, it } from 'vitest'
import { containmentIntervals, boxContainedAt } from '../solver/contacts'
import type { BoxMM, PointMM } from '../solver/contract'

let seed = 0x62c0ffee
const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 0x100000000)

function radialPolygon(n: number): PointMM[] {
  const pts: PointMM[] = []
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n
    const r = 35 + rnd() * 65
    pts.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  return pts
}

const boxes: BoxMM[] = [
  { x0: -36, y0: -12, x1: 36, y1: 12 },
  { x0: -12, y0: -36, x1: 12, y1: 36 },
  { x0: -36, y0: -36, x1: 36, y1: 36 },
  { x0: -84, y0: -12, x1: -12, y1: 12 },
]

describe('interval construction ≡ complete predicate (freeze-2 regression, QA B1)', () => {
  it('agrees at every sampled scale across 80 random concave polygons × 4 boxes', () => {
    seed = 0x62c0ffee
    const failures: Array<{ p: number; s: number; full: boolean; fromIntervals: boolean }> = []
    for (let p = 0; p < 80; p++) {
      const poly = radialPolygon(7 + (p % 14))
      for (const box of boxes) {
        const max = 6
        const intervals = containmentIntervals(box, poly, max)
        for (let k = 1; k <= 1200; k++) {
          const s = (max * k) / 1200
          const full = boxContainedAt(box, poly, s)
          const fromIntervals = intervals.some((iv) => s >= iv.lo && s <= iv.hi)
          if (full !== fromIntervals) failures.push({ p, s, full, fromIntervals })
          if (failures.length >= 5) break
        }
        if (failures.length >= 5) break
      }
      if (failures.length >= 5) break
    }
    expect(failures, 'interval set disagrees with the complete predicate').toEqual([])
  }, 300000)
})
