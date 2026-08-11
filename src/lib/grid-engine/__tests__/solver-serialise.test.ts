// §9 byte-determinism, pinned. "Output serialisation has fixed field and array order and
// locale-independent decimal formatting. No randomness, wall-clock value, platform locale or
// iteration order affects answer content. Timing stays in diagnostics and outside the hash."

import { describe, expect, it } from 'vitest'
import { answerHash, canonicalHash, canonicalSerialise, requestFingerprint } from '../solver/canonical-output'

describe('§9 canonical serialisation', () => {
  it('object key insertion order cannot reach the bytes', () => {
    const a = { band: 2, centreMethod: 'box', publishedEvenMM: 72 }
    const b = { publishedEvenMM: 72, band: 2, centreMethod: 'box' }
    expect(canonicalSerialise(a)).toBe(canonicalSerialise(b))
  })

  it('array order IS answer content and is preserved', () => {
    expect(canonicalSerialise([1, 2])).not.toBe(canonicalSerialise([2, 1]))
  })

  it('negative zero and zero serialise identically', () => {
    expect(canonicalSerialise({ x: -0 })).toBe(canonicalSerialise({ x: 0 }))
  })

  it('non-finite numbers are refused, not silently stringified', () => {
    expect(() => canonicalSerialise({ x: Number.NaN })).toThrow()
    expect(() => canonicalSerialise({ x: Infinity })).toThrow()
  })

  it('undefined is refused — absence must be modelled explicitly', () => {
    expect(() => canonicalSerialise([undefined])).toThrow()
  })

  it('the hash is stable and input-sensitive', () => {
    const bytes = canonicalSerialise({ families: [{ familyId: 'f1' }] })
    expect(canonicalHash(bytes)).toBe(canonicalHash(bytes))
    expect(canonicalHash(bytes)).not.toBe(canonicalHash(bytes + ' '))
  })

  it('TIMING IS OUTSIDE THE ANSWER HASH: two solves differing only in duration hash identically', () => {
    const fast = { families: [{ familyId: 'f1' }], diagnostics: { outlinePointCount: 4, solveDurationMS: 3 } }
    const slow = { families: [{ familyId: 'f1' }], diagnostics: { outlinePointCount: 4, solveDurationMS: 900 } }
    expect(answerHash(fast)).toBe(answerHash(slow))
    const different = { families: [{ familyId: 'f2' }], diagnostics: { outlinePointCount: 4, solveDurationMS: 3 } }
    expect(answerHash(fast)).not.toBe(answerHash(different))
  })

  it('the request fingerprint covers outline AND every law value (G11)', () => {
    const base = {
      outlinePoints: [[0, 0], [10, 0], [10, 10]] as ReadonlyArray<readonly [number, number]>,
      spec: { basePitchMM: 48, sparseFactor: 2, paddingMM: 12, positionsPerAxis: 9 },
      flapLimitsMM: [12, 24] as const,
    }
    const fp = requestFingerprint(base)
    expect(requestFingerprint({ ...base })).toBe(fp)
    // change ONE law value → different fingerprint, or a stale answer gets served after a law change
    expect(requestFingerprint({ ...base, spec: { ...base.spec, paddingMM: 14 } })).not.toBe(fp)
    expect(requestFingerprint({ ...base, flapLimitsMM: [12, 26] as const })).not.toBe(fp)
    expect(
      requestFingerprint({ ...base, outlinePoints: [[0, 0], [10, 0], [10, 11]] }),
    ).not.toBe(fp)
  })
})
