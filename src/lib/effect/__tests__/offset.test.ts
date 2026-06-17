// L5 — Clipper2 manufacturing offset: the −8mm magnetic inset + cut bleed, integer-robust, round joins.
import { describe, it, expect } from 'vitest'
import { insetRingMM } from '../offset'
import type { Pt } from '../types'

const square = (s: number): Pt[] => [[0, 0], [s, 0], [s, s], [0, s]]
const bbox = (r: Pt[]) => {
  const xs = r.map((p) => p[0]), ys = r.map((p) => p[1])
  return { minX: Math.min(...xs), minY: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

describe('manufacturing offset (Clipper2) — L5', () => {
  it('insets a 70mm square by −8mm → a centered ~54mm region (70 − 2·8)', () => {
    const inset = insetRingMM(square(70), -8)
    expect(inset).toBeTruthy()
    const b = bbox(inset!)
    expect(b.w).toBeGreaterThan(53); expect(b.w).toBeLessThan(55)
    expect(b.h).toBeGreaterThan(53); expect(b.h).toBeLessThan(55)
    expect(b.minX).toBeGreaterThan(7.5); expect(b.minX).toBeLessThan(8.5) // inset 8mm from the edge
  })
  it('a convex square inset stays 4-cornered (insetting recedes edges; corners do not open up)', () => {
    const inset = insetRingMM(square(70), -8)!
    expect(inset.length).toBe(4) // sharp inset — round joins only round corners that open up (outset/concave)
  })
  it('round joins round the OUTSET (cut-bleed) corners — more points than the 4-corner source', () => {
    const out = insetRingMM(square(70), 5)!
    expect(out.length).toBeGreaterThan(4) // the 4 corners become quarter-arcs
  })
  it('over-inset beyond the inradius collapses → null (nothing left to manufacture)', () => {
    expect(insetRingMM(square(70), -40)).toBeNull() // 40 > 35 (half) → empty
  })
  it('a positive delta (cut bleed) grows the ring', () => {
    const out = insetRingMM(square(70), 5)!
    expect(bbox(out).w).toBeGreaterThan(74) // 70 + 2·5 ≈ 80 (round corners trim a touch)
  })
  it('degenerate input (< 3 pts) → null', () => {
    expect(insetRingMM([[0, 0], [1, 1]], -1)).toBeNull()
  })
})
