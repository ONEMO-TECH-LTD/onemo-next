// outline-resolve.ts — V4 editor geometry engine (blueprint v4-foundation.md §2–§4).
//
// ONE impartial, non-destructive engine: `resolve(source, adjustments) → VShape`, IDENTICAL for every
// vector class (generated trace, stock library, upload, drawn). The producer's only job is to make an
// `OutlineSource` (immutable vector + stable per-anchor ids); the editor never branches on class.
//
// Contract:
//   • ALL-OFF  === the exact source (no flatten/refit — stock beziers stay byte-exact).
//   • Global tools (detail/smooth/snap/angle/line) fair the source's flattened polyline — INDEPENDENT
//     axes (the V3 Detail↔Smooth `smoothPx` coupling that made one dial move the other is gone).
//   • Local tools (radius/curve) act on CLAIMED anchors keyed by stable id (VD9), PINNED through the
//     global pass (VD2 — global reshapes only unclaimed geometry; a claimed anchor always survives).
//   • Pinning is USER-CLAIMED ONLY (an anchor with a radius/curve), never auto-angle-detected — that is
//     the structural break from the old corner-pin that re-sharpened noise notches into cracks.
//   • A FOLD GUARD lives INSIDE resolve() (VD12): every global output is validated; on a self-cross it
//     fails closed (backs smooth/detail off, else returns the last valid ring). The resolver never emits
//     a folded/cracked shape — the old "fair first, repair later" pattern is banned.
//
// Reuses outline-core pure math (fairTracedRing/rdpClosed/validateSelfIntersection/repairSimplePolygon)
// and vector-core ops (flattenPath/filletPathSmart/scaleAnchorTension); does NOT revive OutlineDocument.

import {
  fairTracedRing,
  rdpClosed,
  validateSelfIntersection,
  repairSimplePolygon,
  type FairTracedRingOpts,
  type Vec2Px,
} from '@/lib/outline-core'
import { flattenPath, filletPathSmart, scaleAnchorTension, type VShape, type VPath, type VAnchor } from '@/lib/vector-core'
import type { Pt } from './types'

export type OutlineClass = 'generated' | 'stock' | 'upload' | 'drawn'

/** Immutable vector + stable per-anchor ids (VD9). The ONE abstraction for every class. */
export interface OutlineSource {
  /** the immutable source vector — anchors carry stable `id`s (mintIds). */
  shape: VShape
  klass: OutlineClass
  mmPerPx: number
  maskHeightPx: number
  /** raw marching-squares trace — PROVENANCE/debug only (VD3), never a resolution path. */
  rawTracePx?: Pt[]
}

/** Global tools — independent 0..100 axes. OFF = `GLOBAL_OFF` below. */
export interface GlobalAdjustments {
  detail: number // 0..100; 100 = full detail (OFF) — RDP density on the faired polyline
  smooth: number // 0..100; 0 = OFF — Gaussian σ
  snap: number   // 0..100; 0 = OFF — straight-run truing band
  angle: number  // 0..100; 0 = OFF (=180°, no corner cut) — spike/crack cap
  line: number   // 0..100; min straight-run length (pairs with snap)
}
export interface LocalAdjustment {
  /** per-anchor fillet radius in source px; 0 = sharp (OFF) */
  radius?: number
  /** per-anchor bend factor; 0 = straight (OFF), ~1 = gentle, ~2 = strong */
  curve?: number
}
export interface OutlineAdjustments {
  global: GlobalAdjustments
  /** keyed by VAnchor.id (VD9) — only anchors the user actively shaped appear here */
  local: Record<string, LocalAdjustment>
}

export const GLOBAL_OFF: GlobalAdjustments = { detail: 100, smooth: 0, snap: 0, angle: 0, line: 0 }
export const ADJUSTMENTS_OFF: OutlineAdjustments = { global: { ...GLOBAL_OFF }, local: {} }

