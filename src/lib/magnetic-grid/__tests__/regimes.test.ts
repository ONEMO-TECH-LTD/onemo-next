import { describe, expect, it } from 'vitest'
import { approximateExact, compareExactToRational, rational } from '../compute/exact-real'
import { boxTargetCoefficient, enumerateAffineContactEvents, enumerateParityClassEvents, latticeOffsets, scaleInBand } from '../compute/regimes'
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

  it('enumerates aspect-dependent parity boundaries without stepping', () => {
    const rectangle: Contour = { outer: { pts: [[0, 0], [1, 0], [1, .5], [0, .5]] }, holes: [] }
    const bands: Band[] = [
      { id: 1, minMM: 24, maxMM: 71 },
      { id: 2, minMM: 72, maxMM: 119 },
      { id: 3, minMM: 120, maxMM: 167 },
      { id: 4, minMM: 168, maxMM: 215 },
    ]
    const events = enumerateParityClassEvents(rectangle, bands)
    expect(events.some((event) => event.axis === 1 && event.boundaryMM === 72 && event.scale.numerator === '144')).toBe(true)
    expect(events.every((event) => event.kind === 'PARITY_CLASS')).toBe(true)
  })

  it('owns the continuous gap and assigns the shared boundary once', () => {
    const bands: Band[] = [
      { id: 1, minMM: 24, maxMM: 71 },
      { id: 2, minMM: 72, maxMM: 119 },
      { id: 3, minMM: 120, maxMM: 167 },
      { id: 4, minMM: 168, maxMM: 215 },
    ]
    expect(scaleInBand(rational(143, 2), bands[0], bands)).toBe(true)
    expect(scaleInBand(rational(72), bands[0], bands)).toBe(false)
    expect(scaleInBand(rational(72), bands[1], bands)).toBe(true)
    expect(scaleInBand(rational(431, 2), bands[3], bands)).toBe(true)
    expect(scaleInBand(rational(216), bands[3], bands)).toBe(false)
  })
})
