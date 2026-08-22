import type { BoundaryTruth, CertifiedExpressionReal, ContactWitness, Contour, ExactReal, Rational } from '../spec'
import {
  addRational,
  canonicalExact,
  compareExactToRational,
  compareRational,
  divideRational,
  isAlgebraic,
  isRational,
  multiplyRational,
  rational,
  rationalFromNumber,
  signQuadraticAtExact,
  squareRational,
  sqrtRationalBounds,
  subtractRational,
} from './exact-real'

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]
const rotr = (value: number, bits: number) =>
  (value >>> bits) | (value << (32 - bits))
export function sha256Text(text: string): string {
  const source = new TextEncoder().encode(text),
    length = Math.ceil((source.length + 9) / 64) * 64,
    bytes = new Uint8Array(length)
  bytes.set(source)
  bytes[source.length] = 0x80
  new DataView(bytes.buffer).setBigUint64(
    length - 8,
    BigInt(source.length) * BigInt(8),
    false,
  )
  const h = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
      0x1f83d9ab, 0x5be0cd19,
    ],
    w = new Uint32Array(64),
    view = new DataView(bytes.buffer)
  for (let offset = 0; offset < length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false)
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15],
        b = w[i - 2],
        s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3),
        s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, z] = h
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25),
        ch = (e & f) ^ (~e & g),
        t1 = (z + s1 + ch + K[i] + w[i]) >>> 0,
        s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22),
        maj = (a & b) ^ (a & c) ^ (b & c),
        t2 = (s0 + maj) >>> 0
      z = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + z) >>> 0
  }
  return h.map((value) => value.toString(16).padStart(8, '0')).join('')
}
export function contourIdentity(contour: Contour): string {
  const rings = [
    ['outer', contour.outer.pts] as const,
    ...contour.holes.map((hole, index) => [`hole:${index}`, hole.pts] as const),
  ]
  const canonical = rings.map(([id, points]) => [
    id,
    ...points.flatMap((point) => [
      canonicalExact(rationalFromNumber(point[0])),
      canonicalExact(rationalFromNumber(point[1])),
    ]),
  ])
  return sha256Text(JSON.stringify(canonical))
}
export const contourBoundaryTruth = (contour: Contour): BoundaryTruth => ({
  rule: 'supplied-final-contour',
  contourIdentity: contourIdentity(contour),
})
export const certifyContactWitness = (
  witness: Omit<ContactWitness, 'certificateId'>,
): ContactWitness => {
  for (const value of [witness.scale.exact, witness.allowance, witness.tangency.x, witness.tangency.y]) validateExactRealIdentity(value)
  return { ...witness, certificateId: sha256Text(JSON.stringify(witness)) }
}

/** Canonical certificate for `sqrt(a*s^2+b*s+c)-subtract` over one exact scale. */
export function certifySqrtQuadraticExpression(
  scale: ExactReal,
  coefficients: readonly [Rational, Rational, Rational],
  subtract: Rational,
): ExactReal {
  if (compareRational(subtract, rational(0)) >= 0 && signQuadraticAtExact(
    coefficients[0],
    coefficients[1],
    subtractRational(coefficients[2], squareRational(subtract)),
    scale,
  ) === 0) return rational(0)
  const expression = [
    'sqrt-quadratic-minus', canonicalExact(scale), canonicalExact(coefficients[0]),
    canonicalExact(coefficients[1]), canonicalExact(coefficients[2]), canonicalExact(subtract),
  ] as const
  const expressionHash = sha256Text(JSON.stringify(expression))
  const proofId = sha256Text(JSON.stringify(['sqrt-quadratic-proof-v1', expressionHash]))
  const scaleBounds: readonly [Rational, Rational] = isRational(scale) ? [scale, scale] : scale.isolating
  const intervalMultiply = (
    left: readonly [Rational, Rational], right: readonly [Rational, Rational],
  ): readonly [Rational, Rational] => {
    const products = [
      multiplyRational(left[0], right[0]), multiplyRational(left[0], right[1]),
      multiplyRational(left[1], right[0]), multiplyRational(left[1], right[1]),
    ]
    return [
      products.reduce((best, value) => compareRational(value, best) < 0 ? value : best),
      products.reduce((best, value) => compareRational(value, best) > 0 ? value : best),
    ]
  }
  const intervalAdd = (
    left: readonly [Rational, Rational], right: readonly [Rational, Rational],
  ): readonly [Rational, Rational] => [addRational(left[0], right[0]), addRational(left[1], right[1])]
  const constant = (value: Rational): readonly [Rational, Rational] => [value, value]
  const squaredScale = intervalMultiply(scaleBounds, scaleBounds)
  const distance = intervalAdd(
    intervalAdd(intervalMultiply(constant(coefficients[0]), squaredScale), intervalMultiply(constant(coefficients[1]), scaleBounds)),
    constant(coefficients[2]),
  )
  if (compareRational(distance[0], rational(0)) < 0) throw new RangeError('certified distance interval crosses negative')
  const sqrtLo = sqrtRationalBounds(distance[0])[0], sqrtHi = sqrtRationalBounds(distance[1])[1]
  const lo = addRational(sqrtLo, multiplyRational(rational(-1), subtract))
  const hi = addRational(sqrtHi, multiplyRational(rational(-1), subtract))
  if (compareRational(lo, hi) === 0) return lo
  return { expressionHash, expression, isolating: [lo, hi], proofId }
}

export function validateCertifiedExpressionIdentity(value: CertifiedExpressionReal): void {
  const expressionHash = sha256Text(JSON.stringify(value.expression))
  const proofId = sha256Text(JSON.stringify(['sqrt-quadratic-proof-v1', expressionHash]))
  if (value.expressionHash !== expressionHash || value.proofId !== proofId) throw new RangeError('certified expression identity mismatch')
  compareExactToRational(value, value.isolating[0])
  compareExactToRational(value, value.isolating[1])
}

export function validateExactRealIdentity(value: ExactReal): void {
  if ('expressionHash' in value) validateCertifiedExpressionIdentity(value)
}
