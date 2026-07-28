import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  GridWorkerRequestCoalescer,
  GridWorkerDisposedError,
  GridWorkerInactiveError,
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

  emit(response: GridWorkerResponse<TestResult>): void {
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

describe('preemptive exact grid worker scheduler', () => {
  it('resolves an active current plan before the unfinished ladder, then resumes the ladder', async () => {
    const { scheduler, workers } = fixture()
    const ladder = requestGridWorkerJobInBackground(
      { key: 'ladder', value: 1 },
      (job, priority) => scheduler.request(job, priority),
    )
    const plan = scheduler.request({ key: 'current-plan', value: 2 })

    expect(workers[0].requests[0].job.key).toBe('ladder')
    expect(workers[0].terminated).toBe(true)
    expect(workers[1].requests[0].job.key).toBe('current-plan')

    await Promise.resolve()
    workers[1].succeed()
    await expect(plan).resolves.toEqual({ key: 'current-plan', value: 2 })
    expect(workers[1].requests[1].job.key).toBe('ladder')

    workers[1].succeed(1)
    await expect(ladder).resolves.toEqual({ key: 'ladder', value: 1 })
    scheduler.dispose()
  })

  it('coalesces identical in-flight work and serves the completed exact cache', async () => {
    const { scheduler, workers } = fixture()
    const first = scheduler.request({ key: 'same', value: 1 })
    const duplicate = scheduler.request({ key: 'same', value: 1 })

    expect(duplicate).toBe(first)
    expect(workers).toHaveLength(1)
    expect(workers[0].requests).toHaveLength(1)
    workers[0].succeed()
    await expect(first).resolves.toEqual({ key: 'same', value: 1 })

    expect(scheduler.peek({ key: 'same', value: 99 }))
      .toEqual({ key: 'same', value: 1 })
    await expect(scheduler.request({ key: 'same', value: 99 }))
      .resolves.toEqual({ key: 'same', value: 1 })
    expect(workers[0].requests).toHaveLength(1)
    scheduler.dispose()
  })

  it('physically terminates stale active CPU and starts the latest request immediately', async () => {
    const { scheduler, workers } = fixture()
    const stale = scheduler.request({ key: 'slow-circle', value: 1 })
    const staleRejected = stale.catch((error) => error)
    const latest = scheduler.request({ key: 'square', value: 2 })

    expect(workers).toHaveLength(2)
    expect(workers[0].terminated).toBe(true)
    expect(workers[1].requests[0].job.key).toBe('square')
    await expect(staleRejected).resolves.toBeInstanceOf(GridWorkerSupersededError)

    workers[1].succeed()
    await expect(latest).resolves.toEqual({ key: 'square', value: 2 })
    scheduler.dispose()
  })

  it('ignores a terminated worker response and publishes only the matching latest id/key', async () => {
    const { scheduler, workers } = fixture()
    const stale = scheduler.request({ key: 'stale', value: 1 })
    void stale.catch(() => {})
    const latest = scheduler.request({ key: 'latest', value: 2 })

    workers[0].emit({ id: workers[0].requests[0].id, ok: true, result: { key: 'stale', value: 1 } })
    expect(scheduler.pendingCount).toBe(1)
    workers[1].succeed()
    await expect(latest).resolves.toEqual({ key: 'latest', value: 2 })
    scheduler.dispose()
  })

  it('queues background work but lets an active request pre-empt the running background worker', async () => {
    const { scheduler, workers } = fixture()
    const warming = scheduler.request({ key: 'warm-a', value: 1 }, 'background')
    const warmingRejected = warming.catch((error) => error)
    const queued = scheduler.request({ key: 'warm-b', value: 2 }, 'background')
    const active = scheduler.request({ key: 'active', value: 3 })

    expect(workers[0].terminated).toBe(true)
    expect(workers[1].requests[0].job.key).toBe('active')
    await expect(warmingRejected).resolves.toBeInstanceOf(GridWorkerSupersededError)
    workers[1].succeed()
    await expect(active).resolves.toEqual({ key: 'active', value: 3 })

    expect(workers[1].requests[1].job.key).toBe('warm-b')
    workers[1].succeed(1)
    await expect(queued).resolves.toEqual({ key: 'warm-b', value: 2 })
    scheduler.dispose()
  })

  it('promotes a queued duplicate to active instead of leaving the latest intent behind stale CPU', async () => {
    const { scheduler, workers } = fixture()
    const stale = scheduler.request({ key: 'stale', value: 1 }, 'background')
    const staleRejected = stale.catch((error) => error)
    const queued = scheduler.request({ key: 'latest', value: 2 }, 'background')
    const promoted = scheduler.request({ key: 'latest', value: 2 }, 'active')

    expect(promoted).toBe(queued)
    expect(workers).toHaveLength(2)
    expect(workers[0].terminated).toBe(true)
    expect(workers[1].requests[0].job.key).toBe('latest')
    await expect(staleRejected).resolves.toBeInstanceOf(GridWorkerSupersededError)
    workers[1].succeed()
    await expect(promoted).resolves.toEqual({ key: 'latest', value: 2 })
    scheduler.dispose()
  })

  it('still terminates stale CPU when the latest active intent is already cached', async () => {
    const { scheduler, workers } = fixture()
    const seed = scheduler.request({ key: 'cached', value: 2 })
    workers[0].succeed()
    await seed

    const stale = scheduler.request({ key: 'stale', value: 1 })
    const staleRejected = stale.catch((error) => error)
    await expect(scheduler.request({ key: 'cached', value: 99 }))
      .resolves.toEqual({ key: 'cached', value: 2 })

    expect(workers[0].terminated).toBe(true)
    await expect(staleRejected).resolves.toBeInstanceOf(GridWorkerSupersededError)
    scheduler.dispose()
  })

  it('stops every pending inactive-door job without discarding its exact cache', async () => {
    const { scheduler, workers } = fixture()
    const cached = scheduler.request({ key: 'cached', value: 1 })
    workers[0].succeed()
    await cached

    const current = scheduler.request({ key: 'inactive-current', value: 2 })
    const queued = scheduler.request({ key: 'inactive-queued', value: 3 }, 'background')
    const currentRejected = current.catch((error) => error)
    const queuedRejected = queued.catch((error) => error)

    scheduler.cancelPending()

    expect(workers[0].terminated).toBe(true)
    expect(scheduler.pendingCount).toBe(0)
    await expect(currentRejected).resolves.toBeInstanceOf(GridWorkerInactiveError)
    await expect(queuedRejected).resolves.toBeInstanceOf(GridWorkerInactiveError)

    const workerCount = workers.length
    await expect(scheduler.request({ key: 'cached', value: 99 }))
      .resolves.toEqual({ key: 'cached', value: 1 })
    expect(workers).toHaveLength(workerCount)
    scheduler.dispose()
  })

  it('pins prewarmed static results outside dynamic LRU eviction for the active generation', async () => {
    const { scheduler, workers } = fixture()
    scheduler.activateStaticGeneration('law-a')
    const pinned = scheduler.prewarm({ key: 'static', value: 1 }, 'law-a')
    workers[0].succeed()
    await pinned

    for (let index = 0; index < 5; index++) {
      const dynamic = scheduler.request({ key: `dynamic-${index}`, value: index })
      workers[0].succeed(index + 1)
      await dynamic
    }
    const requestCount = workers[0].requests.length
    await expect(scheduler.request({ key: 'static', value: 99 }))
      .resolves.toEqual({ key: 'static', value: 1 })
    expect(workers[0].requests).toHaveLength(requestCount)
    scheduler.dispose()
  })

  it('clears pinned static results on law generation change and rejects stale-generation writes', async () => {
    const { scheduler, workers } = fixture()
    scheduler.activateStaticGeneration('law-a')
    const stale = scheduler.prewarm({ key: 'static', value: 1 }, 'law-a')
    scheduler.activateStaticGeneration('law-b')
    workers[0].succeed()
    await stale

    for (let index = 0; index < 5; index++) {
      const dynamic = scheduler.request({ key: `replacement-${index}`, value: index })
      workers[0].succeed(index + 1)
      await dynamic
    }
    const recomputed = scheduler.prewarm({ key: 'static', value: 2 }, 'law-b')
    workers[0].succeed(6)
    await expect(recomputed).resolves.toEqual({ key: 'static', value: 2 })
    scheduler.dispose()
  })

  it('terminates its only live worker and rejects every pending request on dispose', async () => {
    const { scheduler, workers } = fixture()
    const current = scheduler.request({ key: 'current', value: 1 })
    const queued = scheduler.request({ key: 'queued', value: 2 }, 'background')
    const currentRejected = current.catch((error) => error)
    const queuedRejected = queued.catch((error) => error)

    scheduler.dispose()
    expect(workers).toHaveLength(1)
    expect(workers[0].terminated).toBe(true)
    expect(scheduler.pendingCount).toBe(0)
    await expect(currentRejected).resolves.toBeInstanceOf(GridWorkerDisposedError)
    await expect(queuedRejected).resolves.toBeInstanceOf(GridWorkerDisposedError)
    await expect(scheduler.request({ key: 'after', value: 3 }))
      .rejects.toBeInstanceOf(GridWorkerDisposedError)
  })
})

describe('transient grid worker request coalescer', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reduces ten transient drag values from ten worker starts to one exact final request', async () => {
    vi.useFakeTimers()
    const direct = fixture()
    const directRejections: Promise<unknown>[] = []
    for (let value = 0; value < 10; value++) {
      directRejections.push(
        direct.scheduler.request({ key: `direct-${value}`, value }).catch(error => error),
      )
    }
    expect(direct.workers).toHaveLength(10)
    expect(direct.workers.filter(worker => worker.terminated)).toHaveLength(9)
    direct.scheduler.dispose()
    await Promise.all(directRejections)

    const coalesced = fixture()
    const requests = new GridWorkerRequestCoalescer<TestJob, TestResult>({ delayMS: 50 })
    const staleRejections: Promise<unknown>[] = []
    let final!: Promise<TestResult>
    for (let value = 0; value < 10; value++) {
      const promise = requests.request(
        { key: `drag-${value}`, value },
        `drag-${value}`,
        job => coalesced.scheduler.request(job),
      )
      if (value < 9) staleRejections.push(promise.catch(error => error))
      else final = promise
    }

    expect(coalesced.workers).toHaveLength(0)
    expect(requests.flush(
      { key: 'drag-9', value: 9 },
      'drag-9',
      job => coalesced.scheduler.request(job),
    )).toBe(final)
    expect(coalesced.workers).toHaveLength(1)
    expect(coalesced.workers[0].requests).toHaveLength(1)
    expect(coalesced.workers[0].requests[0].job).toEqual({ key: 'drag-9', value: 9 })
    expect(coalesced.workers[0].terminated).toBe(false)

    coalesced.workers[0].succeed()
    await expect(final).resolves.toEqual({ key: 'drag-9', value: 9 })
    for (const rejected of staleRejections) {
      await expect(rejected).resolves.toBeInstanceOf(GridWorkerSupersededError)
    }
    coalesced.scheduler.dispose()
  })

  it('physically preempts a paused transient solve when the settled value supersedes it', async () => {
    vi.useFakeTimers()
    const { scheduler, workers } = fixture()
    const requests = new GridWorkerRequestCoalescer<TestJob, TestResult>({ delayMS: 50 })
    const stale = requests.request(
      { key: 'paused-drag', value: 1 },
      'paused-drag',
      job => scheduler.request(job),
    )
    const staleRejected = stale.catch(error => error)

    await vi.advanceTimersByTimeAsync(50)
    expect(workers).toHaveLength(1)
    expect(workers[0].requests[0].job.key).toBe('paused-drag')

    const latest = requests.request(
      { key: 'settled', value: 2 },
      'settled',
      job => scheduler.request(job),
    )
    expect(requests.flush(
      { key: 'settled', value: 2 },
      'settled',
      job => scheduler.request(job),
    )).toBe(latest)

    expect(workers).toHaveLength(2)
    expect(workers[0].terminated).toBe(true)
    expect(workers[1].requests[0].job).toEqual({ key: 'settled', value: 2 })
    await expect(staleRejected).resolves.toBeInstanceOf(GridWorkerSupersededError)

    workers[1].succeed()
    await expect(latest).resolves.toEqual({ key: 'settled', value: 2 })
    scheduler.dispose()
  })
})
