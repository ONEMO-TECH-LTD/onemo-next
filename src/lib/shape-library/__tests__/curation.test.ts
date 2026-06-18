// KAI-9129 — stock-shape curation (16→10) + the new pill stadium.
import { describe, it, expect } from 'vitest'
import { getShape, hasVectorDef } from '@/lib/shape-library'
import { flattenShape } from '@/lib/vector-core'
import { validateSelfIntersection, type Vec2Px } from '@/lib/outline-core'

describe('shape-library — KAI-9129 curation + pill', () => {
  it('pill is a valid simple stadium (~2:1, smooth ends, no self-intersection)', () => {
    const v = getShape('pill', 600, 600)
    const ring = flattenShape(v, 0.5)[0].map((p) => [p.x, p.y] as Vec2Px)
    expect(validateSelfIntersection(ring, 'pill').length).toBe(0) // a clean simple ring
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1])
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
    expect(w / h, `pill aspect ${(w / h).toFixed(2)} should be ~2:1`).toBeGreaterThan(1.6)
    expect(w / h).toBeLessThan(2.4)
    expect(v.paths[0].anchors.every((a) => !a.corner)).toBe(true) // stadium = smooth everywhere
  })
  it('parked launch shapes stay in defs (parked off the picker, NOT deleted)', () => {
    for (const k of ['teardrop', 'lens', 'bolt', 'plus', 'asterisk', 'bowtie', 'leaf']) {
      expect(hasVectorDef(k), `${k} should still resolve as a def (parked, recoverable)`).toBe(true)
    }
  })
})
