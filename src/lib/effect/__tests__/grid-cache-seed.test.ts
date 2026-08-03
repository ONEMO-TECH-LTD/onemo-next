import { describe, expect, it } from 'vitest'

import { gridJsonBytes } from '../grid-byte-oracle'
import { jsonByteLength } from '../grid-cache'
import {
  GRID_CACHE_SEED_ENVELOPE_MAX_BYTES,
  GRID_CACHE_SEED_MAX_BYTES,
  DEFAULT_LAW,
  handleGridJob,
  handleGridWorkerJob,
  gridPlanCacheKey,
  type GridCacheSeed,
  type GridJob,
  type GridJobResult,
  type GridWorkerEnvelope,
  type Attachment,
  type LadderRecipe,
} from '../grid'
import {
  decodeGridWorkerResult,
  gridJobKey,
} from '../grid-client'
import {
  GridWorkerScheduler,
  type GridWorkerLike,
  type GridWorkerRequest,
  type GridWorkerResponse,
} from '../grid-worker-client'

class ManualGridWorker implements GridWorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  readonly requests: GridWorkerRequest<GridJob>[] = []
  terminated = false

  postMessage(message: unknown): void {
    this.requests.push(message as GridWorkerRequest<GridJob>)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(result: GridWorkerEnvelope): void {
    const request = this.requests.at(-1)!
    const response: GridWorkerResponse<GridWorkerEnvelope> = {
      id: request.id,
      ok: true,
      result,
    }
    this.onmessage?.({ data: response } as MessageEvent)
  }
}

function fixture() {
  const workers: ManualGridWorker[] = []
  const scheduler = new GridWorkerScheduler<GridJob, GridJobResult, GridWorkerEnvelope>({
    createWorker: () => {
      const worker = new ManualGridWorker()
      workers.push(worker)
      return worker
    },
    keyOfJob: gridJobKey,
    keyOfResult: (result) => result.key,
    decodeWorkerResult: decodeGridWorkerResult,
  })
  return { scheduler, workers }
}

function cloneSeed(seed: GridCacheSeed): GridCacheSeed {
  return structuredClone(seed)
}

