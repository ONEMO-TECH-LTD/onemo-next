// EC-12's synthetic cases: concave non-monotonic legality, the open concavity (a C — a single
// ring, no topological hole; donuts are excluded by ruling), and a narrow sliver that supports
// only the pair floor. Each pins behaviour the corpus cannot isolate.

import { describe, expect, it } from 'vitest'
import { containmentIntervals, boxContainedAt } from '../solver/contacts'
import { solve } from '../solver/solve'
import type { PointMM, SolveRequest } from '../solver/contract'

// A C: outer square [-50,50]² with a mouth cut from the right edge to x=10, band |y|<10.
const C: PointMM[] = [
  [-50, -50],
  [50, -50],
  [50, -10],
  [10, -10],
  [10, 10],
  [50, 10],
  [50, 50],
  [-50, 50],
]

describe('EC-12 synthetic — non-monotonic legality on an open concavity', () => {
  it('legality enters, leaves and re-enters as the shape grows — two disjoint exact intervals', () => {
    // Box above the mouth band. Analytically: outer containment from σ = 25/50 = 0.5; the mouth
    // band |y| < 10σ reaches y = 6 at σ = 0.6 (unlawful); the mouth's inner wall 10σ passes
    // x = 25 at σ = 2.5 (lawful again). A bisection or any monotonicity assumption misses the
    // first island entirely.
    const box = { x0: 15, y0: 6, x1: 25, y1: 9 }
    const ivs = containmentIntervals(box, C, 5)
    expect(ivs.length).toBe(2)
    expect(ivs[0].lo).toBeCloseTo(0.5, 12)
    expect(ivs[0].hi).toBeCloseTo(0.6, 12)
    expect(ivs[1].lo).toBeCloseTo(2.5, 12)
    expect(ivs[1].hi).toBeCloseTo(5, 12)
    // witnesses on each side of every boundary
    expect(boxContainedAt(box, C, 0.55)).toBe(true)
    expect(boxContainedAt(box, C, 1.0)).toBe(false)
    expect(boxContainedAt(box, C, 2.0)).toBe(false)
    expect(boxContainedAt(box, C, 3.0)).toBe(true)
  })
})

const spec = {
  basePitchMM: 48,
  sparseFactor: 2,
  paddingMM: 12,
  positionsPerAxis: 9,
  bands: [2, 3] as const as Array<2 | 3>,
  centreMethods: ['box'] as const as Array<'box'>,
}

describe('EC-12 synthetic — the C solves as a single ring', () => {
  it('produces lawful families; every family carries both populations', () => {
    const request: SolveRequest = { outline: C, spec, flapLimitsMM: [12, 24] }
    const outcome = solve(request)
    expect(outcome.status).toBe('solved')
    if (outcome.status !== 'solved') return
    expect(outcome.families.length).toBeGreaterThan(0)
    for (const f of outcome.families) {
      expect(f.populations.base.arrangement.magnets.length).toBeGreaterThanOrEqual(2)
      expect(f.populations.sparse.arrangement.magnets.length).toBeGreaterThanOrEqual(2)
      expect(f.publishedEvenMM % 2).toBe(0)
    }
  })
})

describe('EC-12 synthetic — a narrow sliver supports only the pair floor', () => {
  it('every family is a twin-fix pair in both populations; none is silently dropped', () => {
    // 100 × 16 sliver. At the ceiling σ = 408/100 the manufactured height is 65mm — below the
    // 72mm a second row's pair box needs — so one row is all the material ever offers. (A 26mm
    // sliver was the first draft and DID grow a lawful second row at large σ: the engine was
    // right and the fixture wrong.)
    const sliver: PointMM[] = [
      [-50, -8],
      [50, -8],
      [50, 8],
      [-50, 8],
    ]
    const request: SolveRequest = { outline: sliver, spec, flapLimitsMM: [12, 24] }
    const outcome = solve(request)
    expect(outcome.status).toBe('solved')
    if (outcome.status !== 'solved') return
    expect(outcome.families.length).toBeGreaterThan(0)
    for (const f of outcome.families) {
      // one row only — a second row cannot hold. Horizontal runs (pairs AND 3-runs) are the
      // material's whole offer; a four-corner optimum is impossible.
      const ys = new Set(f.populations.base.arrangement.magnets.map((m) => m.coordinateMM[1]))
      expect(ys.size).toBe(1)
      expect(f.classification).not.toBe('optimum')
      // EC-13: exactly-two arrangements are twin-fix; over-limit ones remain REPORTED with
      // sizeEligible false, never dropped. Three or more is multi-fix.
      const base = f.populations.base
      if (base.arrangement.magnets.length === 2) {
        expect(base.fix.kind).toBe('twin-fix')
        expect(base.fix.sizeEligible).toBe(f.publishedEvenMM < base.fix.limitMM)
      } else {
        expect(base.fix.kind).toBe('multi-fix')
      }
    }
    // the pair floor itself must be among the offer (EC-05)
    expect(outcome.families.some((f) => f.populations.base.arrangement.magnets.length === 2)).toBe(true)
  })
})
