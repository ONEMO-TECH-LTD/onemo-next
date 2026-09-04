// path-centre-production.test.ts — THE EXACT CENTRE REACHES THE DECISION, not just the primitive.
//
// QA @707b6fda F7: path.test.ts proves pathAreaCentroidMM; nothing proved the engine's Weight centre
// actually USES it. This gives a real asymmetric cubic preset to the real door (contourFromShape), then
// to the real engine under Weight centring, and asserts the centre the engine commits to is the exact
// path centroid — and is NOT the centroid of the 0.05mm point view it would have used before.

import { describe, expect, it } from 'vitest'
import { unitShape } from '@/lib/shape-library/defs'
import { transformShape } from '@/lib/vector-core'
import { contourFromShape } from '../geometry-truth'
import { contourAreaCentroidMM } from '../foundation/geometry'
import { computeGrid } from '../grid-magnet'
import { contourCacheKey, makeSizer, normBaseContour } from '../grid-magnet-bridge'
import { anchorFnFor, solveGrid } from '../pipeline/solve'
import type { Contour, GridConfig, Pt } from '../types'

/** The centroid the engine used to take: shoelace over the flattened point view. */
function viewCentroid(contour: Contour): Pt {
  const pts = contour.outer.pts
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]
    const w = x0 * y1 - x1 * y0
    a += w; cx += (x0 + x1) * w; cy += (y0 + y1) * w
  }
  return [cx / (3 * a), cy / (3 * a)]
}

/** A real preset — the teardrop is twelve cubics and has no axis of symmetry in y — placed in a
 *  600px box the way the editor places one, then through the manufacturing door at 0.4mm/px. */
function teardropContour(): Contour {
  const unit = unitShape('teardrop')
  const placed = transformShape(unit, (v) => ({ x: 300 + v.x * 280, y: 300 + v.y * 280 }))
  const contour = contourFromShape(placed, { mmPerPx: 0.4, maskHeightPx: 600 })
  if (!contour) throw new Error('teardrop did not produce a contour')
  return contour
}

describe('the Weight centre is the exact path centroid', () => {
  const contour = teardropContour()
  const exact = contourAreaCentroidMM(contour).centroid
  const view = viewCentroid(contour)

  it('the door hands the engine a path, and the exact centroid differs from the view centroid', () => {
    expect(contour.outer.path).toBeDefined()
    expect(contour.outer.path!.segs.some((s) => s.kind === 'cubic')).toBe(true)
    // if these did not differ the test could not tell which one the engine used
    expect(Math.hypot(exact[0] - view[0], exact[1] - view[1])).toBeGreaterThan(1e-6)
  })

  it('Grid Core under Weight centring commits to the exact centroid, not the view centroid', () => {
    const grid = computeGrid(contour, { pitchMM: 48, paddingMM: 12, centreMode: 3 })
    const used = grid.centresMM[0]
    expect(Math.hypot(used[0] - exact[0], used[1] - exact[1])).toBeLessThan(1e-9)
    expect(Math.hypot(used[0] - view[0], used[1] - view[1])).toBeGreaterThan(1e-6)
  })

  it('mutation: a contour stripped of its path falls back to the view centroid — so the path is what decides', () => {
    const stripped: Contour = { outer: { pts: contour.outer.pts }, holes: [] }
    const grid = computeGrid(stripped, { pitchMM: 48, paddingMM: 12, centreMode: 3 })
    const used = grid.centresMM[0]
    expect(Math.hypot(used[0] - view[0], used[1] - view[1])).toBeLessThan(1e-9)
    expect(Math.hypot(used[0] - exact[0], used[1] - exact[1])).toBeGreaterThan(1e-6)
  })

  it('the headless pipeline (solveGrid) under Weight centring commits to the exact centroid of the shape it solved', () => {
    // the real request the bench and Studio make: a normalised base, sized and solved by the pipeline
    const unit = unitShape('teardrop')
    const placed = transformShape(unit, (v) => ({ x: 300 + v.x * 280, y: 300 + v.y * 280 }))
    const base = normBaseContour(placed, 600)
    if (!base) throw new Error('teardrop did not normalise')
    expect(base.outer.path, 'the path must survive normalisation').toBeDefined()
    const cfg: GridConfig = { pitchMM: 48, paddingMM: 12, centreMode: 3, governor: 0, perimeterOnly: false }
    const solve = solveGrid({ base, offsetMM: 0, cfg, mode: 3, sizeMM: 0, stepSel: null, settings: { protectionPaddingMM: 24 } })
    expect(solve.contour.outer.path, 'the path must survive sizing into the solved contour').toBeDefined()
    // The pipeline's own anchor function IS the exact centroid, at any size, to 1e-12:
    const sized = makeSizer(base, 0)
    const anchorAt = anchorFnFor(sized, cfg, JSON.stringify(cfg), 'shape')
    const exactAtEff = contourAreaCentroidMM(sized(solve.effSize)).centroid
    const fnAtEff = anchorAt(solve.effSize)
    expect(Math.hypot(fnAtEff[0] - exactAtEff[0], fnAtEff[1] - exactAtEff[1])).toBeLessThan(1e-9)
    // The centre the solve COMMITTED to is the exact centroid OF THE CONTOUR IT PUBLISHED — equality,
    // not direction. It used to be 2.9um off: the ladder drew the contour at the rung's snapped size but
    // carried the centre the search used at its exact contact size (QA @ca147429 F8). Now what is drawn
    // takes the anchor for the size it is drawn at. Mutation: restore `anchorMM: at.anchorMM` in
    // pipeline/solve.ts and this fails.
    const used = solve.grid.centresMM[0]
    const solvedExact = contourAreaCentroidMM(solve.contour).centroid
    const solvedView = viewCentroid(solve.contour)
    expect(Math.hypot(used[0] - solvedExact[0], used[1] - solvedExact[1])).toBeLessThan(1e-9)
    expect(Math.hypot(used[0] - solvedView[0], used[1] - solvedView[1])).toBeGreaterThan(1e-6)
  })
})

