// Magnetic-grid intent tests: the engine owns final selection and remains portable into Creator flows.

import { describe, expect, it } from 'vitest'
import { computeAttachmentGrid } from '@/app/(dev)/effect-creator/v5.3.1/core/primitives'
import { pointInPolygon } from '../polygon'
import { computeGrid, contourWithOuterMargin, DEFAULT_LAW, finalProductSignature, resolveGridPlan, scaleContour, semanticLadder, stdShapeContour } from '../grid-admin'
import { resolveUserPlan, semanticLadder as userSemanticLadder } from '../grid-user'
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

  it('deduplicates the circle by constrained final product and keeps the smallest equivalent rung', () => {
    const makeCircle = (sizeMM: number) => stdShapeContour('circle', sizeMM)
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
