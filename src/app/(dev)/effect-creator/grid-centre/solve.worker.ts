// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { BANDS, bandOuterMM, computeGrid, MIN_EFFECT_MM, type GridConfig } from '@/lib/effect/grid-magnet'
import { wrapGrid, type WrapConfig } from '@/lib/effect/grid-magnet-wrap-compute'
import { runPipeline, type PipelineResult } from '@/lib/effect/pipeline'
import { bbox, safeSegments, spotRadiusOf } from '@/lib/effect/grid-magnet-compute'
import { contourCentroidOf } from '@/lib/effect/units/centring'
import { anchorBakeOf, anchorFromBake, assignSizes, type AnchorBake, type CentreMode, type Governor, type MagnetPlan } from '@/lib/effect/grid-magnet-logic'
import { DEFAULT_PITCH_MM, MASS_DEPTH_MM, PADDING_FLOOR_MM } from '@/lib/effect/grid-magnet-spec'
import { contourCacheKey, makeSizer, sizeRange } from '@/lib/effect/grid-magnet-bridge'
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
  stepSel: number | null
}

const ctx = self as unknown as Worker

// Computed once = computed. Per-shape bakes and per-band solves are keyed by shape + config and
// reused across interactions; a new shape clears everything. The per-size walk cache and the idle
// prefetcher this comment used to describe were deleted with the rigid fallback.
let shapeSig = ''
const rungCache = new Map<string, PipelineResult>()
// ANCHOR BAKE — the centre measured ONCE per shape (at the largest size, all material present)
// and scaled linearly per size. Positions are shape features; only qualification is size-
// dependent (evaluated inside anchorFromBake). Core mode (1) is size-dependent by definition
// and stays live — the bake returns null and the engine measures as before.
const bakeCache = new Map<string, { bake: AnchorBake; segW: number; segH: number }>()

/** STEP 1 (pipeline doc): one measurement per shape — erosion, legal area, segment box, family.
 *  Classification is a property of the shape, independent of the centring mode. */
function bakeOf(
  sized: (mm: number) => import('@/lib/effect/types').Contour, cfg: GridConfig, shapeSig2: string,
): { bake: AnchorBake; segW: number; segH: number } {
  const key = shapeSig2 + '|' + JSON.stringify([cfg.paddingMM, cfg.massDepthMM])
  let hit = bakeCache.get(key)
  if (!hit) {
    const refMM = sizeRange(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)).maxMM
    const outer = sized(refMM).outer.pts
    const bb = bbox(outer)
    const r = spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
    const segs = safeSegments(sized(refMM), r, Math.max(r, cfg.massDepthMM ?? MASS_DEPTH_MM), 'light')
    const bake = anchorBakeOf(segs, [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2], contourCentroidOf(sized(refMM)), refMM, (bb.minY + bb.maxY) / 2)
    let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
    for (const sg of segs) { sx0 = Math.min(sx0, sg.bbox.minX); sy0 = Math.min(sy0, sg.bbox.minY); sx1 = Math.max(sx1, sg.bbox.maxX); sy1 = Math.max(sy1, sg.bbox.maxY) }
    hit = { bake, segW: Math.max(0, sx1 - sx0), segH: Math.max(0, sy1 - sy0) }
    bakeCache.set(key, hit)
    if (bakeCache.size > 8) bakeCache.delete(bakeCache.keys().next().value!)
  }
  return hit
}

/** Exported so the separation gate can prove the drawn witness IS layout's selected witness —
 *  it must call the real bake, not a stand-in. */
