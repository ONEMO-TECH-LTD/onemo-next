// outline-resolve.ts — Creator v5 editor geometry engine (blueprint v5-foundation.md §4, DEC-v5-03).
//
// ONE impartial, non-destructive engine: `resolve(source, adjustments) → VShape`, IDENTICAL for every
// vector class (generated trace, stock library, upload, drawn). The producer's only job is to make an
// `OutlineSource` (immutable SHARP-corner vector + stable per-anchor ids); the editor never branches on
// class. All shaping is a reversible adjustment on top of the sharp source (invariant 9).
//
// Contract:
//   • ALL-OFF  === the exact source (object identity preserved — no flatten/refit, no copy).
//   • Global tools (simplify / smooth / straighten) — each is its LIBRARY op applied DIRECTLY to the
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
import { resampleClosedUniform } from '@/lib/outline-core'
import { flattenPath, ringToVPath, scaleAnchorTension, shapeBBox, type VShape, type VPath } from '@/lib/vector-core'
// The geometry kernels, imported directly (not via the vector-core barrel) so Paper/Clipper stay in the
// create bundle only, never the v1/v2/shaped bundles.
import { roundCornersPaper, smoothPaper, simplifyPaper } from '@/lib/vector-core/paper-kernel'
import { straightenPath, roundWholeShapePx } from '@/lib/vector-core/clipper-kernel'
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
  /** Cutout-only calibration: Detail may leave a sparse generated trace that Simplify must still fit. */
  simplifyAfterDetail?: boolean
}

/** Global tools — independent axes. OFF = `GLOBAL_OFF` below. */
export interface GlobalAdjustments {
  simplify: number   // 0..100; 0 = OFF (full detail) — Paper simplify strength (curve-fit reduce)
  smooth: number     // 0..200 strength; 0 = OFF — Paper catmull-rom rounding energy
  straighten: number // 0..100; 0 = OFF — Clipper2 RDP collinear-collapse (stacks ON TOP of simplify)
  // WHOLE-SHAPE Radius (DEC-v5-03/04 dual-engine): source px (0 = OFF), NOT a pct — same unit as
  // LocalAdjustment.radius so value-reflection + the %-of-maxRadius slider are identical for whole-shape
  // and per-corner. Whole-shape (no anchor selected) routes here → Clipper2 offset-round (symmetric,
  // square → circle); a SELECTED corner routes to LocalAdjustment.radius → Paper single-segment instead.
  radius: number     // source px; 0 = OFF — Clipper2 whole-shape offset-round
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

export const GLOBAL_OFF: GlobalAdjustments = { simplify: 0, smooth: 0, straighten: 0, radius: 0 }
export const ADJUSTMENTS_OFF: OutlineAdjustments = { global: { ...GLOBAL_OFF }, local: {} }

// ── pct → engine-unit maps (the editor sliders write 0..100; OFF maps to a true no-op) ──────────
// SCALE-RELATIVE (Dan 2026-06-17: every tool is % scale-relative): a tool's 100% = MAX_FRAC of the
// shape's short side, so "50%" behaves identically on any shape size — no fixed-px magic numbers. The
// MAX_FRACs are STARTING tuning constants (Dan-tuned). (Smooth is already scale-relative — catmull
// tension is relative to anchor spacing; Radius = % of half the short side; Curve scales with each
// anchor's neighbour legs — so all five tools are scale-relative.)
const STRAIGHTEN_MAX_FRAC = 0.04 // 100% straightens runs deviating up to 4% of the short side (Dan 2026-08-06: 2x sensitivity)
const SIMPLIFY_MAX_FRAC = 0.025 // 100% simplify tolerance = 2.5% of the short side (proven base; the admin multiplier provides x3 headroom)
/** Straighten: Clipper2 RDP epsilon = pct × MAX_FRAC × shape short side (px). 0% = OFF. */
export const straightenEpsPx = (pct: number, scalePx: number) => (Math.max(0, Math.min(300, pct)) / 100) * STRAIGHTEN_MAX_FRAC * scalePx // 300 = admin calibration headroom (Dan 2026-08-06)
/** Smooth: Paper catmull-rom handle factor. 0% = OFF (no handles introduced); 100% = max round.
 *  Already scale-invariant (catmull tension is relative to anchor spacing). */
export const smoothFactor = (pct: number) => Math.max(0, Math.min(1, pct / 100))
/** Simplify: Paper SIMPLIFY tolerance = pct × MAX_FRAC × shape short side (px). 0% = OFF; higher =
 *  fewer anchors + rounder curve-fit. Applied directly to the anchors; never a dense chain. */
export const simplifyTolPx = (pct: number, scalePx: number) => (Math.max(0, Math.min(300, pct)) / 100) * SIMPLIFY_MAX_FRAC * scalePx // 300 = admin calibration headroom
/** Whole-outline Radius slider geometry: 100% = half the resolved shape's short side. */
export function outlineRadiusMaxPx(shape: VShape): number {
  const bb = shapeBBox(shape, 1)
  return Math.max(1, Math.round(Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2))
}
export const outlineRadiusPx = (pct: number, shape: VShape) =>
  (Math.max(0, Math.min(100, pct)) / 100) * outlineRadiusMaxPx(shape) * 0.5 // global 50% intensity — full-scale overshot the shape (Dan 2026-08-06)
/** Whole-outline Curve slider geometry: 0..100% maps to the engine's 0..2 bend factor. */
export const outlineCurveFactor = (pct: number) =>
  (Math.max(0, Math.min(300, pct)) / 100) * 2 // 300 = admin calibration headroom (Dan 2026-08-06)

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
  return g.simplify <= 0 && g.smooth <= 0 && g.straighten <= 0 && g.radius <= 0
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
// 0.5 MATCHES the editor's display ring (EditorCanvas hitRing = flattenShape(.,0.5)): the fold-guard
// must reject exactly what the display would flag red, or a borderline result (e.g. tiny Smooth at 1%)
// passes the coarser guard yet shows a red outline. Same tolerance → guard and red-flag agree.
const VALIDATE_FLATTEN_TOL = 0.5 // px — matches the display ring so guard ⇔ red-flag agree
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

/** The shape's short side (px) — the scale reference for the scale-relative tools (straighten/simplify). */
function shortSidePx(path: VPath): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const a of path.anchors) { if (a.p.x < minX) minX = a.p.x; if (a.p.y < minY) minY = a.p.y; if (a.p.x > maxX) maxX = a.p.x; if (a.p.y > maxY) maxY = a.p.y }
  return Math.max(1, Math.min(maxX - minX, maxY - minY))
}

