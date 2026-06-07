// Owned marching-squares contour tracer + RDP simplify (Lane A / Kai)
// Per FINAL-SPEC: marching-squares (iso 0.5) → ring hierarchy + winding norm; RDP simplify.
// Binary mask → midpoint isolines (no subpixel needed for a 0/1 field). OpenCV is the QA oracle
// (not bundled here). Output is in PIXEL coordinates; the pipeline maps px → mm.

import * as THREE from 'three'
import type { Pt, Ring, Contour } from './types'

type Seg = { a: Pt; b: Pt }

const key = (p: Pt) => `${p[0]},${p[1]}`

/** Sample mask with zero-padding so border foreground still produces a closed loop. */
function sampler(mask: Uint8Array, w: number, h: number) {
  return (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x])
}

/** Generate marching-squares segments over the padded grid. */
function segments(mask: Uint8Array, w: number, h: number): Seg[] {
  const at = sampler(mask, w, h)
  const segs: Seg[] = []
  // grid of corners runs from -1..w (so border is enclosed)
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const tl = at(x, y)
      const tr = at(x + 1, y)
      const br = at(x + 1, y + 1)
      const bl = at(x, y + 1)
      const idx = (tl << 0) | (tr << 1) | (br << 2) | (bl << 3)
      if (idx === 0 || idx === 15) continue
      // edge midpoints (in px corner space; corner (x,y) sits at pixel-center grid)
      const top: Pt = [x + 0.5, y]
      const right: Pt = [x + 1, y + 0.5]
      const bottom: Pt = [x + 0.5, y + 1]
      const left: Pt = [x, y + 0.5]
      const push = (a: Pt, b: Pt) => segs.push({ a, b })
      switch (idx) {
        case 1: push(left, top); break
        case 2: push(top, right); break
        case 3: push(left, right); break
        case 4: push(right, bottom); break
        case 5: push(left, top); push(right, bottom); break // saddle (fixed resolution)
        case 6: push(top, bottom); break
        case 7: push(left, bottom); break
        case 8: push(bottom, left); break
        case 9: push(bottom, top); break
        case 10: push(top, right); push(bottom, left); break // saddle
        case 11: push(bottom, right); break
        case 12: push(right, left); break
        case 13: push(right, top); break
        case 14: push(top, left); break
      }
    }
  }
  return segs
}

/** Stitch undirected segments into closed loops by endpoint matching. */
function stitch(segs: Seg[]): Pt[][] {
  const adj = new Map<string, { pt: Pt; other: Pt; used: boolean }[]>()
  const add = (p: Pt, other: Pt) => {
    const k = key(p)
    if (!adj.has(k)) adj.set(k, [])
    adj.get(k)!.push({ pt: p, other, used: false })
  }
  for (const s of segs) { add(s.a, s.b); add(s.b, s.a) }

  const loops: Pt[][] = []
  const visitedEdge = new Set<string>()
  const edgeKey = (a: Pt, b: Pt) => {
    const ka = key(a), kb = key(b)
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
  }

  for (const s of segs) {
    const ek0 = edgeKey(s.a, s.b)
    if (visitedEdge.has(ek0)) continue
    const loop: Pt[] = [s.a]
    let prev = s.a
    let cur = s.b
    visitedEdge.add(ek0)
    let guard = 0
    while (key(cur) !== key(loop[0]) && guard++ < 1e6) {
      loop.push(cur)
      const cands = adj.get(key(cur)) || []
      let next: Pt | null = null
      for (const c of cands) {
        const ek = edgeKey(cur, c.other)
        if (visitedEdge.has(ek)) continue
        if (key(c.other) === key(prev)) continue
        next = c.other
        visitedEdge.add(ek)
        break
      }
      if (!next) {
        // dead-end fallback: try any unused incident edge
        for (const c of cands) {
          const ek = edgeKey(cur, c.other)
          if (!visitedEdge.has(ek)) { next = c.other; visitedEdge.add(ek); break }
        }
      }
      if (!next) break
      prev = cur
      cur = next
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

function signedArea(pts: Pt[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

function pointInPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const intersect = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Remove consecutive duplicate / near-coincident points (incl. the wrap) — avoids spike artifacts. */
export function dedup(pts: Pt[], eps = 1e-3): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    const q = out[out.length - 1]
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push(p)
  }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= eps) out.pop()
  return out
}

function perimeter(pts: Pt[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    s += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return s
}

/**
 * Closed Catmull-Rom resample → genuinely smooth (C1) curve around the WHOLE loop, seam included.
 * `pts` are key points (RDP); we resample at ~one point per `spacingPx` for a high-res smooth contour.
 */
export function smoothClosed(pts: Pt[], spacingPx: number): Pt[] {
  if (pts.length < 4) return pts
  const v = pts.map((p) => new THREE.Vector3(p[0], p[1], 0))
  const curve = new THREE.CatmullRomCurve3(v, true, 'centripetal')
  const n = Math.max(32, Math.min(3000, Math.round(perimeter(pts) / Math.max(0.5, spacingPx))))
  return curve.getSpacedPoints(n).map((q) => [q.x, q.y] as Pt)
}

/** Chaikin corner-cutting on a closed ring — turns marching-squares stair-steps into smooth curves. */
export function chaikin(pts: Pt[], iterations: number): Pt[] {
  let p = pts
  for (let k = 0; k < iterations; k++) {
    const n = p.length
    if (n < 3) break
    const out: Pt[] = []
    for (let i = 0; i < n; i++) {
      const a = p[i]
      const b = p[(i + 1) % n]
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]])
      out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]])
    }
    p = out
  }
  return p
}

