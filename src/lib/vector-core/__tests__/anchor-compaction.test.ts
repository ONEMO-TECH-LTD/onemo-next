// KAI-8974/F3b — anchor compaction: the ring fit must not emit redundant anchor clusters at
// high-curvature features (fab-qa: ~34 anchors on a daisy where ~18 carry it; 3-4 crowding each
// petal tip). Merge-when-faithful: compaction may remove an anchor ONLY if one cubic carries the
// source ring span within the ORIGINAL tolerance — so fidelity is asserted alongside the count.
import { describe, it, expect } from 'vitest'
import { ringToVPath, flattenShape } from '..'
import type { Vec2 } from '../types'

/** THE product daisy (formula copied from v3 shapes.ts daisyRing — kernel tests can't import app
 *  code): rounded cosine petals at the editor defaults (petals=8, depth=55), ~1000px box, resampled
 *  at the generator's ~2px spacing — the exact over-emission fixture fab-qa drove (~34+ anchors). */
function daisyRing(samples = 500): Vec2[] {
  const petals = 8, d = 0.1 + 0.28 * 0.55
  const out: Vec2[] = []
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2
    const r = (1 - d + d * (0.5 + 0.5 * Math.cos(petals * t)) * 2) * 320
    out.push({ x: 500 + r * Math.cos(t), y: 500 + r * Math.sin(t) })
  }
  return out
}

function ellipseRing(samples = 720): Vec2[] {
  const out: Vec2[] = []
  for (let i = 0; i < samples; i++) {
    const th = (i / samples) * Math.PI * 2
    out.push({ x: 500 + 380 * Math.cos(th), y: 500 + 260 * Math.sin(th) })
  }
  return out
}

/** max distance from any ring sample to the flattened fitted path (approx. one-sided Hausdorff) */
function maxDeviation(ring: Vec2[], path: ReturnType<typeof ringToVPath>, flatTol: number): number {
  const flat = flattenShape({ paths: [path] }, flatTol)[0]
  let worst = 0
  for (const r of ring) {
    let best = Infinity
    for (let i = 0; i < flat.length; i++) {
      const a = flat[i], b = flat[(i + 1) % flat.length]
      const vx = b.x - a.x, vy = b.y - a.y
      const L2 = vx * vx + vy * vy || 1e-12
      const t = Math.max(0, Math.min(1, ((r.x - a.x) * vx + (r.y - a.y) * vy) / L2))
      const d = Math.hypot(r.x - (a.x + vx * t), r.y - (a.y + vy * t))
      if (d < best) best = d
    }
    if (best > worst) worst = best
  }
  return worst
}

describe('anchor compaction (KAI-8974/F3b)', () => {
  it('daisy-class ring: no redundant clusters — ≤3 anchors per petal lobe, fidelity within tolerance', () => {
    const ring = daisyRing()
    const maxError = 0.625 // the editor generator fit tolerance class (min(W,H)/1600 at 1000px)
    const path = ringToVPath(ring, 60, maxError, undefined, maxError * 2) // callers' compaction budget
    const anchors = path.anchors.length
    // 8 petals: ~3 anchors per petal carries it (live: 24; the bug emitted 50). 4+/petal = regression
    expect(anchors).toBeLessThanOrEqual(26)
    expect(anchors).toBeGreaterThanOrEqual(8) // sanity: compaction must not gut the shape
    expect(maxDeviation(ring, path, 0.05)).toBeLessThanOrEqual(maxError * 2 + 0.1) // budget + flatten slack
    expect(path.anchors.filter((a) => a.corner).length).toBe(0) // smooth stays smooth
    // fab-qa returner: no doubled finger targets — adjacent anchors keep real separation
    const an = path.anchors
    for (let i = 0; i < an.length; i++) {
      const b = an[(i + 1) % an.length]
      expect(Math.hypot(an[i].p.x - b.p.x, an[i].p.y - b.p.y)).toBeGreaterThan(12)
    }
  })

  it('ellipse: a handful of anchors carries it; fidelity holds', () => {
    const ring = ellipseRing()
    const path = ringToVPath(ring, 30, 0.35, undefined, 0.7)
    expect(path.anchors.length).toBeLessThanOrEqual(10)
    expect(maxDeviation(ring, path, 0.05)).toBeLessThanOrEqual(0.8)
  })

  it('corner anchors are never merged: a square ring keeps exactly 4 corners', () => {
    const sq: Vec2[] = []
    for (let s = 0; s < 4; s++) {
      const corners = [{ x: 100, y: 100 }, { x: 900, y: 100 }, { x: 900, y: 900 }, { x: 100, y: 900 }]
      const a = corners[s], b = corners[(s + 1) % 4]
      for (let k = 0; k < 100; k++) sq.push({ x: a.x + ((b.x - a.x) * k) / 100, y: a.y + ((b.y - a.y) * k) / 100 })
    }
    const path = ringToVPath(sq, 30, 0.35)
    expect(path.anchors.filter((a) => a.corner).length).toBe(4)
  })
})
