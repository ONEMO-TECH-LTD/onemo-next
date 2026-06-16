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
  type Vec2Px,
} from '@/lib/outline-core/math'
import { flattenPath, scaleAnchorTension, type VShape, type VPath, type VAnchor } from '@/lib/vector-core'
// L1 (DEC-v5-02): Radius rounds via the Paper.js headless kernel (true constant-radius arc, symmetric
// on unequal legs) — imported directly (not via the vector-core barrel) so Paper stays in the create
// bundle only, never the v1/v2/shaped bundles.
import { roundCornersPaper } from '@/lib/vector-core/paper-kernel'
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
/** Smooth: σ SCALES with the shape's bbox diagonal, so it rounds visibly at ANY size — a fixed px
 *  rounded the duck's fine silhouette but barely touched a large star's points. 0% = σ0; 100% ≈ 8%
 *  of the diagonal. (The caller passes the flattened ring's diagonal.) */
export const smoothSigmaPx = (pct: number, diagPx: number) => (pct <= 0 ? 0 : (pct / 100) * Math.max(diagPx * 0.08, 24))
/** Snap: STRAIGHTEN strength — projects each point onto its local best-fit line (a direct op, not the
 *  fairing's fragile band-grow). 0% = off, 100% = full projection. Reliable + simple on any shape. */
export const snapStrength = (pct: number) => Math.max(0, Math.min(1, pct / 100))
/** Angle: max-turn cap (corner-round) — a DIRECT corner-cut on real corners, independent of the fairing.
 *  0% = 180° (off), 100% = 10° (rounds every sharp corner). */
export const angleMaxTurnDeg = (pct: number) => (pct <= 0 ? 180 : 180 - (pct / 100) * 170)
/** Line: Snap's straighten WINDOW (fraction of the ring) — longer = trues longer runs (pairs with Snap). */
export const lineWindowFrac = (pct: number) => 0.02 + (Math.max(0, Math.min(100, pct)) / 100) * 0.1
/** Detail: SIMPLIFY (RDP) on the smoothed ring — fewer points as detail lowers. 100% = full detail
 *  (eps 0, OFF — keep everything), 0% = simplest (eps 8px). Applied AFTER smooth so it thins the
 *  smoothed outline rather than introducing its own smoothing (independent axis). */
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

// ── corner-cut (the ANGLE tool) ──────────────────────────────────────────────────────────────
function turnDeg(prev: Vec2Px, p: Vec2Px, next: Vec2Px): number {
  const ax = p[0] - prev[0], ay = p[1] - prev[1], bx = next[0] - p[0], by = next[1] - p[1]
  const dot = ax * bx + ay * by, la = Math.hypot(ax, ay) || 1e-9, lb = Math.hypot(bx, by) || 1e-9
  return (Math.acos(Math.max(-1, Math.min(1, dot / (la * lb)))) * 180) / Math.PI
}
/** ANGLE: round every corner whose TURN exceeds maxTurnDeg, via iterated Chaikin corner-cutting on the
 *  ±1 neighbourhood. Runs on the SOURCE ring (real corners) BEFORE the fairing densifies — a dense ring
 *  has no per-vertex sharp turns to find, which is why Angle read as dead. Visible on ANY shape. */
function clampCorners(ring: Vec2Px[], maxTurnDeg: number): Vec2Px[] {
  if (maxTurnDeg >= 180) return ring
  let r = ring
  for (let it = 0; it < 10; it++) {
    const n = r.length
    if (n < 4) break
    const sharp = new Set<number>()
    for (let i = 0; i < n; i++) if (turnDeg(r[(i - 1 + n) % n], r[i], r[(i + 1) % n]) > maxTurnDeg) for (let k = -1; k <= 1; k++) sharp.add((i + k + n) % n)
    if (sharp.size === 0) break
    const out: Vec2Px[] = []
    for (let i = 0; i < n; i++) {
      if (!sharp.has(i)) { out.push(r[i]); continue }
      const a = r[(i - 1 + n) % n], p = r[i], b = r[(i + 1) % n]
      out.push([p[0] + (a[0] - p[0]) * 0.25, p[1] + (a[1] - p[1]) * 0.25])
      out.push([p[0] + (b[0] - p[0]) * 0.25, p[1] + (b[1] - p[1]) * 0.25])
    }
    r = out
  }
  return r
}

// ── straighten (the SNAP / LINE tool) ─────────────────────────────────────────────────────────
/** SNAP/LINE: true up near-straight runs. Slides a window (length grows with LINE) along the ring;
 *  for each window that is already roughly collinear (small PCA residual — a real corner has a large
 *  one and is skipped), projects its points onto the window's best-fit line. Overlapping windows are
 *  averaged, then blended by `strength`. A DIRECT op (not fairTracedRing's fragile band-grow), so Snap
 *  visibly trues a noisy wall on ANY shape without the densify/fold that masked it before (F5). */