/**
 * HARD CORNER RULE: no corner may stay sharper than `minAngleDeg`. For each vertex whose interior
 * angle is below the threshold (too acute), cut the corner (replace it with two points pulled toward
 * its neighbours); gentle corners (angle ≥ threshold) are left untouched, so cape waves/curves keep
 * their detail while genuine spikes get rounded. Iterated so even very acute corners are tamed; the
 * Catmull-Rom resample afterwards turns each cut into a smooth arc.
 */
export function clampSharpCorners(pts: Pt[], minAngleDeg: number, cut = 0.4, iterations = 8): Pt[] {
  if (minAngleDeg <= 0) return pts
  const minCos = Math.cos((minAngleDeg * Math.PI) / 180) // interior angle < threshold ⇔ cos > minCos
  let p = pts
  for (let it = 0; it < iterations; it++) {
    const n = p.length
    if (n < 4) break
    const out: Pt[] = []
    let changed = false
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n], v = p[i], b = p[(i + 1) % n]
      const v1x = a[0] - v[0], v1y = a[1] - v[1]
      const v2x = b[0] - v[0], v2y = b[1] - v[1]
      const l1 = Math.hypot(v1x, v1y) || 1, l2 = Math.hypot(v2x, v2y) || 1
      const cos = (v1x * v2x + v1y * v2y) / (l1 * l2) // +1 = very acute spike, -1 = straight
      if (cos > minCos) { // sharper than allowed → cut the corner into two gentler points
        out.push([v[0] + cut * v1x, v[1] + cut * v1y])
        out.push([v[0] + cut * v2x, v[1] + cut * v2y])
        changed = true
      } else {
        out.push(v)
      }
    }
    p = out
    if (!changed) break
  }
  return p
}

/**
 * CORNER FILLET: replace every corner sharper than `minAngleDeg` with a true circular ARC of radius
 * `radiusPx` tangent to both edges (clamped so neighbouring fillets don't overlap). This gives a
 * generous, controllable, manufacturable corner radius — "round corners properly" — for ANY image,
 * unlike proportional corner-cutting. Gentle corners (≥ threshold) pass through untouched.
 */
