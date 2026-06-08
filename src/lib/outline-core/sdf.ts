// outline-core/sdf.ts — 0→100% square↔silhouette blend via SDF morphing (A2b · AMEND-C5).
//
// Vertex/radial interpolation between two outlines twists and self-intersects on concave shapes
// (no point correspondence). Signed-distance-field morphing doesn't:
//   φt(x) = (1−t)·φ_from(x) + t·φ_to(x)  →  trace the zero-level contour.
// t=0 → exact `from` rings, t=1 → exact `to` rings (endpoint bypass, AMEND-C5); only 0<t<1 runs SDF.
//
// Pure + deterministic: rasterize each shape to a grid, two-pass chamfer signed distance, blend,
// marching-squares (linear-interpolated zero crossing), grid→source px. No DOM, no Date.now.

import type { Vec2Px } from './types'

export interface SdfBlendParams {
  fromRings: Vec2Px[][] // source px (e.g. the square / rounded-rect)
  toRings: Vec2Px[][] // source px (e.g. the BEN2 silhouette)
  t: number // 0..1
  /** raster domain in source px (covers both shapes). */
  domain: { minX: number; minY: number; width: number; height: number }
  /** grid resolution on the longest domain side (default 200). */
  grid?: number
}

const INF = 1e9

/** Even-odd point-in-rings test (handles holes). */
function pointInRings(px: number, py: number, rings: Vec2Px[][]): boolean {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j]
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

/** Rasterize rings → binary mask (1 inside) on a GW×GH grid mapping src px → cell centers. */
function rasterize(rings: Vec2Px[][], GW: number, GH: number, d: SdfBlendParams['domain']): Uint8Array {
  const mask = new Uint8Array(GW * GH)
  const sx = d.width / GW, sy = d.height / GH
  for (let gy = 0; gy < GH; gy++) {
    const py = d.minY + (gy + 0.5) * sy
    for (let gx = 0; gx < GW; gx++) {
      const px = d.minX + (gx + 0.5) * sx
      if (pointInRings(px, py, rings)) mask[gy * GW + gx] = 1
    }
  }
  return mask
}

/** Two-pass chamfer distance transform → distance (in cells) to the nearest cell where mask===target. */
function chamfer(mask: Uint8Array, GW: number, GH: number, target: number): Float32Array {
  const d = new Float32Array(GW * GH)
  for (let i = 0; i < d.length; i++) d[i] = mask[i] === target ? 0 : INF
  const A = 1, B = Math.SQRT2
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= GW || y >= GH ? INF : d[y * GW + x])
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x
    d[i] = Math.min(d[i], at(x - 1, y) + A, at(x, y - 1) + A, at(x - 1, y - 1) + B, at(x + 1, y - 1) + B)
  }
  for (let y = GH - 1; y >= 0; y--) for (let x = GW - 1; x >= 0; x--) {
    const i = y * GW + x
    d[i] = Math.min(d[i], at(x + 1, y) + A, at(x, y + 1) + A, at(x + 1, y + 1) + B, at(x - 1, y + 1) + B)
  }
  return d
}

/** Signed distance field (negative inside) for a binary mask. */
function signedField(mask: Uint8Array, GW: number, GH: number): Float32Array {
  const distOut = chamfer(mask, GW, GH, 1) // dist to nearest foreground (for outside cells)
  const distIn = chamfer(mask, GW, GH, 0) // dist to nearest background (for inside cells)
  const phi = new Float32Array(GW * GH)
  for (let i = 0; i < phi.length; i++) phi[i] = mask[i] ? -distIn[i] : distOut[i]
  return phi
}