// ── global pass ────────────────────────────────────────────────────────────────────────────
/** Global pass: each global tool is its LIBRARY op applied DIRECTLY to the path's own anchors (no
 *  flatten-and-refit). Order: straighten (collapse near-collinear) → simplify (anchor density) → smooth
 *  (handle roundness). Each stage is fold-guarded (a self-crossing result is dropped, keeping the prior
 *  valid path). Then claimed anchors are pinned back — the nearest output anchor is snapped to the exact
 *  source position and re-keyed by id — so a radius/curve point survives the global reshape (VD2). */
function globalPass(source: OutlineSource, g: GlobalAdjustments, claimed: Set<string>): VShape {
  const paths = source.shape.paths.map((path) => {
    if (path.anchors.length < 3) return path // too small to reshape — pass through unchanged
    let p: VPath = path
    const scalePx = shortSidePx(path) // scale reference for the scale-relative tools (straighten/simplify)
    const guard = (next: VPath): VPath => (ringSimple(pathToRing(next)) ? next : p)
    // 1. STRAIGHTEN — Clipper2 RDP/TrimCollinear: collapse near-collinear runs to true straight edges.
    if (g.straighten > 0) p = guard(straightenPath(p, straightenEpsPx(g.straighten, scalePx)))
    // 2. SIMPLIFY — PINNED-corner Schneider fit (the engine's own ringToVPath, Dan 2026-08-06):
    //    Paper's free re-fit chorded high-curvature regions INWARD (the localized top-squash Dan
    //    screenshotted — deviation is systematic toward the concave side). ringToVPath pins the
    //    true corners ON the outline and fits minimal smooth cubic chains between them within the
    //    tolerance — fewer anchors, flowing curves, extremities cannot pull in. Same knob, same
    //    tolerance mapping; normally runs where redundant vertices exist (clean polygons untouched).
    //    Cutout may explicitly keep it active after Detail has already removed those vertices.
    if (g.simplify > 0) {
      const tol = simplifyTolPx(g.simplify, scalePx)
      if (source.simplifyAfterDetail || hasRedundantVertices(p, tol)) {
        // DENSIFY before fitting (Dan 2026-08-06: Detail-then-Simplify broke — flattening a coarse
        // faceted polygon yields only its corner vertices, and a curve fitted through sparse points
        // is underconstrained: it bulges/folds between them). Uniform resample at fine spacing keeps
        // the fit pinned to the actual geometry regardless of how coarse the anchors are.
        const flat = flattenPath(p, 0.5).map((q) => [q.x, q.y] as Vec2Px)
        // sample budget: 2px spacing on a big outline hands the fitter thousands of points and its
        // error-split recursion stalls the page (Dan: 'simplify freezing'). ~500 samples is dense
        // enough to pin the fit at any shape size.
        let perim = 0
        for (let i = 0; i < flat.length; i++) { const a = flat[i], b2 = flat[(i + 1) % flat.length]; perim += Math.hypot(b2[0] - a[0], b2[1] - a[1]) }
        const spacing = Math.max(2, perim / 500)
        const ring = resampleClosedUniform(flat, spacing).map(([x, y]) => ({ x, y }))
        // PURE smooth-cycle fit (Dan 2026-08-06): NO corner pinning — a hardcoded pin angle kept
        // locking Detail's coarse facet corners as intentionally-sharp (the odd sharp corners in
        // the Detail+Simplify combo). With cornersOverride [], the whole outline fits as smooth
        // curve chains, deviation bounded by the tolerance — sharpness survives only where the
        // data forces it; deliberate corners are the editor's job, not this knob's.
        if (ring.length >= 3) p = guard(ringToVPath(ring, 0, Math.max(0.5, tol), []))
      }
    }
    // 3. SMOOTH — Paper catmull-rom: handle roundness on the (sparse) anchors. Back off (to any factor)
    //    on a fold — at tiny smooth the floor must be low enough to retreat to a clean result, else the
    //    1% case slips a borderline self-touch past the guard and shows a red outline.
    //    BOOSTED CEILING (Dan 2026-08-06): the handle factor's math limit is 1.0 (beyond it curves
    //    overshoot into self-crossings), so the knob's reach doubles via a SECOND PASS instead —
    //    0–50 = the classic single-pass range (factor 0→1); 50–100 = a second rounding pass ramping
    //    on top (continuous, monotonic, each pass fold-guarded with the same back-off).
    if (g.smooth > 0) {
      const energy = Math.max(0, Math.min(200, g.smooth)) / 50 // 0..4 total rounding energy (knob 0-200; each 50 = one full pass — Dan 2026-08-06)
      const passes: number[] = []
      for (let e = energy; e > 0; e -= 1) passes.push(Math.min(1, e))
      for (const f0 of passes) {
        if (f0 <= 0) continue
        let factor = f0
        let sm = smoothPaper(p, factor)
        let n = 0
        while (!ringSimple(pathToRing(sm)) && n++ < 12 && factor > 0.004) { factor *= 0.7; sm = smoothPaper(p, factor) }
        if (ringSimple(pathToRing(sm))) p = sm
      }
    }
    // 4. RADIUS (whole-shape) — Clipper2 offset-round: round EVERY convex corner uniformly, symmetric by
    //    construction (square @ ½ short-side → circle). This is the no-selection Radius path; a SELECTED
    //    corner rounds per-corner via Paper in the local pass instead. Fold-guarded like every stage.
    if (g.radius > 0) p = guard(roundWholeShapePx(p, g.radius))
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
      // curve pass (count-stable) — BATCH the bends, ONE fold-check. KAI-9116: a WHOLE-SHAPE curve
      // claims every anchor; validating each bend with an O(n²) self-intersection scan made this O(n³),
      // which froze the editor on a dense Magic trace (hundreds of anchors). A single tangent bend
      // virtually never self-crosses, so apply them all, validate once, and fall back to the pre-curve
      // path if the batch folds. The id→index map also drops the per-anchor O(n) findIndex (count-stable
      // bends keep indices valid across the batch).
      const curveEntries = Object.entries(local).filter(([, l]) => l && (l.curve ?? 0) !== 0)
      if (curveEntries.length) {
        const idxById = new Map(p.anchors.map((a, i) => [a.id, i] as const))
        let q = p
        for (const [id, l] of curveEntries) {
          const idx = idxById.get(id)
          if (idx !== undefined && idx >= 0) q = bendAnchorPath(q, idx, l!.curve!)
        }
        if (simple(q)) p = q
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
