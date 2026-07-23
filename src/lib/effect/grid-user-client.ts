import {
  userLadderCacheKey,
  userPlanCacheKey,
  type Attachment,
  type UserStandardShape,
  type UserGridJob,
  type UserGridJobResult,
} from './grid-user'
import { GridWorkerScheduler, GridWorkerSupersededError, type GridWorkerPriority } from './grid-worker-client'

const STANDARD_SHAPES: UserStandardShape[] = ['square', 'circle', 'diamondShape', 'triangle']
const ATTACHMENTS: Attachment[] = ['magnetic', 'twinfix', 'velcro']
let sharedClient: GridWorkerScheduler<UserGridJob, UserGridJobResult> | null = null
let warmPromise: Promise<void> | null = null

export function userGridJobKey(job: UserGridJob): string {
  return job.operation === 'ladder'
    ? userLadderCacheKey(job.recipe)
    : userPlanCacheKey(job.recipe, job.attachment)
}

/** Create the constrained User worker lane. No Admin job shape or module crosses this boundary. */
export function createUserGridWorkerClient(): GridWorkerScheduler<UserGridJob, UserGridJobResult> {
  return new GridWorkerScheduler({
    createWorker: () => new Worker(new URL('./grid-user.worker.ts', import.meta.url), { type: 'module' }),
    keyOfJob: userGridJobKey,
    keyOfResult: (result) => result.key,
  })
}

function client(): GridWorkerScheduler<UserGridJob, UserGridJobResult> {
  if (!sharedClient) sharedClient = createUserGridWorkerClient()
  return sharedClient
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
