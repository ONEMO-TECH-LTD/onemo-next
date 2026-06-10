// outline-core/resolver.ts — deterministic OutlineDocument → resolved + flattened cut polygon (A1a)
//
// Chain (AMEND-C2/F2 — resolve BEFORE flatten):
//   OutlineDocument
//     → resolve  (per-node corner radii applied as true arcs; line segments between nodes)
//     → flatten  (RDP at the manufacturing-profile tolerance)
//     → normalize rings (closure + winding: outer CCW, holes CW)
//     → self-intersection check → locators
//
// Per-node corner radii reuse the engine's `filletCorners` arc math (core/shaped/contour.ts):
// θ = INTERIOR angle, radiusMax = 0.8·min(L1,L2)·tan(θ/2). v1 = convex corners only (AMEND-C6);
// concave/near-straight pass through. Pure + deterministic: no DOM, no three.js, no Date.now.
//
// SCOPE (A1a): line segments between nodes (the auto/semi-auto polygon case). Curve/livewire
// segment sampling (cubic/catmull_rom/livewire) + the Catmull-Rom smoothing resample land with
// A2/A3 when those segment types are produced; `policy.smoothing_applied` reports honestly.

import type {
  OutlineDocument,
  OutlineRing,
  OutlineNode,
  Vec2Px,
  ResolvedOutline,
  ResolvedOutlinePolicy,
  GeometryLocator,
  EditorValidationIssue,
} from './types'
import { outlineDocumentHash } from './hash'

// ─── geometry helpers (pure ports from core/shaped/contour.ts) ───────────────

export function signedArea(pts: Vec2Px[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

/** Drop consecutive near-coincident points (incl. the wrap). */
export function dedup(pts: Vec2Px[], eps = 1e-3): Vec2Px[] {
  const out: Vec2Px[] = []
  for (const p of pts) {
    const q = out[out.length - 1]
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push([p[0], p[1]])
  }
  while (
    out.length > 2 &&
    Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= eps
  )
    out.pop()
  return out
}

function rdp(pts: Vec2Px[], epsilon: number): Vec2Px[] {
  if (pts.length < 3) return pts
  const sqEps = epsilon * epsilon
  const perpSq = (p: Vec2Px, a: Vec2Px, b: Vec2Px) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    if (len2 === 0) { const ex = p[0] - a[0], ey = p[1] - a[1]; return ex * ex + ey * ey }
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const px = a[0] + t * dx, py = a[1] + t * dy
    const ex = p[0] - px, ey = p[1] - py
    return ex * ex + ey * ey
  }
  const out: Vec2Px[] = [pts[0]]
  const range = (s: number, e: number) => {
    let maxd = 0, idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = perpSq(pts[i], pts[s], pts[e])
      if (d > maxd) { maxd = d; idx = i }
    }
    if (maxd > sqEps && idx > 0) { range(s, idx); out.push(pts[idx]); range(idx, e) }
  }
  range(0, pts.length - 1)
  out.push(pts[pts.length - 1])
  return out
}

/** Closed-loop RDP — split at pts[0] and the farthest point so the seam isn't special-cased. */
export function rdpClosed(pts: Vec2Px[], epsilon: number): Vec2Px[] {
  const n = pts.length
  if (n < 4) return pts
  let f = 1, fd = -1
  for (let k = 1; k < n; k++) {
    const d = (pts[k][0] - pts[0][0]) ** 2 + (pts[k][1] - pts[0][1]) ** 2
    if (d > fd) { fd = d; f = k }
  }
  const a = rdp(pts.slice(0, f + 1), epsilon)
  const b = rdp(pts.slice(f).concat([pts[0]]), epsilon)
  return a.slice(0, -1).concat(b.slice(0, -1))
}

/** Orient a ring to the desired winding (outer CCW, hole CW). */
function orient(pts: Vec2Px[], wantCCW: boolean): Vec2Px[] {
  const ccw = signedArea(pts) > 0
  return ccw === wantCCW ? pts : [...pts].reverse()
}

