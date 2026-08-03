import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LAW,
  GRID_ENGINE_CACHE_VERSION,
  GRID_ENGINE_POLICY_SIGNATURE,
  gridLadderCacheKey,
  gridPlanCacheKey,
  canonicalGridCacheValue,
  handleGridJob,
  resolveGridPlan,
  resolveGridPlanFromRecipe,
  scaleContour,
  semanticLadderFromRecipe,
  type Attachment,
  type GridDensity,
  type GridMode,
  type GridPlanOptions,
  type LadderRecipe,
  type PlanRecipe,
  type SizeLaw,
} from '../grid'
import { BoundedResultCache, StaticResultTable } from '../grid-cache'
import type { Contour } from '../types'

const STANDARD_SHAPES = ['square', 'diamondShape', 'triangle', 'circle'] as const
const MODES: GridMode[] = ['auto', 'standard', 'diamond', 'quincunx']
const DENSITIES: GridDensity[] = ['standard', 'light']
const ATTACHMENTS: Attachment[] = ['magnetic', 'twinfix', 'velcro']

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value))
}

function expectByteIdentical(actual: unknown, direct: unknown): void {
  expect([...jsonBytes(actual)]).toEqual([...jsonBytes(direct)])
  expect([...jsonBytes(structuredClone(actual))]).toEqual([...jsonBytes(direct)])
}

describe('exact grid recipe handlers', () => {
  for (const shape of STANDARD_SHAPES) for (const mode of MODES) {
    it(`keeps the neutral ${shape}/${mode} ladder byte-identical`, () => {
      const recipe: LadderRecipe = { kind: 'standard', shape }
      const direct = semanticLadderFromRecipe(recipe, DEFAULT_LAW, mode)
      const handled = handleGridJob({ operation: 'ladder', recipe, law: DEFAULT_LAW, mode })

      expect(handled.operation).toBe('ladder')
      expect(handled.key).toBe(gridLadderCacheKey(recipe, DEFAULT_LAW, mode))
      expectByteIdentical(handled.value, direct)
    }, 20_000)
  }

  for (const shape of STANDARD_SHAPES) for (const attachment of ATTACHMENTS) {
    it(`keeps the default ${shape}/${attachment} plan byte-identical`, () => {
      const recipe: PlanRecipe = { kind: 'standard', shape, widthMM: 118, heightMM: 118 }
      const options = { attachment }
      const direct = resolveGridPlanFromRecipe(recipe, options)
      const handled = handleGridJob({ operation: 'plan', recipe, options })

      expect(handled.operation).toBe('plan')
      expect(handled.key).toBe(gridPlanCacheKey(recipe, options))
      expectByteIdentical(handled.value, direct)
    }, 20_000)
  }

  for (const shape of STANDARD_SHAPES) for (const mode of MODES) {
    for (const density of DENSITIES) for (const attachment of ATTACHMENTS) {
      it(`keeps the neutral ${shape}/${mode}/${density}/${attachment} plan byte-identical`, () => {
        const recipe: PlanRecipe = { kind: 'standard', shape, widthMM: 118, heightMM: 118 }
        const options: GridPlanOptions = {
          attachment,
          mode,
          density,
          paddingMM: 10,
          plan: 'auto',
          center: 'centroid',
          baseMarginMM: 0,
          maxGrowMM: 0,
          signedBaseMargin: true,
          diagnosticVelcro: true,
        }
        const direct = resolveGridPlanFromRecipe(recipe, options)
        const handled = handleGridJob({ operation: 'plan', recipe, options })

        expect(handled.operation).toBe('plan')
        expect(handled.key).toBe(gridPlanCacheKey(recipe, options))
        expectByteIdentical(handled.value, direct)
      }, 20_000)
    }
  }

  it('preserves exact float coordinates and holes through uniform-contour materialization', () => {
    const unitContour: Contour = {
      outer: { pts: [
        [0.123456789012345, 0.234567890123456],
        [1.123456789012345, 0.234567890123456],
        [1.123456789012345, 1.234567890123456],
        [0.123456789012345, 1.234567890123456],
      ] },
      holes: [{ pts: [
        [0.423456789012345, 0.534567890123456],
        [0.823456789012345, 0.534567890123456],
        [0.823456789012345, 0.934567890123456],
        [0.423456789012345, 0.934567890123456],
      ] }],
    }
    const recipe: PlanRecipe = { kind: 'uniform-contour', unitContour, longestMM: 118.125 }
    const options: GridPlanOptions = {
      mode: 'standard',
      density: 'light',
      maxGrowMM: 0,
      signedBaseMargin: true,
      diagnosticVelcro: true,
    }
    const direct = resolveGridPlan(scaleContour(unitContour, 118.125), options)
    const handled = handleGridJob({ operation: 'plan', recipe, options })

    expect(handled.operation).toBe('plan')
    expectByteIdentical(handled.value, direct)
    expect(handled.key).toContain('0.123456789012345')
  })

  it('preserves an irregular final freeform contour without normalization or resampling', () => {
    const contourMM: Contour = {
      outer: { pts: [
        [0.125, 0.25], [180.875, 0.25], [180.875, 60.5],
        [110.375, 60.5], [110.375, 180.625], [0.125, 180.625],
      ] },
      holes: [],
    }
    const recipe: PlanRecipe = { kind: 'final-contour', contourMM }
    const attachment: Attachment = 'magnetic'
    const options = { attachment, source: 'magic' as const }
    const direct = resolveGridPlan(contourMM, options)
    const handled = handleGridJob({ operation: 'plan', recipe, options })

    expect(handled.operation).toBe('plan')
    expectByteIdentical(handled.value, direct)
  })

  it('publishes fixed-96 square extents through bounded perimeter support', () => {
    const recipe: LadderRecipe = { kind: 'standard', shape: 'square' }
    const options: GridPlanOptions = {
      mode: 'standard',
      density: 'light',
      paddingMM: 10,
      pitchMM: 96,
      maxGrowMM: 0,
    }
    const handled = handleGridJob({
      operation: 'ladder',
      recipe,
      law: DEFAULT_LAW,
      mode: 'standard',
      options,
    })

    expect(handled.operation).toBe('ladder')
    if (handled.operation !== 'ladder') throw new Error('Expected a ladder result.')
    // The OFFERED range is what the panel publishes; ONE stays in the result as a retained
    // construction (8.8(d): a range limit never changes what the solver found).
    const offered = handled.value.filter((rung) => rung.visible)
    expect(offered.map((rung) => rung.sizeMM)).toEqual([116, 212, 308])
    expect(offered.map((rung) => rung.points)).toEqual([4, 8, 12])
    expect(handled.key).toBe(gridLadderCacheKey(recipe, DEFAULT_LAW, 'standard', options))
    expect(handled.key).not.toBe(gridLadderCacheKey(
      recipe,
      DEFAULT_LAW,
      'standard',
      { ...options, pitchMM: 48 },
    ))
  })
})

