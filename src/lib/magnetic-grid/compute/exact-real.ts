import type { ExactPoint, ExactReal, PointMM, Rational } from '../spec'

const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)

function abs(value: bigint): bigint { return value < ZERO ? -value : value }

function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a), y = abs(b)
  while (y !== ZERO) { const remainder = x % y; x = y; y = remainder }
  return x || ONE
}

export function rational(numerator: bigint, denominator = ONE): Rational {
  if (denominator === ZERO) throw new RangeError('zero denominator')
  const sign = denominator < ZERO ? -ONE : ONE
  const common = gcd(numerator, denominator)
  return { numerator: ((numerator / common) * sign).toString(), denominator: ((denominator / common) * sign).toString() }
}

const parts = (value: Rational): readonly [bigint, bigint] => [BigInt(value.numerator), BigInt(value.denominator)]

export function rationalFromNumber(value: number): Rational {
  if (!Number.isFinite(value)) throw new RangeError('exact value must be finite')
  if (Object.is(value, 0) || Object.is(value, -0)) return rational(ZERO)
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  view.setFloat64(0, value, false)
  const high = view.getUint32(0, false), low = view.getUint32(4, false)
  const negative = (high >>> 31) === 1
  const exponentBits = (high >>> 20) & 0x7ff
  const fraction = (BigInt(high & 0xfffff) << BigInt(32)) | BigInt(low)
  const mantissa = exponentBits === 0 ? fraction : (ONE << BigInt(52)) + fraction
  const exponent = (exponentBits === 0 ? 1 - 1023 : exponentBits - 1023) - 52
  const signed = negative ? -mantissa : mantissa
  return exponent >= 0 ? rational(signed * (TWO ** BigInt(exponent))) : rational(signed, TWO ** BigInt(-exponent))
}

export function compareRational(a: Rational, b: Rational): -1 | 0 | 1 {
  const [an, ad] = parts(a), [bn, bd] = parts(b)
  const delta = an * bd - bn * ad
  return delta < ZERO ? -1 : delta > ZERO ? 1 : 0
}

export function compareExact(a: ExactReal, b: ExactReal): -1 | 0 | 1 {
  if ('numerator' in a && 'numerator' in b) return compareRational(a, b)
  if ('polynomial' in a && 'polynomial' in b && a.rootIndex === b.rootIndex
    && a.polynomial.join(',') === b.polynomial.join(',')) return 0
  const aBounds = 'numerator' in a ? [a, a] as const : a.isolating
  const bBounds = 'numerator' in b ? [b, b] as const : b.isolating
  if (compareRational(aBounds[1], bBounds[0]) < 0) return -1
  if (compareRational(aBounds[0], bBounds[1]) > 0) return 1
  throw new Error('UNRESOLVED_EXACT_COMPARISON')
}

export function addRational(a: Rational, b: Rational): Rational {
  const [an, ad] = parts(a), [bn, bd] = parts(b)
  return rational(an * bd + bn * ad, ad * bd)
}

export function subtractRational(a: Rational, b: Rational): Rational {
  const [an, ad] = parts(a), [bn, bd] = parts(b)
  return rational(an * bd - bn * ad, ad * bd)
}

export function multiplyRational(a: Rational, b: Rational): Rational {
  const [an, ad] = parts(a), [bn, bd] = parts(b)
  return rational(an * bn, ad * bd)
}

export function divideRational(a: Rational, b: Rational): Rational {
  const [an, ad] = parts(a), [bn, bd] = parts(b)
  return rational(an * bd, ad * bn)
}

export function approximateRational(value: Rational): number {
  const [numerator, denominator] = parts(value)
  return Number(numerator) / Number(denominator)
}

export function exactPoint(point: PointMM): ExactPoint {
  return { x: rationalFromNumber(point[0]), y: rationalFromNumber(point[1]), approximateMM: point }
}

export function negateRational(value: Rational): Rational {
  const [numerator, denominator] = parts(value)
  return rational(-numerator, denominator)
}

export function absoluteRational(value: Rational): Rational {
  return compareRational(value, rational(ZERO)) < 0 ? negateRational(value) : value
}
