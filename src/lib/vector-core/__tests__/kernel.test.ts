// vector-core kernel proofs (Run 1 acceptance, numeric — not eyeballed).
// Circle: kappa construction radial error. Heart: cusp exactness + smooth-anchor collinearity.
// Square: lines never subdivide. Flatten: chord error within tolerance. SVG: true C commands.

import { describe, test, expect } from 'vitest'
import { cubicPoint, flattenPath, toSVGPathD, transformShape, segments, shapeBBox, filletPath } from '../index'
import { unitShape, getShape } from '@/lib/shape-library'

describe('vector-core kernel', () => {
  test('circle (kappa) — max radial error < 0.03% of radius', () => {
    const circle = unitShape('circle')
    let maxErr = 0
    for (const s of segments(circle.paths[0])) {
      expect(s.c1 && s.c2).toBeTruthy()
      for (let i = 0; i <= 200; i++) {
        const p = cubicPoint(s.a, s.c1!, s.c2!, s.b, i / 200)
        maxErr = Math.max(maxErr, Math.abs(Math.hypot(p.x, p.y) - 1))
      }
    }
    expect(maxErr).toBeLessThan(0.0003)
  })

  test('heart — 6 anchors, exactly 2 cusps, cusp positions exact, smooth anchors collinear', () => {
    const heart = unitShape('heart')
    const a = heart.paths[0].anchors
    expect(a).toHaveLength(6)
    const cusps = a.filter((x) => x.corner)
    expect(cusps).toHaveLength(2)
    // top notch at x=0 (16/32 normalized), bottom tip at (0, 1)
    expect(cusps[0].p.x).toBeCloseTo(0, 10)
    expect(cusps[1].p.x).toBeCloseTo(0, 10)
    expect(cusps[1].p.y).toBeCloseTo(1, 10)
    // smooth anchors: hIn and hOut collinear through p (C1 direction continuity)
    for (const an of a.filter((x) => !x.corner)) {
      const vIn = { x: an.p.x - an.hIn!.x, y: an.p.y - an.hIn!.y }
      const vOut = { x: an.hOut!.x - an.p.x, y: an.hOut!.y - an.p.y }
      const cross = vIn.x * vOut.y - vIn.y * vOut.x
      const scale = Math.hypot(vIn.x, vIn.y) * Math.hypot(vOut.x, vOut.y) || 1
      expect(Math.abs(cross) / scale).toBeLessThan(0.02) // sin of angle between directions
    }
  })

  test('square — 4 corner anchors, flatten emits exactly the 4 corners (lines never subdivide)', () => {
    const square = unitShape('square')
    const flat = flattenPath(square.paths[0], 0.01)
    expect(flat).toHaveLength(4)
    expect(flat[0]).toEqual({ x: -1, y: -1 })
  })

  test('flatten — chord error within tolerance on the heart at 0.005 units', () => {
    const heart = unitShape('heart')
    const tol = 0.005
    const flat = flattenPath(heart.paths[0], tol)
    // every flattened point must lie ON the true curve by construction; verify chord error by
    // sampling curve points and measuring distance to the nearest chord
    const dist2Seg = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
      const vx = b.x - a.x, vy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1e-12)))
      return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy))
    }
    let maxDev = 0
    for (const s of segments(heart.paths[0])) {
      if (!s.c1 || !s.c2) continue
      for (let i = 1; i < 400; i++) {
        const p = cubicPoint(s.a, s.c1, s.c2, s.b, i / 400)
        let best = Infinity
        for (let j = 0; j < flat.length; j++) {
          best = Math.min(best, dist2Seg(p, flat[j], flat[(j + 1) % flat.length]))
          if (best < 1e-6) break
        }
        maxDev = Math.max(maxDev, best)
      }
    }
    expect(maxDev).toBeLessThanOrEqual(tol * 1.05) // flatness bound + epsilon
  })

  test('SVG emit — heart is 6 true C commands, square is pure L, both close with Z', () => {
    const heartD = toSVGPathD(unitShape('heart').paths[0])
    expect(heartD.match(/C /g)).toHaveLength(6)
    expect(heartD.includes(' L ')).toBe(false)
    expect(heartD.trim().endsWith('Z')).toBe(true)
    const squareD = toSVGPathD(unitShape('square').paths[0])
    expect(squareD.match(/L /g)).toHaveLength(3) // M + 3 L + Z closes the 4th side
    expect(squareD.includes(' C ')).toBe(false)
  })

  test('fillet — square corners become exact circular arcs (90° reproduces kappa)', () => {
    const square = unitShape('square')
    const r = 0.25
    const filleted = filletPath(square.paths[0], r)
    expect(filleted.anchors).toHaveLength(8) // each corner → 2 tangent anchors
    // every arc point must sit at distance r from one of the four inset corner centers
    const segsF = segments(filleted)
    const centers = [
      { x: 1 - r, y: -1 + r }, { x: 1 - r, y: 1 - r }, { x: -1 + r, y: 1 - r }, { x: -1 + r, y: -1 + r },
    ]
    let maxErr = 0
    for (const s of segsF) {
      if (!s.c1 || !s.c2) continue
      for (let i = 0; i <= 50; i++) {
        const p = cubicPoint(s.a, s.c1, s.c2, s.b, i / 50)
        const dist = Math.min(...centers.map((c) => Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - r)))
        maxErr = Math.max(maxErr, dist)
      }
    }
    expect(maxErr).toBeLessThan(r * 0.001) // kappa-exact arc approximation
    // bbox unchanged — fillet trims inward, never outward
    const bb = shapeBBox({ paths: [filleted] }, 0.001)
    expect(bb.minX).toBeCloseTo(-1, 6)
    expect(bb.maxY).toBeCloseTo(1, 6)
  })

  test('transform — affine maps anchors AND handles exactly; getShape centers in the image box', () => {
    const shape = getShape('circle', 1200, 900)
    const bb = shapeBBox(shape, 0.01)
    const S = Math.min(1200, 900) * 0.72
    expect((bb.maxX + bb.minX) / 2).toBeCloseTo(600, 6)
    expect((bb.maxY + bb.minY) / 2).toBeCloseTo(450, 6)
    expect(bb.maxX - bb.minX).toBeCloseTo(S, 1)
    // anisotropic stretch stays exact: scale x by 2 → width doubles, height unchanged
    const stretched = transformShape(shape, (p) => ({ x: 600 + (p.x - 600) * 2, y: p.y }))
    const sb = shapeBBox(stretched, 0.01)
    expect(sb.maxX - sb.minX).toBeCloseTo(2 * S, 1)
    expect(sb.maxY - sb.minY).toBeCloseTo(S, 1)
  })
})
