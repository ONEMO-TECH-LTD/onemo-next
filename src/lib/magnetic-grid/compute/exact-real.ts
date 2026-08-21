import type { AlgebraicReal, ExactReal, Rational } from '../spec'

type Q = { n: bigint; d: bigint }

const abs = (value: bigint) => (value < BigInt(0) ? -value : value)

const gcd = (a: bigint, b: bigint): bigint => {
  let x = abs(a),
    y = abs(b)
  while (y !== BigInt(0)) {
    const next = x % y
    x = y
    y = next
  }
  return x || BigInt(1)
}

const q = (n: bigint, d = BigInt(1)): Q => {
  if (d === BigInt(0)) throw new RangeError('zero denominator')
  const sign = d < BigInt(0) ? -BigInt(1) : BigInt(1)
  const divisor = gcd(n, d)
  return { n: (sign * n) / divisor, d: (sign * d) / divisor }
}

const fromPublic = (value: Rational): Q =>
  q(BigInt(value.numerator), BigInt(value.denominator))
const toPublic = (value: Q): Rational => ({
  numerator: value.n.toString(),
  denominator: value.d.toString(),
})

export const rational = (
  numerator: bigint | number | string,
  denominator: bigint | number | string = 1,
): Rational => toPublic(q(BigInt(numerator), BigInt(denominator)))

/** Exact IEEE-754 binary rational; no decimal or policy rounding. */
export function rationalFromNumber(value: number): Rational {
  if (!Number.isFinite(value))
    throw new RangeError('exact value must be finite')
  if (Object.is(value, -0) || value === 0) return rational(0)
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value, false)
  const bits = view.getBigUint64(0, false)
  const sign = bits >> BigInt(63) === BigInt(0) ? BigInt(1) : -BigInt(1)
  const exponentBits = Number((bits >> BigInt(52)) & BigInt(0x7ff))
  const fraction = bits & ((BigInt(1) << BigInt(52)) - BigInt(1))
  const mantissa =
    exponentBits === 0 ? fraction : (BigInt(1) << BigInt(52)) + fraction
  const exponent = (exponentBits === 0 ? 1 - 1023 : exponentBits - 1023) - 52
  return exponent >= 0
    ? rational(sign * (mantissa << BigInt(exponent)))
    : rational(sign * mantissa, BigInt(1) << BigInt(-exponent))
}

export const addRational = (a: Rational, b: Rational): Rational => {
  const x = fromPublic(a),
    y = fromPublic(b)
  return toPublic(q(x.n * y.d + y.n * x.d, x.d * y.d))
}

export const subtractRational = (a: Rational, b: Rational): Rational => {
  const x = fromPublic(a),
    y = fromPublic(b)
  return toPublic(q(x.n * y.d - y.n * x.d, x.d * y.d))
}

export const multiplyRational = (a: Rational, b: Rational): Rational => {
  const x = fromPublic(a),
    y = fromPublic(b)
  return toPublic(q(x.n * y.n, x.d * y.d))
}

export const divideRational = (a: Rational, b: Rational): Rational => {
  const x = fromPublic(a),
    y = fromPublic(b)
  return toPublic(q(x.n * y.d, x.d * y.n))
}

export const squareRational = (value: Rational): Rational =>
  multiplyRational(value, value)

export const compareRational = (a: Rational, b: Rational): -1 | 0 | 1 => {
  const x = fromPublic(a),
    y = fromPublic(b)
  const delta = x.n * y.d - y.n * x.d
  return delta < BigInt(0) ? -1 : delta > BigInt(0) ? 1 : 0
}

const integerSqrt = (value: bigint): bigint => {
  if (value < BigInt(0)) throw new RangeError('square root of negative value')
  if (value < BigInt(2)) return value
  let x = BigInt(1) << BigInt((value.toString(2).length + 1) >> 1)
  for (;;) {
    const next = (x + value / x) >> BigInt(1)
    if (next >= x) return x
    x = next
  }
}

