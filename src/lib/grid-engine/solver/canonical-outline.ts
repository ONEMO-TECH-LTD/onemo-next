import type { PointMM } from '../engine'
import type { UnsupportedOutlineReason } from './contract'
import { exactOrientation, exactSignedAreaSign } from './exact'

export class UnsupportedOutlineError extends RangeError {
  constructor(readonly reason: UnsupportedOutlineReason) {
    super(reason)
  }
}

const samePoint = (a: PointMM, b: PointMM): boolean => a[0] === b[0] && a[1] === b[1]

const pointOnSegment = (p: PointMM, a: PointMM, b: PointMM): boolean =>
  exactOrientation(a, b, p) === 0 &&
  p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) &&
  p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1])

const segmentsIntersect = (a: PointMM, b: PointMM, c: PointMM, d: PointMM): boolean => {
  const abC = exactOrientation(a, b, c)
  const abD = exactOrientation(a, b, d)
  const cdA = exactOrientation(c, d, a)
  const cdB = exactOrientation(c, d, b)
  if (abC === 0 && pointOnSegment(c, a, b)) return true
  if (abD === 0 && pointOnSegment(d, a, b)) return true
  if (cdA === 0 && pointOnSegment(a, c, d)) return true
  if (cdB === 0 && pointOnSegment(b, c, d)) return true
  return abC !== abD && cdA !== cdB
}

const sequenceCompare = (points: ReadonlyArray<PointMM>, a: number, b: number): number => {
  for (let offset = 0; offset < points.length; offset++) {
    const left = points[(a + offset) % points.length]
    const right = points[(b + offset) % points.length]
    if (left[0] !== right[0]) return left[0] - right[0]
    if (left[1] !== right[1]) return left[1] - right[1]
  }
  return 0
}

export function canonicalOutline(input: ReadonlyArray<PointMM>): PointMM[] {
  const points: PointMM[] = []
  for (const [x, y] of input) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new UnsupportedOutlineError('non-finite-coordinate')
    const point: PointMM = [Object.is(x, -0) ? 0 : x, Object.is(y, -0) ? 0 : y]
    if (!points.length || !samePoint(points[points.length - 1], point)) points.push(point)
  }
  if (points.length > 1 && samePoint(points[0], points[points.length - 1])) points.pop()
  if (points.length < 3) throw new UnsupportedOutlineError('fewer-than-three-vertices')

  for (let a = 0; a < points.length; a++) {
    const aNext = (a + 1) % points.length
    for (let b = a + 1; b < points.length; b++) {
      const bNext = (b + 1) % points.length
      if (a === b || aNext === b || bNext === a) continue
      if (segmentsIntersect(points[a], points[aNext], points[b], points[bNext])) {
        throw new UnsupportedOutlineError('self-intersection')
      }
    }
  }

  const areaSign = exactSignedAreaSign(points)
  if (areaSign === 0) throw new UnsupportedOutlineError('zero-area')
  if (areaSign < 0) points.reverse()

  let first = 0
  for (let index = 1; index < points.length; index++) {
    if (sequenceCompare(points, index, first) < 0) first = index
  }
  return points.map((_, index) => points[(first + index) % points.length])
}

