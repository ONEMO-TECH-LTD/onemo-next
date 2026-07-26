import { describe, expect, it } from 'vitest'

import {
  GridWorkerScheduler,
  GridWorkerSupersededError,
  requestGridWorkerJobInBackground,
  type GridWorkerLike,
  type GridWorkerRequest,
  type GridWorkerResponse,
} from '../grid-worker-client'

interface TestJob { key: string; value: number }
interface TestResult { key: string; value: number }

class ManualWorker implements GridWorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  readonly requests: GridWorkerRequest<TestJob>[] = []
  terminated = false

  postMessage(message: unknown): void {
    this.requests.push(message as GridWorkerRequest<TestJob>)
  }

  terminate(): void {
    this.terminated = true
  }

  succeed(requestIndex = 0): void {
    const request = this.requests[requestIndex]
    const response: GridWorkerResponse<TestResult> = {
      id: request.id,
      ok: true,
      result: { key: request.job.key, value: request.job.value },
    }
    this.onmessage?.({ data: response } as MessageEvent)
  }
}

function fixture() {
  const workers: ManualWorker[] = []
  const scheduler = new GridWorkerScheduler<TestJob, TestResult>({
    createWorker: () => {
      const worker = new ManualWorker()
      workers.push(worker)
      return worker
    },
    keyOfJob: (job) => job.key,
    keyOfResult: (result) => result.key,
    maxEntries: 4,
    maxBytes: 1_024,
  })
  return { scheduler, workers }
}

/**
 * Composition of two Sprint-1 optimisations:
 *   L1  — the size ladder now runs as a BACKGROUND job while the current plan is active.
 *   S1d — cache seeding made cached current-plan hits the COMMON path, not an edge case.
 *
 * Individually both are covered. Together they strand the queue: a cached active request
 * preempts the current job and returns immediately, but nothing restarts the background
 * queue — `startNextBackground()` is only reached from `handleMessage()` and `failCurrent()`.
 * Product effect: the size ladder can stay unresolved forever after a cached plan wins.
 */
describe('scheduler — cached active request must not strand a queued background job', () => {
  it('starts the queued background job after a cached result preempts the current one', async () => {
    const { scheduler, workers } = fixture()

    // Seed the cache with key "cached" via a normal completed round-trip.
    const seeding = scheduler.request({ key: 'cached', value: 1 })
    workers[0].succeed(0)
    await expect(seeding).resolves.toEqual({ key: 'cached', value: 1 })

    // An active job A is running.
    const activeA = scheduler.request({ key: 'A', value: 2 })
    activeA.catch(() => { /* expected to be superseded */ })

    // A background job B is queued behind it (this is the size ladder after L1).
    const backgroundB = requestGridWorkerJobInBackground(
      { key: 'B', value: 3 },
      (job, priority) => scheduler.request(job, priority),
    )
    backgroundB.catch(() => { /* must not reject */ })

    // The user lands on a plan that is already cached — the common path after S1d.
    await expect(scheduler.request({ key: 'cached', value: 1 }))
      .resolves.toEqual({ key: 'cached', value: 1 })

    // 1. B must actually be dispatched. Before the fix it never starts.
    const dispatchedKeys = workers.flatMap(w => w.requests.map(r => r.job.key))
    expect(dispatchedKeys).toContain('B')

    // 2. A must be superseded, not silently dropped.
    await expect(activeA).rejects.toBeInstanceOf(GridWorkerSupersededError)

    // 3. B must be able to COMPLETE — a dispatched-but-unanswerable job is still a strand.
    const liveWorker = workers.find(w => w.requests.some(r => r.job.key === 'B'))
    expect(liveWorker, 'no worker holds B').toBeDefined()
    const bIndex = liveWorker!.requests.findIndex(r => r.job.key === 'B')
    liveWorker!.succeed(bIndex)
    await expect(backgroundB).resolves.toEqual({ key: 'B', value: 3 })

    // 4. The queue must fully drain — nothing left pending.
    expect(scheduler.pendingCount).toBe(0)

    // 5. Teardown must leave no live worker behind.
    scheduler.dispose()
    expect(workers.every(w => w.terminated)).toBe(true)
  })
})
