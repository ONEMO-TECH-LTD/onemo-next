// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { BANDS, computeGrid, fitSizeInBand, MIN_EFFECT_MM, type GridConfig, type GridResult } from '@/lib/effect/grid-magnet'
import { wrapBandLadder, wrapGrid, type BandRung, type WrapConfig } from '@/lib/effect/grid-magnet-wrap-compute'
import { bbox, centroidOf, safeSegments, spotRadiusOf } from '@/lib/effect/grid-magnet-compute'
import { anchorBakeOf, anchorFromBake, assignSizes, type AnchorBake, type CentreMode, type Governor, type MagnetPlan } from '@/lib/effect/grid-magnet-logic'
import { classFrameNodes, shapeFamilyOf, type ShapeFamily } from '@/lib/effect/grid-magnet-class'
import { DEFAULT_PITCH_MM, MASS_DEPTH_MM, PADDING_FLOOR_MM } from '@/lib/effect/grid-magnet-spec'
import { makeSizer, sizeRange } from '@/lib/effect/grid-magnet-bridge'
import type { Contour } from '@/lib/effect/types'

interface SolveRequest {
  id: number
  base: Contour
  offsetMM: number
  cfg: GridConfig
  mode: number
  /** Manual scale/pan: solve directly at sizeMM with cfg (carries forcePhaseMM). */
  manualBand?: boolean
  sizeMM: number
  snapStep: number
  stepSel: number | null
  /** Free + snap: every slider move presses the shape onto the revealed magnets. */
  snapWrap?: boolean
  /** The slider's window when snapping — stops (distinct pressed sizes) are computed for it. */
  snapWindow?: [number, number]
}

const ctx = self as unknown as Worker

// Computed once = computed. Per-size solves are keyed by shape + config and reused across
// free-slider moves, manual band scaling, re-walks and the idle prefetcher; a new shape
// clears everything.
let shapeSig = ''
const walkCaches = new Map<string, Map<number, GridResult>>()
const walkFits = new Map<string, { fit: ReturnType<typeof fitSizeInBand> }>()
const rungCache = new Map<string, BandRung[]>()
// ANCHOR BAKE — the centre measured ONCE per shape (at the largest size, all material present)
// and scaled linearly per size. Positions are shape features; only qualification is size-
// dependent (evaluated inside anchorFromBake). Core mode (1) is size-dependent by definition
// and stays live — the bake returns null and the engine measures as before.
const bakeCache = new Map<string, { bake: AnchorBake; segW: number; segH: number; family: ShapeFamily }>()

/** STEP 1 (pipeline doc): one measurement per shape — erosion, legal area, segment box, family.
 *  Classification is a property of the shape, independent of the centring mode. */
function bakeOf(
  sized: (mm: number) => import('@/lib/effect/types').Contour, cfg: GridConfig, shapeSig2: string,
): { bake: AnchorBake; segW: number; segH: number; family: ShapeFamily } {
  const key = shapeSig2 + '|' + JSON.stringify([cfg.paddingMM, cfg.massDepthMM])
  let hit = bakeCache.get(key)
  if (!hit) {
    const refMM = sizeRange(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)).maxMM
    const outer = sized(refMM).outer.pts
    const bb = bbox(outer)
    const r = spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
    const segs = safeSegments(outer, r, Math.max(r, cfg.massDepthMM ?? MASS_DEPTH_MM), 'light')
    const bake = anchorBakeOf(segs, [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2], centroidOf(outer), refMM, (bb.minY + bb.maxY) / 2)
    let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
    for (const sg of segs) { sx0 = Math.min(sx0, sg.bbox.minX); sy0 = Math.min(sy0, sg.bbox.minY); sx1 = Math.max(sx1, sg.bbox.maxX); sy1 = Math.max(sy1, sg.bbox.maxY) }
    hit = { bake, segW: Math.max(0, sx1 - sx0), segH: Math.max(0, sy1 - sy0), family: shapeFamilyOf(outer) }
    bakeCache.set(key, hit)
    if (bakeCache.size > 8) bakeCache.delete(bakeCache.keys().next().value!)
  }
  return hit
}

