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
// Reuses outline-core pure math (validateSelfIntersection/repairSimplePolygon) and the Paper.js kernel
// (simplify/smooth/round — DEC-v5-02) behind vector-core ops (flattenPath/scaleAnchorTension); does NOT
// revive OutlineDocument. The geometry MATH is bought (Paper); angle/snap/line stay in-house (no kernel op).

import {
  validateSelfIntersection,
  repairSimplePolygon,
  type Vec2Px,
} from '@/lib/outline-core/math'
import { flattenPath, scaleAnchorTension, type VShape, type VPath } from '@/lib/vector-core'
// L1/L2 (DEC-v5-02): the geometry MATH is the Paper.js headless kernel — Radius (true constant-radius
// arc, symmetric on unequal legs), Smooth (catmull-rom handles), Detail (simplify → sparse curves).
// Imported directly (not via the vector-core barrel) so Paper stays in the create bundle only, never
// the v1/v2/shaped bundles. ONE engine (invariant 2): no in-house fillet/smooth/simplify remains here.
import { roundCornersPaper, smoothPaper, simplifyPaper } from '@/lib/vector-core/paper-kernel'
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
/** Smooth: Paper catmull-rom handle factor (DEC-v5-02). 0% = OFF (no handles introduced); 100% = max
 *  round. Scale-invariant (catmull tension is relative to anchor spacing), so — unlike the old Gaussian
 *  σ — it needs no bbox scaling. Applied to the SPARSE simplified anchors, the only place catmull shows. */
export const smoothFactor = (pct: number) => Math.max(0, Math.min(1, pct / 100))
/** Snap: STRAIGHTEN strength — projects each point onto its local best-fit line (a direct op, not the
 *  fairing's fragile band-grow). 0% = off, 100% = full projection. Reliable + simple on any shape. */
export const snapStrength = (pct: number) => Math.max(0, Math.min(1, pct / 100))
/** Angle: max-turn cap (corner-round) — a DIRECT corner-cut on real corners, independent of the fairing.
 *  0% = 180° (off), 100% = 10° (rounds every sharp corner). */
export const angleMaxTurnDeg = (pct: number) => (pct <= 0 ? 180 : 180 - (pct / 100) * 170)
/** Line: Snap's straighten WINDOW (fraction of the ring) — longer = trues longer runs (pairs with Snap). */
export const lineWindowFrac = (pct: number) => 0.02 + (Math.max(0, Math.min(100, pct)) / 100) * 0.1
/** Detail: Paper SIMPLIFY tolerance (px) = sparse-curve anchor density (DEC-v5-02). 100% = most detail
 *  (tight 0.75px fit → most anchors), 0% = simplest (≈8.75px → fewest). The 0.75px floor at 100% recovers
 *  SPARSE bezier anchors from the internally-densified working ring (flatten + angle/snap densify) — the
 *  output is never a dense point-chain. Independent of Smooth (which sets handle roundness, not count). */
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
const FAIR_FLATTEN_TOL = 0.75 // px — dense enough that the angle/snap truing sees the true silhouette

/** A flattened ring → a STRAIGHT-anchor working VPath (the form the Paper ops consume). */
const ringToStraightPath = (ring: Vec2Px[]): VPath => ({
  anchors: ring.map(([x, y]) => ({ p: { x, y }, hIn: null, hOut: null, corner: true })),
})
/** A VPath → its flattened ring (so a Paper-curved result can be validated / re-measured). */
const pathToRing = (vp: VPath): Vec2Px[] => flattenPath(vp, FAIR_FLATTEN_TOL).map((p) => [p.x, p.y] as Vec2Px)
const ringFinite = (r: Vec2Px[]) => r.length >= 4 && r.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
const ringSimple = (r: Vec2Px[]) => ringFinite(r) && validateSelfIntersection(r, 'resolve').length === 0

/** Fair one flattened ring into a SPARSE, CURVED VPath — the staged, fail-closed pipeline (VD12).
 *  Order: angle → snap/line → DETAIL → SMOOTH. The geometry MATH (simplify/smooth) is the Paper kernel
 *  (DEC-v5-02, invariant 2 — ONE engine, no in-house fillet/smooth/simplify); angle/snap/line are
 *  product truing ops with no kernel equivalent, kept in-house.
 *  PAPER-IMPLEMENTATION ORDER CORRECTION (not a v5 scope change; Pixel QA-confirmed from Paper source):
 *  the old rdp pipeline ran smooth→detail, but Paper's simplify() refits from anchor POINTS via
 *  PathFitter (discarding handles), so a smooth BEFORE simplify is erased; and catmull-rom smooth is
 *  only visible on SPARSE anchors. So DETAIL (simplify → sets sparse anchor points + faithful fit) runs
 *  first, then SMOOTH (catmull → sets handle roundness on those points). The USER CONTRACT is unchanged:
 *  independent Detail/Smooth axes, off===source, never a folded/cracked shape.
 *  Each stage is validated; a folded/NaN stage drops to the prior valid one — never to the raw source
 *  (so earlier stages survive): invalid DETAIL keeps the trued ring; invalid SMOOTH keeps the detail result. */
