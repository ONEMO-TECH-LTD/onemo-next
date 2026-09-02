// solve.worker.ts — transport only: decode the request, call the headless solve, post the result.
// The solve body moved verbatim to src/lib/effect/pipeline/solve.ts (T1 S1, 2026-09-02).

import { solveGrid } from '@/lib/effect/pipeline/solve'
import type { GridRequest } from '@/lib/effect/pipeline/types'

const ctx = self as unknown as Worker

ctx.onmessage = (e: MessageEvent<GridRequest & { id: number }>) => {
  const { id, ...req } = e.data
  try {
    ctx.postMessage({ id, model: solveGrid(req) })
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
