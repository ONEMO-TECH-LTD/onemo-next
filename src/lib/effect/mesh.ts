// Custom shaped-effect BufferGeometry (Lane A / Kai)
// Per FINAL-SPEC: custom three.js BufferGeometry (NOT ExtrudeGeometry) — front/back caps + a
// rounded edge band. AMEND-8: the edge is a REAL convex rounded fillet (radius r), NOT a flat
// angled bevel. Front planar UV ("cut the geometry, not the texture"). Three material groups:
// 0 = front cap (artwork/bled suede), 1 = edge lip (matte copy, same image), 2 = back
// (solid back-colour suede).
//
// Coordinates: contour arrives in mm with the image's top-left origin. UV is derived from each
// vertex's mm position back into the source image [0,1] so the texture stays registered to the
// cut. Positions are centred on the bbox so the object sits at the scene origin.

import * as THREE from 'three'
import type { Contour, Pt } from './types'

export interface MeshOptions {
  thicknessMM: number    // body thickness (~0.8)
  edgeRadiusMM: number   // SHORT rounded-edge fillet radius (~0.15) — tangent to the flat face
  edgeSegments: number   // fillet rounding segments
  mmPerPx: number        // mm per source pixel (for UV back-projection)
  imgW: number
  imgH: number
}

interface ProfileSample { radial: number; z: number; nr: number; nz: number }

/**
 * Edge cross-section (KAI-8951 — Dan: the rim must be an OUTWARD ROUNDED LIP, convex, rolling
 * outward — the previous design inset both caps by r and put the wall at the silhouette, so the
 * face sat inside a crease ring that read as a GROOVE). Now: the caps keep the FULL contour
 * extent; the lip BULGES OUTWARD by r beyond the silhouette, tangent to both faces (no crease).
 * radial 0 = the contour (cap edge); +r = the lip's outermost roll at the mid-wall. The nominal
 * cutline stays the contour — the lip models the material rolling outward; the visual silhouette
 * grows by a UNIFORM +r (0.15mm), shape unchanged.
 */
function buildProfile(t: number, rIn: number, segs: number): ProfileSample[] {
  const half = t / 2
  const r = Math.min(rIn, half)
  const out: ProfileSample[] = []
  for (let i = 0; i <= segs; i++) { // top quarter: face edge (flush, tangent) → outermost roll
    const a = (Math.PI / 2) * (i / segs)
    out.push({ radial: r * Math.sin(a), z: (half - r) + r * Math.cos(a), nr: Math.sin(a), nz: Math.cos(a) })
  }
  if (half - r > 1e-6) { // outward wall at +r (the lip's crest)
    out.push({ radial: r, z: half - r, nr: 1, nz: 0 })
    out.push({ radial: r, z: -(half - r), nr: 1, nz: 0 })
  }
  for (let i = 0; i <= segs; i++) { // bottom quarter: outermost roll → back edge (flush, tangent)
    const a = (Math.PI / 2) * (i / segs)
    out.push({ radial: r * Math.cos(a), z: -(half - r) - r * Math.sin(a), nr: Math.cos(a), nz: -Math.sin(a) })
  }
  return out
}

/** Per-vertex outward normals for a ring (uses ring winding: (dy,-dx) → outward for CCW outer, into-hole for CW holes). */
function ringNormals(pts: Pt[]): Pt[] {
  const n = pts.length
  const edgeN: Pt[] = []
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % n]
    const nx = y2 - y1
    const ny = -(x2 - x1)
    const len = Math.hypot(nx, ny) || 1
    edgeN.push([nx / len, ny / len])
  }
  // vertex normal = average of the two adjacent edge normals
  const vN: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = edgeN[(i - 1 + n) % n]
    const b = edgeN[i]
    const nx = a[0] + b[0]
    const ny = a[1] + b[1]
    const len = Math.hypot(nx, ny) || 1
    vN.push([nx / len, ny / len])
  }
  return vN
}