describe('S1d exact neutral ladder cache seeds', () => {
  const ladderRecipes: LadderRecipe[] = [
    { kind: 'standard', shape: 'square' },
    { kind: 'rounded-square', radiusMM: 10, minimumAnchors: 4 },
    {
      kind: 'uniform-contour',
      unitContour: {
        outer: { pts: [[0, 0], [1, 0], [1, 1], [0, 1]] },
        holes: [],
      },
    },
  ]

  const attachments: Attachment[] = ['magnetic', 'twinfix', 'velcro']

  it.each(ladderRecipes.flatMap((recipe) => attachments.map((attachment) => ({ recipe, attachment }))))(
    'keeps the outward $recipe.kind ladder byte-identical and seeds emitted $attachment rungs',
    ({ recipe, attachment }) => {
    const job: GridJob = { operation: 'ladder', recipe, options: { attachment } }
    const direct = handleGridJob(job)
    const transport = handleGridWorkerJob(job)

    expect(gridJsonBytes(transport.result)).toBe(gridJsonBytes(direct))
    expect(transport.result.operation).toBe('ladder')
    expect(transport.cacheSeeds).toHaveLength(
      transport.result.operation === 'ladder' ? transport.result.value.length : 0,
    )
    for (const seed of transport.cacheSeeds) {
      expect(seed.job.options?.attachment).toBe(attachment)
      expect(gridJsonBytes(seed.result)).toBe(gridJsonBytes(handleGridJob(seed.job)))
      expect(jsonByteLength(seed)).toBeLessThanOrEqual(GRID_CACHE_SEED_MAX_BYTES)
    }
    expect(transport.cacheSeeds.reduce((sum, seed) => sum + jsonByteLength(seed), 0))
      .toBeLessThanOrEqual(GRID_CACHE_SEED_ENVELOPE_MAX_BYTES)
  }, 20_000)

  it('unwraps only the original ladder result and serves seeded rung plans from the existing LRU', async () => {
    const { scheduler, workers } = fixture()
    const ladderJob: GridJob = {
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    }
    const transport = handleGridWorkerJob(ladderJob)
    const request = scheduler.request(ladderJob)
    workers[0].emit(transport)

    await expect(request).resolves.toEqual(transport.result)
    const firstSeed = transport.cacheSeeds[0]
    expect(scheduler.peek(firstSeed.job)).toEqual(firstSeed.result)
    await expect(scheduler.request(firstSeed.job)).resolves.toEqual(firstSeed.result)
    expect(workers[0].requests).toHaveLength(1)
    scheduler.dispose()
  }, 20_000)

  it('seeds a margin-derived uniform rung with the exact design scale and outward margin', () => {
    const recipe: LadderRecipe = {
      kind: 'uniform-contour',
      unitContour: {
        outer: {
          pts: [
            [0.08, 0], [0.12, 0.24], [0.25, 0.38], [0.32, 0.58],
            [0.28, 0.78], [0.35, 1], [0.46, 0.78], [0.57, 0.78],
            [0.68, 1], [0.72, 0.78], [0.68, 0.58], [0.76, 0.38],
            [0.9, 0.24], [0.94, 0],
          ],
        },
        holes: [],
      },
      maxMarginMM: 12,
    }
    const transport = handleGridWorkerJob({
      operation: 'ladder',
      recipe,
      law: { ...DEFAULT_LAW, maxTestedMM: 166, maxRungMM: 166 },
      options: { source: 'magic', density: 'standard' },
    })
    if (transport.result.operation !== 'ladder') throw new Error('Expected ladder result')
    const rungIndex = transport.result.value.findIndex(({ marginMM }) => marginMM > 0)
    const rung = transport.result.value[rungIndex]
    const seed = transport.cacheSeeds[rungIndex]

    expect(rungIndex).toBeGreaterThanOrEqual(0)
    expect(seed.job.recipe).toMatchObject({
      kind: 'uniform-contour',
      longestMM: rung.designSizeMM,
    })
    expect(seed.job.options?.baseMarginMM).toBe(rung.marginMM)
    expect(seed.result.value.grid.anchors).toHaveLength(rung.points)
    expect(gridJsonBytes(seed.result)).toBe(gridJsonBytes(handleGridJob(seed.job)))
  }, 20_000)

  it('fails a late malformed seed without partially mutating the LRU', async () => {
    const { scheduler, workers } = fixture()
    const ladderJob: GridJob = {
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    }
    const transport = handleGridWorkerJob(ladderJob)
    const firstSeed = transport.cacheSeeds[0]
    const malformed = cloneSeed(transport.cacheSeeds.at(-1)!)
    malformed.result.key = `${malformed.result.key}-wrong`
    const request = scheduler.request(ladderJob)
    workers[0].emit({
      result: transport.result,
      cacheSeeds: [firstSeed, malformed],
    })

    await expect(request).rejects.toThrow('wrong key')
    expect(scheduler.peek(firstSeed.job)).toBeUndefined()
    expect(workers[0].terminated).toBe(true)
    scheduler.dispose()
  }, 20_000)

  it('fails a non-byte-identical duplicate before any cache insertion', async () => {
    const { scheduler, workers } = fixture()
    const ladderJob: GridJob = {
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    }
    const transport = handleGridWorkerJob(ladderJob)
    const firstSeed = transport.cacheSeeds[0]
    const conflicting = cloneSeed(firstSeed)
    conflicting.result.value.nearestAnchorMM = (conflicting.result.value.nearestAnchorMM ?? 0) + 1
    const request = scheduler.request(ladderJob)
    workers[0].emit({
      result: transport.result,
      cacheSeeds: [firstSeed, conflicting],
    })

    await expect(request).rejects.toThrow('not byte-identical')
    expect(scheduler.peek(firstSeed.job)).toBeUndefined()
    scheduler.dispose()
  }, 20_000)

  it.each(attachments)('accepts a correctly keyed %s seed', (attachment) => {
    const transport = handleGridWorkerJob({
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
      options: { attachment },
    })
    const seed = cloneSeed(transport.cacheSeeds[0])
    expect(decodeGridWorkerResult(
      { result: transport.result, cacheSeeds: [seed] },
      { peekCached: () => undefined },
    ).cacheSeeds).toEqual([{
      key: seed.result.key,
      value: seed.result,
      bytes: jsonByteLength(seed.result),
    }])
  }, 20_000)

  it('rejects a seed missing a required plan field', () => {
    const transport = handleGridWorkerJob({
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    })
    const malformed = cloneSeed(transport.cacheSeeds[0])
    // `anchors` is a field the validator genuinely requires — the point of this test.
    delete (malformed.result.value.grid as unknown as Record<string, unknown>).anchors

    expect(() => decodeGridWorkerResult(
      { result: transport.result, cacheSeeds: [malformed] },
      { peekCached: () => undefined },
    )).toThrow('malformed cache seed')
  }, 20_000)

  it('accepts an identical existing value but fails a conflicting existing cache value', () => {
    const transport = handleGridWorkerJob({
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    })
    const seed = transport.cacheSeeds[0]
    const identical = decodeGridWorkerResult(
      { result: transport.result, cacheSeeds: [seed] },
      { peekCached: () => seed.result },
    )
    const conflicting = cloneSeed(seed)
    conflicting.result.value.nearestAnchorMM = (conflicting.result.value.nearestAnchorMM ?? 0) + 1

    expect(identical.cacheSeeds).toEqual([])
    expect(() => decodeGridWorkerResult(
      { result: transport.result, cacheSeeds: [seed] },
      { peekCached: () => conflicting.result },
    )).toThrow('not byte-identical')
  }, 20_000)

  it('skips an oversized seed without changing or rejecting the outward ladder result', () => {
    const transport = handleGridWorkerJob({
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    })
    const oversized = cloneSeed(transport.cacheSeeds[0])
    oversized.result.value.grid.issues.push('x'.repeat(GRID_CACHE_SEED_MAX_BYTES))
    const decoded = decodeGridWorkerResult(
      { result: transport.result, cacheSeeds: [oversized] },
      { peekCached: () => undefined },
    )

    expect(decoded.result).toEqual(transport.result)
    expect(decoded.cacheSeeds).toEqual([])
  }, 20_000)

  it('keeps a deterministic seed prefix within the total envelope budget', () => {
    const transport = handleGridWorkerJob({
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    })
    const seeds = Array.from({ length: 6 }, (_, index) => {
      const seed = cloneSeed(transport.cacheSeeds[0])
      seed.job.recipe = {
        kind: 'standard',
        shape: 'square',
        widthMM: 70 + index,
        heightMM: 70 + index,
      }
      seed.result.key = gridPlanCacheKey(seed.job.recipe, seed.job.options)
      seed.result.value.grid.issues.push(String(index).repeat(900 * 1024))
      return seed
    })
    const decoded = decodeGridWorkerResult(
      { result: transport.result, cacheSeeds: seeds },
      { peekCached: () => undefined },
    )

    expect(decoded.cacheSeeds).toHaveLength(4)
    expect(decoded.cacheSeeds?.map(({ key }) => key))
      .toEqual(seeds.slice(0, 4).map(({ result }) => result.key))
  }, 20_000)
})
