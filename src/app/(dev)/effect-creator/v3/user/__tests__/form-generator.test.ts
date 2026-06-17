// Form ✦ generator proofs (KAI-8947): valleys are TRUE smooth Béziers (the |cos|^0.8 cusp is
// gone) and the lobe family reaches its full low end — 1 = circle, 2 = merged-circles peanut.
// Asserted through the SAME chain the editor uses (dense ring → resample → one Schneider fit).

import { describe, test, expect } from 'vitest'
import { generateShapeRing, resampleClosed } from '../shapes'
import { ringToVPath, cubicPoint, segments } from '@/lib/vector-core'

function fitForm(lobes: number, pinch = 50) {
  const ring = resampleClosed(generateShapeRing({ kind: 'form', lobes, pinch }, 600, 600), 1)
  return ringToVPath(ring.map(([x, y]) => ({ x, y })), 60, Math.max(0.4, 600 / 1600))
}

/** max tangent-direction break across anchors (deg) — a kink reads as tens of degrees. */
function maxTangentBreakDeg(path: ReturnType<typeof fitForm>) {
  const segs = segments(path)
  let worst = 0
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i], b = segs[(i + 1) % segs.length]
    const pa = a.c1 && a.c2 ? cubicPoint(a.a, a.c1, a.c2, a.b, 0.999) : a.a
    const inV = { x: a.b.x - pa.x, y: a.b.y - pa.y }
    const pb = b.c1 && b.c2 ? cubicPoint(b.a, b.c1!, b.c2!, b.b, 0.001) : b.b
    const outV = { x: pb.x - b.a.x, y: pb.y - b.a.y }
    const dot = (inV.x * outV.x + inV.y * outV.y) / ((Math.hypot(inV.x, inV.y) * Math.hypot(outV.x, outV.y)) || 1e-12)
    worst = Math.max(worst, (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI)
  }
  return worst
}

describe('form generator — KAI-8947', () => {
  test('lobes 3..8: valleys are smooth — zero corner anchors, tangent breaks < 5°', () => {
    for (const lobes of [3, 4, 5, 8]) {
      const path = fitForm(lobes, 70) // deep pinch = the worst case for the old cusp
      expect(path.anchors.filter((a) => a.corner)).toHaveLength(0)
      expect(maxTangentBreakDeg(path)).toBeLessThan(5)
    }
  })

  test('lobes = 1 is a CIRCLE', () => {
    const path = fitForm(1)
    expect(path.anchors.every((a) => !a.corner)).toBe(true)
    const pts: { x: number; y: number }[] = []
    for (const s of segments(path)) for (let i = 0; i < 20; i++) {
      pts.push(s.c1 && s.c2 ? cubicPoint(s.a, s.c1, s.c2, s.b, i / 20) : s.a)
    }
    // center from the bbox (sample-density independent), then radial spread
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const rs = pts.map((p) => Math.hypot(p.x - cx, p.y - cy))
    const spread = (Math.max(...rs) - Math.min(...rs)) / Math.max(...rs)
    expect(spread).toBeLessThan(0.01) // a circle, not an egg — the old m-clamp made 1 impossible
  })

  test('lobes = 2 is the merged-circles peanut: smooth everywhere, exactly two waists', () => {
    const path = fitForm(2, 60)
    expect(path.anchors.filter((a) => a.corner)).toHaveLength(0)
    expect(maxTangentBreakDeg(path)).toBeLessThan(5)
    // the "8" has exactly TWO waists: count connected angular arcs where r dips into the
    // bottom band of its range (bbox-centered, density-independent)
    const pts: { x: number; y: number }[] = []
    for (const s of segments(path)) for (let i = 0; i < 40; i++) pts.push(s.c1 && s.c2 ? cubicPoint(s.a, s.c1, s.c2, s.b, i / 40) : s.a)
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const byAngle = pts.map((p) => ({ a: Math.atan2(p.y - cy, p.x - cx), r: Math.hypot(p.x - cx, p.y - cy) })).sort((u, v) => u.a - v.a)
    const rMin = Math.min(...byAngle.map((q) => q.r)), rMax = Math.max(...byAngle.map((q) => q.r))
    const inWaist = byAngle.map((q) => q.r < rMin + 0.25 * (rMax - rMin))
    let arcs = 0
    for (let i = 0; i < inWaist.length; i++) if (inWaist[i] && !inWaist[(i - 1 + inWaist.length) % inWaist.length]) arcs++
    expect(arcs).toBe(2)
  })
})
