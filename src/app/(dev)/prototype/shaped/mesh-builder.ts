'use client'

import * as THREE from 'three'
import type { ShapePoint, ShapeSpecDraft } from './shape-spec'

const PROFILE_STEPS = 8
const EDGE_LATERAL_BLEND = 0.16
const MM_TO_SCENE = 0.001

interface BuildVertex {
  x: number
  y: number
  z: number
  nx: number
  ny: number
  nz: number
  u: number
  v: number
}

function perimeter(points: ShapePoint[]) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    return sum + Math.hypot(next.x - point.x, next.y - point.y)
  }, 0)
}

function polygonArea(points: ShapePoint[]) {
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  return area / 2
}

function pointNormal(points: ShapePoint[], index: number, isHole: boolean) {
  const previous = points[(index - 1 + points.length) % points.length]
  const current = points[index]
  const next = points[(index + 1) % points.length]
  const e1 = { x: current.x - previous.x, y: current.y - previous.y }
  const e2 = { x: next.x - current.x, y: next.y - current.y }
  const areaSign = polygonArea(points) >= 0 ? 1 : -1
  const materialSide = isHole ? -areaSign : areaSign
  const n1 = { x: e1.y * materialSide, y: -e1.x * materialSide }
  const n2 = { x: e2.y * materialSide, y: -e2.x * materialSide }
  const nx = n1.x + n2.x
  const ny = n1.y + n2.y
  const len = Math.hypot(nx, ny) || 1
  return { x: nx / len, y: ny / len }
}

function toVector2(points: ShapePoint[]) {
  return points.map((point) => new THREE.Vector2(point.x * MM_TO_SCENE, point.y * MM_TO_SCENE))
}

function pushVertex(vertices: BuildVertex[], vertex: BuildVertex) {
  vertices.push(vertex)
  return vertices.length - 1
}

function sourceUv(point: ShapePoint, draft: ShapeSpecDraft) {
  return {
    u: point.x / draft.source.width_px,
    v: 1 - point.y / draft.source.height_px,
  }
}

function addSurfaceVertices({
  vertices,
  ringMm,
  ringPx,
  z,
  normalZ,
  draft,
}: {
  vertices: BuildVertex[]
  ringMm: ShapePoint[]
  ringPx: ShapePoint[]
  z: number
  normalZ: number
  draft: ShapeSpecDraft
}) {
  return ringMm.map((point, index) => {
    const uv = sourceUv(ringPx[index], draft)
    return pushVertex(vertices, {
      x: point.x * MM_TO_SCENE,
      y: point.y * MM_TO_SCENE,
      z,
      nx: 0,
      ny: 0,
      nz: normalZ,
      u: uv.u,
      v: uv.v,
    })
  })
}

function addRingEdge({
  vertices,
  indices,
  ringMm,
  isHole,
  startU,
  totalPerimeter,
  thicknessScene,
  radiusScene,
}: {
  vertices: BuildVertex[]
  indices: number[]
  ringMm: ShapePoint[]
  isHole: boolean
  startU: number
  totalPerimeter: number
  thicknessScene: number
  radiusScene: number
}) {
  const ringIndices: number[][] = []
  let travelled = startU

  for (let i = 0; i < ringMm.length; i += 1) {
    const point = ringMm[i]
    const next = ringMm[(i + 1) % ringMm.length]
    const normal = pointNormal(ringMm, i, isHole)
    const u = totalPerimeter ? travelled / totalPerimeter : 0
    const profileIndices: number[] = []

    for (let step = 0; step <= PROFILE_STEPS; step += 1) {
      const t = step / PROFILE_STEPS
      const arc = Math.sin(Math.PI * t)
      const zNormal = Math.cos(Math.PI * t)
      const sideNormal = Math.sin(Math.PI * t)
      const nx = normal.x * sideNormal
      const ny = normal.y * sideNormal
      const nl = Math.hypot(nx, ny, zNormal) || 1
      profileIndices.push(pushVertex(vertices, {
        x: point.x * MM_TO_SCENE + normal.x * radiusScene * arc * EDGE_LATERAL_BLEND,
        y: point.y * MM_TO_SCENE + normal.y * radiusScene * arc * EDGE_LATERAL_BLEND,
        z: thicknessScene / 2 - thicknessScene * t,
        nx: nx / nl,
        ny: ny / nl,
        nz: zNormal / nl,
        u,
        v: t,
      }))
    }
    ringIndices.push(profileIndices)
    travelled += Math.hypot(next.x - point.x, next.y - point.y)
  }

  for (let i = 0; i < ringMm.length; i += 1) {
    const next = (i + 1) % ringMm.length
    for (let step = 0; step < PROFILE_STEPS; step += 1) {
      const a = ringIndices[i][step]
      const b = ringIndices[next][step]
      const c = ringIndices[i][step + 1]
      const d = ringIndices[next][step + 1]
      if (isHole) {
        indices.push(a, c, b, b, c, d)
      } else {
        indices.push(a, b, c, b, d, c)
      }
    }
  }
}

