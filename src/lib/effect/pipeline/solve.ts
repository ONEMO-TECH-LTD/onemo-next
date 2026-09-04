// pipeline/solve.ts — the grid solve as ONE headless call. The body below MOVED verbatim from
// grid-centre/solve.worker.ts (T1 S1, 2026-09-02); the worker is now transport only. Sequence,
// caches and the rules the worker carried (Rule-4 landing, Belt, sizes) are here unchanged — their
// re-rooming into units is later work, recorded in _WIP/v3.5.8/t1-headless-solve-migration-plan.md.

import { BANDS, bandOuterMM, classifyBands, computeGrid, MIN_EFFECT_MM, type GridConfig } from '@/lib/effect/grid-magnet'
import { canonLayoutForFrame } from '@/lib/effect/grid-magnet-library-catalogue'
import { wrapGrid, type BandSolve, type WrapConfig } from '@/lib/effect/grid-magnet-wrap-compute'
import { solveCanonExperiment } from '@/lib/effect/grid-magnet-canon-experiment'
import { bbox, safeSegments, spotRadiusOf } from '@/lib/effect/grid-magnet-compute'
import { contourCentroidOf } from '@/lib/effect/units/centring'
import { measureProtection } from '@/lib/effect/units/protection'
import { anchorBakeOf, anchorFromBake, applyCoverage, assignSizes, centeringAnchors, type AnchorBake, type CentreMode, type Governor, type MagnetPlan } from '@/lib/effect/grid-magnet-logic'
import { classFrameNodes, shapeFamilyOf, type ShapeFamily } from '@/lib/effect/grid-magnet-class'

import { defaultLanding } from '@/lib/effect/units/judge'
import { canonPriorityOf, positionsAcross } from '@/lib/effect/units/classifier'
import { DEFAULT_PITCH_MM, PADDING_FLOOR_MM } from '@/lib/effect/grid-magnet-spec'
import { contourCacheKey, makeSizer, sizeRange } from '@/lib/effect/grid-magnet-bridge'
import type { Pt } from '@/lib/effect/types'
import type { GridRequest, GridSolve } from './types'

