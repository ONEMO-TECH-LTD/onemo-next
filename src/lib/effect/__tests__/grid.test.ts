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
  autoGrid,
  computeGrid,
  contourWithOuterMargin,
  DEFAULT_LAW,
  deriveRectangleConstruction,
  exactPerimeterCoverage,
  gridLadderCacheKey,
  HOLD_REACH_MM,
  LAUNCH_PITCHES_MM,
  nearestAnchorPair,
  nearestSemanticRung,
  nextSemanticRung,
  resolveGridPlan,
  resolveDesignSizeMM,
  resolveRectangleRungs,
  scaleContour,
  semanticLadder,
  semanticLadderFromRecipe,
  stdShapeContour,
  type GridConstruction,
  type GridPattern,
  type SemanticRung,
} from '../grid'
import type { Contour, Pt } from '../types'

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

function independentBoundedSpanFailures(
  contour: Contour,
  anchors: ReadonlyArray<Pt>,
  pattern: GridPattern,
  pitchMM: number,
  reachMM: number,
): number {
  const rimKeys = boundaryPointKeys(anchors, patternBasis(pattern, pitchMM))
  const rim = anchors.filter((point) => rimKeys.has(pointKey(point)))
  const maximumSpanMM = Math.max(...LAUNCH_PITCHES_MM)
  const pairs = rim.flatMap((first, firstIndex) => rim.slice(firstIndex + 1).flatMap((second) =>
    Math.hypot(first[0] - second[0], first[1] - second[1])
      <= maximumSpanMM + MANUFACTURING_TOLERANCE_MM
      ? [[first, second] as [Pt, Pt]]
      : []))
  let failures = 0
  for (const [ringIndex, ring] of [contour.outer, ...contour.holes].entries()) {
    for (let index = 0; index < ring.pts.length; index++) {
      const first = ring.pts[index]
      const second = ring.pts[(index + 1) % ring.pts.length]
      const segmentMM = Math.hypot(second[0] - first[0], second[1] - first[1])
      const samples = Math.max(1, Math.ceil(segmentMM / 0.25))
      for (let sample = 0; sample <= samples; sample++) {
        const t = sample / samples
        const point: Pt = [
          first[0] + (second[0] - first[0]) * t,
          first[1] + (second[1] - first[1]) * t,
        ]
        const radial = anchors.some((anchor) =>
          Math.hypot(point[0] - anchor[0], point[1] - anchor[1]) <= reachMM + 1e-7)
        const spanned = ringIndex === 0 && pairs.some(([left, right]) =>
          distanceToSegment(point, left, right) <= reachMM + 1e-7)
        if (!radial && !spanned) failures++
      }
    }
  }
  return failures
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
      HOLD_REACH_MM,
      'standard',
      96,
    )

    expect(coverage.gaps.length).toBeGreaterThan(0)
    expect(coverage.uncoveredMM).toBeGreaterThan(0)
  })

  it('holds only the bounded outer span between 96mm-neighbouring magnets', () => {
    const contour = stdShapeContour('square', 118)
    const anchors: Pt[] = [[11, 11], [107, 11], [107, 107], [11, 107]]
    const coverage = exactPerimeterCoverage(contour, anchors, HOLD_REACH_MM, 'standard', 96)

    expect(coverage.uncoveredMM).toBe(0)
    expect(coverage.gaps).toHaveLength(0)
  })

  it('prefers less uncovered perimeter even when it has more gap intervals', () => {
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
    const selected = autoGrid(star, cfg, 184, 0, { density: 'light' })
    const dice = computeGrid(star(184), {
      ...cfg,
      pitchMM: 96,
      pattern: 'quincunx',
    })
    const selectedCoverage = exactPerimeterCoverage(
      star(selected.fit.sizeMM),
      selected.fit.grid.anchors.map((anchor) => anchor.p),
      HOLD_REACH_MM,
      selected.pattern,
      selected.pitchMM,
    )
    const diceCoverage = exactPerimeterCoverage(
      star(184),
      dice.anchors.map((anchor) => anchor.p),
      HOLD_REACH_MM,
      'quincunx',
      96,
    )

    expect(selectedCoverage.uncoveredMM).toBeLessThan(diceCoverage.uncoveredMM)
    expect(selected.fit.grid.flaps.length).toBeGreaterThan(dice.flaps.length)
    expect({ pitchMM: selected.pitchMM, pattern: selected.pattern })
      .toEqual({ pitchMM: 48, pattern: 'standard' })
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

})

