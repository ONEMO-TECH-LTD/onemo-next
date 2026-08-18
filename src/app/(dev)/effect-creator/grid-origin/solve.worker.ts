// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { computeGrid, type GridConfig } from '@/lib/effect/grid-origin'
import { makeSizer } from '@/lib/effect/grid-origin-bridge'
import type { Contour } from '@/lib/effect/types'

interface SolveRequest {
  id: number
  base: Contour
  offsetMM: number
  cfg: GridConfig
  sizeMM: number
}

const ctx = self as unknown as Worker

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, base, offsetMM, cfg, sizeMM } = e.data
  try {
    const sized = makeSizer(base, offsetMM)
    const contour = sized(sizeMM)
    ctx.postMessage({ id, model: { contour, grid: computeGrid(contour, cfg), effSize: sizeMM } })
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