function anchorFnFor(
  sized: (mm: number) => import('@/lib/effect/types').Contour, cfg: GridConfig, cfgSig: string, shapeSig2: string,
): ((mm: number) => import('@/lib/effect/types').Pt) | undefined {
  const mode = (cfg.centreMode ?? 2) as CentreMode
  const hit = bakeOf(sized, cfg, shapeSig2)
  if (mode === 1) return undefined                    // Core: live by definition (class still baked)
  // Dan, verified visually 2026-08-25: the centre does not change with scale — the shape is
  // fixed. So the SELECTION is made once too, at full size, and that one point IS the anchor
  // at every size, scaled linearly. No per-size re-election.
  const bake = hit.bake
  const gov = (cfg.governor ?? 0) as Governor
  const depth = Math.max(spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)), cfg.massDepthMM ?? MASS_DEPTH_MM)
  const aRef = anchorFromBake(bake, mode, gov, depth, bake.refMM) ?? bake.boxC
  return (mm: number) => [aRef[0] * mm / bake.refMM, aRef[1] * mm / bake.refMM]
}

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
  const { id, base, offsetMM, cfg, mode, manualBand, sizeMM, snapStep, stepSel } = e.data
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
    if (sig !== shapeSig) { shapeSig = sig; walkCaches.clear(); walkFits.clear(); rungCache.clear(); }
    const cfgSig = JSON.stringify(cfg)
    if (manualBand && sizeMM > 0) {
      // MANUAL CALIBRATION (QA F5): the requested size and phase are honoured directly —
      // one seated solve at that exact state, no ladder, no snapping.
      const aFn = anchorFnFor(sized, cfg, cfgSig, sig)
      const contour = sized(sizeMM)
      const grid = computeGrid(contour, aFn ? { ...cfg, centreOverrideMM: aFn(sizeMM) } : cfg)
      ctx.postMessage({ id, model: { contour, grid, effSize: sizeMM, ladder: [], idx: 0, segments: grid.segments } })
    } else if ((cfg.positioning ?? 0) === 1) {
      // THE REVERSAL — band in, count out. The material reveals each distinct layout across the
      // band's range (centre-rules seating); each is solved WHOLE by wrapGroup to its exact
      // contact size. Composition only: the wrap engine is transferred untouched.
      const band = BANDS.find((b) => b.id === mode) ?? BANDS[0]
      const key = JSON.stringify([cfgSig, band.id])
      let rungs = rungCache.get(key)
      if (!rungs) {
        rungs = wrapBandLadder(sized, cfg, band.minMM, band.maxMM, MIN_EFFECT_MM, anchorFnFor(sized, cfg, cfgSig, sig))
        rungCache.set(key, rungs)
        if (rungCache.size > FITS_CAP) rungCache.delete(rungCache.keys().next().value!)
      }
      if (rungs.length) {
        // RULE 4 (Dan, 08-24): prefer the tight solution closest to the centroid — never the
        // smallest at any centring cost. Among offers of the SAME COUNT as the tightest, within
        // half a pitch of it, the best-centred is the default landing. All offers stay visible.
        const half = (cfg.pitchMM ?? DEFAULT_PITCH_MM) / 2
        const c0 = rungs[0]
        let ruleIdx = 0
        for (let i = 1; i < rungs.length; i++) {
          const r = rungs[i]
          if (r.at.count !== c0.at.count || r.at.sizeMM > c0.at.sizeMM + half) continue
          const b = rungs[ruleIdx]
          if (r.at.centreOffMM < b.at.centreOffMM - 0.01) ruleIdx = i
        }
        const idx = Math.min(stepSel ?? ruleIdx, rungs.length - 1)
        const at = rungs[idx].at
        const wcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM, magnetDiaMM: undefined }
        const drawn = wrapGrid(sized, wcfg, at)
        const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
        const r = spotRadiusOf(pad)
        const segments = safeSegments(drawn.contour.outer.pts, r, Math.max(r, cfg.massDepthMM ?? MASS_DEPTH_MM), 'full')
        const anchors = assignSizes(at.points, (cfg.plan ?? 'all6') as MagnetPlan)
        const ladder = rungs.map((rg) => ({ sizeMM: rg.at.sizeMM, count: rg.at.count, offMM: rg.at.centreOffMM }))
        const bk = bakeOf(sized, cfg, sig)
        const cf = classFrameNodes(bk.segW, bk.segH, band.id, cfg.pitchMM)
        const refMM = sizeRange(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)).maxMM
        const recog = {
          family: bk.family, cols: cf.cols, rows: cf.rows,
          segWmm: bk.segW * at.sizeMM / refMM, segHmm: bk.segH * at.sizeMM / refMM,
        }
        ctx.postMessage({ id, model: {
          contour: drawn.contour, grid: { ...drawn.grid, anchors, segments },
          effSize: at.sizeMM, ladder, idx, segments, offMM: at.centreOffMM, recog,
        } })
        return
      }
      // The band's range revealed no layout that wraps inside it — honest walk fallback.
      const { fit } = bandFit(sized, cfg, cfgSig, mode, snapStep)
      const contour = sized(fit.sizeMM)
      ctx.postMessage({ id, model: { contour, grid: fit.grid, effSize: fit.sizeMM, ladder: [], idx: 0, segments: fit.grid.segments } })
    } else {
      const { fit } = bandFit(sized, cfg, cfgSig, mode, snapStep)
      const idx = fit.ladder.length ? Math.min(stepSel ?? fit.pickIdx, fit.ladder.length - 1) : 0
      const eff = fit.ladder.length ? fit.ladder[idx].sizeMM : fit.sizeMM
      const grid = eff === fit.sizeMM ? fit.grid : computeGrid(sized(eff), cfg)
      const contour = sized(eff)
      ctx.postMessage({ id, model: { contour, grid, effSize: eff, ladder: fit.ladder, idx, segments: grid.segments } })
    }
    schedulePrefetch(gen, sized, cfg, cfgSig, snapStep)
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
