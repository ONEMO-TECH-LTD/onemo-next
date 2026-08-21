// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { autoFlapInBand, BANDS, computeGrid, fitSizeInBand, type GridConfig, type GridResult } from '@/lib/magnetic-grid/engine'
import { contourIdentity, makeSizer } from '@/lib/effect/magnetic-grid-bridge'
import type { Contour } from '@/lib/effect/types'

interface SolveRequest {
  engineId: 'v351-centre-clone'
  id: number
  base: Contour
  offsetMM: number
  cfg: GridConfig
  mode: number | 'free'
  sizeMM: number
  snapStep: number
  stepSel: number | null
  /** Exact Auto cap; no allowance scan. */
  autoFlapMaxMM?: number | null
}

const ctx = self as unknown as Worker

// Computed once = computed. Per-size solves are keyed by shape + config and reused across
// free-slider moves, manual band scaling, re-walks and the idle prefetcher; a new shape
// clears everything.
let shapeSig = ''
const freeCache = new Map<string, { contour: Contour; grid: GridResult }>()
const walkCaches = new Map<string, Map<number, GridResult>>()
const walkFits = new Map<string, { fit: ReturnType<typeof fitSizeInBand>; autoFlapMM: number | null }>()
const FREE_CAP = 400
const WALK_CAP = 10
const FITS_CAP = 12

function sizeCacheOf(sig: string): Map<number, GridResult> {
  let m = walkCaches.get(sig)
  if (!m) {
    m = new Map()
    walkCaches.set(sig, m)
    if (walkCaches.size > WALK_CAP) walkCaches.delete(walkCaches.keys().next().value!)
  }
  return m
}

/** The one band-solve routine — the click path and the prefetcher share it byte for byte. */
function bandFit(
  sized: (mm: number) => Contour, cfg: GridConfig, cfgSig: string,
  bandId: number, snapStep: number, autoFlapMaxMM: number | null,
): { fit: ReturnType<typeof fitSizeInBand>; autoFlapMM: number | null } {
  const key = JSON.stringify([cfgSig, bandId, snapStep, autoFlapMaxMM])
  const hit = walkFits.get(key)
  if (hit) return hit
  const band = BANDS.find((b) => b.id === bandId) ?? BANDS[0]
  let out: { fit: ReturnType<typeof fitSizeInBand>; autoFlapMM: number | null }
  if (autoFlapMaxMM != null) {
    const cacheFor = (f: number) => sizeCacheOf(JSON.stringify({ ...cfg, wrapMode: 'auto', autoFlapCapMM: f }))
    const auto = autoFlapInBand(sized, cfg, band.minMM, snapStep, autoFlapMaxMM, cacheFor)
    out = { fit: auto.fit, autoFlapMM: auto.flapMM }
  } else {
    out = { fit: fitSizeInBand(sized, { ...cfg, solveCache: sizeCacheOf(cfgSig) }, band.minMM, snapStep), autoFlapMM: null }
  }
  walkFits.set(key, out)
  if (walkFits.size > FITS_CAP) walkFits.delete(walkFits.keys().next().value!)
  return out
}

