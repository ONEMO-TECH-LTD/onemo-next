import type { AlgebraicReal, Band, Contour, ExactReal, Pt, Rational } from '../spec'
import { BANDS, FIELD_POSITIONS_PER_AXIS } from '../spec'
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
  signQuadraticAtExact,
  squareRational,
  subtractRational,
} from './exact-real'
import type { ExactCentreCoefficient } from './centre-evidence'

type QPoint = readonly [Rational, Rational]

export interface ParityClassEvent {
  id: string
  kind: 'PARITY_CLASS'
  axis: 0 | 1
  boundaryMM: number
  scale: Rational
}

const qPoint = ([x, y]: Pt): QPoint => [rationalFromNumber(x), rationalFromNumber(y)]

export const exactBandDomain = (
  band: Band,
  bands: readonly Band[] = BANDS,
): { lo: Rational; hiExclusive: Rational } => {
  const ordered = [...bands].sort((a, b) => a.minMM - b.minMM)
  const index = ordered.findIndex((candidate) => candidate.id === band.id)
  const next = index >= 0 ? ordered[index + 1] : undefined
  return { lo: rational(band.minMM), hiExclusive: rational(next?.minMM ?? band.maxMM + 1) }
}

export const scaleInBand = (scale: ExactReal, band: Band, bands: readonly Band[] = BANDS): boolean => {
  const domain = exactBandDomain(band, bands)
  return compareExact(scale, domain.lo) >= 0 && compareExact(scale, domain.hiExclusive) < 0
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
  const boundaries = [...new Set(bands.flatMap((band) => {
    const domain = exactBandDomain(band, bands)
    return [Number(domain.lo.numerator) / Number(domain.lo.denominator), Number(domain.hiExclusive.numerator) / Number(domain.hiExclusive.denominator)]
  }))].sort((a, b) => a - b)
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

type Quadratic = readonly [Rational, Rational, Rational]
type ContactRoot = Rational | AlgebraicReal

export interface AffinePoint { coefficient: QPoint; offset: QPoint }
export interface ContactScaleEvent {
  id: string
  scale: ContactRoot
  anchor: AffinePoint
  segmentId: string
  segmentA: QPoint
  segmentB: QPoint
  projection: 'a' | 'b' | 'interior'
  equation: readonly string[]
  projectionCertificate: readonly [-1 | 0 | 1, -1 | 0 | 1]
}

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
    divideRational(multiplyRational(coefficient, coefficient), lengthSquared),
    divideRational(twice(multiplyRational(coefficient, offset)), lengthSquared),
    divideRational(multiplyRational(offset, offset), lengthSquared),
  ]
}

const subtractRadiusSquared = (distance: Quadratic, radius: Rational): Quadratic => [
  distance[0], distance[1], subtractRational(distance[2], squareRational(radius)),
]

const roots = (equation: Quadratic, band: Band): ContactRoot[] => {
  const [a, b, c] = equation
  const domain = exactBandDomain(band)
  if (compareRational(a, rational(0)) === 0) {
    if (compareRational(b, rational(0)) === 0) return []
    const root = multiplyRational(rational(-1), divideRational(c, b))
    return scaleInBand(root, band) ? [root] : []
  }
  return quadraticRootsWithin(a, b, c, domain.lo, domain.hiExclusive, 8).filter((root) => scaleInBand(root, band))
}

const polynomialOf = (scale: ContactRoot): readonly string[] =>
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

const projectionCertificate = (anchor: AffinePoint, a: QPoint, b: QPoint, scale: ContactRoot) => {
  const segment = subtract(b, a)
  const coefficient = subtract(anchor.coefficient, a)
  const projectionA = dot(coefficient, segment)
  const projectionB = dot(anchor.offset, segment)
  return [
    signQuadraticAtExact(rational(0), projectionA, projectionB, scale),
    signQuadraticAtExact(rational(0), subtractRational(projectionA, dot(segment, segment)), projectionB, scale),
  ] as const
}

