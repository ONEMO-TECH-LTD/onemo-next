// Magnetic-grid intent tests: the engine owns final selection and remains portable into Creator flows.

import { describe, expect, it } from 'vitest'
import { computeAttachmentGrid } from '@/app/(dev)/effect-creator/v5.3.1/core/primitives'
import { getShape } from '@/lib/shape-library'
import { pointInPolygon } from '../polygon'
import { contourFromShape, MANUFACTURING_TOLERANCE_MM } from '../geometry-truth'
import { REAL_AI_GRID_CORPUS } from '../grid-s0-corpus'
import {
  distanceToPreparedContour,
  prepareExactContour,
} from '../grid-prepared'
import {
  computeGrid,
  contourWithOuterMargin,
  DEFAULT_LAW,
  deriveRectangleConstruction,
  exactPerimeterCoverage,
  gridLadderCacheKey,
  LAUNCH_PITCHES_MM,
  nearestAnchorPair,
  nearestSemanticRung,
  nextSemanticRung,
  resolveGridPlan,
  resolveGridPlanFromRecipe,
  resolveDesignSizeMM,
  resolveRectangleRungs,
  scaleContour,
  semanticLadder,
  semanticLadderFromRecipe,
  stdShapeContour,
  type GridConstruction,
  type GridDensity,
  type LadderRecipe,
  type GridPattern,
  type PlanRecipe,
  type SemanticRung,
} from '../grid'

/** This suite's OWN probe radius for `exactPerimeterCoverage`, which takes the radius as an argument.
 *  It is not an engine constant: `HOLD_REACH_MM` was deleted with the hold guard (KAI-10105), because
 *  a reach that decided what the engine published was never Dan's rule (8.2). Coverage assertions
 *  below measure geometry; none of them may become an acceptance criterion again. */
const PROBE_REACH_MM = 48
import { roundedSquareClearanceMM, roundedSquareContourMM } from '../rounded-square'
import type { Contour, Pt } from '../types'

// KAI-9884 census cut: the lawful seated shell is 11–12mm deep; the nearest known interior
// violation was circle 3XL at 19.2mm. Keep the classification gap explicit in the witness.
const PHYSICAL_PERIMETER_DEPTH_CUT_MM = 16

const donut: Contour = {
  outer: { pts: [[0, 0], [214, 0], [214, 214], [0, 214]] },
  holes: [{ pts: [[70, 70], [144, 70], [144, 144], [70, 144]] }],
}

function roundedSquareContour(sizeMM: number, radiusMM: number, segmentsPerCorner = 4096): Contour {
  const corners = [
    { cx: sizeMM - radiusMM, cy: radiusMM, start: -Math.PI / 2 },
    { cx: sizeMM - radiusMM, cy: sizeMM - radiusMM, start: 0 },
    { cx: radiusMM, cy: sizeMM - radiusMM, start: Math.PI / 2 },
    { cx: radiusMM, cy: radiusMM, start: Math.PI },
  ]
  const pts = corners.flatMap(({ cx, cy, start }) =>
    Array.from({ length: segmentsPerCorner }, (_, i) => {
      const angle = start + (i / segmentsPerCorner) * (Math.PI / 2)
      return [cx + Math.cos(angle) * radiusMM, cy + Math.sin(angle) * radiusMM] as Pt
    }),
  )
  return { outer: { pts }, holes: [] }
}

function normalizedPresetContour(kind: Parameters<typeof getShape>[0]): Contour {
  const shape = getShape(kind, 1000, 1000)
  const contour = contourFromShape(shape, { mmPerPx: 1, maskHeightPx: 1000 })
  if (!contour) throw new Error(`${kind} did not produce a contour`)
  const xs = contour.outer.pts.map(([x]) => x)
  const ys = contour.outer.pts.map(([, y]) => y)
  const longestMM = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  )
  return scaleContour(contour, 1 / longestMM)
}

function constructionPoints(construction: GridConstruction): Pt[] {
  const [[ax, ay], [bx, by]] = construction.basisMM
  return construction.population.map(([i, j]) => [
    construction.originMM[0] + i * ax + j * bx,
    construction.originMM[1] + i * ay + j * by,
  ])
}

function pointKey([x, y]: Pt): string {
  return `${x.toFixed(6)},${y.toFixed(6)}`
}

function boundaryPointKeys(points: ReadonlyArray<Pt>, basis: readonly [Pt, Pt]): Set<string> {
  const directions = [
    basis[0],
    [-basis[0][0], -basis[0][1]] as Pt,
    basis[1],
    [-basis[1][0], -basis[1][1]] as Pt,
  ]
  const population = new Set(points.map(pointKey))
  return new Set(points.filter((point) =>
    !directions.every(([dx, dy]) =>
      population.has(pointKey([point[0] + dx, point[1] + dy])))).map(pointKey))
}

function patternBasis(pattern: GridPattern, pitchMM: number): [Pt, Pt] {
  if (pattern === 'diamond') return [[pitchMM, pitchMM], [pitchMM, -pitchMM]]
  if (pattern === 'quincunx') return [[pitchMM, 0], [pitchMM / 2, pitchMM / 2]]
  return [[pitchMM, 0], [0, pitchMM]]
}

function distanceToSegment(point: Pt, first: Pt, second: Pt): number {
  const dx = second[0] - first[0]
  const dy = second[1] - first[1]
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared < 1e-12) return Math.hypot(point[0] - first[0], point[1] - first[1])
  const t = Math.max(0, Math.min(1, (
    (point[0] - first[0]) * dx + (point[1] - first[1]) * dy
  ) / lengthSquared))
  return Math.hypot(
    point[0] - (first[0] + t * dx),
    point[1] - (first[1] + t * dy),
  )
}

function distanceToContour(point: Pt, contour: Contour): number {
  return Math.min(...[contour.outer, ...contour.holes].flatMap((ring) =>
    ring.pts.map((first, index) =>
      distanceToSegment(point, first, ring.pts[(index + 1) % ring.pts.length]))))
}



// 'coverage' is gone from the reason set (S22) — an outline running past a reach constant is not a
// lawful reason for a size to be absent, so it may not appear here as an explanation.
type CompletenessReason = 'pattern' | 'padding-floor'
  | 'perimeter-only' | 'ceiling' | 'extent-collision' | 'geometric-minimum'

interface CompletenessShape {
  key: string
  source: 'std' | 'preset'
  ladderRecipe: LadderRecipe
  planRecipeAt: (sizeMM: number) => PlanRecipe
  contourAt: (sizeMM: number) => Contour
  clearanceMM: (point: Pt, sizeMM: number, contour: Contour) => number
}

function completenessShapes(): CompletenessShape[] {
  const standard = (shape: 'square' | 'circle' | 'triangle' | 'diamondShape'): CompletenessShape => ({
    key: shape,
    source: 'std',
    ladderRecipe: { kind: 'standard', shape },
    planRecipeAt: (sizeMM) => ({ kind: 'standard', shape, widthMM: sizeMM, heightMM: sizeMM }),
    contourAt: (sizeMM) => stdShapeContour(shape, sizeMM),
    clearanceMM: shape === 'circle'
      ? ([x, y], sizeMM) => sizeMM / 2 - Math.hypot(x - sizeMM / 2, y - sizeMM / 2)
      : (point, _sizeMM, contour) => distanceToContour(point, contour),
  })
  return [
    standard('square'),
    standard('circle'),
    standard('triangle'),
    standard('diamondShape'),
    {
      key: 'rounded-square-r10',
      source: 'preset',
      ladderRecipe: { kind: 'rounded-square', radiusMM: 10, minimumAnchors: 4 },
      planRecipeAt: (sizeMM) => ({ kind: 'rounded-square', sizeMM, radiusMM: 10 }),
      contourAt: (sizeMM) => roundedSquareContourMM(sizeMM, sizeMM, 10),
      clearanceMM: (point, sizeMM) => roundedSquareClearanceMM(point, sizeMM, sizeMM, 10),
    },
  ]
}