function fairPath(ring0: Vec2Px[], g: GlobalAdjustments): VPath {
  const validPath = (vp: VPath) => ringSimple(pathToRing(vp))
  const keepRing = (next: Vec2Px[], prev: Vec2Px[]) => (ringSimple(next) ? next : prev)
  const fallback = (r: Vec2Px[]): VPath => ringToStraightPath(ringSimple(r) ? r : repairSimplePolygon(r, 1))

  let r = ring0
  // 1. ANGLE — round real corners on the source ring (Chaikin corner-cut), BEFORE the curve fit (a
  //    dense/curved ring has no per-vertex sharp turns to find — why Angle read as dead pre-v4).
  if (g.angle > 0) r = keepRing(clampCorners(r, angleMaxTurnDeg(g.angle)), r)
  // 2. SNAP/LINE — true near-straight runs (windowed best-fit-line projection). Snap = pull strength;
  //    Line = reach (window length) plus a standalone baseline strength so Line trues runs on its own
  //    while still pairing with Snap. Both skip real corners (large PCA residual) — a spiky silhouette
  //    honestly has little to true there.
  if (g.snap > 0 || g.line > 0) {
    const strength = Math.max(snapStrength(g.snap), g.line > 0 ? 0.35 + 0.45 * (Math.min(100, g.line) / 100) : 0)
    r = keepRing(straighten(r, strength, lineWindowFrac(g.line)), r)
  }
  if (!ringSimple(r)) r = ringFinite(r) ? repairSimplePolygon(r, 1) : ring0
  // 3. DETAIL — Paper simplify the (trued, internally-dense) ring to SPARSE bezier curves: sets the
  //    anchor POINTS + a faithful fit. The 0.75px floor (detail 100) recovers sparse anchors from our
  //    own densification (flatten + Chaikin), so the result is never a dense point-chain.
  let vp = simplifyPaper(ringToStraightPath(r), detailTolPx(g.detail))
  if (!validPath(vp)) vp = fallback(r) // invalid DETAIL → keep the trued ring (prior valid stage)
  // 4. SMOOTH — Paper catmull-rom on the SPARSE anchors: sets handle roundness (visible on sparse
  //    points; invisible on the dense ring). Independent of Detail (factor vs tolerance); back the
  //    factor off on a fold, fail-closed to the unsmoothed detail result (NOT the raw source).
  if (g.smooth > 0) {
    let factor = smoothFactor(g.smooth)
    let sm = smoothPaper(vp, factor)
    let guard = 0
    while (!validPath(sm) && guard++ < 12 && factor > 0.04) { factor *= 0.7; sm = smoothPaper(vp, factor) }
    if (validPath(sm)) vp = sm
  }
  return validPath(vp) ? vp : fallback(ring0)
}

/** Global pass: fair every path's flattened polyline into a SPARSE curved VPath, then pin claimed
 *  anchors back — snap the nearest faired anchor to the exact source position + re-attach its id — so
 *  the local pass can find them and a claimed point survives the global reshape (VD2). The output is now
 *  sparse curves (Paper simplify/smooth); local radius/curve still re-key by id through the pin. */
function globalPass(source: OutlineSource, g: GlobalAdjustments, claimed: Set<string>): VShape {
  const paths = source.shape.paths.map((path) => {
    const ring = flattenPath(path, FAIR_FLATTEN_TOL).map((p) => [p.x, p.y] as Vec2Px)
    if (ring.length < 4) return path // too small to fair — pass through unchanged
    const faired = fairPath(ring, g)
    // PIN each claimed source anchor: snap the nearest faired anchor back to its exact source
    // position and re-attach its id, so global reshaping leaves the claimed point fixed (VD2).
    for (const a of path.anchors) {
      if (!a.id || !claimed.has(a.id)) continue
      let bi = -1, bd = Infinity
      for (let i = 0; i < faired.anchors.length; i++) {
        const d = (faired.anchors[i].p.x - a.p.x) ** 2 + (faired.anchors[i].p.y - a.p.y) ** 2
        if (d < bd) { bd = d; bi = i }
      }
      if (bi >= 0) faired.anchors[bi] = { p: { x: a.p.x, y: a.p.y }, hIn: null, hOut: null, corner: true, id: a.id }
    }
    return faired
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
      // FOLD GUARD (KAI-9076): every local op is validated; a bend/round that makes the ring
      // self-cross is DROPPED (keep the prior valid path) — mirrors fairPath's guard so a local
      // tool can never emit a folded/cracked outline that commits to display/cut truth.
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
        if (idx >= 0) { const next = roundCornersPaper(p, l.radius!, (ai) => ai === idx); if (simple(next)) p = next } // L1: true-arc, symmetric
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