// Computed once = computed. Per-shape bakes and per-band solves are keyed by shape + config and
// reused across interactions; a new shape clears everything. The per-size walk cache and the idle
// prefetcher this comment used to describe were deleted with the rigid fallback.
let shapeSig = ''
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
): (mm: number) => import('@/lib/effect/types').Pt {
  const mode = (cfg.centreMode ?? 2) as CentreMode
  if (mode === 1) return (mm: number) => {
    const contour = sized(mm)
    const outer = contour.outer.pts
    const bb = bbox(outer)
    const boxC: Pt = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
    const r = spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
    return centeringAnchors(1, safeSegments(contour, r, 'light'), boxC, contourCentroidOf(contour))[0] ?? boxC
  }
  const hit = bakeOf(sized, cfg, shapeSig2)
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

export function solveGrid(req: GridRequest): GridSolve {
  const { base, offsetMM, cfg, mode, manualBand, sizeMM, stepSel, settings,
    activeBandIds = BANDS.map((band) => band.id) } = req
  const { protectionPaddingMM } = settings
  {
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
      const grid = computeGrid(contour, { ...cfg, centreOverrideMM: aFn(sizeMM) })
      const evidence = measureProtection(contour, grid.anchors.map((anchor) => anchor.p),
        cfg.pitchMM ?? DEFAULT_PITCH_MM, protectionPaddingMM, grid.anchors.map((anchor) => anchor.dia / 2))
      return {
        contour, grid, effSize: sizeMM, rungs: [], selectedRungIndex: 0, segments: grid.segments, unprotected: evidence,
      }
    } else {
      // Coverage is delivery-only. The entire solve and its cache identity stay raw so toggling
      // Belt cannot change search, wrap, qualification, roles, placement or default selection.
      const rawCfg: GridConfig = { ...cfg, perimeterOnly: false }
      const rawCfgSig = JSON.stringify(rawCfg)
      // THE REVERSAL — band in, count out. The material reveals each distinct layout across the
      // band's range (centre-rules seating); each is solved WHOLE by wrapGroup to its exact
      // contact size. Composition only: the wrap engine is transferred untouched.
      const activeBands = BANDS.filter((band) => activeBandIds.includes(band.id))
      if (!activeBands.length) throw new Error('Grid Lab requires at least one active band.')
      const band = activeBands.find((candidate) => candidate.id === mode) ?? activeBands[0]
      // The band is a LEGAL range; the ladder scans OUTLINE sizes, so it converts through this
      // shape's own rim. A diamond and a square in one band do not share an outline range.
      const span = bandOuterMM(band, Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
      const anchorAt = anchorFnFor(sized, rawCfg, rawCfgSig, sig)
      // STEP 1 + 2 — the classifier's own table: at each band's trial size, what frame the shape
      // carries and where its centre sits. Measured once per shape; it decides nothing here yet.
      const bandClasses = classifyBands(sized, rawCfg, anchorAt, activeBands)
      const bandClass = bandClasses.find((row) => row.bandId === band.id) ?? null
      // the lookup digests the classifier's boxes; the classifier itself counts nothing
      const pitch0 = cfg.pitchMM ?? DEFAULT_PITCH_MM
      const optimal = bandClass
        ? canonLayoutForFrame(pitch0, positionsAcross(bandClass.rulerWidthMM, pitch0), positionsAcross(bandClass.rulerHeightMM, pitch0))
        : null
      const recommendation = optimal && bandClass
        ? { cols: optimal.frameCols, rows: optimal.frameRows, count: optimal.nodesMM.length,
            id: optimal.id, seedMM: bandClass.seedMM, anchorMM: bandClass.anchorMM }
        : null
      const key = JSON.stringify([rawCfgSig, band.id])
      let solve = rungCache.get(key)
      if (!solve) {
        // the classifier measured the boxes, the lookup named the layout; the ladder tries it first
        const optimalNodes = optimal?.nodesMM.map(([x, y]) => [x, y] as Pt)
        // Priority hold points are read off the same frame the classifier named; local coords are
        // the solver's own convention (frame-centred), so the ids match the solver's populations.
        const priority = optimalNodes?.length ? (() => {
          const xs = optimalNodes.map((p) => p[0]), ys = optimalNodes.map((p) => p[1])
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
          return canonPriorityOf(optimalNodes.map(([x, y]) => [x - cx, y - cy] as Pt), pitch0)
        })() ?? undefined : undefined
        solve = solveCanonExperiment(
          sized, rawCfg, span.minMM, span.maxMM, MIN_EFFECT_MM, anchorAt, optimalNodes ?? [], priority)
        rungCache.set(key, solve)
        if (rungCache.size > FITS_CAP) rungCache.delete(rungCache.keys().next().value!)
      }
      const rawRungs = solve.offers
      if (rawRungs.length) {
        // RULE 4 (Dan, 08-24): prefer the tight solution closest to the centroid — never the
        // smallest at any centring cost. Among offers of the SAME COUNT as the tightest, within
        // half a pitch of it, the best-centred is the default landing. All offers stay visible.
        const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
        // The default landing is Optimal's rule and stays Optimal's: the `canon` comparison row is
        // never the drawn default, however well it scores on Rule 4.
        const landing = rawRungs.filter((rg) => rg.roles.includes('optimal'))
        const ruleIdx = landing.length
          ? rawRungs.indexOf(landing[defaultLanding(landing, pitch)]) : defaultLanding(rawRungs, pitch)
        const idx = Math.min(stepSel ?? ruleIdx, rawRungs.length - 1)
        const perimeterOnly = cfg.perimeterOnly ?? true
        const rungs = rawRungs.map((rg) => {
          const points = applyCoverage([...rg.at.points], perimeterOnly, pitch).seated
          if (points.length === rg.at.points.length) return rg
          const kept = new Set(points)
          return { ...rg, at: { ...rg.at, count: points.length, points,
            gapsMM: rg.at.gapsMM.filter((_, i) => kept.has(rg.at.points[i])) } }
        })
        const at = rungs[idx].at
        // THE EMITTED CENTRE BELONGS TO THE EMITTED CONTOUR. `at.anchorMM` is the centre the search
        // used at the rung's exact contact size; the contour published is at the rung's SNAPPED size.
        // A few microns of size apart, and the result's centre no longer sat on its own shape — 2.9um
        // on a teardrop under Weight centring (QA @ca147429 F8). `at` keeps the search's facts for
        // ordering and reported contact; only what is drawn takes the anchor for the size it is drawn at.
        const drawnAt = { ...at, anchorMM: anchorAt(at.sizeMM) }
        const wcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM, magnetDiaMM: undefined, anchorAtMM: () => drawnAt.anchorMM }
        const drawn = wrapGrid(sized, wcfg, drawnAt)
        const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
        const r = spotRadiusOf(pad)
        const segments = safeSegments(drawn.contour, r, 'full')
        const anchors = assignSizes(at.points, (cfg.plan ?? 'all6') as MagnetPlan)
        const deliveredEvidence = measureProtection(drawn.contour, at.points,
          pitch, protectionPaddingMM, anchors.map((anchor) => anchor.dia / 2))
        const ladder = rungs.map((rg) => ({ sizeMM: rg.at.sizeMM, count: rg.at.count, offMM: rg.at.centreOffMM, roles: rg.roles }))
        const bk = bakeOf(sized, cfg, sig)
        const cf = classFrameNodes(bk.segW, bk.segH, band.id, cfg.pitchMM)
        const refMM = sizeRange(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)).maxMM
        const recog = {
          family: bk.family, cols: cf.cols, rows: cf.rows,
          segWmm: bk.segW * at.sizeMM / refMM, segHmm: bk.segH * at.sizeMM / refMM,
        }
        return {
          contour: drawn.contour, grid: { ...drawn.grid, anchors, segments },
          effSize: at.sizeMM, rungs: ladder, selectedRungIndex: idx, segments, offMM: at.centreOffMM, classificationDiagnostics: recog,
          bandClass, bandClasses, recommendation, unprotected: deliveredEvidence,
        }
      }
      // NO LAWFUL OFFER. Judge allowed nothing in this band. The witness comes from LAYOUT's own
      // generated population — the worker measures nothing and ranks nothing — and it is evidence,
      // never an offer.
      const bestSeatedMM = solve.bestSeated?.revealMM ?? span.minMM
      const contour = sized(bestSeatedMM)
      // The witness DRAWN is the witness layout SELECTED — one solve, at the same baked centre the
      // ladder used. Re-solving WITHOUT that centre drew a different population under the same
      // label: evidence of a solve nobody made.
      const grid = computeGrid(contour, { ...cfg, centreOverrideMM: anchorAt(bestSeatedMM) })
      return {
        contour, grid, effSize: bestSeatedMM, rungs: [], selectedRungIndex: 0, segments: grid.segments,
        offers: [], diagnostic: { reason: 'no-lawful-offer', bestSeatedMM },
        bandClass, bandClasses, recommendation,
      }
    }
  }
}
