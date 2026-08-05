// freeshape — the harmonizer. Verdict + ring → idealized VShape. PURE; all curve math is the
// engine's (Schneider ringToVPath for blobs; kappa-handle primitives for circle/ellipse — the
// vector-core doctrine's own "circle = 4 smooth kappa anchors"). Corners stay SHARP per the
// v5.3.1 birth philosophy — rounding is the Radius knob's job, never baked here.

import { flattenShape, ringToVPath, type VShape } from '@/lib/vector-core'
import { repairSimplePolygon, validateSelfIntersection, type Vec2Px } from '@/lib/outline-core/math'
import { axisAngle, type Classification } from './classify'
import type { Vec2 } from './types'

const KAPPA = 0.5522847498 // cubic-arc constant — vector-core's circle doctrine

/** 4-anchor kappa ellipse at center c, half-axes (a, b), rotated by phi. Circle when a === b. */
function ellipseShape(c: Vec2, a: number, b: number, phi: number): VShape {
  const cos = Math.cos(phi), sin = Math.sin(phi)
  const tx = (x: number, y: number): Vec2 => ({ x: c.x + x * cos - y * sin, y: c.y + x * sin + y * cos })
  const ka = a * KAPPA, kb = b * KAPPA
  return {
    paths: [{
      anchors: [
        { p: tx(a, 0), hIn: tx(a, -kb), hOut: tx(a, kb), corner: false },
        { p: tx(0, b), hIn: tx(ka, b), hOut: tx(-ka, b), corner: false },
        { p: tx(-a, 0), hIn: tx(-a, kb), hOut: tx(-a, -kb), corner: false },
        { p: tx(0, -b), hIn: tx(-ka, -b), hOut: tx(ka, -b), corner: false },
      ],
    }],
  }
}

/** Straight-sided polygon from apex points — sharp corners (rect, triangle). */
const polygonShape = (pts: Vec2[]): VShape =>
  ({ paths: [{ anchors: pts.map((p) => ({ p: { ...p }, hIn: null, hOut: null, corner: true })) }] })

/** Mean distance from centroid — the harmonized circle radius. */
function meanRadius(ring: Vec2[], c: Vec2): number {
  let s = 0
  for (const p of ring) s += Math.hypot(p.x - c.x, p.y - c.y)
  return s / ring.length
}

/** PCA-aligned robust rect: percentile extents along the axes (outlier-wobble immune). */
function fitRect(ring: Vec2[], cls: Classification): Vec2[] {
  const { centroid: c, axis: u } = cls
  const us: number[] = [], vs: number[] = []
  for (const p of ring) {
    const dx = p.x - c.x, dy = p.y - c.y
    us.push(dx * u.x + dy * u.y)
    vs.push(-dx * u.y + dy * u.x)
  }
  us.sort((a, b) => a - b); vs.sort((a, b) => a - b)
  const q = (arr: number[], f: number) => arr[Math.max(0, Math.min(arr.length - 1, Math.round(f * (arr.length - 1))))]
  const u0 = q(us, 0.02), u1 = q(us, 0.98), v0 = q(vs, 0.02), v1 = q(vs, 0.98)
  const tx = (a: number, b: number): Vec2 => ({ x: c.x + a * u.x - b * u.y, y: c.y + a * u.y + b * u.x })
  return [tx(u0, v0), tx(u1, v0), tx(u1, v1), tx(u0, v1)]
}

/** Blob: engine Schneider fit over the ring, corners from the wide-window detector (the fitter's
 *  documented cornersOverride hook for noisy strokes). Fold-guarded with a sharp-polygon fallback
 *  — the harmonizer never emits a self-crossing shape and never fails on a valid ring. */
function fitBlob(ring: Vec2[], cls: Classification, diag: number): VShape {
  const maxError = Math.max(1.5, diag * 0.012)
  const path = ringToVPath(ring, 361 /* detector owns corners */, maxError, cls.corners, maxError, diag * 0.03)
  const shape: VShape = { paths: [path] }
  // fold-guard: flatten the fitted outline with the ENGINE's own flattener and check it stays simple
  const flat: Vec2Px[] = (flattenShape(shape, 0.5)[0] ?? []).map((p) => [p.x, p.y] as Vec2Px)
  if (flat.length >= 4 && validateSelfIntersection(flat, 'freeshape').length === 0) return shape
  const repaired = repairSimplePolygon(ring.map((p) => [p.x, p.y] as Vec2Px), Math.max(1, diag * 0.01))
  return polygonShape(repaired.map(([x, y]) => ({ x, y })))
}

/** verdict → the idealized shape, fitted on the classifier's SMOOTHED ring (the drawn intent);
 *  the caller keeps the raw resampled ring as provenance. */
export function harmonize(cls: Classification, diag: number): VShape {
  const ring = cls.smoothed
  switch (cls.verdict) {
    case 'circle': {
      const r = meanRadius(ring, cls.centroid)
      return ellipseShape(cls.centroid, r, r, 0)
    }
    case 'ellipse': {
      // half-extents from PCA are max-extents; the harmonious ellipse uses radial means per axis
      const phi = axisAngle(cls.axis)
      const cos = Math.cos(phi), sin = Math.sin(phi)
      let su = 0, sv = 0
      for (const p of ring) {
        const dx = p.x - cls.centroid.x, dy = p.y - cls.centroid.y
        su += Math.abs(dx * cos + dy * sin); sv += Math.abs(-dx * sin + dy * cos)
      }
      // mean |proj| of a true ellipse = 2r/π per axis → scale means back to radii
      const a = (su / ring.length) * (Math.PI / 2), b = (sv / ring.length) * (Math.PI / 2)
      return ellipseShape(cls.centroid, a, b, phi)
    }
    case 'rect':
      return polygonShape(fitRect(ring, cls))
    case 'triangle':
      return polygonShape(cls.corners.map((i) => ({ ...ring[i] })))
    case 'blob':
      return fitBlob(ring, cls, diag)
  }
}
