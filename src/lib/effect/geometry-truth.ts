// geometry-truth.ts — THE single geometry pipeline (REBUILD-PLAN-v2 §B, Layer B P1).
//
// A design's geometry truth is ONE VShape, born at generation and replaced atomically by editor
// commits. EVERYTHING derives from it through THIS module at a named tolerance:
//   • manufacturing contour (geometryMM / payload / attachment)  → contourFromShape @ 0.05 mm
//   • 3D display tessellation (ShapedModel)                      → DISPLAY_TOLERANCE_MM (0.004)
//   • cut-line feasibility                                       → assertContourCuttable
//   • recipe↔payload identity (the vector F1 bond)               → vectorShapeHash
//
// SOURCE-OF-TRUTH MODULE ONLY: no UI, no adapters, no React, no document model — v3's outline-core
// imports are ring math (intersection/area/hash), nothing doc-shaped.
// Spaces (one convention, stated once): vector shapes live in MASK-PX, Y-DOWN (the editor's space).
// Contours leave in MM, Y-UP, outer ring reversed to the mesh's expected winding.
//
// (R4 — Creator v5) The retired v3 trace→vector FIT (`vectoriseTrace`, fair + Schneider) is NOT in
// the active pipeline: Magic/upload birth a RAW straight OutlineSource (prepare-effect.ts) and the
// editor's resolve() owns shaping. That dead fit moved to `__tests__/geometry-truth.legacy.ts` (test-only fixture) so
// this module's surface can't import it as authority.

import { validateSelfIntersection, signedArea, contentHash, stableStringify, type Vec2Px } from '@/lib/outline-core/math'
import type { VShape } from '@/lib/vector-core'
import type { Contour, Pt } from './types'
import { flattenPath, pathBoundsMM, pathFromAnchors } from './foundation/path'

/** Manufacturing flatten tolerance — the cut line's fidelity (sub-kerf; kerf is 0.1–0.3 mm). */
export const MANUFACTURING_TOLERANCE_MM = 0.05
/** Display flatten tolerance — the 3D silhouette equals the vector at any zoom (KAI-8951). */
export const DISPLAY_TOLERANCE_MM = 0.004
// Finger-distinct anchor floor (fab-qa re-gate on KAI-8974): two anchors closer than ~1.5mm on the
// PHYSICAL design are one touch target — the pair-collapse floor is mm-true, not viewport px. Consumed
// by the editor's manual-edit pass (OutlineEditor); the resolver/contour math do not need it.
export const MIN_ANCHOR_SEPARATION_MM = 1.5
// Manufacturing minimum-feature floor (Dan, 2026-06-17): the cut process (laser / die) cannot render
// detail finer than this, and the product is a "sticker-like" APPROXIMATION of the rough shape — not a
// hair-accurate trace. So the Magic trace SIMPLIFIES to this floor: sub-feature wobble / marching-squares
// staircase is collapsed to true straight edges (sharp corners kept), yielding a clean straight-faceted
// source the editor's tools then refine. This is SIMPLIFICATION (fewer facets), NOT curve-smoothing —
// the editor owns shaping post-generation. mm-true / scale-invariant: RDP epsilon = MIN_FEATURE_MM /
// mmPerPx. Tunable (Dan calibrates on-device, same as the auto-tune values).
export const MIN_FEATURE_MM = 5
// Below this the outline is collapsed/degenerate — same floor the legacy feasibility used.
const MIN_AREA_PX2 = 1
// int-micron quantization for the canonical hash (float-free identity, payload.ts convention)
const MICRO_PER_PX = 1000

/**
 * The ONE producer of a manufacturing Contour from vector truth. The outer path is carried through
 * EXACTLY — lines and cubics, mapped px → mm with the y-flip on their control points, which is exact
 * for a Bézier — and the point list beside it is a VIEW flattened from that path at manufacturing
 * tolerance, for Clipper and for drawing only. Until 2026-09-04 this function flattened first and
 * kept only the points; the whole path-native product line was turned into chords at this one door,
 * and every measurement downstream then answered against a polygon (Dan: "no polygons on canon and
 * anywhere"). Returns null on degenerate output (caller fails loud).
 */
export function contourFromShape(v: VShape, ctx: { mmPerPx: number; maskHeightPx: number }): Contour | null {
  const k = ctx.mmPerPx || 1
  // KAI-9086 (Phase-2 guard): multi-ring shapes (holes / secondary paths) are NOT yet in scope. The mm
  // contour keeps only the OUTER ring while the SVG exporter serializes ALL paths — a silent divergence
  // the moment holes/multi-piece shapes are promoted. Surface it loudly (current producers are single-path).
  if (v.paths.length > 1) console.warn(`[geometry-truth] contourFromShape: ${v.paths.length} rings — dropping ${v.paths.length - 1} secondary path(s)/hole(s); mm contour is single-path until Phase 2 (KAI-9086).`)
  const source = v.paths[0]
  if (!source || source.anchors.length < 3) return null
  const H = ctx.maskHeightPx
  // vector space is y-DOWN px; the engine is y-UP mm. The flip reverses the winding, so the anchors
  // are walked backwards to keep the mesh's orientation — the same reversal the point list carried.
  const mapped = pathFromAnchors(
    [...source.anchors].reverse().map((a) => ({ p: a.p, hIn: a.hOut, hOut: a.hIn })),
    (p) => [p.x * k, (H - p.y) * k] as Pt,
  )
  const pts = flattenPath(mapped, MANUFACTURING_TOLERANCE_MM)
  if (pts.length < 3) return null
  return { outer: { pts, path: mapped }, holes: [] }
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

/** The shape's longest side in its own px space, read from the EXACT path — an arc or a cubic reaches
 *  its extreme exactly, where a flattening only approaches it. This sets the scale every free shape is
 *  normalised at, so a 1mm-tolerance reading here mis-sized every free shape by up to that much. */
export function shapeLongestPx(v: VShape): number | null {
  const source = v.paths[0]
  if (!source || source.anchors.length < 3) return null
  const b = pathBoundsMM(pathFromAnchors(source.anchors, (p) => [p.x, p.y] as Pt))
  return Math.max(b.maxX - b.minX, b.maxY - b.minY, 1)
}
