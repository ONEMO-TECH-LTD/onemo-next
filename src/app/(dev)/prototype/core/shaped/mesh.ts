// Custom shaped-effect BufferGeometry (Lane A / Kai)
// Per FINAL-SPEC: custom three.js BufferGeometry (NOT ExtrudeGeometry) — front/back caps + a
// rounded edge band. AMEND-8: the edge is a REAL convex rounded fillet (radius r), NOT a flat
// angled bevel. Front planar UV ("cut the geometry, not the texture"). Groups: 0 = front+edge
// (artwork/bled suede), 1 = back (solid back-colour suede).
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
 * Edge cross-section: flat-face-inset → SHORT top fillet (tangent to face) → straight wall → bottom
 * fillet → back. radial 0 = the silhouette (wall); caps are inset by r so the fillet eases in with
 * NO crease/separation line. Small r = short rounding.
 */
function buildProfile(t: number, rIn: number, segs: number): ProfileSample[] {
  const r = Math.min(rIn, t / 2)
  const half = t / 2
  const out: ProfileSample[] = []
  for (let i = 0; i <= segs; i++) { // top fillet: a π/2 → 0 (face → wall), centre (radial -r, z half-r)
    const a = (Math.PI / 2) * (1 - i / segs)
    out.push({ radial: -r + r * Math.cos(a), z: (half - r) + r * Math.sin(a), nr: Math.cos(a), nz: Math.sin(a) })
  }
  if (half - r > 1e-6) { // straight wall at the silhouette
    out.push({ radial: 0, z: half - r, nr: 1, nz: 0 })
    out.push({ radial: 0, z: -(half - r), nr: 1, nz: 0 })
  }
  for (let i = 0; i <= segs; i++) { // bottom fillet: a 0 → -π/2 (wall → back)
    const a = -(Math.PI / 2) * (i / segs)
    out.push({ radial: -r + r * Math.cos(a), z: -(half - r) + r * Math.sin(a), nr: Math.cos(a), nz: Math.sin(a) })
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

  // Edge IMAGE wrap: UVs sample the FRONT image starting at the front cutline and moving only a few
  // px INWARD over the lip (NOT the geometric rim position, NOT exterior/bled, NOT interior art).
  const WRAP_PX = 7
  const wrapMM = WRAP_PX * mmPerPx
  const insetByR: Pt[][] = []

  // ── Edge band: swept fillet profile; image UV bends inward from the cutline over the lip ──
  for (const ring of rings) {
    const pts = ring.pts
    const N = ringNormals(pts)
    const n = pts.length
    insetByR.push(pts.map(([x, y], i) => [x - N[i][0] * r, y - N[i][1] * r]))
    const lastS = profile.length - 1
    // edge vertex: geometric position from the fillet profile; image UV moved inward by (r + p*wrap)
    const ev = (P: Pt, Np: Pt, ps: ProfileSample, p: number): V => {
      const inward = r + p * wrapMM // start at the cutline (cap edge), then a few px inward
      const [iu, iv] = uvOf(P[0] - Np[0] * inward, P[1] - Np[1] * inward)
      return { x: P[0] + Np[0] * ps.radial, y: P[1] + Np[1] * ps.radial, z: ps.z, nx: Np[0] * ps.nr, ny: Np[1] * ps.nr, nz: ps.nz, iu, iv }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const A = pts[i], B = pts[j], NA = N[i], NB = N[j]
      for (let s = 0; s < lastS; s++) {
        const p0 = profile[s], p1 = profile[s + 1]
        const pr0 = s / lastS, pr1 = (s + 1) / lastS
        quad(ev(A, NA, p0, pr0), ev(B, NB, p0, pr0), ev(A, NA, p1, pr1), ev(B, NB, p1, pr1))
      }
    }
  }
  const edgeCount = positions.length / 3

  // ── Flat caps on the inset rings (inset by r → the fillet eases in tangentially, no crease) ──
  const outerInset = insetByR[0]
  const holeInsets = insetByR.slice(1)
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
  // edge band + front cap are contiguous and use the SAME front material (image + suede); back = solid
  geometry.addGroup(0, edgeCount + frontCount, 0) // edge + front → material 0 (front)
  geometry.addGroup(edgeCount + frontCount, backCount, 1) // back → material 1
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  return { geometry, widthMM: bb.maxX - bb.minX, heightMM: bb.maxY - bb.minY }
}
