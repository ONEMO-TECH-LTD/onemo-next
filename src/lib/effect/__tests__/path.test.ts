// path.test.ts — THE PATH IS EXACT, AND THESE ARE THE CASES THAT PROVED IT WASN'T YET.
//
// Dan, 2026-09-04: "no polygons on canon and anywhere". Every fixture here is a case where a chord, a
// grid, or a join once gave the wrong answer; each stays as a ratchet.

import { describe, expect, it } from 'vitest'
import {
  distanceToPathMM, flattenPath, offsetConvexRingPath, pathAreaCentroidMM, pathBoundsMM, pathFromAnchors, pointInPath,
  type OutlinePath,
} from '../foundation/path'
import type { Pt } from '../types'

/** Independent reference: dense sampling of a cubic, then golden-section refinement about the best
 *  sample. Slow and dumb on purpose — it shares no code with the routine under test. */
function sampledCubicDistance(a: Pt, c1: Pt, c2: Pt, b: Pt, p: Pt): number {
  const at = (t: number): Pt => {
    const u = 1 - t
    const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t
    return [w0 * a[0] + w1 * c1[0] + w2 * c2[0] + w3 * b[0], w0 * a[1] + w1 * c1[1] + w2 * c2[1] + w3 * b[1]]
  }
  const d = (t: number) => { const q = at(t); return Math.hypot(q[0] - p[0], q[1] - p[1]) }
  let bestT = 0, best = Infinity
  const N = 20000
  for (let i = 0; i <= N; i++) { const t = i / N; const v = d(t); if (v < best) { best = v; bestT = t } }
  let lo = Math.max(0, bestT - 1 / N), hi = Math.min(1, bestT + 1 / N)
  for (let k = 0; k < 200; k++) {
    const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618
    if (d(m1) < d(m2)) hi = m2; else lo = m1
  }
  return Math.min(best, d((lo + hi) / 2))
}

describe('exact distance', () => {
  it('QA fixture: an S-bend whose nearest point a 16-bracket grid search missed by 0.635mm', () => {
    const a: Pt = [0, 0], c1: Pt = [127.91160762310028, -95.32542502507567]
    const c2: Pt = [12.377632930874825, 40.83771010860801], b: Pt = [100, 0]
    const path: OutlinePath = { start: a, segs: [{ kind: 'cubic', to: b, c1, c2 }, { kind: 'line', to: a }] }
    const p: Pt = [53.691542129963636, -23.303516628220677]
    const reference = sampledCubicDistance(a, c1, c2, b, p)
    expect(reference).toBeCloseTo(9.6629372067, 6)
    expect(Math.abs(distanceToPathMM(path, p) - reference)).toBeLessThan(1e-6)
  })

  it('every magnet of a canon record sits exactly one rim from the path — no chord shortfall', () => {
    const pill = offsetConvexRingPath([[0, 0], [0, 48], [0, 96]], 12)
    for (const n of [[0, 0], [0, 48], [0, 96]] as Pt[]) expect(distanceToPathMM(pill, n)).toBeCloseTo(12, 9)
    const rect = offsetConvexRingPath([[0, 0], [96, 0], [96, 144], [0, 144]], 12)
    for (const n of [[0, 0], [96, 144], [48, 0]] as Pt[]) expect(distanceToPathMM(rect, n)).toBeCloseTo(12, 9)
    expect(distanceToPathMM(rect, [48, 48])).toBeCloseTo(60, 9)
  })
})

