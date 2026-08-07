// outline-core/resolver.ts — live ring/curve geometry math (the narrow active surface, re-exported
// via ./math + ./index). Pure + deterministic (no DOM, no three.js, no Date.now): RDP simplification,
// closed-ring fairing (Detail), centripetal Catmull-Rom smoothing, winding normalization (outer CCW,
// holes CW), self-intersection detection + repair.
//
// The OutlineDocument document-runtime this file used to resolve was removed in the v5.5.1 de-slop —
// VShape is the source of truth (DEC-v5-02 / DEC-v5-03); the kernel direction is Paper.js/Clipper2.

import type {
  OutlineRing,
  Vec2Px,
  GeometryLocator,
} from './types'

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

/** Uniform arc-length resample of a closed ring (pure; used by the fairing pipeline + the Simplify
 *  adjustor's fit densification). */
export function resampleClosedUniform(pts: Vec2Px[], spacingPx: number): Vec2Px[] {
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
        // FORWARD PROGRESS, always: backward growth + end trims can leave b BEHIND i, and
        // `i = b + 1` then walked the cursor backwards into an infinite re-seed cycle —
        // the hard page freeze Dan hit on the Detail dial (2026-06-11, reproduced headlessly).
        i = Math.max(i + 1, b + 1)
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
