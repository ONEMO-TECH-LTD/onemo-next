// §6.1 requires exact values to survive as decimal-string integers so "Node/browser/worker/cache
// bytes agree". The only thing that proves it is a round trip: what comes back must be the value
// that went in, for values chosen to break a lossy encoder — beyond double precision, negative,
// unnormalized, and the exact IEEE-754 bit pattern of a decimal that has no finite binary form.

import { describe, expect, it } from 'vitest'
import { decodeRational, encodeRational } from '../compute/identity'
import { compareExact, ratFromNumber, rational, type ExactRational } from '../compute/exact-real'

describe('§6.1 canonical serialization of exact rationals', () => {
  const cases: ReadonlyArray<{ id: string; value: ExactRational }> = [
    { id: 'zero', value: rational(BigInt(0), BigInt(1)) },
    { id: 'unit', value: rational(BigInt(1), BigInt(1)) },
    { id: 'negative', value: rational(BigInt(-7), BigInt(3)) },
    { id: 'unnormalized input', value: rational(BigInt(6), BigInt(-4)) },
    { id: 'beyond double precision', value: rational(BigInt('90071992547409919'), BigInt('90071992547409921')) },
    { id: 'the exact bits of 0.1', value: ratFromNumber(0.1) },
    { id: 'a 200-digit numerator', value: rational(BigInt('9'.repeat(200)), BigInt('7'.repeat(199))) },
  ]

  it('round-trips every exact rational unchanged', () => {
    for (const { id, value } of cases) {
      const returned = decodeRational(encodeRational(value))
      expect(compareExact(returned, value), `${id} value`).toBe(0)
      // identical terms, not merely an equal ratio — the encoding is canonical
      expect(returned.n, `${id} numerator`).toBe(value.n)
      expect(returned.d, `${id} denominator`).toBe(value.d)
    }
  })

  it('encodes to decimal strings, since that is what makes bytes agree across runtimes', () => {
    const encoded = encodeRational(rational(BigInt(-7), BigInt(3)))
    expect(encoded).toEqual({ numerator: '-7', denominator: '3' })
    // a 200-digit term survives as digits, which is the point: no float, no exponent form
    const big = encodeRational(rational(BigInt('9'.repeat(200)), BigInt(1)))
    expect(big.numerator).toHaveLength(200)
    expect(big.numerator).not.toContain('e')
  })
})
