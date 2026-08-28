// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { BANDS, computeGrid, MIN_EFFECT_MM, type GridConfig } from '@/lib/effect/grid-magnet'
import { wrapBandLadder, wrapGrid, type BandRung, type WrapConfig } from '@/lib/effect/grid-magnet-wrap-compute'
import { bbox, safeSegments, spotRadiusOf } from '@/lib/effect/grid-magnet-compute'
import { contourCentroidOf } from '@/lib/effect/units/centring'
import { anchorBakeOf, anchorFromBake, assignSizes, type AnchorBake, type CentreMode, type Governor, type MagnetPlan } from '@/lib/effect/grid-magnet-logic'
import { classFrameNodes, shapeFamilyOf, type ShapeFamily } from '@/lib/effect/grid-magnet-class'
import { defaultLanding } from '@/lib/effect/units/judge'
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
    const segs = safeSegments(sized(refMM), r, Math.max(r, cfg.massDepthMM ?? MASS_DEPTH_MM), 'light')
    const bake = anchorBakeOf(segs, [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2], contourCentroidOf(sized(refMM)), refMM, (bb.minY + bb.maxY) / 2)
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

/** The calibration witness: the size in the band that seats the most magnets. It is NOT a fit and
 *  is never offered — it exists so an empty band shows something rather than nothing. */
function bandBestSeatedMM(
  sized: (mm: number) => Contour, cfg: GridConfig, band: { minMM: number; maxMM: number },
): number {
  let bestMM = band.minMM, bestN = -1
  for (let mm = band.minMM; mm <= band.maxMM; mm += 4) {
    const n = computeGrid(sized(mm), { ...cfg, segmentsDetail: 'light' }).anchors.length
    if (n > bestN) { bestN = n; bestMM = mm }
  }
  return bestMM
}

const FITS_CAP = 12

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, base, offsetMM, cfg, mode, manualBand, sizeMM, stepSel } = e.data
  try {
    const sized = makeSizer(base, offsetMM)
    // Full-content hash over EVERY ring — outer and each hole, with ring boundaries. Hashing the
    // outer ring alone let two contours with the same outline and different holes share a bake.
    let h = 0
    const feed = (pts: ReadonlyArray<import('@/lib/effect/types').Pt>) => {
      h = (Math.imul(h, 31) + pts.length) | 0
      for (const [x, y] of pts) {
        h = (Math.imul(h, 31) + Math.round(x * 1000)) | 0
        h = (Math.imul(h, 31) + Math.round(y * 1000)) | 0
      }
    }
    feed(base.outer.pts)
    for (const hole of base.holes) feed(hole.pts)
    const sig = JSON.stringify([offsetMM, base.outer.pts.length, base.holes.length, h])
    if (sig !== shapeSig) { shapeSig = sig; rungCache.clear(); }
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
        const ruleIdx = defaultLanding(rungs, cfg.pitchMM ?? DEFAULT_PITCH_MM)
        const idx = Math.min(stepSel ?? ruleIdx, rungs.length - 1)
        const at = rungs[idx].at
        const wcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM, magnetDiaMM: undefined, anchorAtMM: () => at.anchorMM }
        const drawn = wrapGrid(sized, wcfg, at)
        const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
        const r = spotRadiusOf(pad)
        const segments = safeSegments(drawn.contour, r, Math.max(r, cfg.massDepthMM ?? MASS_DEPTH_MM), 'full')
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
      // NO LAWFUL OFFER. The band revealed nothing that wraps inside it. The best-seated size is a
      // CALIBRATION WITNESS only — it is returned so the canvas is not blank, and it must never be
      // presented as a fit. The old rigid walk that showed it AS the band result is deleted.
      const bestSeatedMM = bandBestSeatedMM(sized, cfg, band)
      const contour = sized(bestSeatedMM)
      const grid = computeGrid(contour, cfg)
      ctx.postMessage({ id, model: {
        contour, grid, effSize: bestSeatedMM, ladder: [], idx: 0, segments: grid.segments,
        offers: [], diagnostic: { reason: 'no-lawful-offer', bestSeatedMM },
      } })
    } else {
      // Non-positioning is unreachable: the page hardcodes positioning 1 and voting is deleted.
      ctx.postMessage({ id, model: null, error: 'positioning must be 1 — voting was removed in S2' })
    }
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
