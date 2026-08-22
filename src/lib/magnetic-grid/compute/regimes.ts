import type { Band, Contour, ExactReal, Pt, Rational } from '../spec'
import { BANDS, FIELD_POSITIONS_PER_AXIS } from '../spec'
import {
  canonicalExact,
  compareExact,
  compareRational,
  divideRational,
  rational,
  rationalFromNumber,
  subtractRational,
} from './exact-real'

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
