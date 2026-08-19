// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { BANDS, computeGrid, fitSizeInBand, type GridConfig, type GridResult } from '@/lib/effect/grid-origin'
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

// Computed once = computed. Per-size solves are keyed by shape + config and reused across
// free-slider moves, manual band scaling and re-walks; a new shape clears everything.
let shapeSig = ''
const freeCache = new Map<string, { contour: Contour; grid: GridResult }>()
const walkCaches = new Map<string, Map<number, GridResult>>()
const FREE_CAP = 400
const WALK_CAP = 6

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, base, offsetMM, cfg, mode, sizeMM, snapStep, stepSel } = e.data
  try {
    const sized = makeSizer(base, offsetMM)
    const pts = base.outer.pts
    const sig = JSON.stringify([offsetMM, pts.length, pts[0], pts[pts.length >> 1]])
    if (sig !== shapeSig) { shapeSig = sig; freeCache.clear(); walkCaches.clear(); walkKey = ''; walkFit = null }
    const cfgSig = JSON.stringify(cfg)
    if (mode !== 'free') {
      const band = BANDS.find((b) => b.id === mode) ?? BANDS[0]
      let sizeCache = walkCaches.get(cfgSig)
      if (!sizeCache) {
        sizeCache = new Map()
        walkCaches.set(cfgSig, sizeCache)
        if (walkCaches.size > WALK_CAP) walkCaches.delete(walkCaches.keys().next().value!)
      }
      const key = JSON.stringify([cfgSig, mode, snapStep])
      if (key !== walkKey || !walkFit) {
        walkFit = fitSizeInBand(sized, { ...cfg, solveCache: sizeCache }, band.minMM, snapStep)
        walkKey = key
      }
      const fit = walkFit
      const idx = fit.ladder.length ? Math.min(stepSel ?? fit.pickIdx, fit.ladder.length - 1) : 0
      const eff = fit.ladder.length ? fit.ladder[idx].sizeMM : fit.sizeMM
      const grid = eff === fit.sizeMM ? fit.grid : computeGrid(sized(eff), cfg)
      const contour = sized(eff)
      ctx.postMessage({ id, model: { contour, grid, effSize: eff, ladder: fit.ladder, idx, segments: grid.segments } })
    } else {
      const k = cfgSig + '|' + sizeMM
      let hit = freeCache.get(k)
      if (!hit) {
        const contour = sized(sizeMM)
        hit = { contour, grid: computeGrid(contour, cfg) }
        freeCache.set(k, hit)
        if (freeCache.size > FREE_CAP) freeCache.delete(freeCache.keys().next().value!)
      }
      ctx.postMessage({ id, model: { contour: hit.contour, grid: hit.grid, effSize: sizeMM, ladder: [], idx: 0, segments: hit.grid.segments } })
    }
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
