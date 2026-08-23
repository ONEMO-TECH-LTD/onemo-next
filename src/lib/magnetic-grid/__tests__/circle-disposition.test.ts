import { describe, expect, it } from 'vitest'
import { getShape } from '../../shape-library'
import { makeSizer, normBaseContour } from '../../effect/magnetic-grid-bridge'
import { bbox, latticeAt, makeSeatPredicate } from '../compute/seat'
import { computeGrid } from '../engine'
import type { Pt } from '../spec'

/** The deleted analytic circle predicate, as it stood at 2c043257 (makeCircleSeatPredicate) — the "before". */
const analyticCircle = (cx: number, cy: number, R: number, r: number) => {
  const q = (v: number) => Math.round(v / 0.001)
  const slack = q(R) - q(r)
  if (slack < 0) return null
  const cqx = q(cx), cqy = q(cy), s2 = slack * slack
  return (pt: Pt) => { const dx = q(pt[0]) - cqx, dy = q(pt[1]) - cqy; return dx * dx + dy * dy <= s2 }
}

describe('circle preset disposition — the only intended Centre-path change (v3.5.3 fixture 1)', () => {
  it('seats identically under the supplied-segment predicate at every even size in B1–B4', () => {
    const base = normBaseContour(getShape('circle', 1024, 1024), 1024)!
    const sized = makeSizer(base, 0)
    const differing: string[] = []
    for (let mm = 24; mm <= 214; mm += 2) {
      const contour = sized(mm), bb = bbox(contour.outer.pts)
      const R = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2
      const before = analyticCircle((bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2, R, 12)!
      const after = makeSeatPredicate(contour.outer.pts, 12)!
      const grid = computeGrid(contour, { paddingMM: 12, flapMM: 0, wrapMode: 'fixed', centreMode: 0, perimeterOnly: true })
      const lattice = latticeAt(bb, 48, grid.phaseMM[0], grid.phaseMM[1])
      if (lattice.filter(before).length !== lattice.filter(after).length) differing.push(`${mm}`)
    }
    expect(differing).toEqual([])
  })
})
