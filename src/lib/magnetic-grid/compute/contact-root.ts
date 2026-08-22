import type {
  BoundaryElement,
  BoundaryTruth,
  ContactWitness,
  Contour,
  ExactReal,
  ExactScale,
  PreparedContour,
  Pt,
  Rational,
  WrapMeasurement,
} from '../spec'
import {
  addRational,
  affineExact,
  allowancePolynomial,
  approximateExact,
  canonicalExact,
  compareRational,
  divideRational,
  multiplyRational,
  rational,
  rationalFromNumber,
  sqrtMinusRational,
  signQuadraticAtExact,
  squareRational,
  subtractRational,
} from './exact-real'
import { certifyContactWitness, certifySqrtQuadraticExpression, sha256Text } from './identity'
import { exactSeatIsLegal, type ExactAffineNode } from './seat'

type ExactPoint = readonly [Rational, Rational]
type UncertifiedWrapMeasurement = Omit<WrapMeasurement, 'witnesses'> & {
  witnesses: Array<Omit<ContactWitness, 'certificateId'>>
}

const exactPoint = ([x, y]: Pt): ExactPoint => [
  rationalFromNumber(x),
  rationalFromNumber(y),
]
const dot = (a: ExactPoint, b: ExactPoint) =>
  addRational(multiplyRational(a[0], b[0]), multiplyRational(a[1], b[1]))
const minus = (a: ExactPoint, b: ExactPoint): ExactPoint => [
  subtractRational(a[0], b[0]),
  subtractRational(a[1], b[1]),
]
const plus = (a: ExactPoint, b: ExactPoint): ExactPoint => [
  addRational(a[0], b[0]),
  addRational(a[1], b[1]),
]
const times = (p: ExactPoint, s: Rational): ExactPoint => [
  multiplyRational(p[0], s),
  multiplyRational(p[1], s),
]
const squaredLength = (p: ExactPoint) =>
  addRational(squareRational(p[0]), squareRational(p[1]))
const pointToElement = (point: ExactPoint, element: BoundaryElement) => {
  const segment = minus(element.b, element.a),
    relative = minus(point, element.a)
  const projection = dot(relative, segment),
    lengthSquared = squaredLength(segment)
  let tangency: ExactPoint
  if (
    compareRational(lengthSquared, rational(0)) === 0 ||
    compareRational(projection, rational(0)) <= 0
  )
    tangency = element.a
  else if (compareRational(projection, lengthSquared) >= 0) tangency = element.b
  else
    tangency = plus(
      element.a,
      times(segment, divideRational(projection, lengthSquared)),
    )
  return { squaredDistance: squaredLength(minus(point, tangency)), tangency }
}

const exactScale = (contour: Contour): ExactScale => {
  const points = contour.outer.pts.map(exactPoint)
  if (!points.length) return { exact: rational(0), approximateMM: 0 }
  let minX = points[0][0],
    maxX = points[0][0],
    minY = points[0][1],
    maxY = points[0][1]
  for (const [x, y] of points) {
    if (compareRational(x, minX) < 0) minX = x
    if (compareRational(x, maxX) > 0) maxX = x
    if (compareRational(y, minY) < 0) minY = y
    if (compareRational(y, maxY) > 0) maxY = y
  }
  const width = subtractRational(maxX, minX),
    height = subtractRational(maxY, minY)
  const exact = compareRational(width, height) >= 0 ? width : height
  return { exact, approximateMM: approximateExact(exact) }
}

export function prepareContour(
  contour: Contour,
  truth: PreparedContour['truth'],
): PreparedContour {
  const elements: BoundaryElement[] = []
  type RingId = 'outer' | `hole:${number}`
  const rings: Array<readonly [RingId, ReadonlyArray<Pt>]> = [
    ['outer', contour.outer.pts],
    ...contour.holes.map(
      (hole, index) => [`hole:${index}` as const, hole.pts] as const,
    ),
  ]
  for (const [ringId, points] of rings) {
    for (let i = 0, j = points.length - 1; i < points.length; j = i++)
      elements.push({
        kind: 'segment',
        id: `${ringId}:segment:${i}`,
        a: exactPoint(points[j]),
        b: exactPoint(points[i]),
      })
  }
  return {
    source: contour,
    boundary: elements,
    truth,
    identity: truth.contourIdentity,
  }
}

