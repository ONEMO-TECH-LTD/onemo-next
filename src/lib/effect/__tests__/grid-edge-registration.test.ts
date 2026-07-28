// EDGE-REGISTRATION LAW (Dan, 2026-07-28): the same edge length must produce the same layout on
// every shape. "The size is optimal when we follow square logic pretty much everywhere — magnets
// side to side along the edges, with margins encoded between magnet and edge of the effect."
//
// The grid box is NOT always square: it is whatever set of 48-lattice nodes the shape hosts, chosen
// per axis. A square is the case where both axes agree. A rectangle's long edge must therefore
// register on its own zero-point exactly as the same-length square edge does.
//
// The engine already GENERATES the correct layout; before this law it lost the candidate ranking to
// an inset phase purely on the most-anchors tie-break. These tests pin the outcome, not the ranking
// internals, so a future re-implementation stays free as long as edges register.

import { describe, expect, it } from 'vitest'
import { DEFAULT_LAW, resolveGridPlan, stdShapeContour } from '../grid'
import type { ResolvedGridPlan } from '../grid'

/** The zero-point inset every outermost anchor must sit at: padding floor + frame. */
const FLOOR_MM = DEFAULT_LAW.paddingMM + DEFAULT_LAW.frameMM // 11

function axes(plan: ResolvedGridPlan) {
  const pts = plan.effectContourMM.outer.pts
  const minX = Math.min(...pts.map((p) => p[0]))
  const maxX = Math.max(...pts.map((p) => p[0]))
  const minY = Math.min(...pts.map((p) => p[1]))
  const maxY = Math.max(...pts.map((p) => p[1]))
  const xs = [...new Set(plan.grid.anchors.map((a) => Number(a.p[0].toFixed(3))))].sort((a, b) => a - b)
  const ys = [...new Set(plan.grid.anchors.map((a) => Number(a.p[1].toFixed(3))))].sort((a, b) => a - b)
  return {
    xs,
    ys,
    left: xs[0] - minX,
    right: maxX - xs[xs.length - 1],
    top: ys[0] - minY,
    bottom: maxY - ys[ys.length - 1],
  }
}

/** Sum of how far each side's outermost anchor sits BEYOND the floor. Zero = fully registered. */
function registrationSlackMM(plan: ResolvedGridPlan): number {
  const a = axes(plan)
  return [a.left, a.right, a.top, a.bottom].reduce(
    (sum, inset) => sum + Math.max(0, inset - FLOOR_MM),
    0,
  )
}

const LIGHT = { mode: 'auto', density: 'light', baseMarginMM: 0, maxGrowMM: 0 } as const

