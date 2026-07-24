import { describe, expect, it } from 'vitest'

import {
  distanceToExactSegment,
  nearestPreparedSegment,
  pointInPreparedContour,
  pointInPreparedRing,
  prepareExactContour,
  straddlingSegments,
} from '../grid-prepared'
import { DENSE_REAL_AI_GRID_CONTOUR } from '../grid-s0-corpus'
import { pointInContour, pointInPolygon } from '../polygon'
import type { Contour, Pt } from '../types'

const concaveWithHole: Contour = {
  outer: { pts: [
    [0, 0], [80, 0], [80, 30], [45, 30], [45, 80], [0, 80],
  ] },
  holes: [{ pts: [[10, 10], [25, 10], [25, 25], [10, 25]] }],
}

function bruteNearest(p: Pt, contour: Contour) {
  const prepared = prepareExactContour(contour)
  let distance = Infinity
  let sourceOrder = -1
  for (const segment of prepared.segments) {
    const candidate = distanceToExactSegment(p, segment)
    if (candidate < distance) {
      distance = candidate
      sourceOrder = segment.sourceOrder
    }
  }
  return { distance, sourceOrder }
}

describe('S1b exact y-interval containment index', () => {
  it('returns every half-open straddling edge in the original closing-edge-first order', () => {
    const prepared = prepareExactContour({
      outer: { pts: [[0, 0], [10, 0], [10, 10], [0, 10]] },
      holes: [],
    })
    const ring = prepared.segmentRings[0]

    expect(straddlingSegments(ring, 0).map((edge) => edge.edgeIndex)).toEqual([3, 1])
    expect(straddlingSegments(ring, 5).map((edge) => edge.edgeIndex)).toEqual([3, 1])
    expect(straddlingSegments(ring, 10)).toEqual([])
  })

  it('is identical to the exhaustive ray cast for concavity, holes, vertices, and boundaries', () => {
    const prepared = prepareExactContour(concaveWithHole)
    const probes: Pt[] = [
      [-1, -1], [1, 1], [15, 15], [30, 15], [60, 15], [60, 50],
      [20, 60], [0, 0], [40, 0], [80, 15], [45, 30], [45, 55], [10, 10],
      [25, 20], [12.3456789012345, 29.999999999999],
    ]

    for (const probe of probes) {
      expect(pointInPreparedRing(probe, prepared.segmentRings[0]))
        .toBe(pointInPolygon(probe, concaveWithHole.outer.pts))
      expect(pointInPreparedContour(probe, prepared))
        .toBe(pointInContour(probe, concaveWithHole))
    }
  })

  it('falls back to every edge when every interval straddles the query', () => {
    const pts = Array.from({ length: 64 }, (_, index) =>
      [index, index % 2 === 0 ? -1 : 1] as Pt)
    const prepared = prepareExactContour({ outer: { pts }, holes: [] })

    expect(straddlingSegments(prepared.segmentRings[0], 0)).toHaveLength(pts.length)
  })

  it('matches the exhaustive predicate across the dense real-AI contour field', () => {
    const prepared = prepareExactContour(DENSE_REAL_AI_GRID_CONTOUR)
    for (let x = -10; x <= 190; x += 10) for (let y = -10; y <= 190; y += 10) {
      const probe: Pt = [x + 0.123456789, y + 0.987654321]
      expect(pointInPreparedContour(probe, prepared))
        .toBe(pointInContour(probe, DENSE_REAL_AI_GRID_CONTOUR))
    }
  })
})

describe('S1b exact AABB/BVH nearest-distance index', () => {
  it('matches exhaustive distance and first-source tie semantics', () => {
    const contours: Contour[] = [
      concaveWithHole,
      { outer: { pts: [[0, 0], [10, 0], [10, 10], [0, 10]] }, holes: [] },
    ]
    const probes: Pt[] = [
      [5, 5], [0, 0], [10, 5], [20, 20], [44.999999999999, 31],
      [12.3456789012345, 67.890123456789],
    ]

    for (const contour of contours) {
      const prepared = prepareExactContour(contour)
      for (const probe of probes) {
        const brute = bruteNearest(probe, contour)
        const indexed = nearestPreparedSegment(probe, prepared)
        expect(indexed.distance).toBe(brute.distance)
        expect(indexed.segment?.sourceOrder).toBe(brute.sourceOrder)
      }
    }

    const square = prepareExactContour(contours[1])
    const tied = nearestPreparedSegment([5, 5], square)
    expect(tied.distance).toBe(5)
    expect(tied.segment?.edgeIndex).toBe(0)
  })

  it('retains the exact O(edges) worst-case fallback when no BVH node can be pruned', () => {
    const radius = 10
    const pts = Array.from({ length: 64 }, (_, index) => {
      const angle = (index / 64) * Math.PI * 2
      return [radius * Math.cos(angle), radius * Math.sin(angle)] as Pt
    })
    const prepared = prepareExactContour({ outer: { pts }, holes: [] })
    const nearest = nearestPreparedSegment([0, 0], prepared)

    expect(nearest.visitedEdges).toBe(prepared.segments.length)
    expect(nearest.distance).toBe(bruteNearest([0, 0], prepared.contour).distance)
  })

  it('matches exhaustive distance across the dense real-AI contour field', () => {
    const prepared = prepareExactContour(DENSE_REAL_AI_GRID_CONTOUR)
    for (let x = 0; x <= 180; x += 20) for (let y = 0; y <= 180; y += 20) {
      const probe: Pt = [x + 0.123456789, y + 0.987654321]
      const brute = bruteNearest(probe, DENSE_REAL_AI_GRID_CONTOUR)
      const indexed = nearestPreparedSegment(probe, prepared)
      expect(indexed.distance).toBe(brute.distance)
      expect(indexed.segment?.sourceOrder).toBe(brute.sourceOrder)
    }
  })
})
