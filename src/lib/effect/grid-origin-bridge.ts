// grid-origin-bridge.ts — UI bridge: shape preparation and display lists for the bench shell.
// Wiring only — values from spec, geometry from compute, answers from the engine.

import { contourFromShape } from './geometry-truth'
import { insetRingMM } from './offset'
import { scaleContour } from './grid-origin-compute'
import { flattenShape, type VShape } from '@/lib/vector-core'
import type { Contour, Pt } from './types'
import {
  computeGrid,
  fieldSpanMM,
  latticeOver,
  MIN_EFFECT_MM,
  type GridPattern,
  type GridResult,
  type MagnetPlan,
} from './grid-origin'

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

/** Generated polygon ring (image px, y-down) → mm contour normalized to 1mm, y-up. */
export function normGeneratedRing(ring: ReadonlyArray<readonly [number, number]>, imgH: number): Contour | null {
  if (ring.length < 3) return null
  const bb = bboxOf(ring.map(([x, y]) => ({ x, y })))
  const L = Math.max(bb.w, bb.h, 1)
  return { outer: { pts: ring.map(([x, y]) => [x / L, (imgH - y) / L] as Pt) }, holes: [] }
}

/** The size range a surface may offer — floor and ceiling derived, moving with pitch and padding. */
export function sizeRange(pitchMM: number, padMM: number): { minMM: number; maxMM: number } {
  return { minMM: MIN_EFFECT_MM, maxMM: fieldSpanMM(pitchMM, padMM) }
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
  pattern: GridPattern,
  view: { minX: number; minY: number; maxX: number; maxY: number },
): FieldSpot[] {
  const anchorAt = new Map(grid.anchors.map((a) => [a.p[0].toFixed(2) + ',' + a.p[1].toFixed(2), a]))
  const A = grid.anchors[0]?.p ?? grid.lattice[0]
  if (!A) return []
  const pad = grid.spotRadiusMM
  const rgn = { minX: view.minX - pad, minY: view.minY - pad, maxX: view.maxX + pad, maxY: view.maxY + pad }
  return latticeOver(rgn, grid.pitchCentreMM, pattern, [A[0] - rgn.minX, A[1] - rgn.minY]).map((n) => {
    const a = anchorAt.get(n[0].toFixed(2) + ',' + n[1].toFixed(2))
    return { x: n[0], y: n[1], r: grid.spotRadiusMM, held: Boolean(a) }
  })
}

/** The seated spots alone — what a surface draws when the full field is off. */
export function seatedSpots(grid: GridResult): FieldSpot[] {
  return grid.anchors.map((a) => ({ x: a.p[0], y: a.p[1], r: grid.spotRadiusMM, held: true }))
}

export { computeGrid }
export type { GridResult, GridPattern, MagnetPlan }
