// grid-magnet-bridge.ts — UI bridge: shape preparation and display lists for the bench shell.
// Wiring only — values from spec, geometry from compute, answers from the engine.

import { contourFromShape, shapeLongestPx } from './geometry-truth'
import { traceContourRaw } from './contour'
import { insetRingMM } from './offset'
import { scaleContour } from './grid-magnet-compute'
import { flattenPath, ringToVPath, type VPath, type VShape } from '@/lib/vector-core'
import { validateSelfIntersection, type Vec2Px } from '@/lib/outline-core/math'
import type { Contour, Pt } from './types'
import {
  fieldSpanMM,
  latticeOver,
  MIN_EFFECT_MM,
  SIZE_CEIL_MARGIN_MM,
  type GridResult,
} from './grid-magnet'

/** Flatten reference: curves are flattened as if cut at this size, THEN normalized, so the 0.05mm
 *  manufacturing tolerance holds at every slider size. */
const FLATTEN_REF_MM = 250

/** VShape → mm contour normalized so its longest side = 1mm. The longest side is read from the shape's
 *  EXACT path bounds — an arc or a cubic reaches its extreme exactly — where it used to be read from a
 *  1mm flattening, which mis-set the scale of every free shape by up to that much. The path itself is
 *  normalised alongside the point view and carried on. */
export function normBaseContour(vs: VShape, maskHeightPx: number): Contour | null {
  const L = shapeLongestPx(vs)
  if (L === null) return null
  const c = contourFromShape(vs, { mmPerPx: FLATTEN_REF_MM / L, maskHeightPx })
  if (!c) return null
  // Every ring normalises, path included. Dropping holes here deleted them before the engine ever saw them.
  return scaleContour(c, 1 / FLATTEN_REF_MM)
}

/** Sizer for one base contour: real-mm contour at any longest side, outline offset applied.
 *
 *  With no offset the exact path rides through untouched. WITH an offset, a shape that carries a
 *  path FAILS LOUD: the only offset available grows the point view with Clipper, and a Clipper
 *  polygon cannot be the manufacturing truth under the no-polygons ruling (Dan, 2026-09-04), while a
 *  path that no longer matches its outline would be worse than none. Silently falling back was the
 *  first version of this and QA refused it. An exact offset of lines, arcs and cubics is the next
 *  scoped path task; until it lands the offset route is closed, not approximated. Today nothing
 *  drives it — the page passes offsetMM 0 — so no live control is affected. */
export function makeSizer(base: Contour, offsetMM: number): (mm: number) => Contour {
  return (mm: number): Contour => {
    const c = scaleContour(base, mm)
    if (!offsetMM) return c
    if (c.outer.path || c.holes.some((h) => h.path))
      throw new Error(`grid: outline offset ${offsetMM}mm is not supported on a path-bearing shape — exact path offset not yet implemented; a Clipper polygon cannot stand in for the cut path`)
    const o = insetRingMM(c.outer.pts, offsetMM, 'round')
    // A positive offset grows the outline and SHRINKS every hole by the same amount — a hole is a
    // boundary, so an inset moves it inward from the material's point of view.
    const holes = c.holes.map((h) => insetRingMM(h.pts, -offsetMM, 'round')).filter((h): h is Pt[] => !!h && h.length >= 3)
    return o && o.length >= 3 ? { outer: { pts: o }, holes: holes.map((pts) => ({ pts })) } : c
  }
}

/** Cache identity for a prepared shape: the exact rings and the offset, not a summary of them.
 *  A hash of ring counts collides — two different hole positions keyed the same and returned the
 *  wrong cached sizer. */
export function contourCacheKey(base: Contour, offsetMM: number): string {
  // The whole ring, PATH included: two shapes with the same flattened view but different curves
  // must not share a bake or a rung. Keying on points alone was safe only before the path was the
  // truth (QA @ef57810a F9). Ring and path are plain serialisable data, so the key is the data.
  return JSON.stringify([
    offsetMM,
    base.outer,
    base.holes,
  ])
}