function catalogueCompleteness(
  omit?: { shape: string; density: GridDensity; baseSizeMM: number },
): {
  walked: number
  classified: Record<CompletenessReason, number>
  unexplained: string[]
} {
  const classified: Record<CompletenessReason, number> = {
    pattern: 0,
    'padding-floor': 0,
    'perimeter-only': 0,
    ceiling: 0,
    'extent-collision': 0,
    'geometric-minimum': 0,
  }
  const unexplained: string[] = []
  let walked = 0

  for (const shape of completenessShapes()) for (const density of ['standard', 'light'] as const) {
    const expectedPitchMM = density === 'standard' ? 48 : 96
    const rungs = semanticLadderFromRecipe(
      shape.ladderRecipe,
      DEFAULT_LAW, 'standard',
      { source: shape.source, density },
    ).filter((rung) => !(
      omit?.shape === shape.key
      && omit.density === density
      && omit.baseSizeMM === rung.baseSizeMM
    ))
    const byBase = new Map<number, Array<{ n: number; pitchMM: 48 | 96 }>>()
    for (const pitchMM of LAUNCH_PITCHES_MM) {
      for (let n = 1; ; n++) {
        const baseSizeMM = (n - 1) * pitchMM + 2 * DEFAULT_LAW.paddingMM
        if (baseSizeMM > DEFAULT_LAW.maxRungMM) break
        const producers = byBase.get(baseSizeMM) ?? []
        producers.push({ n, pitchMM })
        byBase.set(baseSizeMM, producers)
      }
    }

    for (const [baseSizeMM, producers] of byBase) {
      walked++
      const producerReasons: Array<CompletenessReason | 'published' | 'unexplained'> = []
      for (const producer of producers) {
        const published = rungs.some((rung) =>
          rung.baseSizeMM === baseSizeMM
          && rung.construction.pitchMM === producer.pitchMM)
        if (published) {
          producerReasons.push('published')
          continue
        }
        if (producer.n === 1) {
          producerReasons.push('geometric-minimum')
          continue
        }
        if (producer.pitchMM !== expectedPitchMM) {
          producerReasons.push('pattern')
          continue
        }
        if (baseSizeMM > DEFAULT_LAW.maxRungMM) {
          producerReasons.push('ceiling')
          continue
        }
        const collision = rungs.some((rung) => rung.baseSizeMM === baseSizeMM)
        if (collision) {
          producerReasons.push('extent-collision')
          continue
        }

        const contour = shape.contourAt(baseSizeMM)
        const plan = resolveGridPlanFromRecipe(shape.planRecipeAt(baseSizeMM), {
          source: shape.source,
          mode: 'standard',
          pitchMM: producer.pitchMM,
          density,
          paddingMM: DEFAULT_LAW.paddingMM,
          maxGrowMM: 0,
        })
        if (plan.pattern !== 'standard' || plan.pitchMM !== producer.pitchMM) {
          producerReasons.push('pattern')
          continue
        }
        const anchors = plan.grid.anchors.map(({ p }) => p)
        const clearances = anchors.map((point) => shape.clearanceMM(point, baseSizeMM, contour))
        if (clearances.some((clearanceMM) => clearanceMM < DEFAULT_LAW.paddingMM)) {
          producerReasons.push('padding-floor')
          continue
        }
        if (clearances.some((clearanceMM) => clearanceMM > PHYSICAL_PERIMETER_DEPTH_CUT_MM)) {
          producerReasons.push('perimeter-only')
          continue
        }
        // 'coverage' is NO LONGER A LAWFUL ABSENCE REASON (S22): a size is never missing because an
        // outline ran past a reach constant, so classifying it that way would explain an absence with
        // a struck rule. The probe is deleted rather than re-tuned, and the absences it used to absorb
        // now surface as 'unexplained' — which is the honest state until O3 is ruled. An unexplained
        // absence is a finding, never something to tune to green.
        producerReasons.push('unexplained')
      }

      if (producerReasons.includes('unexplained')) {
        unexplained.push(
          `${shape.key}/${density}/${baseSizeMM} ${producers.map(({ n, pitchMM }) => `n${n}@${pitchMM}`).join('+')} [${producerReasons.join(',')}]`,
        )
      } else {
        for (const reason of producerReasons) {
          if (reason !== 'published' && reason !== 'unexplained') classified[reason]++
        }
      }
    }
  }
  return { walked, classified, unexplained }
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

  it('requires each hole rim to have its own nearby support', () => {
    const contour: Contour = {
      outer: { pts: [[0, 0], [310, 0], [310, 310], [0, 310]] },
      holes: [{ pts: [[105, 105], [205, 105], [205, 205], [105, 205]] }],
    }
    const grid = computeGrid(contour, {
      pitchMM: 96,
      pattern: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      perimeterOnly: true,
      sparseThin: true,
    })
    const coverage = exactPerimeterCoverage(
      contour,
      grid.anchors.map((anchor) => anchor.p),
      PROBE_REACH_MM,
      'standard',
      96,
    )

    expect(coverage.gaps.length).toBeGreaterThan(0)
    expect(coverage.uncoveredMM).toBeGreaterThan(0)
  })

  it('holds only the bounded outer span between 96mm-neighbouring magnets', () => {
    const contour = stdShapeContour('square', 118)
    const anchors: Pt[] = [[11, 11], [107, 11], [107, 107], [11, 107]]
    const coverage = exactPerimeterCoverage(contour, anchors, PROBE_REACH_MM, 'standard', 96)

    expect(coverage.uncoveredMM).toBe(0)
    expect(coverage.gaps).toHaveLength(0)
  })

  it('never credits an interior chord as an outer-outline span', () => {
    const contour = stdShapeContour('triangle', 150)
    const anchors: Pt[] = [[27, 11], [75, 11], [123, 11], [75, 107]]
    const coverage = exactPerimeterCoverage(contour, anchors, PROBE_REACH_MM, 'standard', 48)

    expect(coverage.uncoveredMM).toBeGreaterThan(0)
    expect(coverage.gaps.length).toBeGreaterThan(0)
  })

  // REFRAMED (KAI-10105): this asserted the engine PREFERS the less-uncovered layout. It no longer
  // does — coverage selects nothing (S22) — so the old title described a rule that is gone while the
  // assertion below kept passing coincidentally. What it still measures honestly is `exactPerimeterCoverage`
  // itself: given two concrete layouts on one star, the spread one leaves less outline far from a magnet.
  // That is geometry, and it gates nothing.
  it('measures less uncovered perimeter on the spread layout than the dice layout (no engine preference implied)', () => {
    const star = (sizeMM: number): Contour => {
      const pts: [number, number][] = []
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
        const radius = (i % 2 === 0 ? 0.5 : 0.22) * sizeMM
        pts.push([
          sizeMM / 2 + radius * Math.cos(angle),
          sizeMM / 2 + radius * Math.sin(angle),
        ])
      }
      return { outer: { pts }, holes: [] }
    }
    const cfg = {
      paddingMM: DEFAULT_LAW.paddingMM,
      perimeterOnly: true,
      sparseThin: true,
    } as const
    // Pure function test: both layouts built explicitly, the selector is never called, nothing asserts
    // what was chosen. 48 is a caller-scoped measurement radius, not an engine value (S22).
    const straight = computeGrid(star(184), { ...cfg, pitchMM: 48, pattern: 'standard' })
    const dice = computeGrid(star(184), { ...cfg, pitchMM: 96, pattern: 'quincunx' })
    const straightCoverage = exactPerimeterCoverage(
      star(184),
      straight.anchors.map((anchor) => anchor.p),
      PROBE_REACH_MM,
      'standard',
      48,
    )
    const diceCoverage = exactPerimeterCoverage(
      star(184),
      dice.anchors.map((anchor) => anchor.p),
      PROBE_REACH_MM,
      'quincunx',
      96,
    )

    expect(straightCoverage.uncoveredMM).toBeLessThan(diceCoverage.uncoveredMM)
  })

  it('returns resolved measurements instead of requiring caller-side reconstruction', () => {
    const plan = resolveGridPlan(stdShapeContour('square', 118), {
      mode: 'standard', density: 'light', baseMarginMM: 0, maxGrowMM: 12,
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

})

describe('grid-derived catalogue completeness', () => {
  it('applies the source-aware anchor floor through both public ladder entry points', () => {
    const realContour = REAL_AI_GRID_CORPUS.spec.geometryMM
    const xs = realContour.outer.pts.map(([x]) => x)
    const ys = realContour.outer.pts.map(([, y]) => y)
    const longestMM = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    )
    const freeformUnit = scaleContour(realContour, 1 / longestMM)
    const presetUnit = normalizedPresetContour('heart')
    let compared = 0
    for (const source of ['std', 'preset', 'gen', 'magic'] as const) {
      const unitContour = source === 'preset' ? presetUnit : freeformUnit
      const recipe: LadderRecipe = source === 'std'
        ? { kind: 'standard', shape: 'square' }
        : { kind: 'uniform-contour', unitContour }
      const makeShape = source === 'std'
        ? (sizeMM: number) => stdShapeContour('square', sizeMM)
        : (sizeMM: number) => scaleContour(unitContour, sizeMM)
      for (const rungs of [
        semanticLadder(makeShape, DEFAULT_LAW, 'standard', { source, density: 'standard' }),
        semanticLadderFromRecipe(recipe, DEFAULT_LAW, 'standard', { source, density: 'standard' }),
      ]) {
        compared++
        expect(rungs.length, `${source} produced no witness`).toBeGreaterThan(0)
        // The floor is a PUBLICATION floor, not a discovery one. Every source discovers the one-anchor
        // construction — assert that first, because it is the half that stops a range limit from
        // becoming engine surgery (8.8(d), Dan 08-03).
        expect(rungs[0].label, `${source} lost its retained one-anchor construction`).toBe('ONE')
        const offered = rungs.filter((rung) => rung.visible)
        expect(offered[0].label, `${source} offered the wrong anchor floor`)
          .toBe(source === 'gen' || source === 'magic' ? 'ONE' : 'S')
      }
    }
    expect(compared).toBe(8)
  }, 15_000)

  it('starts every geometric catalogue at the first lawful multi-anchor S rung', () => {
    let compared = 0
    for (const shape of completenessShapes()) for (const density of ['standard', 'light'] as const) {
      const rungs = semanticLadderFromRecipe(
        shape.ladderRecipe,
        DEFAULT_LAW, 'standard',
        { source: shape.source, density },
      )
      compared++
      // Geometric catalogues do not OFFER ONE. They still carry it (8.8(d)).
      const offered = rungs.filter((rung) => rung.visible)
      expect(offered.every((rung) => rung.points >= 2), `${shape.key}/${density}`).toBe(true)
      expect(offered.some((rung) => rung.label === 'ONE'), `${shape.key}/${density}`).toBe(false)
      if (offered.length) expect(offered[0].label, `${shape.key}/${density}`).toBe('S')
    }
    expect(compared).toBe(10)
  })

  it('publishes every lawful derived base or independently proves its absence', () => {
    const result = catalogueCompleteness()
    const classifiedCount = Object.values(result.classified).reduce((sum, count) => sum + count, 0)

    expect(result.walked).toBeGreaterThan(0)
    expect(classifiedCount).toBeGreaterThan(0)
    expect(
      result.unexplained,
      `${result.walked} bases walked; classified=${JSON.stringify(result.classified)}`,
    ).toEqual([])

    const suppressed = catalogueCompleteness({
      shape: 'square',
      density: 'standard',
      baseSizeMM: 68,
    })
    expect(
      suppressed.unexplained.some((finding) => finding.startsWith('square/standard/68 ')),
      `${suppressed.walked} bases walked after deliberate rung suppression`,
    ).toBe(true)
  }, 120_000)
})

describe('engine-owned workbench selections', () => {
  const rungs: SemanticRung[] = [
    { label: 'ONE', points: 1, sizeMM: 22, gridExtentMM: 22, visible: true },
    { label: 'S', points: 2, sizeMM: 70, gridExtentMM: 70, visible: true },
    { label: 'M', points: 4, sizeMM: 118, gridExtentMM: 118, visible: true },
  ].map((rung) => ({
    ...rung,
    baseSizeMM: rung.sizeMM,
    designSizeMM: rung.sizeMM,
    marginMM: 0,
    frameBufferMM: 0,
    construction: {
      pattern: 'standard',
      pitchMM: 48,
      originMM: [11, 11],
      basisMM: [[48, 0], [0, 48]],
      population: [[0, 0]],
    },
  }))

  it('uses the canonical higher-rung exact-tie policy', () => {
    expect(nearestSemanticRung(rungs, 94).sizeMM).toBe(118)
  })

  it('snaps upward to the next legal grid size instead of down to the nearest', () => {
    expect(nextSemanticRung(rungs, 22).sizeMM).toBe(22)
    expect(nextSemanticRung(rungs, 23).sizeMM).toBe(70)
    expect(nextSemanticRung(rungs, 94).sizeMM).toBe(118)
    expect(nextSemanticRung(rungs, 999).sizeMM).toBe(118)
  })

  it('owns rectangle option legality and orientation', () => {
    const landscape = resolveRectangleRungs(rungs, {
      longMM: 94,
      shortMM: 46,
      orientation: 'landscape',
    })
    expect(landscape.longOptions.map((rung) => rung.sizeMM)).toEqual([70, 118])
    expect(landscape.shortOptions.map((rung) => rung.sizeMM)).toEqual([22, 70, 118])
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
    expect(one.shortOptions).toEqual([rungs[0]])
    expect(one.shortRung).toBe(one.longRung)
  })

  it('allows the short axis to use the same legal grid extent as the long axis', () => {
    const axisRungs = [
      ...rungs,
      {
        label: 'L',
        points: 12,
        sizeMM: 214,
        baseSizeMM: 214,
        designSizeMM: 214,
        marginMM: 0,
        frameBufferMM: 0,
        gridExtentMM: 214,
        visible: true,
        construction: rungs[2].construction,
      },
    ]
    const square = resolveRectangleRungs(axisRungs, {
      longMM: 214,
      shortMM: 214,
      orientation: 'landscape',
    })

    expect(square.shortOptions.map((rung) => rung.sizeMM)).toContain(214)
    expect([square.widthRung.sizeMM, square.heightRung.sizeMM]).toEqual([214, 214])
  })

  it('snaps both rectangle axes upward within the published catalogue', () => {
    const axisRungs = semanticLadderFromRecipe(
      { kind: 'standard', shape: 'square' },
      DEFAULT_LAW, 'standard',
      { density: 'standard' },
    )
    const rectangle = resolveRectangleRungs(axisRungs, {
      longMM: 140,
      shortMM: 80,
      orientation: 'landscape',
    })

    expect(rectangle.longRung.sizeMM).toBe(164)
    expect(rectangle.shortRung.sizeMM).toBe(116)
    expect([rectangle.widthRung.sizeMM, rectangle.heightRung.sizeMM]).toEqual([164, 116])
  })

  it('composes every reachable rectangle from the active density construction', () => {
    let compared = 0
    for (const density of ['standard', 'light'] as const) {
      const axisRungs = semanticLadderFromRecipe(
        { kind: 'standard', shape: 'square' },
        DEFAULT_LAW, 'standard',
        { source: 'std', density },
      )
      for (const widthRung of axisRungs) for (const heightRung of axisRungs) {
        const construction = deriveRectangleConstruction(
          widthRung,
          heightRung,
          DEFAULT_LAW,
          'standard',
          { source: 'std', density },
        )
        compared++
        expect(
          construction,
          `${density}/${widthRung.gridExtentMM}×${heightRung.gridExtentMM} has no construction`,
        ).not.toBeNull()
        const contour = stdShapeContour('rect', widthRung.sizeMM, heightRung.sizeMM)
        const plan = resolveGridPlan(contour, {
          source: 'std',
          mode: 'standard',
          density,
          paddingMM: DEFAULT_LAW.paddingMM,
          maxGrowMM: 0,
          construction: construction!,
        })
        const population = constructionPoints(construction!)
        const rimKeys = boundaryPointKeys(population, construction!.basisMM)
        expect(construction!.pitchMM).toBe(density === 'standard' ? 48 : 96)
        // Rectangle composition inherits the same mode mask as every other shape: Light is the
        // boundary, Standard carries its interior. The coverage this test exists for is that BOTH axes
        // compose into one delivered lattice — that assertion is unchanged below.
        if (density === 'light') expect(rimKeys.size).toBe(population.length)
        else expect(rimKeys.size).toBeLessThanOrEqual(population.length)
        expect(plan.grid.anchors.map(({ p }) => p)).toEqual(population)
      }
    }
    expect(compared).toBeGreaterThan(0)
  })

  it('uses Light as the one omitted-density default across ladder and delivery seams', () => {
    const recipe = { kind: 'standard', shape: 'square' } as const
    const explicitLight = semanticLadderFromRecipe(
      recipe,
      DEFAULT_LAW, 'standard',
      { density: 'light' },
    )
    const omitted = semanticLadderFromRecipe(recipe)
    const firstMultiAnchor = omitted.find((rung) => rung.points >= 2)!

    expect(omitted).toEqual(explicitLight)
    expect(firstMultiAnchor.construction.pitchMM).toBe(96)
    expect(
      deriveRectangleConstruction(firstMultiAnchor, firstMultiAnchor)?.pitchMM,
    ).toBe(96)
    expect(gridLadderCacheKey(recipe)).toBe(
      gridLadderCacheKey(recipe, DEFAULT_LAW, 'standard', { density: 'light' }),
    )

    const delivered = resolveGridPlan(
      stdShapeContour('square', firstMultiAnchor.sizeMM),
      { construction: firstMultiAnchor.construction, maxGrowMM: 0 },
    )
    expect(delivered.pitchMM).toBe(96)
    expect(delivered.grid.anchors.map(({ p }) => p))
      .toEqual(constructionPoints(firstMultiAnchor.construction))
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
    expect(resolveDesignSizeMM(1, 'std', { ...DEFAULT_LAW, paddingMM: 20 })).toBe(40)
  })

  it('exposes signed-offset and Velcro diagnostics only through explicit options', () => {
    const contour = stdShapeContour('square', 70)
    const signed = resolveGridPlan(contour, {
      attachment: 'magnetic',
      density: 'light',
      baseMarginMM: -15,
      maxGrowMM: 12,
      signedBaseMargin: true,
    })
    expect({
      pitch: signed.pitchMM,
      pattern: signed.pattern,
      margin: signed.resolvedMarginMM,
      anchors: signed.grid.anchors.length,
    }).toEqual({ pitch: 96, pattern: 'standard', margin: -15, anchors: 1 })

    const diagnosticVelcro = resolveGridPlan(contour, {
      attachment: 'velcro',
      density: 'light',
      baseMarginMM: 0,
      maxGrowMM: 12,
      diagnosticVelcro: true,
    })
    expect({
      pitch: diagnosticVelcro.pitchMM,
      pattern: diagnosticVelcro.pattern,
      gridPitch: diagnosticVelcro.grid.pitchCentreMM,
      anchors: diagnosticVelcro.grid.anchors.length,
    }).toEqual({ pitch: 96, pattern: 'standard', gridPitch: 0, anchors: 0 })

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
  it('derives the frameless square base from padding and publishes the caller buffer separately', () => {
    const makeSquare = (sizeMM: number) => stdShapeContour('square', sizeMM)
    const zero = semanticLadder(
      makeSquare,
      DEFAULT_LAW, 'standard',
      { source: 'std', density: 'standard', frameBufferMM: 0 },
    )
    const buffered = semanticLadder(
      makeSquare,
      DEFAULT_LAW, 'standard',
      { source: 'std', density: 'standard', frameBufferMM: 3 },
    )
    const halfMillimetre = semanticLadder(
      makeSquare,
      DEFAULT_LAW, 'standard',
      { source: 'std', density: 'standard', frameBufferMM: 0.5 },
    )

    expect(zero.length).toBeGreaterThan(0)
    expect(buffered).toHaveLength(zero.length)
    expect(halfMillimetre).toHaveLength(zero.length)
    let compared = 0
    for (let index = 0; index < zero.length; index++) {
      const base = zero[index]
      const framed = buffered[index]
      const rounded = halfMillimetre[index]
      const points = constructionPoints(base.construction)
      const xs = points.map(([x]) => x)
      const spanMM = Math.max(...xs) - Math.min(...xs)
      const derivedBaseMM = spanMM + 2 * DEFAULT_LAW.paddingMM

      compared++
      expect(base.baseSizeMM).toBe(derivedBaseMM)
      expect(base.gridExtentMM).toBe(derivedBaseMM)
      expect(base.sizeMM).toBe(base.baseSizeMM)
      expect(base.frameBufferMM).toBe(0)
      expect(framed.baseSizeMM).toBe(base.baseSizeMM)
      expect(framed.frameBufferMM).toBe(3)
      expect(framed.sizeMM).toBe(base.baseSizeMM + 6)
      expect(rounded.baseSizeMM).toBe(base.baseSizeMM)
      expect(rounded.sizeMM).toBe(base.baseSizeMM + 2)
      expect(rounded.sizeMM % 2).toBe(0)
    }
    expect(compared).toBe(zero.length)

    const witness = buffered.find((rung) => rung.label === 'M')!
    const plan = resolveGridPlan(stdShapeContour('square', witness.baseSizeMM), {
      source: 'std',
      density: 'standard',
      maxGrowMM: 0,
      frameBufferMM: 3,
      construction: witness.construction,
    })
    const baseWidthMM = Math.max(...plan.baseContourMM.outer.pts.map(([x]) => x))
      - Math.min(...plan.baseContourMM.outer.pts.map(([x]) => x))
    const publishedWidthMM = Math.max(...plan.effectContourMM.outer.pts.map(([x]) => x))
      - Math.min(...plan.effectContourMM.outer.pts.map(([x]) => x))
    expect(plan.baseSizeMM).toBe(witness.baseSizeMM)
    expect(plan.publishedSizeMM).toBe(witness.sizeMM)
    expect(plan.frameBufferMM).toBe(3)
    expect(baseWidthMM).toBe(witness.baseSizeMM)
    expect(publishedWidthMM).toBe(witness.sizeMM)
    expect(plan.grid.anchors).toHaveLength(witness.points)
  })

  // Direct-mode witness for the mask ruling on one named size. 214mm at 48mm pitch admits a 5x5 block:
  // Standard delivers all 25 with 9 interior, Light delivers the 8-point ring at 96mm with none.
  // The populations are law-derived (block and its boundary), not scanned values.
  it('builds standard shapes as direct 48/96 constructions masked by density', () => {
    const square = stdShapeContour('square', 214)
    const standard = resolveGridPlan(square, {
      source: 'std',
      mode: 'standard',
      density: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    })
    const light = resolveGridPlan(square, {
      source: 'std',
      mode: 'standard',
      density: 'light',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    })
    const standardPoints = standard.grid.anchors.map(({ p }) => p)
    const lightPoints = light.grid.anchors.map(({ p }) => p)

    expect({
      pitchMM: standard.pitchMM,
      anchors: standard.grid.anchors.length,
      deliveredInterior: standard.grid.anchors.length
        - boundaryPointKeys(standardPoints, patternBasis('standard', 48)).size,
      ok: standard.grid.ok,
    }).toEqual({ pitchMM: 48, anchors: 25, deliveredInterior: 9, ok: true })
    expect({
      pitchMM: light.pitchMM,
      anchors: light.grid.anchors.length,
      deliveredInterior: light.grid.anchors.length
        - boundaryPointKeys(lightPoints, patternBasis('standard', 96)).size,
      ok: light.grid.ok,
    }).toEqual({ pitchMM: 96, anchors: 8, deliveredInterior: 0, ok: true })
  })

  it('expands AI Magic 2 on the lawful 96mm family without bypassing its real outline', () => {
    const realContour = REAL_AI_GRID_CORPUS.spec.geometryMM
    const xs = realContour.outer.pts.map(([x]) => x)
    const ys = realContour.outer.pts.map(([, y]) => y)
    const longestMM = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    )
    const unitContour = scaleContour(realContour, 1 / longestMM)
    const rungs = semanticLadderFromRecipe(
      { kind: 'uniform-contour', unitContour },
      DEFAULT_LAW,
      'standard',
      { source: 'magic', density: 'light', pitchMM: 96 },
    )

    expect(rungs.length).toBeGreaterThan(1)
    expect(rungs.every((rung) => rung.construction.pitchMM === 96)).toBe(true)
  })

  it('derives AI Magic 2 sizes from the real outline and retains its larger one-point construction', () => {
    const realContour = REAL_AI_GRID_CORPUS.spec.geometryMM
    const xs = realContour.outer.pts.map(([x]) => x)
    const ys = realContour.outer.pts.map(([, y]) => y)
    const longestMM = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    )
    const unitContour = scaleContour(realContour, 1 / longestMM)
    const options = { source: 'magic' as const, density: 'light' as const }
    const actualOutline = semanticLadderFromRecipe(
      { kind: 'uniform-contour', unitContour },
      DEFAULT_LAW, 'standard',
      options,
    )
    const squareReference = semanticLadderFromRecipe(
      { kind: 'standard', shape: 'square' },
      DEFAULT_LAW, 'standard',
      options,
    )

    expect(actualOutline.map(({ label, sizeMM, points, gridExtentMM }) => ({
      label,
      sizeMM,
      points,
      gridExtentMM,
    }))).toEqual([
      { label: 'ONE', sizeMM: 42, points: 1, gridExtentMM: 20 },
      { label: 'S', sizeMM: 70, points: 2, gridExtentMM: 68 },
      { label: 'M', sizeMM: 118, points: 3, gridExtentMM: 116 },
      { label: 'L', sizeMM: 166, points: 4, gridExtentMM: 164 },
      { label: 'XL', sizeMM: 226, points: 6, gridExtentMM: 212 },
      { label: '2XL', sizeMM: 302, points: 10, gridExtentMM: 260 },
      { label: '3XL', sizeMM: 310, points: 8, gridExtentMM: 308 },
    ])
    expect(actualOutline.map(({ sizeMM }) => sizeMM))
      .not.toEqual(squareReference.map(({ sizeMM }) => sizeMM))
    expect(actualOutline.some(({ sizeMM }) => sizeMM > 180)).toBe(true)

    let compared = 0
    for (const rung of actualOutline) {
      const plan = resolveGridPlan(scaleContour(unitContour, rung.sizeMM), {
        source: 'magic',
        mode: 'standard',
        density: 'light',
        paddingMM: DEFAULT_LAW.paddingMM,
        maxGrowMM: 0,
        construction: rung.construction,
      })
      compared++
      expect(plan.grid.anchors).toHaveLength(rung.points)
      if (rung.points >= 2) expect(plan.grid.ok).toBe(true)
    }
    expect(compared).toBe(7)
  })

  it('derives freeform rungs from scale plus bounded outward margin and delivers that exact split', () => {
    const unitContour: Contour = {
      outer: {
        pts: [
          [0.08, 0], [0.12, 0.24], [0.25, 0.38], [0.32, 0.58],
          [0.28, 0.78], [0.35, 1], [0.46, 0.78], [0.57, 0.78],
          [0.68, 1], [0.72, 0.78], [0.68, 0.58], [0.76, 0.38],
          [0.9, 0.24], [0.94, 0],
        ],
      },
      holes: [],
    }
    const hybridRecipe = {
      kind: 'uniform-contour',
      unitContour,
      maxMarginMM: 12,
    } as const
    const testLaw = { ...DEFAULT_LAW, maxTestedMM: 166, maxRungMM: 166 }
    const rungs = semanticLadderFromRecipe(
      hybridRecipe,
      testLaw, 'standard',
      { source: 'magic', density: 'standard' },
    )

    expect(gridLadderCacheKey(
      hybridRecipe,
      testLaw,
      'standard',
      { source: 'magic', density: 'standard' },
    )).not.toBe(gridLadderCacheKey(
      { ...hybridRecipe, maxMarginMM: 0 },
      testLaw,
      'standard',
      { source: 'magic', density: 'standard' },
    ))
    expect(rungs.some(({ marginMM }) => marginMM > 0)).toBe(true)
    expect(rungs.every(({ sizeMM, baseSizeMM, designSizeMM, marginMM }) =>
      baseSizeMM === designSizeMM + 2 * marginMM && sizeMM === baseSizeMM)).toBe(true)

    let compared = 0
    for (const rung of rungs) {
      const plan = resolveGridPlan(scaleContour(unitContour, rung.designSizeMM), {
        source: 'magic',
        mode: 'standard',
        density: 'standard',
        paddingMM: DEFAULT_LAW.paddingMM,
        baseMarginMM: rung.marginMM,
        maxGrowMM: 0,
        construction: rung.construction,
      })
      compared++
      expect(plan.grid.anchors).toHaveLength(rung.points)
      if (rung.points >= 2) expect(plan.grid.ok).toBe(true)
    }
    expect(compared).toBe(rungs.length)
    expect(compared).toBeGreaterThan(1)
  })

  it('honours automatic margin bounds and an exact manual margin in serialized outline ladders', () => {
    const unitContour: Contour = {
      outer: { pts: [[0, 0], [1, 0], [1, 0.72], [0.54, 1], [0, 0.72]] },
      holes: [],
    }
    const law = { ...DEFAULT_LAW, maxTestedMM: 118, maxRungMM: 118 }
    const options = { source: 'magic' as const, density: 'standard' as const }
    const automatic = semanticLadderFromRecipe(
      { kind: 'uniform-contour', unitContour, minMarginMM: 3, maxMarginMM: 9 },
      law, 'standard',
      options,
    )
    const manual = semanticLadderFromRecipe(
      { kind: 'uniform-contour', unitContour, minMarginMM: 6, maxMarginMM: 6 },
      law, 'standard',
      options,
    )

    expect(automatic.length).toBeGreaterThan(1)
    expect(automatic.every(({ marginMM }) => marginMM >= 3 && marginMM <= 9)).toBe(true)
    expect(manual.length).toBeGreaterThan(1)
    expect(manual.every(({ marginMM }) => marginMM === 6)).toBe(true)
    expect(manual.every(({ sizeMM, baseSizeMM, designSizeMM }) =>
      baseSizeMM === designSizeMM + 12 && sizeMM === baseSizeMM)).toBe(true)
    expect(gridLadderCacheKey(
      { kind: 'uniform-contour', unitContour, minMarginMM: 6, maxMarginMM: 6 },
      law,
      'standard',
      options,
    )).not.toBe(gridLadderCacheKey(
      { kind: 'uniform-contour', unitContour, minMarginMM: 3, maxMarginMM: 9 },
      law,
      'standard',
      options,
    ))
    expect(() => semanticLadderFromRecipe(
      { kind: 'uniform-contour', unitContour, minMarginMM: 10, maxMarginMM: 9 },
      law, 'standard',
      options,
    )).toThrow(/minimum margin/i)
  })

  it('prepares each physical size once even when multiple extents and pattern combos reject it', () => {
    const calls: number[] = []
    const impossible: Contour = {
      outer: { pts: [[0, 0], [1, 0], [0, 1]] },
      holes: [],
    }
    semanticLadder(
      (sizeMM) => {
        calls.push(sizeMM)
        return impossible
      },
      { ...DEFAULT_LAW, maxTestedMM: 118, maxRungMM: 118 },
      'standard',
      { source: 'magic', density: 'standard' },
    )

    expect(calls.length, 'probe must execute candidate preparation').toBeGreaterThan(0)
    expect(calls.length, 'the same physical candidate was prepared more than once')
      .toBe(new Set(calls).size)
  })

  // O3-PENDING. A rotated population must never publish under the Standard label. Relied on the engine
  // growing 12mm to find a conforming phase; no chooser drives that growth until O3 is ruled.
  it.skip('O3-pending — fails closed instead of publishing a rotated population as Standard', () => {
    const angle = Math.PI / 4
    const ux = Math.cos(angle), uy = Math.sin(angle)
    const vx = -uy, vy = ux
    const halfLong = 0.5, halfShort = 0.15
    const unit: Contour = {
      outer: {
        pts: [
          [0.5 - halfLong * ux - halfShort * vx, 0.5 - halfLong * uy - halfShort * vy],
          [0.5 + halfLong * ux - halfShort * vx, 0.5 + halfLong * uy - halfShort * vy],
          [0.5 + halfLong * ux + halfShort * vx, 0.5 + halfLong * uy + halfShort * vy],
          [0.5 - halfLong * ux + halfShort * vx, 0.5 - halfLong * uy + halfShort * vy],
        ],
      },
      holes: [],
    }
    const shapeAt = (sizeMM: number) => scaleContour(unit, sizeMM)
    const ladder = semanticLadder(shapeAt, DEFAULT_LAW, 'standard', { pitchMM: 48 })
    const firstMultiAnchor = ladder.find(({ points }) => points >= 2)
    expect(firstMultiAnchor).toBeDefined()
    const constructionPair = nearestAnchorPair(
      constructionPoints(firstMultiAnchor!.construction)
        .map((p) => ({ p, dia: 6 as const })),
    )
    expect(constructionPair).not.toBeNull()
    expect(
      Math.abs(constructionPair!.distanceMM - firstMultiAnchor!.construction.pitchMM),
      `Standard published ${constructionPair!.distanceMM.toFixed(6)}mm diagonal spacing`,
    ).toBeLessThanOrEqual(MANUFACTURING_TOLERANCE_MM)

    const rejected = resolveGridPlan(shapeAt(102), {
      source: 'gen',
      mode: 'standard',
      pitchMM: 48,
      density: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    })
    const grown = resolveGridPlan(shapeAt(102), {
      source: 'gen',
      mode: 'standard',
      pitchMM: 48,
      density: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 12,
    })
    expect(rejected.grid.ok).toBe(false)
    expect(rejected.grid.anchors).toHaveLength(1)
    expect(grown.grewMM).toBe(12)
    expect(grown.grid.ok).toBe(true)
    expect(grown.nearestAnchorMM).toBeCloseTo(48, 9)
  })

  it('keeps every visible geometric product rung on the standard pattern in Auto', () => {
    const nonStandardRungs = new Set<string>()
    const visibleRungs = { standard: 0, light: 0 }
    const hiddenRungs = new Set<string>()

    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      const contourAt = (sizeMM: number) => stdShapeContour(shape, sizeMM)
      for (const density of ['standard', 'light'] as const) {
        const ladder = semanticLadder(contourAt, DEFAULT_LAW, 'standard', { source: 'std', density })
        for (const rung of ladder) {
          // ONE is withheld from geometric panels BY DESIGN (Dan 08-03). Any OTHER hidden rung means a
          // lawful size stopped being offered without a rule saying so — that is the regression here.
          if (!rung.visible && rung.label !== 'ONE') {
            hiddenRungs.add(`${shape}/${density}/${rung.label}/${rung.sizeMM}`)
          }
        }
        for (const rung of ladder.filter(({ visible }) => visible)) {
          visibleRungs[density]++
          const plan = resolveGridPlan(contourAt(rung.sizeMM), {
            source: 'std',
            mode: 'standard',
            density,
            paddingMM: DEFAULT_LAW.paddingMM,
            maxGrowMM: 0,
            construction: rung.construction,
          })
          if (plan.pattern !== 'standard') {
            nonStandardRungs.add(`${shape}/${density}/${rung.label}/${rung.sizeMM}`)
          }
        }
      }
    }

    // The law under test is "every VISIBLE product rung is standard-pattern in Auto" — the rung
    // COUNT is not the law. The old pin (18/7) was arithmetic of the unsanctioned visibility
    // filter, not of 4.1: it only held while sizes above the tested ceiling were hidden, so it
    // failed the moment that filter was removed on Dan's ruling ("I never said to hide them").
    // Pinning a count here re-creates the filter by the back door. Assert the property, plus a
    // non-empty denominator so the sweep cannot pass by examining nothing.
    expect(visibleRungs.standard).toBeGreaterThan(0)
    expect(visibleRungs.light).toBeGreaterThan(0)
    expect([...nonStandardRungs]).toEqual([])

    // …and the visibility law itself, which the pattern property CANNOT carry: a re-introduced
    // filter simply removes rungs from the sweep above, so every survivor is still standard and
    // the whole file stays green while sizes vanish from the product. That is exactly how the
    // hiding survived — restoring the filter verbatim passed 44/44 until this line existed.
    //
    // PINS DAN'S CURRENT RULING (07-30): "I never said to hide them, now we are not at the
    // launch, are we?" — EVERY computed rung is visible. This assertion is MEANT to change, but
    // only deliberately: when hiding returns it returns as an 8.7 admin input with a released
    // value, and whoever builds that updates this line as part of the change.
    expect([...hiddenRungs]).toEqual([])
  })

  it('retains adaptive patterns for freeform and explicit admin modes', () => {
    const contour = stdShapeContour('circle', 119)
    const product = resolveGridPlan(contour, {
      source: 'std',
      mode: 'standard',
      density: 'light',
      maxGrowMM: 0,
    })
    const freeform = resolveGridPlan(contour, {
      source: 'gen',
      mode: 'standard',
      density: 'light',
      maxGrowMM: 0,
    })
    const explicitAdmin = resolveGridPlan(contour, {
      source: 'std',
      mode: 'diamond',
      density: 'light',
      maxGrowMM: 0,
    })

    expect(product.pattern).toBe('standard')
    expect(freeform.pattern).toBe('quincunx')
    expect(explicitAdmin.pattern).toBe('diamond')
  })

  it('accepts exact 10mm rounded-corner tangency and seats all four frameless corners', () => {
    const sizeMM = 68
    const radiusMM = DEFAULT_LAW.paddingMM
    const contour = roundedSquareContour(sizeMM, radiusMM)
    const plan = resolveGridPlan(contour, {
      mode: 'standard',
      pitchMM: 48,
      density: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    })
    const prepared = prepareExactContour(contour)
    const seats = plan.grid.anchors.map(
      (anchor) => distanceToPreparedContour(anchor.p, prepared),
    )

    expect(plan.grid.anchors).toHaveLength(4)
    expect(Math.min(...seats)).toBeCloseTo(DEFAULT_LAW.paddingMM, 5)
  })

  it('keeps the real rounded-square preset on the same 68mm four-corner base as sharp square', () => {
    const roundedAt = (sizeMM: number) => scaleContour(normalizedPresetContour('squircle'), sizeMM)
    const roundedRung = nextSemanticRung(semanticLadder(
      roundedAt,
      DEFAULT_LAW, 'standard',
      { source: 'preset', density: 'standard' },
    ), 68)
    const roundedPlan = resolveGridPlan(roundedAt(roundedRung.baseSizeMM), {
      source: 'preset',
      mode: 'standard',
      pitchMM: 48,
      density: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
      construction: roundedRung.construction,
    })
    const sharpRung = nextSemanticRung(
      semanticLadder(
        (sizeMM) => stdShapeContour('square', sizeMM),
        DEFAULT_LAW,
        'standard',
        { source: 'std', density: 'standard' },
      ),
      68,
    )

    expect(roundedRung).toMatchObject({ label: 'S', sizeMM: 68, points: 4 })
    expect(roundedPlan.grid.anchors).toHaveLength(4)
    expect(sharpRung).toMatchObject({ label: 'S', sizeMM: 68, points: 4 })
  })

  // Dan 08-03: "the standard mode must show all magnets - the light perimeter only". The mode is the
  // magnet mask and nothing else selects it. This census keeps the four-shape / both-density coverage
  // and asserts the mask itself, so a regression to perimeter-only Standard fails here — the exact trap
  // that a single-flag fix walks into, because directPerimeter once chose both pitch AND mask.
  it('masks every standard-shape density by mode: Standard all magnets, Light the boundary', () => {
    let compared = 0
    let standardWithInterior = 0
    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      const contourAt = (sizeMM: number) => stdShapeContour(shape, sizeMM)
      for (const density of ['standard', 'light'] as const) {
        const expectedPitchMM = density === 'standard' ? 48 : 96
        const rungs = semanticLadder(
          contourAt,
          DEFAULT_LAW, 'standard',
          { source: 'std', density },
        )
        for (const rung of rungs) {
          const population = constructionPoints(rung.construction)
          const rimKeys = boundaryPointKeys(population, rung.construction.basisMM)
          const plan = resolveGridPlan(contourAt(rung.sizeMM), {
            source: 'std',
            mode: 'standard',
            density,
            paddingMM: DEFAULT_LAW.paddingMM,
            maxGrowMM: 0,
            construction: rung.construction,
          })
          compared++
          expect(rung.construction.pitchMM).toBe(expectedPitchMM)
          expect(rung.construction.pattern).toBe('standard')
          if (density === 'light') {
            // Light is the rim: every delivered point is on the population boundary.
            expect(rimKeys.size).toBe(population.length)
          } else {
            // Standard is the full block: the rim is a subset, never the whole population.
            expect(rimKeys.size).toBeLessThanOrEqual(population.length)
            if (rimKeys.size < population.length) standardWithInterior++
          }
          expect(plan.grid.anchors.map(({ p }) => p)).toEqual(population)
          expect(plan.grid.anchors).toHaveLength(rung.points)
          if (rung.points >= 2) expect(plan.grid.ok).toBe(true)
        }
      }
    }
    expect(compared).toBeGreaterThan(0)
    // The load-bearing half: if Standard were silently forced back to perimeter-only, every Standard
    // population would equal its own rim and this counter would be zero.
    expect(standardWithInterior).toBeGreaterThan(0)
  })

  // Scoped to Light by Dan's 08-03 mode ruling: Light is the perimeter belt, so no delivered anchor may
  // sit inboard. Standard now carries interior magnets BY DESIGN, and its own guard is the mask census
  // above — this test must not be widened back over Standard or it re-asserts the overruled policy.
  it('keeps every published Light anchor on the physical perimeter', () => {
    const violations: string[] = []
    let compared = 0
    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      for (const density of ['light'] as const) {
        const rungs = semanticLadderFromRecipe(
          { kind: 'standard', shape },
          DEFAULT_LAW, 'standard',
          { source: 'std', density },
        )
        for (const rung of rungs) {
          const contour = stdShapeContour(shape, rung.baseSizeMM)
          const plan = resolveGridPlanFromRecipe({
            kind: 'standard',
            shape,
            widthMM: rung.baseSizeMM,
            heightMM: rung.baseSizeMM,
          }, {
            source: 'std',
            density,
            maxGrowMM: 0,
            construction: rung.construction,
          })
          const interior = plan.grid.anchors
            .map(({ p }) => ({ p, depthMM: distanceToContour(p, contour) }))
            .filter(({ depthMM }) => depthMM > PHYSICAL_PERIMETER_DEPTH_CUT_MM)
          compared++
          if (interior.length > 0) {
            violations.push(
              `${shape}/${density}/${rung.label}/${rung.sizeMM}: ${interior.map(({ p, depthMM }) => `${p[0].toFixed(1)},${p[1].toFixed(1)}@${depthMM.toFixed(1)}`).join(' ')}`,
            )
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(0)
    expect(violations).toEqual([])
  })

  // Coverage never decides what may be published (S22). The live invariant: every published
  // multi-anchor rung resolves to a lawful plan through the production path.
  it('resolves every published multi-anchor rung to a lawful plan on the product Auto path', () => {
    let compared = 0
    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      for (const density of ['standard', 'light'] as const) {
        const rungs = semanticLadderFromRecipe(
          { kind: 'standard', shape },
          DEFAULT_LAW, 'standard',
          { source: 'std', density },
        )
        for (const rung of rungs.filter((candidate) => candidate.points >= 2)) {
          const plan = resolveGridPlanFromRecipe({
            kind: 'standard',
            shape,
            widthMM: rung.baseSizeMM,
            heightMM: rung.baseSizeMM,
          }, {
            source: 'std',
            mode: 'standard',
            density,
            paddingMM: DEFAULT_LAW.paddingMM,
            maxGrowMM: 0,
            construction: rung.construction,
          })
          compared++
          expect(
            plan.grid.ok,
            `${shape}/${density}/${rung.label}/${rung.sizeMM} did not resolve a lawful plan`,
          ).toBe(true)
        }
      }
    }
    expect(compared).toBeGreaterThan(0)
  })

  it('seats every published anchor at or above the hard padding floor', () => {
    const combos = [
      { mode: 'standard', pitchMM: 48 },
      { mode: 'standard', pitchMM: 96 },
      { mode: 'diamond', pitchMM: 48 },
      { mode: 'diamond', pitchMM: 96 },
      { mode: 'quincunx', pitchMM: 96 },
      { mode: 'standard', pitchMM: undefined },
    ] as const
    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      for (const { mode, pitchMM } of combos) {
        const contourAt = (sizeMM: number) => stdShapeContour(shape, sizeMM)
        const rungs = semanticLadderFromRecipe(
          { kind: 'standard', shape },
          DEFAULT_LAW,
          mode,
          { source: 'std', density: 'standard', pitchMM },
        )
        for (const rung of rungs.filter((candidate) => candidate.points >= 2)) {
          const contour = contourAt(rung.sizeMM)
          const prepared = prepareExactContour(contour)
          const plan = resolveGridPlanFromRecipe({
            kind: 'standard',
            shape,
            widthMM: rung.baseSizeMM,
            heightMM: rung.baseSizeMM,
          }, {
            source: 'std',
            mode,
            pitchMM,
            density: 'standard',
            paddingMM: DEFAULT_LAW.paddingMM,
            maxGrowMM: 0,
            construction: rung.construction,
          })
          const nearestBoundaryMM = Math.min(...plan.grid.anchors.map((anchor) => {
            if (shape !== 'circle') return distanceToPreparedContour(anchor.p, prepared)
            // Law 9.2(a): the true circle is the measurement authority. Its bounded
            // polygon proxy may shave microns from an analytically exact tangency.
            const radiusMM = rung.sizeMM / 2
            return radiusMM - Math.hypot(
              anchor.p[0] - radiusMM,
              anchor.p[1] - radiusMM,
            )
          }))
          expect(
            nearestBoundaryMM,
            `${shape}/${mode}/${pitchMM ?? 'auto'} ${rung.label} ${rung.sizeMM}mm seats below the hard padding floor`,
          ).toBeGreaterThanOrEqual(DEFAULT_LAW.paddingMM - 1e-6)
        }
      }
    }
  }, 15_000)

  it('snaps one continuous target through every active mode, pitch, and density', () => {
    const modes = ['standard', 'standard', 'quincunx', 'diamond'] as const
    let compared = 0
    for (const mode of modes) for (const pitchMM of [48, 96] as const) {
      const ladder = semanticLadder(
        (sizeMM) => stdShapeContour('triangle', sizeMM),
        DEFAULT_LAW,
        mode,
        { pitchMM },
      )
      if (!ladder.length) continue
      const snapped = nearestSemanticRung(ladder, 140)
      for (const density of ['light', 'standard'] as const) {
        const contour = stdShapeContour('triangle', snapped.sizeMM)
        const plan = resolveGridPlan(contour, {
          mode,
          pitchMM,
          density,
          paddingMM: DEFAULT_LAW.paddingMM,
          maxGrowMM: 0,
        })
        expect(plan.designContourMM).toEqual(contour)
        expect(plan.pitchMM).toBe(mode === 'quincunx' && pitchMM === 48 ? 96 : pitchMM)
        if (mode !== 'standard') expect(plan.pattern).toBe(mode)
        compared++
      }
    }
    expect(compared).toBeGreaterThan(0)
  })

  // O3-PENDING. Law 5.8 — the vertical pair beats the horizontal where a long side is unsupported.
  // Resolves 1 anchor where it expects 2 because nothing selects occupancy until O3 is ruled.
  it.skip('O3-pending — lets gravity orient a lawful two-anchor tier without changing its grid extent', () => {
    const ladder = semanticLadder(
      (sizeMM) => stdShapeContour('circle', sizeMM),
      DEFAULT_LAW,
      'standard',
      { pitchMM: 48 },
    )
    const twoAnchor = ladder.find((rung) => rung.points === 2)
    expect(twoAnchor).toMatchObject({
      label: 'S',
      points: 2,
      sizeMM: 70,
      gridExtentMM: 68,
    })

    const plan = resolveGridPlan(stdShapeContour('circle', twoAnchor!.sizeMM), {
      mode: 'standard',
      pitchMM: 48,
      density: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    })
    expect(plan.grid.anchors).toHaveLength(2)
    const [first, second] = plan.grid.anchors
    expect(Math.abs(second.p[1] - first.p[1]))
      .toBeGreaterThan(Math.abs(second.p[0] - first.p[0]))
  })

  // Coverage does not control whether a density family publishes (S22). No millimetre is pinned;
  // which CONSTRUCTION each family delivers is open under O3 and deliberately not asserted.
  it('does not let coverage decide whether a density family publishes at all', () => {
    const makeTriangle = (sizeMM: number) => stdShapeContour('triangle', sizeMM)
    const standard = semanticLadder(
      makeTriangle,
      DEFAULT_LAW, 'standard',
      { source: 'std', density: 'standard' },
    )
    const light = semanticLadder(
      makeTriangle,
      DEFAULT_LAW, 'standard',
      { source: 'std', density: 'light' },
    )

    expect(standard.length, 'standard family publishes').toBeGreaterThan(0)
    expect(light.length, 'light family publishes — it was emptied by the guard').toBeGreaterThan(0)
    expect(standard.some((rung) => rung.points >= 2)).toBe(true)
    expect(light.some((rung) => rung.points >= 2)).toBe(true)
    for (const rung of [...standard, ...light]) {
      expect(rung.sizeMM).toBeLessThanOrEqual(DEFAULT_LAW.maxRungMM)
    }
  })

  it('law 3.1 — construction extents are monotonic and never collapse as the catalogue advances', () => {
    const combos = [
      { mode: 'standard', pitchMM: 48 },
      { mode: 'standard', pitchMM: 96 },
      { mode: 'diamond', pitchMM: 48 },
      { mode: 'diamond', pitchMM: 96 },
      { mode: 'quincunx', pitchMM: 96 },
    ] as const

    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      for (const { mode, pitchMM } of combos) {
        const rungs = semanticLadder(
          (sizeMM) => stdShapeContour(shape, sizeMM),
          DEFAULT_LAW,
          mode,
          { pitchMM },
        )
        for (let index = 1; index < rungs.length; index++) {
          expect(
            rungs[index].gridExtentMM,
            `${shape}/${mode}/${pitchMM} collapsed ${rungs[index - 1].gridExtentMM} -> ${rungs[index].gridExtentMM}`,
          ).toBeGreaterThan(rungs[index - 1].gridExtentMM)
          expect(rungs[index].sizeMM).toBeGreaterThan(rungs[index - 1].sizeMM)
        }
      }
    }
  }, 15_000)

  it('law 4.5 — explicit freeform standard, diamond and dice all thin to their population rim', () => {
    let compared = 0
    for (const pattern of ['standard', 'diamond', 'quincunx'] as const) {
      const pitchMM = pattern === 'quincunx' ? 96 : 48
      const contour = stdShapeContour('square', 310)
      const standard = resolveGridPlan(contour, {
        source: 'gen',
        mode: pattern,
        pitchMM,
        density: 'standard',
        maxGrowMM: 0,
      })
      const light = resolveGridPlan(contour, {
        source: 'gen',
        mode: pattern,
        pitchMM,
        density: 'light',
        maxGrowMM: 0,
      })
      compared++
      const standardPoints = standard.grid.anchors.map(({ p }) => p)
      const standardKeys = new Set(standardPoints.map(pointKey))
      const rimKeys = boundaryPointKeys(standardPoints, patternBasis(pattern, pitchMM))
      expect(rimKeys.size).toBeLessThan(standardPoints.length)
      expect(
        light.grid.anchors.every(({ p }) => standardKeys.has(pointKey(p))),
        `${pattern}/${pitchMM} Light selected a second phase`,
      ).toBe(true)
      expect(
        light.grid.anchors.every(({ p }) => rimKeys.has(pointKey(p))),
        `${pattern}/${pitchMM} Light retained an interior node`,
      ).toBe(true)
    }
    expect(compared).toBe(3)
  })

  it('publishes every physical catalogue size on the next even whole millimetre', () => {
    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      for (const density of ['standard', 'light'] as const) {
        const rungs = semanticLadder(
          (sizeMM) => stdShapeContour(shape, sizeMM),
          DEFAULT_LAW,
          'standard',
          { source: 'std', density },
        )
        for (const rung of rungs) {
          expect(
            rung.sizeMM % 2,
            `${shape}/${density}/${rung.label} published an odd ${rung.sizeMM}mm size`,
          ).toBe(0)
        }
      }
    }

    for (const witness of [
      { shape: 'circle', gridExtentMM: 164, sizeMM: 172 },
      { shape: 'circle', gridExtentMM: 212, sizeMM: 236 },
    ] as const) {
      const contourAt = (sizeMM: number) => stdShapeContour(witness.shape, sizeMM)
      const options = { source: 'std', density: 'standard' } as const
      const rung = semanticLadder(contourAt, DEFAULT_LAW, 'standard', options)
        .find((candidate) => candidate.gridExtentMM === witness.gridExtentMM)
      const predecessor = semanticLadder(
        contourAt,
        { ...DEFAULT_LAW, maxRungMM: witness.sizeMM - 2 }, 'standard',
        options,
      )
      expect(rung?.sizeMM).toBe(witness.sizeMM)
      expect(predecessor.some((candidate) => candidate.gridExtentMM === witness.gridExtentMM)).toBe(false)
    }
  })

  it('deduplicates circle count changes inside one extent and never skips labels', () => {
    const contourAt = (sizeMM: number) => stdShapeContour('circle', sizeMM)
    const standard = semanticLadder(
      contourAt,
      DEFAULT_LAW, 'standard',
      { source: 'std', density: 'standard' },
    )
    const light = semanticLadder(
      contourAt,
      DEFAULT_LAW, 'standard',
      { source: 'std', density: 'light' },
    )

    expect(standard.map((rung) => rung.label))
      .toEqual(['S', 'M', 'L', 'XL'])
    expect(standard.map((rung) => rung.gridExtentMM))
      .toEqual([68, 116, 164, 212])
    expect(light.map((rung) => rung.label)).toEqual(['S'])
    expect(light.map((rung) => rung.gridExtentMM)).toEqual([116])
  })

  it('uses the configured size ceiling, not label exhaustion, as the terminal gate', () => {
    for (const shape of ['circle', 'triangle', 'diamondShape'] as const) {
      const ladder = semanticLadder((sizeMM) => stdShapeContour(shape, sizeMM))
      expect(ladder.every((rung) => rung.sizeMM <= DEFAULT_LAW.maxRungMM)).toBe(true)
    }
  })

})
