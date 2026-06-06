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
  bodyThicknessMM: number // flat-top body thickness (~1.0) — the top/padding stays full thickness
  edgeThicknessMM: number // thin rim thickness (~0.3) — ONLY the perimeter bevel slims to this
  bevelWidthMM: number    // width of the perimeter bevel that slims body→rim
  edgeSegments: number    // rounding segments of the thin rim
  mmPerPx: number         // mm per source pixel (for UV back-projection)
  imgW: number
  imgH: number
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

interface V { x: number; y: number; z: number; nx: number; ny: number; nz: number }

export function buildShapedGeometry(contour: Contour, opts: MeshOptions): ShapedGeometryResult {
  const { bodyThicknessMM, edgeThicknessMM, bevelWidthMM, edgeSegments, mmPerPx, imgW, imgH } = opts
  const bodyHalf = bodyThicknessMM / 2
  const rimHalf = edgeThicknessMM / 2
  const rings = [contour.outer, ...contour.holes]

  const bb = bbox(contour.outer.pts)
  const cx = (bb.minX + bb.maxX) / 2
  const cy = (bb.minY + bb.maxY) / 2

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const uv1: number[] = [] // world-XY suede UV (channel 1) — tiles the suede by physical size so it
                           // doesn't stretch into lines on the thin rim
  const SUEDE_TILE_MM = 40

  // UV (channel 0) from mm → source image [0,1]. Image is loaded y-up; texture.flipY=false.
  const uvOf = (xmm: number, ymm: number): [number, number] => [xmm / mmPerPx / imgW, ymm / mmPerPx / imgH]
  const pushV = (v: V) => {
    positions.push(v.x - cx, v.y - cy, v.z)
    normals.push(v.nx, v.ny, v.nz)
    const [u, vv] = uvOf(v.x, v.y)
    uvs.push(u, vv)
    uv1.push(v.x / SUEDE_TILE_MM, v.y / SUEDE_TILE_MM)
  }
  // Materials are DoubleSide, so winding is tolerant — normals carry the lighting.
  const quad = (A: V, B: V, C: V, D: V) => { pushV(A); pushV(B); pushV(D); pushV(A); pushV(D); pushV(C) }
  const mk = (x: number, y: number, z: number, nx: number, ny: number, nz: number): V => ({ x, y, z, nx, ny, nz })

  // thin rim bulge profile: top(+rimHalf, radial 0) → mid(0, radial +rimHalf) → bottom(-rimHalf, 0)
  const segs = Math.max(2, edgeSegments)
  const rim = Array.from({ length: segs + 1 }, (_, i) => {
    const a = Math.PI / 2 - Math.PI * (i / segs)
    return { radial: rimHalf * Math.cos(a), z: rimHalf * Math.sin(a), nr: Math.cos(a), nz: Math.sin(a) }
  })

  // bevel slope normal in (radial, z): rises (bodyHalf - rimHalf) over run = bevelWidth
  const drise = bodyHalf - rimHalf
  const Lb = Math.hypot(drise, bevelWidthMM) || 1
  const nrb = drise / Lb, nzb = bevelWidthMM / Lb

  const innerByRing: Pt[][] = []

  // ── Perimeter EDGE: front bevel → thin rim → back bevel (slims body→0.3 across the bevel) ──
  for (const ring of rings) {
    const pts = ring.pts
    const N = ringNormals(pts)
    const n = pts.length
    const inner: Pt[] = pts.map(([x, y], i) => [x - N[i][0] * bevelWidthMM, y - N[i][1] * bevelWidthMM])
    innerByRing.push(inner)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const A = pts[i], B = pts[j], IA = inner[i], IB = inner[j], NA = N[i], NB = N[j]
      if (bevelWidthMM > 1e-4) {
        // front bevel: inner @ +bodyHalf  →  contour @ +rimHalf (slims body→rim)
        quad(
          mk(IA[0], IA[1], +bodyHalf, NA[0] * nrb, NA[1] * nrb, nzb),
          mk(IB[0], IB[1], +bodyHalf, NB[0] * nrb, NB[1] * nrb, nzb),
          mk(A[0], A[1], +rimHalf, NA[0] * nrb, NA[1] * nrb, nzb),
          mk(B[0], B[1], +rimHalf, NB[0] * nrb, NB[1] * nrb, nzb),
        )
      }
      // rounded rim at the contour
      for (let s = 0; s < rim.length - 1; s++) {
        const p0 = rim[s], p1 = rim[s + 1]
        quad(
          mk(A[0] + NA[0] * p0.radial, A[1] + NA[1] * p0.radial, p0.z, NA[0] * p0.nr, NA[1] * p0.nr, p0.nz),
          mk(B[0] + NB[0] * p0.radial, B[1] + NB[1] * p0.radial, p0.z, NB[0] * p0.nr, NB[1] * p0.nr, p0.nz),
          mk(A[0] + NA[0] * p1.radial, A[1] + NA[1] * p1.radial, p1.z, NA[0] * p1.nr, NA[1] * p1.nr, p1.nz),
          mk(B[0] + NB[0] * p1.radial, B[1] + NB[1] * p1.radial, p1.z, NB[0] * p1.nr, NB[1] * p1.nr, p1.nz),
        )
      }
      if (bevelWidthMM > 1e-4) {
        // back bevel: contour @ -rimHalf  →  inner @ -bodyHalf
        quad(
          mk(A[0], A[1], -rimHalf, NA[0] * nrb, NA[1] * nrb, -nzb),
          mk(B[0], B[1], -rimHalf, NB[0] * nrb, NB[1] * nrb, -nzb),
          mk(IA[0], IA[1], -bodyHalf, NA[0] * nrb, NA[1] * nrb, -nzb),
          mk(IB[0], IB[1], -bodyHalf, NB[0] * nrb, NB[1] * nrb, -nzb),
        )
      }
    }
  }
  const edgeCount = positions.length / 3

  // ── Flat top cap (FRONT, image) + flat bottom cap (BACK) on the inner rings ──
  const outerInner = innerByRing[0]
  const holeInners = innerByRing.slice(1)
  const toVec2 = (pts: Pt[]) => pts.map(([x, y]) => new THREE.Vector2(x, y))
  const faces = THREE.ShapeUtils.triangulateShape(toVec2(outerInner), holeInners.map(toVec2))
  const allV: Pt[] = [outerInner, ...holeInners].flat()

  for (const [a, b, c] of faces) for (const idx of [a, b, c]) {
    const [x, y] = allV[idx]
    pushV(mk(x, y, +bodyHalf, 0, 0, 1))
  }
  const frontCount = positions.length / 3 - edgeCount

  for (const [a, b, c] of faces) for (const idx of [c, b, a]) {
    const [x, y] = allV[idx]
    pushV(mk(x, y, -bodyHalf, 0, 0, -1))
  }
  const backCount = positions.length / 3 - edgeCount - frontCount

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2)) // suede channel
  geometry.addGroup(edgeCount, frontCount, 0)              // flat top (subject + padding) → image
  geometry.addGroup(0, edgeCount, 1)                       // bevel + rim → edge material
  geometry.addGroup(edgeCount + frontCount, backCount, 2)  // flat bottom → solid
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  return { geometry, widthMM: bb.maxX - bb.minX, heightMM: bb.maxY - bb.minY }
}
