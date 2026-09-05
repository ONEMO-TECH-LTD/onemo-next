// path-curves.test.ts — EVERY LINE THE SCREEN DRAWS IS A CURVE, NOT A CHORD CHAIN.
//
// Dan, 2026-09-05, zooming the bench: "it is absolute polygonal line" / "all lines here are wobbly
// orange black" / "if you convert polygon into the path it will be dirty they must be all regenerated
// from pure vector". Four sources still reached the screen as point chains: generated shapes (a raw
// 96-point ring), finished cutouts (the traced pixel edge), the legal-area islands and masses of every
// cubic shape (a 2mm marching mesh), and the unprotected regions (Clipper's 72-gon discs). These tests
// pin each one to a curve — exact where a closed form exists, fitted through exact samples otherwise.

import { describe, expect, it } from 'vitest'
import { unitShape } from '@/lib/shape-library/defs'
import { transformShape } from '@/lib/vector-core'
import { contourFromShape } from '../geometry-truth'
import { distanceToPathMM, eachSeg, insetOffsetPath, pathFromRingFit, type OutlinePath } from '../foundation/path'
import { edgeDistToContourMM } from '../foundation/geometry'
import { normMaskContour } from '../grid-magnet-bridge'
import { safeSegments } from '../units/segment'
import { measureProtection } from '../units/protection'
import { outlineFromLayout } from '../library/outline'
import type { Contour, Pt } from '../types'

const kinds = (path: OutlinePath) => new Set(path.segs.map((s) => s.kind))
/** Points along the path itself — on each cubic at quarter parameters, so the CURVE is checked, not
 *  only the samples it was fitted through. */
const pointsOn = (path: OutlinePath): Pt[] => {
  const out: Pt[] = []
  eachSeg(path, (from, seg) => {
    if (seg.kind !== 'cubic') { out.push(seg.to); return }
    for (const t of [0.25, 0.5, 0.75]) {
      const u = 1 - t
      out.push([
        u * u * u * from[0] + 3 * u * u * t * seg.c1[0] + 3 * u * t * t * seg.c2[0] + t * t * t * seg.to[0],
        u * u * u * from[1] + 3 * u * u * t * seg.c1[1] + 3 * u * t * t * seg.c2[1] + t * t * t * seg.to[1],
      ])
    }
  })
  return out
}

describe('the exact inset of a convex polygon', () => {
  const square: OutlinePath = { start: [0, 0], segs: [{ kind: 'line', to: [100, 0] }, { kind: 'line', to: [100, 100] }, { kind: 'line', to: [0, 100] }, { kind: 'line', to: [0, 0] }] }

  it('a square shrunk by the rim is the square of moved sides — four lines, exact corners', () => {
    const inset = insetOffsetPath(square, 12)!
    expect(inset).toBeDefined()
    expect([...kinds(inset)]).toEqual(['line'])
    const verts = [inset.start, ...inset.segs.map((s) => s.to)].map(([x, y]) => [+x.toFixed(9), +y.toFixed(9)])
    expect(verts).toEqual([[12, 12], [88, 12], [88, 88], [12, 88], [12, 12]])
  })

  it('a concave polygon has no such construction and says so', () => {
    // an L: the inner corner's moved sides would cross
    const ell: OutlinePath = { start: [0, 0], segs: [{ kind: 'line', to: [100, 0] }, { kind: 'line', to: [100, 40] }, { kind: 'line', to: [40, 40] }, { kind: 'line', to: [40, 100] }, { kind: 'line', to: [0, 100] }, { kind: 'line', to: [0, 0] }] }
    expect(insetOffsetPath(ell, 12)).toBeNull()
  })

  it('shrunk past existence is null, not an inverted polygon', () => {
    expect(insetOffsetPath(square, 60)).toBeNull()
  })
})

describe('a curve fitted through exact samples', () => {
  it('samples on a circle become cubics whose whole length stays on the circle', () => {
    const R = 20
    const n = Math.round((2 * Math.PI * R) / 0.5)
    const ring: Pt[] = Array.from({ length: n }, (_, i) => [R * Math.cos((2 * Math.PI * i) / n), R * Math.sin((2 * Math.PI * i) / n)])
    const path = pathFromRingFit(ring, 0.01)
    expect([...kinds(path)]).toEqual(['cubic'])
    expect(path.segs.length).toBeLessThan(24)             // a curve, not a chord per sample
    for (const p of pointsOn(path)) expect(Math.abs(Math.hypot(p[0], p[1]) - R)).toBeLessThan(0.01)
    for (const s of ring) expect(distanceToPathMM(path, s)).toBeLessThan(0.01)
  })
})

/** A real cubic preset through the manufacturing door, at a size where a legal area exists. */
const heartAt = (sizeMM: number): Contour => {
  const placed = transformShape(unitShape('heart'), (v) => ({ x: 300 + v.x * 280, y: 300 + v.y * 280 }))
  const c = contourFromShape(placed, { mmPerPx: sizeMM / 560, maskHeightPx: 600 })
  if (!c) throw new Error('heart did not produce a contour')
  return c
}

