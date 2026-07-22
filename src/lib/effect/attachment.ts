// ⚠ DORMANT CONTRACT (Creator v5 · R6) — pure + unit-tested, but NOT wired into the active /create
// flow: validateAttachment has no product caller yet. The attachment system becomes first-class in
// /create in Phase 2 (attachment system in the creator). Validator defaults below are INVENTED
// (coupon-pending) — keep out of product claims until physically confirmed. Foundation, not active
// product flow (audit §7).
//
// attachment.ts — §8.5b attachment validators (PURE mm computation; lean-spec §5.5 / §9a / §11-A9).
//
// The Phase-B attachment choice (magnet | velcro) is a CUSTOMER decision validated on the FINAL-physical-mm
// geometry (§11-A3: every attachment validator consumes final-physical-mm, never base-mm — the magnet grid
// is size-dependent). Magnet = a fixed 54mm-pitch grid (§9a) whose anchors must coincide with real material
// (footprint containment) so the magnets have something to grip; velcro = a full back panel (always valid).
// This is a 3D *visualization* of a 2D-mm *computation* — the math lives HERE, once (no forked attachment
// math, §5.5). On failure it returns locators so the UI shows the gap (§11-A9: never silently fix geometry).
//
// NOTE: the SSOT (7.1-effect-construction-reference) locks the PHYSICAL grammar (magnet methods A/B/C,
// velcro, receiver classes) + that a grid exists; the 54mm PITCH is the blueprint's number (§9a). No
// canonical validator ALGORITHM exists in the SSOT — the gates below (stability: ≥2 grip points; edge-gap:
// no silhouette vertex >1 pitch from an anchor) are designed per the blueprint requirements + tunable.
// TECH-DEBT (QA, tracked — physical-coupon confirmation, like the 1mm edge radius): (1) the grid is
// centered on the EFFECT bbox — i.e. "can this size grip a 54mm grid at BEST-CASE placement", NOT aligned
// to a fixed garment-grid origin (validating the actual placed-on-garment position is a later step).
// (2) MIN_MAGNET_ANCHORS + MAX_EDGE_GAP_MM are invented defaults, not gospel — coupon-confirm eventually.
//
// PURE: no three / no DOM. The 3D back-cap dot viz (ShapedModel, §8.5b sub-step 2) consumes `anchors`; the
// failure UI consumes `locators` + `issues`. `result_hash` rides in the ApprovedEffectPayload (§11).

import { contentHash, stableStringify } from '@/lib/outline-core/math'
import type { Contour, Pt } from './types'
import { pointInPolygon } from './polygon'

// Compatibility export for the dormant validator's existing tests/callers. New engines import the
// neutral polygon primitive directly and do not depend on this superseded 54mm attachment contract.
export { pointInPolygon } from './polygon'

export type AttachmentSystem = 'magnet' | 'velcro'

/** Fixed magnet receiving-grid pitch (blueprint §9a). The garment's 54mm grid the anchors must land on. */
export const MAGNET_GRID_PITCH_MM = 54
/** Stability gate: a single magnet lets the effect pivot/spin — need at least this many grip points. */
const MIN_MAGNET_ANCHORS = 2
/** Anti-flap gate: no silhouette vertex may sit further than one pitch from the nearest magnet anchor. */
const MAX_EDGE_GAP_MM = MAGNET_GRID_PITCH_MM

export interface AttachmentResult {
  system: AttachmentSystem
  ok: boolean
  anchors: Pt[]        // contained grid anchors in FINAL-physical-mm (magnet); [] for velcro (full panel)
  issues: string[]     // failure reasons (empty when ok)
  locators: Pt[]       // mm points the UI highlights — uncovered/flap-risk silhouette vertices (§11-A9)
  result_hash: string  // deterministic, float-free verdict hash (rides in the payload, §11)
}

function bbox(pts: ReadonlyArray<Pt>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Lay a `pitch`-spaced grid over the silhouette's bbox, CENTERED (so the layout is symmetric +
 * silhouette-adaptive: a bigger effect → more grid points), and keep only the anchors that fall INSIDE
 * the silhouette (footprint containment). Larger effects → more contained anchors (§9a size-dependent).
 */
function magnetAnchors(outer: ReadonlyArray<Pt>, pitch: number): Pt[] {
  const bb = bbox(outer)
  const w = bb.maxX - bb.minX
  const h = bb.maxY - bb.minY
  const nx = Math.max(1, Math.floor(w / pitch) + 1)
  const ny = Math.max(1, Math.floor(h / pitch) + 1)
  const x0 = bb.minX + (w - (nx - 1) * pitch) / 2 // center the grid on the bbox
  const y0 = bb.minY + (h - (ny - 1) * pitch) / 2
  const anchors: Pt[] = []
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a: Pt = [x0 + i * pitch, y0 + j * pitch]
      if (pointInPolygon(a, outer)) anchors.push(a)
    }
  }
  return anchors
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Float-free verdict hash (int-micron anchors + verdict) — consistent with the payload's no-floats rule. */
function resultHash(system: AttachmentSystem, ok: boolean, anchors: Pt[]): string {
  const anchors_um = anchors.map(([x, y]) => [Math.round(x * 1000), Math.round(y * 1000)] as [number, number])
  return contentHash(stableStringify({ system, ok, anchors_um }))
}

/**
 * Validate an attachment system on the FINAL-physical-mm geometry (§11-A3). MAGNET: a 54mm grid (§9a),
 * anchors kept inside the silhouette (footprint containment), gated by stability (≥MIN anchors) + a max
 * edge-to-anchor gap (no silhouette vertex further than one pitch from an anchor → no flap). VELCRO: a
 * full back panel, always valid. Returns the layout + a verdict + locators for the failure UI (§11-A9).
 * PURE — the caller (UI) gates approval on `ok` and visualizes `anchors`/`locators`; cuttability stays the
 * separate hard gate (assertCuttable). Pass FINAL-physical-mm (toFinalPhysicalMm at the chosen size).
 */
export function validateAttachment(finalGeometryMM: Contour, system: AttachmentSystem): AttachmentResult {
  const outer = finalGeometryMM.outer.pts

  if (system === 'velcro') {
    return { system, ok: true, anchors: [], issues: [], locators: [], result_hash: resultHash('velcro', true, []) }
  }

  // magnet
  const anchors = magnetAnchors(outer, MAGNET_GRID_PITCH_MM)
  const issues: string[] = []
  const locators: Pt[] = []

  if (anchors.length < MIN_MAGNET_ANCHORS) {
    issues.push(
      `too_few_anchors: ${anchors.length} magnet grip point(s) land inside the shape (need ≥${MIN_MAGNET_ANCHORS}); ` +
        `the effect is too small/thin to hold on the 54mm grid at this size`,
    )
  }

  // anti-flap: a silhouette vertex further than one pitch from every anchor would lift/flap
  if (anchors.length > 0) {
    for (const v of outer) {
      let nearest = Infinity
      for (const a of anchors) { const d = dist(v, a); if (d < nearest) nearest = d }
      if (nearest > MAX_EDGE_GAP_MM) locators.push(v)
    }
    if (locators.length > 0) {
      issues.push(
        `edge_too_far: ${locators.length} silhouette point(s) sit >${MAX_EDGE_GAP_MM}mm from the nearest magnet — those areas would lift/flap`,
      )
    }
  }

  const ok = issues.length === 0
  return { system: 'magnet', ok, anchors, issues, locators, result_hash: resultHash('magnet', ok, anchors) }
}
