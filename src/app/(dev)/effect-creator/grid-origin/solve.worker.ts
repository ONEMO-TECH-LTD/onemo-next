// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { BANDS, computeGrid, fitSizeInBand, type GridConfig } from '@/lib/effect/grid-origin'
import { makeSizer } from '@/lib/effect/grid-origin-bridge'
import type { Contour } from '@/lib/effect/types'

interface SolveRequest {
  id: number
  base: Contour
  offsetMM: number
  cfg: GridConfig
  mode: number | 'free'
  sizeMM: number
  snapStep: number
  stepSel: number | null
}

const ctx = self as unknown as Worker

// The band walk depends on everything EXCEPT the selected step — stepping the ladder reuses it.
let walkKey = ''
let walkFit: ReturnType<typeof fitSizeInBand> | null = null

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, base, offsetMM, cfg, mode, sizeMM, snapStep, stepSel } = e.data
  try {
    const sized = makeSizer(base, offsetMM)
    if (mode !== 'free') {
      const band = BANDS.find((b) => b.id === mode) ?? BANDS[0]
      const pts = base.outer.pts
      const key = JSON.stringify([offsetMM, cfg, mode, snapStep, pts.length, pts[0], pts[pts.length >> 1]])
      if (key !== walkKey || !walkFit) { walkFit = fitSizeInBand(sized, cfg, band.minMM, snapStep); walkKey = key }
      const fit = walkFit
      const idx = fit.ladder.length ? Math.min(stepSel ?? fit.pickIdx, fit.ladder.length - 1) : 0
      const eff = fit.ladder.length ? fit.ladder[idx].sizeMM : fit.sizeMM
      const grid = eff === fit.sizeMM ? fit.grid : computeGrid(sized(eff), cfg)
      const contour = sized(eff)
      ctx.postMessage({ id, model: { contour, grid, effSize: eff, ladder: fit.ladder, idx, segments: grid.segments } })
    } else {
      const contour = sized(sizeMM)
      const grid = computeGrid(contour, cfg)
      ctx.postMessage({ id, model: { contour, grid, effSize: sizeMM, ladder: [], idx: 0, segments: grid.segments } })
    }
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
