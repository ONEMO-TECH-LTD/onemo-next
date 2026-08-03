import {
  applyFrameBufferToSemanticLadder,
  GRID_CACHE_SEED_ENVELOPE_MAX_BYTES,
  GRID_CACHE_SEED_MAX_BYTES,
  GRID_ENGINE_CACHE_VERSION,
  GRID_ENGINE_POLICY_SIGNATURE,
  gridLadderCacheKey,
  gridPlanCacheKey,
  type GridJob,
  type GridJobResult,
  type GridPlanJob,
  type GridPlanJobResult,
  type GridWorkerEnvelope,
} from './grid'
import { gridJsonBytes } from './grid-byte-oracle'
import { jsonByteLength } from './grid-cache'
import {
  GridWorkerScheduler,
  type GridWorkerCacheSeed,
  type GridWorkerDecodeContext,
  type GridWorkerDecodedResult,
  type GridWorkerPriority,
} from './grid-worker-client'
import {
  GRID_STATIC_CATALOGUE_CACHE_VERSION,
  GRID_STATIC_CATALOGUE_ENTRIES,
  GRID_STATIC_CATALOGUE_POLICY_SIGNATURE,
} from './grid-static-catalogue.generated'

let sharedClient: GridWorkerScheduler<GridJob, GridJobResult, GridWorkerEnvelope> | null = null

function neutralLadderJob(job: GridJob): GridJob {
  if (job.operation !== 'ladder' || (job.options?.frameBufferMM ?? 0) <= 0) return job
  return {
    ...job,
    options: { ...job.options, frameBufferMM: 0 },
  }
}

function applyRequestedLadderFrame(job: GridJob, result: GridJobResult): GridJobResult {
  if (job.operation !== 'ladder' || result.operation !== 'ladder') return result
  const frameBufferMM = job.options?.frameBufferMM ?? 0
  if (frameBufferMM <= 0) return result
  return {
    operation: 'ladder',
    key: gridLadderCacheKey(job.recipe, job.law, job.mode, job.options),
    value: applyFrameBufferToSemanticLadder(result.value, frameBufferMM),
  }
}

export function gridJobKey(job: GridJob): string {
  // Ladder identity includes every option that changes its serialized result. The client may reuse
  // the neutral construction solve for a presentation-only frame; the returned key remains exact.
  return job.operation === 'ladder'
    ? gridLadderCacheKey(job.recipe, job.law, job.mode, job.options)
    : gridPlanCacheKey(job.recipe, job.options)
}

export function createGridWorkerClient(): GridWorkerScheduler<GridJob, GridJobResult, GridWorkerEnvelope> {
  const scheduler = new GridWorkerScheduler({
    createWorker: () => new Worker(new URL('./grid.worker.ts', import.meta.url), { type: 'module' }),
    keyOfJob: gridJobKey,
    keyOfResult: (result) => result.key,
    decodeWorkerResult: decodeGridWorkerResult,
  })
  if (
    GRID_STATIC_CATALOGUE_CACHE_VERSION === GRID_ENGINE_CACHE_VERSION
    && GRID_STATIC_CATALOGUE_POLICY_SIGNATURE === GRID_ENGINE_POLICY_SIGNATURE
  ) {
    scheduler.loadStaticResults(
      `${GRID_STATIC_CATALOGUE_CACHE_VERSION}:${GRID_STATIC_CATALOGUE_POLICY_SIGNATURE}`,
      GRID_STATIC_CATALOGUE_ENTRIES.map(({ result }) => ({ key: result.key, value: result })),
    )
  }
  return scheduler
}

