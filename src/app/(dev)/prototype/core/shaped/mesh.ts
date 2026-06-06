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
  bodyThicknessMM: number // interior thickness (~1.0)
  edgeThicknessMM: number // thin rim thickness (~0.3) — caps taper from body→edge toward the rim
  taperBandMM: number     // distance over which thickness ramps body→edge near the perimeter
  edgeSegments: number    // tessellation of each quarter-round (>=2)
  capSubdiv: number       // cap triangle subdivision levels (interior verts for a smooth taper)
  mmPerPx: number         // mm per source pixel (for UV back-projection)
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
  const { bodyThicknessMM, edgeThicknessMM, taperBandMM, edgeSegments, capSubdiv, mmPerPx, imgW, imgH } = opts
  const r = edgeThicknessMM / 2 // full bullnose on the thin rim
  const profile = buildProfile(edgeThicknessMM, r, Math.max(2, edgeSegments))
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

  // Distance from a point to the true contour (for the thickness taper).
  const ringPts = rings.map((rg) => rg.pts)
  const distToContour = (x: number, y: number): number => {
    let best = Infinity
    for (const pts of ringPts) {
      const n = pts.length
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n]
        const dx = b[0] - a[0], dy = b[1] - a[1]
        const len2 = dx * dx + dy * dy
        let tt = len2 > 0 ? ((x - a[0]) * dx + (y - a[1]) * dy) / len2 : 0
        tt = tt < 0 ? 0 : tt > 1 ? 1 : tt
        const ex = x - (a[0] + tt * dx), ey = y - (a[1] + tt * dy)
        const d = ex * ex + ey * ey
        if (d < best) best = d
      }
    }
    return Math.sqrt(best)
  }
  const bodyHalf = bodyThicknessMM / 2
  const edgeHalf = edgeThicknessMM / 2
  // half-thickness ramps edge→body over taperBand (smoothstep) → thin rim, thicker interior
  const halfThickAt = (x: number, y: number): number => {
    let s = Math.min(1, Math.max(0, distToContour(x, y) / taperBandMM))
    s = s * s * (3 - 2 * s)
    return edgeHalf + (bodyHalf - edgeHalf) * s
  }

  // ── Edge band (thin rounded rim) ────────────────────────────────────
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

  // Subdivide each cap triangle so interior vertices exist for a SMOOTH thickness taper.
  const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const emitCapTri = (p0: Pt, p1: Pt, p2: Pt, sign: number) => {
    const tri = sign > 0 ? [p0, p1, p2] : [p2, p1, p0] // front +z keeps winding; back reverses
    for (const [x, y] of tri) pushVert(x, y, sign * halfThickAt(x, y), 0, 0, sign)
  }
  const subdiv = (p0: Pt, p1: Pt, p2: Pt, level: number, sign: number) => {
    if (level <= 0) { emitCapTri(p0, p1, p2, sign); return }
    const a = mid(p0, p1), b = mid(p1, p2), c = mid(p2, p0)
    subdiv(p0, a, c, level - 1, sign)
    subdiv(a, p1, b, level - 1, sign)
    subdiv(c, b, p2, level - 1, sign)
    subdiv(a, b, c, level - 1, sign)
  }
  const lvl = Math.max(0, capSubdiv)
  // front cap (tapered, normal +z)
  for (const [a, b, c] of faces) subdiv(allV[a], allV[b], allV[c], lvl, +1)
  const group0Count = positions.length / 3 // front+edge → material 0

  // back cap (tapered, normal -z)
  for (const [a, b, c] of faces) subdiv(allV[a], allV[b], allV[c], lvl, -1)
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