export function measureWrap(
  prepared: PreparedContour,
  belt: ReadonlyArray<Pt>,
  spotRadiusMM: number,
): UncertifiedWrapMeasurement {
  const contour = prepared.source,
    scale = exactScale(contour),
    radius = rationalFromNumber(spotRadiusMM)
  if (contour.outer.pts.length < 3 || prepared.boundary.length === 0)
    return {
      scale,
      boundaryTruth: prepared.truth,
      requiredFlap: rational(0),
      requiredFlapApproxMM: 0,
      witnesses: [] as Array<Omit<ContactWitness, 'certificateId'>>,
      refusal: {
        code: 'NO_WRAPPED_LAYOUT_IN_BAND' as const,
        reason: 'invalid-boundary' as const,
      },
    }
  if (belt.length === 0)
    return {
      scale,
      boundaryTruth: prepared.truth,
      requiredFlap: rational(0),
      requiredFlapApproxMM: 0,
      witnesses: [] as Array<Omit<ContactWitness, 'certificateId'>>,
      refusal: {
        code: 'NO_WRAPPED_LAYOUT_IN_BAND' as const,
        reason: 'empty-belt' as const,
      },
    }
  let bindingDistance: Rational | undefined,
    bindingAllowance: ExactReal = rational(0)
  const witnesses: Array<Omit<ContactWitness, 'certificateId'>> = []
  let validSeat = true
  belt.forEach((anchor) => {
    const point = exactPoint(anchor),
      measured = prepared.boundary.map((element) => ({
        element,
        ...pointToElement(point, element),
      }))
    let nearest = measured[0].squaredDistance
    for (const item of measured)
      if (compareRational(item.squaredDistance, nearest) < 0)
        nearest = item.squaredDistance
    const allowance = sqrtMinusRational(nearest, radius),
      anchorId = `belt:${JSON.stringify(point)}`
    if (!exactSeatIsLegal(contour, anchor, nearest, squareRational(radius)))
      validSeat = false
    for (const item of measured.filter(
      (candidate) => compareRational(candidate.squaredDistance, nearest) === 0,
    )) {
      const equation = {
        kind: 'polynomial' as const,
        polynomial: allowancePolynomial(nearest, radius),
        rootIndex: 1,
      }
      const tangency = { x: item.tangency[0], y: item.tangency[1] }
      const core = {
        scale,
        boundaryTruth: prepared.truth,
        beltAnchorId: anchorId,
        outlineElementId: item.element.id,
        outlineElementKind: 'segment' as const,
        allowance,
        equation,
        tangency,
        regimeId: 'fixed-size',
      }
      witnesses.push(core)
    }
    if (!bindingDistance || compareRational(nearest, bindingDistance) > 0) {
      bindingDistance = nearest
      bindingAllowance = allowance
    }
  })
  return {
    scale,
    boundaryTruth: prepared.truth,
    requiredFlap: bindingAllowance,
    requiredFlapApproxMM: approximateExact(bindingAllowance),
    witnesses,
    refusal: validSeat
      ? null
      : { code: 'NO_WRAPPED_LAYOUT_IN_BAND', reason: 'invalid-seat' },
  }
}

type DistanceBranch = {
  squared: readonly [Rational, Rational, Rational]
  tangencyCoefficient: ExactPoint
  tangencyOffset: ExactPoint
  elementId: string
}

const exactAffineDistance = (
  anchor: ExactAffineNode,
  a: ExactPoint,
  b: ExactPoint,
  elementId: string,
  scale: ExactReal,
): DistanceBranch => {
  const segment = minus(b, a)
  const relativeCoefficient = minus(anchor.coefficient, a)
  const projectionA = dot(relativeCoefficient, segment), projectionB = dot(anchor.offset, segment)
  const lengthSquared = squaredLength(segment)
  const start = signQuadraticAtExact(rational(0), projectionA, projectionB, scale)
  const end = signQuadraticAtExact(rational(0), subtractRational(projectionA, lengthSquared), projectionB, scale)
  if (start <= 0 || compareRational(lengthSquared, rational(0)) === 0) {
    return {
      squared: [squaredLength(relativeCoefficient), multiplyRational(rational(2), dot(relativeCoefficient, anchor.offset)), squaredLength(anchor.offset)],
      tangencyCoefficient: a, tangencyOffset: [rational(0), rational(0)], elementId,
    }
  }
  if (end >= 0) {
    const coefficient = minus(anchor.coefficient, b)
    return {
      squared: [squaredLength(coefficient), multiplyRational(rational(2), dot(coefficient, anchor.offset)), squaredLength(anchor.offset)],
      tangencyCoefficient: b, tangencyOffset: [rational(0), rational(0)], elementId,
    }
  }
  const ratioA = divideRational(projectionA, lengthSquared), ratioB = divideRational(projectionB, lengthSquared)
  const tangencyCoefficient = plus(a, times(segment, ratioA)), tangencyOffset = times(segment, ratioB)
  const normalA = subtractRational(multiplyRational(relativeCoefficient[0], segment[1]), multiplyRational(relativeCoefficient[1], segment[0]))
  const normalB = subtractRational(multiplyRational(anchor.offset[0], segment[1]), multiplyRational(anchor.offset[1], segment[0]))
  return {
    squared: [
      divideRational(multiplyRational(normalA, normalA), lengthSquared),
      divideRational(multiplyRational(rational(2), multiplyRational(normalA, normalB)), lengthSquared),
      divideRational(multiplyRational(normalB, normalB), lengthSquared),
    ],
    tangencyCoefficient, tangencyOffset, elementId,
  }
}