/** Proper segment-segment intersection (excludes shared endpoints of adjacent edges). */
function segmentsProperlyIntersect(p1: Vec2Px, p2: Vec2Px, p3: Vec2Px, p4: Vec2Px): boolean {
  const d = (a: Vec2Px, b: Vec2Px, c: Vec2Px) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

// ─── per-node corner radius (reuses engine filletCorners arc math) ───────────

/** Resolve a node's effective corner radius from its CornerSpec + the global default. */
function resolveNodeRadius(node: OutlineNode, globalRadiusPx: number): number {
  const c = node.corner
  switch (c.mode) {
    case 'sharp': return 0
    case 'smooth': return 0 // spline smoothing (A2) — not a hard arc radius
    case 'manual': return c.outlineCornerRadiusPx ?? 0
    case 'inherit': return c.locked ? 0 : globalRadiusPx // locked corners ignore "round all"
  }
}

/**
 * Apply per-node corner radii to a closed node ring → resolved polyline. Convex corners with a
 * positive resolved radius become TRUE circular arcs (clamped so neighbouring fillets fit);
 * concave, near-straight, and zero-radius corners pass through as their vertex.
 *
 * Division of labour (settled by use, Dan 2026-06-10): RADIUS (the Round tool) = these true arcs —
 * exact corner rounding, square @ max = circle. SMOOTH = the Catmull-Rom spline resample (below in
 * resolve) — organic softening for BEN/free-form outlines. They are different effects; both ship.
 *
 * Arc resolution is ADAPTIVE (≈2px per segment, 8..72 steps): a fixed 10-step arc read visibly
 * choppy on large corners (e.g. the default square's corner radius at texture scale).
 */
export function applyCornerRadii(
  nodes: OutlineNode[],
  globalRadiusPx: number,
): Vec2Px[] {
  const n = nodes.length
  if (n < 3) return nodes.map((nd) => [nd.p[0], nd.p[1]] as Vec2Px)
  const pts = nodes.map((nd) => nd.p)
  const ccw = signedArea(pts) > 0
  const out: Vec2Px[] = []

  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], v = pts[i], b = pts[(i + 1) % n]
    const d1x = a[0] - v[0], d1y = a[1] - v[1]
    const d2x = b[0] - v[0], d2y = b[1] - v[1]
    const l1 = Math.hypot(d1x, d1y) || 1, l2 = Math.hypot(d2x, d2y) || 1
    const u1x = d1x / l1, u1y = d1y / l1, u2x = d2x / l2, u2y = d2y / l2
    const cosA = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y))
    // near-straight (interior ≈ 180°) → no fillet handle
    const nearStraight = cosA < -0.999
    // convex iff the turn matches the ring winding (cross sign)
    const cross = d1x * d2y - d1y * d2x // (v→a) × (v→b)
    const convex = cross < 0 === ccw // for CCW, convex corners turn right here
    const half = Math.acos(cosA) / 2
    // Clamp so a fillet consumes at most HALF its shorter adjacent edge — two fillets sharing an
    // edge then MEET exactly (0.5 + 0.5 = 1) and can never overlap. The ε keeps a hair of slack for
    // float noise. At full Smooth this is what closes a square into a true circle (the old 0.49
    // margin left visible flat remnants at the corners — 4.8% off-circle, measured).
    const maxR = (0.5 - 1e-4) * Math.min(l1, l2) * Math.tan(half)
    const R = resolveNodeRadius(nodes[i], globalRadiusPx)
    if (R <= 0 || nearStraight || !convex) { out.push([v[0], v[1]]); continue }

    const Rc = Math.min(R, maxR)
    const t = Rc / Math.tan(half)
    const p1: Vec2Px = [v[0] + u1x * t, v[1] + u1y * t]
    const p2: Vec2Px = [v[0] + u2x * t, v[1] + u2y * t]
    let bx = u1x + u2x, by = u1y + u2y
    const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl
    const cx = v[0] + bx * (Rc / Math.sin(half)), cy = v[1] + by * (Rc / Math.sin(half))
    const a1 = Math.atan2(p1[1] - cy, p1[0] - cx)
    const a2 = Math.atan2(p2[1] - cy, p2[0] - cx)
    let da = a2 - a1
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    // adaptive resolution: ≈2px per arc segment (was a fixed 10 → visible facets on big corners)
    const steps = Math.max(8, Math.min(72, Math.ceil((Rc * Math.abs(da)) / 2)))
    for (let s = 0; s <= steps; s++) {
      const ang = a1 + da * (s / steps)
      out.push([cx + Rc * Math.cos(ang), cy + Rc * Math.sin(ang)])
    }
  }
  return out
}

// ─── flatten / normalize / validate ──────────────────────────────────────────

/**
 * CENTRIPETAL Catmull-Rom closed resample (Barry–Goldman) → smooths a ring (pure, no three.js).
 * Centripetal parameterization (α=0.5) is the load-bearing choice: with UNEVEN anchor spacing the
 * uniform variant overshoots between close anchor pairs and forms micro self-intersection loops —
 * exactly what fired SELF_INTERSECTION on smoothed BEN outlines (2026-06-10). Centripetal CR is
 * guaranteed cusp- and loop-free within segments.
 */
export function catmullRomClosed(pts: Vec2Px[], samplesPerSeg = 6): Vec2Px[] {
  const n = pts.length
  if (n < 3 || samplesPerSeg < 2) return pts
  const out: Vec2Px[] = []
  const ALPHA = 0.5
  const knot = (a: Vec2Px, b: Vec2Px, prev: number) =>
    prev + Math.max(Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), ALPHA), 1e-6)
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const t0 = 0
    const t1 = knot(p0, p1, t0)
    const t2 = knot(p1, p2, t1)
    const t3 = knot(p2, p3, t2)
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = t1 + ((t2 - t1) * s) / samplesPerSeg
      // Barry–Goldman pyramid
      const a1x = ((t1 - t) * p0[0] + (t - t0) * p1[0]) / (t1 - t0)
      const a1y = ((t1 - t) * p0[1] + (t - t0) * p1[1]) / (t1 - t0)
      const a2x = ((t2 - t) * p1[0] + (t - t1) * p2[0]) / (t2 - t1)
      const a2y = ((t2 - t) * p1[1] + (t - t1) * p2[1]) / (t2 - t1)
      const a3x = ((t3 - t) * p2[0] + (t - t2) * p3[0]) / (t3 - t2)
      const a3y = ((t3 - t) * p2[1] + (t - t2) * p3[1]) / (t3 - t2)
      const b1x = ((t2 - t) * a1x + (t - t0) * a2x) / (t2 - t0)
      const b1y = ((t2 - t) * a1y + (t - t0) * a2y) / (t2 - t0)
      const b2x = ((t3 - t) * a2x + (t - t1) * a3x) / (t3 - t1)
      const b2y = ((t3 - t) * a2y + (t - t1) * a3y) / (t3 - t1)
      out.push([
        ((t2 - t) * b1x + (t - t1) * b2x) / (t2 - t1),
        ((t2 - t) * b1y + (t - t1) * b2y) / (t2 - t1),
      ])
    }
  }
  return out
}

