import type { Contour, Pt } from './types'

export interface GridBBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ExactSegmentRing {
  ringIndex: number
  pts: ReadonlyArray<Pt>
  /** Distance-query order: segment i is pts[i] → pts[(i + 1) % pts.length]. */
  segments: ReadonlyArray<ExactSegment>
  yIntervals: YIntervalNode | null
}

export interface ExactSegment {
  ringIndex: number
  edgeIndex: number
  sourceOrder: number
  /** Ray-cast order matches polygon.ts: closing edge first, then edge 0 onward. */
  containmentOrder: number
  a: Pt
  b: Pt
  bbox: GridBBox
}

interface YIntervalNode {
  centerY: number
  byMinY: ReadonlyArray<ExactSegment>
  byMaxY: ReadonlyArray<ExactSegment>
  left: YIntervalNode | null
  right: YIntervalNode | null
}

interface DistanceBvhNode {
  bbox: GridBBox
  minSourceOrder: number
  segments: ReadonlyArray<ExactSegment> | null
  left: DistanceBvhNode | null
  right: DistanceBvhNode | null
}

/**
 * Exact, request-local representation of one concrete manufacturing contour.
 * Coordinates and source edge order are preserved; no rounding, scaling, or resampling occurs.
 */
export interface PreparedContour {
  contour: Contour
  segmentRings: ReadonlyArray<ExactSegmentRing>
  segments: ReadonlyArray<ExactSegment>
  bbox: GridBBox
  centroid: Pt
  distanceBvh: DistanceBvhNode | null
}

function ringBBox(pts: ReadonlyArray<Pt>): GridBBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/** Area centroid of a polygon ring. Falls back to bbox centre when degenerate. */
function ringCentroid(ring: ReadonlyArray<Pt>): Pt {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % n]
    const cross = x0 * y1 - x1 * y0
    a += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  a *= 0.5
  if (Math.abs(a) < 1e-6) {
    const bbox = ringBBox(ring)
    return [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2]
  }
  return [cx / (6 * a), cy / (6 * a)]
}

function ringArea(ring: ReadonlyArray<Pt>): number {
  let twice = 0
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length]
    twice += x0 * y1 - x1 * y0
  }
  return Math.abs(twice / 2)
}

/** Material centroid: hole area is removed regardless of ring winding. */
function contourCentroid(contour: Contour): Pt {
  const outerC = ringCentroid(contour.outer.pts)
  const outerA = ringArea(contour.outer.pts)
  let area = outerA, x = outerC[0] * outerA, y = outerC[1] * outerA
  for (const hole of contour.holes) {
    const holeA = ringArea(hole.pts), holeC = ringCentroid(hole.pts)
    area -= holeA
    x -= holeC[0] * holeA
    y -= holeC[1] * holeA
  }
  return area > 1e-6 ? [x / area, y / area] : outerC
}

function segmentBBox(a: Pt, b: Pt): GridBBox {
  return {
    minX: Math.min(a[0], b[0]),
    minY: Math.min(a[1], b[1]),
    maxX: Math.max(a[0], b[0]),
    maxY: Math.max(a[1], b[1]),
  }
}

function unionBBox(segments: ReadonlyArray<ExactSegment>): GridBBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const segment of segments) {
    if (segment.bbox.minX < minX) minX = segment.bbox.minX
    if (segment.bbox.minY < minY) minY = segment.bbox.minY
    if (segment.bbox.maxX > maxX) maxX = segment.bbox.maxX
    if (segment.bbox.maxY > maxY) maxY = segment.bbox.maxY
  }
  return { minX, minY, maxX, maxY }
}

