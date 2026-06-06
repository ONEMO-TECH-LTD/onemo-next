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
  epsilonPx: number
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
  const spacingPx = Math.max(1.5, epsilonPx * 0.75)
  const smooth = (pts: Pt[], ccw: boolean) => dedup(smoothClosed(dedup(rdp(orient(pts, ccw), epsilonPx)), spacingPx))
  const outerPts = smooth(outerRaw.pts, true)
  const holes: Ring[] = holesRaw.map((hRaw) => ({ pts: smooth(hRaw.pts, false) }))

  const outer: Ring = { pts: outerPts }
  const simplifiedNodes = outerPts.length + holes.reduce((s, r) => s + r.pts.length, 0)
  return { contour: { outer, holes }, rawNodes, simplifiedNodes }
}
