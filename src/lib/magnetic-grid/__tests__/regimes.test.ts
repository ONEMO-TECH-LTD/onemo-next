import { describe, expect, it } from 'vitest'
import { approximateExact, compareExactToRational, rational } from '../compute/exact-real'
import { boxTargetCoefficient, enumerateAffineContactEvents, latticeOffsets } from '../compute/regimes'
import type { Band, Contour } from '../spec'

const diamond: Contour = {
  outer: { pts: [[0, .5], [.5, 0], [0, -.5], [-.5, 0]] },
  holes: [],
}

describe('exact scaling regime events', () => {
  it('takes its lattice domain from the spec-held positions-per-axis value', () => {
    expect(latticeOffsets(false, 48, 3)).toHaveLength(3)
    expect(latticeOffsets(false, 48, 5)).toHaveLength(5)
    expect(latticeOffsets(false, 48, 3)).not.toEqual(latticeOffsets(false, 48, 5))
  })

  it('enumerates the non-integer B3 diamond contact root directly', () => {
    const band: Band = { id: 3, minMM: 120, maxMM: 167 }
    const events = enumerateAffineContactEvents(diamond, boxTargetCoefficient(diamond), band, 48, 12)
    const root = events.find((event) =>
      event.projection === 'interior'
      && Math.abs(approximateExact(event.scale) - (96 + 24 * Math.SQRT2)) < 1e-10)
    expect(root).toBeDefined()
    expect(root!.equation).toEqual(['1', '-192', '8064'])
    expect(compareExactToRational(root!.scale, rational(129))).toBe(1)
    expect(compareExactToRational(root!.scale, rational(130))).toBe(-1)
  })
})