export function filletCorners(pts: Pt[], radiusPx: number, minAngleDeg: number, steps = 10): Pt[] {
  if (radiusPx <= 0 || minAngleDeg <= 0) return pts
  const n = pts.length
  if (n < 3) return pts
  const minCos = Math.cos((minAngleDeg * Math.PI) / 180)
  const acuteCos = Math.cos((70 * Math.PI) / 180) // < 70° = sharp spike (e.g. bat ears): own radius, NOT part of the uniform set
  // Pass 1: geometry + each fillet-able corner's MAX fittable radius (limited by its shorter edge).
  type CI = { v: Pt; u1x: number; u1y: number; u2x: number; u2y: number; cosA: number; half: number; maxR: number; fillet: boolean }
  const info: CI[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], v = pts[i], b = pts[(i + 1) % n]
    const d1x = a[0] - v[0], d1y = a[1] - v[1]
    const d2x = b[0] - v[0], d2y = b[1] - v[1]
    const l1 = Math.hypot(d1x, d1y) || 1, l2 = Math.hypot(d2x, d2y) || 1
    const u1x = d1x / l1, u1y = d1y / l1, u2x = d2x / l2, u2y = d2y / l2
    const cosA = u1x * u2x + u1y * u2y
    const half = Math.acos(Math.max(-1, Math.min(1, cosA))) / 2
    const maxR = 0.8 * Math.min(l1, l2) * Math.tan(half) // biggest radius that fits this corner (uses most of the shorter edge → larger default round)
    info.push({ v, u1x, u1y, u2x, u2y, cosA, half, maxR, fillet: cosA > minCos })
  }
  // Per-corner radius: same-ANGLE corners get the SAME radius (so the two 90° crop corners match each
  // other), capped to the largest that fits within that angle group — WITHOUT a tight unrelated corner
  // (e.g. a neck notch at a different angle) dragging them down. Sliding ±15° window over the broad
  // corners (70°..threshold). Sharp spikes (< 70°, ears) keep their own per-corner radius.
  const RAD = Math.PI / 180
  const groupR = (i: number): number => {
    const ai = Math.acos(Math.max(-1, Math.min(1, info[i].cosA))) / RAD
    let m = radiusPx
    for (const it of info) {
      if (!it.fillet || it.cosA >= acuteCos) continue
      const aj = Math.acos(Math.max(-1, Math.min(1, it.cosA))) / RAD
      if (Math.abs(aj - ai) <= 15) m = Math.min(m, it.maxR)
    }
    return m
  }
  // Pass 2: emit arcs.
  const out: Pt[] = []
  for (let i = 0; i < info.length; i++) {
    const it = info[i]
    if (!it.fillet) { out.push(it.v); continue }
    const isSpike = it.cosA >= acuteCos
    const R = isSpike ? Math.min(radiusPx, it.maxR) : groupR(i)
    const t = R / Math.tan(it.half)
    const { v, u1x, u1y, u2x, u2y, half } = it
    const p1: Pt = [v[0] + u1x * t, v[1] + u1y * t]
    const p2: Pt = [v[0] + u2x * t, v[1] + u2y * t]
    let bx = u1x + u2x, by = u1y + u2y
    const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl
    const cx = v[0] + bx * (R / Math.sin(half)), cy = v[1] + by * (R / Math.sin(half))
    const a1 = Math.atan2(p1[1] - cy, p1[0] - cx)
    const a2 = Math.atan2(p2[1] - cy, p2[0] - cx)
    let da = a2 - a1
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    for (let s = 0; s <= steps; s++) {
      const ang = a1 + da * (s / steps)
      out.push([cx + R * Math.cos(ang), cy + R * Math.sin(ang)])
    }
  }
  return out
}

/** Ramer–Douglas–Peucker, epsilon in the same units as pts. */
export function rdp(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length < 3) return pts
  const sqEps = epsilon * epsilon
  const perpSq = (p: Pt, a: Pt, b: Pt) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    if (len2 === 0) { const ex = p[0] - a[0], ey = p[1] - a[1]; return ex * ex + ey * ey }
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const px = a[0] + t * dx, py = a[1] + t * dy
    const ex = p[0] - px, ey = p[1] - py
    return ex * ex + ey * ey
  }
  const simplifyRange = (s: number, e: number, out: Pt[]) => {
    let maxd = 0, idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = perpSq(pts[i], pts[s], pts[e])
      if (d > maxd) { maxd = d; idx = i }
    }
    if (maxd > sqEps && idx > 0) {
      simplifyRange(s, idx, out)
      out.push(pts[idx])
      simplifyRange(idx, e, out)
    }
  }
  const out: Pt[] = [pts[0]]
  simplifyRange(0, pts.length - 1, out)
  out.push(pts[pts.length - 1])
  return out
}

/**
 * CLOSED-loop RDP. Plain `rdp` force-keeps pts[0]/pts[last] and never simplifies the closing segment,
 * so whatever corner the stitch-seam lands on is handled differently from the rest (that was the
 * "right corner rounds, left stays straight" asymmetry — the left corner sat on the RDP seam). Here we
 * split the loop at pts[0] and the point farthest from it, RDP both halves, and recombine — every
 * corner (incl. the seam) becomes a clean vertex, so the fillet rounds them all equally.
 */
