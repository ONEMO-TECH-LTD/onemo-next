import { describe, expect, it } from 'vitest'
import { canonicalExact } from '../compute/exact-real'
import { computeGrid } from '../engine'
import type { Contour, Pt } from '../spec'

const square = (side: number): Contour => ({
  outer: { pts: [[-side / 2, -side / 2], [side / 2, -side / 2], [side / 2, side / 2], [-side / 2, side / 2]] },
  holes: [],
})

const diamond = (axisRadius: number): Contour => ({
  outer: { pts: [[0, axisRadius], [axisRadius, 0], [0, -axisRadius], [-axisRadius, 0]] },
  holes: [],
})

const baseConfig = { paddingMM: 12, centreMode: 0, perimeterOnly: true } as const

describe('v3.5.1 exact Wrap', () => {
  it('accepts square24 at flap 0 with a stored exact segment witness', () => {
    const grid = computeGrid(square(24), { ...baseConfig, flapMM: 0, wrapMode: 'fixed' })
    expect(grid.wrap.status).toBe('lawful')
    if (grid.wrap.status !== 'lawful') return
    expect(grid.wrap.requiredFlap).toEqual({ numerator: '0', denominator: '1' })
    expect(grid.wrap.witnesses).toHaveLength(1)
    expect(grid.contactsMM).toEqual(grid.wrap.witnesses.map((witness) => witness.tangency.approximateMM))
  })

  it('refuses the square24.1 loose near-miss at flap 0', () => {
    const grid = computeGrid(square(24.1), { ...baseConfig, flapMM: 0, wrapMode: 'fixed' })
    expect(grid.wrap.status).toBe('refused')
    if (grid.wrap.status !== 'refused') return
    expect(grid.wrap.code).toBe('WRAP_EXCEEDS_ALLOWANCE')
    expect(grid.wrap.requiredFlapApproxMM).toBeGreaterThan(0)
    expect(grid.contactsMM).toEqual([])
  })

  it('returns the exact irrational diamond18 Auto minimum and enforces its cap', () => {
    const lawful = computeGrid(diamond(18), { ...baseConfig, wrapMode: 'auto', autoFlapCapMM: 1 })
    expect(lawful.wrap.status).toBe('lawful')
    if (lawful.wrap.status !== 'lawful') return
    expect('polynomial' in lawful.wrap.appliedFlap).toBe(true)
    expect(lawful.wrap.appliedFlapApproxMM).toBeCloseTo(18 / Math.sqrt(2) - 12, 14)

    const refused = computeGrid(diamond(18), { ...baseConfig, wrapMode: 'auto', autoFlapCapMM: 0.7 })
    expect(refused.wrap.status).toBe('refused')
  })

  it('measures Wrap on the perimeter belt regardless of output coverage', () => {
    const perimeter = computeGrid(square(120), { ...baseConfig, flapMM: 0, wrapMode: 'fixed', perimeterOnly: true })
    const full = computeGrid(square(120), { ...baseConfig, flapMM: 0, wrapMode: 'fixed', perimeterOnly: false })
    expect(canonicalExact(perimeter.wrap.requiredFlap)).toBe(canonicalExact(full.wrap.requiredFlap))
    expect(perimeter.wrap.witnesses.map((witness) => witness.anchor as Pt))
      .toEqual(full.wrap.witnesses.map((witness) => witness.anchor as Pt))
  })
})