/** RDP-flatten a resolved ring to the manufacturing tolerance. */
export function flattenPath(resolvedRingPx: Vec2Px[], tolerancePx: number): Vec2Px[] {
  return dedup(rdpClosed(dedup(resolvedRingPx), Math.max(1e-4, tolerancePx)))
}

/** Normalize a flattened ring's winding for its role (outer CCW, hole CW). */
export function normalizeRing(flatRingPx: Vec2Px[], role: OutlineRing['role']): Vec2Px[] {
  return orient(flatRingPx, role === 'outer')
}

/** Find proper self-intersections in a closed ring → segment locators. */
export function validateSelfIntersection(ringPx: Vec2Px[], ringId: string): GeometryLocator[] {
  const n = ringPx.length
  const hits: GeometryLocator[] = []
  if (n < 4) return hits
  for (let i = 0; i < n; i++) {
    const a1 = ringPx[i], a2 = ringPx[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      if (j === i || (i + 1) % n === j || (j + 1) % n === i) continue // skip shared-endpoint neighbours
      const b1 = ringPx[j], b2 = ringPx[(j + 1) % n]
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) {
        hits.push({ kind: 'arc_length_range', ringId, startPx: i, endPx: (j + 1) % n })
      }
    }
  }
  return hits
}

/**
 * Repair a control ring so it's a SIMPLE (non-self-intersecting) polygon with no near-coincident
 * anchors — used to clean the auto-generated outline before it becomes editable, so simplification of
 * the AI contour can't leave overlapping anchors / crossing edges (which mesh as slivers). First merges
 * points closer than `minSpacingPx`, then iteratively drops a vertex that participates in a proper
 * self-intersection until the ring is simple (never below 3 points). Deterministic + pure.
 */
export function repairSimplePolygon(ptsIn: Vec2Px[], minSpacingPx = 0): Vec2Px[] {
  const ring = dedup(ptsIn, Math.max(1e-3, minSpacingPx))
  for (let pass = 0; pass < ptsIn.length; pass++) {
    const n = ring.length
    if (n < 4) break
    let remove = -1
    for (let i = 0; i < n && remove < 0; i++) {
      const a1 = ring[i], a2 = ring[(i + 1) % n]
      for (let j = i + 2; j < n; j++) {
        if ((j + 1) % n === i) continue // adjacent (wrap) — share an endpoint
        if (segmentsProperlyIntersect(a1, a2, ring[j], ring[(j + 1) % n])) { remove = (i + 1) % n; break }
      }
    }
    if (remove < 0) break // simple — done
    ring.splice(remove, 1)
  }
  return ring
}

// ─── traced rings (exact contours) ───────────────────────────────────────────