// ── pct → engine-unit maps (the editor sliders write 0..100; OFF maps to a true no-op) ──────────
/** Smooth: 0% = σ0 (no smoothing), 100% = σ24px. */
export const smoothSigmaPx = (pct: number) => (pct <= 0 ? 0 : (pct / 100) * 24)
/** Snap: 0% = band 0 (off), 100% = 20px line-snap band. */
export const snapBandPx = (pct: number) => (pct <= 0 ? 0 : (pct / 100) * 20)
/** Angle: 0% = 180° (no cut, OFF), 100% = 30° (aggressive spike cut). */
export const angleMaxTurnDeg = (pct: number) => (pct <= 0 ? 180 : 180 - (pct / 100) * 150)
/** Line: 0% = 0px, 100% = 80px minimum straight-run length. */
export const lineMinPx = (pct: number) => (pct / 100) * 80
/** Detail: 100% = full detail (eps 0, OFF), 0% = simplest (eps 8px). */
export const detailEpsPx = (pct: number) => Math.max(0, (1 - Math.max(0, Math.min(100, pct)) / 100) * 8)

// ── id minting + lookup ─────────────────────────────────────────────────────────────────────
let _idSeq = 0
/** Mint FRESH stable ids for every anchor — used by producers (new source) and re-baseline (manual
 *  edits bake the resolved shape into a new immutable source). Session-scoped uniqueness is enough:
 *  persistence stores the resolved contour, not ids (VD5). */
export function mintIds(shape: VShape): VShape {
  return { paths: shape.paths.map((p) => ({ anchors: p.anchors.map((a) => ({ ...a, id: `a${_idSeq++}` })) })) }
}

// ── off-state predicates ─────────────────────────────────────────────────────────────────────
function isGlobalOff(g: GlobalAdjustments): boolean {
  return g.detail >= 100 && g.smooth <= 0 && g.snap <= 0 && g.angle <= 0 && g.line <= 0
}
/** ids whose local adjustment is actually engaged (radius > 0 or curve ≠ 0). */
function claimedIds(local: Record<string, LocalAdjustment>): Set<string> {
  const s = new Set<string>()
  for (const [id, l] of Object.entries(local)) if (l && ((l.radius ?? 0) > 0 || (l.curve ?? 0) !== 0)) s.add(id)
  return s
}

// ── curve (anchor bend) — the pure port of the editor's bendAnchorPath ─────────────────────────
/** Bend the selected anchor: a straight corner gets synthesized symmetric tangent handles (from the
 *  neighbour chord) scaled by `factor`; an already-curved anchor just re-tensions its handles. Keeps id. */
function bendAnchorPath(path: VPath, idx: number, factor: number): VPath {
  const a = path.anchors[idx]
  if (!a) return path
  if (a.hIn || a.hOut) return scaleAnchorTension(path, idx, factor)
  const anchors = path.anchors.map((x) => ({ ...x }))
  const n = anchors.length
  const prev = anchors[(idx - 1 + n) % n].p
  const next = anchors[(idx + 1) % n].p
  const dx = next.x - prev.x, dy = next.y - prev.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len
  const eMin = Math.min(Math.hypot(a.p.x - prev.x, a.p.y - prev.y), Math.hypot(next.x - a.p.x, next.y - a.p.y))
  const base = 0.33 * eMin * Math.max(0, factor)
  anchors[idx] = { ...a, corner: false, hIn: { x: a.p.x - ux * base, y: a.p.y - uy * base }, hOut: { x: a.p.x + ux * base, y: a.p.y + uy * base } }
  return { anchors }
}

// ── global pass ────────────────────────────────────────────────────────────────────────────
const FAIR_FLATTEN_TOL = 0.75 // px — dense enough that the fairing sees the true silhouette
const FAIR_SPACING = 1.5

function fairOpts(g: GlobalAdjustments): FairTracedRingOpts {
  return {
    spacingPx: FAIR_SPACING,
    smoothPx: smoothSigmaPx(g.smooth),
    detailPx: snapBandPx(g.snap),
    maxTurnDeg: angleMaxTurnDeg(g.angle),
    minLinePx: lineMinPx(g.line),
  }
}

/** Fair one ring with fold-guard backoff (VD12): if the faired+RDP'd ring self-intersects, reduce
 *  smooth toward off until it's valid; if it still folds with smooth off, return the repaired ring;
 *  the resolver NEVER returns a self-crossing ring. */
