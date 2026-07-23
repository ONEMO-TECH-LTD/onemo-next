import {
  userLadderCacheKey,
  userPlanCacheKey,
  type UserGridJob,
  type UserGridJobResult,
} from './grid-user'
import { GridWorkerScheduler } from './grid-worker-client'

function userJobKey(job: UserGridJob): string {
  return job.operation === 'ladder'
    ? userLadderCacheKey(job.recipe)
    : userPlanCacheKey(job.recipe, job.attachment)
}

/** Create the constrained User worker lane. No Admin job shape or module crosses this boundary. */
export function createUserGridWorkerClient(): GridWorkerScheduler<UserGridJob, UserGridJobResult> {
  return new GridWorkerScheduler({
    createWorker: () => new Worker(new URL('./grid-user.worker.ts', import.meta.url), { type: 'module' }),
    keyOfJob: userJobKey,
    keyOfResult: (result) => result.key,
  })
}
