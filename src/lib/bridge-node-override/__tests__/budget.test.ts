import { describe, expect, it } from 'vitest'
import { NODE_BUDGET, skeletonShape } from '../index'
import type { VShape } from '@/lib/vector-core'

// THE defect this module exists to fix (Dan 2026-08-07): v1's skeleton fell back to the RAW dense
// shape when the fit failed — the million-node edge case. The budget must hold for ANY input.

const denseRing = (n: number, wobble = 0): VShape => ({
  paths: [{
    anchors: Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      const r = 200 + (wobble ? Math.sin(i * 7.3) * wobble : 0)
      return { p: { x: 300 + Math.cos(a) * r, y: 300 + Math.sin(a) * r }, hIn: null, hOut: null, corner: true }
    }),
  }],
})

describe('node-override skeleton budget', () => {
  it('a dense 5000-anchor ring lands within the budget — never the raw shape', () => {
    const out = skeletonShape(denseRing(5000))
    const n = out.paths[0].anchors.length
    expect(n).toBeGreaterThanOrEqual(NODE_BUDGET.min)
    expect(n).toBeLessThanOrEqual(NODE_BUDGET.max)
  })
  it('a noisy dense ring (the fit-hostile case) still lands within the budget', () => {
    const out = skeletonShape(denseRing(3000, 18))
    const n = out.paths[0].anchors.length
    expect(n).toBeGreaterThanOrEqual(NODE_BUDGET.min)
    expect(n).toBeLessThanOrEqual(NODE_BUDGET.max)
  })
  it('an already-sparse shape stays edit-grade (no inflation past the budget)', () => {
    const out = skeletonShape(denseRing(12))
    const n = out.paths[0].anchors.length
    expect(n).toBeGreaterThanOrEqual(NODE_BUDGET.min)
    expect(n).toBeLessThanOrEqual(NODE_BUDGET.max)
  })
})
