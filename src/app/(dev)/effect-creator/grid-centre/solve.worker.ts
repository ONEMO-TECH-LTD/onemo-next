// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { BANDS, bandOuterMM, classifyBands, computeGrid, MIN_EFFECT_MM, type GridConfig } from '@/lib/effect/grid-magnet'
import { optimalLayoutForBox } from '@/lib/effect/grid-magnet-library-catalogue'
import { wrapBandLadder, wrapGrid, type BandSolve, type WrapConfig } from '@/lib/effect/grid-magnet-wrap-compute'
import { bbox, safeSegments, spotRadiusOf } from '@/lib/effect/grid-magnet-compute'
import { contourCentroidOf } from '@/lib/effect/units/centring'
import { anchorBakeOf, anchorFromBake, assignSizes, type AnchorBake, type CentreMode, type Governor, type MagnetPlan } from '@/lib/effect/grid-magnet-logic'
import { classFrameNodes, shapeFamilyOf, type ShapeFamily } from '@/lib/effect/grid-magnet-class'

import { defaultLanding } from '@/lib/effect/units/judge'
import { DEFAULT_PITCH_MM, PADDING_FLOOR_MM } from '@/lib/effect/grid-magnet-spec'
import { contourCacheKey, makeSizer, sizeRange } from '@/lib/effect/grid-magnet-bridge'
import type { Contour, Pt } from '@/lib/effect/types'

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
/** The per-shape band table — Dan's "post load" step, computed once and read by every band. */
const classCache = new Map<string, ReturnType<typeof classifyBands>>()
const rungCache = new Map<string, BandSolve>()
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
  const key = shapeSig2 + '|' + JSON.stringify([cfg.paddingMM])
  let hit = bakeCache.get(key)
  if (!hit) {
    const refMM = sizeRange(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)).maxMM
    const outer = sized(refMM).outer.pts
    const bb = bbox(outer)
    const r = spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
    const segs = safeSegments(sized(refMM), r, 'light')
    const bake = anchorBakeOf(segs, [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2], contourCentroidOf(sized(refMM)), refMM, (bb.minY + bb.maxY) / 2)
    let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
    for (const sg of segs) { sx0 = Math.min(sx0, sg.bbox.minX); sy0 = Math.min(sy0, sg.bbox.minY); sx1 = Math.max(sx1, sg.bbox.maxX); sy1 = Math.max(sy1, sg.bbox.maxY) }
    hit = { bake, segW: Math.max(0, sx1 - sx0), segH: Math.max(0, sy1 - sy0), family: shapeFamilyOf(outer) }
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
  const minClear = spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
  const aRef = anchorFromBake(bake, mode, gov, minClear, bake.refMM) ?? bake.boxC
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
      ctx.postMessage({ id, model: { unprotected: null, contour, grid, effSize: sizeMM, ladder: [], idx: 0, segments: grid.segments } })
    } else {
      // THE REVERSAL — band in, count out. The material reveals each distinct layout across the
      // band's range (centre-rules seating); each is solved WHOLE by wrapGroup to its exact
      // contact size. Composition only: the wrap engine is transferred untouched.
      const band = BANDS.find((b) => b.id === mode) ?? BANDS[0]
      // The band is a LEGAL range; the ladder scans OUTLINE sizes, so it converts through this
      // shape's own rim. A diamond and a square in one band do not share an outline range.
      const span = bandOuterMM(band, Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
      const anchorAt = anchorFnFor(sized, cfg, cfgSig, sig)
      // STEP 1 + 2 — the classifier's own table, built ONCE PER SHAPE and read here.
      //
      // Dan said "post load"; it was being rebuilt inside every band request — all eleven rows,
      // each an exact Clipper inset, thrown away and recomputed on the next band (QA F5). The
      // answers were identical, so nothing was wrong on screen; it simply was not what he asked
      // for, and it repeated the most expensive measurement in the solve.
      //
      // Keyed on everything the table depends on: the shape, and the classifier's own inputs —
      // padding, ruler, pitch, centre mode and governor. Nothing else can move a row.
      const classKey = JSON.stringify([sig, cfg.paddingMM, cfg.classifierRuler, cfg.pitchMM,
        cfg.centreMode, cfg.governor])
      let bandClasses = classCache.get(classKey)
      if (!bandClasses) {
        bandClasses = classifyBands(sized, cfg, anchorAt)
        classCache.set(classKey, bandClasses)
        if (classCache.size > 8) classCache.delete(classCache.keys().next().value!)
      }
      const bandClass = bandClasses.find((row) => row.bandId === band.id) ?? null
      // the lookup digests the classifier's boxes; the classifier itself counts nothing
      const optimal = bandClass
        ? optimalLayoutForBox(cfg.pitchMM ?? DEFAULT_PITCH_MM, band.id, bandClass.rulerWidthMM, bandClass.rulerHeightMM)
        : null
      const recommendation = optimal && bandClass
        ? { cols: optimal.frameCols, rows: optimal.frameRows, count: optimal.nodesMM.length,
            id: optimal.id, seedMM: bandClass.seedMM, anchorMM: bandClass.anchorMM }
        : null
      const key = JSON.stringify([cfgSig, band.id])
      let solve = rungCache.get(key)
      if (!solve) {
        // the classifier measured the boxes, the lookup named the layout; the ladder tries it first
        const optimalNodes = optimal?.nodesMM.map(([x, y]) => [x, y] as Pt)
        solve = wrapBandLadder(sized, cfg, span.minMM, span.maxMM, MIN_EFFECT_MM, anchorAt, optimalNodes)
        rungCache.set(key, solve)
        if (rungCache.size > FITS_CAP) rungCache.delete(rungCache.keys().next().value!)
      }
      const rungs = solve.offers
      if (rungs.length) {
        // RULE 4 (Dan, 08-24): prefer the tight solution closest to the centroid — never the
        // smallest at any centring cost. Among offers of the SAME COUNT as the tightest, within
        // half a pitch of it, the best-centred is the default landing. All offers stay visible.
        // when any holding rule is on, the ruled order decides and rule 4 does not override it
        const h = cfg.holdingRules
        const rulesActive = !!h && (h.perimeter || h.extremes || h.corners || h.gravity || h.universal || h.balance)
        const ruleIdx = defaultLanding(rungs, cfg.pitchMM ?? DEFAULT_PITCH_MM, rulesActive)
        const idx = Math.min(stepSel ?? ruleIdx, rungs.length - 1)
        const at = rungs[idx].at
        const wcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM, magnetDiaMM: undefined, anchorAtMM: () => at.anchorMM }
        const drawn = wrapGrid(sized, wcfg, at)
        const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
        const r = spotRadiusOf(pad)
        const segments = safeSegments(drawn.contour, r, 'full')
        const anchors = assignSizes(at.points, (cfg.plan ?? 'all6') as MagnetPlan)
        const ladder = rungs.map((rg) => ({ sizeMM: rg.at.sizeMM, count: rg.at.count, offMM: rg.at.centreOffMM, roles: rg.roles }))
        // the DETECTOR'S OWN evidence for the selected answer, carried to the canvas so the picture
        // and the verdict cannot drift apart (Dan, 2026-08-31)
        const unprotected = rungs[idx]?.unprotected ?? null
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
          bandClass, bandClasses, recommendation, unprotected,
        } })
        return
      }
      // NO LAWFUL OFFER. Judge allowed nothing in this band. The witness comes from LAYOUT's own
      // generated population — the worker measures nothing and ranks nothing — and it is evidence,
      // never an offer.
      const bestSeatedMM = solve.bestSeated?.revealMM ?? span.minMM
      const contour = sized(bestSeatedMM)
      // The witness DRAWN is the witness layout SELECTED — one solve, at the same baked centre the
      // ladder used. Re-solving WITHOUT that centre drew a different population under the same
      // label: evidence of a solve nobody made.
      const grid = computeGrid(contour, anchorAt
        ? { ...cfg, centreOverrideMM: anchorAt(bestSeatedMM) }
        : cfg)
      ctx.postMessage({ id, model: {
        contour, grid, effSize: bestSeatedMM, ladder: [], idx: 0, segments: grid.segments,
        offers: [], diagnostic: { reason: 'no-lawful-offer', bestSeatedMM },
        bandClass, bandClasses, recommendation,
      } })
    }
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
