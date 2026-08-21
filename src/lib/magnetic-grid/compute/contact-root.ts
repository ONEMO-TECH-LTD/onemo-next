import type { ContactWitness, Pt, Rational, WrapMeasurement } from '../spec'
import {
  addRational,
  approximateExact,
  canonicalExact,
  compareRational,
  divideRational,
  multiplyRational,
  rational,
  rationalFromNumber,
  sqrtMinusRational,
  squareRational,
  subtractRational,
} from './exact-real'

type ExactPoint = readonly [Rational, Rational]

const exactPoint = ([x, y]: Pt): ExactPoint => [rationalFromNumber(x), rationalFromNumber(y)]
const dot = (a: ExactPoint, b: ExactPoint): Rational =>
  addRational(multiplyRational(a[0], b[0]), multiplyRational(a[1], b[1]))
const minus = (a: ExactPoint, b: ExactPoint): ExactPoint => [subtractRational(a[0], b[0]), subtractRational(a[1], b[1])]
const plus = (a: ExactPoint, b: ExactPoint): ExactPoint => [addRational(a[0], b[0]), addRational(a[1], b[1])]
const times = (point: ExactPoint, scalar: Rational): ExactPoint => [multiplyRational(point[0], scalar), multiplyRational(point[1], scalar)]
const squaredLength = (point: ExactPoint): Rational => addRational(squareRational(point[0]), squareRational(point[1]))

function pointToSegment(point: Pt, a: Pt, b: Pt): { squaredDistance: Rational; tangency: ExactPoint } {
  const p = exactPoint(point), start = exactPoint(a), end = exactPoint(b)
  const segment = minus(end, start), relative = minus(p, start)
  const projection = dot(relative, segment), lengthSquared = squaredLength(segment)
  if (compareRational(lengthSquared, rational(0)) === 0 || compareRational(projection, rational(0)) <= 0) {
    return { squaredDistance: squaredLength(relative), tangency: start }
  }
  if (compareRational(projection, lengthSquared) >= 0) {
    return { squaredDistance: squaredLength(minus(p, end)), tangency: end }
  }
  const t = divideRational(projection, lengthSquared)
  const tangency = plus(start, times(segment, t))
  return { squaredDistance: squaredLength(minus(p, tangency)), tangency }
}

function witnessForAnchor(
  outer: ReadonlyArray<Pt>, anchor: Pt, spotRadius: Rational,
): ContactWitness {
  let best: ReturnType<typeof pointToSegment> | null = null
  let bestIndex = -1
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const measured = pointToSegment(anchor, outer[j], outer[i])
    if (!best || compareRational(measured.squaredDistance, best.squaredDistance) < 0) {
      best = measured
      bestIndex = i
    }
  }
  if (!best) throw new RangeError('Wrap needs a supplied segment contour')
  const requiredFlap = sqrtMinusRational(best.squaredDistance, spotRadius)
  const approximateMM: Pt = [approximateExact(best.tangency[0]), approximateExact(best.tangency[1])]
  return {
    anchor,
    outlineSegmentIndex: bestIndex,
    squaredDistance: best.squaredDistance,
    tangency: { x: best.tangency[0], y: best.tangency[1], approximateMM },
    requiredFlap,
    certificateId: canonicalExact(best.squaredDistance) + '@' + bestIndex,
  }
}

/** Exact required allowance and one non-tolerance segment witness for every belt anchor. */
export function measureWrap(
  outer: ReadonlyArray<Pt>, belt: ReadonlyArray<Pt>, spotRadiusMM: number,
): WrapMeasurement {
  const spotRadius = rationalFromNumber(spotRadiusMM)
  const radiusSquared = squareRational(spotRadius)
  const witnesses = belt.map((anchor) => witnessForAnchor(outer, anchor, spotRadius))
  let binding = witnesses[0]
  let seatLegal = true
  for (const witness of witnesses) {
    if (!binding || compareRational(witness.squaredDistance, binding.squaredDistance) > 0) binding = witness
    if (compareRational(witness.squaredDistance, radiusSquared) < 0) seatLegal = false
  }
  const requiredFlap = binding?.requiredFlap ?? rational(0)
  return { requiredFlap, requiredFlapApproxMM: approximateExact(requiredFlap), witnesses, seatLegal }
}
