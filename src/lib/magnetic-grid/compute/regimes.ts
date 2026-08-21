import type { Band, Contour, ExactReal, Pt, Rational } from '../spec'
import { FIELD_POSITIONS_PER_AXIS } from '../spec'
import { exactBoxTargetCoefficient } from './centre-evidence'
import {
  addRational,
  canonicalExact,
  compareExact,
  compareRational,
  divideRational,
  multiplyRational,
  quadraticRootsWithin,
  rational,
  rationalFromNumber,
  squareRational,
  subtractRational,
} from './exact-real'

type QPoint = readonly [Rational, Rational]
type Quadratic = readonly [Rational, Rational, Rational]

export interface AffinePoint {
  coefficient: QPoint
  offset: QPoint
}

export interface ContactScaleEvent {
  id: string
  scale: ExactReal
  anchor: AffinePoint
  segmentId: string
  segmentA: QPoint
  segmentB: QPoint
  projection: 'a' | 'b' | 'interior'
  equation: readonly string[]
}

export interface ParityClassEvent {
  id: string
  kind: 'PARITY_CLASS'
  axis: 0 | 1
  boundaryMM: number
  scale: Rational
}

const qPoint = ([x, y]: Pt): QPoint => [rationalFromNumber(x), rationalFromNumber(y)]
const subtract = (a: QPoint, b: QPoint): QPoint => [subtractRational(a[0], b[0]), subtractRational(a[1], b[1])]
const dot = (a: QPoint, b: QPoint): Rational => addRational(multiplyRational(a[0], b[0]), multiplyRational(a[1], b[1]))
const cross = (a: QPoint, b: QPoint): Rational => subtractRational(multiplyRational(a[0], b[1]), multiplyRational(a[1], b[0]))
const twice = (value: Rational): Rational => multiplyRational(rational(2), value)

const endpointDistance = (anchor: AffinePoint, endpoint: QPoint): Quadratic => {
  const coefficient = subtract(anchor.coefficient, endpoint)
  return [dot(coefficient, coefficient), twice(dot(coefficient, anchor.offset)), dot(anchor.offset, anchor.offset)]
}

const lineDistance = (anchor: AffinePoint, a: QPoint, b: QPoint): Quadratic => {
  const segment = subtract(b, a)
  const coefficient = cross(subtract(anchor.coefficient, a), segment)
  const offset = cross(anchor.offset, segment)
  const lengthSquared = dot(segment, segment)
  return [
    multiplyRational(coefficient, coefficient),
    twice(multiplyRational(coefficient, offset)),
    multiplyRational(offset, offset),
  ].map((term) => divideRational(term, lengthSquared)) as Quadratic
}

const subtractRadiusSquared = (distance: Quadratic, radius: Rational): Quadratic => [
  distance[0],
  distance[1],
  subtractRational(distance[2], squareRational(radius)),
]

const roots = (equation: Quadratic, band: Band): ExactReal[] => {
  const [a, b, c] = equation
  if (compareRational(a, rational(0)) === 0) {
    if (compareRational(b, rational(0)) === 0) return []
    const root = multiplyRational(rational(-1), divideRational(c, b))
    return compareRational(root, rational(band.minMM)) >= 0 && compareRational(root, rational(band.maxMM)) <= 0 ? [root] : []
  }
  return quadraticRootsWithin(a, b, c, rational(band.minMM), rational(band.maxMM))
}

const polynomialOf = (scale: ExactReal): readonly string[] =>
  'polynomial' in scale ? scale.polynomial : [scale.denominator, `-${scale.numerator}`]

const relations = (band: Band): ReadonlyArray<{ xGap: boolean; yGap: boolean }> => {
  const canonicalGap = band.id % 2 === 0
  return [
    { xGap: canonicalGap, yGap: canonicalGap },
    { xGap: !canonicalGap, yGap: canonicalGap },
    { xGap: canonicalGap, yGap: !canonicalGap },
    { xGap: !canonicalGap, yGap: !canonicalGap },
  ]
}

