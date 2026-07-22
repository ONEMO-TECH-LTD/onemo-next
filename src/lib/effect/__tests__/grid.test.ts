// Magnetic-grid intent tests: the engine owns final selection and remains portable into Creator flows.

import { describe, expect, it } from 'vitest'
import { computeAttachmentGrid } from '@/app/(dev)/effect-creator/v5.3.1/core/primitives'
import { pointInPolygon } from '../polygon'
import { computeGrid, contourWithOuterMargin, DEFAULT_LAW, resolveGridPlan, scaleContour, semanticLadder, stdShapeContour } from '../grid-admin'
import { resolveUserPlan } from '../grid-user'
import type { Contour } from '../types'

const donut: Contour = {
  outer: { pts: [[0, 0], [214, 0], [214, 214], [0, 214]] },
  holes: [{ pts: [[70, 70], [144, 70], [144, 144], [70, 144]] }],
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

  it('keeps the constrained user door identical to the existing user-default plan', () => {
    for (const shape of ['square', 'rect', 'circle', 'triangle', 'diamondShape'] as const) {
      for (const sizeMM of [70, 118, 166, 214, 262, 310]) {
        const contour = stdShapeContour(shape, sizeMM, shape === 'rect' ? Math.round(sizeMM * 0.6) : sizeMM)
        for (const attachment of ['magnetic', 'twinfix', 'velcro'] as const) {
          expect(resolveUserPlan(contour, { attachment }))
            .toEqual(resolveGridPlan(contour, { attachment }))
        }
      }
    }
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
})
