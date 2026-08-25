// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { BANDS, computeGrid, fitSizeInBand, MIN_EFFECT_MM, type GridConfig, type GridResult } from '@/lib/effect/grid-magnet'
import { wrapBandLadder, wrapGrid, wrapGroup, type BandRung, type WrapConfig } from '@/lib/effect/grid-magnet-wrap-compute'
import { bbox, safeSegments, spotRadiusOf } from '@/lib/effect/grid-magnet-compute'
import { assignSizes, type MagnetPlan } from '@/lib/effect/grid-magnet-logic'
import { DEFAULT_PITCH_MM, MASS_DEPTH_MM, PADDING_FLOOR_MM } from '@/lib/effect/grid-magnet-spec'
import { makeSizer, sizeRange } from '@/lib/effect/grid-magnet-bridge'
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
  /** Free + snap: every slider move presses the shape onto the revealed magnets. */
  snapWrap?: boolean
}

const ctx = self as unknown as Worker

// Computed once = computed. Per-size solves are keyed by shape + config and reused across
// free-slider moves, manual band scaling, re-walks and the idle prefetcher; a new shape
// clears everything.
let shapeSig = ''
const freeCache = new Map<string, { contour: Contour; grid: GridResult }>()
const walkCaches = new Map<string, Map<number, GridResult>>()
const walkFits = new Map<string, { fit: ReturnType<typeof fitSizeInBand> }>()
const rungCache = new Map<string, BandRung[]>()
// Free+snap: one exact solve per distinct revealed layout — the plateaus of the slider.
// The FINISHED MODEL is cached, not just the solve: inside a plateau every slider move is a
// lookup, so it is as instant as the old free mode. The anchor mesh is shared across solves.
const snapCache = new Map<string, unknown>()
const snapAnchors = new Map<string, Map<number, [number, number]>>()
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
  bandId: number, snapStep: number,
): { fit: ReturnType<typeof fitSizeInBand> } {
  const key = JSON.stringify([cfgSig, bandId, snapStep])
  const hit = walkFits.get(key)
  if (hit) return hit
  const band = BANDS.find((b) => b.id === bandId) ?? BANDS[0]
  const out = { fit: fitSizeInBand(sized, { ...cfg, solveCache: sizeCacheOf(cfgSig) }, band.minMM, snapStep) }
  walkFits.set(key, out)
  if (walkFits.size > FITS_CAP) walkFits.delete(walkFits.keys().next().value!)
  return out
}

