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
// SOURCE-OF-TRUTH MODULE ONLY: no UI, no adapters, no React, no document model — v3's
// outline-core imports are ring math (fairing + intersection/area), nothing doc-shaped.
// Spaces (one convention, stated once): vector shapes live in MASK-PX, Y-DOWN (the editor's
// space). Raw traces arrive in mask-px Y-UP (the mask/engine space) — vectoriseTrace owns the
// flip. Contours leave in MM, Y-UP, outer ring reversed to the mesh's expected winding.

import { fairTracedRing, rdpClosed, validateSelfIntersection, repairSimplePolygon, signedArea, contentHash, stableStringify, type FairTracedRingOpts, type Vec2Px } from '@/lib/outline-core'
import { flattenShape, ringToVPath, filletPathSmart, type VShape } from '@/lib/vector-core'
import type { Contour, Pt } from './types'

/** Manufacturing flatten tolerance — the cut line's fidelity (sub-kerf; kerf is 0.1–0.3 mm). */
export const MANUFACTURING_TOLERANCE_MM = 0.05
/** Display flatten tolerance — the 3D silhouette equals the vector at any zoom (KAI-8951). */
export const DISPLAY_TOLERANCE_MM = 0.004
// Trace→vector fit parameters — the ONE fit every trace goes through (generation AND editor
// re-Tune use these; a parameter fork here would be a second pipeline).
const FIT_CORNER_ANGLE_DEG = 30
const FIT_MAX_ERROR_PX = 0.35
// Anchor-compaction budget (KAI-8974/F3b): the minimal-segmentation pass may spend up to 2x the
// fit tolerance to remove redundant anchors — 0.7px on a typical 1200px mask ≈ 0.04mm at the 70mm
// base, inside the 0.05mm manufacturing class; G1/tangent-preserving, corners never merged.
const FIT_COMPACT_ERROR_PX = FIT_MAX_ERROR_PX * 2
// Finger-distinct anchor floor (fab-qa re-gate on KAI-8974): two anchors closer than ~1.5mm on
// the PHYSICAL design are one touch target — the pair-collapse floor is mm-true, not viewport px.
export const MIN_ANCHOR_SEPARATION_MM = 1.5
const MIN_RAW_TRACE_POINTS = 24
const CORNER_PIN_MAX_SNAP_PX = 8 // KAI-9009: a raw corner farther than this from the faired ring no longer exists
// CORNER INTEGRITY (Dan, 2026-06-11): intentional sharp features must survive the cut as TRUE
// corner anchors — the fairing smooths everything else to optimal, never the corners themselves.
// Detection runs on the RAW trace structure (RDP skeleton — per-sample angles can't tell jitter
// from corners; the simplified skeleton's vertices can), then the sharp vertices are pinned
// through the fit. Turn threshold: features sharper than this are design intent, not noise.
const CORNER_TURN_DEG = 55
const CORNER_RDP_EPSILON_PX = 2.5
const CORNER_MIN_SEPARATION_PX = 6
// CROP-CORNER DEFAULT (Dan's 2026-06-07 landing ruling, KAI-8982 D1): a ~90° corner SITTING ON
// the image frame edge is a crop artifact ("straight sharp crop originally") — it gets the SAME
// default radius automatically in pass 2. Interior sharp corners (a book, a card, a star spike)
// are design intent and stay TRUE corner anchors. The discriminator is geometric: frame-edge
// proximity + the 90° band. The sharp fit remains derivable from the raw (Radius→0 = sharp).
const CROP_TURN_MIN_DEG = 70
const CROP_TURN_MAX_DEG = 110
const CROP_EDGE_EPSILON_PX = 6
// Below this the outline is collapsed/degenerate — same floor the legacy feasibility used.
const MIN_AREA_PX2 = 1
// int-micron quantization for the canonical hash (float-free identity, payload.ts convention)
const MICRO_PER_PX = 1000

/** Sharp-feature detection on the raw ring's RDP skeleton → corner positions + turn (y-down px). */
function rawCornerPositions(yDown: Vec2Px[]): { p: Vec2Px; turnDeg: number }[] {
  const skeleton = rdpClosed(yDown, CORNER_RDP_EPSILON_PX)
  const n = skeleton.length
  if (n < 4) return []
  const out: { p: Vec2Px; turnDeg: number }[] = []
  const thr = (CORNER_TURN_DEG * Math.PI) / 180
  for (let i = 0; i < n; i++) {
    const a = skeleton[(i - 1 + n) % n], p = skeleton[i], b = skeleton[(i + 1) % n]
    const v1x = p[0] - a[0], v1y = p[1] - a[1], v2x = b[0] - p[0], v2y = b[1] - p[1]
    const l1 = Math.hypot(v1x, v1y) || 1, l2 = Math.hypot(v2x, v2y) || 1
    const ang = Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2))))
    if (ang > thr) out.push({ p, turnDeg: (ang * 180) / Math.PI })
  }
  return out
}

/**
 * Fit a raw traced ring (mask px, y-up) into the vector truth: fair → ONE Schneider fit, with
 * CORNER INTEGRITY — sharp features detected on the raw structure are restored to their exact
 * positions and pinned as TRUE corner anchors; the fairing smooths everything else (Dan: sharp
 * corners are design intent; smoothing repeats the silhouette, it never erases corners).
 * Used at Magic GENERATION (truth at birth, §B1) and by the editor's Tune re-fit — the same
 * function, so generation and editor produce identical geometry for identical inputs.
 * Returns null when the trace is too sparse to be a shape (caller fails loud — no silent door).
 */