/** Marching-squares at iso=0 over a float field, linear-interpolated → stitched closed loops (cell coords). */
function marchZero(phi: Float32Array, GW: number, GH: number): Vec2Px[][] {
  type Seg = [Vec2Px, Vec2Px]
  const segs: Seg[] = []
  const v = (x: number, y: number) => phi[y * GW + x]
  const interp = (x1: number, y1: number, v1: number, x2: number, y2: number, v2: number): Vec2Px => {
    const t = v1 / (v1 - v2)
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]
  }
  for (let y = 0; y < GH - 1; y++) {
    for (let x = 0; x < GW - 1; x++) {
      const tl = v(x, y), tr = v(x + 1, y), br = v(x + 1, y + 1), bl = v(x, y + 1)
      let idx = 0
      if (tl < 0) idx |= 1
      if (tr < 0) idx |= 2
      if (br < 0) idx |= 4
      if (bl < 0) idx |= 8
      if (idx === 0 || idx === 15) continue
      const top = () => interp(x, y, tl, x + 1, y, tr)
      const right = () => interp(x + 1, y, tr, x + 1, y + 1, br)
      const bottom = () => interp(x, y + 1, bl, x + 1, y + 1, br)
      const left = () => interp(x, y, tl, x, y + 1, bl)
      const push = (a: Vec2Px, b: Vec2Px) => segs.push([a, b])
      switch (idx) {
        case 1: case 14: push(left(), top()); break
        case 2: case 13: push(top(), right()); break
        case 3: case 12: push(left(), right()); break
        case 4: case 11: push(right(), bottom()); break
        case 6: case 9: push(top(), bottom()); break
        case 7: case 8: push(left(), bottom()); break
        case 5: push(left(), top()); push(right(), bottom()); break
        case 10: push(top(), right()); push(bottom(), left()); break
      }
    }
  }
  // stitch by endpoint proximity (quantized keys)
  const key = (p: Vec2Px) => `${Math.round(p[0] * 16)},${Math.round(p[1] * 16)}`
  const adj = new Map<string, Vec2Px[]>()
  for (const [a, b] of segs) {
    ;(adj.get(key(a)) ?? adj.set(key(a), []).get(key(a))!).push(b)
    ;(adj.get(key(b)) ?? adj.set(key(b), []).get(key(b))!).push(a)
  }
  const used = new Set<string>()
  const loops: Vec2Px[][] = []
  for (const [a, b] of segs) {
    const ek = `${key(a)}|${key(b)}`
    if (used.has(ek) || used.has(`${key(b)}|${key(a)}`)) continue
    const loop: Vec2Px[] = [a]
    let prev = a, cur = b, guard = 0
    used.add(ek); used.add(`${key(b)}|${key(a)}`)
    while (key(cur) !== key(loop[0]) && guard++ < 100000) {
      loop.push(cur)
      const cands = adj.get(key(cur)) ?? []
      let next: Vec2Px | null = null
      for (const c of cands) {
        if (key(c) === key(prev)) continue
        const k2 = `${key(cur)}|${key(c)}`
        if (used.has(k2)) continue
        next = c; used.add(k2); used.add(`${key(c)}|${key(cur)}`); break
      }
      if (!next) break
      prev = cur; cur = next
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

function ringArea(pts: Vec2Px[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1 }
  return Math.abs(a / 2)
}

/**
 * Morph between `fromRings` (t=0) and `toRings` (t=1) via SDF blending. Returns the blended rings in
 * SOURCE px (largest loop first). Endpoints bypass the SDF for exactness.
 */
export function resolveSdfBlend(params: SdfBlendParams): Vec2Px[][] {
  const { fromRings, toRings, t, domain } = params
  if (t <= 0.0001) return fromRings.map((r) => r.map((p) => [p[0], p[1]] as Vec2Px))
  if (t >= 0.9999) return toRings.map((r) => r.map((p) => [p[0], p[1]] as Vec2Px))

  // Pad the raster domain so neither shape touches the grid edge. A shape that fills the frame
  // (e.g. the full-image "square") otherwise has a degenerate SDF (zero only at the boundary), and
  // the blend SNAPS to the other shape instead of easing through it. Margin gives both SDFs a real
  // outside region so φt's zero-level sweeps smoothly between them.
  const margin = Math.max(domain.width, domain.height) * 0.2
  const dom = {
    minX: domain.minX - margin,
    minY: domain.minY - margin,
    width: domain.width + 2 * margin,
    height: domain.height + 2 * margin,
  }
  const G = Math.max(48, Math.min(400, params.grid ?? 200))
  const aspect = dom.height / dom.width
  const GW = aspect >= 1 ? Math.round(G / aspect) : G
  const GH = aspect >= 1 ? G : Math.round(G * aspect)

  const phiFrom = signedField(rasterize(fromRings, GW, GH, dom), GW, GH)
  const phiTo = signedField(rasterize(toRings, GW, GH, dom), GW, GH)
  const phi = new Float32Array(GW * GH)
  for (let i = 0; i < phi.length; i++) phi[i] = (1 - t) * phiFrom[i] + t * phiTo[i]

  const loops = marchZero(phi, GW, GH)
  if (!loops.length) return toRings
  // grid cell coords → source px
  const sx = dom.width / GW, sy = dom.height / GH
  const toSrc = (ring: Vec2Px[]) => ring.map(([gx, gy]) => [dom.minX + (gx + 0.5) * sx, dom.minY + (gy + 0.5) * sy] as Vec2Px)
  const rings = loops.map(toSrc)
  rings.sort((a, b) => ringArea(b) - ringArea(a)) // largest (outer) first
  return rings
}
