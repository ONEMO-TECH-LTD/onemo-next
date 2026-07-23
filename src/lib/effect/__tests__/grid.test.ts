// Magnetic-grid intent tests: the engine owns final selection and remains portable into Creator flows.

import { describe, expect, it } from 'vitest'
import { computeAttachmentGrid } from '@/app/(dev)/effect-creator/v5.3.1/core/primitives'
import { pointInPolygon } from '../polygon'
import {
  computeGrid,
  contourWithOuterMargin,
  DEFAULT_LAW,
  finalProductSignature,
  nearestAnchorPair,
  nearestSemanticRung,
  resolveAdminGridPlan,
  resolveDesignSizeMM,
  resolveGridPlan,
  resolveRectangleRungs,
  scaleContour,
  semanticLadder,
  stdShapeContour,
} from '../grid-admin'
import {
  nearestUserSemanticRung,
  resolveUserPlan,
  semanticLadder as userSemanticLadder,
  standardShapeContour,
} from '../grid-user'
import type { Contour } from '../types'

const donut: Contour = {
  outer: { pts: [[0, 0], [214, 0], [214, 214], [0, 214]] },
  holes: [{ pts: [[70, 70], [144, 70], [144, 144], [70, 144]] }],
}

// A large pad-valid body plus a 22mm pad-valid lobe joined by a thin neck. The fixed lattice seats
// the body but misses the lobe entirely; the user law must add one local rescue anchor there.
const asymmetricDumbbell: Contour = {
  outer: { pts: [
    [0, 0], [100, 0], [100, 16], [130, 16], [130, 10], [152, 10],
    [152, 32], [130, 32], [130, 26], [100, 26], [100, 120], [0, 120],
  ] },
  holes: [],
}

describe('resolveGridPlan — production engine seam', () => {
  it('owns mode legality: Dice requested at 48 resolves to the legal 96 pitch', () => {
    const plan = resolveGridPlan(stdShapeContour('square', 166), {
      mode: 'quincunx', pitchMM: 48, density: 'standard', maxGrowMM: 0,
    })
    expect(plan.pitchMM).toBe(96)
    expect(plan.pattern).toBe('quincunx')
    expect(plan.grid.pitchCentreMM).toBe(96)
  })

  it('fails loud on a pitch outside the launch 48/96 family', () => {
    expect(() => computeGrid(stdShapeContour('square', 166), { pitchMM: 72 }))
      .toThrow('launch pitches are 48mm and 96mm')
  })

  it('keeps every anchor on real material, never inside a contour hole', () => {
    const plan = resolveGridPlan(donut, {
      mode: 'standard', pitchMM: 48, density: 'standard', maxGrowMM: 0,
    })
    expect(plan.grid.anchors.length).toBeGreaterThan(0)
    for (const anchor of plan.grid.anchors) {
      expect(pointInPolygon(anchor.p, donut.outer.pts)).toBe(true)
      expect(pointInPolygon(anchor.p, donut.holes[0].pts)).toBe(false)
    }
  })

  it('returns resolved measurements instead of requiring caller-side reconstruction', () => {
    const plan = resolveGridPlan(stdShapeContour('square', 118), {
      mode: 'auto', density: 'light', baseMarginMM: 0, maxGrowMM: 12,
    })
    expect([48, 96]).toContain(plan.pitchMM)
    expect(plan.resolvedMarginMM).toBe(plan.baseMarginMM + plan.grewMM)
    expect(plan.nearestAnchorMM).toBeGreaterThan(0)
    expect(plan.effectContourMM.outer.pts.length).toBeGreaterThanOrEqual(3)
  })

  it('is exposed to v5.3.1 as one flow-blind primitive', async () => {
    const plan = await computeAttachmentGrid(stdShapeContour('circle', 118), {
      attachment: 'magnetic',
    })
    expect(plan.grid.attachment).toBe('magnetic')
    expect([48, 96]).toContain(plan.pitchMM)
  })

  it('keeps Dice admin-only while user auto stays perimeter-first on the reported large shapes', () => {
    for (const [shape, sizeMM, pitchMM, seated, rescues] of [
      ['circle', 303, 48, 16, 8],
      ['diamondShape', 310, 96, 12, 6],
    ] as const) {
      const contour = stdShapeContour(shape, sizeMM)
      const user = resolveUserPlan(contour, { attachment: 'magnetic' })
      const adminDice = resolveGridPlan(contour, {
        mode: 'quincunx', density: 'light', maxGrowMM: 12,
      })

      expect(user.pattern).toBe('standard')
      expect(user.pitchMM).toBe(pitchMM)
      expect(user.grid.anchors).toHaveLength(seated)
      expect(user.grid.rescueAnchors).toHaveLength(rescues)
      expect(user.grid.flaps).toHaveLength(0)
      expect(user.grid.anchors.length).toBeLessThan(adminDice.grid.anchors.length)
      expect(adminDice.pattern).toBe('quincunx')
      expect(adminDice.pitchMM).toBe(96)
      expect(adminDice.grid.rescueAnchors).toEqual([])
    }
  })

  it('adds a minimum local rescue when a safe lobe has no lattice anchor', () => {
    const plan = resolveUserPlan(asymmetricDumbbell, { attachment: 'magnetic' })

    expect(plan.grid.rescueAnchors).toHaveLength(1)
    expect(plan.grid.rescueAnchors[0][0]).toBeGreaterThanOrEqual(130)
    expect(plan.grid.flaps).toHaveLength(0)
    for (let i = 0; i < plan.grid.anchors.length; i++) for (let j = i + 1; j < plan.grid.anchors.length; j++) {
      expect(Math.hypot(
        plan.grid.anchors[i].p[0] - plan.grid.anchors[j].p[0],
        plan.grid.anchors[i].p[1] - plan.grid.anchors[j].p[1],
      )).toBeGreaterThanOrEqual(2 * plan.grid.applicationPadMM - 1e-6)
    }
  })

  it('keeps an honest red verdict when no safe rescue point exists', () => {
    const tooThinFrame: Contour = {
      outer: { pts: [[0, 0], [100, 0], [100, 100], [0, 100]] },
      holes: [{ pts: [[5, 5], [95, 5], [95, 95], [5, 95]] }],
    }
    const plan = resolveUserPlan(tooThinFrame, { attachment: 'magnetic' })

    expect(plan.grid.rescueAnchors).toEqual([])
    expect(plan.grid.ok).toBe(false)
    expect(plan.grid.issues.join(' ')).toContain('No room for a magnet')
  })
})