describe('exact inside — the half-open rule on every segment kind', () => {
  it('a magnet centre on a pill is inside its own shape, including the one on a segment join', () => {
    const pill = offsetConvexRingPath([[0, 0], [0, 48], [0, 96]], 12)
    for (const n of [[0, 0], [0, 48], [0, 96]] as Pt[]) expect(pointInPath(pill, n)).toBe(true)
    expect(pointInPath(pill, [0, -13])).toBe(false)
    expect(pointInPath(pill, [13, 48])).toBe(false)
  })

  it('an arc whose endpoint lands on the ray from above counts once', () => {
    // the disc: two semicircles meeting on the ray through the centre, at (12,0) and (-12,0)
    const disc = offsetConvexRingPath([[0, 0]], 12)
    expect(pointInPath(disc, [0, 0])).toBe(true)
    expect(pointInPath(disc, [11.9, 0])).toBe(true)
    expect(pointInPath(disc, [12.1, 0])).toBe(false)
    expect(pointInPath(disc, [-11.9, 0])).toBe(true)
  })

  it('a cubic whose tangent is horizontal exactly on the ray touches without crossing', () => {
    // a symmetric arch: apex at y=10 with a horizontal tangent, closed along y=0
    const arch: OutlinePath = {
      start: [0, 0],
      segs: [{ kind: 'cubic', to: [100, 0], c1: [0, 13.333333333333334], c2: [100, 13.333333333333334] }, { kind: 'line', to: [0, 0] }],
    }
    // the apex of this cubic is at t=0.5, y = 0.75*13.333 = 10 exactly
    expect(pointInPath(arch, [20, 10])).toBe(false)     // level with the apex, off to the side: outside
    expect(pointInPath(arch, [50, 9.999])).toBe(true)   // just under the apex: inside
    expect(pointInPath(arch, [50, 5])).toBe(true)
    expect(pointInPath(arch, [50, 10.001])).toBe(false)
  })

  it('agrees with a fine flatten on a non-symmetric preset-shaped path, across a grid of probes', () => {
    // a lopsided teardrop-like closed cubic path; the reference is a 0.001mm flatten's even-odd parity
    const anchors = [
      { p: { x: 0, y: -50 }, hIn: { x: -30, y: -50 }, hOut: { x: 30, y: -50 }, corner: false },
      { p: { x: 40, y: 10 }, hIn: { x: 45, y: -20 }, hOut: { x: 35, y: 40 }, corner: false },
      { p: { x: -5, y: 45 }, hIn: null, hOut: null, corner: true },
      { p: { x: -35, y: 0 }, hIn: { x: -40, y: 30 }, hOut: { x: -30, y: -30 }, corner: false },
    ]
    const path = pathFromAnchors(anchors, (v) => [v.x, v.y] as Pt)
    const ring = flattenPath(path, 0.001)
    const evenOdd = (p: Pt) => {
      let inside = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j]
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
    }
    let disagreements = 0
    for (let x = -60; x <= 60; x += 3.7) for (let y = -60; y <= 60; y += 3.1) {
      const p: Pt = [x, y]
      // skip probes within 0.01mm of the boundary, where the flatten itself is the uncertain one
      if (distanceToPathMM(path, p) < 0.01) continue
      if (pointInPath(path, p) !== evenOdd(p)) disagreements++
    }
    expect(disagreements).toBe(0)
  })
})

describe('certified roots — the cases variation counting alone gets wrong', () => {
  it('QA fixture: a cusp whose cubic passes exactly through the probe — distance is zero, not 0.125', () => {
    // 3(t-1/2)^5: the first split lands exactly on the root, every coefficient but one reads zero on
    // each side, and Descartes counts no sign change. A zero end coefficient IS a root.
    const cusp: OutlinePath = {
      start: [-0.125, 0],
      segs: [
        { kind: 'cubic', to: [0.125, 0], c1: [0.125, 0], c2: [-0.125, 0] },
        { kind: 'line', to: [0.125, 10] },
        { kind: 'line', to: [-0.125, 10] },
        { kind: 'line', to: [-0.125, 0] },
      ],
    }
    expect(distanceToPathMM(cusp, [0, 0])).toBeLessThan(1e-9)
  })

  it('a double root away from any subdivision point — a tangent minimum — is still found', () => {
    // the curve y = (x - 1/3)^2 over x in [0,1], as a cubic (exact: a parabola is a degenerate cubic);
    // the probe sits ON the curve at x = 1/3, so the distance is zero and the minimum is a double root
    const x = (t: number) => t, y = (t: number) => (t - 1 / 3) ** 2
    // Bezier control points that reproduce x(t)=t, y(t)=(t-1/3)^2 exactly
    const a: Pt = [0, y(0)], b: Pt = [1, y(1)]
    const c1: Pt = [1 / 3, y(0) + (-2 / 3) / 3], c2: Pt = [2 / 3, y(1) - (4 / 3) / 3]
    const path: OutlinePath = { start: a, segs: [{ kind: 'cubic', to: b, c1, c2 }, { kind: 'line', to: [1, 5] }, { kind: 'line', to: [0, 5] }, { kind: 'line', to: a }] }
    expect(distanceToPathMM(path, [x(1 / 3), 0])).toBeLessThan(1e-9)
  })
})

