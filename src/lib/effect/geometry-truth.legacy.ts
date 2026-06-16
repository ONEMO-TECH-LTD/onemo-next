// geometry-truth.legacy.ts — LEGACY / TEST-ONLY: the retired v3 trace→vector FIT.
//
// `vectoriseTrace` is the old fair + Schneider-fit pipeline (fairing → corner-pin → bezier fit) that
// the v3 build used to turn a raw mask trace into curved vector anchors. The ACTIVE v4 pipeline does
// NOT use it: Magic/upload birth a RAW marching-squares straight `OutlineSource` (prepare-effect.ts),
// and the editor's `resolve(source, adjustments)` (outline-resolve.ts) owns all shaping. This code is
// kept ONLY so its regression/watertightness tests still run; it is not imported by any app/editor
// surface (R4 — quarantined out of geometry-truth so the active pipeline surface can't import it as
// authority). Do NOT wire it back into the product; the kernel direction is Paper.js/Clipper2 (DEC-v5-02).
//
// Spaces: vector shapes live in MASK-PX, Y-DOWN; raw traces arrive in mask-px Y-UP — vectoriseTrace
// owns the flip.

import { fairTracedRing, rdpClosed, validateSelfIntersection, repairSimplePolygon, type FairTracedRingOpts, type Vec2Px } from '@/lib/outline-core/math'
import { flattenShape, ringToVPath, type VShape } from '@/lib/vector-core'
import { roundCornersPaper } from '@/lib/vector-core/paper-kernel' // L6: one fillet engine (Paper) even in legacy
import type { Pt } from './types'

// Trace→vector fit parameters — the ONE fit every trace went through (generation AND editor re-Tune).
const FIT_CORNER_ANGLE_DEG = 30
const FIT_MAX_ERROR_PX = 0.35
// HARD CRACK RULE (restored from v1/v2 contour.ts): no corner may stay sharper than this INTERIOR
// angle. Tuned LOW so it removes only artifact spikes/V-notches while legitimate sharp corners survive.
const CRACK_MIN_ANGLE_DEG = 26
// Anchor-compaction budget (KAI-8974/F3b): up to 2x the fit tolerance to remove redundant anchors.
const FIT_COMPACT_ERROR_PX = FIT_MAX_ERROR_PX * 2
const MIN_RAW_TRACE_POINTS = 24
const CORNER_PIN_MAX_SNAP_PX = 8 // KAI-9009: a raw corner farther than this from the faired ring no longer exists
// CORNER INTEGRITY (Dan, 2026-06-11): intentional sharp features survive as TRUE corner anchors.
const CORNER_TURN_DEG = 55
const CORNER_RDP_EPSILON_PX = 2.5
const CORNER_MIN_SEPARATION_PX = 6
// CROP-CORNER DEFAULT (Dan 2026-06-07, KAI-8982 D1): a ~90° corner ON the image frame edge is a crop
// artifact and gets the default radius; interior sharp corners are design intent and stay sharp.
const CROP_TURN_MIN_DEG = 70
const CROP_TURN_MAX_DEG = 110
const CROP_EDGE_EPSILON_PX = 6

/**
 * Cut any corner whose interior angle is below `minAngleDeg` (a spike/crack), iterated so even very
 * acute notches are tamed; gentle corners pass through untouched. Ported from v1/v2's clampSharpCorners.
 */
function clampSharpCorners(pts: Vec2Px[], minAngleDeg: number, cut = 0.4, iterations = 8): Vec2Px[] {
  if (minAngleDeg <= 0) return pts
  const minCos = Math.cos((minAngleDeg * Math.PI) / 180) // interior angle < threshold ⇔ cos > minCos
  let p = pts
  for (let it = 0; it < iterations; it++) {
    const n = p.length
    if (n < 4) break
    const out: Vec2Px[] = []
    let changed = false
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n], v = p[i], b = p[(i + 1) % n]
      const v1x = a[0] - v[0], v1y = a[1] - v[1]
      const v2x = b[0] - v[0], v2y = b[1] - v[1]
      const l1 = Math.hypot(v1x, v1y) || 1, l2 = Math.hypot(v2x, v2y) || 1
      const cos = (v1x * v2x + v1y * v2y) / (l1 * l2) // +1 = acute spike, -1 = straight
      if (cos > minCos) { out.push([v[0] + cut * v1x, v[1] + cut * v1y]); out.push([v[0] + cut * v2x, v[1] + cut * v2y]); changed = true }
      else out.push(v)
    }
    p = out
    if (!changed) break
  }
  return p
}

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