// Idle prefetch — between interactions the worker warms every band for the current shape and
// dials, one size per macrotask so a real request always interrupts within one solve.
let gen = 0
function schedulePrefetch(
  myGen: number, sized: (mm: number) => Contour, cfg: GridConfig, cfgSig: string,
  snapStep: number,
): void {
  const walkCfg: GridConfig = { ...cfg, segmentsDetail: 'light' }
  const cache = sizeCacheOf(cfgSig)
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
    bandFit(sized, cfg, cfgSig, bandId, snapStep)
    setTimeout(step, 0)
  }
  setTimeout(step, 0)
}

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, base, offsetMM, cfg, mode, sizeMM, snapStep, stepSel, snapWrap } = e.data
  gen++
  try {
    const sized = makeSizer(base, offsetMM)
    const pts = base.outer.pts
    // Full-content hash — sampling (length + two points) collided across shapes (F2, Meta QA).
    let h = 0
    for (let i = 0; i < pts.length; i++) {
      h = (Math.imul(h, 31) + Math.round(pts[i][0] * 1000)) | 0
      h = (Math.imul(h, 31) + Math.round(pts[i][1] * 1000)) | 0
    }
    const sig = JSON.stringify([offsetMM, pts.length, h])
    if (sig !== shapeSig) { shapeSig = sig; freeCache.clear(); walkCaches.clear(); walkFits.clear(); rungCache.clear(); snapCache.clear() }
    const cfgSig = JSON.stringify(cfg)
    if (mode !== 'free' && (cfg.positioning ?? 0) === 1) {
      // THE REVERSAL — band in, count out. The material reveals each distinct layout across the
      // band's range (centre-rules seating); each is solved WHOLE by wrapGroup to its exact
      // contact size. Composition only: the wrap engine is transferred untouched.
      const band = BANDS.find((b) => b.id === mode) ?? BANDS[0]
      const key = JSON.stringify([cfgSig, band.id])
      let rungs = rungCache.get(key)
      if (!rungs) {
        rungs = wrapBandLadder(sized, cfg, band.minMM, band.maxMM, MIN_EFFECT_MM)
        rungCache.set(key, rungs)
        if (rungCache.size > FITS_CAP) rungCache.delete(rungCache.keys().next().value!)
      }
      if (rungs.length) {
        const idx = Math.min(stepSel ?? 0, rungs.length - 1)
        const at = rungs[idx].at
        const wcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM, magnetDiaMM: undefined }
        const drawn = wrapGrid(sized, wcfg, at)
        const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
        const r = spotRadiusOf(pad)
        const segments = safeSegments(drawn.contour.outer.pts, r, Math.max(r, cfg.massDepthMM ?? MASS_DEPTH_MM), 'full')
        const anchors = assignSizes(at.points, (cfg.plan ?? 'all6') as MagnetPlan)
        const ladder = rungs.map((rg) => ({ sizeMM: rg.at.sizeMM, count: rg.at.count }))
        ctx.postMessage({ id, model: {
          contour: drawn.contour, grid: { ...drawn.grid, anchors, segments },
          effSize: at.sizeMM, ladder, idx, segments,
        } })
        return
      }
      // The band's range revealed no layout that wraps inside it — honest walk fallback.
      const { fit } = bandFit(sized, cfg, cfgSig, mode, snapStep)
      const contour = sized(fit.sizeMM)
      ctx.postMessage({ id, model: { contour, grid: fit.grid, effSize: fit.sizeMM, ladder: [], idx: 0, segments: fit.grid.segments } })
    } else if (mode !== 'free') {
      const { fit } = bandFit(sized, cfg, cfgSig, mode, snapStep)
      const idx = fit.ladder.length ? Math.min(stepSel ?? fit.pickIdx, fit.ladder.length - 1) : 0
      const eff = fit.ladder.length ? fit.ladder[idx].sizeMM : fit.sizeMM
      const grid = eff === fit.sizeMM ? fit.grid : computeGrid(sized(eff), cfg)
      const contour = sized(eff)
      ctx.postMessage({ id, model: { contour, grid, effSize: eff, ladder: fit.ladder, idx, segments: grid.segments } })
    } else if (snapWrap) {
      // FREE + SNAP — free logic UNTOUCHED, wrap ADDED (Dan, 08-25: "keep the free mode logic,
      // only wire the wrap"). Three steps, each a path that already exists:
      //   1 · the ORIGINAL free solve at the slider's size — same call, same cache;
      //   2 · the seats it revealed go WHOLE to wrapGroup — the transferred solver names the
      //       pressed size and the panned registration;
      //   3 · the ORIGINAL free logic again, through its own forced-registration branch, at the
      //       pressed size — so what is drawn is free mode's own picture of the wrapped state.
      const fk = cfgSig + '|' + sizeMM
      let free = freeCache.get(fk)
      if (!free) {
        const contour = sized(sizeMM)
        free = { contour, grid: computeGrid(contour, cfg) }
        freeCache.set(fk, free)
        if (freeCache.size > FREE_CAP) freeCache.delete(freeCache.keys().next().value!)
      }
      const pts = free.grid.anchors.map((a) => a.p)
      if (!pts.length) {
        ctx.postMessage({ id, model: { contour: free.contour, grid: free.grid, effSize: sizeMM, ladder: [], idx: 0, segments: free.grid.segments } })
        return
      }
      const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
      let mx = Infinity, my = Infinity
      for (const q of pts) { if (q[0] < mx) mx = q[0]; if (q[1] < my) my = q[1] }
      const layoutId = pts.map((q) => Math.round((q[0] - mx) / pitch) + ',' + Math.round((q[1] - my) / pitch)).sort().join(';')
      const sk = cfgSig + '|' + layoutId
      const cached = snapCache.get(sk)
      if (cached !== undefined) { ctx.postMessage({ id, model: cached }); return }
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1])
      const gx = (Math.min(...xs) + Math.max(...xs)) / 2, gy = (Math.min(...ys) + Math.max(...ys)) / 2
      const wcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM, centreMode: cfg.centreMode, governor: cfg.governor, massDepthMM: cfg.massDepthMM }
      let memo = snapAnchors.get(cfgSig)
      if (!memo) { memo = new Map(); snapAnchors.set(cfgSig, memo); if (snapAnchors.size > 4) snapAnchors.delete(snapAnchors.keys().next().value!) }
      const at = wrapGroup(sized, wcfg, pts.map(([x, y]) => [x - gx, y - gy] as [number, number]), MIN_EFFECT_MM, sizeMM, memo)
      let model: unknown
      if (!at) {
        model = { contour: free.contour, grid: free.grid, effSize: sizeMM, ladder: [], idx: 0, segments: free.grid.segments }
      } else {
        const contour = sized(at.sizeMM)
        // computeGrid's registration phase is measured FROM THE SHAPE'S BBOX CORNER; the wrap's
        // origin is absolute. Convert, or the lattice lands offset and nothing seats.
        const bb = bbox(contour.outer.pts)
        const grid = computeGrid(contour, { ...cfg, forcePhaseMM: [at.originMM[0] - bb.minX, at.originMM[1] - bb.minY] })
        model = { contour, grid, effSize: at.sizeMM, ladder: [], idx: 0, segments: grid.segments }
      }
      snapCache.set(sk, model)
      if (snapCache.size > FREE_CAP) snapCache.delete(snapCache.keys().next().value!)
      ctx.postMessage({ id, model })
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
    schedulePrefetch(gen, sized, cfg, cfgSig, snapStep)
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