function buildYIntervals(segments: ReadonlyArray<ExactSegment>): YIntervalNode | null {
  const active = segments.filter((segment) => segment.bbox.minY < segment.bbox.maxY)
  if (!active.length) return null
  const endpoints = active
    .flatMap((segment) => [segment.bbox.minY, segment.bbox.maxY])
    .sort((a, b) => a - b)
  const centerY = endpoints[Math.floor((endpoints.length - 1) / 2)]
  const left: ExactSegment[] = []
  const right: ExactSegment[] = []
  const spanning: ExactSegment[] = []
  for (const segment of active) {
    if (segment.bbox.maxY <= centerY) left.push(segment)
    else if (segment.bbox.minY > centerY) right.push(segment)
    else spanning.push(segment)
  }
  return {
    centerY,
    byMinY: [...spanning].sort((a, b) =>
      a.bbox.minY - b.bbox.minY || a.containmentOrder - b.containmentOrder),
    byMaxY: [...spanning].sort((a, b) =>
      b.bbox.maxY - a.bbox.maxY || a.containmentOrder - b.containmentOrder),
    left: buildYIntervals(left),
    right: buildYIntervals(right),
  }
}

function buildDistanceBvh(segments: ReadonlyArray<ExactSegment>): DistanceBvhNode | null {
  if (!segments.length) return null
  const bbox = unionBBox(segments)
  let minSourceOrder = Infinity
  for (const segment of segments) {
    if (segment.sourceOrder < minSourceOrder) minSourceOrder = segment.sourceOrder
  }
  if (segments.length <= 8) {
    return {
      bbox,
      minSourceOrder,
      segments: [...segments].sort((a, b) => a.sourceOrder - b.sourceOrder),
      left: null,
      right: null,
    }
  }
  const splitX = bbox.maxX - bbox.minX >= bbox.maxY - bbox.minY
  const sorted = [...segments].sort((a, b) => {
    const ac = splitX
      ? a.bbox.minX + a.bbox.maxX
      : a.bbox.minY + a.bbox.maxY
    const bc = splitX
      ? b.bbox.minX + b.bbox.maxX
      : b.bbox.minY + b.bbox.maxY
    return ac - bc || a.sourceOrder - b.sourceOrder
  })
  const middle = Math.floor(sorted.length / 2)
  return {
    bbox,
    minSourceOrder,
    segments: null,
    left: buildDistanceBvh(sorted.slice(0, middle)),
    right: buildDistanceBvh(sorted.slice(middle)),
  }
}

function buildSegmentRing(
  pts: ReadonlyArray<Pt>,
  ringIndex: number,
  sourceOffset: number,
): ExactSegmentRing {
  const segments = pts.map((a, edgeIndex) => {
    const b = pts[(edgeIndex + 1) % pts.length]
    return {
      ringIndex,
      edgeIndex,
      sourceOrder: sourceOffset + edgeIndex,
      containmentOrder: (edgeIndex + 1) % pts.length,
      a,
      b,
      bbox: segmentBBox(a, b),
    }
  })
  return {
    ringIndex,
    pts,
    segments,
    yIntervals: buildYIntervals(segments),
  }
}

export function prepareExactContour(contour: Contour): PreparedContour {
  let sourceOffset = 0
  const segmentRings = [contour.outer, ...contour.holes].map((ring, ringIndex) => {
    const prepared = buildSegmentRing(ring.pts, ringIndex, sourceOffset)
    sourceOffset += prepared.segments.length
    return prepared
  })
  const segments = segmentRings.flatMap((ring) => ring.segments)
  return {
    contour,
    segmentRings,
    segments,
    bbox: ringBBox(contour.outer.pts),
    centroid: contourCentroid(contour),
    distanceBvh: buildDistanceBvh(segments),
  }
}

/** Exact half-open y-interval query: minY ≤ y < maxY, returned in original ray-cast order. */
export function straddlingSegments(
  ring: ExactSegmentRing,
  y: number,
): ExactSegment[] {
  const result: ExactSegment[] = []
  const visit = (node: YIntervalNode | null): void => {
    if (!node) return
    if (y < node.centerY) {
      for (const segment of node.byMinY) {
        if (segment.bbox.minY > y) break
        result.push(segment)
      }
      visit(node.left)
    } else {
      for (const segment of node.byMaxY) {
        if (segment.bbox.maxY <= y) break
        result.push(segment)
      }
      visit(node.right)
    }
  }
  visit(ring.yIntervals)
  return result.sort((a, b) => a.containmentOrder - b.containmentOrder)
}

