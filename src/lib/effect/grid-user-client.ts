import {
  USER_GRID_CACHE_SEED_ENVELOPE_MAX_BYTES,
  USER_GRID_CACHE_SEED_MAX_BYTES,
  userLadderCacheKey,
  userPlanCacheKey,
  type Attachment,
  type UserStandardShape,
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
  GridWorkerSupersededError,
  type GridWorkerCacheSeed,
  type GridWorkerDecodeContext,
  type GridWorkerDecodedResult,
  type GridWorkerPriority,
} from './grid-worker-client'

const STANDARD_SHAPES: UserStandardShape[] = ['square', 'circle', 'diamondShape', 'triangle']
const ATTACHMENTS: Attachment[] = ['magnetic', 'twinfix', 'velcro']
let sharedClient: GridWorkerScheduler<UserGridJob, UserGridJobResult, UserGridWorkerEnvelope> | null = null
let warmPromise: Promise<void> | null = null

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

export function userStaticGeneration(): string {
  const ladder = userLadderCacheKey({ kind: 'standard', shape: 'square' })
  const plan = { kind: 'standard', shape: 'square', widthMM: 70, heightMM: 70 } as const
  return [ladder, ...ATTACHMENTS.map((attachment) => userPlanCacheKey(plan, attachment))].join('|')
}

async function pinUserJob(
  job: UserGridJob,
  generation: string,
): Promise<UserGridJobResult> {
  for (;;) {
    try {
      return await client().prewarm(job, generation)
    } catch (error) {
      if (!(error instanceof GridWorkerSupersededError)) throw error
    }
  }
}

/** Warm exact canonical ladders, current-size plans, then every emitted rung plan. */
export function prewarmUserCanonicalShapes(
  preferred: UserStandardShape = 'square',
  currentSizeMM = 70,
  preferredAttachment: Attachment = 'magnetic',
): Promise<void> {
  if (warmPromise) return warmPromise
  const generation = userStaticGeneration()
  client().activateStaticGeneration(generation)
  const order = [...new Set([preferred, ...STANDARD_SHAPES])]
  const attachments = [...new Set([preferredAttachment, ...ATTACHMENTS])]
  warmPromise = (async () => {
    const ladders = new Map<UserStandardShape, Extract<UserGridJobResult, { operation: 'ladder' }>>()
    for (const shape of order) {
      const result = await pinUserJob({ operation: 'ladder', recipe: { kind: 'standard', shape } }, generation)
      if (result.operation === 'ladder') ladders.set(shape, result)
    }
    for (const attachment of attachments) {
      for (const shape of order) {
        const recipe = { kind: 'standard', shape, widthMM: currentSizeMM, heightMM: currentSizeMM } as const
        await pinUserJob({ operation: 'plan', recipe, attachment }, generation)
      }
    }
    for (const shape of order) for (const rung of ladders.get(shape)?.value ?? []) {
      if (rung.sizeMM === currentSizeMM) continue
      const recipe = { kind: 'standard', shape, widthMM: rung.sizeMM, heightMM: rung.sizeMM } as const
      for (const attachment of attachments) {
        await pinUserJob({ operation: 'plan', recipe, attachment }, generation)
      }
    }
  })()
  warmPromise.catch(() => { warmPromise = null })
  return warmPromise
}
