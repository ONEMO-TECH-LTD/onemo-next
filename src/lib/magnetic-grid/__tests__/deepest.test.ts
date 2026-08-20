import { describe, expect, it } from 'vitest'
import { exactContour, toUnits } from '../compute/clearance'
import { approx, cInt, cMul, cSqrt, cSub, compareCReal } from '../compute/certified-real'
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


function asCertified(m: ReturnType<typeof clearanceMaximum>) {
  if (m.status !== 'certified') throw new Error(`expected certified, got ${m.status}: ${m.reasons.join('; ')}`)
  return m
}
function asTie(m: ReturnType<typeof clearanceMaximum>) {
  if (m.status !== 'tie') throw new Error(`expected tie, got ${m.status}: ${m.reasons.join('; ')}`)
  return m
}
function asPlateau(m: ReturnType<typeof clearanceMaximum>) {
  if (m.status !== 'plateau') throw new Error(`expected plateau, got ${m.status}: ${m.reasons.join('; ')}`)
  return m
}

describe('clearance maximum (item 5)', () => {
  it('72 square: certified at exactly (36,36) with clearance exactly 36', () => {
    const { c, results } = deepest(rect(72, 72))
    expect(results).toHaveLength(1)
    const m = asCertified(results[0])
    const u = c.unit
    // exact: the solution of three axis-aligned bisectors is rational
    expect(compareExact(m.best.lo, ratFromInt(BigInt(36) * u))).toBe(0)
    expect(compareExact(m.best.hi, ratFromInt(BigInt(36) * u))).toBe(0)
    const a = candidateApprox(m.best, u)
    expect(a.x).toBe(36); expect(a.y).toBe(36)
  })

  it('96×48: the maximum is a CONTINUUM — one plateau branch, not a pair of points', () => {
    const { c, results } = deepest(rect(96, 48))
    const m = asPlateau(results[0])
    // the whole ridge y=24, 24≤x≤72 is co-maximal; only branch evidence can express that, and the
    // union offers NO selectable point here — a continuum cannot yield one centre decision
    expect(m.branches).toHaveLength(1)
    expect('best' in m).toBe(false)
    expect(compareExact(m.clearanceLo, ratFromInt(BigInt(24) * c.unit))).toBe(0)
    const [pl] = m.branches
    const U = Number(c.unit)
    expect([approx(pl.from.x) / U, approx(pl.to.x) / U].sort((a, b) => a - b)).toEqual([24, 72])
    expect(approx(pl.from.y) / U).toBe(24)
    expect(approx(pl.to.y) / U).toBe(24)
    expect(compareExact(pl.lo, m.clearanceLo)).toBe(0)
  })

  it('hole: the maximum moves to the corner zone, 40√2/(1+√2), certified', () => {
    const holed: Contour = { ...rect(100, 100), holes: [{ pts: [[40, 40], [60, 40], [60, 60], [40, 60]] }] }
    const { c, results } = deepest(holed)
    const m = asTie(results[0])
    // four symmetric corner maxima: isolated points, exactly equal → tie, and no continuum
    expect('branches' in m).toBe(false)
    expect(m.candidates).toHaveLength(4)
    const want = 40 * Math.SQRT2 / (1 + Math.SQRT2)
    for (const cand of m.candidates) {
      expect(Math.abs(candidateApprox(cand, c.unit).clearance - want)).toBeLessThan(1e-9)
      expect(compareCReal(cand.d2, m.candidates[0].d2)).toBe(0)
    }
  })

  it('plateau evidence is load-bearing: an interior ridge point is co-maximal, not merely near-maximal', () => {
    // Mutation guard for Meta's finding. A build that dismisses two-feature parallel branches by
    // count reports isolated points here and cannot produce a branch at all; one that samples the
    // ridge cannot prove its interior. Assert an INTERIOR point exactly equals the maximum.
    const { c, results } = deepest(rect(96, 48))
    const m = asPlateau(results[0])
    const [pl] = m.branches
    // interior, strictly between the ends, at exactly the maximal clearance
    const midX = approx(pl.mid.x) / Number(c.unit)
    expect(midX).toBeGreaterThan(24)
    expect(midX).toBeLessThan(72)
    expect(compareCReal(pl.d2, m.d2)).toBe(0)
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
      const m = asPlateau(results[0])
      const U = Number(c.unit)
      expect(m.branches, `${x0}..${x1}`).toHaveLength(1)
      const [pl] = m.branches
      expect([approx(pl.from.x) / U, approx(pl.to.x) / U].sort((a, b) => a - b)).toEqual([x0, x1])
      expect(approx(pl.from.y) / U).toBe(y)
      expect(approx(pl.to.y) / U).toBe(y)
      expect(compareExact(m.clearanceLo, ratFromInt(BigInt(24) * c.unit))).toBe(0)
    }
  })

  it('a square has no plateau: its maximum is a single certified point, so plateau logic cannot over-report', () => {
    const { results } = deepest(rect(72, 72))
    const m = asCertified(results[0])
    expect('branches' in m).toBe(false)
    expect('candidates' in m).toBe(false)
  })

  it('dumbbell: each island is co-maximal along a short ridge into its neck, clearance exactly 30', () => {
    // The maximum here is NOT the single point (30,30) this once asserted. Walking right from the
    // block centre, the top and bottom edges stay at exactly 30 while the right wall is BROKEN by
    // the neck, so its nearest point becomes the corner (60,25) — √(29.8²+5²) ≈ 30.22 at x=30.2,
    // farther than 30. Clearance therefore holds at 30 until that corner closes in, which happens
    // exactly where (60−x)² = 30²−5², i.e. x = 60−√875. The ridge is real; the old single-point
    // claim passed only while an undecidable comparison refused the branch.
    const dumbbell: Contour = { outer: { pts: [[0, 0], [60, 0], [60, 25], [100, 25], [100, 0], [160, 0], [160, 60], [100, 60], [100, 35], [60, 35], [60, 60], [0, 60]] }, holes: [] }
    const { c, results } = deepest(dumbbell)
    expect(results).toHaveLength(2)
    const u = c.unit
    const U = Number(u)
    // EXACT oracles in engine units — the branch is algebraic, so a decimal cannot certify it.
    // Left lobe: x runs from 30 to 60−5√35. Right lobe is its mirror about x=160.
    const block = cInt(BigInt(30) * u)
    const farLeft = cSub(cInt(BigInt(60) * u), cMul(cInt(BigInt(5) * u), cSqrt(cInt(35))))
    const farRight = cSub(cInt(BigInt(160) * u), farLeft)
    for (const result of results) {
      const m = asPlateau(result)
      expect(m.branches).toHaveLength(1)
      const [pl] = m.branches
      const side = compareCReal(pl.from.x, cInt(BigInt(100) * u))
      expect(side, 'which island this branch belongs to must be decidable').not.toBeNull()
      const onLeft = (side as -1 | 0 | 1) < 0
      const ends = [pl.from.x, pl.to.x]
      const wanted = onLeft ? [block, farLeft] : [cInt(BigInt(130) * u), farRight]
      // each end matches one exact oracle, in either traversal order
      for (const target of wanted) {
        expect(ends.some((end) => compareCReal(end, target) === 0), `${onLeft ? 'left' : 'right'} end`).toBe(true)
      }
      expect(compareCReal(pl.from.y, cInt(BigInt(30) * u))).toBe(0)
      expect(compareCReal(pl.to.y, cInt(BigInt(30) * u))).toBe(0)
      // the clearance held along the whole ridge is exactly 30, and exactly constant
      expect(compareExact(pl.lo, ratFromInt(BigInt(30) * u))).toBe(0)
      expect(compareExact(pl.lo, pl.hi)).toBe(0)
      // report evidence only
      expect(approx(pl.from.y) / U).toBe(30)
    }
  })
})