/** Exact even-odd ray cast using the unchanged polygon.ts arithmetic on indexed straddling edges. */
export function pointInPreparedRing(p: Pt, ring: ExactSegmentRing): boolean {
  let inside = false
  for (const segment of straddlingSegments(ring, p[1])) {
    const [xj, yj] = segment.a
    const [xi, yi] = segment.b
    const crosses = (yi > p[1]) !== (yj > p[1])
      && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

export function pointInPreparedContour(p: Pt, prepared: PreparedContour): boolean {
  if (!pointInPreparedRing(p, prepared.segmentRings[0])) return false
  for (let index = 1; index < prepared.segmentRings.length; index += 1) {
    if (pointInPreparedRing(p, prepared.segmentRings[index])) return false
  }
  return true
}

/** Unchanged point-to-segment arithmetic from grid-core's original exhaustive scan. */
export function distanceToExactSegment(p: Pt, segment: ExactSegment): number {
  const [a, b] = [segment.a, segment.b]
  const vx = b[0] - a[0], vy = b[1] - a[1]
  const wx = p[0] - a[0], wy = p[1] - a[1]
  const c1 = vx * wx + vy * wy
  if (c1 <= 0) return Math.hypot(wx, wy)
  const c2 = vx * vx + vy * vy
  if (c2 <= c1) return Math.hypot(p[0] - b[0], p[1] - b[1])
  const t = c1 / c2
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy))
}

function distanceToBBox(p: Pt, bbox: GridBBox): number {
  const dx = p[0] < bbox.minX ? bbox.minX - p[0] : p[0] > bbox.maxX ? p[0] - bbox.maxX : 0
  const dy = p[1] < bbox.minY ? bbox.minY - p[1] : p[1] > bbox.maxY ? p[1] - bbox.maxY : 0
  return Math.hypot(dx, dy)
}

export interface NearestPreparedSegment {
  distance: number
  segment: ExactSegment | null
  visitedEdges: number
}

/** Exact nearest edge. Strict lower-bound pruning keeps equal-distance source-order ties observable. */
export function nearestPreparedSegment(
  p: Pt,
  prepared: PreparedContour,
): NearestPreparedSegment {
  let distance = Infinity
  let segment: ExactSegment | null = null
  let visitedEdges = 0
  const visit = (node: DistanceBvhNode | null): void => {
    if (!node || distanceToBBox(p, node.bbox) > distance) return
    if (node.segments) {
      for (const candidate of node.segments) {
        visitedEdges += 1
        const candidateDistance = distanceToExactSegment(p, candidate)
        if (candidateDistance < distance
          || (candidateDistance === distance
            && (!segment || candidate.sourceOrder < segment.sourceOrder))) {
          distance = candidateDistance
          segment = candidate
        }
      }
      return
    }
    const left = node.left
    const right = node.right
    const leftDistance = left ? distanceToBBox(p, left.bbox) : Infinity
    const rightDistance = right ? distanceToBBox(p, right.bbox) : Infinity
    const leftFirst = leftDistance < rightDistance
      || (leftDistance === rightDistance
        && (left?.minSourceOrder ?? Infinity) <= (right?.minSourceOrder ?? Infinity))
    if (leftFirst) {
      if (leftDistance <= distance) visit(left)
      if (rightDistance <= distance) visit(right)
    } else {
      if (rightDistance <= distance) visit(right)
      if (leftDistance <= distance) visit(left)
    }
  }
  visit(prepared.distanceBvh)
  return { distance, segment, visitedEdges }
}

export function distanceToPreparedContour(p: Pt, prepared: PreparedContour): number {
  return nearestPreparedSegment(p, prepared).distance
}

/**
 * Bounded-lifetime exact preparation cache. One instance belongs to one concrete design-size solve;
 * variants are keyed by the exact margin input and never shared across sizes or requests.
 */
export class PreparedContourSource {
  private readonly variants = new Map<number, PreparedContour>()

  constructor(private readonly contourAt: (exactKey: number) => Contour) {}

  get(exactKey: number): PreparedContour {
    if (!Number.isFinite(exactKey)) throw new RangeError('Prepared contour key must be finite.')
    const cached = this.variants.get(exactKey)
    if (cached) return cached
    const prepared = prepareExactContour(this.contourAt(exactKey))
    this.variants.set(exactKey, prepared)
    return prepared
  }

  get size(): number {
    return this.variants.size
  }
}