describe('exact grid cache identity', () => {
  const squareLadder: LadderRecipe = { kind: 'standard', shape: 'square' }
  const squarePlan: PlanRecipe = { kind: 'standard', shape: 'square', widthMM: 118, heightMM: 118 }

  it('is canonical across object insertion order without rounding numbers', () => {
    const first = canonicalGridCacheValue({ b: 2, a: [0.123456789012345, true] })
    const second = canonicalGridCacheValue({ a: [0.123456789012345, true], b: 2 })
    expect(first).toBe(second)
    expect(first).toContain('0.123456789012345')
    expect(canonicalGridCacheValue(-0)).toBe('-0')
  })

  it('rejects non-finite coordinates and degenerate rings before cache admission', () => {
    expect(() => gridPlanCacheKey({
      kind: 'final-contour',
      contourMM: { outer: { pts: [[0, 0], [1, 0], [Number.NaN, 1]] }, holes: [] },
    }, { attachment: 'magnetic' })).toThrow('finite coordinates')
    expect(() => gridLadderCacheKey({
      kind: 'uniform-contour',
      unitContour: { outer: { pts: [[0, 0], [1, 0]] }, holes: [] },
    })).toThrow('at least three points')
  })

  it('changes the neutral identity only for consumed ladder/plan inputs', () => {
    expect(gridLadderCacheKey(squareLadder)).toBe(gridLadderCacheKey({ ...squareLadder }))
    expect(gridLadderCacheKey(squareLadder))
      .not.toBe(gridLadderCacheKey({ kind: 'standard', shape: 'circle' }))
    expect(gridPlanCacheKey(squarePlan, { attachment: 'magnetic' }))
      .not.toBe(gridPlanCacheKey(squarePlan, { attachment: 'twinfix' }))
  })

  it('changes the ladder key for every mutable ladder input', () => {
    const baseLaw = { ...DEFAULT_LAW }
    const base = gridLadderCacheKey(squareLadder, baseLaw, 'auto')
    const mutations: SizeLaw[] = [
      { ...baseLaw, paddingMM: 11 },
      { ...baseLaw, maxTestedMM: 215 },
      { ...baseLaw, maxRungMM: 309 },
    ]
    for (const law of mutations) expect(gridLadderCacheKey(squareLadder, law, 'auto')).not.toBe(base)
    expect(gridLadderCacheKey(squareLadder, baseLaw, 'standard')).not.toBe(base)
    expect(gridLadderCacheKey(squareLadder, baseLaw, 'auto', { source: 'gen' })).not.toBe(base)
    expect(gridLadderCacheKey(squareLadder, baseLaw, 'auto', { density: 'standard' })).not.toBe(base)
    expect(gridLadderCacheKey(squareLadder, baseLaw, 'auto', { center: 'bbox' })).not.toBe(base)
    expect(gridLadderCacheKey(squareLadder, baseLaw, 'auto', { frameBufferMM: 1 })).not.toBe(base)
  })

  it('changes the plan key for every consumed option and normalizes effective defaults', () => {
    const defaults = gridPlanCacheKey(squarePlan)
    expect(gridPlanCacheKey(squarePlan, {})).toBe(defaults)
    expect(gridPlanCacheKey(squarePlan, {
      attachment: 'magnetic',
      mode: 'auto',
      density: 'light',
      paddingMM: 10,
      plan: 'auto',
      center: 'centroid',
      baseMarginMM: 0,
      maxGrowMM: 12,
      targetAnchors: 4,
    })).toBe(defaults)

    const mutations: GridPlanOptions[] = [
      { attachment: 'twinfix' },
      { source: 'gen' },
      { mode: 'standard' },
      { density: 'standard' },
      { paddingMM: 11 },
      { plan: 'all6' },
      { center: 'bbox' },
      { baseMarginMM: -1 },
      { maxGrowMM: 13 },
      { pitchMM: 48 },
      { targetAnchors: 5 },
      { signedBaseMargin: true },
      { diagnosticVelcro: true },
      { frameBufferMM: 1 },
      {
        construction: {
          pattern: 'standard',
          pitchMM: 48,
          originMM: [11, 11],
          basisMM: [[48, 0], [0, 48]],
          population: [[0, 0], [1, 0]],
        },
      },
    ]
    for (const options of mutations) expect(gridPlanCacheKey(squarePlan, options)).not.toBe(defaults)
  })

  it('includes the explicit engine version and engine-owned policy signature', () => {
    // 17, not 16: the mode-mask line and the frameless-sizing line each independently reached 16, so a
    // client holding either parent's catalogue would have matched the merged engine and been served
    // stale ladders. Same defect class as the bump that made 16 necessary in the first place.
    expect(GRID_ENGINE_CACHE_VERSION).toBe(17)
    expect(GRID_ENGINE_POLICY_SIGNATURE).not.toContain('"user"')
    expect(GRID_ENGINE_POLICY_SIGNATURE).not.toContain('"admin"')
    expect(GRID_ENGINE_POLICY_SIGNATURE).toContain('"preparedContourEpsilonMM"')
    expect(gridLadderCacheKey(squareLadder)).toContain(`"cacheVersion":${GRID_ENGINE_CACHE_VERSION}`)
  })
})

