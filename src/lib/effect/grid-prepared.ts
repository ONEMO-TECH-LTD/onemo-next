import type { Contour, Pt } from './types'

export interface GridBBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ExactSegmentRing {
  ringIndex: number
  /** Exact ordered vertices; segment i is pts[i] → pts[(i + 1) % pts.length]. */
  pts: ReadonlyArray<Pt>
}

/**
 * Exact, request-local representation of one concrete manufacturing contour.
 * Coordinates and source edge order are preserved; no rounding, scaling, or resampling occurs.
 */
export interface PreparedContour {
  contour: Contour
  segmentRings: ReadonlyArray<ExactSegmentRing>
  bbox: GridBBox
  centroid: Pt
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

export function prepareExactContour(contour: Contour): PreparedContour {
  return {
    contour,
    segmentRings: [contour.outer, ...contour.holes]
      .map((ring, ringIndex) => ({ ringIndex, pts: ring.pts })),
    bbox: ringBBox(contour.outer.pts),
    centroid: contourCentroid(contour),
  }
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