const exactSquareRoot = (value: Rational): Rational | null => {
  const x = fromPublic(value)
  if (x.n < BigInt(0)) return null
  const sn = integerSqrt(x.n),
    sd = integerSqrt(x.d)
  return sn * sn === x.n && sd * sd === x.d ? rational(sn, sd) : null
}

const primitivePolynomial = (coefficients: bigint[]): string[] => {
  let divisor = BigInt(0)
  for (const coefficient of coefficients) divisor = gcd(divisor, coefficient)
  const normalized = coefficients.map((coefficient) => coefficient / divisor)
  if (normalized[0] < BigInt(0))
    return normalized.map((coefficient) => (-coefficient).toString())
  return normalized.map((coefficient) => coefficient.toString())
}

export function allowancePolynomial(
  squaredDistance: Rational,
  radius: Rational,
): string[] {
  const distance = fromPublic(squaredDistance)
  const r = fromPublic(radius)
  return primitivePolynomial([
    distance.d * r.d * r.d,
    BigInt(2) * distance.d * r.n * r.d,
    distance.d * r.n * r.n - distance.n * r.d * r.d,
  ])
}

/** Exact `sqrt(squaredDistance) - radius`; irrational results carry a certified dyadic isolating interval. */
export function sqrtMinusRational(
  squaredDistance: Rational,
  radius: Rational,
): ExactReal {
  const exactRoot = exactSquareRoot(squaredDistance)
  if (exactRoot) return subtractRational(exactRoot, radius)
  const distance = fromPublic(squaredDistance)
  if (distance.n < BigInt(0)) throw new RangeError('negative squared distance')
  const bits = 128
  const scale = BigInt(1) << BigInt(bits)
  const scaledFloor = (distance.n << BigInt(bits * 2)) / distance.d
  const lowerRoot = rational(integerSqrt(scaledFloor), scale)
  const upperRoot = addRational(lowerRoot, rational(1, scale))
  return {
    polynomial: allowancePolynomial(squaredDistance, radius),
    isolating: [
      subtractRational(lowerRoot, radius),
      subtractRational(upperRoot, radius),
    ],
    rootIndex: 1,
  }
}

export const isRational = (value: ExactReal): value is Rational => 'numerator' in value

const evaluatePolynomial = (
  polynomial: readonly string[],
  at: Rational,
): Rational => {
  let value = rational(0)
  for (const coefficient of polynomial)
    value = addRational(multiplyRational(value, at), rational(coefficient))
  return value
}

const compareAlgebraicToRational = (
  algebraic: AlgebraicReal,
  value: Rational,
): -1 | 0 | 1 => {
  if (
    algebraic.polynomial.length !== 3 ||
    BigInt(algebraic.polynomial[0]) <= BigInt(0) ||
    (algebraic.rootIndex !== 0 && algebraic.rootIndex !== 1) ||
    compareRational(algebraic.isolating[0], algebraic.isolating[1]) >= 0
  ) {
    throw new RangeError('unsupported algebraic comparison')
  }
  const [lo, hi] = algebraic.isolating
  const loSign = compareRational(evaluatePolynomial(algebraic.polynomial, lo), rational(0))
  const hiSign = compareRational(evaluatePolynomial(algebraic.polynomial, hi), rational(0))
  const bracketed = algebraic.rootIndex === 0
    ? loSign >= 0 && hiSign <= 0
    : loSign <= 0 && hiSign >= 0
  if (!bracketed) throw new RangeError('unsupported algebraic comparison')
  if (compareRational(hi, value) <= 0) return -1
  if (compareRational(lo, value) >= 0) return 1
  const sign = compareRational(
    evaluatePolynomial(algebraic.polynomial, value),
    rational(0),
  )
  if (sign === 0) return 0
  return algebraic.rootIndex === 0
    ? (sign > 0 ? 1 : -1)
    : (sign < 0 ? 1 : -1)
}

/** Total for the only comparison Wrap admits: a segment-distance root against a rational dial/cap. */
export function compareExactToRational(
  value: ExactReal,
  limit: Rational,
): -1 | 0 | 1 {
  return isRational(value)
    ? compareRational(value, limit)
    : compareAlgebraicToRational(value, limit)
}

