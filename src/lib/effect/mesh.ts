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
 * Edge cross-section (Dan, 2026-06-14): the rim must read as an ALMOST-STRAIGHT wall with SLIGHTLY
 * rounded corners — NOT a groove (the old inset-crease), NOT an outward lip bulge, NOT a full
 * rounded bevel. The wall sits AT the contour (radial 0 = silhouette, shape unchanged); the caps
 * are inset by r and a SMALL convex fillet rolls the corner from cap → wall with no crease. radial
 * runs [-r, 0]: -r at the cap edge (inset), 0 at the straight wall. The caps are inset by r to meet
 * the fillet (see buildShapedGeometry) so there is no gap.
 */
function buildProfile(t: number, rIn: number, segs: number): ProfileSample[] {
  const half = t / 2
  const r = Math.min(rIn, half)
  const out: ProfileSample[] = []
  for (let i = 0; i <= segs; i++) { // top fillet: cap edge (inset -r) → straight wall top
    const a = (Math.PI / 2) * (1 - i / segs)
    out.push({ radial: -r + r * Math.cos(a), z: (half - r) + r * Math.sin(a), nr: Math.cos(a), nz: Math.sin(a) })
  }
  for (let i = 0; i <= segs; i++) { // straight wall (radial 0) → bottom fillet → cap edge (inset -r)
    const a = (Math.PI / 2) * (i / segs)
    out.push({ radial: -r + r * Math.cos(a), z: -(half - r) - r * Math.sin(a), nr: Math.cos(a), nz: -Math.sin(a) })
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

/**
 * Signed area (y-up shoelace): > 0 = CCW. The edge's OUTWARD direction depends on a known winding —
 * ringNormals' (dy,-dx) points outward ONLY for a CCW outer ring. v3's contour producers
 * (contourFromShape / vectorTrueContour) reverse blindly, so the rect (pre-gen) arrives CCW → convex
 * lip, while the trace (post-gen) arrives CW → normals flip → the cap oversizes → a concave GROOVE
 * ("inverse lip"). v1 guaranteed this in buildContour (orient outer CCW always); the rebuild dropped
 * it. Restore the guarantee HERE — the single mesh chokepoint — so EVERY shape gets the same convex
 * edge regardless of which producer (or winding) fed the contour.
 */
function signedArea(pts: Pt[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}
function orientRing(pts: Pt[], wantCCW: boolean): Pt[] {
  return (signedArea(pts) > 0) === wantCCW ? pts : [...pts].reverse()
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
  // CANONICAL WINDING (v1 parity): outer CCW, holes CW → ringNormals always points OUTWARD, so the
  // edge rolls the same convex way for the rect (pre-gen) and the silhouette (post-gen). Without this
  // the post-gen trace (CW) inverts the edge into a groove.
  const rings = [
    { pts: orientRing(contour.outer.pts, true) },
    ...contour.holes.map((h) => ({ pts: orientRing(h.pts, false) })),
  ]

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
    // caps inset by r to meet the fillet's cap edge (radial -r) — the straight wall stays AT the
    // contour (radial 0 = silhouette), so the shape is unchanged; only the sub-mm rounded corner insets
    capRings.push(pts.map((P, i) => [P[0] - N[i][0] * r, P[1] - N[i][1] * r] as Pt))
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