const compareDistanceBranches = (left: DistanceBranch, right: DistanceBranch, scale: ExactReal) =>
  signQuadraticAtExact(
    subtractRational(left.squared[0], right.squared[0]),
    subtractRational(left.squared[1], right.squared[1]),
    subtractRational(left.squared[2], right.squared[2]),
    scale,
  )

/** Exact-scale Wrap adapter over affine anchors and the complete supplied boundary. */
export function measureExactScaleWrap(
  contour: Contour,
  truth: BoundaryTruth,
  belt: readonly ExactAffineNode[],
  scale: ExactReal,
  spotRadius: Rational,
  regimeId: string,
): WrapMeasurement {
  const exactScaleValue: ExactScale = { exact: scale, approximateMM: approximateExact(scale) }
  if (contour.outer.pts.length < 3) return {
    scale: exactScaleValue, boundaryTruth: truth, requiredFlap: rational(0), requiredFlapApproxMM: 0,
    witnesses: [], refusal: { code: 'NO_WRAPPED_LAYOUT_IN_BAND', reason: 'invalid-boundary' },
  }
  if (!belt.length) return {
    scale: exactScaleValue, boundaryTruth: truth, requiredFlap: rational(0), requiredFlapApproxMM: 0,
    witnesses: [], refusal: { code: 'NO_WRAPPED_LAYOUT_IN_BAND', reason: 'empty-belt' },
  }
  const rings = [contour.outer, ...contour.holes]
  const perAnchor: Array<{ anchor: ExactAffineNode; worst: DistanceBranch; binders: DistanceBranch[] }> = []
  for (const anchor of belt) {
    const distances: DistanceBranch[] = []
    rings.forEach((ring, ringIndex) => {
      for (let index = 0, previous = ring.pts.length - 1; index < ring.pts.length; previous = index++) {
        const ringId = ringIndex === 0 ? 'outer' : `hole:${ringIndex - 1}`
        distances.push(exactAffineDistance(anchor, exactPoint(ring.pts[previous]), exactPoint(ring.pts[index]), `${ringId}:segment:${index}`, scale))
      }
    })
    let nearest = distances[0]
    for (const distance of distances.slice(1)) if (compareDistanceBranches(distance, nearest, scale) < 0) nearest = distance
    perAnchor.push({ anchor, worst: nearest, binders: distances.filter((distance) => compareDistanceBranches(distance, nearest, scale) === 0) })
  }
  let worstAnchor = perAnchor[0]
  for (const candidate of perAnchor.slice(1)) if (compareDistanceBranches(candidate.worst, worstAnchor.worst, scale) > 0) worstAnchor = candidate
  const requiredFlap = certifySqrtQuadraticExpression(scale, worstAnchor.worst.squared, spotRadius)
  const witnesses = perAnchor.flatMap(({ anchor, worst, binders }) => {
    if (compareDistanceBranches(worst, worstAnchor.worst, scale) !== 0) return []
    const beltAnchorId = sha256Text(JSON.stringify(['belt-anchor-v1', canonicalExact(anchor.point.x), canonicalExact(anchor.point.y)]))
    return binders.map((binder) => certifyContactWitness({
      scale: exactScaleValue,
      boundaryTruth: truth,
      beltAnchorId,
      outlineElementId: binder.elementId,
      outlineElementKind: 'segment',
      allowance: requiredFlap,
      equation: { kind: 'polynomial', polynomial: binder.squared.map((value) => value.numerator), rootIndex: 1 },
      tangency: {
        x: affineExact(scale, binder.tangencyCoefficient[0], binder.tangencyOffset[0]),
        y: affineExact(scale, binder.tangencyCoefficient[1], binder.tangencyOffset[1]),
      },
      regimeId,
    }))
  })
  return {
    scale: exactScaleValue,
    boundaryTruth: truth,
    requiredFlap,
    requiredFlapApproxMM: approximateExact(requiredFlap),
    witnesses,
    refusal: null,
  }
}