function bbox(pts: Pt[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

export interface ShapedGeometryResult {
  geometry: THREE.BufferGeometry
  widthMM: number
  heightMM: number
}

interface V { x: number; y: number; z: number; nx: number; ny: number; nz: number; iu?: number; iv?: number }

export function buildShapedGeometry(contour: Contour, opts: MeshOptions): ShapedGeometryResult {
  const { thicknessMM, edgeRadiusMM, edgeSegments, mmPerPx, imgW, imgH } = opts
  const half = thicknessMM / 2
  const r = Math.min(edgeRadiusMM, half)
  const profile = buildProfile(thicknessMM, r, Math.max(2, edgeSegments))
  const rings = [contour.outer, ...contour.holes]

  const bb = bbox(contour.outer.pts)
  const cx = (bb.minX + bb.maxX) / 2
  const cy = (bb.minY + bb.maxY) / 2

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []   // channel 0 = IMAGE position (image wraps over the rounding, per-position)
  const uv1: number[] = []   // channel 1 = world-XY (suede tiles by physical size → never stretches)
  const SUEDE_TILE_MM = 30

  const uvOf = (xmm: number, ymm: number): [number, number] => [xmm / mmPerPx / imgW, ymm / mmPerPx / imgH]
  const pushV = (v: V) => {
    positions.push(v.x - cx, v.y - cy, v.z)
    normals.push(v.nx, v.ny, v.nz)
    if (v.iu !== undefined) uvs.push(v.iu, v.iv as number)
    else { const [u, vv] = uvOf(v.x, v.y); uvs.push(u, vv) }
    uv1.push(v.x / SUEDE_TILE_MM, v.y / SUEDE_TILE_MM)
  }
  // Materials are DoubleSide, so winding is tolerant — normals carry the lighting.
  const quad = (A: V, B: V, C: V, D: V) => { pushV(A); pushV(B); pushV(D); pushV(A); pushV(D); pushV(C) }
  const mk = (x: number, y: number, z: number, nx: number, ny: number, nz: number): V => ({ x, y, z, nx, ny, nz })

  const capRings: Pt[][] = []

  // ── Edge lip = the SAME front image continuing over the rounding (same material). UV wraps by arc
  //    length (no stretch), so the printed surface rolls over the lip 1:1. No separate strip/darken.
  for (const ring of rings) {
    const pts = ring.pts
    const N = ringNormals(pts)
    const n = pts.length
    capRings.push(pts) // caps keep the FULL contour (KAI-8951 — no inset, no crease ring)
    const ev = (P: Pt, Np: Pt, s: number): V => {
      const ps = profile[s]
      // LOCAL colour roll: every profile sample on this perimeter point samples ONE source pixel just
      // inside the cutline (constant inward = r). The local edge colour rolls over the rounded lip
      // WITHOUT smearing image rows across the sub-mm rim — kills the bottom stretch-band striations.
      // Continuous with the front cap (also inset by r), so no seam line at the front↔edge boundary.
      const inward = r
      const [iu, iv] = uvOf(P[0] - Np[0] * inward, P[1] - Np[1] * inward)
      return { x: P[0] + Np[0] * ps.radial, y: P[1] + Np[1] * ps.radial, z: ps.z, nx: Np[0] * ps.nr, ny: Np[1] * ps.nr, nz: ps.nz, iu, iv }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const A = pts[i], B = pts[j], NA = N[i], NB = N[j]
      for (let s = 0; s < profile.length - 1; s++) {
        quad(ev(A, NA, s), ev(B, NB, s), ev(A, NA, s + 1), ev(B, NB, s + 1))
      }
    }
  }
  const edgeCount = positions.length / 3

  // ── Flat caps on the FULL rings — the lip departs tangentially from the cap edge ──
  const outerInset = capRings[0]
  const holeInsets = capRings.slice(1)
  const toVec2 = (pts: Pt[]) => pts.map(([x, y]) => new THREE.Vector2(x, y))
  const faces = THREE.ShapeUtils.triangulateShape(toVec2(outerInset), holeInsets.map(toVec2))
  const allV: Pt[] = [outerInset, ...holeInsets].flat()

  for (const [a, b, c] of faces) for (const idx of [a, b, c]) {
    const [x, y] = allV[idx]
    pushV(mk(x, y, +half, 0, 0, 1))
  }
  const frontCount = positions.length / 3 - edgeCount

  for (const [a, b, c] of faces) for (const idx of [c, b, a]) {
    const [x, y] = allV[idx]
    pushV(mk(x, y, -half, 0, 0, -1))
  }
  const backCount = positions.length / 3 - edgeCount - frontCount

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2)) // suede (channel 1)
  geometry.addGroup(edgeCount, frontCount, 0)             // front cap → material 0 (golden, unchanged)
  geometry.addGroup(0, edgeCount, 1)                      // edge lip → material 1 (matte copy, same image)
  geometry.addGroup(edgeCount + frontCount, backCount, 2) // back cap → material 2
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  return { geometry, widthMM: bb.maxX - bb.minX, heightMM: bb.maxY - bb.minY }
}