/** Uniform arc-length resample of a closed ring (pure; used by the fairing pipeline). */
function resampleClosedUniform(pts: Vec2Px[], spacingPx: number): Vec2Px[] {
  const n = pts.length
  if (n < 3 || spacingPx <= 0) return pts
  let perim = 0
  const segLen: number[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    segLen.push(l); perim += l
  }
  const count = Math.max(24, Math.round(perim / spacingPx))
  const step = perim / count
  const out: Vec2Px[] = []
  let seg = 0, into = 0
  for (let k = 0; k < count; k++) {
    const target = k * step
    while (seg < n - 1 && into + segLen[seg] < target) { into += segLen[seg]; seg++ }
    const a = pts[seg % n], b = pts[(seg + 1) % n]
    const t = segLen[seg % n] > 0 ? (target - into) / segLen[seg % n] : 0
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return out
}

/** Per-vertex TURN angle (deg): 0 = straight-through; 180 = full reversal (a spike). */
function turnDeg(prev: Vec2Px, p: Vec2Px, next: Vec2Px): number {
  const ax = p[0] - prev[0], ay = p[1] - prev[1]
  const bx = next[0] - p[0], by = next[1] - p[1]
  const dot = ax * bx + ay * by
  const la = Math.hypot(ax, ay) || 1e-9, lb = Math.hypot(bx, by) || 1e-9
  return (Math.acos(Math.max(-1, Math.min(1, dot / (la * lb)))) * 180) / Math.PI
}

/**
 * FAIR a dense raster trace into a vector-quality contour (Dan, 2026-06-10):
 *  1. uniform resample + small [1,2,1] smoothing — kills the marching-squares stair-steps (the
 *     "micro steps" a faithful raster trace carries; deviation stays ~1–2 mask px, sub-display-pixel);
 *  2. HARD max-turn guarantee — any vertex turning sharper than `maxTurnDeg` is corner-cut
 *     (local Chaikin) and re-faired until none remain: the trace can never present a sharp spike
 *     or micro-angle. Real corners become small smooth rounds; the USER makes sharp corners
 *     deliberately with the editor, never the tracer.
 * Straight runs are unaffected (smoothing of collinear points is identity), curves stay on-shape.
 */
export interface FairTracedRingOpts {
  /** uniform resample spacing (px). */
  spacingPx?: number
  /** hard max-turn guarantee (deg) — the tracer can never emit a sharper angle. */
  maxTurnDeg?: number
  /** line-snap band (px) — wobble below this around a straight is treated as noise. */
  detailPx?: number
  /** Gaussian low-pass σ (px) — the detail-KILL dial: features smaller than ~σ are erased. */
  smoothPx?: number
  /** minimum straight length (px) eligible for line snapping. */
  minLinePx?: number
  _debugSpans?: (s: unknown) => void
}

/** Default DETAIL for BEN cut-outs (Dan, 2026-06-10): patch-like products want the SIMPLEST
 *  outline — skip the silhouette's small detail; he placed the default in the 10–20% band. */
export const BEN_DEFAULT_DETAIL = 15

/**
 * Map the single user-facing DETAIL dial (0 = simplest patch-like outline … 100 = max fidelity)
 * to fairing params. One mapping for the Magic default AND the editor's runtime BEN tuning dash,
 * so what Dan tunes is exactly what Magic ships.
 */
export function fairingFromDetail(detail: number): FairTracedRingOpts {
  const d = Math.max(0, Math.min(100, detail)) / 100
  return {
    smoothPx: Math.round((2 + (1 - d) * 18) * 10) / 10, // detail 100 → σ2 … detail 0 → σ20
    detailPx: Math.round((2 + (1 - d) * 8) * 10) / 10, // line-snap band 2 … 10
    maxTurnDeg: 35,
    minLinePx: 50,
  }
}

export function fairTracedRing(densePts: Vec2Px[], opts: FairTracedRingOpts = {}): Vec2Px[] {
  const spacing = opts.spacingPx ?? 1.5
  const maxTurn = opts.maxTurnDeg ?? 35
  const detailPx = opts.detailPx ?? 4 // the "sensitivity to detail" dial — wobble below this is noise
  let ring = resampleClosedUniform(dedup(densePts), spacing)
  const smooth121 = (pts: Vec2Px[]): Vec2Px[] => {
    const n = pts.length
    const out: Vec2Px[] = new Array(n)
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], p = pts[i], b = pts[(i + 1) % n]
      out[i] = [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4]
    }
    return out
  }
  // ONE circular Gaussian low-pass (σ ≈ 6 mask px) — the principled "less sensitivity to detail":
  // raster stairs (λ≈1px) and soft-mask wobble (λ≈15–30px) are attenuated to nothing, while the
  // SHAPE passes through: straight lines are mathematically INVARIANT under symmetric convolution
  // (they come out perfectly straight — no snap heuristics), and an arc of radius R shrinks by only
  // σ²/2R (≈0.1px at R=200). Sharp features round at ≈σ — which is the intent: the tracer never
  // emits sharp detail; deliberate corners are the user's (Dan, 2026-06-10).
  const sigma = opts.smoothPx ?? 6
  {
    const half = Math.ceil(sigma * 3 / spacing)
    const kernel: number[] = []
    let ksum = 0
    for (let k = -half; k <= half; k++) {
      const w = Math.exp(-(k * spacing) * (k * spacing) / (2 * sigma * sigma))
      kernel.push(w); ksum += w
    }
    const n = ring.length
    const out: Vec2Px[] = new Array(n)
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0
      for (let k = -half; k <= half; k++) {
        const p = ring[((i + k) % n + n) % n]
        const w = kernel[k + half]
        x += p[0] * w; y += p[1] * w
      }
      out[i] = [x / ksum, y / ksum]
    }
    ring = out
  }
  // SNAP true straights (Dan: "less sensitivity to details" — straight lines must come out
  // mathematically straight while curves are NEVER flattened into facets). Mechanism: BAND-GROW —
  // from a seed, grow a maximal run while every sample stays within ±`detailPx` of the run's
  // incrementally-refitted least-squares (PCA) line. A wavy straight fits one band end-to-end no
  // matter the wavelength; an arc bends out of any band within ~√(8R·tol) px of chord. The grown
  // run must then pass the BOW test vs its own chord: an arc's signed residuals are systematic /
  // one-sided (mean ≈ ⅔·sagitta) while mask wobble OSCILLATES (mean ≈ 0) — so curves are rejected
  // and stay Gaussian-faired. (Two prior designs failed measurably here: net-turn windows can't
  // tell a λ≈100px meander (tangent swings ±8°) from an arc inside any short window, and RDP spans
  // fragment a wavy straight AT the wobble extremes so each fragment snaps onto its own tilted
  // line and the long wave survives. The band ignores wobble structure entirely.)
  // Accepted runs are projected onto their line with blended ends; the max-turn pass below cleans
  // the line↔curve seams.
  {
    const n = ring.length
    const tol = detailPx
    const minRunSamples = Math.max(24, Math.round((opts.minLinePx ?? 50) / spacing)) // a true straight
    const SEED = Math.max(8, Math.round(24 / spacing))
    if (n >= minRunSamples * 3) {
      const at = (k: number) => ring[((k % n) + n) % n]
      const snapped: boolean[] = new Array(n).fill(false)
      type Fit = { mx: number; my: number; ux: number; uy: number }
      const sum = { c: 0, sx: 0, sy: 0, sxx: 0, sxy: 0, syy: 0 }
      const resetSum = () => { sum.c = 0; sum.sx = 0; sum.sy = 0; sum.sxx = 0; sum.sxy = 0; sum.syy = 0 }
      const addP = (p: Vec2Px) => {
        sum.c++; sum.sx += p[0]; sum.sy += p[1]
        sum.sxx += p[0] * p[0]; sum.sxy += p[0] * p[1]; sum.syy += p[1] * p[1]
      }
      const fitOf = (): Fit => {
        const mx = sum.sx / sum.c, my = sum.sy / sum.c
        const cxx = sum.sxx / sum.c - mx * mx, cxy = sum.sxy / sum.c - mx * my, cyy = sum.syy / sum.c - my * my
        const theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy)
        return { mx, my, ux: Math.cos(theta), uy: Math.sin(theta) }
      }
      const resOf = (p: Vec2Px, f: Fit) => (p[0] - f.mx) * -f.uy + (p[1] - f.my) * f.ux
      let i = 0
      while (i < n) {
        if (snapped[i]) { i++; continue }
        // seed: SEED samples that already fit a tight band
        resetSum()
        for (let s = 0; s < SEED; s++) addP(at(i + s))
        let f = fitOf()
        let seedOk = true
        for (let s = 0; s < SEED; s++) if (Math.abs(resOf(at(i + s), f)) > tol * 0.75) { seedOk = false; break }
        if (!seedOk) { i += SEED >> 1; continue }
        // grow forward, then backward. The band is WIDER than tol during growth (the seed's line
        // inherits the local wobble slope — up to ~8° — and the refit needs ~a wavelength to
        // converge; a tight band stops mid-straight and fragments the run). Refit every 4 samples.
        const tolGrow = tol * 1.5
        let a = i, b = i + SEED - 1
        while (b - a + 1 < n - 8 && Math.abs(resOf(at(b + 1), f)) <= tolGrow) {
          addP(at(b + 1)); b++
          if (sum.c % 4 === 0) f = fitOf()
        }
        f = fitOf()
        while (b - a + 1 < n - 8 && Math.abs(resOf(at(a - 1), f)) <= tolGrow) {
          addP(at(a - 1)); a--
          if (sum.c % 4 === 0) f = fitOf()
        }
        f = fitOf()
        // strict post-growth validation: on a true (wavy) straight the converged fit holds every
        // sample within ±tol; an arc grown inside the wide band leaves a large fraction outside.
        {
          let viol = 0
          const total = b - a + 1
          for (let k = a; k <= b; k++) if (Math.abs(resOf(at(k), f)) > tol) viol++
          if (viol > total * 0.1) { i += SEED >> 1; continue }
        }
        // trim run ends that rode off into the neighbouring curve (manufacturing bar: the line
        // must hand over to the curve within ~1.5px, not drag a flattened tail into it) — then
        // REFIT on the trimmed run so the creep can't bias the line
        let guard = 0
        while (b - a + 1 > minRunSamples && Math.abs(resOf(at(b), f)) > 1.5 && guard++ < 48) b--
        guard = 0
        while (b - a + 1 > minRunSamples && Math.abs(resOf(at(a), f)) > 1.5 && guard++ < 48) a++
        let len = b - a + 1
        if (len < minRunSamples) { i += SEED >> 1; continue }
        resetSum()
        for (let s = 0; s < len; s++) addP(at(a + s))
        f = fitOf()
        guard = 0
        while (len > minRunSamples && Math.abs(resOf(at(b), f)) > 1.2 && guard++ < 24) { b--; len-- }
        guard = 0
        while (len > minRunSamples && Math.abs(resOf(at(a), f)) > 1.2 && guard++ < 24) { a++; len-- }
        if (len < minRunSamples) { i += SEED >> 1; continue }
        // CURVATURE test on the run INTERIOR (margins excluded: residual creep into the
        // neighbouring curve lives at the ends and would fake a parabola; a true arc curves
        // everywhere). Fit interior residuals to a + b·t + c·t² in the PCA frame: an arc carries
        // a systematic quadratic (c ≈ 1/2R ⇒ sagitta ~2–4px at growth-stop) while wobble's
        // quadratic component averages to ≈0 at any wavelength/phase. (A chord-endpoint bow test
        // fails when both endpoints sit on same-side wobble peaks; a whole-run quad test fails on
        // symmetric end creep — interior-only is immune to both.)
        const margin = Math.max(12, Math.round(18 / spacing))
        const ia = a + margin, ib = b - margin
        if (ib - ia + 1 < minRunSamples) { i += SEED >> 1; continue }
        resetSum()
        for (let k = ia; k <= ib; k++) addP(at(k))
        f = fitOf() // interior-fitted line — creep-free
        let S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0
        let tMin = Infinity, tMax = -Infinity
        const S0 = ib - ia + 1
        for (let k = ia; k <= ib; k++) {
          const p = at(k)
          const t = (p[0] - f.mx) * f.ux + (p[1] - f.my) * f.uy
          const r = resOf(p, f)
          if (t < tMin) tMin = t
          if (t > tMax) tMax = t
          S1 += t; S2 += t * t; S3 += t * t * t; S4 += t * t * t * t
          T0 += r; T1 += r * t; T2 += r * t * t
        }
        // Cramer's rule on the 3×3 normal equations for [a, b, c]
        const det =
          S0 * (S2 * S4 - S3 * S3) - S1 * (S1 * S4 - S3 * S2) + S2 * (S1 * S3 - S2 * S2)
        const detC =
          S0 * (S2 * T2 - S3 * T1) - S1 * (S1 * T2 - S3 * T0) + S2 * (S1 * T1 - S2 * T0)
        const c = det !== 0 ? detC / det : 0
        const h = (tMax - tMin) / 2
        const quadSag = Math.abs(c) * h * h // parabola sagitta over the interior — real curvature
        opts._debugSpans?.({ a, b, len, quadSag: Math.round(quadSag * 100) / 100 })
        // measured separation at tol 4: wobbly straights ≤ ~0.9 (any phase), arcs at growth-stop
        // ≥ ~2.9. The threshold SCALES with the snap band — at a wide band (low Detail) the user
        // has declared bigger wobble to be noise, so its larger quadratic content must still snap
        // (a fixed cut left an 8px-amplitude shadow meander standing at Snap 9.4 — live finding,
        // 2026-06-10); arcs at growth-stop measure ≳ 0.7·tol, so 0.35·tol keeps 2× separation.
        if (quadSag > Math.max(1.2, tol * 0.35)) { i += SEED >> 1; continue } // curving run → leave Gaussian-faired
        for (let s = 0; s < len; s++) {
          const idx = ((a + s) % n + n) % n
          const p = ring[idx]
          const t = (p[0] - f.mx) * f.ux + (p[1] - f.my) * f.uy
          const w = Math.min(1, Math.min(s, len - 1 - s) / 8) // blend the seam into the curve
          ring[idx] = [p[0] + (f.mx + t * f.ux - p[0]) * w, p[1] + (f.my + t * f.uy - p[1]) * w]
          snapped[idx] = true
        }
        i = b + 1
      }
    }
  }
  // hard max-turn: Chaikin corner-cutting over the offender NEIGHBOURHOOD (±2 samples — cutting a
  // lone vertex then resampling just re-sharpens it), with a diffusion pass between iterations.
  for (let pass = 0; pass < 16; pass++) {
    const n = ring.length
    const sharp = new Set<number>()
    for (let i = 0; i < n; i++) {
      if (turnDeg(ring[(i - 1 + n) % n], ring[i], ring[(i + 1) % n]) > maxTurn) {
        for (let k = -2; k <= 2; k++) sharp.add((i + k + n) % n)
      }
    }
    if (sharp.size === 0) break
    const out: Vec2Px[] = []
    for (let i = 0; i < n; i++) {
      if (!sharp.has(i)) { out.push(ring[i]); continue }
      const a = ring[(i - 1 + n) % n], p = ring[i], b = ring[(i + 1) % n]
      out.push([p[0] + (a[0] - p[0]) * 0.25, p[1] + (a[1] - p[1]) * 0.25])
      out.push([p[0] + (b[0] - p[0]) * 0.25, p[1] + (b[1] - p[1]) * 0.25])
    }
    ring = smooth121(resampleClosedUniform(out, spacing))
  }
  // soften the line↔curve seams for the cutter: [1,2,1] is exactly invariant on straights (snapped
  // lines cannot re-wobble) and shrinks arcs negligibly — only seam vertices round.
  return smooth121(smooth121(ring))
}

