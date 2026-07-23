import {
  BoundedResultCache,
  StaticResultTable,
  type BoundedResultCacheOptions,
} from './grid-cache'

export interface GridWorkerRequest<Job> {
  id: number
  job: Job
}

export type GridWorkerResponse<Result> =
  | { id: number; ok: true; result: Result }
  | { id: number; ok: false; error: string }

export interface GridWorkerLike {
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: unknown): void
  terminate(): void
}

export type GridWorkerPriority = 'active' | 'background'

export class GridWorkerSupersededError extends Error {
  constructor(readonly staleKey: string, readonly latestKey: string) {
    super(`Grid worker request ${staleKey} was superseded by ${latestKey}.`)
    this.name = 'GridWorkerSupersededError'
  }
}

export class GridWorkerDisposedError extends Error {
  constructor() {
    super('Grid worker scheduler is disposed.')
    this.name = 'GridWorkerDisposedError'
  }
}

interface PendingRequest<Job, Result> {
  id: number
  key: string
  job: Job
  promise: Promise<Result>
  resolve: (result: Result) => void
  reject: (error: Error) => void
}

export interface GridWorkerSchedulerOptions<Job, Result> extends BoundedResultCacheOptions {
  createWorker: () => GridWorkerLike
  keyOfJob: (job: Job) => string
  keyOfResult: (result: Result) => string
}

/** One exact-result worker lane. Active work physically pre-empts stale CPU; background work queues. */
export class GridWorkerScheduler<Job, Result> {
  private readonly createWorker: () => GridWorkerLike
  private readonly keyOfJob: (job: Job) => string
  private readonly keyOfResult: (result: Result) => string
  private readonly cache: BoundedResultCache<Result>
  private readonly staticResults = new StaticResultTable<Result>()
  private readonly inFlight = new Map<string, PendingRequest<Job, Result>>()
  private readonly backgroundQueue: PendingRequest<Job, Result>[] = []
  private worker: GridWorkerLike | null = null
  private current: PendingRequest<Job, Result> | null = null
  private nextRequestId = 0
  private workerGeneration = 0
  private disposed = false

  constructor(options: GridWorkerSchedulerOptions<Job, Result>) {
    this.createWorker = options.createWorker
    this.keyOfJob = options.keyOfJob
    this.keyOfResult = options.keyOfResult
    this.cache = new BoundedResultCache(options)
  }

  request(job: Job, priority: GridWorkerPriority = 'active'): Promise<Result> {
    if (this.disposed) return Promise.reject(new GridWorkerDisposedError())
    const key = this.keyOfJob(job)
    const cached = this.staticResults.get(key) ?? this.cache.get(key)
    if (cached !== undefined) {
      if (priority === 'active' && this.current && this.current.key !== key) {
        this.preemptCurrent(new GridWorkerSupersededError(this.current.key, key))
      }
      return Promise.resolve(cached)
    }
    const duplicate = this.inFlight.get(key)
    if (duplicate) {
      if (priority === 'active' && duplicate !== this.current) {
        const queuedIndex = this.backgroundQueue.indexOf(duplicate)
        if (queuedIndex >= 0) this.backgroundQueue.splice(queuedIndex, 1)
        if (this.current) {
          this.preemptCurrent(new GridWorkerSupersededError(this.current.key, key))
        }
        this.start(duplicate)
      }
      return duplicate.promise
    }

    let resolve!: (result: Result) => void
    let reject!: (error: Error) => void
    const promise = new Promise<Result>((onResolve, onReject) => {
      resolve = onResolve
      reject = onReject
    })
    const pending: PendingRequest<Job, Result> = {
      id: ++this.nextRequestId,
      key,
      job,
      promise,
      resolve,
      reject,
    }
    this.inFlight.set(key, pending)

    if (priority === 'active') {
      if (this.current) {
        this.preemptCurrent(new GridWorkerSupersededError(this.current.key, key))
      }
      this.start(pending)
    } else if (this.current) {
      this.backgroundQueue.push(pending)
    } else {
      this.start(pending)
    }
    return promise
  }

  activateStaticGeneration(generation: string): boolean {
    return this.staticResults.activate(generation)
  }

  peek(job: Job): Result | undefined {
    const key = this.keyOfJob(job)
    return this.staticResults.get(key) ?? this.cache.peek(key)
  }

  async prewarm(job: Job, generation: string): Promise<Result> {
    if (this.disposed) throw new GridWorkerDisposedError()
    if (this.staticResults.generation !== generation) {
      throw new Error('Grid static prewarm generation is not active.')
    }
    const key = this.keyOfJob(job)
    const existing = this.staticResults.get(key)
    if (existing !== undefined) return existing
    const result = await this.request(job, 'background')
    this.staticResults.set(generation, key, result)
    return result
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.terminateWorker()
    const error = new GridWorkerDisposedError()
    if (this.current) {
      this.inFlight.delete(this.current.key)
      this.current.reject(error)
      this.current = null
    }
    for (const pending of this.backgroundQueue.splice(0)) {
      this.inFlight.delete(pending.key)
      pending.reject(error)
    }
    this.cache.clear()
    this.staticResults.clear()
  }

  get pendingCount(): number {
    return this.inFlight.size
  }

  private start(pending: PendingRequest<Job, Result>): void {
    this.current = pending
    const worker = this.getWorker()
    try {
      worker.postMessage({ id: pending.id, job: pending.job } satisfies GridWorkerRequest<Job>)
    } catch (error) {
      this.terminateWorker()
      this.failCurrent(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private getWorker(): GridWorkerLike {
    if (this.worker) return this.worker
    const worker = this.createWorker()
    const generation = ++this.workerGeneration
    worker.onmessage = (event: MessageEvent) => {
      if (worker !== this.worker || generation !== this.workerGeneration) return
      this.handleMessage(event.data as GridWorkerResponse<Result>)
    }
    worker.onerror = (event: ErrorEvent) => {
      if (worker !== this.worker || generation !== this.workerGeneration) return
      this.terminateWorker()
      this.failCurrent(new Error(event.message || 'Grid worker failed.'))
    }
    this.worker = worker
    return worker
  }

  private handleMessage(message: GridWorkerResponse<Result>): void {
    const pending = this.current
    if (!pending || message.id !== pending.id) return
    if (!message.ok) {
      this.failCurrent(new Error(message.error))
      return
    }
    if (this.keyOfResult(message.result) !== pending.key) {
      this.terminateWorker()
      this.failCurrent(new Error('Grid worker returned a result for the wrong cache key.'))
      return
    }
    this.current = null
    this.inFlight.delete(pending.key)
    this.cache.set(pending.key, message.result)
    pending.resolve(message.result)
    this.startNextBackground()
  }

  private preemptCurrent(error: GridWorkerSupersededError): void {
    const pending = this.current
    if (!pending) return
    this.terminateWorker()
    this.current = null
    this.inFlight.delete(pending.key)
    pending.reject(error)
  }

  private failCurrent(error: Error): void {
    const pending = this.current
    if (!pending) return
    this.current = null
    this.inFlight.delete(pending.key)
    pending.reject(error)
    this.startNextBackground()
  }

  private startNextBackground(): void {
    if (this.disposed || this.current) return
    const next = this.backgroundQueue.shift()
    if (next) this.start(next)
  }

  private terminateWorker(): void {
    const worker = this.worker
    if (!worker) return
    this.worker = null
    this.workerGeneration++
    worker.onmessage = null
    worker.onerror = null
    worker.terminate()
  }
}