describe('engine-owned workbench selections', () => {
  const rungs: SemanticRung[] = [
    { label: 'ONE', points: 1, sizeMM: 22, gridExtentMM: 22, visible: true },
    { label: 'S', points: 2, sizeMM: 70, gridExtentMM: 70, visible: true },
    { label: 'M', points: 4, sizeMM: 118, gridExtentMM: 118, visible: true },
  ].map((rung) => ({
    ...rung,
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
      DEFAULT_LAW,
      'auto',
      { density: 'standard' },
    )
    const rectangle = resolveRectangleRungs(axisRungs, {
      longMM: 140,
      shortMM: 80,
      orientation: 'landscape',
    })

    expect(rectangle.longRung.sizeMM).toBe(166)
    expect(rectangle.shortRung.sizeMM).toBe(118)
    expect([rectangle.widthRung.sizeMM, rectangle.heightRung.sizeMM]).toEqual([166, 118])
  })

  it('composes every reachable rectangle from the active density construction', () => {
    let compared = 0
    for (const density of ['standard', 'light'] as const) {
      const axisRungs = semanticLadderFromRecipe(
        { kind: 'standard', shape: 'square' },
        DEFAULT_LAW,
        'auto',
        { source: 'std', density },
      )
      for (const widthRung of axisRungs) for (const heightRung of axisRungs) {
        const construction = deriveRectangleConstruction(
          widthRung,
          heightRung,
          DEFAULT_LAW,
          'auto',
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
          mode: 'auto',
          density,
          paddingMM: DEFAULT_LAW.paddingMM,
          maxGrowMM: 0,
          construction: construction!,
        })
        const population = constructionPoints(construction!)
        const rimKeys = boundaryPointKeys(population, construction!.basisMM)
        expect(construction!.pitchMM).toBe(density === 'standard' ? 48 : 96)
        expect(rimKeys.size).toBe(population.length)
        expect(plan.grid.anchors.map(({ p }) => p)).toEqual(population)
      }
    }
    expect(compared).toBe(65)
  })

  it('uses Light as the one omitted-density default across ladder and delivery seams', () => {
    const recipe = { kind: 'standard', shape: 'square' } as const
    const explicitLight = semanticLadderFromRecipe(
      recipe,
      DEFAULT_LAW,
      'auto',
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
      gridLadderCacheKey(recipe, DEFAULT_LAW, 'auto', { density: 'light' }),
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
    expect(resolveDesignSizeMM(1, 'std', { ...DEFAULT_LAW, paddingMM: 20 })).toBe(42)
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
  it('builds standard shapes as direct 48/96 perimeter constructions by density', () => {
    const square = stdShapeContour('square', 214)
    const standard = resolveGridPlan(square, {
      source: 'std',
      mode: 'auto',
      density: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    })
    const light = resolveGridPlan(square, {
      source: 'std',
      mode: 'auto',
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
    }).toEqual({ pitchMM: 48, anchors: 16, deliveredInterior: 0, ok: true })
    expect({
      pitchMM: light.pitchMM,
      anchors: light.grid.anchors.length,
      deliveredInterior: light.grid.anchors.length
        - boundaryPointKeys(lightPoints, patternBasis('standard', 96)).size,
      ok: light.grid.ok,
    }).toEqual({ pitchMM: 96, anchors: 8, deliveredInterior: 0, ok: true })
  })

  it('keeps bounded spans honest on the named standard-shape witnesses', () => {
    let compared = 0
    for (const [shape, sizeMM, density, pitchMM, expectedOk] of [
      ['square', 214, 'light', 96, true],
      ['circle', 216, 'light', 96, false],
      ['diamondShape', 224, 'light', 96, false],
      ['triangle', 260, 'standard', 48, true],
      ['triangle', 260, 'light', 96, false],
    ] as const) {
      const plan = resolveGridPlan(stdShapeContour(shape, sizeMM), {
        source: 'std',
        mode: 'standard',
        density,
        pitchMM,
        paddingMM: DEFAULT_LAW.paddingMM,
        maxGrowMM: 0,
      })
      compared++
      expect(
        plan.grid.ok,
        `${shape}/${sizeMM}/${density}/${pitchMM} contradicted bounded pair-span`,
      ).toBe(expectedOk)
    }
    expect(compared).toBe(5)
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

  it('derives AI Magic 2 sizes from the real outline instead of a square reference', () => {
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
      DEFAULT_LAW,
      'auto',
      options,
    )
    const squareReference = semanticLadderFromRecipe(
      { kind: 'standard', shape: 'square' },
      DEFAULT_LAW,
      'auto',
      options,
    )

    expect(actualOutline.map(({ label, sizeMM, points, gridExtentMM }) => ({
      label,
      sizeMM,
      points,
      gridExtentMM,
    }))).toEqual([
      { label: 'ONE', sizeMM: 46, points: 1, gridExtentMM: 22 },
      { label: 'S', sizeMM: 72, points: 2, gridExtentMM: 70 },
      { label: 'M', sizeMM: 120, points: 3, gridExtentMM: 118 },
      { label: 'L', sizeMM: 168, points: 4, gridExtentMM: 166 },
      { label: 'XL', sizeMM: 228, points: 6, gridExtentMM: 214 },
      { label: '2XL', sizeMM: 304, points: 10, gridExtentMM: 262 },
    ])
    expect(actualOutline.map(({ sizeMM }) => sizeMM))
      .not.toEqual(squareReference.map(({ sizeMM }) => sizeMM))
    expect(actualOutline.some(({ sizeMM }) => sizeMM > 180)).toBe(true)

    let compared = 0
    for (const rung of actualOutline) {
      const plan = resolveGridPlan(scaleContour(unitContour, rung.sizeMM), {
        source: 'magic',
        mode: 'auto',
        density: 'light',
        paddingMM: DEFAULT_LAW.paddingMM,
        maxGrowMM: 0,
        construction: rung.construction,
      })
      compared++
      expect(plan.grid.anchors).toHaveLength(rung.points)
      if (rung.points >= 2) expect(plan.grid.ok).toBe(true)
    }
    expect(compared).toBe(6)
  })

  it('fails closed instead of publishing a rotated population as Standard', () => {
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

    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      const contourAt = (sizeMM: number) => stdShapeContour(shape, sizeMM)
      for (const density of ['standard', 'light'] as const) {
        for (const rung of semanticLadder(
          contourAt,
          DEFAULT_LAW,
          'auto',
          { source: 'std', density },
        ).filter(({ visible }) => visible)) {
          visibleRungs[density]++
          const plan = resolveGridPlan(contourAt(rung.sizeMM), {
            source: 'std',
            mode: 'auto',
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

    expect(visibleRungs).toEqual({ standard: 18, light: 7 })
    expect([...nonStandardRungs]).toEqual([])
  })

  it('retains adaptive patterns for freeform and explicit admin modes', () => {
    const contour = stdShapeContour('circle', 119)
    const product = resolveGridPlan(contour, {
      source: 'std',
      mode: 'auto',
      density: 'light',
      maxGrowMM: 0,
    })
    const freeform = resolveGridPlan(contour, {
      source: 'gen',
      mode: 'auto',
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

  it('accepts exact 10mm rounded-corner tangency and seats all four 70mm corners', () => {
    const sizeMM = 70
    const insetMM = DEFAULT_LAW.paddingMM + DEFAULT_LAW.frameMM
    const radiusMM =
      (Math.SQRT2 * insetMM - DEFAULT_LAW.paddingMM) /
      (Math.SQRT2 - 1)
    const contour = roundedSquareContour(sizeMM, radiusMM)
    const plan = resolveGridPlan(contour, {
      mode: 'standard',
      pitchMM: 48,
      density: 'light',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    })
    const prepared = prepareExactContour(contour)
    const seats = plan.grid.anchors.map(
      (anchor) => distanceToPreparedContour(anchor.p, prepared),
    )

    expect(plan.grid.anchors).toHaveLength(4)
    expect(Math.min(...seats)).toBeCloseTo(DEFAULT_LAW.paddingMM, 6)
  })

  it('accepts exact 11mm zero-point tangency in the catalogue sizing solve', () => {
    const sizingInsetMM = DEFAULT_LAW.paddingMM + DEFAULT_LAW.frameMM
    const grid = computeGrid(roundedSquareContour(70, sizingInsetMM), {
      pitchMM: 48,
      pattern: 'standard',
      paddingMM: sizingInsetMM,
      perimeterOnly: true,
      sparseThin: true,
    })

    expect(grid.anchors).toHaveLength(4)
  })

  it('keeps the real rounded-square preset on the same 70mm four-corner default as sharp square', () => {
    const roundedAt = (sizeMM: number) => scaleContour(normalizedPresetContour('squircle'), sizeMM)
    const roundedRung = nextSemanticRung(semanticLadder(
      roundedAt,
      DEFAULT_LAW,
      'auto',
      { source: 'preset', density: 'standard' },
    ), 70)
    const roundedPlan = resolveGridPlan(roundedAt(roundedRung.sizeMM), {
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
        'auto',
        { source: 'std', density: 'standard' },
      ),
      70,
    )

    expect(roundedRung).toMatchObject({ label: 'S', sizeMM: 70, points: 4 })
    expect(roundedPlan.grid.anchors).toHaveLength(4)
    expect(sharpRung).toMatchObject({ label: 'S', sizeMM: 70, points: 4 })
  })

  it('builds every standard-shape density as its own perimeter-only 48/96 construction', () => {
    let compared = 0
    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      const contourAt = (sizeMM: number) => stdShapeContour(shape, sizeMM)
      for (const density of ['standard', 'light'] as const) {
        const expectedPitchMM = density === 'standard' ? 48 : 96
        const rungs = semanticLadder(
          contourAt,
          DEFAULT_LAW,
          'auto',
          { source: 'std', density },
        )
        for (const rung of rungs) {
          const population = constructionPoints(rung.construction)
          const rimKeys = boundaryPointKeys(population, rung.construction.basisMM)
          const plan = resolveGridPlan(contourAt(rung.sizeMM), {
            source: 'std',
            mode: 'auto',
            density,
            paddingMM: DEFAULT_LAW.paddingMM,
            maxGrowMM: 0,
            construction: rung.construction,
          })
          compared++
          expect(rung.construction.pitchMM).toBe(expectedPitchMM)
          expect(rung.construction.pattern).toBe('standard')
          expect(rimKeys.size).toBe(population.length)
          expect(plan.grid.anchors.map(({ p }) => p)).toEqual(population)
          expect(plan.grid.anchors).toHaveLength(rung.points)
          if (rung.points >= 2) expect(plan.grid.ok).toBe(true)
        }
      }
    }
    expect(compared).toBe(31)
  })

  it('publishes only independently covered bounded-span constructions on the product Auto path', () => {
    const coverageFailures: string[] = []
    let compared = 0
    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      const contourAt = (sizeMM: number) => stdShapeContour(shape, sizeMM)
      for (const density of ['standard', 'light'] as const) {
        const rungs = semanticLadder(
          contourAt,
          DEFAULT_LAW,
          'auto',
          { source: 'std', density },
        )
        for (const rung of rungs.filter((candidate) => candidate.points >= 2)) {
          const contour = contourAt(rung.sizeMM)
          const plan = resolveGridPlan(contour, {
            source: 'std',
            mode: 'auto',
            density,
            paddingMM: DEFAULT_LAW.paddingMM,
            maxGrowMM: 0,
            construction: rung.construction,
          })
          const failedSamples = independentBoundedSpanFailures(
            contour,
            plan.grid.anchors.map(({ p }) => p),
            rung.construction.pattern,
            rung.construction.pitchMM,
            HOLD_REACH_MM,
          )
          compared++
          if (failedSamples > 0) {
            coverageFailures.push(
              `${shape}/${density}/${rung.label}/${rung.sizeMM} failed=${failedSamples}`,
            )
          }
          expect(
            plan.grid.ok,
            `${shape}/${density}/${rung.label}/${rung.sizeMM} engine verdict was uncovered`,
          ).toBe(true)
        }
      }
    }
    expect(compared).toBe(23)
    expect(coverageFailures, `${compared} constructions compared`).toEqual([])
  })

  it('seats every published anchor at or above the hard padding floor', () => {
    const combos = [
      { mode: 'standard', pitchMM: 48 },
      { mode: 'standard', pitchMM: 96 },
      { mode: 'diamond', pitchMM: 48 },
      { mode: 'diamond', pitchMM: 96 },
      { mode: 'quincunx', pitchMM: 96 },
      { mode: 'auto', pitchMM: undefined },
    ] as const
    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      for (const { mode, pitchMM } of combos) {
        const contourAt = (sizeMM: number) => stdShapeContour(shape, sizeMM)
        const rungs = semanticLadder(
          contourAt,
          DEFAULT_LAW,
          mode,
          { source: 'std', density: 'standard', pitchMM },
        )
        for (const rung of rungs.filter((candidate) => candidate.points >= 2)) {
          const contour = contourAt(rung.sizeMM)
          const prepared = prepareExactContour(contour)
          const plan = resolveGridPlan(contour, {
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
  })

  it('snaps one continuous target through every active mode, pitch, and density', () => {
    const modes = ['auto', 'standard', 'quincunx', 'diamond'] as const
    for (const mode of modes) for (const pitchMM of [48, 96] as const) {
      const ladder = semanticLadder(
        (sizeMM) => stdShapeContour('triangle', sizeMM),
        DEFAULT_LAW,
        mode,
        { pitchMM },
      )
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
        if (mode !== 'auto') expect(plan.pattern).toBe(mode)
      }
    }
  })

  it('lets gravity orient a lawful two-anchor tier without changing its grid extent', () => {
    // 2026-07-29 precedence: full perimeter coverage supersedes the earlier triangle-pair example.
    // Law 5.8 still selects the vertical pair wherever a covered two-anchor construction exists.
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
      sizeMM: 72,
      gridExtentMM: 70,
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

  it('keeps covered Standard/48 triangles and rejects the unsupported Light/96 T population', () => {
    const makeTriangle = (sizeMM: number) => stdShapeContour('triangle', sizeMM)
    const standard = semanticLadder(
      makeTriangle,
      DEFAULT_LAW,
      'auto',
      { source: 'std', density: 'standard' },
    )
    const light = semanticLadder(
      makeTriangle,
      DEFAULT_LAW,
      'auto',
      { source: 'std', density: 'light' },
    )

    expect(standard).toMatchObject([
      { label: 'ONE', sizeMM: 40, gridExtentMM: 22 },
      { label: 'S', points: 5, sizeMM: 150, gridExtentMM: 118 },
      { label: 'M', points: 9, sizeMM: 232, gridExtentMM: 214 },
    ])
    expect(light).toMatchObject([
      { label: 'ONE', sizeMM: 40, gridExtentMM: 22 },
    ])
    expect(light.some((rung) => rung.points >= 2)).toBe(false)

    const delivered = resolveGridPlan(makeTriangle(standard[1].sizeMM), {
      source: 'std',
      mode: 'auto',
      density: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
      construction: standard[1].construction,
    })
    expect(delivered.grid.anchors).toHaveLength(standard[1].points)
    expect(delivered.grid.ok).toBe(true)
    expect(standard.every((rung) => rung.sizeMM <= DEFAULT_LAW.maxRungMM)).toBe(true)
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
  })

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
      const rungs = semanticLadder((sizeMM) => stdShapeContour(shape, sizeMM))
      for (const rung of rungs) {
        expect(
          rung.sizeMM % 2,
          `${shape}/${rung.label} published an odd ${rung.sizeMM}mm size`,
        ).toBe(0)
      }
    }
  })

  it('deduplicates circle count changes inside one extent and never skips labels', () => {
    const contourAt = (sizeMM: number) => stdShapeContour('circle', sizeMM)
    const standard = semanticLadder(
      contourAt,
      DEFAULT_LAW,
      'auto',
      { source: 'std', density: 'standard' },
    )
    const light = semanticLadder(
      contourAt,
      DEFAULT_LAW,
      'auto',
      { source: 'std', density: 'light' },
    )

    expect(standard.map((rung) => rung.label))
      .toEqual(['ONE', 'S', 'M', 'L', 'XL', '2XL', '3XL'])
    expect(standard.map((rung) => rung.gridExtentMM))
      .toEqual([22, 70, 118, 166, 214, 262, 310])
    expect(light.map((rung) => rung.label)).toEqual(['ONE', 'S'])
    expect(light.map((rung) => rung.gridExtentMM)).toEqual([22, 118])
  })

  it('uses the configured size ceiling, not label exhaustion, as the terminal gate', () => {
    for (const shape of ['circle', 'triangle', 'diamondShape'] as const) {
      const ladder = semanticLadder((sizeMM) => stdShapeContour(shape, sizeMM))
      expect(ladder.every((rung) => rung.sizeMM <= DEFAULT_LAW.maxRungMM)).toBe(true)
    }
  })

})
