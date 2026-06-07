'use client'

import {
  SHAPED_DEFAULTS,
  type ShapePoint,
  type ShapeSpecDraft,
  type ShapedPreviewSettings,
} from './shape-spec'

export interface BinaryMask {
  width: number
  height: number
  data: Uint8Array
  foregroundMode: 'alpha' | 'border-background'
}

interface LoopCandidate {
  points: ShapePoint[]
  area: number
}

const EPSILON = 0.000001
const CONTOUR_RESOLUTION_BOOST = 1.5

export function polygonArea(points: ShapePoint[]) {
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  return area / 2
}

export function polygonBounds(points: ShapePoint[]) {
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

export function pointInPolygon(point: ShapePoint, polygon: ShapePoint[]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + EPSILON) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

function distanceToSegment(point: ShapePoint, a: ShapePoint, b: ShapePoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
    return Math.hypot(point.x - a.x, point.y - a.y)
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)))
  const x = a.x + t * dx
  const y = a.y + t * dy
  return Math.hypot(point.x - x, point.y - y)
}

export function simplifyRdp(points: ShapePoint[], epsilon: number): ShapePoint[] {
  if (points.length <= 3) return points

  const closed = points[0].x === points[points.length - 1].x && points[0].y === points[points.length - 1].y
  const working = closed ? points.slice(0, -1) : points

  function simplifyOpen(openPoints: ShapePoint[]): ShapePoint[] {
    if (openPoints.length <= 2) return openPoints

    let maxDistance = 0
    let index = 0
    const first = openPoints[0]
    const last = openPoints[openPoints.length - 1]

    for (let i = 1; i < openPoints.length - 1; i += 1) {
      const distance = distanceToSegment(openPoints[i], first, last)
      if (distance > maxDistance) {
        maxDistance = distance
        index = i
      }
    }

    if (maxDistance <= epsilon) {
      return [first, last]
    }

    const left = simplifyOpen(openPoints.slice(0, index + 1))
    const right = simplifyOpen(openPoints.slice(index))
    return left.slice(0, -1).concat(right)
  }

  const anchorIndex = working.reduce((bestIndex, point, index) => {
    const best = working[bestIndex]
    return point.x < best.x || (point.x === best.x && point.y < best.y) ? index : bestIndex
  }, 0)
  const rotated = working.slice(anchorIndex).concat(working.slice(0, anchorIndex), [working[anchorIndex]])
  const simplified = simplifyOpen(rotated).slice(0, -1)
  return simplified.length >= 3 ? simplified : working
}

function smoothClosedRing(points: ShapePoint[], iterations: number) {
  let ring = points
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (ring.length < 3) return ring
    const nextRing: ShapePoint[] = []
    for (let index = 0; index < ring.length; index += 1) {
      const a = ring[index]
      const b = ring[(index + 1) % ring.length]
      nextRing.push(
        { x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 },
        { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 }
      )
    }
    ring = nextRing
  }
  return ring
}

function resampleClosedRing(points: ShapePoint[], factor: number) {
  const targetCount = Math.round(points.length * factor)
  if (points.length < 3 || targetCount <= points.length) return points

  const lengths = points.map((point, index) => {
    const next = points[(index + 1) % points.length]
    return Math.hypot(next.x - point.x, next.y - point.y)
  })
  const perimeter = lengths.reduce((sum, length) => sum + length, 0)
  if (perimeter < EPSILON) return points

  const resampled: ShapePoint[] = []
  let edgeIndex = 0
  let edgeStartDistance = 0

  for (let index = 0; index < targetCount; index += 1) {
    const targetDistance = (index / targetCount) * perimeter
    while (
      edgeIndex < lengths.length - 1 &&
      edgeStartDistance + lengths[edgeIndex] < targetDistance
    ) {
      edgeStartDistance += lengths[edgeIndex]
      edgeIndex += 1
    }

    const a = points[edgeIndex]
    const b = points[(edgeIndex + 1) % points.length]
    const localDistance = targetDistance - edgeStartDistance
    const t = lengths[edgeIndex] > EPSILON ? localDistance / lengths[edgeIndex] : 0
    resampled.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    })
  }

  return resampled
}

function maskAt(mask: BinaryMask, x: number, y: number) {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return 0
  return mask.data[y * mask.width + x]
}

