import { describe, expect, it } from 'vitest'
import { canonicalOutline, UnsupportedOutlineError } from '../solver/canonical-outline'
import { canonicalId, canonicalSerialise } from '../solver/canonical-output'

describe('canonical outline', () => {
  const square = [[0, 0], [4, 0], [4, 3], [0, 3]] as const

  it('makes winding, closing vertex and start index byte-identical without simplifying', () => {
    const shifted = [[4, 3], [4, 0], [0, 0], [0, 3], [4, 3]] as const
    expect(canonicalOutline(shifted)).toEqual(canonicalOutline(square))
    expect(canonicalOutline(square)).toHaveLength(4)
  })

  it('rejects every unsupported single-ring condition explicitly', () => {
    const cases = [
      { points: [[0, 0], [1, 1]], reason: 'fewer-than-three-vertices' },
      { points: [[0, 0], [1, 1], [2, 2]], reason: 'zero-area' },
      { points: [[0, 0], [2, 2], [0, 2], [2, 0]], reason: 'self-intersection' },
      { points: [[0, 0], [1, Number.NaN], [0, 1]], reason: 'non-finite-coordinate' },
    ] as const
    for (const item of cases) {
      try {
        canonicalOutline(item.points)
        throw new Error('expected refusal')
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedOutlineError)
        expect((error as UnsupportedOutlineError).reason).toBe(item.reason)
      }
    }
  })
})

describe('canonical output', () => {
  it('is independent of object insertion order and normalises negative zero', () => {
    expect(canonicalSerialise({ b: -0, a: 1 })).toBe(canonicalSerialise({ a: 1, b: 0 }))
    expect(canonicalId({ b: -0, a: 1 })).toBe(canonicalId({ a: 1, b: 0 }))
  })
})