describe('engine-owned workbench selections', () => {
  const rungs = [
    { label: 'ONE', points: 1, sizeMM: 22, visible: true },
    { label: 'S', points: 2, sizeMM: 70, visible: true },
    { label: 'M', points: 4, sizeMM: 118, visible: true },
  ]

  it('preserves the existing Admin-up and User-first exact-tie policies without blending them', () => {
    expect(nearestSemanticRung(rungs, 94).sizeMM).toBe(118)
    expect(nearestUserSemanticRung(rungs, 94).sizeMM).toBe(70)
  })

  it('owns rectangle option legality, fallback, and orientation', () => {
    const landscape = resolveRectangleRungs(rungs, {
      longMM: 94,
      shortMM: 46,
      orientation: 'landscape',
    })
    expect(landscape.longOptions.map((rung) => rung.sizeMM)).toEqual([70, 118])
    expect(landscape.shortOptions.map((rung) => rung.sizeMM)).toEqual([22, 70])
    expect(landscape.longRung.sizeMM).toBe(118)
    expect(landscape.shortRung.sizeMM).toBe(70)
    expect([landscape.widthRung.sizeMM, landscape.heightRung.sizeMM]).toEqual([118, 70])

    const portrait = resolveRectangleRungs(rungs, {
      longMM: 94,
      shortMM: 46,
      orientation: 'portrait',
    })
    expect([portrait.widthRung.sizeMM, portrait.heightRung.sizeMM]).toEqual([70, 118])

    const one = resolveRectangleRungs(rungs, {
      longMM: 22,
      shortMM: 22,
      orientation: 'landscape',
    })
    expect(one.shortOptions).toEqual([])
    expect(one.shortRung).toBe(one.longRung)
  })

  it('returns one deterministic nearest-anchor pair and feeds the plan distance from it', () => {
    expect(nearestAnchorPair([])).toBeNull()
    expect(nearestAnchorPair([{ p: [0, 0], dia: 6 }])).toBeNull()

    const anchors = [
      { p: [0, 0] as [number, number], dia: 6 as const },
      { p: [10, 0] as [number, number], dia: 6 as const },
      { p: [0, 10] as [number, number], dia: 6 as const },
    ]
    const pair = nearestAnchorPair(anchors)
    expect(pair).toMatchObject({ firstIndex: 0, secondIndex: 1, distanceMM: 10 })

    const plan = resolveGridPlan(stdShapeContour('square', 118), {
      mode: 'standard',
      pitchMM: 48,
      density: 'standard',
      maxGrowMM: 0,
    })
    expect(plan.nearestAnchorMM).toBe(nearestAnchorPair(plan.grid.anchors)?.distanceMM)
  })

  it('owns source size bounds, including the dynamic padding floor', () => {
    expect(resolveDesignSizeMM(999, 'std')).toBe(DEFAULT_LAW.maxRungMM)
    expect(resolveDesignSizeMM(999, 'preset')).toBe(DEFAULT_LAW.maxRungMM)
    expect(resolveDesignSizeMM(999, 'gen')).toBe(180)
    expect(resolveDesignSizeMM(999, 'magic')).toBe(180)
    expect(resolveDesignSizeMM(1, 'std', { ...DEFAULT_LAW, paddingMM: 20 })).toBe(42)
  })

  it('preserves signed-offset and Velcro diagnostics only through the Admin entry', () => {
    const contour = stdShapeContour('square', 70)
    const signed = resolveAdminGridPlan(contour, {
      attachment: 'magnetic',
      density: 'light',
      baseMarginMM: -15,
      maxGrowMM: 12,
    })
    expect({
      pitch: signed.pitchMM,
      pattern: signed.pattern,
      margin: signed.resolvedMarginMM,
      anchors: signed.grid.anchors.length,
    }).toEqual({ pitch: 48, pattern: 'diamond', margin: -15, anchors: 1 })

    const adminVelcro = resolveAdminGridPlan(contour, {
      attachment: 'velcro',
      density: 'light',
      baseMarginMM: 0,
      maxGrowMM: 12,
    })
    expect({
      pitch: adminVelcro.pitchMM,
      pattern: adminVelcro.pattern,
      gridPitch: adminVelcro.grid.pitchCentreMM,
      anchors: adminVelcro.grid.anchors.length,
    }).toEqual({ pitch: 48, pattern: 'diamond', gridPitch: 0, anchors: 0 })

    const productVelcro = resolveGridPlan(contour, {
      attachment: 'velcro',
      density: 'light',
      baseMarginMM: -15,
      maxGrowMM: 12,
    })
    expect({
      pitch: productVelcro.pitchMM,
      pattern: productVelcro.pattern,
      margin: productVelcro.resolvedMarginMM,
    }).toEqual({ pitch: 0, pattern: null, margin: 0 })
  })
})

