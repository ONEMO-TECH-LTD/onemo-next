// outline-resolve.ts — Creator v5 editor geometry engine (blueprint v5-foundation.md §4, DEC-v5-03).
//
// ONE impartial, non-destructive engine: `resolve(source, adjustments) → VShape`, IDENTICAL for every
// vector class (generated trace, stock library, upload, drawn). The producer's only job is to make an
// `OutlineSource` (immutable SHARP-corner vector + stable per-anchor ids); the editor never branches on
// class. All shaping is a reversible adjustment on top of the sharp source (invariant 9).
//
// Contract:
//   • ALL-OFF  === the exact source (object identity preserved — no flatten/refit, no copy).
//   • Global tools (detail / smooth / straighten) — each is its LIBRARY op applied DIRECTLY to the
//     model's anchors (DEC-v5-03: no flatten-into-a-dense-ring-and-refit wrapper). A clean geometric
//     input stays clean (a square keeps its 4-fold symmetry through every tool). Independent axes.
//   • Local tools (radius/curve) act on CLAIMED anchors keyed by stable id (VD9), PINNED through the
//     global pass (VD2 — global reshapes only unclaimed geometry; a claimed anchor always survives).
//   • Pinning is USER-CLAIMED ONLY (an anchor with a radius/curve), never auto-detected.
//   • A FOLD GUARD lives INSIDE resolve(): every op output is validated; on a self-cross it keeps the
//     prior valid path. The resolver never emits a folded/cracked shape.
//
// The geometry MATH is the vetted libraries, wired direct (invariant 2 — one op each, no wrapper):
//   • Paper.js (headless) kernel — round (Radius), smooth (Smooth), simplify (Detail).
//   • Clipper2 kernel — straighten (Straighten: RDP/TrimCollinear).
//   • Curve is the one in-house op (native bézier tangent-handle math — no library "bend-by-amount").

import { validateSelfIntersection, type Vec2Px } from '@/lib/outline-core/math'
import { flattenPath, scaleAnchorTension, type VShape, type VPath } from '@/lib/vector-core'
// The geometry kernels, imported directly (not via the vector-core barrel) so Paper/Clipper stay in the
// create bundle only, never the v1/v2/shaped bundles.
import { roundCornersPaper, smoothPaper, simplifyPaper } from '@/lib/vector-core/paper-kernel'
import { straightenPath } from '@/lib/vector-core/clipper-kernel'
import type { Pt } from './types'

export type OutlineClass = 'generated' | 'stock' | 'upload' | 'drawn'

/** Immutable SHARP-corner vector + stable per-anchor ids (VD9). The ONE abstraction for every class. */
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
  detail: number     // 0..100; 100 = full detail (OFF) — Paper simplify tolerance
  smooth: number     // 0..100; 0 = OFF — Paper catmull-rom handle factor
  straighten: number // 0..100; 0 = OFF — Clipper2 RDP collinear-collapse strength
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

export const GLOBAL_OFF: GlobalAdjustments = { detail: 100, smooth: 0, straighten: 0 }
export const ADJUSTMENTS_OFF: OutlineAdjustments = { global: { ...GLOBAL_OFF }, local: {} }

// ── pct → engine-unit maps (the editor sliders write 0..100; OFF maps to a true no-op) ──────────
/** Straighten: Clipper2 RDP epsilon (px) — how far a near-collinear run may deviate and still collapse
 *  to one straight edge. 0% = OFF; 100% = the max below. Real corners deviate far more and are kept.
 *  STRAIGHTEN_MAX_EPS_PX is a tuning constant (the auto-tune default values are Dan-tuned). */
const STRAIGHTEN_MAX_EPS_PX = 8
export const straightenEpsPx = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * STRAIGHTEN_MAX_EPS_PX
/** Smooth: Paper catmull-rom handle factor. 0% = OFF (no handles introduced); 100% = max round.
 *  Scale-invariant (catmull tension is relative to anchor spacing), applied directly to the anchors. */
export const smoothFactor = (pct: number) => Math.max(0, Math.min(1, pct / 100))
/** Detail: Paper SIMPLIFY tolerance (px) = anchor density. 100% = most detail (tight 0.75px fit → most
 *  anchors), 0% = simplest (≈8.75px → fewest). Applied directly to the anchors; never a dense chain. */
export const detailTolPx = (pct: number) => 0.75 + (1 - Math.max(0, Math.min(100, pct)) / 100) * 8

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
  return g.detail >= 100 && g.smooth <= 0 && g.straighten <= 0
}
/** ids whose local adjustment is actually engaged (radius > 0 or curve ≠ 0). */
function claimedIds(local: Record<string, LocalAdjustment>): Set<string> {
  const s = new Set<string>()
  for (const [id, l] of Object.entries(local)) if (l && ((l.radius ?? 0) > 0 || (l.curve ?? 0) !== 0)) s.add(id)
  return s
}

// ── curve (anchor bend) — the one in-house op: native bézier tangent-handle math (no library op) ──
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

// ── fold-guard validation (flatten ONLY to check self-intersection — not a processing wrapper) ──
const VALIDATE_FLATTEN_TOL = 0.75 // px — dense enough to detect a real self-cross
const pathToRing = (vp: VPath): Vec2Px[] => flattenPath(vp, VALIDATE_FLATTEN_TOL).map((p) => [p.x, p.y] as Vec2Px)
const ringFinite = (r: Vec2Px[]) => r.length >= 4 && r.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
const ringSimple = (r: Vec2Px[]) => ringFinite(r) && validateSelfIntersection(r, 'resolve').length === 0