function largestConnectedComponent(mask: BinaryMask): BinaryMask {
  const visited = new Uint8Array(mask.data.length)
  const output = new Uint8Array(mask.data.length)
  let bestPixels: number[] = []
  const queue: number[] = []

  for (let index = 0; index < mask.data.length; index += 1) {
    if (!mask.data[index] || visited[index]) continue

    const component: number[] = []
    visited[index] = 1
    queue.length = 0
    queue.push(index)

    while (queue.length) {
      const current = queue.pop()
      if (current === undefined) break
      component.push(current)
      const x = current % mask.width
      const y = Math.floor(current / mask.width)
      const neighbors = [
        current - 1,
        current + 1,
        current - mask.width,
        current + mask.width,
      ]

      for (const next of neighbors) {
        const nx = next % mask.width
        const ny = Math.floor(next / mask.width)
        if (next < 0 || next >= mask.data.length || visited[next] || !mask.data[next]) continue
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
        visited[next] = 1
        queue.push(next)
      }
    }

    if (component.length > bestPixels.length) {
      bestPixels = component
    }
  }

  bestPixels.forEach((index) => {
    output[index] = 1
  })

  return { ...mask, data: output }
}

function addSegment(segments: Array<[ShapePoint, ShapePoint]>, a: ShapePoint, b: ShapePoint) {
  segments.push([a, b])
}

function marchingSquares(mask: BinaryMask): Array<[ShapePoint, ShapePoint]> {
  const segments: Array<[ShapePoint, ShapePoint]> = []

  for (let y = 0; y < mask.height - 1; y += 1) {
    for (let x = 0; x < mask.width - 1; x += 1) {
      const tl = maskAt(mask, x, y)
      const tr = maskAt(mask, x + 1, y)
      const br = maskAt(mask, x + 1, y + 1)
      const bl = maskAt(mask, x, y + 1)
      const cell = (tl ? 1 : 0) | (tr ? 2 : 0) | (br ? 4 : 0) | (bl ? 8 : 0)
      if (cell === 0 || cell === 15) continue

      const top = { x: x + 0.5, y }
      const right = { x: x + 1, y: y + 0.5 }
      const bottom = { x: x + 0.5, y: y + 1 }
      const left = { x, y: y + 0.5 }

      switch (cell) {
        case 1: addSegment(segments, left, top); break
        case 2: addSegment(segments, top, right); break
        case 3: addSegment(segments, left, right); break
        case 4: addSegment(segments, right, bottom); break
        case 5:
          addSegment(segments, left, bottom)
          addSegment(segments, top, right)
          break
        case 6: addSegment(segments, top, bottom); break
        case 7: addSegment(segments, left, bottom); break
        case 8: addSegment(segments, bottom, left); break
        case 9: addSegment(segments, top, bottom); break
        case 10:
          addSegment(segments, top, left)
          addSegment(segments, right, bottom)
          break
        case 11: addSegment(segments, right, bottom); break
        case 12: addSegment(segments, left, right); break
        case 13: addSegment(segments, top, right); break
        case 14: addSegment(segments, left, top); break
      }
    }
  }

  return segments
}

function pointKey(point: ShapePoint) {
  return `${Math.round(point.x * 2)},${Math.round(point.y * 2)}`
}

function stitchSegments(segments: Array<[ShapePoint, ShapePoint]>): LoopCandidate[] {
  const points = new Map<string, ShapePoint>()
  const adjacency = new Map<string, Set<string>>()
  const visitedEdges = new Set<string>()

  function connect(a: ShapePoint, b: ShapePoint) {
    const ak = pointKey(a)
    const bk = pointKey(b)
    points.set(ak, a)
    points.set(bk, b)
    if (!adjacency.has(ak)) adjacency.set(ak, new Set())
    if (!adjacency.has(bk)) adjacency.set(bk, new Set())
    adjacency.get(ak)?.add(bk)
    adjacency.get(bk)?.add(ak)
  }

  segments.forEach(([a, b]) => connect(a, b))

  const loops: LoopCandidate[] = []

  for (const start of adjacency.keys()) {
    const neighbors = adjacency.get(start)
    if (!neighbors) continue

    for (const firstNext of neighbors) {
      const firstEdge = [start, firstNext].sort().join('|')
      if (visitedEdges.has(firstEdge)) continue

      const loopKeys: string[] = [start]
      let previous = start
      let current = firstNext

      for (let guard = 0; guard < segments.length * 3; guard += 1) {
        const edge = [previous, current].sort().join('|')
        visitedEdges.add(edge)
        loopKeys.push(current)

        if (current === start) break

        const currentNeighbors = [...(adjacency.get(current) ?? [])]
        const next =
          currentNeighbors.find((candidate) => {
            const candidateEdge = [current, candidate].sort().join('|')
            return candidate !== previous && !visitedEdges.has(candidateEdge)
          }) ?? currentNeighbors.find((candidate) => candidate !== previous)

        if (!next) break
        previous = current
        current = next
      }

      if (loopKeys[loopKeys.length - 1] === start && loopKeys.length > 8) {
        const loop = loopKeys.slice(0, -1).map((key) => points.get(key)).filter((point): point is ShapePoint => !!point)
        const area = polygonArea(loop)
        if (Math.abs(area) > 6) {
          loops.push({ points: loop, area })
        }
      }
    }
  }

  return loops
}

