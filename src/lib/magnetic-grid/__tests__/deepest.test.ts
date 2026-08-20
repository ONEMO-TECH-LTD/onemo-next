import { describe, expect, it } from 'vitest'
import { exactContour, toUnits } from '../compute/clearance'
import { approx, compareCReal } from '../compute/certified-real'
import { candidateApprox, clearanceMaximum } from '../compute/deepest'
import { compareExact, ratFromInt } from '../compute/exact-real'
import { exactRegions } from '../compute/region'
import type { Contour } from '../spec'

const rect = (w: number, h: number): Contour => ({ outer: { pts: [[0, 0], [w, 0], [w, h], [0, h]] }, holes: [] })

function deepest(contour: Contour, r = 12) {
  const c = exactContour(contour)
  const ru = toUnits(r, c)
  const { regions } = exactRegions(c, ru)
  return { c, ru, regions, results: regions.map((region) => clearanceMaximum(c, region, ru)) }
}

describe('clearance maximum (item 5)', () => {
  it('72 square: certified at exactly (36,36) with clearance exactly 36', () => {
    const { c, results } = deepest(rect(72, 72))
    expect(results).toHaveLength(1)
    const m = results[0]
    expect(m.status).toBe('certified')
    const u = c.unit
    // exact: the solution of three axis-aligned bisectors is rational
    expect(compareExact(m.best!.lo, ratFromInt(BigInt(36) * u))).toBe(0)
    expect(compareExact(m.best!.hi, ratFromInt(BigInt(36) * u))).toBe(0)
    const a = candidateApprox(m.best!, u)
    expect(a.x).toBe(36); expect(a.y).toBe(36)
  })

  it('96×48: the maximum is a CONTINUUM — one plateau branch, not a pair of points', () => {
    const { c, results } = deepest(rect(96, 48))
    const m = results[0]
    // the whole ridge y=24, 24≤x≤72 is co-maximal; only branch evidence can express that
    expect(m.status).toBe('plateau')
    expect(m.plateaus).toHaveLength(1)
    expect(compareExact(m.best!.lo, ratFromInt(BigInt(24) * c.unit))).toBe(0)
    const [pl] = m.plateaus
    const U = Number(c.unit)
    expect([approx(pl.from.x) / U, approx(pl.to.x) / U].sort((a, b) => a - b)).toEqual([24, 72])
    expect(approx(pl.from.y) / U).toBe(24)
    expect(approx(pl.to.y) / U).toBe(24)
    expect(compareExact(pl.lo, m.best!.lo)).toBe(0)
  })

  it('hole: the maximum moves to the corner zone, 40√2/(1+√2), certified', () => {
    const holed: Contour = { ...rect(100, 100), holes: [{ pts: [[40, 40], [60, 40], [60, 60], [40, 60]] }] }
    const { c, results } = deepest(holed)
    const m = results[0]
    // four symmetric corner maxima: isolated points, exactly equal → tie, and no continuum
    expect(m.status).toBe('tie')
    expect(m.plateaus).toEqual([])
    expect(1 + m.ties.length).toBe(4)
    const want = 40 * Math.SQRT2 / (1 + Math.SQRT2)
    const got = candidateApprox(m.best!, c.unit).clearance
    expect(Math.abs(got - want)).toBeLessThan(1e-9)
    for (const t of m.ties) expect(compareExact(t.lo, m.best!.lo)).toBe(0)
  })

  it('plateau evidence is load-bearing: an interior ridge point is co-maximal, not merely near-maximal', () => {
    // Mutation guard for Meta's finding. A build that dismisses two-feature parallel branches by
    // count reports isolated points here and cannot produce a branch at all; one that samples the
    // ridge cannot prove its interior. Assert an INTERIOR point exactly equals the maximum.
    const { c, results } = deepest(rect(96, 48))
    const m = results[0]
    expect(m.plateaus.length).toBeGreaterThan(0)
    const [pl] = m.plateaus
    // interior, strictly between the ends, at exactly the maximal clearance
    const midX = approx(pl.mid.x) / Number(c.unit)
    expect(midX).toBeGreaterThan(24)
    expect(midX).toBeLessThan(72)
    expect(compareCReal(pl.d2, m.best!.d2)).toBe(0)
    // ...and every point of the branch shares one exact clearance value
    expect(compareExact(pl.lo, pl.hi)).toBe(0)
  })

  it('plateau is translation-invariant: the branch moves with the shape, in all quadrants', () => {
    // Falsifier for generator finiteness (Grid-Meta): the branch's base point is derived from the
    // bisector form and lies OUTSIDE both finite generators here, so a build that certifies the
    // infinite-line distance — or clips without the generators' own projection-regime events —
    // reports a wrong constant or no branch. The origin fixture cannot expose this.
    const cases: Array<{ shape: Contour; y: number; x0: number; x1: number }> = [
      { shape: rect(96, 48), y: 24, x0: 24, x1: 72 },
      { shape: { outer: { pts: [[100, 50], [196, 50], [196, 98], [100, 98]] }, holes: [] }, y: 74, x0: 124, x1: 172 },
      { shape: { outer: { pts: [[-200, -120], [-104, -120], [-104, -72], [-200, -72]] }, holes: [] }, y: -96, x0: -176, x1: -128 },
    ]
    for (const { shape, y, x0, x1 } of cases) {
      const { c, results } = deepest(shape)
      const m = results[0]
      const U = Number(c.unit)
      expect(m.status, `${x0}..${x1}`).toBe('plateau')
      expect(m.plateaus).toHaveLength(1)
      const [pl] = m.plateaus
      expect([approx(pl.from.x) / U, approx(pl.to.x) / U].sort((a, b) => a - b)).toEqual([x0, x1])
      expect(approx(pl.from.y) / U).toBe(y)
      expect(approx(pl.to.y) / U).toBe(y)
      expect(compareExact(m.best!.lo, ratFromInt(BigInt(24) * c.unit))).toBe(0)
    }
  })

  it('a square has no plateau: its maximum is a single certified point, so plateau logic cannot over-report', () => {
    const { results } = deepest(rect(72, 72))
    expect(results[0].status).toBe('certified')
    expect(results[0].ties).toEqual([])
    expect(results[0].plateaus).toEqual([])
  })

  it('dumbbell: each island certified at its own centre (30,30) / (130,30), clearance 30', () => {
    const dumbbell: Contour = { outer: { pts: [[0, 0], [60, 0], [60, 25], [100, 25], [100, 0], [160, 0], [160, 60], [100, 60], [100, 35], [60, 35], [60, 60], [0, 60]] }, holes: [] }
    const { c, results } = deepest(dumbbell)
    expect(results).toHaveLength(2)
    const centres = results.map((m) => { expect(m.status).toBe('certified'); return candidateApprox(m.best!, c.unit) }).sort((a, b) => a.x - b.x)
    expect(centres.map((k) => [k.x, k.y, k.clearance])).toEqual([[30, 30, 30], [130, 30, 30]])
  })
})
