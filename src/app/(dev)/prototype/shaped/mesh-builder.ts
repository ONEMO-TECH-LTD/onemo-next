'use client'

import * as THREE from 'three'
import type { ShapePoint, ShapeSpecDraft } from './shape-spec'

const PROFILE_STEPS = 8
const EDGE_LATERAL_BLEND = 0
const EDGE_WRAP_INSET_MIN_PX = 64
const EDGE_WRAP_INSET_MAX_PX = 260
const EDGE_WRAP_INSET_RATIO = 0.1
const BACK_EDGE_INSET_MM = 0.32
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
    u: THREE.MathUtils.clamp(point.x / draft.source.width_px, 0, 1),
    v: THREE.MathUtils.clamp(1 - point.y / draft.source.height_px, 0, 1),
  }
}

function ringBounds(points: ShapePoint[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  )
}

function addSurfaceVertices({
  vertices,
  ringMm,
  ringPx,
  z,
  normalZ,
  draft,
  isHole = false,
  offsetMm = 0,
}: {
  vertices: BuildVertex[]
  ringMm: ShapePoint[]
  ringPx: ShapePoint[]
  z: number
  normalZ: number
  draft: ShapeSpecDraft
  isHole?: boolean
  offsetMm?: number
}) {
  return ringMm.map((point, index) => {
    const uv = sourceUv(ringPx[index], draft)
    const normal = offsetMm ? pointNormal(ringMm, index, isHole) : { x: 0, y: 0 }
    return pushVertex(vertices, {
      x: (point.x + normal.x * offsetMm) * MM_TO_SCENE,
      y: (point.y + normal.y * offsetMm) * MM_TO_SCENE,
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
  ringPx,
  isHole,
  thicknessScene,
  radiusScene,
  draft,
}: {
  vertices: BuildVertex[]
  indices: number[]
  ringMm: ShapePoint[]
  ringPx: ShapePoint[]
  isHole: boolean
  thicknessScene: number
  radiusScene: number
  draft: ShapeSpecDraft
}) {
  const ringIndices: number[][] = []
  const bounds = ringBounds(ringPx)
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }

  for (let i = 0; i < ringMm.length; i += 1) {
    const point = ringMm[i]
    const pointPx = ringPx[i]
    const normal = pointNormal(ringMm, i, isHole)
    const inward = {
      x: center.x - pointPx.x,
      y: center.y - pointPx.y,
    }
    const inwardLength = Math.hypot(inward.x, inward.y) || 1
    const inwardDirection = {
      x: (inward.x / inwardLength) * (isHole ? -1 : 1),
      y: (inward.y / inwardLength) * (isHole ? -1 : 1),
    }
    const profileIndices: number[] = []
    const sourceAwareInset = THREE.MathUtils.clamp(
      Math.min(draft.source.width_px, draft.source.height_px) * EDGE_WRAP_INSET_RATIO,
      EDGE_WRAP_INSET_MIN_PX,
      EDGE_WRAP_INSET_MAX_PX
    )
    const backInsetScene = BACK_EDGE_INSET_MM * MM_TO_SCENE * (isHole ? 1 : -1)

    for (let step = 0; step <= PROFILE_STEPS; step += 1) {
      const t = step / PROFILE_STEPS
      const taper = t * t * (3 - 2 * t)
      const wrapInset = sourceAwareInset * Math.pow(t, 0.85)
      const edgeUv = sourceUv({
        x: pointPx.x + inwardDirection.x * wrapInset,
        y: pointPx.y + inwardDirection.y * wrapInset,
      }, draft)
      const arc = Math.sin(Math.PI * t)
      const zNormal = Math.cos(Math.PI * t)
      const sideNormal = Math.sin(Math.PI * t)
      const nx = normal.x * sideNormal
      const ny = normal.y * sideNormal
      const nl = Math.hypot(nx, ny, zNormal) || 1
      profileIndices.push(pushVertex(vertices, {
        x: point.x * MM_TO_SCENE + normal.x * (radiusScene * arc * EDGE_LATERAL_BLEND + backInsetScene * taper),
        y: point.y * MM_TO_SCENE + normal.y * (radiusScene * arc * EDGE_LATERAL_BLEND + backInsetScene * taper),
        z: thicknessScene / 2 - thicknessScene * t,
        nx: nx / nl,
        ny: ny / nl,
        nz: zNormal / nl,
        u: edgeUv.u,
        v: edgeUv.v,
      }))
    }
    ringIndices.push(profileIndices)
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
    isHole: false,
    offsetMm: -BACK_EDGE_INSET_MM,
  })
  const holesBack = draft.geometry_mm.holes.map((hole, index) => addSurfaceVertices({
    vertices,
    ringMm: hole,
    ringPx: draft.geometry_px.holes[index],
    z: -thicknessScene / 2,
    normalZ: -1,
    draft,
    isHole: true,
    offsetMm: BACK_EDGE_INSET_MM,
  }))
  const flatBack = outerBack.concat(...holesBack)
  triangulated.forEach((tri) => {
    indices.push(flatBack[tri[2]], flatBack[tri[1]], flatBack[tri[0]])
  })
  const backCount = indices.length - backStart

  const edgeStart = indices.length
  addRingEdge({
    vertices,
    indices,
    ringMm: draft.geometry_mm.outer,
    ringPx: draft.geometry_px.outer,
    isHole: false,
    thicknessScene,
    radiusScene,
    draft,
  })
  draft.geometry_mm.holes.forEach((hole, index) => {
    addRingEdge({
      vertices,
      indices,
      ringMm: hole,
      ringPx: draft.geometry_px.holes[index],
      isHole: true,
      thicknessScene,
      radiusScene,
      draft,
    })
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