function orientPairedRings(px: ShapePoint[], mm: ShapePoint[], desired: 'ccw' | 'cw') {
  const area = polygonArea(mm)
  const isCcw = area > 0
  if ((desired === 'ccw' && isCcw) || (desired === 'cw' && !isCcw)) {
    return { px, mm }
  }
  return {
    px: [...px].reverse(),
    mm: [...mm].reverse(),
  }
}

function scaleLoopToSource(loop: ShapePoint[], mask: BinaryMask, sourceWidth: number, sourceHeight: number) {
  const sx = sourceWidth / mask.width
  const sy = sourceHeight / mask.height
  return loop.map((point) => ({
    x: point.x * sx,
    y: point.y * sy,
  }))
}

function centroid(points: ShapePoint[]) {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

function toShapeMm(points: ShapePoint[], bounds: ReturnType<typeof polygonBounds>, pxToMm: number) {
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  return points.map((point) => ({
    x: (point.x - centerX) * pxToMm,
    y: -(point.y - centerY) * pxToMm,
  }))
}

function edgeOutwardNormal(a: ShapePoint, b: ShapePoint, winding: 'ccw' | 'cw') {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  return winding === 'ccw'
    ? { x: dy / length, y: -dx / length }
    : { x: -dy / length, y: dx / length }
}

function offsetPreviewRing(points: ShapePoint[], distanceMm: number) {
  if (points.length < 3 || distanceMm === 0) return points

  const winding = polygonArea(points) >= 0 ? 'ccw' : 'cw'
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]
    const previousNormal = edgeOutwardNormal(previous, point, winding)
    const nextNormal = edgeOutwardNormal(point, next, winding)
    const mx = previousNormal.x + nextNormal.x
    const my = previousNormal.y + nextNormal.y
    const miterLength = Math.hypot(mx, my)
    if (miterLength < EPSILON) {
      return {
        x: point.x + nextNormal.x * distanceMm,
        y: point.y + nextNormal.y * distanceMm,
      }
    }

    const nx = mx / miterLength
    const ny = my / miterLength
    const alignment = Math.max(0.4, nx * nextNormal.x + ny * nextNormal.y)
    const scaledDistance = Math.min(Math.abs(distanceMm) / alignment, Math.abs(distanceMm) * 2.5) * Math.sign(distanceMm)

    return {
      x: point.x + nx * scaledDistance,
      y: point.y + ny * scaledDistance,
    }
  })
}

function draftHash(parts: Array<string | number>) {
  let hash = 2166136261
  parts.join('|').split('').forEach((char) => {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  })
  return `draft-${(hash >>> 0).toString(16)}`
}