/**
 * Build editable nodes from a DENSE traced contour (e.g. the BEN mask trace): sparse anchor nodes
 * picked by RDP, with each segment carrying the EXACT dense polyline between its anchors
 * (`segmentToNext.rawPolyline`). The render/manufacture path then follows the TRUE trace —
 * pixel-faithful, no approximation — while editing stays sparse-handle. (The lossy alternative —
 * keep only the anchors and spline between them — clipped corners and wobbled straights: the
 * "micro imperfections" Dan caught 2026-06-10.)
 */
export function nodesFromTracedRing(densePts: Vec2Px[], epsilonPx: number, idPrefix = 'n'): OutlineNode[] {
  const dense = dedup(densePts)
  const n = dense.length
  if (n < 4) {
    return dense.map((p, i) => ({ id: `${idPrefix}${i}`, p: [p[0], p[1]] as Vec2Px, role: 'corner' as const, corner: { mode: 'inherit' as const } }))
  }
  // anchor selection: closed RDP, tracking INDICES into the dense ring
  const anchors = rdpClosed(dense, epsilonPx)
  const key = (p: Vec2Px) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`
  const indexByKey = new Map<string, number>()
  dense.forEach((p, i) => { if (!indexByKey.has(key(p))) indexByKey.set(key(p), i) })
  let idx = anchors.map((p) => indexByKey.get(key(p))).filter((i): i is number => i !== undefined)
  idx = [...new Set(idx)].sort((a, b) => a - b)
  if (idx.length < 3) idx = [0, Math.floor(n / 3), Math.floor((2 * n) / 3)]
  const nodes: OutlineNode[] = []
  for (let k = 0; k < idx.length; k++) {
    const a = idx[k], b = idx[(k + 1) % idx.length]
    const slice: Vec2Px[] = []
    for (let i = a; ; i = (i + 1) % n) { slice.push([dense[i][0], dense[i][1]]); if (i === b) break }
    nodes.push({
      id: `${idPrefix}${k}`,
      p: [dense[a][0], dense[a][1]],
      role: 'livewire_anchor',
      corner: { mode: 'inherit' },
      segmentToNext: { type: 'livewire', rawPolyline: slice },
    })
  }
  return nodes
}

/**
 * Assemble a traced ring from its nodes: each segment's exact rawPolyline, WARPED so its endpoints
 * follow the CURRENT anchor positions (linear-falloff translation along the segment) — an anchor
 * drag locally reshapes the trace instead of discarding it. Segments without a rawPolyline fall
 * back to a straight line.
 */
function assembleTracedRing(nodes: OutlineNode[]): Vec2Px[] {
  const m = nodes.length
  const out: Vec2Px[] = []
  for (let k = 0; k < m; k++) {
    const node = nodes[k]
    const next = nodes[(k + 1) % m]
    const raw = node.segmentToNext?.type === 'livewire' ? node.segmentToNext.rawPolyline : undefined
    if (!raw || raw.length < 2) { out.push([node.p[0], node.p[1]]); continue }
    const a0 = raw[0], b0 = raw[raw.length - 1]
    const dA: Vec2Px = [node.p[0] - a0[0], node.p[1] - a0[1]]
    const dB: Vec2Px = [next.p[0] - b0[0], next.p[1] - b0[1]]
    const L = raw.length - 1
    for (let i = 0; i < L; i++) { // omit the segment's last point (next segment starts with it)
      const t = L > 0 ? i / L : 0
      out.push([raw[i][0] + dA[0] + (dB[0] - dA[0]) * t, raw[i][1] + dA[1] + (dB[1] - dA[1]) * t])
    }
  }
  return out
}

/** Adaptive cubic flattening — recursive De Casteljau subdivision until the control points sit
 *  within `tol` of the chord. The ONLY place curves become points (display picks its own tol;
 *  manufacturing flattens at the cutter's tolerance) — the document stays pure curves. */
export function flattenCubic(p0: Vec2Px, c1: Vec2Px, c2: Vec2Px, p1: Vec2Px, tol: number, out: Vec2Px[], depth = 0): void {
  // flatness: max distance of the control points from the chord
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1]
  const len = Math.hypot(dx, dy) || 1e-9
  const d1 = Math.abs((c1[0] - p0[0]) * dy - (c1[1] - p0[1]) * dx) / len
  const d2 = Math.abs((c2[0] - p0[0]) * dy - (c2[1] - p0[1]) * dx) / len
  if (depth > 16 || Math.max(d1, d2) <= tol) { out.push([p1[0], p1[1]]); return }
  // de Casteljau split at t = 0.5
  const m = (a: Vec2Px, b: Vec2Px): Vec2Px => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const ab = m(p0, c1), bc = m(c1, c2), cd = m(c2, p1)
  const abbc = m(ab, bc), bccd = m(bc, cd)
  const mid = m(abbc, bccd)
  flattenCubic(p0, ab, abbc, mid, tol, out, depth + 1)
  flattenCubic(mid, bccd, cd, p1, tol, out, depth + 1)
}

/** Assemble a CURVE ring (vector core): cubic segments flatten adaptively, lines stay lines.
 *  The document is the truth — anchors + handles; points are derived, never stored. */
function assembleCurveRing(nodes: OutlineNode[], tol: number): Vec2Px[] {
  const m = nodes.length
  const out: Vec2Px[] = []
  for (let k = 0; k < m; k++) {
    const node = nodes[k]
    const next = nodes[(k + 1) % m]
    out.push([node.p[0], node.p[1]])
    const seg = node.segmentToNext
    if (seg?.type === 'cubic') {
      const tail: Vec2Px[] = []
      flattenCubic(node.p, seg.c1, seg.c2, next.p, tol, tail)
      tail.pop() // next anchor opens the next segment
      out.push(...tail)
    }
  }
  return out
}

/** TRUE-vector SVG path for a ring: C commands for cubic segments, L for lines, the dense
 *  polyline for traced segments. What the editor renders IS the curve — no facets at any zoom. */
export function svgPathFromNodes(nodes: OutlineNode[]): string {
  if (!nodes.length) return ''
  const f = (v: number) => (Math.round(v * 100) / 100).toString()
  let d = `M ${f(nodes[0].p[0])} ${f(nodes[0].p[1])}`
  const m = nodes.length
  for (let k = 0; k < m; k++) {
    const node = nodes[k]
    const next = nodes[(k + 1) % m]
    const seg = node.segmentToNext
    if (seg?.type === 'cubic') {
      d += ` C ${f(seg.c1[0])} ${f(seg.c1[1])} ${f(seg.c2[0])} ${f(seg.c2[1])} ${f(next.p[0])} ${f(next.p[1])}`
    } else if (seg?.type === 'livewire' && seg.rawPolyline.length > 1) {
      for (const [x, y] of seg.rawPolyline.slice(1)) d += ` L ${f(x)} ${f(y)}`
      d += ` L ${f(next.p[0])} ${f(next.p[1])}`
    } else {
      d += ` L ${f(next.p[0])} ${f(next.p[1])}`
    }
  }
  return d + ' Z'
}

/** Gentle closed-ring Laplacian smoothing — the Smooth control for dense traced rings. */
function laplacianClosed(pts: Vec2Px[], iterations: number): Vec2Px[] {
  let cur = pts
  const n = pts.length
  if (n < 5) return pts
  for (let it = 0; it < iterations; it++) {
    const next: Vec2Px[] = new Array(n)
    for (let i = 0; i < n; i++) {
      const p = cur[i], a = cur[(i - 1 + n) % n], b = cur[(i + 1) % n]
      next[i] = [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4]
    }
    cur = next
  }
  return cur
}

// ─── top-level resolve ───────────────────────────────────────────────────────

export interface ResolveOptions {
  /** Manufacturing-profile flatten tolerance in source px (NEVER screen zoom). */
  flattenTolerancePx: number
}

/**
 * Resolve an OutlineDocument into resolved + flattened, normalized cut polygons (px), with
 * self-intersection locators. The deterministic core shared by the client worker, the (future)
 * server canonical compiler, and the golden tests (AMEND-C9).
 */
export function resolveOutlineDocument(doc: OutlineDocument, opts: ResolveOptions): ResolvedOutline {
  const tol = opts.flattenTolerancePx
  const resolvedRingsPx: Vec2Px[][] = []
  const flattenedRingsPx: Vec2Px[][] = []
  const issues: EditorValidationIssue[] = []
  const locators: GeometryLocator[] = []
  let anyRadius = false

  for (const ring of doc.rings) {
    const traced = ring.nodes.some((nd) => nd.segmentToNext?.type === 'livewire')
    const curved = !traced && ring.nodes.some((nd) => nd.segmentToNext?.type === 'cubic')
    let resolved: Vec2Px[]
    if (curved) {
      // VECTOR CORE: the ring is true curves (anchors + cubic handles) — flatten adaptively for
      // geometry; the editor renders the curves directly (svgPathFromNodes). Radii/smoothing
      // don't apply: curve shapes are exact by construction.
      resolved = assembleCurveRing(ring.nodes, 0.1)
    } else if (traced) {
      // EXACT path: the ring follows its dense traced contour (segment rawPolylines), warped to the
      // current anchor positions. Smooth = Laplacian passes over the dense ring (organic softening
      // that stays on the trace). Corner radii don't apply to traced joints.
      resolved = assembleTracedRing(ring.nodes)
      if (doc.style.smoothing > 0) resolved = laplacianClosed(resolved, Math.round(doc.style.smoothing * 10))
    } else {
      const filleted = applyCornerRadii(ring.nodes, doc.style.globalOutlineCornerRadiusPx)
      if (filleted.length !== ring.nodes.length) anyRadius = true
      // Smooth (0..1) = centripetal Catmull-Rom over the (filleted) ring — curve interpolation
      // between sparse control nodes; Round handles exact corner rounding separately.
      resolved = doc.style.smoothing > 0
        ? catmullRomClosed(filleted, Math.round(4 + doc.style.smoothing * 12))
        : filleted
    }
    const flat = normalizeRing(flattenPath(resolved, tol), ring.role)
    resolvedRingsPx.push(resolved)
    flattenedRingsPx.push(flat)

    const selfHits = validateSelfIntersection(flat, ring.id)
    if (selfHits.length) {
      locators.push(...selfHits)
      issues.push({
        code: 'SELF_INTERSECTION',
        subsystem: 'outline-core',
        severity: 'block',
        repairability: 'manual',
        locators: selfHits,
        source: 'client_preview',
      })
    }
  }

  const policy: ResolvedOutlinePolicy = {
    smoothing_applied: doc.style.smoothing > 0,
    corner_radii_applied: anyRadius || doc.style.globalOutlineCornerRadiusPx > 0,
    // per-node radii are applied here → the engine's global filletCorners must NOT run again
    downstream_corner_rounding: 'disabled',
  }

  return {
    outlineDocumentHash: outlineDocumentHash(doc),
    resolvedRingsPx,
    flattenedRingsPx,
    flattenTolerancePx: tol,
    policy,
    locators,
    issues,
  }
}