export const latticeOffsets = (
  gap: boolean,
  pitch: number,
  positionsPerAxis: number = FIELD_POSITIONS_PER_AXIS,
): Rational[] => {
  const out: Rational[] = []
  const first = -Math.floor(positionsPerAxis / 2)
  for (let offsetIndex = 0; offsetIndex < positionsPerAxis; offsetIndex++) {
    const index = first + offsetIndex
    out.push(rationalFromNumber((index + (gap ? .5 : 0)) * pitch))
  }
  return out
}

/** Exact segment contact-event roots for every frozen affine Centre parity candidate in one band. */
export function enumerateAffineContactEvents(
  contour: Contour,
  targetCoefficient: QPoint,
  band: Band,
  pitchMM: number,
  contactRadiusMM: number,
): ContactScaleEvent[] {
  const radius = rationalFromNumber(contactRadiusMM)
  const events: ContactScaleEvent[] = []
  const rings = [contour.outer, ...contour.holes]
  for (const relation of relations(band)) {
    for (const x of latticeOffsets(relation.xGap, pitchMM)) {
      for (const y of latticeOffsets(relation.yGap, pitchMM)) {
        const anchor: AffinePoint = { coefficient: targetCoefficient, offset: [x, y] }
        rings.forEach((ring, ringIndex) => {
          for (let edge = 0, previous = ring.pts.length - 1; edge < ring.pts.length; previous = edge++) {
            const a = qPoint(ring.pts[previous]), b = qPoint(ring.pts[edge])
            const cases: ReadonlyArray<readonly ['a' | 'b' | 'interior', Quadratic]> = [
              ['a', endpointDistance(anchor, a)],
              ['b', endpointDistance(anchor, b)],
              ['interior', lineDistance(anchor, a, b)],
            ]
            for (const [projection, distance] of cases) {
              const equation = subtractRadiusSquared(distance, radius)
              for (const scale of roots(equation, band)) {
                const segmentId = `${ringIndex === 0 ? 'outer' : `hole:${ringIndex - 1}`}:segment:${edge}`
                const id = JSON.stringify([canonicalExact(scale), canonicalExact(x), canonicalExact(y), segmentId, projection])
                events.push({ id, scale, anchor, segmentId, segmentA: a, segmentB: b, projection, equation: polynomialOf(scale) })
              }
            }
          }
        })
      }
    }
  }
  events.sort((a, b) => compareExact(a.scale, b.scale))
  return events.filter((event, index) => index === 0 || event.id !== events[index - 1].id)
}

export const boxTargetCoefficient = exactBoxTargetCoefficient

/** Exact scales where either normalized bbox side crosses a released B1-B4 parity boundary. */
export function enumerateParityClassEvents(contour: Contour, bands: readonly Band[]): ParityClassEvent[] {
  const points = contour.outer.pts.map(qPoint)
  let minX = points[0][0], maxX = points[0][0], minY = points[0][1], maxY = points[0][1]
  for (const [x, y] of points) {
    if (compareRational(x, minX) < 0) minX = x
    if (compareRational(x, maxX) > 0) maxX = x
    if (compareRational(y, minY) < 0) minY = y
    if (compareRational(y, maxY) > 0) maxY = y
  }
  const sides = [subtractRational(maxX, minX), subtractRational(maxY, minY)] as const
  const boundaries = [...new Set(bands.flatMap((band) => [band.minMM, band.maxMM + 1]))].sort((a, b) => a - b)
  const events: ParityClassEvent[] = []
  sides.forEach((side, axis) => {
    if (compareRational(side, rational(0)) <= 0) return
    for (const boundaryMM of boundaries) {
      const scale = divideRational(rational(boundaryMM), side)
      events.push({ id: `parity:${axis}:${boundaryMM}:${canonicalExact(scale)}`, kind: 'PARITY_CLASS', axis: axis as 0 | 1, boundaryMM, scale })
    }
  })
  events.sort((a, b) => compareRational(a.scale, b.scale))
  return events
}