export function createShapeSpecDraftFromMask({
  sourceRef,
  sourceWidth,
  sourceHeight,
  mask,
  settings,
}: {
  sourceRef: string
  sourceWidth: number
  sourceHeight: number
  mask: BinaryMask
  settings: ShapedPreviewSettings
}): ShapeSpecDraft {
  const componentMask = largestConnectedComponent(mask)
  const loops = stitchSegments(marchingSquares(componentMask))
    .sort((a, b) => Math.abs(b.area) - Math.abs(a.area))

  if (!loops.length) {
    throw new Error('No cut-out contour found. Adjust threshold or upload an image with clearer contrast.')
  }

  const outerSourceRaw = scaleLoopToSource(loops[0].points, mask, sourceWidth, sourceHeight)
  const outerBoundsRaw = polygonBounds(outerSourceRaw)
  const minDimensionPx = Math.max(1, Math.min(outerBoundsRaw.maxX - outerBoundsRaw.minX, outerBoundsRaw.maxY - outerBoundsRaw.minY))
  const pxToMm = settings.targetMinDimensionMm / minDimensionPx
  const simplifyPx = settings.simplifyEpsilonMm / pxToMm
  const smoothIterations = componentMask.foregroundMode === 'alpha' ? 2 : 3

  const outerSourceInitial = resampleClosedRing(
    smoothClosedRing(simplifyRdp(outerSourceRaw, simplifyPx), smoothIterations),
    CONTOUR_RESOLUTION_BOOST
  )
  const sourceBounds = polygonBounds(outerSourceInitial)

  const holeLoops = componentMask.foregroundMode === 'alpha' ? loops.slice(1) : []
  const holePairs = holeLoops.flatMap((loop) => {
    const sourceLoop = scaleLoopToSource(loop.points, mask, sourceWidth, sourceHeight)
    const c = centroid(sourceLoop)
    if (!pointInPolygon(c, outerSourceInitial)) return []
    const simplified = resampleClosedRing(
      smoothClosedRing(simplifyRdp(sourceLoop, simplifyPx), smoothIterations),
      CONTOUR_RESOLUTION_BOOST
    )
    if (simplified.length < 3) return []
    return [orientPairedRings(simplified, toShapeMm(simplified, sourceBounds, pxToMm), 'cw')]
  })

  const outerPair = orientPairedRings(
    outerSourceInitial,
    toShapeMm(outerSourceInitial, sourceBounds, pxToMm),
    'ccw'
  )
  const outerSource = outerPair.px
  const outerMm = outerPair.mm
  const outerBounds = polygonBounds(outerSource)
  const holesSource = holePairs.map((pair) => pair.px)
  const holesMm = holePairs.map((pair) => pair.mm)
  const dimensionsWidth = (outerBounds.maxX - outerBounds.minX) * pxToMm
  const dimensionsHeight = (outerBounds.maxY - outerBounds.minY) * pxToMm
  const nodeCount = outerMm.length + holesMm.reduce((sum, hole) => sum + hole.length, 0)

  return {
    id: draftHash([sourceRef, sourceWidth, sourceHeight, nodeCount, settings.threshold, settings.targetMinDimensionMm]),
    source: {
      ref: sourceRef,
      width_px: sourceWidth,
      height_px: sourceHeight,
      hash: draftHash([sourceRef, sourceWidth, sourceHeight]),
    },
    approved_mask: {
      width_px: mask.width,
      height_px: mask.height,
      threshold: settings.threshold,
      foreground_mode: mask.foregroundMode,
    },
    generator: {
      adapter_id: 'browser-free-mask-adapter',
      client_version: 's57-codex-lane-b-v1',
      model_version: mask.foregroundMode === 'alpha' ? 'alpha-channel' : 'border-background-threshold',
    },
    edit_ops: [
      { op: 'target_min_dimension_mm', value: settings.targetMinDimensionMm },
      { op: 'threshold', value: settings.threshold },
      { op: 'rdp_epsilon_mm', value: settings.simplifyEpsilonMm },
    ],
    geometry_px: {
      outer: outerSource,
      holes: holesSource,
      winding: 'outer_ccw_holes_cw',
      fill_rule: 'nonzero',
    },
    geometry_mm: {
      outer: outerMm,
      holes: holesMm,
      winding: 'outer_ccw_holes_cw',
      fill_rule: 'nonzero',
    },
    dimensions_mm: {
      width: dimensionsWidth,
      height: dimensionsHeight,
      thickness_body: SHAPED_DEFAULTS.bodyThicknessMm,
      min_feature_width_mm: settings.minFeatureWidthMm,
      edge_profile: 'rounded',
      edge_radius_mm: SHAPED_DEFAULTS.edgeRadiusMm,
      source_px_to_shape_mm: pxToMm,
    },
    paths_mm: {
      cutline: outerMm,
      bleed: offsetPreviewRing(outerMm, SHAPED_DEFAULTS.edgeRadiusMm),
      safe: offsetPreviewRing(outerMm, -SHAPED_DEFAULTS.edgeRadiusMm),
    },
    attachment_template: {
      hardware_type: 'magnet',
      grid_pitch_mm: SHAPED_DEFAULTS.gridPitchMm,
      layout: 'silhouette_adaptive',
    },
    validation: [
      {
        code: 'DRAFT_CONTOUR_NODE_COUNT',
        subsystem: 'contour',
        severity: nodeCount > 420 ? 'warn' : 'info',
        measured: nodeCount,
        threshold: 420,
        message: `${nodeCount} contour nodes after mm RDP simplify.`,
      },
      {
        code: 'MIN_DIMENSION_LOCK',
        subsystem: 'shape_spec',
        severity: 'info',
        measured: Math.min(dimensionsWidth, dimensionsHeight),
        threshold: settings.targetMinDimensionMm,
        message: `Smallest dimension is locked to ${settings.targetMinDimensionMm}mm for this preview slice.`,
      },
      {
        code: 'MIN_FEATURE_WIDTH',
        subsystem: 'manufacturing',
        severity: 'info',
        measured: settings.minFeatureWidthMm,
        threshold: settings.minFeatureWidthMm,
        message: `Opaque auto-cutout uses ${settings.minFeatureWidthMm}mm minimum feature width; thinner details are intentionally excluded or absorbed.`,
      },
    ],
  }
}
