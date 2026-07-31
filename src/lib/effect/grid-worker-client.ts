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

export interface GridWorkerCacheSeed<Result> {
  key: string
  value: Result
  bytes: number
}

export interface GridWorkerDecodeContext<Result> {
  peekCached(key: string): Result | undefined
}

export interface GridWorkerDecodedResult<Result> {
  result: Result
  cacheSeeds?: ReadonlyArray<GridWorkerCacheSeed<Result>>
}

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

export class GridWorkerInactiveError extends Error {
  constructor() {
    super('Grid worker door is inactive.')
    this.name = 'GridWorkerInactiveError'
  }
}

/** Keep exact background work alive across active-request pre-emption without delaying the active job. */
export async function requestGridWorkerJobInBackground<Job, Result>(
  job: Job,
  request: (job: Job, priority: GridWorkerPriority) => Promise<Result>,
): Promise<Result> {
  for (;;) {
    try {
      return await request(job, 'background')
    } catch (error) {
      if (!(error instanceof GridWorkerSupersededError)) throw error
    }
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

export interface GridWorkerSchedulerOptions<Job, Result, Transport = Result> extends BoundedResultCacheOptions {
  createWorker: () => GridWorkerLike
  keyOfJob: (job: Job) => string
  keyOfResult: (result: Result) => string
  decodeWorkerResult?: (
    transport: Transport,
    context: GridWorkerDecodeContext<Result>,
  ) => GridWorkerDecodedResult<Result>
}

/** One exact-result worker lane. Active work physically pre-empts stale CPU; background work queues. */
export class GridWorkerScheduler<Job, Result, Transport = Result> {
  private readonly createWorker: () => GridWorkerLike
  private readonly keyOfJob: (job: Job) => string
  private readonly keyOfResult: (result: Result) => string
  private readonly decodeWorkerResult: (
    transport: Transport,
    context: GridWorkerDecodeContext<Result>,
  ) => GridWorkerDecodedResult<Result>
  private readonly cache: BoundedResultCache<Result>
  private readonly staticResults = new StaticResultTable<Result>()
  private readonly inFlight = new Map<string, PendingRequest<Job, Result>>()
  private readonly backgroundQueue: PendingRequest<Job, Result>[] = []
  private worker: GridWorkerLike | null = null
  private current: PendingRequest<Job, Result> | null = null
  private nextRequestId = 0
  private workerGeneration = 0
  private disposed = false

  constructor(options: GridWorkerSchedulerOptions<Job, Result, Transport>) {
    this.createWorker = options.createWorker
    this.keyOfJob = options.keyOfJob
    this.keyOfResult = options.keyOfResult
    this.decodeWorkerResult = options.decodeWorkerResult
      ?? ((transport) => ({ result: transport as unknown as Result }))
    this.cache = new BoundedResultCache(options)
  }

  request(job: Job, priority: GridWorkerPriority = 'active'): Promise<Result> {
    if (this.disposed) return Promise.reject(new GridWorkerDisposedError())
    const key = this.keyOfJob(job)
    const cached = this.staticResults.get(key) ?? this.cache.get(key)
    if (cached !== undefined) {
      if (priority === 'active' && this.current && this.current.key !== key) {
        this.preemptCurrent(new GridWorkerSupersededError(this.current.key, key))
        // A cached hit returns with no worker round-trip, so neither handleMessage nor
        // failCurrent will run and the background queue would stay stranded.
        // Not placed inside preemptCurrent: the duplicate branch below calls start()
        // immediately afterwards, which would orphan a background job started there.
        this.startNextBackground()
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

  /** Stop an inactive door's CPU and queue while preserving its exact result caches. */
  cancelPending(): void {
    if (this.disposed) return
    this.terminateWorker()
    this.rejectPending(new GridWorkerInactiveError())
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.terminateWorker()
    this.rejectPending(new GridWorkerDisposedError())
    this.cache.clear()
    this.staticResults.clear()
  }

  private rejectPending(error: Error): void {
    if (this.current) {
      this.inFlight.delete(this.current.key)
      this.current.reject(error)
      this.current = null
    }
    for (const pending of this.backgroundQueue.splice(0)) {
      this.inFlight.delete(pending.key)
      pending.reject(error)
    }
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
      this.handleMessage(event.data as GridWorkerResponse<Transport>)
    }
    worker.onerror = (event: ErrorEvent) => {
      if (worker !== this.worker || generation !== this.workerGeneration) return
      this.terminateWorker()
      this.failCurrent(new Error(event.message || 'Grid worker failed.'))
    }
    this.worker = worker
    return worker
  }

  private handleMessage(message: GridWorkerResponse<Transport>): void {
    const pending = this.current
    if (!pending || message.id !== pending.id) return
    if (!message.ok) {
      this.failCurrent(new Error(message.error))
      return
    }
    let decoded: GridWorkerDecodedResult<Result>
    try {
      decoded = this.decodeWorkerResult(message.result, {
        peekCached: (key) => this.cache.peek(key),
      })
      for (const seed of decoded.cacheSeeds ?? []) {
        if (
          typeof seed.key !== 'string'
          || this.keyOfResult(seed.value) !== seed.key
          || !Number.isFinite(seed.bytes)
          || seed.bytes < 0
        ) {
          throw new Error('Grid worker returned an invalid cache seed.')
        }
      }
    } catch (error) {
      this.terminateWorker()
      this.failCurrent(error instanceof Error ? error : new Error(String(error)))
      return
    }
    if (this.keyOfResult(decoded.result) !== pending.key) {
      this.terminateWorker()
      this.failCurrent(new Error('Grid worker returned a result for the wrong cache key.'))
      return
    }
    this.current = null
    this.inFlight.delete(pending.key)
    for (const seed of decoded.cacheSeeds ?? []) {
      this.cache.set(seed.key, seed.value, seed.bytes)
    }
    this.cache.set(pending.key, decoded.result)
    pending.resolve(decoded.result)
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
