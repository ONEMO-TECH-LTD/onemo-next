import { afterEach, describe, expect, it, vi } from 'vitest'

import { cancelSegmentML, disposeSegmentML, segmentML, SegmentMLCancelled } from '../segment-ml'

class SilentWorker {
  static instances: SilentWorker[] = []

  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  terminated = false
  messages: Array<{ id: number }> = []

  constructor() {
    SilentWorker.instances.push(this)
  }

  postMessage(message: { id: number }): void {
    this.messages.push(message)
  }

  terminate(): void {
    this.terminated = true
  }
}

afterEach(() => {
  disposeSegmentML()
  SilentWorker.instances = []
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ML worker lifecycle', () => {
  it('terminates a timed-out worker and creates a clean worker for the next request', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('Worker', SilentWorker)

    const first = segmentML('blob:first', 1, 1)
    const firstRejection = expect(first).rejects.toThrow('Magic timed out after 120s')
    await vi.advanceTimersByTimeAsync(120_000)
    await firstRejection
    expect(SilentWorker.instances).toHaveLength(1)
    expect(SilentWorker.instances[0].terminated).toBe(true)

    const second = segmentML('blob:second', 1, 1)
    const secondRejection = expect(second).rejects.toThrow('Magic timed out after 120s')
    expect(SilentWorker.instances).toHaveLength(2)
    expect(SilentWorker.instances[1]).not.toBe(SilentWorker.instances[0])
    await vi.advanceTimersByTimeAsync(120_000)
    await secondRejection
  })

  it('cancels every active request once, terminates its worker, and ignores late completion', async () => {
    vi.stubGlobal('Worker', SilentWorker)

    const first = segmentML('blob:first', 1, 1)
    const second = segmentML('blob:second', 1, 1)
    const worker = SilentWorker.instances[0]
    const firstRejection = expect(first).rejects.toBeInstanceOf(SegmentMLCancelled)
    const secondRejection = expect(second).rejects.toBeInstanceOf(SegmentMLCancelled)

    cancelSegmentML()
    await Promise.all([firstRejection, secondRejection])
    expect(worker.terminated).toBe(true)

    worker.onmessage?.({ data: { id: worker.messages[0].id, ok: true, data: new ArrayBuffer(4), width: 1, height: 1, adapter: 'u2netp' } } as MessageEvent)
    expect(SilentWorker.instances).toHaveLength(1)
  })

  it('settles all requests and releases the worker when the worker dies', async () => {
    vi.stubGlobal('Worker', SilentWorker)

    const first = segmentML('blob:first', 1, 1)
    const second = segmentML('blob:second', 1, 1)
    const worker = SilentWorker.instances[0]
    const firstRejection = expect(first).rejects.toThrow('worker died')
    const secondRejection = expect(second).rejects.toThrow('worker died')

    worker.onerror?.({ message: 'worker died' } as ErrorEvent)
    await Promise.all([firstRejection, secondRejection])
    expect(worker.terminated).toBe(true)
  })

  it('fails loud when a successful worker response omits adapter identity', async () => {
    vi.stubGlobal('Worker', SilentWorker)

    const result = segmentML('blob:first', 1, 1)
    const rejection = expect(result).rejects.toThrow('omitted its adapter identity')
    const worker = SilentWorker.instances[0]
    SilentWorker.instances[0].onmessage?.({
      data: { id: worker.messages[0].id, ok: true, data: new ArrayBuffer(4), width: 1, height: 1 },
    } as MessageEvent)
    await rejection
  })
})