const lcmDenominatorPolynomial = (a: Rational, b: Rational, c: Rational): bigint[] => {
  const qa = fromPublic(a), qb = fromPublic(b), qc = fromPublic(c)
  return [
    qa.n * qb.d * qc.d,
    qb.n * qa.d * qc.d,
    qc.n * qa.d * qb.d,
  ]
}

const primitiveQuadratic = (coefficients: bigint[]): bigint[] => {
  let divisor = BigInt(0)
  for (const coefficient of coefficients) divisor = gcd(divisor, coefficient)
  const normalized = coefficients.map((coefficient) => coefficient / divisor)
  return normalized[0] < BigInt(0)
    ? normalized.map((coefficient) => -coefficient)
    : normalized
}

const evaluateIntegerQuadratic = (polynomial: readonly bigint[], at: Rational): Rational =>
  addRational(
    multiplyRational(
      addRational(multiplyRational(rational(polynomial[0]), at), rational(polynomial[1])),
      at,
    ),
    rational(polynomial[2]),
  )

const midpoint = (a: Rational, b: Rational): Rational =>
  divideRational(addRational(a, b), rational(2))

const isolateQuadraticRoot = (
  polynomial: readonly bigint[],
  rootIndex: 0 | 1,
  lo: Rational,
  hi: Rational,
): Rational | AlgebraicReal | null => {
  let left = lo, right = hi
  let leftSign = compareRational(evaluateIntegerQuadratic(polynomial, left), rational(0))
  let rightSign = compareRational(evaluateIntegerQuadratic(polynomial, right), rational(0))
  if (leftSign === 0) return left
  if (rightSign === 0) return right
  if (leftSign === rightSign) return null
  for (let iteration = 0; iteration < 192; iteration++) {
    const middle = midpoint(left, right)
    const middleSign = compareRational(evaluateIntegerQuadratic(polynomial, middle), rational(0))
    if (middleSign === 0) return middle
    if (middleSign === leftSign) {
      left = middle
      leftSign = middleSign
    } else {
      right = middle
      rightSign = middleSign
    }
  }
  void rightSign
  return {
    polynomial: polynomial.map(String),
    isolating: [left, right],
    rootIndex,
  }
}

/** Every exact real root of `a·s²+b·s+c=0` inside the closed rational interval. */
export function quadraticRootsWithin(
  a: Rational,
  b: Rational,
  c: Rational,
  lo: Rational,
  hi: Rational,
): ExactReal[] {
  const polynomial = primitiveQuadratic(lcmDenominatorPolynomial(a, b, c))
  if (polynomial[0] === BigInt(0)) throw new RangeError('quadratic coefficient must be nonzero')
  const discriminant = polynomial[1] * polynomial[1] - BigInt(4) * polynomial[0] * polynomial[2]
  if (discriminant < BigInt(0)) return []
  const vertex = rational(-polynomial[1], BigInt(2) * polynomial[0])
  const roots: ExactReal[] = []
  const leftHi = compareRational(vertex, hi) < 0 ? vertex : hi
  if (compareRational(lo, leftHi) <= 0) {
    const root = isolateQuadraticRoot(polynomial, 0, lo, leftHi)
    if (root) roots.push(root)
  }
  const rightLo = compareRational(vertex, lo) > 0 ? vertex : lo
  if (compareRational(rightLo, hi) <= 0) {
    const root = isolateQuadraticRoot(polynomial, 1, rightLo, hi)
    if (root && !roots.some((candidate) => canonicalExact(candidate) === canonicalExact(root))) roots.push(root)
  }
  return roots
}

export const approximateExact = (value: ExactReal): number => {
  if (isRational(value))
    return Number(value.numerator) / Number(value.denominator)
  const [lo, hi] = value.isolating
  return (approximateExact(lo) + approximateExact(hi)) / 2
}

export const canonicalExact = (value: ExactReal): string =>
  JSON.stringify(value)
