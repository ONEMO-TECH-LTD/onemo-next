import { describe, expect, it } from 'vitest'
import { getShape } from '../../shape-library'
import { makeSizer, normBaseContour } from '../../effect/magnetic-grid-bridge'
import { bbox, latticeAt, makeSeatPredicate, measureCentrePlacements } from '../compute/seat'
import { computeGrid } from '../engine'
import { centrePhaseCandidates, chooseCentrePlacement } from '../logic'
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
  it('records the exact analytic-to-supplied-segment disposition at every even size in B1–B4', () => {
    const base = normBaseContour(getShape('circle', 1024, 1024), 1024)!
    const sized = makeSizer(base, 0)
    const candidateDifferences: number[] = []
    const selectionDifferences: Array<{
      sizeMM: number
      before: { phaseMM: Pt; seated: number } | null
      after: { phaseMM: Pt; seated: number } | null
    }> = []
    const anchorDifferences: Array<{ sizeMM: number; before: number; after: number }> = []
    for (let mm = 24; mm <= 214; mm += 2) {
      const contour = sized(mm), bb = bbox(contour.outer.pts)
      const R = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2
      const before = analyticCircle((bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2, R, 12)!
      const after = makeSeatPredicate(contour.outer.pts, 12)!
      const target: Pt = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
      const candidates = centrePhaseCandidates(target, bb, 48)
      let candidateDiffers = false
      for (const candidate of candidates) {
        const lattice = latticeAt(bb, 48, candidate.phaseMM[0], candidate.phaseMM[1])
        if (JSON.stringify(lattice.filter(after)) !== JSON.stringify(lattice.filter(before))) candidateDiffers = true
      }
      if (candidateDiffers) candidateDifferences.push(mm)
      const beforeBest = chooseCentrePlacement(measureCentrePlacements(bb, 48, candidates, before, contour.outer.pts, 12))
      const afterBest = chooseCentrePlacement(measureCentrePlacements(bb, 48, candidates, after, contour.outer.pts, 12))
      if (JSON.stringify(afterBest) !== JSON.stringify(beforeBest)) {
        selectionDifferences.push({
          sizeMM: mm,
          before: beforeBest ? { phaseMM: beforeBest.phaseMM, seated: beforeBest.seated.length } : null,
          after: afterBest ? { phaseMM: afterBest.phaseMM, seated: afterBest.seated.length } : null,
        })
      }
      const grid = computeGrid(contour, mm, { paddingMM: 12, flapMM: 0, wrapMode: 'fixed', centreMode: 0, perimeterOnly: true })
      expect(grid.phaseMM, `live phase at ${mm}mm`).toEqual(afterBest?.phaseMM ?? [0, 0])
      const beforeGrid = computeGrid(contour, mm, { paddingMM: 12, flapMM: 0, wrapMode: 'fixed', centreMode: 0, perimeterOnly: true, forcePhaseMM: beforeBest?.phaseMM ?? [0, 0] })
      if (JSON.stringify(beforeGrid.anchors) !== JSON.stringify(grid.anchors)) {
        anchorDifferences.push({ sizeMM: mm, before: beforeGrid.anchors.length, after: grid.anchors.length })
      }
    }
    expect(candidateDifferences).toEqual([24, 72, 120, 168])
    expect(selectionDifferences).toEqual([
      { sizeMM: 24, before: { phaseMM: [12, 12], seated: 1 }, after: null },
      { sizeMM: 72, before: { phaseMM: [36, 12], seated: 2 }, after: { phaseMM: [36, 36], seated: 1 } },
      { sizeMM: 120, before: { phaseMM: [12, 12], seated: 5 }, after: { phaseMM: [36, 36], seated: 4 } },
    ])
    expect(anchorDifferences).toEqual([
      { sizeMM: 24, before: 1, after: 0 },
      { sizeMM: 72, before: 2, after: 1 },
      { sizeMM: 120, before: 4, after: 4 },
    ])
  })
})
