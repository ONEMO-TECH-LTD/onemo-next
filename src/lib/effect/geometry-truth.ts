// geometry-truth.ts — THE single geometry pipeline (REBUILD-PLAN-v2 §B, Layer B P1).
//
// A design's geometry truth is ONE VShape, born at generation and replaced atomically by editor
// commits. EVERYTHING derives from it through THIS module at a named tolerance:
//   • manufacturing contour (geometryMM / payload / attachment)  → contourFromShape @ 0.05 mm
//   • 3D display tessellation (ShapedModel)                      → DISPLAY_TOLERANCE_MM (0.004)
//   • cut-line feasibility                                       → assertContourCuttable
//   • recipe↔payload identity (the vector F1 bond)               → vectorShapeHash
//   • trace → vector fitting (Magic at generation, editor Tune)  → vectoriseTrace
//
// SOURCE-OF-TRUTH MODULE ONLY: no UI, no adapters, no React, no OutlineDocument — v3's
// outline-core imports are ring math (fairing + intersection/area), nothing doc-shaped.
// Spaces (one convention, stated once): vector shapes live in MASK-PX, Y-DOWN (the editor's
// space). Raw traces arrive in mask-px Y-UP (the mask/engine space) — vectoriseTrace owns the
// flip. Contours leave in MM, Y-UP, outer ring reversed to the mesh's expected winding.

import { fairTracedRing, validateSelfIntersection, signedArea, contentHash, stableStringify, type FairTracedRingOpts, type Vec2Px } from '@/lib/outline-core'
import { flattenShape, ringToVPath, type VShape } from '@/lib/vector-core'
import type { Contour, Pt } from './types'

/** Manufacturing flatten tolerance — the cut line's fidelity (sub-kerf; kerf is 0.1–0.3 mm). */
export const MANUFACTURING_TOLERANCE_MM = 0.05
/** Display flatten tolerance — the 3D silhouette equals the vector at any zoom (KAI-8951). */
export const DISPLAY_TOLERANCE_MM = 0.004
// Trace→vector fit parameters — the ONE fit every trace goes through (generation AND editor
// re-Tune use these; a parameter fork here would be a second pipeline).
const FIT_CORNER_ANGLE_DEG = 30
const FIT_MAX_ERROR_PX = 0.35
const MIN_RAW_TRACE_POINTS = 24
// Below this the outline is collapsed/degenerate — same floor the legacy feasibility used.
const MIN_AREA_PX2 = 1
// int-micron quantization for the canonical hash (float-free identity, payload.ts convention)
const MICRO_PER_PX = 1000

/**
 * Fit a raw traced ring (mask px, y-up) into the vector truth: fair → ONE Schneider fit.
 * Used at Magic GENERATION (truth at birth, §B1) and by the editor's Tune re-fit — the same
 * function, so generation and editor produce identical geometry for identical inputs.
 * Returns null when the trace is too sparse to be a shape (caller fails loud — no silent door).
 */
export function vectoriseTrace(rawMaskPx: ReadonlyArray<Pt>, maskHeightPx: number, fairing: FairTracedRingOpts): VShape | null {
  if (rawMaskPx.length < MIN_RAW_TRACE_POINTS) return null
  const yDown = rawMaskPx.map(([x, y]) => [x, maskHeightPx - y] as Vec2Px)
  const faired = fairTracedRing(yDown, fairing)
  if (faired.length < 3) return null
  return { paths: [ringToVPath(faired.map(([x, y]) => ({ x, y })), FIT_CORNER_ANGLE_DEG, FIT_MAX_ERROR_PX)] }
}

/**
 * The ONE producer of a manufacturing Contour from vector truth: flatten the outer path at
 * manufacturing tolerance, map px → mm with the y-flip, reverse to the mesh's winding.
 * Returns null on degenerate output (caller fails loud).
 */
export function contourFromShape(v: VShape, ctx: { mmPerPx: number; maskHeightPx: number }): Contour | null {
  const k = ctx.mmPerPx || 1
  const tolPx = Math.max(0.05, MANUFACTURING_TOLERANCE_MM / k)
  const rings = flattenShape(v, tolPx)
  const outerRing = rings[0]
  if (!outerRing || outerRing.length < 3) return null
  const H = ctx.maskHeightPx
  const outer = outerRing.map((p) => [p.x * k, (H - p.y) * k] as Pt).reverse()
  return { outer: { pts: outer }, holes: [] }
}

export interface ContourFeasibility {
  ok: boolean
  reason?: 'self-intersection' | 'degenerate'
}

/**
 * Cut-line feasibility on the CONTOUR (ring math — no document resolve): the same verdict class
 * the legacy gate produced (self-intersection via outline-core's validator + collapsed-area floor),
 * derived from the single truth's manufacturing flatten.
 */
export function assertContourCuttable(c: Contour, mmPerPx = 1): ContourFeasibility {
  const k = mmPerPx || 1
  const ringPx = c.outer.pts.map(([x, y]) => [x / k, y / k] as Vec2Px)
  if (ringPx.length < 3) return { ok: false, reason: 'degenerate' }
  // self-intersection BEFORE the area floor: a crossing ring can have ZERO net signed area
  // (opposite lobes cancel — the bowtie), and "self-intersection" is the actionable verdict.
  if (validateSelfIntersection(ringPx, 'outer').length > 0) {
    return { ok: false, reason: 'self-intersection' }
  }
  if (Math.abs(signedArea(ringPx)) < MIN_AREA_PX2) {
    return { ok: false, reason: 'degenerate' }
  }
  return { ok: true }
}

/**
 * Canonical identity hash of the vector truth — the recipe↔payload bond key (vector F1).
 * Anchors quantized to integer micro-px (float-free, cross-platform stable); handle absence is
 * hashed explicitly so line↔cubic edits always change identity.
 */
export function vectorShapeHash(v: VShape): string {
  const q = (n: number) => Math.round(n * MICRO_PER_PX)
  const body = v.paths.map((path) =>
    path.anchors.map((a) => ({
      p: [q(a.p.x), q(a.p.y)],
      hIn: a.hIn ? [q(a.hIn.x), q(a.hIn.y)] : null,
      hOut: a.hOut ? [q(a.hOut.x), q(a.hOut.y)] : null,
      c: a.corner ? 1 : 0,
    })),
  )
  return contentHash(stableStringify({ vectorShape: body }))
}
