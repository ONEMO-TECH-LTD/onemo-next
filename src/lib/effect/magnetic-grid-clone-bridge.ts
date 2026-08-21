// grid-origin-bridge.ts — UI bridge: shape preparation and display lists for the bench shell.
// Wiring only — values from spec, geometry from compute, answers from the engine.

import { contourFromShape } from './geometry-truth'
import { traceContourRaw } from './contour'
import { insetRingMM } from './offset'
import { scaleContour } from '../magnetic-grid/compute'
import { flattenShape, type VShape } from '@/lib/vector-core'
import type { Contour, Pt } from './types'
import {
  fieldSpanMM,
  latticeOver,
  MIN_EFFECT_MM,
  SIZE_CEIL_MARGIN_MM,
  type GridResult,
} from '../magnetic-grid/engine'

/** Flatten reference: curves are flattened as if cut at this size, THEN normalized, so the 0.05mm
 *  manufacturing tolerance holds at every slider size. */
const FLATTEN_REF_MM = 250

function bboxOf(pts: ReadonlyArray<{ x: number; y: number }>) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const p of pts) { if (p.x < a) a = p.x; if (p.x > c) c = p.x; if (p.y < b) b = p.y; if (p.y > d) d = p.y }
  return { w: c - a, h: d - b }
}

/** VShape → mm contour normalized so its longest side = 1mm, flattened at manufacturing scale. */
export function normBaseContour(vs: VShape, maskHeightPx: number): Contour | null {
  const rings = flattenShape(vs, 1)
  const bb = bboxOf(rings[0] ?? [])
  const L = Math.max(bb.w, bb.h, 1)
  const c = contourFromShape(vs, { mmPerPx: FLATTEN_REF_MM / L, maskHeightPx })
  if (!c) return null
  return { outer: { pts: c.outer.pts.map(([x, y]) => [x / FLATTEN_REF_MM, y / FLATTEN_REF_MM] as Pt) }, holes: [] }
}

/** Sizer for one base contour: real-mm contour at any longest side, outline offset applied. */
export function makeSizer(base: Contour, offsetMM: number): (mm: number) => Contour {
  return (mm: number): Contour => {
    const c = scaleContour(base, mm)
    if (!offsetMM) return c
    const o = insetRingMM(c.outer.pts, offsetMM, 'round')
    return o && o.length >= 3 ? { outer: { pts: o }, holes: [] } : c
  }
}

/** Finished-cutout path: alpha mask (image px, y-down) → traced outline → base contour
 *  normalized to longest side = 1mm, y-up. No AI — the outline IS the mask's edge. */
export function normMaskContour(mask: Uint8Array, w: number, h: number): Contour | null {
  const raw = traceContourRaw(mask, w, h)
  if (!raw || raw.length < 3) return null
  // A raw half-pixel trace carries thousands of points; the engine's cost scales with them.
  // Decimate to the same order the AI path's flatten produces — sub-0.2mm fidelity at product
  // sizes, ~10x cheaper solves.
  const MAXV = 600
  const k = Math.max(1, Math.ceil(raw.length / MAXV))
  const ring: typeof raw = []
  for (let i = 0; i < raw.length; i += k) ring.push(raw[i])
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ring) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const L = Math.max(maxX - minX, maxY - minY, 1)
  return { outer: { pts: ring.map(([x, y]) => [(x - minX) / L, (maxY - y) / L] as Pt) }, holes: [] }
}

/** Generated polygon ring (image px, y-down) → mm contour normalized to 1mm, y-up. */
export function normGeneratedRing(ring: ReadonlyArray<readonly [number, number]>, imgH: number): Contour | null {
  if (ring.length < 3) return null
  const bb = bboxOf(ring.map(([x, y]) => ({ x, y })))
  const L = Math.max(bb.w, bb.h, 1)
  return { outer: { pts: ring.map(([x, y]) => [x / L, (imgH - y) / L] as Pt) }, holes: [] }
}

/** The size range a surface may offer — the fixed board plus a margin so shapes can pad past it. */
export function sizeRange(padMM: number): { minMM: number; maxMM: number } {
  return { minMM: MIN_EFFECT_MM, maxMM: fieldSpanMM(padMM) + SIZE_CEIL_MARGIN_MM }
}
/** One drawable spot: engine-space centre, radius, and whether a magnet seats there. */
export interface FieldSpot {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly held: boolean
}

/** Every lattice position over a region as a display list, on the engine's own phase.
 *  Phase is re-anchored on a real answer point: the generator's phase is relative to the region's
 *  min, so the same phase over a different region would be a different absolute lattice. */
export function fieldSpots(
  grid: GridResult,
  view: { minX: number; minY: number; maxX: number; maxY: number },
): FieldSpot[] {
  const anchorAt = new Map(grid.anchors.map((a) => [a.p[0].toFixed(2) + ',' + a.p[1].toFixed(2), a]))
  const A = grid.anchors[0]?.p ?? grid.lattice[0]
  if (!A) return []
  const pad = grid.spotRadiusMM
  const rgn = { minX: view.minX - pad, minY: view.minY - pad, maxX: view.maxX + pad, maxY: view.maxY + pad }
  return latticeOver(rgn, grid.pitchCentreMM, [A[0] - rgn.minX, A[1] - rgn.minY]).map((n) => {
    const a = anchorAt.get(n[0].toFixed(2) + ',' + n[1].toFixed(2))
    return { x: n[0], y: n[1], r: grid.spotRadiusMM, held: Boolean(a) }
  })
}

/** The seated spots alone — what a surface draws when the full field is off. */
export function seatedSpots(grid: GridResult): FieldSpot[] {
  return grid.anchors.map((a) => ({ x: a.p[0], y: a.p[1], r: grid.spotRadiusMM, held: true }))
}