describe('bounded exact result stores', () => {
  it('evicts the least-recently-used dynamic result by entry count', () => {
    const cache = new BoundedResultCache<string>({ maxEntries: 2, maxBytes: 100 })
    expect(cache.set('a', 'A', 10)).toBe(true)
    expect(cache.set('b', 'B', 10)).toBe(true)
    expect(cache.get('a')).toBe('A')
    expect(cache.set('c', 'C', 10)).toBe(true)

    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('c')).toBe(true)
    expect(cache.byteSize).toBe(20)
  })

  it('bounds dynamic results by bytes and never rewrites an oversized result', () => {
    const cache = new BoundedResultCache<string>({ maxEntries: 4, maxBytes: 12 })
    expect(cache.set('a', 'A', 7)).toBe(true)
    expect(cache.set('b', 'B', 7)).toBe(true)
    expect(cache.has('a')).toBe(false)
    expect(cache.has('b')).toBe(true)
    expect(cache.set('large', 'unchanged', 13)).toBe(false)
    expect(cache.has('large')).toBe(false)
  })

  it('pins only the active static generation and rejects stale writes', () => {
    const table = new StaticResultTable<string>()
    expect(table.activate('law-a')).toBe(true)
    expect(table.set('law-a', 'square', 'A')).toBe(true)
    expect(table.get('square')).toBe('A')
    expect(table.activate('law-b')).toBe(true)
    expect(table.get('square')).toBeUndefined()
    expect(table.set('law-a', 'circle', 'stale')).toBe(false)
    expect(table.set('law-b', 'circle', 'B')).toBe(true)
    expect(table.get('circle')).toBe('B')
  })
})