describe('contour transforms preserve the declared Contour contract', () => {
  it('scales holes with the outer ring', () => {
    const scaled = scaleContour(donut, 0.5)
    expect(scaled.holes).toHaveLength(1)
    expect(scaled.holes[0].pts[0]).toEqual([35, 35])
    expect(scaled.holes[0].pts[2]).toEqual([72, 72])
  })

  it('keeps interior cut-outs when adding an outer attachment margin', () => {
    const expanded = contourWithOuterMargin(donut, 12)
    expect(expanded.holes).toEqual(donut.holes)
    expect(expanded.outer.pts).not.toEqual(donut.outer.pts)
  })
})

describe('semantic ladder stays inside its product contract', () => {
  it('keeps the Create-page standard contour facade identical to the audited canonical recipe', () => {
    for (const shape of ['square', 'circle', 'diamondShape', 'triangle'] as const) {
      expect(standardShapeContour(shape, 180)).toEqual(stdShapeContour(shape, 180))
    }
  })

  it('keeps every legal circle rung even when its sequential labels continue past 3XL', () => {
    const auto = semanticLadder((sizeMM) => stdShapeContour('circle', sizeMM), DEFAULT_LAW, 'auto')
    const standard = semanticLadder((sizeMM) => stdShapeContour('circle', sizeMM), DEFAULT_LAW, 'standard')

    expect(auto.filter((rung) => rung.label !== 'ONE')).toHaveLength(8)
    expect(standard.filter((rung) => rung.label !== 'ONE')).toHaveLength(7)
    expect(auto.map((rung) => rung.label)).toEqual(['ONE', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'])
    expect(standard.at(-1)?.label).toBe('4XL')
  })

  it('uses the configured size ceiling, not label exhaustion, as the terminal gate', () => {
    for (const shape of ['circle', 'triangle', 'diamondShape'] as const) {
      const ladder = semanticLadder((sizeMM) => stdShapeContour(shape, sizeMM))
      expect(ladder.every((rung) => rung.sizeMM <= DEFAULT_LAW.maxRungMM)).toBe(true)
    }
  })

  it('deduplicates the circle by constrained final product and keeps the smallest equivalent rung', () => {
    const makeCircle = (sizeMM: number) => standardShapeContour('circle', sizeMM)
    const ladder = userSemanticLadder(makeCircle)

    expect(ladder.map((rung) => rung.sizeMM)).toEqual([23, 71, 90, 130, 158, 221, 303])
    expect(ladder.some((rung) => rung.sizeMM === 215)).toBe(false)
    expect(ladder.some((rung) => rung.sizeMM === 226)).toBe(false)
    for (const rung of ladder) {
      const product = resolveUserPlan(makeCircle(rung.sizeMM), { attachment: 'magnetic' })
      expect(rung.points).toBe(product.grid.anchors.length)
    }
  })

  it('signs final products by topology, independent of contour translation', () => {
    const shiftedCircle = (sizeMM: number, dx: number, dy: number): Contour => {
      const contour = stdShapeContour('circle', sizeMM)
      return {
        outer: { pts: contour.outer.pts.map(([x, y]) => [x + dx, y + dy]) },
        holes: [],
      }
    }
    const plan221 = resolveUserPlan(stdShapeContour('circle', 221), { attachment: 'magnetic' })
    const shifted221 = resolveUserPlan(shiftedCircle(221, 337, -125), { attachment: 'magnetic' })
    const plan226 = resolveUserPlan(stdShapeContour('circle', 226), { attachment: 'magnetic' })
    const plan215 = resolveUserPlan(stdShapeContour('circle', 215), { attachment: 'magnetic' })

    expect(finalProductSignature(shifted221)).toBe(finalProductSignature(plan221))
    expect(finalProductSignature(plan226)).toBe(finalProductSignature(plan221))
    expect(finalProductSignature(plan215)).not.toBe(finalProductSignature(plan221))
  })
})
