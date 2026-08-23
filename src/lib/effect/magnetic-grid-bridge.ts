// Magnetic-grid bridge: shape preparation and display lists for the Law bench shell.
// Wiring only — values from spec, geometry from compute, answers from the engine.

import { contourFromShape } from './geometry-truth'
import { traceContourRaw } from './contour'
import { insetRingMM } from './offset'
import { flattenShape, type VShape } from '@/lib/vector-core'
import type { Contour, Pt } from './types'
import {
  fieldSpanMM,
  contourBoundaryTruth,
  latticeOver,
  scaleContour,
  MIN_EFFECT_MM,
  SIZE_CEIL_MARGIN_MM,
  type BoundaryTruth,
  type GridResult,
  type SolverConfig,
} from '../magnetic-grid/engine'

/** Full ordered-coordinate identity for worker/cache invalidation; no sampling or rounding. */
export const contourIdentity = (contour: Contour): string => contourBoundaryTruth(contour).contourIdentity
export const boundaryTruth = (contour: Contour): BoundaryTruth => contourBoundaryTruth(contour)

/** Flatten reference and outline resolution are CALIBRATION, not constants (Dan, 2026-08-23):
 *  both change the supplied geometry and therefore the answers, so Spec owns them and the dash
 *  exposes them under Contour preparation. `SOLVER_DEFAULTS` carries the values used until now. */

function bboxOf(pts: ReadonlyArray<{ x: number; y: number }>) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const p of pts) { if (p.x < a) a = p.x; if (p.x > c) c = p.x; if (p.y < b) b = p.y; if (p.y > d) d = p.y }
  return { w: c - a, h: d - b }
}

/** VShape → mm contour normalized so its longest side = 1mm, flattened at manufacturing scale. */
export function normBaseContour(vs: VShape, maskHeightPx: number, flattenRefMM: number): Contour | null {
  const rings = flattenShape(vs, 1)
  const bb = bboxOf(rings[0] ?? [])
  const L = Math.max(bb.w, bb.h, 1)
  const c = contourFromShape(vs, { mmPerPx: flattenRefMM / L, maskHeightPx })
  if (!c) return null
  return { outer: { pts: c.outer.pts.map(([x, y]) => [x / flattenRefMM, y / flattenRefMM] as Pt) }, holes: [] }
}

/** Sizer for one base contour: real-mm contour at any longest side, configured outline offset applied. */
export function makeSizer(base: Contour, cfg: Pick<SolverConfig, 'outlineOffsetMM'>): (mm: number) => Contour {
  const offsetMM = cfg.outlineOffsetMM
  return (mm: number): Contour => {
    const c = scaleContour(base, mm)
    if (!offsetMM) return c
    const o = insetRingMM(c.outer.pts, offsetMM, 'round')
    if (!o || o.length < 3) return c
    const holes = c.holes.flatMap((hole) => {
      const offset = insetRingMM(hole.pts, -offsetMM, 'round')
      return offset && offset.length >= 3 ? [{ pts: offset }] : []
    })
    return { outer: { pts: o }, holes }
  }
}

// Law surface door: UI values and types reach the tab through the bridge, never around it.
export {
  SOLVER_CONTROLS,
  SOLVER_DEFAULTS,
  validateSolverConfig,
  type SolverControl,
  BANDS,
  CENTRE_MODE,
  DEFAULT_PITCH_MM,
  FLAP_CEIL_MM,
  FLAP_FLOOR_MM,
  FLAP_MM,
  GOVERNOR,
  MASS_DEPTH_CEIL_MM,
  MASS_DEPTH_FLOOR_MM,
  MASS_DEPTH_MM,
  MIN_EFFECT_MM,
  MIN_TOUCH,
  MIN_TOUCH_CEIL,
  MIN_TOUCH_FLOOR,
  PADDING_CEIL_MM,
  PADDING_FLOOR_MM,
  RELEASED_PADDING_MM,
  RELEASED_PITCHES_MM,
  SIZE_STEP_MM,
  type BandId,
  type GridResult,
  type SolverConfig,
  type MagnetPlan,
  type Placement,
  type CountTier,
  type LawLayout,
  type SafeSegment,
} from '../magnetic-grid/engine'

/** Finished-cutout path: alpha mask (image px, y-down) → traced outline → base contour
 *  normalized to longest side = 1mm, y-up. No AI — the outline IS the mask's edge. */
export function normMaskContour(mask: Uint8Array, w: number, h: number, maxVertices: number): Contour | null {
  const raw = traceContourRaw(mask, w, h)
  if (!raw || raw.length < 3) return null
  // A raw half-pixel trace carries thousands of points; the engine's cost scales with them.
  // Decimating changes the outline the laws are measured against, so the resolution is a
  // configured value (Outline resolution), never a constant living here.
  const k = Math.max(1, Math.ceil(raw.length / maxVertices))
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