describe('the legal-area islands and masses of a cubic shape are curves', () => {
  const contour = heartAt(160)
  const segs = safeSegments(contour, 12, 'full')

  it('every island and every mass carries one curve per ring, and it is cubic', () => {
    expect(segs.length).toBeGreaterThan(0)
    for (const sg of segs) {
      expect(sg.paths.length).toBe(sg.rings.length)
      for (const p of sg.paths) expect(kinds(p).has('cubic')).toBe(true)
      for (const m of sg.masses) expect(m.paths.length).toBe(m.rings.length)
    }
  })

  it('the curve stays within 0.01mm of the exact edge samples it was fitted through', () => {
    // every sample but the handful straddling the notch, where the legal area comes to a true corner
    // and the fit rounds it — the one stated approximation, bounded in the test below
    const offs = segs.flatMap((sg) => sg.paths.flatMap((path, i) => sg.rings[i].map((s) => distanceToPathMM(path, s)))).sort((a, b) => b - a)
    expect(offs.filter((d) => d >= 0.01).length / offs.length).toBeLessThan(0.01)
    expect(offs[0]).toBeLessThan(0.15)
  })

  it('the curve itself sits on the true clearance edge — 12mm from the cut line along its whole length', () => {
    // Between the samples, not only at them: the drawn curve IS where a magnet centre just clears.
    // Nine points in ten sit within 0.01mm of it, half within 0.005 — a fifth of the manufacturing
    // tolerance. This is the test that caught the last polygon in the chain: the clearance field was
    // measured against a DECIMATED ring of the outline, so every sample, and the faithful curve
    // through them, sat up to 0.03mm off the true edge. Where the outline is a path it is now
    // measured as one; drop that and these percentiles fail by an order of magnitude.
    const devs = segs.flatMap((sg) => sg.paths.flatMap((path) => pointsOn(path).map((p) => Math.abs(edgeDistToContourMM(contour, p) - 12)))).sort((a, b) => a - b)
    expect(devs[Math.floor(devs.length * 0.90)]).toBeLessThan(0.01)
    expect(devs[Math.floor(devs.length * 0.50)]).toBeLessThan(0.005)
    // The exception, stated: a RIDGE of the field — the heart's notch, where two parts of the cut line
    // are equally near — is a true CORNER of the legal area. The samples straddle it and the fitted
    // curve rounds that one tip by ~0.13mm. Display only (the measurement is the mesh and the exact
    // field), and a rounded tip is not a facet — but it is not exact, and it is bounded here.
    expect(devs[devs.length - 1]).toBeLessThan(0.15)
    expect(devs.filter((d) => d > 0.01).length).toBeLessThanOrEqual(4)
  })

  it("'light' detail measures and does not draw: no rings, no paths", () => {
    for (const sg of safeSegments(contour, 12, 'light')) { expect(sg.rings).toEqual([]); expect(sg.paths).toEqual([]) }
  })
})

describe('a canon outline keeps its exact island, arcs or lines', () => {
  it('a sharp library polygon carries a line path, so its legal area is the exact moved-side polygon', () => {
    const square = outlineFromLayout([[0, 0], [48, 0], [48, 48], [0, 48]], { corners: 'sharp' })
    expect(square.path).toBeDefined()
    expect([...kinds(square.path!)]).toEqual(['line'])
    const contour: Contour = { outer: { pts: square.pts.map(([x, y]) => [x, y] as Pt), path: square.path }, holes: [] }
    const [island] = safeSegments(contour, 12, 'full')
    expect(island.paths).toHaveLength(1)
    expect([...kinds(island.paths[0])]).toEqual(['line'])
    // the same four corners whichever one the ring happens to start at
    const verts = island.paths[0].segs.map((s) => `${s.to[0].toFixed(9)},${s.to[1].toFixed(9)}`).sort()
    expect(verts).toEqual(['0.000000000,0.000000000', '0.000000000,48.000000000', '48.000000000,0.000000000', '48.000000000,48.000000000'])
  })
})

describe('the unprotected regions are curves', () => {
  it('one curve per measured ring', () => {
    const contour = heartAt(160)
    const ev = measureProtection(contour, [[80, 80]], 48, 24)
    expect(ev.ringsMM.length).toBeGreaterThan(0)
    expect(ev.pathsMM.length).toBe(ev.ringsMM.length)
    ev.pathsMM.forEach((path, i) => { for (const s of ev.ringsMM[i]) expect(distanceToPathMM(path, s)).toBeLessThan(0.02) })
  })
})

describe('a finished cutout is a curve through the door', () => {
  it('a rasterised disc comes back as cubics on the disc, not as its pixel staircase', () => {
    const W = 400, R = 150
    const mask = new Uint8Array(W * W)
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++)
      if (Math.hypot(x + 0.5 - W / 2, y + 0.5 - W / 2) <= R) mask[y * W + x] = 1
    const c = normMaskContour(mask, W, W)!
    expect(c.outer.path).toBeDefined()
    expect([...kinds(c.outer.path!)]).toEqual(['cubic'])
    expect(c.outer.path!.segs.length).toBeLessThan(40)
    // normalised so the longest side is 1: the disc has radius 0.5 about its centre
    const xs = c.outer.pts.map((p) => p[0]), ys = c.outer.pts.map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
    // the 1.5px fit tolerance plus the half-pixel staircase the samples themselves sit on, normalised
    const tolNorm = (1.5 + Math.SQRT1_2) / (2 * R)
    for (const p of pointsOn(c.outer.path!)) expect(Math.abs(Math.hypot(p[0] - cx, p[1] - cy) - 0.5)).toBeLessThan(tolNorm)
  })
})
