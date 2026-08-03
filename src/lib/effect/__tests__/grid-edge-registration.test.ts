// EDGE-REGISTRATION LAW (Dan, 2026-07-28): within the LADDER DOMAIN, the same edge length produces
// the same layout. "The size is optimal when we follow square logic pretty much everywhere — magnets
// side to side along the edges, with margins encoded between magnet and edge of the effect."
//
// DOMAIN — this bounds every claim below. Dan, 2026-07-28: "rungs is the case of perfect match
// sizing of the effect surface is precisely covering magnets 4/6/8 etc that takes into account
// magnet outer margin and surface margin encoded by the system." A rung is therefore the size whose
// surface exactly wraps its magnet array plus both encoded margins. A NON-rung size has no
// zero-point, so asking whether it registers on one is a category error, not a failure. Rectangle
// snaps both axes to rungs (resolveRectangleRungs -> nextSemanticRung), so the product domain is
// the rung matrix and nothing else. Engine behaviour off-ladder is deliberately unpinned here and
// recorded in KAI-9793: 88 integer bands move. Every delivered anchor still obeys the hard floor.
//
// The grid box is NOT always square: it is whatever set of the density's 48/96 lattice nodes the
// shape hosts, chosen per axis. A square is the case where both axes agree. A rectangle's long edge
// must therefore
// register on its own zero-point exactly as the same-length square edge does.
//
// The engine already GENERATES the correct layout; before this law it lost the candidate ranking to
// an inset phase purely on the most-anchors tie-break. These tests pin the outcome, not the ranking
// internals, so a future re-implementation stays free as long as edges register.

import { describe, expect, it } from 'vitest'
import { DEFAULT_LAW, resolveGridPlan, semanticLadder, stdShapeContour } from '../grid'
import type { ResolvedGridPlan } from '../grid'

/** The zero-point inset every outermost anchor must sit at: the padding floor. */
const FLOOR_MM = DEFAULT_LAW.paddingMM

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

const BASE_OPTIONS = { mode: 'standard', baseMarginMM: 0, maxGrowMM: 0 } as const