/** Exact segment-contact roots for every frozen affine Centre parity candidate in one band. */
export function enumerateAffineContactEvents(
  contour: Contour,
  targetCoefficient: ExactCentreCoefficient,
  band: Band,
  pitchMM: number,
  contactRadiusMM: Rational,
  branchScale: ContactRoot,
  targetOffset: QPoint = [rational(0), rational(0)],
): ContactScaleEvent[] {
  const radius = contactRadiusMM
  const events: ContactScaleEvent[] = []
  const rings = [contour.outer, ...contour.holes]
  for (const relation of relations(band)) for (const x of latticeOffsets(relation.xGap, pitchMM)) for (const y of latticeOffsets(relation.yGap, pitchMM)) {
    const anchor: AffinePoint = { coefficient: targetCoefficient, offset: [addRational(targetOffset[0], x), addRational(targetOffset[1], y)] }
    const branches: Array<{ projection: 'a' | 'b' | 'interior'; distance: Quadratic; segmentId: string; a: QPoint; b: QPoint }> = []
    rings.forEach((ring, ringIndex) => {
      for (let edge = 0, previous = ring.pts.length - 1; edge < ring.pts.length; previous = edge++) {
        const a = qPoint(ring.pts[previous]), b = qPoint(ring.pts[edge])
        const segmentId = `${ringIndex === 0 ? 'outer' : `hole:${ringIndex - 1}`}:segment:${edge}`
        const cases: ReadonlyArray<readonly ['a' | 'b' | 'interior', Quadratic]> = [
          ['a', endpointDistance(anchor, a)], ['b', endpointDistance(anchor, b)], ['interior', lineDistance(anchor, a, b)],
        ]
        for (const [projection, distance] of cases) branches.push({ projection, distance, segmentId, a, b })
      }
    })
    const validAt = (branch: typeof branches[number], scale: ContactRoot) => {
      const certificate = projectionCertificate(anchor, branch.a, branch.b, scale)
      return branch.projection === 'a' ? certificate[0] <= 0
        : branch.projection === 'b' ? certificate[1] >= 0
          : certificate[0] >= 0 && certificate[1] <= 0
    }
    const validBranches = branches.filter((branch) => validAt(branch, branchScale))
    let incumbent = validBranches[0]
    for (const candidate of validBranches.slice(1)) if (signQuadraticAtExact(
      subtractRational(candidate.distance[0], incumbent.distance[0]),
      subtractRational(candidate.distance[1], incumbent.distance[1]),
      subtractRational(candidate.distance[2], incumbent.distance[2]),
      branchScale,
    ) < 0) incumbent = candidate
    if (!incumbent) continue
    for (const scale of roots(subtractRadiusSquared(incumbent.distance, radius), band)) {
      if (!validAt(incumbent, scale)) continue
      const certificate = projectionCertificate(anchor, incumbent.a, incumbent.b, scale)
      const id = JSON.stringify([canonicalExact(scale), canonicalExact(x), canonicalExact(y), incumbent.segmentId, incumbent.projection])
      events.push({
        id, scale, anchor, segmentId: incumbent.segmentId, segmentA: incumbent.a, segmentB: incumbent.b,
        projection: incumbent.projection, equation: polynomialOf(scale), projectionCertificate: certificate,
      })
    }
    for (const challenger of branches) {
      if (challenger === incumbent) continue
      const equation: Quadratic = [
        subtractRational(incumbent.distance[0], challenger.distance[0]),
        subtractRational(incumbent.distance[1], challenger.distance[1]),
        subtractRational(incumbent.distance[2], challenger.distance[2]),
      ]
      for (const scale of roots(equation, band)) {
        if (!validAt(incumbent, scale) || !validAt(challenger, scale)) continue
        const certificate = projectionCertificate(anchor, challenger.a, challenger.b, scale)
        const id = JSON.stringify(['nearest', canonicalExact(scale), canonicalExact(x), canonicalExact(y), incumbent.segmentId, challenger.segmentId])
        events.push({
          id, scale, anchor, segmentId: challenger.segmentId, segmentA: challenger.a, segmentB: challenger.b,
          projection: challenger.projection, equation: polynomialOf(scale), projectionCertificate: certificate,
        })
      }
    }
  }
  events.sort((a, b) => compareExact(a.scale, b.scale) || a.id.localeCompare(b.id))
  return events.filter((event, index) => index === 0 || event.id !== events[index - 1].id)
}

