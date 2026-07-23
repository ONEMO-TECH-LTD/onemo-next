import {
  adminLadderCacheKey,
  adminPlanCacheKey,
  type AdminGridJob,
  type AdminGridJobResult,
} from './grid-admin'
import { GridWorkerScheduler } from './grid-worker-client'

function adminJobKey(job: AdminGridJob): string {
  return job.operation === 'ladder'
    ? adminLadderCacheKey(job.recipe, job.law, job.mode)
    : adminPlanCacheKey(job.recipe, job.options)
}

/** Create the full Admin worker lane. It is never imported by the User client or worker. */
export function createAdminGridWorkerClient(): GridWorkerScheduler<AdminGridJob, AdminGridJobResult> {
  return new GridWorkerScheduler({
    createWorker: () => new Worker(new URL('./grid-admin.worker.ts', import.meta.url), { type: 'module' }),
    keyOfJob: adminJobKey,
    keyOfResult: (result) => result.key,
  })
}
