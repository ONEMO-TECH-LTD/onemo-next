// Exact, neutral centre measurements. Policy never enters this module.

import type { Contour, ExactCentreEvidence, ExactPoint, Rational } from '../spec'
import {
  addRational,
  approximateRational,
  compareRational,
  divideRational,
  multiplyRational,
  negateRational,
  rational,
  rationalFromNumber,
  subtractRational,
} from './exact-real'

interface RingMoment {
  doubleArea: Rational
  xMoment: Rational
  yMoment: Rational
}

const zero = () => rational(BigInt(0))

function ringMoment(points: Contour['outer']['pts']): RingMoment {
  let doubleArea = zero(), xMoment = zero(), yMoment = zero()
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    const following = points[(index + 1) % points.length]
    const x = rationalFromNumber(point[0]), y = rationalFromNumber(point[1])
    const nextX = rationalFromNumber(following[0]), nextY = rationalFromNumber(following[1])
    const cross = subtractRational(multiplyRational(x, nextY), multiplyRational(nextX, y))
    doubleArea = addRational(doubleArea, cross)
    xMoment = addRational(xMoment, multiplyRational(addRational(x, nextX), cross))
    yMoment = addRational(yMoment, multiplyRational(addRational(y, nextY), cross))
  }
  return { doubleArea, xMoment, yMoment }
}

function materialMoment(moment: RingMoment, addsMaterial: boolean): RingMoment {
  const positive = compareRational(moment.doubleArea, zero()) > 0
  if (positive === addsMaterial) return moment
  return {
    doubleArea: negateRational(moment.doubleArea),
    xMoment: negateRational(moment.xMoment),
    yMoment: negateRational(moment.yMoment),
  }
}

export function exactMaterialCentroid(contour: Contour): ExactPoint | null {
  if (contour.outer.pts.length < 3) return null
  const outer = materialMoment(ringMoment(contour.outer.pts), true)
  let doubleArea = outer.doubleArea
  let xMoment = outer.xMoment
  let yMoment = outer.yMoment
  for (const hole of contour.holes) {
    if (hole.pts.length < 3) continue
    const contribution = materialMoment(ringMoment(hole.pts), false)
    doubleArea = addRational(doubleArea, contribution.doubleArea)
    xMoment = addRational(xMoment, contribution.xMoment)
    yMoment = addRational(yMoment, contribution.yMoment)
  }
  if (compareRational(doubleArea, zero()) === 0) return null
  const divisor = multiplyRational(rational(BigInt(3)), doubleArea)
  const x = divideRational(xMoment, divisor)
  const y = divideRational(yMoment, divisor)
  return { x, y, approximateMM: [approximateRational(x), approximateRational(y)] }
}

export function exactBoxCentre(contour: Contour): ExactPoint | null {
  const points = contour.outer.pts
  if (!points.length) return null
  let minX = rationalFromNumber(points[0][0]), maxX = minX
  let minY = rationalFromNumber(points[0][1]), maxY = minY
  for (const point of points.slice(1)) {
    const x = rationalFromNumber(point[0]), y = rationalFromNumber(point[1])
    if (compareRational(x, minX) < 0) minX = x
    if (compareRational(x, maxX) > 0) maxX = x
    if (compareRational(y, minY) < 0) minY = y
    if (compareRational(y, maxY) > 0) maxY = y
  }
  const two = rational(BigInt(2))
  const x = divideRational(addRational(minX, maxX), two)
  const y = divideRational(addRational(minY, maxY), two)
  return { x, y, approximateMM: [approximateRational(x), approximateRational(y)] }
}

export type ExactCentreMeasurement =
  | { status: 'measured'; evidence: ExactCentreEvidence }
  | { status: 'refused'; code: 'CENTRE_MATERIAL_INVALID' | 'CENTRE_EVIDENCE_UNRESOLVED' }
