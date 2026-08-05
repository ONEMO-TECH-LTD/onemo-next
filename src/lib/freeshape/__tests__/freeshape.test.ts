// freeshape — acceptance gates (ARCHITECTURE.md, from Dan's 2026-08-05 evidence): a wobbly closed
// loop becomes a clean idealized shape; open strokes are refused; everything is deterministic pure
// geometry fast enough for a phone.

import { describe, expect, it } from 'vitest'
import { validateSelfIntersection, type Vec2Px } from '@/lib/outline-core/math'
import { flattenShape } from '@/lib/vector-core'
import { strokeToShape, type StrokePoint } from '../index'

// deterministic wobble (no Math.random — reproducible gates)
const wob = (i: number, amp: number) => amp * Math.sin(i * 12.9898) * Math.cos(i * 4.1414)

function wobblyCircle(cx: number, cy: number, r: number, amp: number, n = 160): StrokePoint[] {
  const pts: StrokePoint[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const rr = r + wob(i, amp)
    pts.push({ x: cx + rr * Math.cos(t), y: cy + rr * Math.sin(t) })
  }
  return pts
}

function wobblyPolygon(corners: StrokePoint[], amp: number, perSide = 40): StrokePoint[] {
  const pts: StrokePoint[] = []
  for (let c = 0; c < corners.length; c++) {
    const a = corners[c], b = corners[(c + 1) % corners.length]
    for (let s = 0; s < perSide; s++) {
      const t = s / perSide
      pts.push({ x: a.x + (b.x - a.x) * t + wob(c * perSide + s, amp), y: a.y + (b.y - a.y) * t + wob(c * perSide + s + 99, amp) })
    }
  }
  return pts
}

function wobblyBlob(cx: number, cy: number, n = 200): StrokePoint[] {
  const pts: StrokePoint[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const r = 120 + 45 * Math.sin(t * 2.3) + 25 * Math.sin(t * 4.7 + 1) + wob(i, 4)
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
  }
  return pts
}

const simple = (shape: import('@/lib/vector-core').VShape): boolean => {
  const ring = flattenShape(shape, 0.5)[0].map((p) => [p.x, p.y] as Vec2Px)
  return validateSelfIntersection(ring, 't').length === 0
}

describe('freeshape strokeToShape', () => {
  it('gate 2a: shaky near-circle → a true circle (4 smooth kappa anchors, radius ≈ drawn)', () => {
    const r = strokeToShape(wobblyCircle(400, 400, 150, 6))
    expect(r).not.toBeNull()
    expect(r!.verdict).toBe('circle')
    const a = r!.shape.paths[0].anchors
    expect(a).toHaveLength(4)
    expect(a.every((x) => !x.corner)).toBe(true)
    const rad = Math.hypot(a[0].p.x - 400, a[0].p.y - 400)
    expect(rad).toBeGreaterThan(140)
    expect(rad).toBeLessThan(160)
  })

  it('gate 2b: shaky quadrilateral → straight-sided sharp rect (no baked rounding)', () => {
    const r = strokeToShape(wobblyPolygon([
      { x: 100, y: 100 }, { x: 460, y: 110 }, { x: 455, y: 330 }, { x: 105, y: 320 },
    ], 5))
    expect(r).not.toBeNull()
    expect(r!.verdict).toBe('rect')
    const a = r!.shape.paths[0].anchors
    expect(a).toHaveLength(4)
    expect(a.every((x) => x.corner && !x.hIn && !x.hOut)).toBe(true)
  })

  it('shaky triangle → 3 sharp corners', () => {
    const r = strokeToShape(wobblyPolygon([
      { x: 250, y: 80 }, { x: 460, y: 400 }, { x: 60, y: 400 },
    ], 5, 60))
    expect(r).not.toBeNull()
    expect(r!.verdict).toBe('triangle')
    expect(r!.shape.paths[0].anchors).toHaveLength(3)
  })

  it("gate 1: Dan's wobbly loop → a clean balanced blob — few anchors, simple ring, never a selection", () => {
    const r = strokeToShape(wobblyBlob(400, 400))
    expect(r).not.toBeNull()
    expect(r!.verdict).toBe('blob')
    const anchors = r!.shape.paths[0].anchors.length
    expect(anchors).toBeGreaterThanOrEqual(3)
    expect(anchors).toBeLessThanOrEqual(24) // harmonized: sparse intentional anchors, not 200 samples
    expect(simple(r!.shape)).toBe(true) // fold-guard held
  })

  it('gate 4: an open stroke returns null — the tool never guesses', () => {
    const open: StrokePoint[] = []
    for (let i = 0; i < 60; i++) open.push({ x: 100 + i * 6, y: 300 + wob(i, 4) })
    expect(strokeToShape(open)).toBeNull()
  })

  it('degenerate input (dot / tiny jitter) returns null', () => {
    expect(strokeToShape([{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }])).toBeNull()
  })

  it('gate 3: the raw resampled ring rides along as provenance', () => {
    const r = strokeToShape(wobblyBlob(300, 300))
    expect(r!.ring.length).toBeGreaterThanOrEqual(32)
  })

  it('gate 5: full draw→normalize under 50ms', () => {
    const pts = wobblyBlob(400, 400, 500)
    const t0 = performance.now()
    strokeToShape(pts)
    expect(performance.now() - t0).toBeLessThan(50)
  })
})
