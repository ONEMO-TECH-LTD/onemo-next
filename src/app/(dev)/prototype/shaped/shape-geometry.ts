import earcut from 'earcut'
import * as THREE from 'three'
import { contourBounds, extractOuterContour, type Point2 } from './contour'
import { DEFAULT_SHAPE_SPEC_DIMENSIONS, type BinaryMask, type ShapeMeshStats } from './shape-spec'

interface BuildOptions {
  targetMinDimensionMm?: number
  bodyThicknessMm?: number
  edgeRadiusMm?: number
}

function signedArea(points: Point2[]) {
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  return area * 0.5
}

function computeOutwardNormals(points: THREE.Vector2[]) {
  const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector2()).multiplyScalar(1 / points.length)

  return points.map((point, index) => {
    const prev = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]
    const tangent = new THREE.Vector2(next.x - prev.x, next.y - prev.y).normalize()
    const normal = new THREE.Vector2(tangent.y, -tangent.x).normalize()
    if (normal.dot(new THREE.Vector2(point.x - center.x, point.y - center.y)) < 0) {
      normal.multiplyScalar(-1)
    }
    return normal
  })
}

export function buildShapedGeometryFromMask(mask: BinaryMask, options: BuildOptions = {}) {
  const contour = extractOuterContour(mask)
  if (contour.length < 3) {
    return null
  }

  const targetMinDimensionMm = options.targetMinDimensionMm ?? DEFAULT_SHAPE_SPEC_DIMENSIONS.targetMinDimensionMm
  const bodyThicknessMm = options.bodyThicknessMm ?? DEFAULT_SHAPE_SPEC_DIMENSIONS.bodyThicknessMm
  const edgeRadiusMm = Math.min(
    options.edgeRadiusMm ?? DEFAULT_SHAPE_SPEC_DIMENSIONS.edgeRadiusMm,
    bodyThicknessMm / 2
  )
  const bounds = contourBounds(contour)
  const contourWidth = bounds.maxX - bounds.minX
  const contourHeight = bounds.maxY - bounds.minY
  const pxToMm = targetMinDimensionMm / Math.max(1, Math.min(contourWidth, contourHeight))
  const centerX = (bounds.minX + bounds.maxX) * 0.5
  const centerY = (bounds.minY + bounds.maxY) * 0.5
  const mmContour = contour.map((point) => new THREE.Vector2(
    (point.x - centerX) * pxToMm,
    -(point.y - centerY) * pxToMm
  ))
  const sourceUv = contour.map((point) => ({
    u: point.x / mask.width,
    v: 1 - point.y / mask.height,
  }))
  const contourForEarcut = signedArea(mmContour) < 0 ? mmContour.slice().reverse() : mmContour
  const uvForEarcut = signedArea(mmContour) < 0 ? sourceUv.slice().reverse() : sourceUv
  const normals = computeOutwardNormals(contourForEarcut)
  const flat = contourForEarcut.flatMap((point) => [point.x, point.y])
  const faceIndices = earcut(flat)
  const profileSteps = 10
  const halfThickness = bodyThicknessMm * 0.5
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const ringCount = profileSteps + 1
  const vertexCountPerRing = contourForEarcut.length

  for (let profile = 0; profile < ringCount; profile += 1) {
    const t = profile / profileSteps
    const angle = Math.PI * t
    const z = Math.cos(angle) * halfThickness
    const offset = Math.sin(angle) * edgeRadiusMm

    contourForEarcut.forEach((point, index) => {
      const normal = normals[index]
      positions.push(point.x + normal.x * offset, point.y + normal.y * offset, z)
      uvs.push(uvForEarcut[index].u, uvForEarcut[index].v)
    })
  }

  const frontStart = indices.length
  faceIndices.forEach((index) => indices.push(index))
  const frontCount = indices.length - frontStart

  const edgeStart = indices.length
  for (let profile = 0; profile < profileSteps; profile += 1) {
    const ringA = profile * vertexCountPerRing
    const ringB = (profile + 1) * vertexCountPerRing
    for (let index = 0; index < vertexCountPerRing; index += 1) {
      const next = (index + 1) % vertexCountPerRing
      indices.push(ringA + index, ringA + next, ringB + index)
      indices.push(ringA + next, ringB + next, ringB + index)
    }
  }
  const edgeCount = indices.length - edgeStart

  const backStart = indices.length
  const backOffset = profileSteps * vertexCountPerRing
  for (let i = 0; i < faceIndices.length; i += 3) {
    indices.push(backOffset + faceIndices[i + 2], backOffset + faceIndices[i + 1], backOffset + faceIndices[i])
  }
  const backCount = indices.length - backStart

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.addGroup(frontStart, frontCount, 0)
  geometry.addGroup(edgeStart, edgeCount, 0)
  geometry.addGroup(backStart, backCount, 1)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  const stats: ShapeMeshStats = {
    contourPoints: contourForEarcut.length,
    triangles: indices.length / 3,
    widthMm: contourWidth * pxToMm,
    heightMm: contourHeight * pxToMm,
    bodyThicknessMm,
    edgeRadiusMm,
  }

  return { geometry, stats }
}