/** How far the fitted edge of a finished cutout may sit from its traced pixel edge, in image pixels —
 *  the trace itself is a half-pixel staircase, so this is the staircase's own grain. */
const CUTOUT_FIT_PX = 1.5
/** The turn that makes a traced vertex a real corner, not a curve sample. A mask's silhouette has
 *  genuine cusps — a duck's tuft, a bat's ear — and fitting a smooth cycle straight through one makes
 *  the curve overshoot and cross itself. */
const CUTOUT_CORNER_DEG = 60

/** Finished-cutout path: alpha mask (image px, y-down) → traced edge → the repo's Bézier fit (the
 *  Schneider fit the Studio's Simplify and its generators both use) → a vector shape through the same
 *  door every preset takes. No AI — the outline IS the mask's edge, as a curve. It used to hand the
 *  engine the traced points themselves, so a cutout was the one shape drawn and measured as a polygon
 *  (Dan, 2026-09-05: "no polygons on canon and anywhere").
 *
 *  A FIT THAT CROSSES ITSELF IS REFUSED. An outline is the boundary between material and air, and
 *  every measurement downstream — is this point inside, how far is the edge, where is the legal area —
 *  reads it by crossing count. A self-crossing curve makes regions OUTSIDE the shape read as inside:
 *  the duck grew a phantom island beyond its own bounding box and the engine centred the layout on it.
 *  So the fit is validated, tightened once if it folds, and refused to the traced polygon if it still
 *  does — a polygon outline is worse to look at, never wrong to measure. */
export function normMaskContour(mask: Uint8Array, w: number, h: number): Contour | null {
  const raw = traceContourRaw(mask, w, h)
  if (!raw || raw.length < 3) return null
  // A raw half-pixel trace carries thousands of points; the fit's cost scales with them, and ~600
  // samples pin a curve at any cutout size (the Studio's own budget).
  const MAXV = 600
  const k = Math.max(1, Math.ceil(raw.length / MAXV))
  const ring: Array<{ x: number; y: number }> = []
  for (let i = 0; i < raw.length; i += k) ring.push({ x: raw[i][0], y: raw[i][1] })
  const simple = (path: VPath): boolean => {
    const flat = flattenPath(path, 0.25).map(({ x, y }) => [x, y] as Vec2Px)
    return validateSelfIntersection(flat, 'cutout').length === 0
  }
  for (const tol of [CUTOUT_FIT_PX, CUTOUT_FIT_PX / 4]) {
    const path = ringToVPath(ring, CUTOUT_CORNER_DEG, tol)
    if (simple(path)) return normBaseContour({ paths: [path] }, h)
  }
  return normBaseContour({ paths: [{ anchors: ring.map((p) => ({ p, hIn: null, hOut: null, corner: true })) }] }, h)
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
  const A = grid.anchors[0]?.p ?? grid.lattice[0]
  if (!A) return []
  const pad = grid.spotRadiusMM
  const rgn = { minX: view.minX - pad, minY: view.minY - pad, maxX: view.maxX + pad, maxY: view.maxY + pad }
  // A spot holds a magnet when one SITS ON IT. Matching by rounded-coordinate string keys made
  // that a knife edge: the generator steps its axis by repeated addition while the solver's
  // anchors are origin + k·pitch, so a coordinate near a rounding boundary keyed differently the
  // further out it sat — and a whole column of seated magnets drew as empty. Distance decides;
  // the lattice is 48mm apart, so half a millimetre is unambiguous.
  const near = (n: Pt) => grid.anchors.some((a) => Math.abs(a.p[0] - n[0]) < 0.5 && Math.abs(a.p[1] - n[1]) < 0.5)
  return latticeOver(rgn, grid.pitchCentreMM, [A[0] - rgn.minX, A[1] - rgn.minY]).map((n) => (
    { x: n[0], y: n[1], r: grid.spotRadiusMM, held: near(n) }
  ))
}

/** The seated spots alone — what a surface draws when the full field is off. */
export function seatedSpots(grid: GridResult): FieldSpot[] {
  return grid.anchors.map((a) => ({ x: a.p[0], y: a.p[1], r: grid.spotRadiusMM, held: true }))
}