export function rdpClosed(pts: Pt[], epsilon: number): Pt[] {
  const n = pts.length
  if (n < 4) return pts
  let f = 1, fd = -1
  for (let k = 1; k < n; k++) {
    const d = (pts[k][0] - pts[0][0]) ** 2 + (pts[k][1] - pts[0][1]) ** 2
    if (d > fd) { fd = d; f = k }
  }
  const a = rdp(pts.slice(0, f + 1), epsilon)            // pts[0]..pts[f]
  const b = rdp(pts.slice(f).concat([pts[0]]), epsilon)  // pts[f]..pts[0] (closing half)
  return a.slice(0, -1).concat(b.slice(0, -1))           // drop shared endpoints → closed key set
}

export interface ContourResult {
  contour: Contour
  rawNodes: number
  simplifiedNodes: number
}

/**
 * Build a simplified contour (outer + holes) in pixel space.
 * Largest loop = outer; loops contained inside it with meaningful area = holes.
 */
export function buildContour(
  mask: Uint8Array,
  w: number,
  h: number,
  epsilonPx: number,
  minCornerAngleDeg = 0,
  cornerRadiusPx = 0
): ContourResult | null {
  const loops = stitch(segments(mask, w, h)).filter((l) => l.length >= 3)
  if (!loops.length) return null

  const withArea = loops.map((pts) => ({ pts, area: Math.abs(signedArea(pts)) }))
  withArea.sort((a, b) => b.area - a.area)
  const outerRaw = withArea[0]
  const minHoleArea = outerRaw.area * 0.01 // ignore specks
  const holesRaw = withArea
    .slice(1)
    .filter((l) => l.area >= minHoleArea && pointInPoly(l.pts[0], outerRaw.pts))

  const rawNodes = outerRaw.pts.length + holesRaw.reduce((s, r) => s + r.pts.length, 0)

  // normalize winding: outer CCW (area > 0), holes CW (area < 0)
  const orient = (pts: Pt[], wantCCW: boolean): Pt[] => {
    const ccw = signedArea(pts) > 0
    return ccw === wantCCW ? pts : [...pts].reverse()
  }

  // ORDER MATTERS: RDP FIRST (clean the marching-squares staircase to key points), then Chaikin
  // LAST so the final contour is genuinely smooth curves — NOT straight chords. (Doing RDP after
  // Chaikin re-polygonised the curve = the choppiness.) Draco handles file size later.
  // RDP → key points → CLOSED Catmull-Rom resample (uniform, C1 smooth around the whole loop).
  // HARD CORNER RULE: clamp any corner sharper than `minCornerAngleDeg` on the RDP key points BEFORE
  // the spline (Catmull-Rom interpolates through its points, so a raw sharp vertex would survive).
  // Selective — only acute spikes are cut; gentle curves keep their detail. 0 = disabled.
  const spacingPx = Math.max(1.5, epsilonPx * 0.75)
  const smooth = (pts: Pt[], ccw: boolean) => {
    const keys = dedup(rdpClosed(orient(pts, ccw), epsilonPx))
    // Generous corner FILLET (true radius arc) for corners sharper than threshold → "round properly".
    let rounded = (cornerRadiusPx > 0 && minCornerAngleDeg > 0)
      ? dedup(filletCorners(keys, cornerRadiusPx, minCornerAngleDeg))
      : keys
    // Put the closed-spline SEAM on the LONGEST (flattest) edge so its closure runs across a straight
    // segment — never on a corner. (Root cause of "left corner sharp, right fine": the seam sat on the
    // bottom-left corner; on a flat edge the closure leaves no visible kink, and all corners fillet evenly.)
    const m = rounded.length
    if (m > 3) {
      let jMax = 0, dMax = -1
      for (let k = 0; k < m; k++) {
        const a = rounded[k], b = rounded[(k + 1) % m]
        const d = Math.hypot(b[0] - a[0], b[1] - a[1])
        if (d > dMax) { dMax = d; jMax = k }
      }
      const start = (jMax + 1) % m
      if (start > 0) rounded = rounded.slice(start).concat(rounded.slice(0, start))
    }
    return dedup(smoothClosed(rounded, spacingPx))
  }
  const outerPts = smooth(outerRaw.pts, true)
  const holes: Ring[] = holesRaw.map((hRaw) => ({ pts: smooth(hRaw.pts, false) }))

  const outer: Ring = { pts: outerPts }
  const simplifiedNodes = outerPts.length + holes.reduce((s, r) => s + r.pts.length, 0)
  return { contour: { outer, holes }, rawNodes, simplifiedNodes }
}
