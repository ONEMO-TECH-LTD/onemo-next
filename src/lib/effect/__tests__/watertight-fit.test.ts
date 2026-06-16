// KAI-9009 — the fit must be WATERTIGHT: a noisy trace with a needle notch (walls that cross
// after fairing — Dan's crack/spike sliver) must never reach the mesh as a self-intersection.
import { describe, expect, it } from 'vitest'
import { vectoriseTrace } from '../geometry-truth.legacy' // R4: retired trace-fit, test-only
import { flattenShape } from '@/lib/vector-core'
import { validateSelfIntersection, fairingFromDetail, type Vec2Px } from '@/lib/outline-core'

const H = 900

/** circle with a needle slit: a deep, near-zero-width V cut into the rim (the sliver class) */
function needleTrace(): [number, number][] {
  const pts: [number, number][] = []
  const cx = 600, cy = 450, R = 300
  for (let i = 0; i < 720; i++) {
    const a = (i / 720) * Math.PI * 2
    if (a > 1.0 && a < 1.02) continue // the slit mouth
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)])
  }
  // insert the needle: walk in and back out along almost the same line (walls ~0.6px apart)
  const a0 = 1.01
  const idx = pts.findIndex(([x, y]) => Math.atan2(y - cy, x - cx) > a0)
  const inPts: [number, number][] = []
  for (let d = 0; d <= 46; d += 2) inPts.push([cx + (R - d) * Math.cos(a0 - 0.001), cy + (R - d) * Math.sin(a0 - 0.001)])
  for (let d = 46; d >= 0; d -= 2) inPts.push([cx + (R - d) * Math.cos(a0 + 0.001), cy + (R - d) * Math.sin(a0 + 0.001)])
  pts.splice(Math.max(idx, 0), 0, ...inPts)
  return pts
}

describe('[legacy/R4-quarantined] vectoriseTrace watertightness (KAI-9009; not active — KAI-9084)', () => {
  it('a needle-slit trace fits to a shape whose flatten has ZERO self-intersections', () => {
    const v = vectoriseTrace(needleTrace(), H, fairingFromDetail(85)) // high detail = weak fairing (the risky end)
    expect(v).not.toBeNull()
    const flat = flattenShape(v!, 0.75)[0].map((p) => [p.x, p.y] as Vec2Px)
    expect(validateSelfIntersection(flat, 'fit')).toHaveLength(0)
  })
  it('a clean circle still fits clean (no escalation side effects)', () => {
    const pts: [number, number][] = []
    for (let i = 0; i < 720; i++) { const a = (i / 720) * Math.PI * 2; pts.push([600 + 300 * Math.cos(a), 450 + 300 * Math.sin(a)]) }
    const v = vectoriseTrace(pts, H, fairingFromDetail(15))
    expect(v).not.toBeNull()
    const flat = flattenShape(v!, 0.75)[0].map((p) => [p.x, p.y] as Vec2Px)
    expect(validateSelfIntersection(flat, 'fit')).toHaveLength(0)
  })
})