function client(): GridWorkerScheduler<GridJob, GridJobResult, GridWorkerEnvelope> {
  if (!sharedClient) sharedClient = createGridWorkerClient()
  return sharedClient
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPlanJob(value: unknown): value is GridPlanJob {
  if (!isRecord(value) || value.operation !== 'plan' || !isRecord(value.recipe)) return false
  if (value.options === undefined) return true
  if (!isRecord(value.options)) return false
  const attachment = value.options.attachment
  return attachment === undefined
    || attachment === 'magnetic'
    || attachment === 'twinfix'
    || attachment === 'velcro'
}

function isPlanResult(value: unknown): value is GridPlanJobResult {
  if (!isRecord(value) || value.operation !== 'plan' || typeof value.key !== 'string') return false
  const plan = value.value
  if (!isRecord(plan) || !isRecord(plan.grid)) return false
  return (
    isRecord(plan.designContourMM)
    && isRecord(plan.effectContourMM)
    && Array.isArray(plan.grid.anchors)
    && Array.isArray(plan.grid.flaps)
    && typeof plan.grid.uncoveredMM === 'number'
    && typeof plan.pitchMM === 'number'
    && typeof plan.baseMarginMM === 'number'
    && typeof plan.resolvedMarginMM === 'number'
    && typeof plan.grewMM === 'number'
  )
}

function duplicateMismatch(label: string): Error {
  return new Error(`Grid cache seed ${label} is not byte-identical.`)
}

/** Validate the complete worker seed batch before returning one atomic LRU commit list. */
export function decodeGridWorkerResult(
  transport: GridWorkerEnvelope,
  context: GridWorkerDecodeContext<GridJobResult>,
): GridWorkerDecodedResult<GridJobResult> {
  if (!isRecord(transport) || !isRecord(transport.result) || !Array.isArray(transport.cacheSeeds)) {
    throw new Error('Grid worker returned a malformed transport envelope.')
  }

  const seen = new Map<string, string>()
  const commits: GridWorkerCacheSeed<GridJobResult>[] = []
  let envelopeBytes = 0
  let envelopeFull = false
  for (const rawSeed of transport.cacheSeeds as unknown[]) {
    if (!isRecord(rawSeed) || !isPlanJob(rawSeed.job) || !isPlanResult(rawSeed.result)) {
      throw new Error('Grid worker returned a malformed cache seed.')
    }
    const recomputedKey = gridPlanCacheKey(rawSeed.job.recipe, rawSeed.job.options)
    if (rawSeed.result.key !== recomputedKey) {
      throw new Error('Grid worker returned a cache seed for the wrong key.')
    }

    const resultBytes = gridJsonBytes(rawSeed.result)
    const duplicate = seen.get(recomputedKey)
    if (duplicate !== undefined) {
      if (duplicate !== resultBytes) throw duplicateMismatch('duplicate')
      continue
    }
    seen.set(recomputedKey, resultBytes)

    const cached = context.peekCached(recomputedKey)
    if (cached !== undefined) {
      if (gridJsonBytes(cached) !== resultBytes) throw duplicateMismatch('existing value')
      continue
    }

    const seedBytes = jsonByteLength(rawSeed)
    if (seedBytes > GRID_CACHE_SEED_MAX_BYTES) continue
    if (envelopeFull || envelopeBytes + seedBytes > GRID_CACHE_SEED_ENVELOPE_MAX_BYTES) {
      envelopeFull = true
      continue
    }
    envelopeBytes += seedBytes
    commits.push({
      key: recomputedKey,
      value: rawSeed.result,
      bytes: jsonByteLength(rawSeed.result),
    })
  }
  return { result: transport.result as GridJobResult, cacheSeeds: commits }
}

export function requestGridJob(
  job: GridJob,
  priority: GridWorkerPriority = 'active',
): Promise<GridJobResult> {
  return client().request(neutralLadderJob(job), priority)
    .then((result) => applyRequestedLadderFrame(job, result))
}

export function cachedGridJob(job: GridJob): GridJobResult | undefined {
  const result = client().peek(neutralLadderJob(job))
  return result === undefined ? undefined : applyRequestedLadderFrame(job, result)
}

export function suspendGridWork(): void {
  sharedClient?.cancelPending()
}