export interface VectoriseOpts {
  /** mm-true pair-collapse floor in content px (MIN_ANCHOR_SEPARATION_MM / mmPerPx) — two anchors
   *  closer than this collapse to one when fidelity allows (finger-distinct targets). */
  minAnchorSepPx?: number
  /** Crop-corner default (KAI-8982 D1): ~90° corners ON the image frame edge get this radius
   *  automatically (uniform — "same radii as a default for all 90 degree corners", Dan 06-07).
   *  Requires maskWidthPx for the frame test. Omit = no default rounding (sharp fit). */
  defaultCornerRadiusPx?: number
  maskWidthPx?: number
}

export function vectoriseTrace(rawMaskPx: ReadonlyArray<Pt>, maskHeightPx: number, fairing: FairTracedRingOpts, opts?: VectoriseOpts): VShape | null {
  // KAI-9009: a noisy mask can fair into a SELF-CROSSING sliver (Dan's crack/spike — a V-notch
  // whose walls cross; the pair floor can't catch it because the crossing spans wider than the
  // floor). The fit must be watertight: validate the flatten and, on a crossing, re-derive with
  // escalated smoothing (trace-noise slivers die under a larger σ). Bounded; loud on exhaustion.
  for (let attempt = 0; attempt < 3; attempt++) {
    const params = attempt === 0 ? fairing : { ...fairing, smoothPx: (fairing.smoothPx ?? 6) * (1 + attempt * 0.6) }
    const v = vectoriseTraceOnce(rawMaskPx, maskHeightPx, params, opts)
    if (!v) return null
    const flat = flattenShape(v, 0.75)[0]?.map((pt) => [pt.x, pt.y] as Vec2Px) ?? []
    if (flat.length < 3 || validateSelfIntersection(flat, 'fit').length === 0) return v
    if (attempt === 2) {
      console.error('[geometry-truth] vectoriseTrace: self-intersecting fit survived smoothing escalation — returning last attempt')
      return v
    }
  }
  return null
}

function vectoriseTraceOnce(rawMaskPx: ReadonlyArray<Pt>, maskHeightPx: number, fairing: FairTracedRingOpts, opts?: VectoriseOpts): VShape | null {
  if (rawMaskPx.length < MIN_RAW_TRACE_POINTS) return null
  const yDown = rawMaskPx.map(([x, y]) => [x, maskHeightPx - y] as Vec2Px)
  const corners = rawCornerPositions(yDown)
  // KAI-9009: kill sliver loops (needle notches whose walls cross) BEFORE the fit — the
  // existing simple-polygon repair drops the crossing vertices deterministically.
  const faired = repairSimplePolygon(fairTracedRing(yDown, fairing), 1)
  if (faired.length < 3) return null
  // pin each raw corner: snap the nearest faired point BACK to the exact sharp vertex and mark
  // its index as a corner for the fit (independent handles meet at the true point)
  const ring = faired.map(([x, y]) => ({ x, y }))
  const cornerIdx: number[] = []
  const cropIdx: number[] = [] // ~90° corners ON the frame edge — the crop-artifact class
  const W = opts?.maskWidthPx ?? 0
  const onFrame = (x: number, y: number) =>
    W > 0 && (x <= CROP_EDGE_EPSILON_PX || y <= CROP_EDGE_EPSILON_PX || x >= W - CROP_EDGE_EPSILON_PX || y >= maskHeightPx - CROP_EDGE_EPSILON_PX)
  for (const { p: [cx, cy], turnDeg } of corners) {
    let best = -1, bd = Infinity
    for (let i = 0; i < ring.length; i++) {
      const d = (ring[i].x - cx) ** 2 + (ring[i].y - cy) ** 2
      if (d < bd) { bd = d; best = i }
    }
    // KAI-9009: pin only when the faired ring still REPRESENTS the corner (a repaired-away
    // sliver tip must not be snapped back in as a spike)
    if (best >= 0 && bd <= CORNER_PIN_MAX_SNAP_PX ** 2 && !cornerIdx.some((j) => Math.hypot(ring[j].x - cx, ring[j].y - cy) < CORNER_MIN_SEPARATION_PX)) {
      ring[best] = { x: cx, y: cy }
      cornerIdx.push(best)
      if (turnDeg >= CROP_TURN_MIN_DEG && turnDeg <= CROP_TURN_MAX_DEG && onFrame(cx, cy)) cropIdx.push(best)
    }
  }
  cornerIdx.sort((a, b) => a - b)
  const path = ringToVPath(ring, FIT_CORNER_ANGLE_DEG, FIT_MAX_ERROR_PX, cornerIdx.length ? cornerIdx : undefined, FIT_COMPACT_ERROR_PX, opts?.minAnchorSepPx)
  // pass 2's auto-adjustment (KAI-8982 D1): crop-class corners get the uniform default radius;
  // interior sharp corners stay TRUE corner anchors. The SHARP fit stays derivable (omit opts).
  const r = opts?.defaultCornerRadiusPx ?? 0
  if (r > 0 && cropIdx.length) {
    const cropPts = cropIdx.map((i) => ring[i])
    const isCrop = (ai: number) => {
      const a = path.anchors[ai]
      return a.corner && cropPts.some((cp) => Math.hypot(a.p.x - cp.x, a.p.y - cp.y) < CORNER_MIN_SEPARATION_PX)
    }
    return { paths: [filletPathSmart(path, r, isCrop)] }
  }
  return { paths: [path] }
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
