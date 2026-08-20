// R14 §7.3: certified pruning changes cost only — the surviving certificates must be identical to
// the ones a full scan produces. The arrangement now prunes twice: element pairs whose generating
// features are more than 2r apart cannot share a point at clearance r, and validity is measured
// over the indexed neighbourhood that can hold a nearer feature. Both are switched off here and the
// pruned construction is compared against the naive one — every loop, piece, vertex, orientation and
// refusal reason — on shapes chosen for what they can break: a plain square, a hole (inner loop), an
// oblique shape (irrational edge lengths), a translated one (negative coordinates), the dumbbell
// (two islands through a neck), and a concave staircase whose short edges are exactly the case the
// old radius-widened extent test made quadratic.

import { afterEach, describe, expect, it } from 'vitest'
import { exactContour, toUnits } from '../compute/clearance'
import { exactRegions } from '../compute/region'
import { offsetArrangement, offsetPruning } from '../compute/offset'
import type { Contour, Pt } from '../spec'

const rect = (w: number, h: number): Contour => ({ outer: { pts: [[0, 0], [w, 0], [w, h], [0, h]] }, holes: [] })

/** A concave staircase: many short edges and reflex corners, the dense-trace case in miniature. */
const staircase = (steps = 9, run = 8, rise = 8): Contour => {
  const pts: Pt[] = [[0, 0]]
  for (let i = 0; i < steps; i++) { pts.push([(i + 1) * run, i * rise]); pts.push([(i + 1) * run, (i + 1) * rise]) }
  pts.push([0, steps * rise])
  return { outer: { pts }, holes: [] }
}

const SHAPES: ReadonlyArray<{ id: string; contour: Contour }> = [
  { id: 'square', contour: rect(72, 72) },
  { id: 'wide', contour: rect(96, 48) },
  { id: 'holed', contour: { ...rect(100, 100), holes: [{ pts: [[40, 40], [60, 40], [60, 60], [40, 60]] }] } },
  { id: 'oblique', contour: { outer: { pts: [[0, 0], [80, 10], [70, 65], [5, 50]] }, holes: [] } },
  { id: 'translated', contour: { outer: { pts: [[-130, -80], [-30, -80], [-30, 20], [-130, 20]] }, holes: [{ pts: [[-90, -40], [-70, -40], [-70, -20], [-90, -20]] }] } },
  { id: 'dumbbell', contour: { outer: { pts: [[0, 0], [60, 0], [60, 25], [100, 25], [100, 0], [160, 0], [160, 60], [100, 60], [100, 35], [60, 35], [60, 60], [0, 60]] }, holes: [] } },
  { id: 'L-shape', contour: { outer: { pts: [[0, 0], [90, 0], [90, 40], [40, 40], [40, 90], [0, 90]] }, holes: [] } },
  { id: 'staircase', contour: staircase() },
]

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? `${v}n` : v))

function bothModes<T>(work: () => T): { full: T; pruned: T } {
  try {
    offsetPruning(false)
    const full = work()
    offsetPruning(true)
    return { full, pruned: work() }
  } finally {
    offsetPruning(true) // a throw in either mode must not leave the module unpruned
  }
}

describe('certified pruning is cost-only (R14 §7.3)', () => {
  // a thrown assertion must never leave the module running unpruned for later suites
  afterEach(() => offsetPruning(true))

  it('builds byte-identical arrangements pruned and full-scan', () => {
    for (const shape of SHAPES) {
      const build = () => {
        const c = exactContour(shape.contour)
        return offsetArrangement(c, toUnits(12, c))
      }
      const { full, pruned } = bothModes(build)
      expect(canonical(pruned), shape.id).toBe(canonical(full))
      expect(pruned.unresolved, `${shape.id} unresolved`).toBe(false)
    }
  }, 300_000)

  it('produces identical regions — areas, centroids, holes and orientation', () => {
    for (const shape of SHAPES) {
      const solve = () => {
        const c = exactContour(shape.contour)
        const ru = toUnits(12, c)
        return exactRegions(c, ru).regions.map((r) => ({
          area: r.areaMM2, centroid: r.centroidMM, holes: r.holes.length, pieces: r.outer.pieces.length,
        }))
      }
      const { full, pruned } = bothModes(solve)
      expect(canonical(pruned), shape.id).toBe(canonical(full))
    }
  }, 300_000)
})