export interface VectoriseOpts {
  /** mm-true pair-collapse floor in content px — two anchors closer than this collapse to one. */
  minAnchorSepPx?: number
  /** Crop-corner default (KAI-8982 D1): ~90° corners ON the image frame edge get this radius. */
  defaultCornerRadiusPx?: number
  maskWidthPx?: number
}

export function vectoriseTrace(rawMaskPx: ReadonlyArray<Pt>, maskHeightPx: number, fairing: FairTracedRingOpts, opts?: VectoriseOpts): VShape | null {
  // KAI-9009: a noisy mask can fair into a SELF-CROSSING sliver. The fit must be watertight: validate
  // the flatten and, on a crossing, re-derive with escalated smoothing. Bounded; loud on exhaustion.
  for (let attempt = 0; attempt < 3; attempt++) {
    const params = attempt === 0 ? fairing : { ...fairing, smoothPx: (fairing.smoothPx ?? 6) * (1 + attempt * 0.6) }
    const v = vectoriseTraceOnce(rawMaskPx, maskHeightPx, params, opts)
    if (!v) return null
    const flat = flattenShape(v, 0.75)[0]?.map((pt) => [pt.x, pt.y] as Vec2Px) ?? []
    if (flat.length < 3 || validateSelfIntersection(flat, 'fit').length === 0) return v
    if (attempt === 2) {
      const repaired = repairSimplePolygon(flat, 1)
      if (repaired.length >= 3) {
        const path = ringToVPath(repaired.map(([x, y]) => ({ x, y })), FIT_CORNER_ANGLE_DEG, FIT_MAX_ERROR_PX, undefined, FIT_COMPACT_ERROR_PX, opts?.minAnchorSepPx)
        const v2: VShape = { paths: [path] }
        const flat2 = flattenShape(v2, 0.75)[0]?.map((pt) => [pt.x, pt.y] as Vec2Px) ?? []
        if (flat2.length >= 3 && validateSelfIntersection(flat2, 'fit').length === 0) return v2
      }
      console.error('[geometry-truth.legacy] vectoriseTrace: self-intersecting fit survived repair — returning last attempt')
      return v
    }
  }
  return null
}

function vectoriseTraceOnce(rawMaskPx: ReadonlyArray<Pt>, maskHeightPx: number, fairing: FairTracedRingOpts, opts?: VectoriseOpts): VShape | null {
  if (rawMaskPx.length < MIN_RAW_TRACE_POINTS) return null
  const yDown = rawMaskPx.map(([x, y]) => [x, maskHeightPx - y] as Vec2Px)
  const corners = rawCornerPositions(yDown)
  const fairedRaw = fairTracedRing(yDown, fairing)
  const faired = clampSharpCorners(repairSimplePolygon(fairedRaw, 1), CRACK_MIN_ANGLE_DEG)
  if (faired.length < 3) return null
  const kept = new Set(faired.map(([x, y]) => `${x},${y}`))
  const removedPts = fairedRaw.filter(([x, y]) => !kept.has(`${x},${y}`))
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
    const onRemovedSliver = removedPts.some(([rx, ry]) => Math.hypot(rx - cx, ry - cy) < CORNER_PIN_MAX_SNAP_PX)
    if (best >= 0 && !onRemovedSliver && !cornerIdx.some((j) => Math.hypot(ring[j].x - cx, ring[j].y - cy) < CORNER_MIN_SEPARATION_PX)) {
      ring[best] = { x: cx, y: cy }
      cornerIdx.push(best)
      if (turnDeg >= CROP_TURN_MIN_DEG && turnDeg <= CROP_TURN_MAX_DEG && onFrame(cx, cy)) cropIdx.push(best)
    }
  }
  cornerIdx.sort((a, b) => a - b)
  const path = ringToVPath(ring, FIT_CORNER_ANGLE_DEG, FIT_MAX_ERROR_PX, cornerIdx.length ? cornerIdx : undefined, FIT_COMPACT_ERROR_PX, opts?.minAnchorSepPx)
  const r = opts?.defaultCornerRadiusPx ?? 0
  if (r > 0 && cropIdx.length) {
    const cropPts = cropIdx.map((i) => ring[i])
    const isCrop = (ai: number) => {
      const a = path.anchors[ai]
      return a.corner && cropPts.some((cp) => Math.hypot(a.p.x - cp.x, a.p.y - cp.y) < CORNER_MIN_SEPARATION_PX)
    }
    return { paths: [roundCornersPaper(path, r, isCrop)] }
  }
  return { paths: [path] }
}
