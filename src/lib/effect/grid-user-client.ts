import {
  USER_GRID_CACHE_SEED_ENVELOPE_MAX_BYTES,
  USER_GRID_CACHE_SEED_MAX_BYTES,
  userLadderCacheKey,
  userPlanCacheKey,
  type UserGridJob,
  type UserGridJobResult,
  type UserGridWorkerEnvelope,
  type UserPlanGridJob,
  type UserPlanGridJobResult,
} from './grid-user'
import { gridJsonBytes } from './grid-byte-oracle'
import { jsonByteLength } from './grid-cache'
import {
  GridWorkerScheduler,
  type GridWorkerCacheSeed,
  type GridWorkerDecodeContext,
  type GridWorkerDecodedResult,
  type GridWorkerPriority,
} from './grid-worker-client'

let sharedClient: GridWorkerScheduler<UserGridJob, UserGridJobResult, UserGridWorkerEnvelope> | null = null

export function userGridJobKey(job: UserGridJob): string {
  return job.operation === 'ladder'
    ? userLadderCacheKey(job.recipe)
    : userPlanCacheKey(job.recipe, job.attachment)
}

/** Create the constrained User worker lane. No Admin job shape or module crosses this boundary. */
export function createUserGridWorkerClient(): GridWorkerScheduler<UserGridJob, UserGridJobResult, UserGridWorkerEnvelope> {
  return new GridWorkerScheduler({
    createWorker: () => new Worker(new URL('./grid-user.worker.ts', import.meta.url), { type: 'module' }),
    keyOfJob: userGridJobKey,
    keyOfResult: (result) => result.key,
    decodeWorkerResult: decodeUserGridWorkerResult,
  })
}

function client(): GridWorkerScheduler<UserGridJob, UserGridJobResult, UserGridWorkerEnvelope> {
  if (!sharedClient) sharedClient = createUserGridWorkerClient()
  return sharedClient
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPlanJob(value: unknown): value is UserPlanGridJob {
  if (!isRecord(value) || value.operation !== 'plan' || !isRecord(value.recipe)) return false
  return value.attachment === 'magnetic'
}

function isPlanResult(value: unknown): value is UserPlanGridJobResult {
  if (!isRecord(value) || value.operation !== 'plan' || typeof value.key !== 'string') return false
  const plan = value.value
  if (!isRecord(plan) || !isRecord(plan.grid)) return false
  return (
    isRecord(plan.designContourMM)
    && isRecord(plan.effectContourMM)
    && Array.isArray(plan.grid.anchors)
    && Array.isArray(plan.grid.rescueAnchors)
    && Array.isArray(plan.grid.flaps)
    && typeof plan.pitchMM === 'number'
    && typeof plan.baseMarginMM === 'number'
    && typeof plan.resolvedMarginMM === 'number'
    && typeof plan.grewMM === 'number'
  )
}

function duplicateMismatch(label: string): Error {
  return new Error(`User grid cache seed ${label} is not byte-identical.`)
}

/** Validate the complete worker seed batch before returning one atomic LRU commit list. */
export function decodeUserGridWorkerResult(
  transport: UserGridWorkerEnvelope,
  context: GridWorkerDecodeContext<UserGridJobResult>,
): GridWorkerDecodedResult<UserGridJobResult> {
  if (!isRecord(transport) || !isRecord(transport.result) || !Array.isArray(transport.cacheSeeds)) {
    throw new Error('User grid worker returned a malformed transport envelope.')
  }

  const seen = new Map<string, string>()
  const commits: GridWorkerCacheSeed<UserGridJobResult>[] = []
  let envelopeBytes = 0
  let envelopeFull = false
  for (const rawSeed of transport.cacheSeeds as unknown[]) {
    if (!isRecord(rawSeed) || !isPlanJob(rawSeed.job) || !isPlanResult(rawSeed.result)) {
      throw new Error('User grid worker returned a malformed cache seed.')
    }
    const recomputedKey = userPlanCacheKey(rawSeed.job.recipe, rawSeed.job.attachment)
    if (rawSeed.result.key !== recomputedKey) {
      throw new Error('User grid worker returned a cache seed for the wrong key.')
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
    if (seedBytes > USER_GRID_CACHE_SEED_MAX_BYTES) continue
    if (envelopeFull || envelopeBytes + seedBytes > USER_GRID_CACHE_SEED_ENVELOPE_MAX_BYTES) {
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
  return { result: transport.result as UserGridJobResult, cacheSeeds: commits }
}

export function requestUserGridJob(
  job: UserGridJob,
  priority: GridWorkerPriority = 'active',
): Promise<UserGridJobResult> {
  return client().request(job, priority)
}

export function cachedUserGridJob(job: UserGridJob): UserGridJobResult | undefined {
  return client().peek(job)
}

export function suspendUserGridWork(): void {
  sharedClient?.cancelPending()
}
