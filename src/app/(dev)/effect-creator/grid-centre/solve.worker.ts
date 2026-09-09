// solve.worker.ts — transport only: decode the request, call the headless solve, post the result.
// The solve body moved verbatim to src/lib/effect/pipeline/solve.ts (T1 S1, 2026-09-02).

import { deliverRecord, solveGrid, type GridRequest, type RecordRequest } from '@/lib/effect/pipeline'
import { toPageModel } from '@/lib/effect/adapters/gridViewModel'

const ctx = self as unknown as Worker

ctx.onmessage = (e: MessageEvent<(GridRequest | RecordRequest) & { id: number }>) => {
  const { id, ...req } = e.data
  try {
    // a released record is delivered, not searched — same transport, same page model
    if ('record' in req) { ctx.postMessage({ id, record: true, model: toPageModel(deliverRecord(req)) }); return }
    ctx.postMessage({ id, model: toPageModel(solveGrid(req)) })
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
