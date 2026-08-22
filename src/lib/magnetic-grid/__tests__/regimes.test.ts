import { describe, expect, it } from 'vitest'
import { rational } from '../compute/exact-real'
import { enumerateParityClassEvents, latticeOffsets, scaleInBand } from '../compute/regimes'
import type { Band, Contour } from '../spec'

describe('exact scaling regime events', () => {
  it('takes its lattice domain from the spec-held positions-per-axis value', () => {
    expect(latticeOffsets(false, 48, 3)).toHaveLength(3)
    expect(latticeOffsets(false, 48, 5)).toHaveLength(5)
    expect(latticeOffsets(false, 48, 3)).not.toEqual(latticeOffsets(false, 48, 5))
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
