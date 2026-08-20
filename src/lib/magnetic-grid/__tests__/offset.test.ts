import { describe, expect, it } from 'vitest'
import { signOf, cSub, cInt } from '../compute/certified-real'
import { exactContour, toUnits } from '../compute/clearance'
import { loopApprox, offsetArrangement } from '../compute/offset'
import type { Contour } from '../spec'

const rect = (w: number, h: number): Contour => ({ outer: { pts: [[0, 0], [w, 0], [w, h], [0, h]] }, holes: [] })
const mm = (c: ReturnType<typeof exactContour>, v: number) => v * Number(c.unit)

describe('exact inward-offset arrangement', () => {
  it('72 square at r=12: one loop of four offset segments forming the inner 48 square', () => {
    const c = exactContour(rect(72, 72))
    const arr = offsetArrangement(c, toUnits(12, c))
    expect(arr.unresolved).toBe(false)
    expect(arr.loops).toHaveLength(1)
    expect(arr.loops[0].pieces).toHaveLength(4)
    for (const [x, y] of loopApprox(arr.loops[0])) {
      const onX = Math.abs(x - mm(c, 12)) < 1e-6 || Math.abs(x - mm(c, 60)) < 1e-6
      const onY = Math.abs(y - mm(c, 12)) < 1e-6 || Math.abs(y - mm(c, 60)) < 1e-6
      expect(onX || onY).toBe(true)
    }
  })

  it('L-shape: the reflex corner contributes exactly one arc piece', () => {
    const L: Contour = { outer: { pts: [[0, 0], [90, 0], [90, 40], [40, 40], [40, 90], [0, 90]] }, holes: [] }
    const c = exactContour(L)
    const arr = offsetArrangement(c, toUnits(12, c))
    expect(arr.unresolved).toBe(false)
    expect(arr.loops).toHaveLength(1)
    const kinds = arr.loops[0].pieces.map((p) => p.elem.kind)
    expect(kinds.filter((k) => k === 'arc')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'seg')).toHaveLength(6)
  })

  it('dumbbell: a neck thinner than 2r splits the legal region into two loops', () => {
    const dumbbell: Contour = { outer: { pts: [[0, 0], [60, 0], [60, 25], [100, 25], [100, 0], [160, 0], [160, 60], [100, 60], [100, 35], [60, 35], [60, 60], [0, 60]] }, holes: [] }
    const c = exactContour(dumbbell)
    const arr = offsetArrangement(c, toUnits(12, c))
    expect(arr.unresolved).toBe(false)
    expect(arr.loops).toHaveLength(2)
  })

  it('square with a hole: an outer loop and an inner loop around the expanded hole', () => {
    const holed: Contour = { ...rect(100, 100), holes: [{ pts: [[40, 40], [60, 40], [60, 60], [40, 60]] }] }
    const c = exactContour(holed)
    const arr = offsetArrangement(c, toUnits(12, c))
    expect(arr.unresolved).toBe(false)
    expect(arr.loops).toHaveLength(2)
    // the hole's four convex corners (seen from the material they are reflex) each contribute an arc
    const arcs = arr.loops.flatMap((l) => l.pieces).filter((p) => p.elem.kind === 'arc')
    expect(arcs).toHaveLength(4)
  })

  it('every surviving piece sits exactly at clearance r — certified zero, not "not above"', () => {
    // an oblique shape so the edge lengths are irrational: the certificate must come from the
    // exact quadratic-field normal form, not from a perfect-square shortcut
    const oblique: Contour = { outer: { pts: [[0, 0], [80, 10], [70, 65], [5, 50]] }, holes: [] }
    for (const shape of [rect(72, 48), oblique]) {
      const c = exactContour(shape)
      const r = toUnits(12, c)
      const arr = offsetArrangement(c, r)
      expect(arr.unresolved).toBe(false)
      let certified = 0
      for (const loop of arr.loops) for (const piece of loop.pieces) {
        if (piece.elem.kind !== 'seg') continue
        const { feat: s, a, dx, dy } = piece.elem
        // Distance from the offset LINE to its generator is constant along the line, so the
        // certificate is cross(a − v, d)² = r²·len2 — a single-radical identity, decided exactly.
        // The piece midpoint lies on that line by construction (mid = a + t·d).
        const wx = cSub(a.x, cInt(s.ax)), wy = cSub(a.y, cInt(s.ay))
        const cross = cSub({ k: 'mul', a: wx, b: cInt(dy) }, { k: 'mul', a: wy, b: cInt(dx) })
        const identity = cSub({ k: 'mul', a: cross, b: cross }, cInt(r * r * (dx * dx + dy * dy)))
        expect(signOf(identity)).toBe(0)
        certified++
      }
      expect(certified).toBe(4)
    }
  })

  it('hole provenance survives: features keep their ring index', () => {
    const holed: Contour = { ...rect(100, 100), holes: [{ pts: [[40, 40], [60, 40], [60, 60], [40, 60]] }] }
    const c = exactContour(holed)
    const arr = offsetArrangement(c, toUnits(12, c))
    const rings = new Set(arr.loops.flatMap((l) => l.pieces).filter((p) => p.elem.kind === 'seg').map((p) => (p.elem as { feat: { ring: number } }).feat.ring))
    expect([...rings].sort()).toEqual([0, 1])
  })
})
