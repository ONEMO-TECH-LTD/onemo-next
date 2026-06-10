// vector-core kernel proofs (Run 1 acceptance, numeric — not eyeballed).
// Circle: kappa construction radial error. Heart: cusp exactness + smooth-anchor collinearity.
// Square: lines never subdivide. Flatten: chord error within tolerance. SVG: true C commands.

import { describe, test, expect } from 'vitest'
import { cubicPoint, flattenPath, toSVGPathD, transformShape, segments, shapeBBox, filletPath, filletPathSmart, ringToVPath, nearestOnPath, insertAnchorAt, insertAnchorCentered, deleteAnchorRefit, signedArea } from '../index'
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

  test('fitter — dense circle ring fits to few smooth anchors within tolerance', () => {
    const ring = Array.from({ length: 720 }, (_, i) => {
      const t = (2 * Math.PI * i) / 720
      return { x: Math.cos(t), y: Math.sin(t) }
    })
    const path = ringToVPath(ring, 40, 0.002)
    expect(path.anchors.length).toBeLessThanOrEqual(10) // minimal anchors, not a point cloud
    expect(path.anchors.every((a) => !a.corner)).toBe(true) // circle has no corners
    // every fitted curve point stays within tolerance of the unit circle
    let maxErr = 0
    for (const s of segments(path)) {
      if (!s.c1 || !s.c2) continue
      for (let i = 0; i <= 100; i++) {
        const p = cubicPoint(s.a, s.c1, s.c2, s.b, i / 100)
        maxErr = Math.max(maxErr, Math.abs(Math.hypot(p.x, p.y) - 1))
      }
    }
    expect(maxErr).toBeLessThan(0.004) // tol + parameterization slack
  })

  test('fitter — square ring keeps 4 corners and exact straight fits', () => {
    const sq: { x: number; y: number }[] = []
    const N = 100
    for (let i = 0; i < N; i++) sq.push({ x: -1 + (2 * i) / N, y: -1 })
    for (let i = 0; i < N; i++) sq.push({ x: 1, y: -1 + (2 * i) / N })
    for (let i = 0; i < N; i++) sq.push({ x: 1 - (2 * i) / N, y: 1 })
    for (let i = 0; i < N; i++) sq.push({ x: -1, y: 1 - (2 * i) / N })
    const path = ringToVPath(sq, 40, 0.002)
    expect(path.anchors.filter((a) => a.corner)).toHaveLength(4)
  })

  test('smart fillet — square matches the exact line-line fillet (regression)', () => {
    const square = unitShape('square')
    const r = 0.25
    const exact = filletPath(square.paths[0], r)
    const smart = filletPathSmart(square.paths[0], r)
    expect(smart.anchors).toHaveLength(exact.anchors.length)
    for (let i = 0; i < exact.anchors.length; i++) {
      expect(smart.anchors[i].p.x).toBeCloseTo(exact.anchors[i].p.x, 6)
      expect(smart.anchors[i].p.y).toBeCloseTo(exact.anchors[i].p.y, 6)
    }
  })

  test('smart fillet — heart cusps round into smooth joins (no corner anchors remain)', () => {
    const heart = unitShape('heart')
    const r = 0.12
    const rounded = filletPathSmart(heart.paths[0], r)
    expect(rounded.anchors.filter((a) => a.corner)).toHaveLength(0)
    expect(rounded.anchors.length).toBeGreaterThan(heart.paths[0].anchors.length) // each cusp → 2 trim anchors
    // the rounded path must stay continuous: every segment's endpoints chain without jumps
    const segsR = segments(rounded)
    for (let i = 0; i < segsR.length; i++) {
      const next = segsR[(i + 1) % segsR.length]
      expect(Math.hypot(segsR[i].b.x - next.a.x, segsR[i].b.y - next.a.y)).toBeLessThan(1e-9)
    }
    // bottom tip (was at y=1) is trimmed upward
    const bb = shapeBBox({ paths: [rounded] }, 0.005)
    expect(bb.maxY).toBeLessThan(1 - r * 0.2)
  })

  test('points on demand — insert ON a curve is geometry-IDENTICAL (exact de Casteljau split)', () => {
    const heart = unitShape('heart')
    const path = heart.paths[0]
    const ts = 0.37
    for (let seg = 0; seg < path.anchors.length; seg++) {
      const orig = segments(path)[seg]
      if (!orig.c1 || !orig.c2) continue
      const next = insertAnchorAt(path, seg, ts)
      expect(next.anchors).toHaveLength(path.anchors.length + 1)
      // the two halves re-trace the original curve exactly under the parameter mapping
      const sFirst = segments(next)[seg]
      const sSecond = segments(next)[seg + 1]
      for (let k = 0; k <= 50; k++) {
        const u = k / 50
        const p1 = cubicPoint(orig.a, orig.c1, orig.c2, orig.b, ts * u)
        const q1 = cubicPoint(sFirst.a, sFirst.c1!, sFirst.c2!, sFirst.b, u)
        expect(Math.hypot(p1.x - q1.x, p1.y - q1.y)).toBeLessThan(1e-9)
        const p2 = cubicPoint(orig.a, orig.c1, orig.c2, orig.b, ts + (1 - ts) * u)
        const q2 = cubicPoint(sSecond.a, sSecond.c1!, sSecond.c2!, sSecond.b, u)
        expect(Math.hypot(p2.x - q2.x, p2.y - q2.y)).toBeLessThan(1e-9)
      }
    }
  })

  test('points on demand — insert centered on a straight side keeps the square exact', () => {
    const square = unitShape('square')
    const next = insertAnchorCentered(square.paths[0], 0)
    expect(next.anchors).toHaveLength(5)
    expect(next.anchors[1].p).toEqual({ x: 0, y: -1 }) // the side's midpoint, ON the chord
    const flat = flattenPath(next, 0.01)
    expect(Math.abs(signedArea(flat))).toBeCloseTo(4, 9) // area unchanged — geometry preserved
    const bb = shapeBBox({ paths: [next] }, 0.01)
    expect([bb.minX, bb.minY, bb.maxX, bb.maxY]).toEqual([-1, -1, 1, 1])
  })

  test('nearestOnPath — recovers a known on-curve point: segment, parameter, ~zero distance', () => {
    const heart = unitShape('heart')
    const path = heart.paths[0]
    const segs = segments(path)
    for (const [seg, t] of [[1, 0.7], [3, 0.25], [4, 0.5]] as const) {
      const s = segs[seg]
      const p = s.c1 && s.c2 ? cubicPoint(s.a, s.c1, s.c2, s.b, t) : { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t }
      const hit = nearestOnPath(path, p)
      expect(hit.seg).toBe(seg)
      expect(Math.abs(hit.t - t)).toBeLessThan(5e-3)
      expect(hit.dist).toBeLessThan(1e-5)
    }
  })

  test('points on demand — delete RE-FITS: heart smooth anchor removed, curve stays within tolerance', () => {
    const heart = unitShape('heart')
    const path = heart.paths[0]
    const idx = path.anchors.findIndex((a) => !a.corner)
    const segsBefore = segments(path)
    const n = path.anchors.length
    const refit = deleteAnchorRefit(path, idx)
    expect(refit.anchors.length).toBeLessThan(n + 2) // a re-fit, never an anchor explosion
    expect(refit.anchors.filter((a) => a.corner)).toHaveLength(2) // cusps untouched
    // the bridge replaces segments (idx-1 → idx → idx+1); every original point of those two
    // segments stays within the fit budget (chord/100 + parameterization slack) of the new path
    const affected = [segsBefore[(idx - 1 + n) % n], segsBefore[idx]]
    const chord = Math.hypot(affected[1].b.x - affected[0].a.x, affected[1].b.y - affected[0].a.y)
    let maxDev = 0
    for (const s of affected) {
      for (let k = 0; k <= 40; k++) {
        const p = s.c1 && s.c2 ? cubicPoint(s.a, s.c1, s.c2, s.b, k / 40) : { x: s.a.x + (s.b.x - s.a.x) * (k / 40), y: s.a.y + (s.b.y - s.a.y) * (k / 40) }
        maxDev = Math.max(maxDev, nearestOnPath(refit, p).dist)
      }
    }
    expect(maxDev).toBeLessThan(chord / 50)
    // segments still chain — no gaps at the splice
    const segsAfter = segments(refit)
    for (let i = 0; i < segsAfter.length; i++) {
      const nx = segsAfter[(i + 1) % segsAfter.length]
      expect(Math.hypot(segsAfter[i].b.x - nx.a.x, segsAfter[i].b.y - nx.a.y)).toBeLessThan(1e-9)
    }
  })

  test('single-corner fillet — only the selected square corner rounds; the other three stay sharp', () => {
    const square = unitShape('square')
    const r = 0.25
    const one = filletPathSmart(square.paths[0], r, (i) => i === 0)
    expect(one.anchors).toHaveLength(5) // 1 corner → 2 trim anchors; 3 corners survive
    expect(one.anchors.filter((a) => a.corner)).toHaveLength(3)
    // the bridging arc sits at distance r from the inset center of corner 0 (-1,-1) → (-1+r,-1+r)
    const center = { x: -1 + r, y: -1 + r }
    let maxErr = 0
    for (const s of segments(one)) {
      if (!s.c1 || !s.c2) continue
      for (let k = 0; k <= 50; k++) {
        const p = cubicPoint(s.a, s.c1, s.c2, s.b, k / 50)
        maxErr = Math.max(maxErr, Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - r))
      }
    }
    expect(maxErr).toBeLessThan(r * 0.001)
    const bb = shapeBBox({ paths: [one] }, 0.001)
    expect(bb.maxX).toBeCloseTo(1, 6) // untouched corners hold the bbox
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
