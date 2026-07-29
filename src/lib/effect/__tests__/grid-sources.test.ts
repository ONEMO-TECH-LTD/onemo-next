// Cross-source contract: every Creator shape family reaches the same grid facade under every mode/density.

import { describe, expect, it } from 'vitest'
import { getShape, type VectorShapeKind } from '@/lib/shape-library'
import { shapePickDescriptor } from '@/app/(dev)/effect-creator/v5.3.1/user/editor/descriptors/shape/shape-pick'
import type { EditorCtx } from '@/app/(dev)/effect-creator/v5.3.1/user/editor/descriptors/types'
import { generateShapeRing, type ShapeKind } from '@/app/(dev)/effect-creator/v5.3.1/user/shapes'
import { contourFromShape, MANUFACTURING_TOLERANCE_MM } from '../geometry-truth'
import { DEFAULT_ROUNDED_SQUARE_CALIBRATION } from '../effect-calibration'
import { distanceToPreparedContour, prepareExactContour } from '../grid-prepared'
import { GLOBAL_OFF, resolve, type OutlineAdjustments, type OutlineSource } from '../outline-resolve'
import {
  resolveGridPlan,
  scaleContour,
  stdShapeContour,
  type GridDensity,
  type GridMode,
} from '../grid'
import type { VShape } from '@/lib/vector-core'
import type { Contour, Pt } from '../types'

const PRESETS: VectorShapeKind[] = [
  'squircle', 'square', 'circle', 'pill', 'heart', 'star', 'polygon', 'diamond', 'plus',
  'teardrop', 'leaf', 'lens', 'bolt', 'sparkle', 'pinched', 'asterisk', 'bowtie',
]
const GENERATORS: Array<{ kind: ShapeKind; params: Record<string, number> }> = [
  { kind: 'blob', params: { waviness: 55, seed: 7 } },
  { kind: 'form', params: { pinch: 55, lobes: 4 } },
  { kind: 'daisy', params: { depth: 55, petals: 8 } },
  { kind: 'pinwheel', params: { swirl: 55, blades: 5 } },
]
const MODES: GridMode[] = ['auto', 'standard', 'diamond', 'quincunx']
const DENSITIES: GridDensity[] = ['standard', 'light']

function normalized(contour: Contour): Contour {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of contour.outer.pts) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  const longest = Math.max(maxX - minX, maxY - minY)
  const shift = (pts: ReadonlyArray<Pt>) => pts.map(([x, y]) => [(x - minX) / longest, (y - minY) / longest] as Pt)
  return { outer: { pts: shift(contour.outer.pts) }, holes: contour.holes.map((h) => ({ pts: shift(h.pts) })) }
}

function exercise(name: string, contour: Contour) {
  for (const mode of MODES) for (const density of DENSITIES) {
    const plan = resolveGridPlan(contour, { mode, density, maxGrowMM: 12 })
    expect([48, 96], `${name}/${mode}/${density}`).toContain(plan.pitchMM)
    if (mode !== 'auto') expect(plan.pattern, `${name}/${mode}/${density}`).toBe(mode)
    if (mode === 'quincunx') expect(plan.pitchMM, `${name}/${mode}/${density}`).toBe(96)
    expect(plan.resolvedMarginMM, `${name}/${mode}/${density}`).toBeGreaterThanOrEqual(0)
  }
}

function pickedShape(
  kind: string,
  mmPerPx = 1,
): { shape: VShape; adjustments?: OutlineAdjustments } {
  const installations: Array<{ source: OutlineSource; adjustments?: OutlineAdjustments }> = []
  const ctx = {
    getSpec: () => ({ maskWidthPx: 1000, maskHeightPx: 1000, mmPerPx }),
    getSource: () => null,
    installSource: (source: OutlineSource, adjustments: OutlineAdjustments | undefined) => {
      installations.push({ source, adjustments })
      return { ok: true }
    },
  } as unknown as EditorCtx
  shapePickDescriptor.apply(kind, {}, ctx)
  const installed = installations[0]
  if (!installed) throw new Error(`${kind} did not install a source`)
  return {
    shape: resolve(
      installed.source,
      installed.adjustments ?? { global: { ...GLOBAL_OFF }, local: {} },
    ),
    adjustments: installed.adjustments,
  }
}

