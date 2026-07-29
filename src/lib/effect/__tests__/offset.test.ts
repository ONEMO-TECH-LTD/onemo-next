// L5 — Clipper2 manufacturing offset: the −8mm magnetic inset + cut bleed, integer-robust, round joins.
import { describe, it, expect } from 'vitest'
import { MANUFACTURING_TOLERANCE_MM } from '../geometry-truth'
import { insetRingMM } from '../offset'
import type { Pt } from '../types'

const square = (s: number): Pt[] => [[0, 0], [s, 0], [s, s], [0, s]]
const bbox = (r: Pt[]) => {
  const xs = r.map((p) => p[0]), ys = r.map((p) => p[1])
  return { minX: Math.min(...xs), minY: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}
const roundCornerSagittaMM = (ring: Pt[], centre: Pt, radiusMM: number) => {
  const arc = ring.filter(([x, y]) =>
    x <= centre[0] && y <= centre[1] &&
    Math.abs(Math.hypot(x - centre[0], y - centre[1]) - radiusMM) <= 0.002,
  )
  if (arc.length < 2) throw new Error('round-offset witness did not contain an arc')
  let max = 0
  for (let i = 1; i < arc.length; i++) {
    const midpoint: Pt = [(arc[i - 1][0] + arc[i][0]) / 2, (arc[i - 1][1] + arc[i][1]) / 2]
    max = Math.max(max, radiusMM - Math.hypot(midpoint[0] - centre[0], midpoint[1] - centre[1]))
  }
  return max
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
  it('round joins stay within the physical manufacturing tolerance at a large legal offset', () => {
    const deltaMM = 70
    const out = insetRingMM(square(100), deltaMM)!
    expect(roundCornerSagittaMM(out, [0, 0], deltaMM)).toBeLessThanOrEqual(MANUFACTURING_TOLERANCE_MM)
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
