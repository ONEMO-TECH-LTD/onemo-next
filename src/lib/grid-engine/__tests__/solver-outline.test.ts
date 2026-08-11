// M3 pinned to canon. Each case cites the blueprint clause it enforces.

import { describe, expect, it } from 'vitest'
import {
  canonicaliseOutline,
  clearanceMM,
  supported,
} from '../solver/canonical-outline'
import type { PointMM } from '../solver/contract'

const square: PointMM[] = [
  [-50, -50],
  [50, -50],
  [50, 50],
  [-50, 50],
]

const ok = (pts: readonly PointMM[]) => {
  const r = canonicaliseOutline(pts)
  if (!r.ok) throw new Error(`refused: ${r.reason}`)
  return r.outline
}

describe('§3.2 canonicalisation — winding and start-index become byte-identical', () => {
  it('reversed winding gives the identical point sequence', () => {
    const a = ok(square)
    const b = ok([...square].reverse())
    expect(b.points).toEqual(a.points)
  })

  it('a rotated start index gives the identical point sequence', () => {
    const a = ok(square)
    for (let k = 1; k < square.length; k++) {
      const rotated = [...square.slice(k), ...square.slice(0, k)]
      expect(ok(rotated).points).toEqual(a.points)
    }
  })

  it('a repeated closing vertex and consecutive duplicates are dropped, geometry untouched', () => {
    const messy: PointMM[] = [
      [-50, -50],
      [-50, -50],
      [50, -50],
      [50, 50],
      [50, 50],
      [-50, 50],
      [-50, -50],
    ]
    expect(ok(messy).points).toEqual(ok(square).points)
  })

  it('preserves every non-duplicate vertex exactly — nothing is simplified (§3.2 step 5)', () => {
    // a redundant-but-distinct collinear vertex must SURVIVE: canonicalisation never redraws
    const withCollinear: PointMM[] = [
      [-50, -50],
      [0, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ]
    expect(ok(withCollinear).points).toHaveLength(5)
  })
})

describe('§3.1 refusal — degenerate input is refused, never repaired (G2)', () => {
  it.each([
    [[], 'fewer-than-three-vertices'],
    [[[0, 0]] as PointMM[], 'fewer-than-three-vertices'],
    [
      [
        [0, 0],
        [10, 10],
      ] as PointMM[],
      'fewer-than-three-vertices',
    ],
    [
      [
        [0, 0],
        [10, 0],
        [20, 0],
      ] as PointMM[],
      'zero-area',
    ],
    [
      [
        [0, 0],
        [20, 20],
        [20, 0],
        [0, 10],
      ] as PointMM[],
      'self-intersection', // a bow-tie with UNEQUAL lobes — net area non-zero, so the crossing
      // itself must be what refuses it, not the zero-area check firing first
    ],
    [
      [
        [0, 0],
        [Number.NaN, 5],
        [10, 10],
      ] as PointMM[],
      'non-finite-coordinate',
    ],
    [
      // COLLINEAR OVERLAP — the boundary doubles back along its own segment. Not a proper
      // crossing, so a crossings-only test accepts it; §3.1 demands one simple closed polygon.
      [
        [0, 0],
        [10, 0],
        [4, 0],
        [4, 8],
      ] as PointMM[],
      'self-intersection',
    ],
    [
      // T-TOUCH — a vertex lands ON a non-adjacent edge's interior and retreats. The boundary
      // pinches without crossing; no edge properly intersects any other.
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [5, 0],
        [0, 10],
      ] as PointMM[],
      'self-intersection',
    ],
    [
      // REPEATED NON-ADJACENT VERTEX — an hourglass touching itself at one point. Every edge
      // pair is crossing-free; the repeated vertex is the whole defect.
      [
        [0, 0],
        [4, 4],
        [8, 0],
        [8, 8],
        [4, 4],
        [0, 8],
      ] as PointMM[],
      'self-intersection',
    ],
  ])('case %# refuses with the stated reason', (pts, reason) => {
    const r = canonicaliseOutline(pts as PointMM[])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe(reason)
  })
})

describe('§3.3 the support predicate — closed boundary, no epsilon', () => {
  it('clearance is exact against analytic truth on the square', () => {
    const o = ok(square)
    expect(clearanceMM([0, 0], o)).toBe(50)
    expect(clearanceMM([20, 0], o)).toBe(30)
    expect(clearanceMM([50, 0], o)).toBe(0)
    expect(clearanceMM([60, 0], o)).toBe(-10)
    expect(clearanceMM([40, 40], o)).toBe(10)
  })

  it('TANGENCY IS LAWFUL: a disc exactly at the padding passes the closed comparison', () => {
    // The canon answer depends on this: the square publishes at clearance exactly the padding.
    const o = ok(square)
    expect(supported([38, 0], o, 12)).toBe(true) // clearance exactly 12 — lawful
    expect(supported([38.000001, 0], o, 12)).toBe(false) // one millionth past — unlawful
  })

  it('the whole-disc condition, not centre-point containment (EC-06)', () => {
    const o = ok(square)
    expect(supported([45, 0], o, 12)).toBe(false) // centre inside, disc not — fails
    expect(supported([0, 0], o, 12)).toBe(true)
  })

  it('G1: the longest side is the OUTLINE bounding box, not any image', () => {
    const o = ok(square)
    expect(o.longestSideMM).toBe(100)
    expect(o.bboxMM).toEqual({ x0: -50, y0: -50, x1: 50, y1: 50 })
  })
})

describe('§9 exact predicates — Pixel falsification fixtures: the float path must FAIL these', () => {
  it('orientation: collinear-looking triple where the double determinant is 0 and truth is +1', async () => {
    const { orientation } = await import('../solver/exact')
    const a: PointMM = [0, 0]
    const b: PointMM = [100000000, 99999999]
    const c: PointMM = [100000001, 100000000]
    // the naive double determinant of these is exactly 0 — proven below — so a float-only
    // implementation misclassifies. The filtered-exact path must say +1.
    const naive = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    expect(naive).toBe(0) // the trap is real
    expect(orientation(a, b, c)).toBe(1) // the exact layer is not fooled
  })

  it('tangency: exact distance² = R² is LAWFUL where Math.hypot under-reports', () => {
    // polygon and point chosen so the perpendicular offset is (0.5, 1.2): distance² = 1.69 = 1.3²
    // exactly, but Math.hypot(0.5, 1.2) = 1.2999999999999998 < 1.3 — a float clearance gate
    // falsely rejects a lawful tangency.
    const poly: PointMM[] = [
      [0, 0],
      [12, -5],
      [17, 7],
      [5, 12],
    ]
    const o = ok(poly)
    const q: PointMM = [6.5, -1.3]
    expect(Math.hypot(0.5, 1.2)).toBeLessThan(1.3) // the trap is real
    expect(supported(q, o, 1.3)).toBe(true) // the exact squared comparison is not fooled
  })
})
