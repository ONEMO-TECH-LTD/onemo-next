import {
  adminLadderCacheKey,
  adminPlanCacheKey,
  type AdminGridJob,
  type AdminGridJobResult,
} from './grid-admin'
import { GridWorkerScheduler, type GridWorkerPriority } from './grid-worker-client'

let sharedClient: GridWorkerScheduler<AdminGridJob, AdminGridJobResult> | null = null

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

export function suspendAdminGridWork(): void {
  sharedClient?.cancelPending()
}