describe('edge-registration law — every edge registers on its own zero-point', () => {
  it('registers a rectangle long edge exactly as the same-length square edge (214x70)', () => {
    const rect = resolveGridPlan(stdShapeContour('rect', 214, 70), LIGHT)
    const square = resolveGridPlan(stdShapeContour('square', 214, 214), LIGHT)

    // The square is the reference: 214 is a zero-point, so its edge anchors sit at the floor.
    const sq = axes(square)
    expect(sq.left).toBeCloseTo(FLOOR_MM, 3)
    expect(sq.right).toBeCloseTo(FLOOR_MM, 3)

    // The rectangle's 214 edge must do the same. Before the law it sat 35mm inboard.
    const r = axes(rect)
    expect(r.left).toBeCloseTo(FLOOR_MM, 3)
    expect(r.right).toBeCloseTo(FLOOR_MM, 3)

    // The 70 edge is a zero-point too and already registered — it must stay that way.
    expect(r.top).toBeCloseTo(FLOOR_MM, 3)
    expect(r.bottom).toBeCloseTo(FLOOR_MM, 3)

    expect(registrationSlackMM(rect)).toBeCloseTo(0, 3)
  })

  it('leaves no dead border on any rung-by-rung rectangle', () => {
    // Every pairing traced in the design probe. Mixed 48/96-family pairs are the interesting ones.
    const pairs: Array<[number, number]> = [
      [214, 70],
      [214, 118],
      [310, 70],
      [310, 118],
      [214, 166],
    ]
    for (const [longMM, shortMM] of pairs) {
      const plan = resolveGridPlan(stdShapeContour('rect', longMM, shortMM), LIGHT)
      expect(
        registrationSlackMM(plan),
        `${longMM}x${shortMM} leaves dead border: ${JSON.stringify(axes(plan))}`,
      ).toBeCloseTo(0, 3)
    }
  })

  it('keeps every canon square registered and byte-identical in layout', () => {
    // The guard that proves the law changed nothing it should not: squares already register, so
    // their anchor sets must be untouched by the new ranking term.
    const canon = [70, 118, 166, 214, 262, 310]
    for (const sizeMM of canon) {
      for (const density of ['light', 'standard'] as const) {
        const plan = resolveGridPlan(stdShapeContour('square', sizeMM, sizeMM), {
          ...LIGHT,
          density,
        })
        expect(
          registrationSlackMM(plan),
          `square ${sizeMM} (${density}) lost edge registration`,
        ).toBeCloseTo(0, 3)
      }
    }
  })

  it('still reduces every multi-anchor layout to one 48-lattice population', () => {
    // Dan: "the grid box must always be 48 lattice — that is the law." Registration must never buy
    // edge contact by moving a node off the lattice.
    const plan = resolveGridPlan(stdShapeContour('rect', 214, 70), LIGHT)
    const { xs, ys } = axes(plan)
    expect(plan.grid.anchors.length).toBeGreaterThanOrEqual(2)
    for (const axis of [xs, ys]) {
      for (const v of axis) {
        const offset = Math.abs(v - axis[0])
        expect(offset % 48, `${v} is off the 48 lattice (offset ${offset})`).toBeCloseTo(0, 3)
      }
    }
  })

  it('does not trade coverage for registration', () => {
    // Registration ranks AFTER coverage: a registered layout that flaps must never beat a covered one.
    for (const [longMM, shortMM] of [[214, 70], [310, 118]] as Array<[number, number]>) {
      const plan = resolveGridPlan(stdShapeContour('rect', longMM, shortMM), LIGHT)
      expect(plan.grid.flaps.length, `${longMM}x${shortMM} flaps`).toBe(0)
      expect(plan.grid.ok).toBe(true)
    }
  })

  it('pins the COMPLETE set of layouts this law moves — exactly two', () => {
    // Measured against pre-law staging by swapping the engine file, not by stashing (a stash after
    // commit is a silent no-op and is how the blast radius was first undercounted as one case).
    // Both are light density and both are the same 35mm -> 11mm correction.
    const moved: Array<[number, number, number, number[]]> = [
      [214, 70, 6, [11, 107, 203]],
      [214, 166, 10, [11, 107, 203]],
    ]
    for (const [longMM, shortMM, anchors, cols] of moved) {
      const plan = resolveGridPlan(stdShapeContour('rect', longMM, shortMM), LIGHT)
      expect(plan.grid.anchors.length, `${longMM}x${shortMM} anchor count`).toBe(anchors)
      expect(axes(plan).xs, `${longMM}x${shortMM} columns`).toEqual(cols)
    }
    // Unmoved neighbours, pinned so the set cannot silently widen.
    for (const [longMM, shortMM, anchors] of [[310, 70, 8], [310, 118, 8], [214, 118, 6]] as Array<
      [number, number, number]
    >) {
      const plan = resolveGridPlan(stdShapeContour('rect', longMM, shortMM), LIGHT)
      expect(plan.grid.anchors.length, `${longMM}x${shortMM} must be unchanged`).toBe(anchors)
    }
  })

  it('keeps a disc symmetric — the exact failure of the rejected summed-slack variant', () => {
    // A summed distance-to-the-floor term looked equivalent and scored PARTIAL registration. On shapes
    // whose material never reaches the bbox it bought edge contact on two sides by dropping anchors:
    // this case fell 8 -> 6 and went asymmetric (x on 35/83/131, y on 11/59/107/155) on a circle.
    // All-or-nothing leaves it tied, so the pre-existing ranking decides and symmetry survives.
    // This is the regression guard for that mistake — it fails loudly if the term is ever loosened
    // back to a partial-credit score.
    const plan = resolveGridPlan(stdShapeContour('circle', 166, 166), LIGHT)
    const { xs, ys } = axes(plan)
    expect(plan.grid.anchors.length).toBe(8)
    expect(xs).toEqual(ys) // a disc has no preferred axis; asymmetry is the tell
  })
})
