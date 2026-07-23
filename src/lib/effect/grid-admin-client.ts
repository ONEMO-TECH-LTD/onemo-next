import {
  adminLadderCacheKey,
  adminPlanCacheKey,
  type AdminGridJob,
  type AdminGridJobResult,
  type GridMode,
  type GridPlanOptions,
  type SizeLaw,
  type StandardLadderShape,
} from './grid-admin'
import { GridWorkerScheduler, GridWorkerSupersededError, type GridWorkerPriority } from './grid-worker-client'

const STANDARD_SHAPES: StandardLadderShape[] = ['square', 'circle', 'diamondShape', 'triangle']
let sharedClient: GridWorkerScheduler<AdminGridJob, AdminGridJobResult> | null = null
let warmToken = 0
let warmGeneration = ''
let warmPromise: Promise<void> | null = null

export function adminGridJobKey(job: AdminGridJob): string {
  return job.operation === 'ladder'
    ? adminLadderCacheKey(job.recipe, job.law, job.mode)
    : adminPlanCacheKey(job.recipe, job.options)
}

/** Create the full Admin worker lane. It is never imported by the User client or worker. */
export function createAdminGridWorkerClient(): GridWorkerScheduler<AdminGridJob, AdminGridJobResult> {
  return new GridWorkerScheduler({
    createWorker: () => new Worker(new URL('./grid-admin.worker.ts', import.meta.url), { type: 'module' }),
    keyOfJob: adminGridJobKey,
    keyOfResult: (result) => result.key,
  })
}

function client(): GridWorkerScheduler<AdminGridJob, AdminGridJobResult> {
  if (!sharedClient) sharedClient = createAdminGridWorkerClient()
  return sharedClient
}

export function requestAdminGridJob(
  job: AdminGridJob,
  priority: GridWorkerPriority = 'active',
): Promise<AdminGridJobResult> {
  return client().request(job, priority)
}

export function cachedAdminGridJob(job: AdminGridJob): AdminGridJobResult | undefined {
  return client().peek(job)
}

export function adminStaticGeneration(
  law: SizeLaw,
  mode: GridMode,
  options: GridPlanOptions,
): string {
  const ladder = adminLadderCacheKey({ kind: 'standard', shape: 'square' }, law, mode)
  const plan = adminPlanCacheKey(
    { kind: 'standard', shape: 'square', widthMM: 70, heightMM: 70 },
    options,
  )
  return `${ladder}|${plan}`
}

async function pinAdminJob(
  job: AdminGridJob,
  generation: string,
  token: number,
): Promise<AdminGridJobResult | null> {
  while (token === warmToken) {
    try {
      return await client().prewarm(job, generation)
    } catch (error) {
      if (token !== warmToken) return null
      if (!(error instanceof GridWorkerSupersededError)) throw error
    }
  }
  return null
}

/** Warm exact canonical ladders first, then rung plans for the current Admin option generation. */
export function prewarmAdminCanonicalShapes(
  law: SizeLaw,
  mode: GridMode,
  options: GridPlanOptions,
  preferred: StandardLadderShape = 'square',
  currentSizeMM = 70,
): Promise<void> {
  const generation = adminStaticGeneration(law, mode, options)
  if (generation === warmGeneration && warmPromise) return warmPromise
  warmGeneration = generation
  const token = ++warmToken
  client().activateStaticGeneration(generation)
  const order = [...new Set([preferred, ...STANDARD_SHAPES])]
  warmPromise = (async () => {
    const ladders = new Map<StandardLadderShape, Extract<AdminGridJobResult, { operation: 'ladder' }>>()
    for (const shape of order) {
      if (token !== warmToken) return
      const result = await pinAdminJob({
        operation: 'ladder',
        recipe: { kind: 'standard', shape },
        law,
        mode,
      }, generation, token)
      if (result?.operation === 'ladder') ladders.set(shape, result)
    }
    for (const shape of order) {
      if (token !== warmToken) return
      const recipe = { kind: 'standard', shape, widthMM: currentSizeMM, heightMM: currentSizeMM } as const
      await pinAdminJob({ operation: 'plan', recipe, options }, generation, token)
    }
    for (const shape of order) for (const rung of ladders.get(shape)?.value ?? []) {
      if (token !== warmToken) return
      if (rung.sizeMM === currentSizeMM) continue
      const recipe = { kind: 'standard', shape, widthMM: rung.sizeMM, heightMM: rung.sizeMM } as const
      await pinAdminJob({ operation: 'plan', recipe, options }, generation, token)
    }
  })()
  warmPromise.catch(() => {
    if (token === warmToken) warmPromise = null
  })
  return warmPromise
}