function fairWithGuard(ring: Vec2Px[], g: GlobalAdjustments): Vec2Px[] {
  const eps = detailEpsPx(g.detail)
  const finish = (opts: FairTracedRingOpts) => {
    let f = fairTracedRing(ring, opts)
    if (eps > 0) f = rdpClosed(f, eps)
    return f
  }
  let opts = fairOpts(g)
  let out = finish(opts)
  if (out.length < 4 || validateSelfIntersection(out, 'resolve').length === 0) return out
  let last = out, guard = 0
  while (guard++ < 12 && (opts.smoothPx ?? 0) > 0.5) {
    opts = { ...opts, smoothPx: Math.max(0, (opts.smoothPx ?? 0) * 0.7) }
    out = finish(opts)
    if (out.length >= 4 && validateSelfIntersection(out, 'resolve').length === 0) return out
    last = out
  }
  const repaired = repairSimplePolygon(last, 1)
  return repaired.length >= 4 ? repaired : last
}

/** Global pass: fair every path's flattened polyline; pin claimed anchors back as identified anchors
 *  so the local pass can find them. Output is a STRAIGHT-anchor VShape (corner:true, no handles) — the
 *  raw-marching-squares model, just faired/detailed; local radius/curve add the only curves. */
function globalPass(source: OutlineSource, g: GlobalAdjustments, claimed: Set<string>): VShape {
  const paths = source.shape.paths.map((path) => {
    const ring = flattenPath(path, FAIR_FLATTEN_TOL).map((p) => [p.x, p.y] as Vec2Px)
    if (ring.length < 4) return path // too small to fair — pass through unchanged
    const faired = fairWithGuard(ring, g)
    const anchors: VAnchor[] = faired.map(([x, y]) => ({ p: { x, y }, hIn: null, hOut: null, corner: true }))
    // PIN each claimed source anchor: snap the nearest faired anchor back to its exact source
    // position and re-attach its id, so global reshaping leaves the claimed point fixed (VD2).
    for (const a of path.anchors) {
      if (!a.id || !claimed.has(a.id)) continue
      let bi = -1, bd = Infinity
      for (let i = 0; i < anchors.length; i++) {
        const d = (anchors[i].p.x - a.p.x) ** 2 + (anchors[i].p.y - a.p.y) ** 2
        if (d < bd) { bd = d; bi = i }
      }
      if (bi >= 0) anchors[bi] = { p: { x: a.p.x, y: a.p.y }, hIn: null, hOut: null, corner: true, id: a.id }
    }
    return { anchors }
  })
  return { paths }
}

// ── local pass ─────────────────────────────────────────────────────────────────────────────
/** Apply per-anchor curve then radius at claimed anchors, found by stable id. Curve (bend) runs first
 *  for every claimed anchor (index-stable), then radius fillets (re-found by id each time, since a
 *  fillet changes the anchor count). Curve sets corner:false, so radius+curve on the SAME anchor =
 *  curve wins (a bent anchor is no longer a fillet-eligible corner) — they are alternatives per anchor. */
function localPass(shape: VShape, local: Record<string, LocalAdjustment>): VShape {
  return {
    paths: shape.paths.map((path) => {
      let p = path
      // curve pass (count-stable)
      for (const [id, l] of Object.entries(local)) {
        if (!l || (l.curve ?? 0) === 0) continue
        const idx = p.anchors.findIndex((a) => a.id === id)
        if (idx >= 0) p = bendAnchorPath(p, idx, l.curve!)
      }
      // radius pass (re-find by id; fillet consumes the corner)
      for (const [id, l] of Object.entries(local)) {
        if (!l || (l.radius ?? 0) <= 0) continue
        const idx = p.anchors.findIndex((a) => a.id === id && a.corner)
        if (idx >= 0) p = filletPathSmart(p, l.radius!, (ai) => ai === idx)
      }
      return p
    }),
  }
}

// ── the one pure resolve ──────────────────────────────────────────────────────────────────
/**
 * resolve(source, adjustments) → display/cut VShape. Pure + deterministic. ALL-OFF returns the source
 * verbatim (object identity preserved for the byte-exact guarantee). The mm contour is derived from
 * the result by the existing `contourFromShape` (geometry-truth) — this engine owns shape, not units.
 */
export function resolve(source: OutlineSource, adj: OutlineAdjustments): VShape {
  const globalOff = isGlobalOff(adj.global)
  const claimed = claimedIds(adj.local)
  // 1. ALL-OFF → exact source (no flatten/refit)
  if (globalOff && claimed.size === 0) return source.shape
  // 2. global pass (fair unclaimed geometry, pin claimed anchors) — or the source if global is off
  const working = globalOff ? source.shape : globalPass(source, adj.global, claimed)
  // 3. local pass (radius/curve at claimed ids)
  return claimed.size ? localPass(working, adj.local) : working
}