/** Detail (Paper simplify) only has work where the path holds REDUNDANT near-collinear vertices — a
 *  real corner is structural and must survive. A clean sparse polygon (square, star, circle) has no
 *  redundant vertices, so Detail is a NO-OP on it (Paper's curve-fit would otherwise round + drop the
 *  seam corner — uneven). A dense trace has many, so Detail reduces it. (Perpendicular distance of each
 *  vertex from its neighbour chord — the RDP collinearity test — keeps this a guard, not a reshape.) */
function hasRedundantVertices(path: VPath, tolPx: number): boolean {
  const a = path.anchors, n = a.length
  if (n < 4) return false
  for (let i = 0; i < n; i++) {
    if (a[i].hIn || a[i].hOut) continue // a curved anchor is structural, not redundant
    const prev = a[(i - 1 + n) % n].p, cur = a[i].p, next = a[(i + 1) % n].p
    const dx = next.x - prev.x, dy = next.y - prev.y, L = Math.hypot(dx, dy) || 1e-9
    if (Math.abs((cur.x - prev.x) * dy - (cur.y - prev.y) * dx) / L < tolPx) return true // near-collinear
  }
  return false
}

// ── global pass ────────────────────────────────────────────────────────────────────────────
/** Global pass: each global tool is its LIBRARY op applied DIRECTLY to the path's own anchors (no
 *  flatten-and-refit). Order: straighten (collapse near-collinear) → detail (anchor density) → smooth
 *  (handle roundness). Each stage is fold-guarded (a self-crossing result is dropped, keeping the prior
 *  valid path). Then claimed anchors are pinned back — the nearest output anchor is snapped to the exact
 *  source position and re-keyed by id — so a radius/curve point survives the global reshape (VD2). */
function globalPass(source: OutlineSource, g: GlobalAdjustments, claimed: Set<string>): VShape {
  const paths = source.shape.paths.map((path) => {
    if (path.anchors.length < 3) return path // too small to reshape — pass through unchanged
    let p: VPath = path
    const guard = (next: VPath): VPath => (ringSimple(pathToRing(next)) ? next : p)
    // 1. STRAIGHTEN — Clipper2 RDP/TrimCollinear: collapse near-collinear runs to true straight edges.
    if (g.straighten > 0) p = guard(straightenPath(p, straightenEpsPx(g.straighten)))
    // 2. DETAIL — Paper simplify: anchor density (100 = most detail, skipped as OFF). Runs only where
    //    there are redundant near-collinear vertices to remove (dense traces); a no-op on a clean sparse
    //    polygon (so a square keeps its corners — never an uneven curve-fit drop). Sparse, never dense.
    if (g.detail < 100 && hasRedundantVertices(p, detailTolPx(g.detail))) p = guard(simplifyPaper(p, detailTolPx(g.detail)))
    // 3. SMOOTH — Paper catmull-rom: handle roundness on the (sparse) anchors. Back off on a fold.
    if (g.smooth > 0) {
      let factor = smoothFactor(g.smooth)
      let sm = smoothPaper(p, factor)
      let n = 0
      while (!ringSimple(pathToRing(sm)) && n++ < 12 && factor > 0.04) { factor *= 0.7; sm = smoothPaper(p, factor) }
      if (ringSimple(pathToRing(sm))) p = sm
    }
    // PIN claimed source anchors back (fresh anchors array — never mutate the source path).
    const out = p.anchors.map((a) => ({ ...a }))
    for (const a of path.anchors) {
      if (!a.id || !claimed.has(a.id)) continue
      let bi = -1, bd = Infinity
      for (let i = 0; i < out.length; i++) {
        const d = (out[i].p.x - a.p.x) ** 2 + (out[i].p.y - a.p.y) ** 2
        if (d < bd) { bd = d; bi = i }
      }
      if (bi >= 0) out[bi] = { p: { x: a.p.x, y: a.p.y }, hIn: null, hOut: null, corner: true, id: a.id }
    }
    return { anchors: out }
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
      // FOLD GUARD: every local op is validated; a bend/round that makes the ring self-cross is
      // DROPPED (keep the prior valid path) — so a local tool can never emit a folded/cracked outline.
      const simple = (vp: VPath) => ringSimple(pathToRing(vp))
      // curve pass (count-stable)
      for (const [id, l] of Object.entries(local)) {
        if (!l || (l.curve ?? 0) === 0) continue
        const idx = p.anchors.findIndex((a) => a.id === id)
        if (idx >= 0) { const next = bendAnchorPath(p, idx, l.curve!); if (simple(next)) p = next }
      }
      // radius pass (re-find by id; fillet consumes the corner)
      for (const [id, l] of Object.entries(local)) {
        if (!l || (l.radius ?? 0) <= 0) continue
        const idx = p.anchors.findIndex((a) => a.id === id && a.corner)
        if (idx >= 0) { const next = roundCornersPaper(p, l.radius!, (ai) => ai === idx); if (simple(next)) p = next } // true-arc, symmetric
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
  // 2. global pass (library-direct on unclaimed geometry, pin claimed anchors) — or the source if global off
  const working = globalOff ? source.shape : globalPass(source, adj.global, claimed)
  // 3. local pass (radius/curve at claimed ids)
  return claimed.size ? localPass(working, adj.local) : working
}
