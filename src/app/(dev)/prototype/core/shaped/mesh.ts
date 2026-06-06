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
  thicknessMM: number   // body thickness (1.6 locked)
  edgeRadiusMM: number  // rounded edge radius (~1.0); clamped to thickness/2
  edgeSegments: number  // tessellation of each quarter-round (>=2)
  mmPerPx: number       // mm per source pixel (for UV back-projection)
  imgW: number
  imgH: number
}

interface ProfileSample { radial: number; z: number; nr: number; nz: number }

/** Vertical edge profile: rounded top fillet → (optional) straight wall → rounded bottom fillet. */
function buildProfile(t: number, rIn: number, segs: number): ProfileSample[] {
  const r = Math.min(rIn, t / 2)
  const half = t / 2
  const out: ProfileSample[] = []
  // top arc: a from +π/2 → 0 ; centre (radial=-r, z=half-r)
  for (let i = 0; i <= segs; i++) {
    const a = (Math.PI / 2) * (1 - i / segs)
    out.push({ radial: -r + r * Math.cos(a), z: (half - r) + r * Math.sin(a), nr: Math.cos(a), nz: Math.sin(a) })
  }
  // straight wall (only if r < t/2)
  if (half - r > 1e-6) {
    out.push({ radial: 0, z: half - r, nr: 1, nz: 0 })
    out.push({ radial: 0, z: -(half - r), nr: 1, nz: 0 })
  }
  // bottom arc: a from 0 → -π/2 ; centre (radial=-r, z=-(half-r))
  for (let i = 0; i <= segs; i++) {
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

export function buildShapedGeometry(contour: Contour, opts: MeshOptions): ShapedGeometryResult {
  const { thicknessMM: t, edgeRadiusMM, edgeSegments, mmPerPx, imgW, imgH } = opts
  const r = Math.min(edgeRadiusMM, t / 2)
  const profile = buildProfile(t, r, Math.max(2, edgeSegments))
  const rings = [contour.outer, ...contour.holes]

  const bb = bbox(contour.outer.pts)
  const cx = (bb.minX + bb.maxX) / 2
  const cy = (bb.minY + bb.maxY) / 2

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []

  // UV from mm → source image [0,1]. Image is loaded y-up (row 0 = bottom), geometry is y-up,
  // texture.flipY = false → v = py/H maps directly (upright, registered to the cut).
  const uvOf = (xmm: number, ymm: number): [number, number] => {
    const px = xmm / mmPerPx
    const py = ymm / mmPerPx
    return [px / imgW, py / imgH]
  }
  const pushVert = (xmm: number, ymm: number, z: number, nx: number, ny: number, nz: number) => {
    positions.push(xmm - cx, ymm - cy, z)
    normals.push(nx, ny, nz)
    const [u, v] = uvOf(xmm, ymm)
    uvs.push(u, v)
  }

  // ── Edge band (group 0) ────────────────────────────────────────────
  for (const ring of rings) {
    const pts = ring.pts
    const N = ringNormals(pts)
    const n = pts.length
    for (let s = 0; s < profile.length - 1; s++) {
      const p0 = profile[s]
      const p1 = profile[s + 1]
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        const A = pts[i], B = pts[j]
        const NA = N[i], NB = N[j]
        // four corners of the quad (ring edge i→j × profile s→s+1)
        const v00 = [A[0] + NA[0] * p0.radial, A[1] + NA[1] * p0.radial, p0.z] as const
        const v10 = [B[0] + NB[0] * p0.radial, B[1] + NB[1] * p0.radial, p0.z] as const
        const v01 = [A[0] + NA[0] * p1.radial, A[1] + NA[1] * p1.radial, p1.z] as const
        const v11 = [B[0] + NB[0] * p1.radial, B[1] + NB[1] * p1.radial, p1.z] as const
        const n00 = [NA[0] * p0.nr, NA[1] * p0.nr, p0.nz] as const
        const n10 = [NB[0] * p0.nr, NB[1] * p0.nr, p0.nz] as const
        const n01 = [NA[0] * p1.nr, NA[1] * p1.nr, p1.nz] as const
        const n11 = [NB[0] * p1.nr, NB[1] * p1.nr, p1.nz] as const
        // tri 1: v00, v10, v11
        pushVert(v00[0], v00[1], v00[2], n00[0], n00[1], n00[2])
        pushVert(v10[0], v10[1], v10[2], n10[0], n10[1], n10[2])
        pushVert(v11[0], v11[1], v11[2], n11[0], n11[1], n11[2])
        // tri 2: v00, v11, v01
        pushVert(v00[0], v00[1], v00[2], n00[0], n00[1], n00[2])
        pushVert(v11[0], v11[1], v11[2], n11[0], n11[1], n11[2])
        pushVert(v01[0], v01[1], v01[2], n01[0], n01[1], n01[2])
      }
    }
  }

  // ── Front cap (group 0) + Back cap (group 1) via inset rings ────────
  const insetRing = (pts: Pt[]): Pt[] => {
    const N = ringNormals(pts)
    return pts.map(([x, y], i) => [x + N[i][0] * -r, y + N[i][1] * -r] as Pt)
  }
  const outerInset = insetRing(contour.outer.pts)
  const holesInset = contour.holes.map((h) => insetRing(h.pts))

  const toVec2 = (pts: Pt[]) => pts.map(([x, y]) => new THREE.Vector2(x, y))
  const contourV = toVec2(outerInset)
  const holesV = holesInset.map(toVec2)
  const faces = THREE.ShapeUtils.triangulateShape(contourV, holesV)
  const allV: Pt[] = [...outerInset, ...holesInset.flat()]

  const frontEdgeCount = positions.length / 3 // edge band vertex count (group 0 so far)

  const zTop = t / 2
  const zBot = -t / 2
  // front cap (normal +z), winding as returned
  for (const [a, b, c] of faces) {
    for (const idx of [a, b, c]) {
      const [x, y] = allV[idx]
      pushVert(x, y, zTop, 0, 0, 1)
    }
  }
  const group0Count = positions.length / 3 // front+edge → material 0

  // back cap (normal -z), reversed winding
  for (const [a, b, c] of faces) {
    for (const idx of [c, b, a]) {
      const [x, y] = allV[idx]
      pushVert(x, y, zBot, 0, 0, -1)
    }
  }
  const totalCount = positions.length / 3

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  // Three material groups: edge (blurred), front (sharp artwork), back (solid)
  const edgeCount = frontEdgeCount
  const frontCount = group0Count - frontEdgeCount
  const backCount = totalCount - group0Count
  geometry.addGroup(edgeCount, frontCount, 0)        // front → material 0 (sharp artwork)
  geometry.addGroup(0, edgeCount, 1)                 // edge  → material 1 (blurred picture colour)
  geometry.addGroup(group0Count, backCount, 2)       // back  → material 2 (solid suede)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  return {
    geometry,
    widthMM: bb.maxX - bb.minX,
    heightMM: bb.maxY - bb.minY,
  }
}