export function anchorFnFor(
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

const FITS_CAP = 12

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, base, offsetMM, cfg, mode, manualBand, sizeMM, stepSel } = e.data
  try {
    const sized = makeSizer(base, offsetMM)
    // Cache identity is the shape itself — every ring, exactly. A rolling hash of ring counts
    // collided: two contours with the same outline and different holes shared a bake.
    const sig = contourCacheKey(base, offsetMM)
    if (sig !== shapeSig) { shapeSig = sig; rungCache.clear(); }
    const cfgSig = JSON.stringify(cfg)
    if (manualBand && sizeMM > 0) {
      // MANUAL CALIBRATION (QA F5): the requested size and phase are honoured directly —
      // one seated solve at that exact state, no ladder, no snapping.
      const aFn = anchorFnFor(sized, cfg, cfgSig, sig)
      const contour = sized(sizeMM)
      const grid = computeGrid(contour, aFn ? { ...cfg, centreOverrideMM: aFn(sizeMM) } : cfg)
      ctx.postMessage({ id, model: { contour, grid, effSize: sizeMM, ladder: [], idx: 0, segments: grid.segments } })
    } else {
      // THE PIPELINE — class, band, layout, wrap. The worker is transport: it calls the one door
      // and shapes what comes back for the canvas. It measures nothing, ranks nothing, and hides
      // nothing; every attempt the pipeline made reaches the screen, in the order it made them.
      const band = BANDS.find((b) => b.id === mode) ?? BANDS[0]
      const anchorAt = anchorFnFor(sized, cfg, cfgSig, sig)
      const key = JSON.stringify([cfgSig, band.id])
      let solve = rungCache.get(key)
      if (!solve) {
        solve = runPipeline({
          sized, bandId: band.id, pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM,
          centreMode: cfg.centreMode, governor: cfg.governor, massDepthMM: cfg.massDepthMM,
          circle: cfg.circle, anchorAtMM: anchorAt,
        })
        rungCache.set(key, solve)
        if (rungCache.size > FITS_CAP) rungCache.delete(rungCache.keys().next().value!)
      }
      // The full ledger, unsorted: an attempt that never fitted keeps its row with sizeMM null, so
      // a layout the library offered and the material refused is visible rather than absent.
      const ladder = solve.attempts.map((a) => ({
        sizeMM: a.wrap ? a.wrap.sizeMM : null,
        count: a.wrap ? a.wrap.count : a.seatedMM.length,
        offMM: a.wrap ? a.wrap.centreOffMM : null,
        label: a.label,
        classId: a.classId,
        transposed: a.transposed,
        omitted: a.omitted.length,
        attempted: a.attempted,
        landedBandId: a.landedBandId,
      }))
      const frame = solve.frame
      const recog = frame
        ? { cols: frame.cols, rows: frame.rows, segWmm: frame.widthMM, segHmm: frame.heightMM }
        : undefined
      const drawable = solve.attempts.map((a, i) => ({ a, i })).filter(({ a }) => a.wrap)
      if (drawable.length) {
        // Which row is DRAWN is the viewer's choice, not the engine's: with none picked the first
        // in generation order is shown. There is no default landing and no ranking — Dan scoped
        // ordering out of the MVP so the raw behaviour can be seen before anything sorts it.
        const chosen = drawable[Math.min(stepSel ?? 0, drawable.length - 1)]
        const at = chosen.a.wrap!
        const wcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM, magnetDiaMM: undefined, anchorAtMM: () => at.anchorMM }
        const drawn = wrapGrid(sized, wcfg, at)
        const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
        const r = spotRadiusOf(pad)
        const segments = safeSegments(drawn.contour, r, Math.max(r, cfg.massDepthMM ?? MASS_DEPTH_MM), 'full')
        const anchors = assignSizes(at.points, (cfg.plan ?? 'all6') as MagnetPlan)
        ctx.postMessage({ id, model: {
          contour: drawn.contour, grid: { ...drawn.grid, anchors, segments },
          effSize: at.sizeMM, ladder, idx: chosen.i, segments, offMM: at.centreOffMM, recog,
        } })
        return
      }
      // NOTHING WRAPPED. Either the library holds no layout for this frame, or every layout it
      // holds was refused by the material. Both are answers, and the ledger above says which.
      const span = bandOuterMM(band, Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
      const contour = sized(span.minMM)
      const grid = computeGrid(contour, anchorAt ? { ...cfg, centreOverrideMM: anchorAt(span.minMM) } : cfg)
      ctx.postMessage({ id, model: {
        contour, grid, effSize: span.minMM, ladder, idx: 0, segments: grid.segments, recog,
        diagnostic: { reason: solve.attempts.length ? 'no-layout-fitted' : 'no-layout-for-frame' },
      } })
    }
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
