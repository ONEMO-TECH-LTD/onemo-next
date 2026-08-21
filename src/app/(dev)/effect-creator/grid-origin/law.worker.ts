// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { autoFlapInBand, BANDS, computeGrid, FLAP_MM, fitSizeInBand, impliedFlapMM, type GridConfig, type GridResult } from '@/lib/magnetic-grid/centre-clone-engine'
import { makeSizer } from '@/lib/effect/magnetic-grid-clone-bridge'
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
  /** Auto-flap micro-module: when set, bands scan the allowance from 0 up to this max. */
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
    const cacheFor = (f: number) => sizeCacheOf(JSON.stringify({ ...cfg, flapMM: f }))
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
  const walkFlap = autoFlapMaxMM != null ? 0 : Math.max(0, cfg.flapMM ?? FLAP_MM)
  const walkBase: GridConfig = autoFlapMaxMM != null ? { ...cfg, flapMM: 0 } : cfg
  const walkSig = autoFlapMaxMM != null ? JSON.stringify(walkBase) : cfgSig
  // Must mirror the Centre-rules band walk exactly, including its seat inflation.
  const walkCfg: GridConfig = { ...walkBase, segmentsDetail: 'light', seatMarginMM: walkFlap }
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
    const pts = base.outer.pts
    // Full-content hash — sampling (length + two points) collided across shapes (F2, Meta QA).
    let h = 0
    for (let i = 0; i < pts.length; i++) {
      h = (Math.imul(h, 31) + Math.round(pts[i][0] * 1000)) | 0
      h = (Math.imul(h, 31) + Math.round(pts[i][1] * 1000)) | 0
    }
    const sig = JSON.stringify([offsetMM, pts.length, h])
    if (sig !== shapeSig) { shapeSig = sig; freeCache.clear(); walkCaches.clear(); walkFits.clear() }
    const cfgSig = JSON.stringify(cfg)
    if (mode !== 'free') {
      const { fit, autoFlapMM } = bandFit(sized, cfg, cfgSig, mode, snapStep, autoFlapMaxMM ?? null)
      const idx = fit.ladder.length ? Math.min(stepSel ?? fit.pickIdx, fit.ladder.length - 1) : 0
      const eff = fit.ladder.length ? fit.ladder[idx].sizeMM : fit.sizeMM
      // A stepped rung renders the layout that QUALIFIED it: reach AND margin at the
      // auto-chosen allowance, never the dial (F1 — Meta QA, verified).
      const effFlap = Math.max(0, autoFlapMM ?? cfg.flapMM ?? 0)
      const grid = eff === fit.sizeMM ? fit.grid : computeGrid(sized(eff), { ...cfg, flapMM: effFlap, seatMarginMM: effFlap })
      const contour = sized(eff)
      ctx.postMessage({ id, model: { contour, grid, effSize: eff, ladder: fit.ladder, idx, segments: grid.segments, autoFlapMM } })
    } else {
      const k = cfgSig + '|' + sizeMM
      let hit = freeCache.get(k)
      if (!hit) {
        const contour = sized(sizeMM)
        hit = { contour, grid: computeGrid(contour, cfg) }
        freeCache.set(k, hit)
        if (freeCache.size > FREE_CAP) freeCache.delete(freeCache.keys().next().value!)
      }
      // Free-mode auto flap: report the allowance THIS size implies — the binding disc gap.
      const freeAuto = autoFlapMaxMM != null
        ? Math.min(autoFlapMaxMM, Math.round(impliedFlapMM(hit.contour.outer.pts, hit.grid.anchors.map((a) => a.p), hit.grid.spotRadiusMM)))
        : null
      ctx.postMessage({ id, model: { contour: hit.contour, grid: hit.grid, effSize: sizeMM, ladder: [], idx: 0, segments: hit.grid.segments, autoFlapMM: freeAuto } })
    }
    schedulePrefetch(gen, sized, cfg, cfgSig, snapStep, autoFlapMaxMM ?? null)
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
