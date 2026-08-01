import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LAW,
  GRID_ENGINE_CACHE_VERSION,
  GRID_ENGINE_POLICY_SIGNATURE,
  handleGridJob,
  type GridDensity,
  type GridJob,
  type GridPlanOptions,
  type StandardLadderShape,
} from '../grid'
import {
  cachedGridJob,
  createGridWorkerClient,
  gridJobKey,
  requestGridJob,
} from '../grid-client'
import {
  GRID_STATIC_CATALOGUE_CACHE_VERSION,
  GRID_STATIC_CATALOGUE_ENTRIES,
  GRID_STATIC_CATALOGUE_POLICY_SIGNATURE,
} from '../grid-static-catalogue.generated'

const shapes: readonly StandardLadderShape[] = [
  'square',
  'circle',
  'triangle',
  'diamondShape',
]
const densities: readonly GridDensity[] = ['standard', 'light']

function liveGridLabJob(shape: StandardLadderShape, density: GridDensity): GridJob {
  const options: GridPlanOptions = {
    attachment: 'magnetic',
    source: 'std',
    mode: 'auto',
    density,
    paddingMM: 10,
    plan: 'auto',
    center: 'centroid',
    baseMarginMM: 0,
    maxGrowMM: 0,
    signedBaseMargin: true,
    diagnosticVelcro: true,
  }
  return {
    operation: 'ladder',
    recipe: { kind: 'standard', shape },
    law: { ...DEFAULT_LAW, paddingMM: 10 },
    mode: 'auto',
    options,
  }
}

describe('version-locked Grid Lab static catalogue', () => {
  it('matches the current engine generation and every direct engine result byte-for-byte', () => {
    expect(GRID_STATIC_CATALOGUE_CACHE_VERSION).toBe(GRID_ENGINE_CACHE_VERSION)
    expect(GRID_STATIC_CATALOGUE_POLICY_SIGNATURE).toBe(GRID_ENGINE_POLICY_SIGNATURE)
    expect(GRID_STATIC_CATALOGUE_ENTRIES).toHaveLength(shapes.length * densities.length)

    for (const entry of GRID_STATIC_CATALOGUE_ENTRIES) {
      expect(JSON.stringify(entry.result)).toBe(JSON.stringify(handleGridJob(entry.job)))
      if (entry.result.operation === 'ladder') {
        const labels: string[] = entry.result.value.map((rung) => rung.label)
        expect(entry.result.value.every((rung) => rung.points >= 2)).toBe(true)
        expect(labels).not.toContain('ONE')
      }
    }
  })

  it('covers every standard shape and density through the exact live Grid Lab identity', () => {
    const client = createGridWorkerClient()
    const observed = new Set<string>()

    for (const shape of shapes) for (const density of densities) {
      const job = liveGridLabJob(shape, density)
      const result = client.peek(job)
      expect(result?.key).toBe(gridJobKey(job))
      observed.add(`${shape}/${density}`)
    }

    expect([...observed].sort()).toEqual(
      shapes.flatMap((shape) => densities.map((density) => `${shape}/${density}`)).sort(),
    )
    client.dispose()
  })

  it('publishes a caller frame from the neutral static ladder without a worker solve', async () => {
    let compared = 0
    for (const shape of shapes) for (const density of densities) {
      const baseJob = liveGridLabJob(shape, density)
      if (baseJob.operation !== 'ladder') throw new Error('Expected a ladder job.')
      const framedJob: GridJob = {
        ...baseJob,
        options: { ...baseJob.options, frameBufferMM: 3 },
      }
      const base = cachedGridJob(baseJob)
      const framed = cachedGridJob(framedJob)
      const requested = await requestGridJob(framedJob)
      if (base?.operation !== 'ladder' || framed?.operation !== 'ladder') {
        throw new Error('Expected both static ladder results.')
      }

      expect(requested).toEqual(framed)
      expect(framed.key).toBe(gridJobKey(framedJob))
      expect(framed.value).toHaveLength(base.value.length)
      for (let index = 0; index < base.value.length; index++) {
        compared++
        expect(framed.value[index]).toMatchObject({
          baseSizeMM: base.value[index].baseSizeMM,
          sizeMM: base.value[index].baseSizeMM + 6,
          frameBufferMM: 3,
          construction: base.value[index].construction,
        })
      }
    }
    expect(compared).toBeGreaterThan(0)
  })

  it('leaves a changed law out of the static table for exact lazy worker fallback', () => {
    const client = createGridWorkerClient()
    const job = liveGridLabJob('square', 'standard')
    if (job.operation !== 'ladder') throw new Error('Expected a ladder job.')
    const changedLaw = {
      ...job,
      law: { ...DEFAULT_LAW, paddingMM: DEFAULT_LAW.paddingMM + 1 },
    } satisfies GridJob

    expect(client.peek(changedLaw)).toBeUndefined()
    client.dispose()
  })
})