describe('actual Creator source families share one engine contract', () => {
  it('refines the true-circle tessellation only when physical sagitta exceeds manufacturing tolerance', () => {
    const catalogue = [
      { diameterMM: 70, points: 96 },
      { diameterMM: 130, points: 96 },
      { diameterMM: 174, points: 96 },
      { diameterMM: 214, points: 103 },
      { diameterMM: 262, points: 114 },
      { diameterMM: 310, points: 124 },
    ]

    for (const { diameterMM, points } of catalogue) {
      const contour = stdShapeContour('circle', diameterMM)
      const radiusMM = diameterMM / 2
      const sagittaMM = radiusMM * (1 - Math.cos(Math.PI / contour.outer.pts.length))

      expect(contour.outer.pts, `circle Ø${diameterMM} point budget`).toHaveLength(points)
      expect(sagittaMM, `circle Ø${diameterMM} radial sagitta`).toBeLessThanOrEqual(
        MANUFACTURING_TOLERANCE_MM,
      )
      if (points > 96) {
        const onePointFewerSagittaMM = radiusMM * (1 - Math.cos(Math.PI / (points - 1)))
        expect(
          onePointFewerSagittaMM,
          `circle Ø${diameterMM} uses the smallest lawful refined budget`,
        ).toBeGreaterThan(MANUFACTURING_TOLERANCE_MM)
      }
    }
  })

  it('derives one rounded-square default geometry for the preset library and Creator picker', () => {
    const library = contourFromShape(
      getShape('squircle', 1000, 1000),
      { mmPerPx: 1, maskHeightPx: 1000 },
    )
    const mmPerPx = DEFAULT_ROUNDED_SQUARE_CALIBRATION.sideMM / 720
    const picked = pickedShape('squircle', mmPerPx)
    const picker = contourFromShape(
      picked.shape,
      { mmPerPx, maskHeightPx: 1000 },
    )
    if (!library || !picker) throw new Error('rounded-square producer returned no contour')
    const library70 = scaleContour(normalized(library), 70)
    const picker70 = scaleContour(normalized(picker), 70)
    const preparedLibrary = prepareExactContour(library70)
    const preparedPicker = prepareExactContour(picker70)
    const maxProducerDeltaMM = Math.max(
      ...library70.outer.pts.map((point) => distanceToPreparedContour(point, preparedPicker)),
      ...picker70.outer.pts.map((point) => distanceToPreparedContour(point, preparedLibrary)),
    )
    const expectedPickerRadiusPx = DEFAULT_ROUNDED_SQUARE_CALIBRATION.radiusMM / mmPerPx

    expect(picked.adjustments?.global.radius).toBeCloseTo(expectedPickerRadiusPx, 9)
    expect(maxProducerDeltaMM).toBeLessThanOrEqual(MANUFACTURING_TOLERANCE_MM)
  })

  it('covers every standard geometry in every mode and density', () => {
    for (const shape of ['square', 'rect', 'circle', 'triangle', 'diamondShape'] as const) {
      exercise(`standard:${shape}`, stdShapeContour(shape, 180, shape === 'rect' ? 118 : 180))
    }
  })

  it('covers every shape-library preset in every mode and density', () => {
    for (const preset of PRESETS) {
      const contour = contourFromShape(getShape(preset, 1000, 1000), { mmPerPx: 1, maskHeightPx: 1000 })
      expect(contour, preset).not.toBeNull()
      exercise(`preset:${preset}`, scaleContour(normalized(contour!), 180))
    }
  })

  it('covers every procedural generator in every mode and density', () => {
    for (const { kind, params } of GENERATORS) {
      const ring = generateShapeRing({ kind, ...params } as Parameters<typeof generateShapeRing>[0], 1000, 1000)
      const contour: Contour = { outer: { pts: ring.map(([x, y]) => [x, 1000 - y] as Pt) }, holes: [] }
      exercise(`generator:${kind}`, scaleContour(normalized(contour), 180))
    }
  })

  it('accepts an irregular freeform/AI-style contour through the same facade', () => {
    const contour: Contour = {
      outer: { pts: [[0, 0], [180, 0], [180, 60], [110, 60], [110, 180], [0, 180]] },
      holes: [],
    }
    exercise('freeform:outline', contour)
  })
})
