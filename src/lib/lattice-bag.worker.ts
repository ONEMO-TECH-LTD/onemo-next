import { fitOptimalBagBands, type PreparedBag } from './lattice-bag'

interface BagBandWorkerRequest {
  id: number
  prepared: PreparedBag
  allowRotation: boolean
}

const ctx: {
  onmessage: ((event: MessageEvent<BagBandWorkerRequest>) => void) | null
  postMessage(message: unknown): void
} = self as unknown as typeof ctx

ctx.onmessage = ({ data: { id, prepared, allowRotation } }) => {
  const startedAt = performance.now()
  try {
    const result = fitOptimalBagBands(prepared, allowRotation, (completed, total) => {
      ctx.postMessage({ id, type: 'progress', completed, total, elapsedMs: performance.now() - startedAt })
    })
    ctx.postMessage({ id, type: 'complete', result, elapsedMs: performance.now() - startedAt })
  } catch (error) {
    ctx.postMessage({ id, type: 'error', error: String((error as Error)?.message ?? error) })
  }
}

export {}
