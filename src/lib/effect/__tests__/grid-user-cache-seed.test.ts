import { describe, expect, it } from 'vitest'

import { gridJsonBytes } from '../grid-byte-oracle'
import { jsonByteLength } from '../grid-cache'
import {
  USER_GRID_CACHE_SEED_ENVELOPE_MAX_BYTES,
  USER_GRID_CACHE_SEED_MAX_BYTES,
  handleUserGridJob,
  handleUserGridWorkerJob,
  userPlanCacheKey,
  type UserGridCacheSeed,
  type UserGridJob,
  type UserGridJobResult,
  type UserGridWorkerEnvelope,
  type LadderRecipe,
} from '../grid-user'
import {
  decodeUserGridWorkerResult,
  userGridJobKey,
} from '../grid-user-client'
import {
  GridWorkerScheduler,
  type GridWorkerLike,
  type GridWorkerRequest,
  type GridWorkerResponse,
} from '../grid-worker-client'

class ManualUserWorker implements GridWorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  readonly requests: GridWorkerRequest<UserGridJob>[] = []
  terminated = false

  postMessage(message: unknown): void {
    this.requests.push(message as GridWorkerRequest<UserGridJob>)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(result: UserGridWorkerEnvelope): void {
    const request = this.requests.at(-1)!
    const response: GridWorkerResponse<UserGridWorkerEnvelope> = {
      id: request.id,
      ok: true,
      result,
    }
    this.onmessage?.({ data: response } as MessageEvent)
  }
}

function fixture() {
  const workers: ManualUserWorker[] = []
  const scheduler = new GridWorkerScheduler<UserGridJob, UserGridJobResult, UserGridWorkerEnvelope>({
    createWorker: () => {
      const worker = new ManualUserWorker()
      workers.push(worker)
      return worker
    },
    keyOfJob: userGridJobKey,
    keyOfResult: (result) => result.key,
    decodeWorkerResult: decodeUserGridWorkerResult,
  })
  return { scheduler, workers }
}

function cloneSeed(seed: UserGridCacheSeed): UserGridCacheSeed {
  return structuredClone(seed)
}

describe('S1d exact User ladder cache seeds', () => {
  const ladderRecipes: LadderRecipe[] = [
    { kind: 'standard', shape: 'square' },
    {
      kind: 'uniform-contour',
      unitContour: {
        outer: { pts: [[0, 0], [1, 0], [1, 1], [0, 1]] },
        holes: [],
      },
    },
  ]

  it.each(ladderRecipes)('keeps the outward $kind ladder byte-identical and seeds only emitted magnetic rungs', (recipe) => {
    const job: UserGridJob = { operation: 'ladder', recipe }
    const direct = handleUserGridJob(job)
    const transport = handleUserGridWorkerJob(job)

    expect(gridJsonBytes(transport.result)).toBe(gridJsonBytes(direct))
    expect(transport.result.operation).toBe('ladder')
    expect(transport.cacheSeeds).toHaveLength(
      transport.result.operation === 'ladder' ? transport.result.value.length : 0,
    )
    for (const seed of transport.cacheSeeds) {
      expect(seed.job.attachment).toBe('magnetic')
      expect(gridJsonBytes(seed.result)).toBe(gridJsonBytes(handleUserGridJob(seed.job)))
      expect(jsonByteLength(seed)).toBeLessThanOrEqual(USER_GRID_CACHE_SEED_MAX_BYTES)
    }
    expect(transport.cacheSeeds.reduce((sum, seed) => sum + jsonByteLength(seed), 0))
      .toBeLessThanOrEqual(USER_GRID_CACHE_SEED_ENVELOPE_MAX_BYTES)
  }, 20_000)

  it('unwraps only the original ladder result and serves seeded rung plans from the existing LRU', async () => {
    const { scheduler, workers } = fixture()
    const ladderJob: UserGridJob = {
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    }
    const transport = handleUserGridWorkerJob(ladderJob)
    const request = scheduler.request(ladderJob)
    workers[0].emit(transport)

    await expect(request).resolves.toEqual(transport.result)
    const firstSeed = transport.cacheSeeds[0]
    expect(scheduler.peek(firstSeed.job)).toEqual(firstSeed.result)
    await expect(scheduler.request(firstSeed.job)).resolves.toEqual(firstSeed.result)
    expect(workers[0].requests).toHaveLength(1)
    scheduler.dispose()
  }, 20_000)

  it('fails a late malformed seed without partially mutating the LRU', async () => {
    const { scheduler, workers } = fixture()
    const ladderJob: UserGridJob = {
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    }
    const transport = handleUserGridWorkerJob(ladderJob)
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
    const ladderJob: UserGridJob = {
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    }
    const transport = handleUserGridWorkerJob(ladderJob)
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

  it('rejects a cross-attachment seed even when its recomputed key matches', () => {
    const transport = handleUserGridWorkerJob({
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    })
    const forged = cloneSeed(transport.cacheSeeds[0])
    forged.job.attachment = 'twinfix'
    forged.result.key = userPlanCacheKey(forged.job.recipe, forged.job.attachment)

    expect(() => decodeUserGridWorkerResult(
      { result: transport.result, cacheSeeds: [forged] },
      { peekCached: () => undefined },
    )).toThrow('malformed cache seed')
  }, 20_000)

  it('accepts an identical existing value but fails a conflicting existing cache value', () => {
    const transport = handleUserGridWorkerJob({
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    })
    const seed = transport.cacheSeeds[0]
    const identical = decodeUserGridWorkerResult(
      { result: transport.result, cacheSeeds: [seed] },
      { peekCached: () => seed.result },
    )
    const conflicting = cloneSeed(seed)
    conflicting.result.value.nearestAnchorMM = (conflicting.result.value.nearestAnchorMM ?? 0) + 1

    expect(identical.cacheSeeds).toEqual([])
    expect(() => decodeUserGridWorkerResult(
      { result: transport.result, cacheSeeds: [seed] },
      { peekCached: () => conflicting.result },
    )).toThrow('not byte-identical')
  }, 20_000)

  it('skips an oversized seed without changing or rejecting the outward ladder result', () => {
    const transport = handleUserGridWorkerJob({
      operation: 'ladder',
      recipe: { kind: 'standard', shape: 'square' },
    })
    const oversized = cloneSeed(transport.cacheSeeds[0])
    oversized.result.value.grid.issues.push('x'.repeat(USER_GRID_CACHE_SEED_MAX_BYTES))
    const decoded = decodeUserGridWorkerResult(
      { result: transport.result, cacheSeeds: [oversized] },
      { peekCached: () => undefined },
    )

    expect(decoded.result).toEqual(transport.result)
    expect(decoded.cacheSeeds).toEqual([])
  }, 20_000)

  it('keeps a deterministic seed prefix within the total envelope budget', () => {
    const transport = handleUserGridWorkerJob({
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
      seed.result.key = userPlanCacheKey(seed.job.recipe, seed.job.attachment)
      seed.result.value.grid.issues.push(String(index).repeat(900 * 1024))
      return seed
    })
    const decoded = decodeUserGridWorkerResult(
      { result: transport.result, cacheSeeds: seeds },
      { peekCached: () => undefined },
    )

    expect(decoded.cacheSeeds).toHaveLength(4)
    expect(decoded.cacheSeeds?.map(({ key }) => key))
      .toEqual(seeds.slice(0, 4).map(({ result }) => result.key))
  }, 20_000)
})
