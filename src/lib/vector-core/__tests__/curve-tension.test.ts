// CURVE tool kernel op (plan A2): handle-tension scaling — position fixed, directions preserved,
// lengths scale by the factor; identity at 1; line joins (missing handles) untouched.
import { describe, it, expect } from 'vitest'
import { scaleAnchorTension } from '../ops'
import type { VPath } from '../types'

const path = (): VPath => ({ anchors: [
  { p: { x: 0, y: 0 }, hIn: { x: -10, y: -2 }, hOut: { x: 12, y: 3 }, corner: false },
  { p: { x: 100, y: 0 }, hIn: { x: 88, y: -4 }, hOut: null, corner: true },
  { p: { x: 50, y: 80 }, hIn: null, hOut: null, corner: true },
] })

describe('scaleAnchorTension', () => {
  it('scales handle lengths about the anchor, preserving direction; position unchanged', () => {
    const out = scaleAnchorTension(path(), 0, 2)
    const a = out.anchors[0]
    expect(a.p).toEqual({ x: 0, y: 0 })
    expect(a.hOut).toEqual({ x: 24, y: 6 }) // 2x along the same direction
    expect(a.hIn).toEqual({ x: -20, y: -4 })
  })
  it('factor 1 is identity; missing handles stay missing', () => {
    const out = scaleAnchorTension(path(), 1, 1)
    expect(out.anchors[1].hIn).toEqual({ x: 88, y: -4 })
    expect(out.anchors[1].hOut).toBeNull()
    const out2 = scaleAnchorTension(path(), 2, 3)
    expect(out2.anchors[2].hIn).toBeNull()
  })
})