export function createRoundedShapeGeometry(draft: ShapeSpecDraft) {
  const vertices: BuildVertex[] = []
  const indices: number[] = []
  const frontStart = 0
  const thicknessScene = draft.dimensions_mm.thickness_body * MM_TO_SCENE
  const radiusScene = draft.dimensions_mm.edge_radius_mm * MM_TO_SCENE

  const outerFront = addSurfaceVertices({
    vertices,
    ringMm: draft.geometry_mm.outer,
    ringPx: draft.geometry_px.outer,
    z: thicknessScene / 2,
    normalZ: 1,
    draft,
  })
  const holesFront = draft.geometry_mm.holes.map((hole, index) => addSurfaceVertices({
    vertices,
    ringMm: hole,
    ringPx: draft.geometry_px.holes[index],
    z: thicknessScene / 2,
    normalZ: 1,
    draft,
  }))

  const vectors = toVector2(draft.geometry_mm.outer)
  const holes = draft.geometry_mm.holes.map(toVector2)
  const triangulated = THREE.ShapeUtils.triangulateShape(vectors, holes)
  const flatFront = outerFront.concat(...holesFront)
  triangulated.forEach((tri) => {
    indices.push(flatFront[tri[0]], flatFront[tri[1]], flatFront[tri[2]])
  })
  const frontCount = indices.length - frontStart

  const backStart = indices.length
  const outerBack = addSurfaceVertices({
    vertices,
    ringMm: draft.geometry_mm.outer,
    ringPx: draft.geometry_px.outer,
    z: -thicknessScene / 2,
    normalZ: -1,
    draft,
  })
  const holesBack = draft.geometry_mm.holes.map((hole, index) => addSurfaceVertices({
    vertices,
    ringMm: hole,
    ringPx: draft.geometry_px.holes[index],
    z: -thicknessScene / 2,
    normalZ: -1,
    draft,
  }))
  const flatBack = outerBack.concat(...holesBack)
  triangulated.forEach((tri) => {
    indices.push(flatBack[tri[2]], flatBack[tri[1]], flatBack[tri[0]])
  })
  const backCount = indices.length - backStart

  const edgeStart = indices.length
  const totalPerimeter =
    perimeter(draft.geometry_mm.outer) +
    draft.geometry_mm.holes.reduce((sum, hole) => sum + perimeter(hole), 0)
  let uOffset = 0
  addRingEdge({
    vertices,
    indices,
    ringMm: draft.geometry_mm.outer,
    isHole: false,
    startU: uOffset,
    totalPerimeter,
    thicknessScene,
    radiusScene,
  })
  uOffset += perimeter(draft.geometry_mm.outer)
  draft.geometry_mm.holes.forEach((hole) => {
    addRingEdge({
      vertices,
      indices,
      ringMm: hole,
      isHole: true,
      startU: uOffset,
      totalPerimeter,
      thicknessScene,
      radiusScene,
    })
    uOffset += perimeter(hole)
  })
  const edgeCount = indices.length - edgeStart

  const positions = new Float32Array(vertices.length * 3)
  const normals = new Float32Array(vertices.length * 3)
  const uvs = new Float32Array(vertices.length * 2)
  vertices.forEach((vertex, index) => {
    positions[index * 3] = vertex.x
    positions[index * 3 + 1] = vertex.y
    positions[index * 3 + 2] = vertex.z
    normals[index * 3] = vertex.nx
    normals[index * 3 + 1] = vertex.ny
    normals[index * 3 + 2] = vertex.nz
    uvs[index * 2] = vertex.u
    uvs[index * 2 + 1] = vertex.v
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.clearGroups()
  geometry.addGroup(frontStart, frontCount, 0)
  geometry.addGroup(backStart, backCount, 1)
  geometry.addGroup(edgeStart, edgeCount, 2)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