// Idle prefetch — between interactions the worker warms every band for the current shape and
// dials, one size per macrotask so a real request always interrupts within one solve.
let gen = 0
function schedulePrefetch(
  myGen: number, sized: (mm: number) => Contour, cfg: GridConfig, cfgSig: string,
  snapStep: number, autoFlapMaxMM: number | null,
): void {
  const walkBase: GridConfig = autoFlapMaxMM != null
    ? { ...cfg, wrapMode: 'auto', autoFlapCapMM: autoFlapMaxMM }
    : { ...cfg, wrapMode: 'fixed' }
  const walkSig = autoFlapMaxMM != null ? JSON.stringify(walkBase) : cfgSig
  const walkCfg: GridConfig = { ...walkBase, segmentsDetail: 'light', seatMarginMM: 0 }
  const cache = sizeCacheOf(walkSig)
  const sizes: number[] = []
  for (const b of BANDS) for (let mm = b.minMM; mm <= b.maxMM; mm += Math.max(1, snapStep)) if (!cache.has(mm)) sizes.push(mm)
  let i = 0
  const bandsLeft = BANDS.map((b) => b.id)
  const step = () => {
    if (myGen !== gen) return
    if (i < sizes.length) {
      const mm = sizes[i++]
      if (!cache.has(mm)) cache.set(mm, computeGrid(sized(mm), walkCfg))
      setTimeout(step, 0)
      return
    }
    const bandId = bandsLeft.shift()
    if (bandId === undefined) return
    bandFit(sized, cfg, cfgSig, bandId, snapStep, autoFlapMaxMM)
    setTimeout(step, 0)
  }
  setTimeout(step, 0)
}

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, engineId, base, offsetMM, cfg, mode, sizeMM, snapStep, stepSel, autoFlapMaxMM } = e.data
  gen++
  try {
    if (engineId !== 'v351-centre-clone') throw new Error('wrong engine identity')
    const sized = makeSizer(base, offsetMM)
    const sig = JSON.stringify([contourIdentity(base), offsetMM])
    if (sig !== shapeSig) { shapeSig = sig; freeCache.clear(); walkCaches.clear(); walkFits.clear() }
    const cfgSig = JSON.stringify(cfg)
    if (mode !== 'free') {
      const { fit } = bandFit(sized, cfg, cfgSig, mode, snapStep, autoFlapMaxMM ?? null)
      const idx = fit.ladder.length ? Math.min(stepSel ?? fit.pickIdx, fit.ladder.length - 1) : 0
      const eff = fit.ladder.length ? fit.ladder[idx].sizeMM : fit.sizeMM
      // A stepped rung renders the layout that QUALIFIED it: reach AND margin at the
      // auto-chosen allowance, never a scanned/rounded substitute.
      const wrapCfg: GridConfig = autoFlapMaxMM != null
        ? { ...cfg, wrapMode: 'auto', autoFlapCapMM: autoFlapMaxMM, seatMarginMM: 0 }
        : { ...cfg, wrapMode: 'fixed', seatMarginMM: 0 }
      const grid = eff === fit.sizeMM ? fit.grid : computeGrid(sized(eff), wrapCfg)
      const contour = sized(eff)
      const reportedAuto = autoFlapMaxMM != null && grid.wrap.status === 'lawful'
        ? grid.wrap.appliedFlapApproxMM
        : null
      ctx.postMessage({ id, model: { contour, grid, effSize: eff, ladder: fit.ladder, idx, segments: grid.segments, autoFlapMM: reportedAuto } })
    } else {
      const wrapCfg: GridConfig = autoFlapMaxMM != null
        ? { ...cfg, wrapMode: 'auto', autoFlapCapMM: autoFlapMaxMM }
        : { ...cfg, wrapMode: 'fixed' }
      const k = JSON.stringify(wrapCfg) + '|' + sizeMM
      let hit = freeCache.get(k)
      if (!hit) {
        const contour = sized(sizeMM)
        hit = { contour, grid: computeGrid(contour, wrapCfg) }
        freeCache.set(k, hit)
        if (freeCache.size > FREE_CAP) freeCache.delete(freeCache.keys().next().value!)
      }
      const freeAuto = autoFlapMaxMM != null && hit.grid.wrap.status === 'lawful'
        ? hit.grid.wrap.appliedFlapApproxMM
        : null
      ctx.postMessage({ id, model: { contour: hit.contour, grid: hit.grid, effSize: sizeMM, ladder: [], idx: 0, segments: hit.grid.segments, autoFlapMM: freeAuto } })
    }
    schedulePrefetch(gen, sized, cfg, cfgSig, snapStep, autoFlapMaxMM ?? null)
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