describe('exact area and centroid', () => {
  it('a disc, a stadium and a square report their analytic area and centre', () => {
    const disc = offsetConvexRingPath([[10, 20]], 12)
    const d = pathAreaCentroidMM(disc)
    expect(d.areaMM2).toBeCloseTo(Math.PI * 144, 9)
    expect(d.centroid[0]).toBeCloseTo(10, 9); expect(d.centroid[1]).toBeCloseTo(20, 9)
    // stadium: 24 wide, 96 straight + two semicircles of r=12 → area = 24*96 + π*144
    const pill = offsetConvexRingPath([[0, 0], [0, 96]], 12)
    const s = pathAreaCentroidMM(pill)
    expect(s.areaMM2).toBeCloseTo(24 * 96 + Math.PI * 144, 9)
    expect(s.centroid[0]).toBeCloseTo(0, 9); expect(s.centroid[1]).toBeCloseTo(48, 9)
    const square: OutlinePath = { start: [0, 0], segs: [{ kind: 'line', to: [10, 0] }, { kind: 'line', to: [10, 10] }, { kind: 'line', to: [0, 10] }, { kind: 'line', to: [0, 0] }] }
    const q = pathAreaCentroidMM(square)
    expect(q.areaMM2).toBeCloseTo(100, 12); expect(q.centroid).toEqual([5, 5])
  })

  it('an asymmetric cubic shape: the exact centroid differs from its 0.05mm flatten and agrees with a 0.0001mm one', () => {
    const anchors = [
      { p: { x: 0, y: -50 }, hIn: { x: -30, y: -50 }, hOut: { x: 30, y: -50 }, corner: false },
      { p: { x: 40, y: 10 }, hIn: { x: 45, y: -20 }, hOut: { x: 35, y: 40 }, corner: false },
      { p: { x: -5, y: 45 }, hIn: null, hOut: null, corner: true },
      { p: { x: -35, y: 0 }, hIn: { x: -40, y: 30 }, hOut: { x: -30, y: -30 }, corner: false },
    ]
    const path = pathFromAnchors(anchors, (v) => [v.x, v.y] as Pt)
    const exact = pathAreaCentroidMM(path)
    const shoelace = (ring: Pt[]) => {
      let a = 0, cx = 0, cy = 0
      for (let i = 0; i < ring.length; i++) {
        const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length]
        const w = x0 * y1 - x1 * y0; a += w; cx += (x0 + x1) * w; cy += (y0 + y1) * w
      }
      return { area: a / 2, centroid: [cx / (3 * a), cy / (3 * a)] as Pt }
    }
    // the exact answer is the rational 5687.5 (polynomial integration of rational control points), and
    // an inscribed flatten's area error is linear in its tolerance: measured -3.0 @0.05, -0.057 @0.001,
    // -7.3e-4 @1e-5, -7.7e-6 @1e-7 — walking onto the exact value from below
    expect(exact.areaMM2).toBeCloseTo(5687.5, 6)
    const fine = shoelace(flattenPath(path, 0.00001)), coarse = shoelace(flattenPath(path, 0.05))
    expect(Math.abs(exact.areaMM2 - fine.area)).toBeLessThan(1e-3)
    expect(Math.hypot(exact.centroid[0] - fine.centroid[0], exact.centroid[1] - fine.centroid[1])).toBeLessThan(1e-6)
    // and the manufacturing-tolerance flatten really is a different answer — 3mm² and over a micron of
    // centre — which is why the view must not be the truth
    expect(Math.abs(exact.areaMM2 - coarse.area)).toBeGreaterThan(1)
    expect(Math.hypot(exact.centroid[0] - coarse.centroid[0], exact.centroid[1] - coarse.centroid[1])).toBeGreaterThan(1e-3)
  })
})

describe('exact bounds', () => {
  it('a stadium and a disc report their true extent, and the flattened view agrees to the micron', () => {
    const pill = offsetConvexRingPath([[0, 0], [0, 48], [0, 96]], 12)
    const b = pathBoundsMM(pill)
    expect(b.maxX - b.minX).toBeCloseTo(24, 9)
    expect(b.maxY - b.minY).toBeCloseTo(120, 9)
    const view = flattenPath(pill, 0.025)
    const vx = view.map((p) => p[0]), vy = view.map((p) => p[1])
    // the view used to bulge 25 microns past the true cap and laid the lattice 25 microns off
    expect(Math.max(...vy) - b.maxY).toBeCloseTo(0, 9)
    expect(b.minY - Math.min(...vy)).toBeCloseTo(0, 9)
    expect(Math.max(...vx) - b.maxX).toBeCloseTo(0, 9)
  })
})
