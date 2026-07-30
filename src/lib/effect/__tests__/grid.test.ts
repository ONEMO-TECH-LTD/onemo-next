// Magnetic-grid intent tests: the engine owns final selection and remains portable into Creator flows.

import { describe, expect, it } from 'vitest'
import { computeAttachmentGrid } from '@/app/(dev)/effect-creator/v5.3.1/core/primitives'
import { getShape } from '@/lib/shape-library'
import { pointInPolygon } from '../polygon'
import { contourFromShape } from '../geometry-truth'
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
  HOLD_REACH_MM,
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

function independentRadialUncoveredMM(
  contour: Contour,
  anchors: ReadonlyArray<Pt>,
  reachMM: number,
): number {
  let uncoveredMM = 0
  for (const ring of [contour.outer, ...contour.holes]) {
    for (let index = 0; index < ring.pts.length; index++) {
      const a = ring.pts[index]
      const b = ring.pts[(index + 1) % ring.pts.length]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const segmentMM = Math.hypot(dx, dy)
      if (segmentMM < 1e-9) continue
      const intervals = anchors.flatMap(([cx, cy]) => {
        const ox = a[0] - cx
        const oy = a[1] - cy
        const qa = dx * dx + dy * dy
        const qb = 2 * (ox * dx + oy * dy)
        const qc = ox * ox + oy * oy - reachMM * reachMM
        const discriminant = qb * qb - 4 * qa * qc
        if (discriminant < -1e-9) return []
        const root = Math.sqrt(Math.max(0, discriminant))
        const lo = Math.max(0, (-qb - root) / (2 * qa))
        const hi = Math.min(1, (-qb + root) / (2 * qa))
        return lo <= hi + 1e-9 ? [[lo, hi] as [number, number]] : []
      }).sort((left, right) => left[0] - right[0] || left[1] - right[1])
      let coveredTo = 0
      for (const [lo, hi] of intervals) {
        if (lo > coveredTo) uncoveredMM += (lo - coveredTo) * segmentMM
        if (hi > coveredTo) coveredTo = hi
      }
      if (coveredTo < 1) uncoveredMM += (1 - coveredTo) * segmentMM
    }
  }
  return uncoveredMM
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
    )

    expect(coverage.gaps.length).toBeGreaterThan(0)
    expect(coverage.uncoveredMM).toBeGreaterThan(0)
  })

  it('does not invent support between magnets on the outer ring', () => {
    const contour = stdShapeContour('square', 118)
    const anchors: Pt[] = [[11, 11], [107, 11], [107, 107], [11, 107]]
    const coverage = exactPerimeterCoverage(contour, anchors, HOLD_REACH_MM)
    const expectedGapMM = 4 * (
      96 - 2 * Math.sqrt(HOLD_REACH_MM ** 2 - 11 ** 2)
    )

    expect(coverage.uncoveredMM).toBeCloseTo(expectedGapMM, 6)
    expect(coverage.gaps).toHaveLength(4)
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
    )
    const diceCoverage = exactPerimeterCoverage(
      star(184),
      dice.anchors.map((anchor) => anchor.p),
      HOLD_REACH_MM,
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
    const axisRungs = semanticLadderFromRecipe({ kind: 'standard', shape: 'square' })
    const rectangle = resolveRectangleRungs(axisRungs, {
      longMM: 140,
      shortMM: 80,
      orientation: 'landscape',
    })

    expect(rectangle.longRung.sizeMM).toBe(166)
    expect(rectangle.shortRung.sizeMM).toBe(118)
    expect([rectangle.widthRung.sizeMM, rectangle.heightRung.sizeMM]).toEqual([166, 118])
  })

  it('composes every reachable rectangle once, then derives both density deliveries from it', () => {
    const axisRungs = semanticLadderFromRecipe({ kind: 'standard', shape: 'square' })
    let compared = 0
    for (const widthRung of axisRungs) for (const heightRung of axisRungs) {
      const construction = deriveRectangleConstruction(
        widthRung,
        heightRung,
        DEFAULT_LAW,
        'auto',
      )
      compared++
      expect(
        construction,
        `${widthRung.gridExtentMM}×${heightRung.gridExtentMM} has no construction`,
      ).not.toBeNull()
      const contour = stdShapeContour('rect', widthRung.sizeMM, heightRung.sizeMM)
      const standard = resolveGridPlan(contour, {
        mode: 'auto',
        density: 'standard',
        paddingMM: DEFAULT_LAW.paddingMM,
        maxGrowMM: 0,
        construction: construction!,
      })
      const light = resolveGridPlan(contour, {
        mode: 'auto',
        density: 'light',
        paddingMM: DEFAULT_LAW.paddingMM,
        maxGrowMM: 0,
        construction: construction!,
      })
      const population = constructionPoints(construction!)
      const populationKeys = new Set(population.map(pointKey))
      const rimKeys = boundaryPointKeys(population, construction!.basisMM)
      expect(standard.grid.anchors.map(({ p }) => p)).toEqual(population)
      expect(light.grid.anchors.every(({ p }) => populationKeys.has(pointKey(p)))).toBe(true)
      expect(light.grid.anchors.every(({ p }) => rimKeys.has(pointKey(p)))).toBe(true)
    }
    expect(axisRungs).toHaveLength(4)
    expect(compared).toBe(16)
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
    }).toEqual({ pitch: 48, pattern: 'standard', margin: -15, anchors: 1 })

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
    }).toEqual({ pitch: 48, pattern: 'standard', gridPitch: 0, anchors: 0 })

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
  it('keeps every visible geometric product rung on the standard pattern in Auto', () => {
    const nonStandardRungs = new Set<string>()
    let visibleRungs = 0

    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      const contourAt = (sizeMM: number) => stdShapeContour(shape, sizeMM)
      for (const rung of semanticLadder(contourAt).filter(({ visible }) => visible)) {
        visibleRungs++
        for (const density of ['light', 'standard'] as const) {
          const plan = resolveGridPlan(contourAt(rung.sizeMM), {
            mode: 'auto',
            density,
            paddingMM: DEFAULT_LAW.paddingMM,
            maxGrowMM: 0,
          })
          if (plan.pattern !== 'standard') {
            nonStandardRungs.add(`${shape}/${rung.label}/${rung.sizeMM}`)
          }
        }
      }
    }

    expect(visibleRungs).toBe(14)
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
    const roundedRung = nextSemanticRung(semanticLadder(roundedAt), 70)
    const roundedPlan = resolveGridPlan(roundedAt(roundedRung.sizeMM), {
      mode: 'standard',
      pitchMM: 48,
      density: 'light',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    })
    const sharpRung = nextSemanticRung(
      semanticLadder((sizeMM) => stdShapeContour('square', sizeMM)),
      70,
    )

    expect(roundedRung).toMatchObject({ label: 'S', sizeMM: 70, points: 4 })
    expect(roundedPlan.grid.anchors).toHaveLength(4)
    expect(sharpRung).toMatchObject({ label: 'S', sizeMM: 70, points: 4 })
  })

  it('derives the light rim from the lattice-population boundary, never hold reach', () => {
    const diamond = stdShapeContour('diamondShape', 128)
    const diamondPrepared = prepareExactContour(diamond)
    const diamondLight = computeGrid(diamond, {
      pitchMM: 48,
      pattern: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      perimeterOnly: true,
      sparseThin: true,
    })
    const diamondFull = computeGrid(diamond, {
      pitchMM: 48,
      pattern: 'standard',
      paddingMM: DEFAULT_LAW.paddingMM,
      perimeterOnly: false,
    })
    const centre: Pt = [64, 64]

    expect(distanceToPreparedContour(centre, diamondPrepared)).toBeLessThan(HOLD_REACH_MM)
    expect(diamondFull.anchors.map(({ p }) => p)).toContainEqual(centre)
    expect(diamondLight.anchors.map(({ p }) => p)).not.toContainEqual(centre)
    expect(diamondLight.anchors).toHaveLength(4)
    const fullPopulation = diamondFull.anchors.map(({ p }) => p)
    let comparedRimAnchors = 0
    for (const { p } of diamondLight.anchors) {
      comparedRimAnchors++
      expect(
        fullPopulation,
        `light density shifted rim anchor ${p.join(',')} onto the cancelled 24mm phase`,
      ).toContainEqual(p)
    }
    expect(comparedRimAnchors).toBe(4)

    let comparedDensityCases = 0
    let comparedDensityAnchors = 0
    for (const [shape, sizeMM] of [
      ['square', 214],
      ['circle', 224],
      ['triangle', 290],
      ['diamondShape', 224],
    ] as const) {
      const contour = stdShapeContour(shape, sizeMM)
      const light = computeGrid(contour, {
        pitchMM: 48,
        pattern: 'standard',
        paddingMM: DEFAULT_LAW.paddingMM,
        perimeterOnly: true,
        sparseThin: true,
      })
      const standard = computeGrid(contour, {
        pitchMM: 48,
        pattern: 'standard',
        paddingMM: DEFAULT_LAW.paddingMM,
        perimeterOnly: false,
        sparseThin: false,
      })
      const standardPopulation = standard.anchors.map(({ p }) => p)
      comparedDensityCases++
      for (const { p } of light.anchors) {
        comparedDensityAnchors++
        expect(
          standardPopulation,
          `${shape} ${sizeMM}mm Light shifted ${p.join(',')} onto a different grid phase`,
        ).toContainEqual(p)
      }
    }
    expect(comparedDensityCases).toBe(4)
    expect(comparedDensityAnchors).toBeGreaterThan(0)
  })

  it('publishes only radially held geometric constructions on the product Auto path', () => {
    const radialFailures: string[] = []
    let compared = 0
    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      const contourAt = (sizeMM: number) => stdShapeContour(shape, sizeMM)
      const rungs = semanticLadder(contourAt)
      for (const rung of rungs.filter((candidate) => candidate.points >= 2)) {
        const contour = contourAt(rung.sizeMM)
        for (const density of ['light', 'standard'] as const) {
          const plan = resolveGridPlan(contour, {
            mode: 'auto',
            density,
            paddingMM: DEFAULT_LAW.paddingMM,
            maxGrowMM: 0,
            construction: rung.construction,
          })
          const radialUncoveredMM = independentRadialUncoveredMM(
            contour,
            plan.grid.anchors.map(({ p }) => p),
            HOLD_REACH_MM,
          )
          compared++
          if (radialUncoveredMM > 1e-6) {
            radialFailures.push(
              `${shape}/${density}/${rung.label}/${rung.sizeMM}`
              + ` uncovered=${radialUncoveredMM.toFixed(3)}`,
            )
          }
          expect(
            plan.grid.ok,
            `${shape}/${density}/${rung.label}/${rung.sizeMM} engine verdict was uncovered`,
          ).toBe(true)
        }
      }
    }
    expect(compared).toBeGreaterThan(0)
    expect(radialFailures, `${compared} constructions compared`).toEqual([])
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
          pitchMM === undefined ? {} : { pitchMM },
        )
        for (const rung of rungs.filter((candidate) => candidate.points >= 2)) {
          const contour = contourAt(rung.sizeMM)
          const prepared = prepareExactContour(contour)
          const plan = resolveGridPlan(contour, {
            mode,
            pitchMM,
            density: 'light',
            paddingMM: DEFAULT_LAW.paddingMM,
            maxGrowMM: 0,
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
      density: 'light',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    })
    expect(plan.grid.anchors).toHaveLength(2)
    const [first, second] = plan.grid.anchors
    expect(Math.abs(second.p[1] - first.p[1]))
      .toBeGreaterThan(Math.abs(second.p[0] - first.p[0]))
  })

  it('keeps small triangles on covered Auto constructions and drops the uncovered Standard/96 pair', () => {
    const makeTriangle = (sizeMM: number) => stdShapeContour('triangle', sizeMM)
    const auto = semanticLadder(makeTriangle, DEFAULT_LAW, 'auto')
    const standard96 = semanticLadder(makeTriangle, DEFAULT_LAW, 'standard', { pitchMM: 96 })

    expect(auto).toMatchObject([
      { label: 'ONE', sizeMM: 40, gridExtentMM: 22 },
      { label: 'S', points: 5, sizeMM: 150, gridExtentMM: 118 },
    ])
    expect(standard96).toMatchObject([
      { label: 'ONE', sizeMM: 40, gridExtentMM: 22 },
    ])
    expect(standard96.some((rung) => rung.points === 2)).toBe(false)

    const delivered = resolveGridPlan(makeTriangle(auto[1].sizeMM), {
      mode: 'auto',
      density: 'light',
      paddingMM: DEFAULT_LAW.paddingMM,
      maxGrowMM: 0,
    })
    expect(delivered.grid.anchors).toHaveLength(auto[1].points)
    expect(delivered.grid.ok).toBe(true)
    expect(auto.every((rung) => rung.sizeMM <= DEFAULT_LAW.maxRungMM)).toBe(true)
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

  it('laws 1.3/4.5/4.6 — one construction serves both densities and Light is its rim subset', () => {
    const cases = [
      { mode: 'auto', pitchMM: undefined },
      { mode: 'standard', pitchMM: 48 },
      { mode: 'standard', pitchMM: 96 },
      { mode: 'diamond', pitchMM: 48 },
      { mode: 'diamond', pitchMM: 96 },
      { mode: 'quincunx', pitchMM: 96 },
    ] as const
    let compared = 0
    for (const shape of ['square', 'circle', 'triangle', 'diamondShape'] as const) {
      for (const { mode, pitchMM } of cases) {
        const standardRungs = semanticLadderFromRecipe(
          { kind: 'standard', shape },
          DEFAULT_LAW,
          mode,
          { pitchMM, density: 'standard' },
        )
        const lightRungs = semanticLadderFromRecipe(
          { kind: 'standard', shape },
          DEFAULT_LAW,
          mode,
          { pitchMM, density: 'light' },
        )
        expect(lightRungs).toHaveLength(standardRungs.length)
        for (let index = 0; index < standardRungs.length; index++) {
          const standardRung = standardRungs[index]
          const lightRung = lightRungs[index]
          compared++
          expect(
            {
              label: lightRung.label,
              sizeMM: lightRung.sizeMM,
              gridExtentMM: lightRung.gridExtentMM,
              visible: lightRung.visible,
              construction: lightRung.construction,
            },
            `${shape}/${mode}/${pitchMM ?? 'auto'}/${standardRung.label} changed construction by density`,
          ).toEqual({
            label: standardRung.label,
            sizeMM: standardRung.sizeMM,
            gridExtentMM: standardRung.gridExtentMM,
            visible: standardRung.visible,
            construction: standardRung.construction,
          })

          const contour = stdShapeContour(shape, standardRung.sizeMM)
          const standard = resolveGridPlan(contour, {
            mode,
            pitchMM,
            density: 'standard',
            paddingMM: DEFAULT_LAW.paddingMM,
            maxGrowMM: 0,
            construction: standardRung.construction,
          })
          const light = resolveGridPlan(contour, {
            mode,
            pitchMM,
            density: 'light',
            paddingMM: DEFAULT_LAW.paddingMM,
            maxGrowMM: 0,
            construction: standardRung.construction,
          })
          const population = constructionPoints(standardRung.construction)
          const populationKeys = new Set(population.map(pointKey))
          const rimKeys = boundaryPointKeys(population, standardRung.construction.basisMM)
          expect(standard.grid.anchors.map(({ p }) => p)).toEqual(population)
          expect(standardRung.points).toBe(standard.grid.anchors.length)
          expect(lightRung.points).toBe(light.grid.anchors.length)
          for (const [density, rung, plan] of [
            ['standard', standardRung, standard],
            ['light', lightRung, light],
          ] as const) {
            expect(plan.pattern).toBe(rung.construction.pattern)
            expect(plan.pitchMM).toBe(rung.construction.pitchMM)
            if (rung.points >= 2) {
              expect(
                plan.grid.ok,
                `${shape}/${mode}/${pitchMM ?? 'auto'}/${density}/${rung.label} was published uncovered`,
              ).toBe(true)
            }
            if (plan.grid.anchors.length === 2) {
              const [first, second] = plan.grid.anchors
              expect(
                Math.abs(second.p[1] - first.p[1]),
                `${shape}/${mode}/${pitchMM ?? 'auto'}/${density}/${rung.label} lost gravity orientation`,
              ).toBeGreaterThanOrEqual(Math.abs(second.p[0] - first.p[0]))
            }
          }
          expect(
            light.grid.anchors.every(({ p }) => populationKeys.has(pointKey(p))),
            `${shape}/${mode}/${pitchMM ?? 'auto'}/${standardRung.label} Light left its construction`,
          ).toBe(true)
          expect(
            light.grid.anchors.every(({ p }) => rimKeys.has(pointKey(p))),
            `${shape}/${mode}/${pitchMM ?? 'auto'}/${standardRung.label} Light retained an interior node`,
          ).toBe(true)
        }
      }
    }
    expect(compared).toBe(50)
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
    const auto = semanticLadder((sizeMM) => stdShapeContour('circle', sizeMM), DEFAULT_LAW, 'auto')
    const standard = semanticLadder((sizeMM) => stdShapeContour('circle', sizeMM), DEFAULT_LAW, 'standard')

    expect(auto.map((rung) => rung.label)).toEqual(['ONE', 'S', 'M', 'L'])
    expect(standard.map((rung) => rung.label)).toEqual(['ONE', 'S', 'M', 'L'])
    expect(auto.map((rung) => rung.gridExtentMM)).toEqual([22, 70, 118, 166])
    expect(standard.map((rung) => rung.gridExtentMM)).toEqual([22, 70, 118, 166])
  })

  it('uses the configured size ceiling, not label exhaustion, as the terminal gate', () => {
    for (const shape of ['circle', 'triangle', 'diamondShape'] as const) {
      const ladder = semanticLadder((sizeMM) => stdShapeContour(shape, sizeMM))
      expect(ladder.every((rung) => rung.sizeMM <= DEFAULT_LAW.maxRungMM)).toBe(true)
    }
  })

})
