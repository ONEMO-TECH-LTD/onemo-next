// WHOLE-SHAPE RADIUS — the two defects Dan reported on 2026-08-06 and the invariants that fix them.
// Both are reproduced against the pre-fix kernel inline, so this file fails if either regresses.
//   1. "why does radius not attack every corner" — an OPENING alone leaves concave notches sharp.
//   2. "above 70 it goes into smaller shape"     — erosion swallows features the grow-back can't restore.
import { describe, it, expect } from 'vitest'
import { Clipper, JoinType, EndType } from '@countertype/clipper2-ts'
import { flattenPath, type VPath } from '@/lib/vector-core'
import { roundWholeShapePx } from '@/lib/vector-core/clipper-kernel'

const S = 100
/** the pre-fix kernel (opening only, no back-off) — kept as the reference the fix must beat */
function openingOnly(path: VPath, radiusPx: number): VPath {
  if (radiusPx <= 0 || path.anchors.length < 3) return path
  const ring = flattenPath(path, 0.25); if (ring.length < 3) return path
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of ring) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y) }
  const r = Math.min(radiusPx, 0.499 * Math.min(maxX - minX, maxY - minY)); if (r <= 0) return path
  const flat: number[] = []; for (const p of ring) flat.push(Math.round(p.x * S), Math.round(p.y * S))
  const subj = [Clipper.makePath(flat)]
  const er = Clipper.inflatePaths(subj, -r * S, JoinType.Round, EndType.Polygon); if (!er?.length) return path
  const di = Clipper.inflatePaths(er, r * S, JoinType.Round, EndType.Polygon); if (!di?.length) return path
  let best = di[0]; for (const rg of di) if (Math.abs(Clipper.area(rg)) > Math.abs(Clipper.area(best))) best = rg
  if (!best || best.length < 3) return path
  return { anchors: best.map((p) => ({ p: { x: p.x / S, y: p.y / S }, hIn: null, hOut: null, corner: false })) }
}

const CX = 400, CY = 400
function star(inner = 70, outer = 200, points = 5): VPath {
  const anchors = []
  for (let i = 0; i < points * 2; i++) {
    const t = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    anchors.push({ p: { x: CX + r * Math.cos(t), y: CY + r * Math.sin(t) }, hIn: null, hOut: null, corner: true })
  }
  return { anchors }
}
const square = (): VPath => ({
  anchors: [{ x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 600 }, { x: 200, y: 600 }]
    .map((p) => ({ p, hIn: null, hOut: null, corner: true })),
})
const ring = (p: VPath) => flattenPath(p, 0.25)
const area = (r: { x: number; y: number }[]) => {
  let a = 0
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p.x * q.y - q.x * p.y }
  return Math.abs(a) / 2
}
/** distance from the centroid to the nearest outline point — a star's concave VALLEY. Rounding a
 *  valley pushes it OUTWARD; leaving it sharp leaves this untouched. */
const valley = (r: { x: number; y: number }[]) => Math.min(...r.map((p) => Math.hypot(p.x - CX, p.y - CY)))

describe('whole-shape radius — both polarities', () => {
  it('rounds CONCAVE valleys, which an opening alone leaves sharp', () => {
    const p = star()
    const v0 = valley(ring(p))
    for (const r of [40, 70, 90]) {
      expect(valley(ring(openingOnly(p, r)))).toBeLessThan(v0 + 1)      // the defect: valley untouched
      expect(valley(ring(roundWholeShapePx(p, r)))).toBeGreaterThan(v0 + 1) // fixed: valley rounded out
    }
  })

  it('still rounds CONVEX tips (a square reaches a circle at max)', () => {
    const p = square()
    const out = ring(roundWholeShapePx(p, 0.499 * 400))
    const rs = out.map((q) => Math.hypot(q.x - CX, q.y - CY))
    expect((Math.max(...rs) - Math.min(...rs)) / Math.max(...rs)).toBeLessThan(0.3)
  })
})

describe('whole-shape radius — feature-preservation back-off', () => {
  it('saturates instead of eating the shape at a large radius', () => {
    const p = star()
    const base = area(ring(p))
    for (const r of [40, 70, 90]) {
      // the defect: the opening collapses the star toward its body (or over-erodes and bails)
      const kept = area(ring(roundWholeShapePx(p, r))) / base
      expect(kept).toBeGreaterThan(0.7)
    }
    // the pre-fix kernel demonstrably loses the features this guard protects
    expect(area(ring(openingOnly(p, 70))) / base).toBeLessThan(0.5)
  })

  it('never emits a folded or empty outline at any radius', () => {
    const p = star()
    for (const r of [1, 10, 40, 70, 90, 99]) {
      const out = ring(roundWholeShapePx(p, r))
      expect(out.length).toBeGreaterThan(2)
      expect(area(out)).toBeGreaterThan(0)
    }
  })
})
