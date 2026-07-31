import { afterEach, describe, expect, it, vi } from 'vitest'

import { segmentML } from '../segment-ml'

class SilentWorker {
  static instances: SilentWorker[] = []

  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminated = false

  constructor() {
    SilentWorker.instances.push(this)
  }

  postMessage(): void {}

  terminate(): void {
    this.terminated = true
  }
}

afterEach(() => {
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
})