describe('the solve cache keys on the path, not the view', () => {
  // QA @ef57810a F9: two shapes with the same flattened points but different curves shared a bake and
  // could reuse each other's rungs and centre. The key is the whole ring, path included.
  const pts: Pt[] = [[0, 0], [100, 0], [100, 100], [0, 100]]
  const withCubic = (c1: Pt): Contour => ({
    outer: { pts, path: { start: [0, 0], segs: [{ kind: 'cubic', to: [100, 0], c1, c2: [70, 10] }, { kind: 'line', to: [100, 100] }, { kind: 'line', to: [0, 100] }, { kind: 'line', to: [0, 0] }] } },
    holes: [],
  })
  const withArc = (ccw: boolean): Contour => ({
    outer: { pts, path: { start: [0, 0], segs: [{ kind: 'arc', to: [100, 0], centre: [50, 0], ccw }, { kind: 'line', to: [100, 100] }, { kind: 'line', to: [0, 100] }, { kind: 'line', to: [0, 0] }] } },
    holes: [],
  })

  it('a different cubic handle, same points, is a different key', () => {
    expect(contourCacheKey(withCubic([30, 10]), 0)).not.toBe(contourCacheKey(withCubic([30, -10]), 0))
  })
  it('a different arc direction, same points, is a different key', () => {
    expect(contourCacheKey(withArc(true), 0)).not.toBe(contourCacheKey(withArc(false), 0))
  })
  it('an identical path, deep-copied, is the same key — the key is the data, not the object', () => {
    const a = withCubic([30, 10])
    const b = JSON.parse(JSON.stringify(a)) as Contour
    expect(contourCacheKey(a, 0)).toBe(contourCacheKey(b, 0))
  })
  it('mutation: a key built from points alone cannot tell the two curves apart', () => {
    const pointsOnly = (c: Contour) => JSON.stringify([0, c.outer.pts, c.holes.map((h) => h.pts)])
    expect(pointsOnly(withCubic([30, 10]))).toBe(pointsOnly(withCubic([30, -10])))
  })
})