/** Exact threshold roots for one supplied affine point; used by frozen-mesh sample transitions. */
export function enumerateAffinePointContactEvents(
  contour: Contour,
  anchor: AffinePoint,
  band: Band,
  contactRadiusMM: Rational,
  branchScale?: ContactRoot,
): ContactScaleEvent[] {
  const radius = contactRadiusMM, events: ContactScaleEvent[] = []
  const branches: Array<{ projection: 'a' | 'b' | 'interior'; distance: Quadratic; segmentId: string; a: QPoint; b: QPoint }> = []
  ;[contour.outer, ...contour.holes].forEach((ring, ringIndex) => {
    for (let edge = 0, previous = ring.pts.length - 1; edge < ring.pts.length; previous = edge++) {
      const a = qPoint(ring.pts[previous]), b = qPoint(ring.pts[edge])
      const segmentId = `${ringIndex === 0 ? 'outer' : `hole:${ringIndex - 1}`}:segment:${edge}`
      const cases: ReadonlyArray<readonly ['a' | 'b' | 'interior', Quadratic]> = [
        ['a', endpointDistance(anchor, a)], ['b', endpointDistance(anchor, b)], ['interior', lineDistance(anchor, a, b)],
      ]
      for (const [projection, distance] of cases) branches.push({ projection, distance, segmentId, a, b })
    }
  })
  const validAt = (branch: typeof branches[number], scale: ContactRoot) => {
    const certificate = projectionCertificate(anchor, branch.a, branch.b, scale)
    return branch.projection === 'a' ? certificate[0] <= 0 : branch.projection === 'b' ? certificate[1] >= 0
      : certificate[0] >= 0 && certificate[1] <= 0
  }
  if (branchScale) {
    const validBranches = branches.filter((branch) => validAt(branch, branchScale))
    let incumbent = validBranches[0]
    for (const candidate of validBranches.slice(1)) if (signQuadraticAtExact(
      subtractRational(candidate.distance[0], incumbent.distance[0]),
      subtractRational(candidate.distance[1], incumbent.distance[1]),
      subtractRational(candidate.distance[2], incumbent.distance[2]),
      branchScale,
    ) < 0) incumbent = candidate
    if (!incumbent) return []
    for (const scale of roots(subtractRadiusSquared(incumbent.distance, radius), band)) {
      if (!validAt(incumbent, scale)) continue
      const certificate = projectionCertificate(anchor, incumbent.a, incumbent.b, scale)
      const id = JSON.stringify(['point', canonicalExact(scale), canonicalExact(anchor.offset[0]), canonicalExact(anchor.offset[1]), incumbent.segmentId, incumbent.projection])
      events.push({
        id, scale, anchor, segmentId: incumbent.segmentId, segmentA: incumbent.a, segmentB: incumbent.b,
        projection: incumbent.projection, equation: polynomialOf(scale), projectionCertificate: certificate,
      })
    }
    if (compareRational(radius, rational(0)) !== 0) {
      events.sort((a, b) => compareExact(a.scale, b.scale) || a.id.localeCompare(b.id))
      return events.filter((event, index) => index === 0 || event.id !== events[index - 1].id)
    }
    for (const b of branches) {
      const a = incumbent
      if (a === b) continue
      const equation: Quadratic = [
        subtractRational(a.distance[0], b.distance[0]),
        subtractRational(a.distance[1], b.distance[1]),
        subtractRational(a.distance[2], b.distance[2]),
      ]
      for (const scale of roots(equation, band)) {
        if (!validAt(a, scale) || !validAt(b, scale)) continue
        const nearest = branches.every((other) => !validAt(other, scale) || signQuadraticAtExact(
          subtractRational(a.distance[0], other.distance[0]),
          subtractRational(a.distance[1], other.distance[1]),
          subtractRational(a.distance[2], other.distance[2]),
          scale,
        ) <= 0)
        if (!nearest) continue
        const certificate = projectionCertificate(anchor, a.a, a.b, scale)
        const id = JSON.stringify(['nearest-identity', canonicalExact(scale), canonicalExact(anchor.offset[0]), canonicalExact(anchor.offset[1]), a.segmentId, a.projection, b.segmentId, b.projection])
        events.push({ id, scale, anchor, segmentId: a.segmentId, segmentA: a.a, segmentB: a.b, projection: a.projection, equation: polynomialOf(scale), projectionCertificate: certificate })
      }
    }
  }
  events.sort((a, b) => compareExact(a.scale, b.scale) || a.id.localeCompare(b.id))
  return events.filter((event, index) => index === 0 || event.id !== events[index - 1].id)
}
