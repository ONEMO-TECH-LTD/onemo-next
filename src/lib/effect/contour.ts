// Owned marching-squares contour TRACER (Lane A / Kai) — ONE-ENGINE (§8.2b-2: fork retired).
//
// Binary mask → marching-squares (iso 0.5) midpoint isolines → stitched closed loops → the largest
// outer ring (CCW), as a RAW pixel ring. NO RDP, NO corner fillet, NO Catmull-Rom smoothing — all of
// that (simplification, corner-rounding, smoothing, winding, self-intersection) is routed through the
// single deterministic `outline-core` engine by `prepareEffect`, so the screen, the 3D mesh, and the
// cutline can never disagree (no double-round). This file is pure + three-free.

import type { Pt } from './types'

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

/**
 * TRACER (one-engine, §8.2): marching-squares → stitch → largest loop → outer-CCW → RAW pixel ring.
 * NO RDP, NO fillet, NO Catmull-Rom smoothing — `prepareEffect` consumes this raw ring and routes ALL
 * simplification + corner-rounding + smoothing through `outline-core` (the single deterministic engine),
 * so the screen, the 3D mesh, and the cutline can never disagree. Holes dropped (solid effect, per Dan).
 * Returns null if no silhouette.
 */
export function traceContourRaw(mask: Uint8Array, w: number, h: number): Pt[] | null {
  const loops = stitch(segments(mask, w, h)).filter((l) => l.length >= 3)
  if (!loops.length) return null
  let best = loops[0], bestArea = Math.abs(signedArea(loops[0]))
  for (const l of loops) {
    const a = Math.abs(signedArea(l))
    if (a > bestArea) { best = l; bestArea = a }
  }
  const ccw = signedArea(best) > 0 ? best : [...best].reverse() // normalize outer → CCW
  return dedup(ccw)
}