describe('edge-registration law — every edge registers on its own zero-point', () => {
  it('registers a rectangle long edge exactly as the same-length square edge (164x68)', () => {
    const rect = resolveGridPlan(stdShapeContour('rect', 164, 68), {
      ...BASE_OPTIONS,
      density: 'standard',
    })
    const square = resolveGridPlan(stdShapeContour('square', 164, 164), {
      ...BASE_OPTIONS,
      density: 'standard',
    })

    // The square is the reference: 164 is a zero-point, so its edge anchors sit at the floor.
    const sq = axes(square)
    expect(sq.left).toBeCloseTo(FLOOR_MM, 3)
    expect(sq.right).toBeCloseTo(FLOOR_MM, 3)

    // The rectangle's 164 edge must do the same.
    const r = axes(rect)
    expect(r.left).toBeCloseTo(FLOOR_MM, 3)
    expect(r.right).toBeCloseTo(FLOOR_MM, 3)

    // The 68 edge is a zero-point too and already registered — it must stay that way.
    expect(r.top).toBeCloseTo(FLOOR_MM, 3)
    expect(r.bottom).toBeCloseTo(FLOOR_MM, 3)

    expect(registrationSlackMM(rect)).toBeCloseTo(0, 3)
  })

  it('leaves no dead border on any rung-by-rung rectangle', () => {
    // Standard/48 rung pairs traced in the design probe.
    const pairs: Array<[number, number]> = [
      [116, 68],
      [164, 68],
      [164, 116],
    ]
    for (const [longMM, shortMM] of pairs) {
      const plan = resolveGridPlan(stdShapeContour('rect', longMM, shortMM), {
        ...BASE_OPTIONS,
        density: 'standard',
      })
      expect(
        registrationSlackMM(plan),
        `${longMM}x${shortMM} leaves dead border: ${JSON.stringify(axes(plan))}`,
      ).toBeCloseTo(0, 3)
    }
  })

  it('keeps every density-specific square rung registered', () => {
    for (const density of ['standard', 'light'] as const) {
      const canon = semanticLadder(
        (sizeMM: number) => stdShapeContour('square', sizeMM),
        DEFAULT_LAW,
        'standard',
        { source: 'std', density },
      ).filter(({ points }) => points >= 2).map(({ sizeMM }) => sizeMM)
      for (const sizeMM of canon) {
        const plan = resolveGridPlan(stdShapeContour('square', sizeMM, sizeMM), {
          ...BASE_OPTIONS,
          density,
        })
        expect(
          registrationSlackMM(plan),
          `square ${sizeMM} (${density}) lost edge registration`,
        ).toBeCloseTo(0, 3)
      }
    }
  })

  it('still keeps Standard on one 48mm lattice population', () => {
    const plan = resolveGridPlan(stdShapeContour('rect', 164, 68), {
      ...BASE_OPTIONS,
      density: 'standard',
    })
    const { xs, ys } = axes(plan)
    expect(plan.grid.anchors.length).toBeGreaterThanOrEqual(2)
    for (const axis of [xs, ys]) {
      for (const v of axis) {
        const offset = Math.abs(v - axis[0])
        expect(offset % 48, `${v} is off the 48 lattice (offset ${offset})`).toBeCloseTo(0, 3)
      }
    }
  })

  it('registers both pinned rectangles on all four sides', () => {
    for (const [longMM, shortMM] of [[164, 68], [164, 116]] as Array<[number, number]>) {
      const plan = resolveGridPlan(stdShapeContour('rect', longMM, shortMM), {
        ...BASE_OPTIONS,
        density: 'standard',
      })
      expect(plan.grid.ok, `${longMM}x${shortMM} seats a lawful grid`).toBe(true)
      expect(
        registrationSlackMM(plan),
        `${longMM}x${shortMM} outermost anchors sit beyond the ${FLOOR_MM}mm zero-point`,
      ).toBeCloseTo(0, 3)
    }
  })

  it('registers EVERY reachable rectangle on all four sides — the whole rung matrix, executable', () => {
    // THE PROPERTY GATE. The pinned-cases test above records the blast radius; this one enforces the
    // law itself over the entire product domain, so the surrounding prose is checked rather than
    // asserted. Enumerates the live ladder (never a hardcoded rung list — if the ladder moves, this
    // moves with it), takes every ORDERED pair so both orientations are covered, and crosses it with
    // both densities. The executed denominator derives from the live catalogue.
    const unregistered: string[] = []
    let checked = 0
    let expected = 0
    for (const density of ['standard', 'light'] as const) {
      const sizes = semanticLadder(
        (sizeMM: number) => stdShapeContour('rect', sizeMM, sizeMM),
        DEFAULT_LAW,
        'standard',
        { source: 'std', density },
      ).map((rung) => rung.sizeMM)
      expected += sizes.length * (sizes.length - 1)
      for (const wMM of sizes) {
        for (const hMM of sizes) {
          if (wMM === hMM) continue // a square, not a rectangle — covered by the canon test above
          const plan = resolveGridPlan(stdShapeContour('rect', wMM, hMM), {
            ...BASE_OPTIONS,
            density,
          })
          const a = axes(plan)
          checked++
          const registered = [a.left, a.right, a.top, a.bottom].every((i) => i <= FLOOR_MM + 1e-6)
          if (!registered) unregistered.push(`${density} ${wMM}x${hMM} [${[a.left, a.right, a.top, a.bottom].map((v) => v.toFixed(1))}]`)
        }
      }
    }
    expect(checked).toBe(expected)
    expect(unregistered).toEqual([])
  })

  it('keeps a disc symmetric — the exact failure of the rejected summed-slack variant', () => {
    // A summed distance-to-the-floor term looked equivalent and scored PARTIAL registration. On shapes
    // whose material never reaches the bbox it bought edge contact on two sides by dropping anchors:
    // this case fell 8 -> 6 and went asymmetric (x on 35/83/131, y on 11/59/107/155) on a circle.
    // All-or-nothing keeps the axes tied, so symmetry survives. Exact outer-wrap coverage may select
    // a different symmetric pitch on this off-ladder diagnostic size; population is not the law here.
    // This fails loudly if the term is ever loosened back to a partial-credit, asymmetric score.
    const plan = resolveGridPlan(stdShapeContour('circle', 164, 164), {
      ...BASE_OPTIONS,
      density: 'light',
    })
    const { xs, ys } = axes(plan)
    expect(plan.grid.anchors.length).toBeGreaterThanOrEqual(4)
    expect(xs).toEqual(ys) // a disc has no preferred axis; asymmetry is the tell
  })
})