function straighten(ring: Vec2Px[], strength: number, lineFrac: number): Vec2Px[] {
  const n = ring.length
  if (n < 6 || strength <= 0) return ring
  const win = Math.max(5, Math.round(n * lineFrac))
  const accX = new Array<number>(n).fill(0)
  const accY = new Array<number>(n).fill(0)
  const cnt = new Array<number>(n).fill(0)
  for (let s = 0; s < n; s++) {
    const idx: number[] = []
    let mx = 0, my = 0
    for (let k = 0; k < win; k++) { const i = (s + k) % n; idx.push(i); mx += ring[i][0]; my += ring[i][1] }
    mx /= win; my /= win
    let sxx = 0, sxy = 0, syy = 0
    for (const i of idx) { const dx = ring[i][0] - mx, dy = ring[i][1] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy }
    const tr = sxx + syy
    const disc = Math.max(0, (tr * tr) / 4 - (sxx * syy - sxy * sxy))
    const l1 = tr / 2 + Math.sqrt(disc) // variance along the run
    const l2 = tr / 2 - Math.sqrt(disc) // residual across the run
    if (l1 < 1e-9 || l2 / l1 > 0.1) continue // empty window or a real corner — leave it
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    const ux = Math.cos(theta), uy = Math.sin(theta) // principal (best-fit-line) direction
    for (const i of idx) {
      const t = (ring[i][0] - mx) * ux + (ring[i][1] - my) * uy
      accX[i] += mx + t * ux; accY[i] += my + t * uy; cnt[i] += 1
    }
  }
  return ring.map(([x, y], i) => (cnt[i] === 0 ? [x, y] : [x + (accX[i] / cnt[i] - x) * strength, y + (accY[i] / cnt[i] - y) * strength]) as Vec2Px)
}

// ── global pass ────────────────────────────────────────────────────────────────────────────
const FAIR_FLATTEN_TOL = 0.75 // px — dense enough that the fairing sees the true silhouette
const FAIR_SPACING = 1.5

/** Fair one ring as a STAGED, fail-closed pipeline (VD12). Each tool is a DIRECT, independent stage;
 *  every stage is validated and a folded/NaN result is dropped — falling back to the PRIOR valid ring,
 *  NOT to the raw source. (The old "always run fairTracedRing, else return source" path silently masked
 *  Angle/Snap on deep stars: with smooth=0 the densify still folded → fell back to source = no-op. F5.)
 *  Order: angle → snap/line → smooth → detail.
 *   • ANGLE  = clampCorners (Chaikin corner-cut on real source corners) — simple-preserving.
 *   • SNAP   = straighten (windowed best-fit-line projection); LINE = the window length.
 *   • SMOOTH = fairTracedRing (resample + Gaussian σ) — the only densifying op; backs σ off on a fold.
 *   • DETAIL = rdpClosed — thins the result.
 *  The incoming `ring` is the flattened source (simple by construction) — the guaranteed terminal. */
function fairWithGuard(ring: Vec2Px[], g: GlobalAdjustments): Vec2Px[] {
  // valid = finite (no NaN/Infinity) AND simple (no self-cross) AND ≥4 pts. Each stage is kept only if
  // valid, so resolve() NEVER returns unrenderable/folded geometry — fail-closed to the prior ring.
  const valid = (r: Vec2Px[]) => r.length >= 4 && r.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) && validateSelfIntersection(r, 'resolve').length === 0
  const keep = (next: Vec2Px[], prev: Vec2Px[]) => (valid(next) ? next : prev)

  // smooth scales with the shape size — compute the bbox diagonal
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ring) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
  const diag = Math.hypot(maxX - minX, maxY - minY) || 1

  let r = ring
  // 1. ANGLE — round real corners on the source ring (before any densify, where corners exist).
  if (g.angle > 0) r = keep(clampCorners(r, angleMaxTurnDeg(g.angle)), r)
  // 2. SNAP/LINE — true near-straight runs (windowed line projection). Snap = pull strength; Line =
  // reach (window length) AND a standalone baseline strength, so Line visibly trues straight runs on
  // its own (Dan: every tool full range), while still pairing with Snap. Both act only where a run is
  // already near-straight (straighten skips real corners) — a spiky/organic silhouette has little to
  // true, which is the honest "why" they read flat there.
  if (g.snap > 0 || g.line > 0) {
    const strength = Math.max(snapStrength(g.snap), g.line > 0 ? 0.35 + 0.45 * (Math.min(100, g.line) / 100) : 0)
    r = keep(straighten(r, strength, lineWindowFrac(g.line)), r)
  }
  // 3. SMOOTH — Gaussian fairing (the only fold-capable op); back σ off until simple.
  if (g.smooth > 0) {
    let sigma = smoothSigmaPx(g.smooth, diag)
    let sm = fairTracedRing(r, { spacingPx: FAIR_SPACING, smoothPx: sigma, maxTurnDeg: 180, detailPx: 0, minLinePx: 0 })
    let guard = 0
    while (!valid(sm) && guard++ < 12 && sigma > 0.5) {
      sigma *= 0.7
      sm = fairTracedRing(r, { spacingPx: FAIR_SPACING, smoothPx: sigma, maxTurnDeg: 180, detailPx: 0, minLinePx: 0 })
    }
    r = keep(sm, r)
  }
  // 4. DETAIL — RDP simplify the result (independent axis; applied last).
  const eps = detailEpsPx(g.detail)
  if (eps > 0) r = keep(rdpClosed(r, eps), r)

  // terminal: the staged result if valid, else a validated repair, else the (simple) source ring.
  if (valid(r)) return r
  const repaired = repairSimplePolygon(r, 1)
  if (valid(repaired)) return repaired
  return valid(ring) ? ring : repairSimplePolygon(ring, 1)
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
        if (idx >= 0) p = roundCornersPaper(p, l.radius!, (ai) => ai === idx) // L1: true-arc, symmetric
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
