// grid-origin-bridge.ts — THE BRIDGE between the origin engine and its bench shell.
//
// Separation (the scaffold's law, applied here): the ENGINE computes, its VALUES are declared
// beside it, and the SHELL draws — it decides nothing and derives nothing. Everything a surface
// needs that is not a screen concern lives HERE, portable, so the shell can be swapped without
// touching a formula and the engine never learns a shell exists.
//
// Everything in this file is wiring and translation. It holds no values of its own (they come from
// grid-origin's spec block) and does no geometry the engine doesn't already do — it asks.

import { contourFromShape } from './geometry-truth'
import { flattenShape, type VShape } from '@/lib/vector-core'
import type { Contour, Pt } from './types'
import {
  computeGrid,
  fieldSpanMM,
  latticeOver,
  MIN_EFFECT_MM,
  spotRadiusFor,
  type GridPattern,
  type GridResult,
  type MagnetPlan,
} from './grid-origin'

/**
 * The size at which curves are flattened before normalizing — the largest the bench manufactures.
 * Flattening happens AS IF cut at this size so the 0.05mm manufacturing tolerance is honoured at
 * every size a slider reaches; normalizing afterwards changes coordinates, not resolution.
 * (Handing the flattener the normalized 1mm shape instead turned that tolerance into 50 source
 * pixels, and the engine judged magnets against a visibly faceted polygon.)
 */
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

/** A generated polygon ring (image px, y-down) → mm contour normalized to 1mm, y-up. */
export function normGeneratedRing(ring: ReadonlyArray<readonly [number, number]>, imgH: number): Contour | null {
  if (ring.length < 3) return null
  const bb = bboxOf(ring.map(([x, y]) => ({ x, y })))
  const L = Math.max(bb.w, bb.h, 1)
  return { outer: { pts: ring.map(([x, y]) => [x / L, (imgH - y) / L] as Pt) }, holes: [] }
}

/**
 * The size range a surface may offer — floor and ceiling both derived, so they move when the
 * pitch, plan or padding do. The shell shows these; it never computes them.
 */
export function sizeRange(pitchMM: number, plan: MagnetPlan, padMM: number): { minMM: number; maxMM: number } {
  return { minMM: MIN_EFFECT_MM, maxMM: fieldSpanMM(pitchMM, plan, padMM) }
}

/** One drawable spot: engine-space centre, radius, and whether a magnet seats there. */
export interface FieldSpot {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly held: boolean
}

/**
 * THE FIELD AS A DISPLAY LIST — every lattice position over a region, each at its true radius.
 *
 * One lattice: positions come from the engine's own generator at the phase its search chose,
 * anchored on a real answer point so the field cannot drift from the magnets (the generator's
 * phase is relative to the region's min, so the same phase over a different region is a different
 * absolute lattice). A seated spot carries its own magnet's radius — the old padding ring's exact
 * construction; an empty spot carries the radius the erosion judged it by.
 */
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
    return {
      x: n[0],
      y: n[1],
      r: a ? a.dia / 2 + grid.applicationPadMM : grid.spotRadiusMM,
      held: Boolean(a),
    }
  })
}

/** The seated spots alone — what a surface draws when the full field is switched off. */
export function seatedSpots(grid: GridResult): FieldSpot[] {
  return grid.anchors.map((a) => ({
    x: a.p[0],
    y: a.p[1],
    r: a.dia / 2 + grid.applicationPadMM,
    held: true,
  }))
}

export { computeGrid, spotRadiusFor }
export type { GridResult, GridPattern, MagnetPlan }
