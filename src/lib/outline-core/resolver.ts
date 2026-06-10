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
    const filleted = applyCornerRadii(ring.nodes, doc.style.globalOutlineCornerRadiusPx)
    if (filleted.length !== ring.nodes.length) anyRadius = true
    // Smooth (0..1) = Catmull-Rom spline resample over the (filleted) ring — organic softening
    // that interpolates CURVES between control nodes (kills the chord facets on BEN outlines).
    // Density scales with the value; Round handles exact corner rounding separately.
    const resolved = doc.style.smoothing > 0
      ? catmullRomClosed(filleted, Math.round(4 + doc.style.smoothing * 12))
      : filleted
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
