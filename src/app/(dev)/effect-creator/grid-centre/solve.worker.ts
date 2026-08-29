// solve.worker.ts — TRANSPORT. It keeps the solve off the main thread and caches results; it does
// not compute, measure, choose or fall back.
//
// It used to be the second half of the engine: it baked the centre, resolved the band, ran an
// entirely separate solve path for manual scale, assembled the canvas model and picked which offer
// to draw. That is why manual and band could disagree — they were two engines. Both now go through
// one door as two envelopes, and the only thing that differs is the size measured at.
//
// The gate over this file forbids the old vocabulary by name, comments included: a file that still
// talks about the path it replaced is one edit away from calling it again.

import { runPipeline, type PipelineRequest, type PipelineResult } from '@/lib/effect/pipeline'
import { benchModel } from '@/lib/effect/grid-magnet-bridge'
import type { MagnetPlan } from '@/lib/effect/types'

interface SolveRequest {
  id: number
  request: PipelineRequest
  /** The attempt the viewer picked, by stable id. Null draws the shape with nothing selected —
   *  the engine never picks one for them. */
  selectedAttemptId: string | null
  plan: MagnetPlan
}

const ctx = self as unknown as Worker

// Computed once = computed. A result is keyed by the request that produced it, and a request is
// DATA, so the key is the request itself — no hand-rolled signature to drift out of step with it.
const CACHE_CAP = 12
const cache = new Map<string, PipelineResult>()

function cachedRun(request: PipelineRequest): PipelineResult {
  const key = JSON.stringify(request)
  const hit = cache.get(key)
  if (hit) return hit
  const result = runPipeline(request)
  cache.set(key, result)
  if (cache.size > CACHE_CAP) cache.delete(cache.keys().next().value!)
  return result
}

ctx.onmessage = (event: MessageEvent<SolveRequest>) => {
  try {
    const result = cachedRun(event.data.request)
    ctx.postMessage({
      id: event.data.id,
      model: benchModel(result, event.data.selectedAttemptId, event.data.plan),
    })
  } catch (error) {
    ctx.postMessage({ id: event.data.id, model: null, error: String((error as Error)?.message ?? error) })
  }
}
