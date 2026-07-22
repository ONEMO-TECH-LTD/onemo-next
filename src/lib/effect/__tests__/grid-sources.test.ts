// Cross-source contract: every Creator shape family reaches the same grid facade under every mode/density.

import { describe, expect, it } from 'vitest'
import { getShape, type VectorShapeKind } from '@/lib/shape-library'
import { generateShapeRing, type ShapeKind } from '@/app/(dev)/effect-creator/v5.3.1/user/shapes'
import { contourFromShape } from '../geometry-truth'
import { resolveGridPlan, scaleContour, stdShapeContour, type GridDensity, type GridMode } from '../grid-admin'
import { resolveUserPlan } from '../grid-user'
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
  const user = resolveUserPlan(contour, { attachment: 'magnetic' })
  expect(user.pattern, `${name}/user-auto-pattern`).not.toBe('quincunx')
  expect(user.grid.attachment, `${name}/user-attachment`).toBe('magnetic')
  for (const mode of MODES) for (const density of DENSITIES) {
    const plan = resolveGridPlan(contour, { mode, density, maxGrowMM: 12 })
    expect([48, 96], `${name}/${mode}/${density}`).toContain(plan.pitchMM)
    if (mode !== 'auto') expect(plan.pattern, `${name}/${mode}/${density}`).toBe(mode)
    if (mode === 'quincunx') expect(plan.pitchMM, `${name}/${mode}/${density}`).toBe(96)
    expect(plan.resolvedMarginMM, `${name}/${mode}/${density}`).toBeGreaterThanOrEqual(0)
  }
}

describe('actual Creator source families share one engine contract', () => {
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
