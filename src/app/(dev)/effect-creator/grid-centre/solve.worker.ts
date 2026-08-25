// solve.worker.ts — runs the grid solve off the main thread. Pure dispatch: the same
// bridge/engine calls the page used to make inline, nothing computed here.

import { BANDS, computeGrid, fitSizeInBand, MIN_EFFECT_MM, type GridConfig, type GridResult } from '@/lib/effect/grid-magnet'
import { wrapBandLadder, wrapGrid, wrapGroup, type BandRung, type WrapConfig } from '@/lib/effect/grid-magnet-wrap-compute'
import { bbox, centroidOf, safeSegments, spotRadiusOf } from '@/lib/effect/grid-magnet-compute'
import { anchorBakeOf, anchorFromBake, assignSizes, type AnchorBake, type CentreMode, type Governor, type MagnetPlan } from '@/lib/effect/grid-magnet-logic'
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
  /** The slider's window when snapping — stops (distinct pressed sizes) are computed for it. */
  snapWindow?: [number, number]
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
// Snap stops: the window's distinct pressed sizes — the same rungs the band ladder offers,
// computed once per window and drawn as ticks on the slider.
const stopsCache = new Map<string, Array<{ press: number; reveal: number }>>()
// ANCHOR BAKE — the centre measured ONCE per shape (at the largest size, all material present)
// and scaled linearly per size. Positions are shape features; only qualification is size-
// dependent (evaluated inside anchorFromBake). Core mode (1) is size-dependent by definition
// and stays live — the bake returns null and the engine measures as before.
const bakeCache = new Map<string, { bake: AnchorBake; sig: string }>()
function anchorFnFor(
  sized: (mm: number) => import('@/lib/effect/types').Contour, cfg: GridConfig, cfgSig: string, shapeSig2: string,
): ((mm: number) => import('@/lib/effect/types').Pt) | undefined {
  const mode = (cfg.centreMode ?? 2) as CentreMode
  if (mode === 1) return undefined                    // Core: live by definition
  const key = shapeSig2 + '|' + JSON.stringify([cfg.paddingMM, cfg.massDepthMM])
  let hit = bakeCache.get(key)
  if (!hit) {
    const refMM = sizeRange(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)).maxMM
    const outer = sized(refMM).outer.pts
    const bb = bbox(outer)
    const r = spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM))
    const segs = safeSegments(outer, r, Math.max(r, cfg.massDepthMM ?? MASS_DEPTH_MM), 'light')
    const bake = anchorBakeOf(segs, [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2], centroidOf(outer), refMM, (bb.minY + bb.maxY) / 2)
    hit = { bake, sig: key }
    bakeCache.set(key, hit)
    if (bakeCache.size > 8) bakeCache.delete(bakeCache.keys().next().value!)
  }
  // Dan, verified visually 2026-08-25: the centre does not change with scale — the shape is
  // fixed. So the SELECTION is made once too, at full size, and that one point IS the anchor
  // at every size, scaled linearly. No per-size re-election.
  const bake = hit.bake
  const gov = (cfg.governor ?? 0) as Governor
  const depth = Math.max(spotRadiusOf(Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)), cfg.massDepthMM ?? MASS_DEPTH_MM)
  const aRef = anchorFromBake(bake, mode, gov, depth, bake.refMM) ?? bake.boxC
  return (mm: number) => [aRef[0] * mm / bake.refMM, aRef[1] * mm / bake.refMM]
}

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
  const { id, base, offsetMM, cfg, mode, sizeMM, snapStep, stepSel, snapWrap, snapWindow } = e.data
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
    if (sig !== shapeSig) { shapeSig = sig; freeCache.clear(); walkCaches.clear(); walkFits.clear(); rungCache.clear(); snapCache.clear(); stopsCache.clear() }
    const cfgSig = JSON.stringify(cfg)
    if (mode !== 'free' && (cfg.positioning ?? 0) === 1) {
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
        ctx.postMessage({ id, model: {
          contour: drawn.contour, grid: { ...drawn.grid, anchors, segments },
          effSize: at.sizeMM, ladder, idx, segments, offMM: at.centreOffMM,
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
      const anchorFn = anchorFnFor(sized, cfg, cfgSig, sig)
      let stops: Array<{ press: number; reveal: number }> = []
      if (snapWindow) {
        const wk = cfgSig + '|' + snapWindow[0] + '|' + snapWindow[1]
        let hitS = stopsCache.get(wk)
        if (!hitS) {
          const raw = wrapBandLadder(sized, cfg, snapWindow[0], snapWindow[1], MIN_EFFECT_MM, anchorFn)
            .map((r) => ({ press: r.at.sizeMM, reveal: r.revealMM }))
          hitS = raw.filter((v, i) => i === 0 || v.press - raw[i - 1].press > 0.1)
          stopsCache.set(wk, hitS)
          if (stopsCache.size > FITS_CAP) stopsCache.delete(stopsCache.keys().next().value!)
        }
        stops = hitS
      }
      const fk = cfgSig + '|' + sizeMM
      let free = freeCache.get(fk)
      if (!free) {
        const contour = sized(sizeMM)
        free = { contour, grid: computeGrid(contour, anchorFn ? { ...cfg, centreOverrideMM: anchorFn(sizeMM) } : cfg) }
        freeCache.set(fk, free)
        if (freeCache.size > FREE_CAP) freeCache.delete(freeCache.keys().next().value!)
      }
      const pts = free.grid.anchors.map((a) => a.p)
      if (!pts.length) {
        ctx.postMessage({ id, model: { contour: free.contour, grid: free.grid, effSize: sizeMM, ladder: [], idx: 0, segments: free.grid.segments, stops } })
        return
      }
      const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
      let mx = Infinity, my = Infinity
      for (const q of pts) { if (q[0] < mx) mx = q[0]; if (q[1] < my) my = q[1] }
      const layoutId = pts.map((q) => Math.round((q[0] - mx) / pitch) + ',' + Math.round((q[1] - my) / pitch)).sort().join(';')
      const sk = cfgSig + '|' + layoutId
      const cached = snapCache.get(sk)
      if (cached !== undefined) { ctx.postMessage({ id, model: { ...(cached as object), stops } }); return }
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1])
      const gx = (Math.min(...xs) + Math.max(...xs)) / 2, gy = (Math.min(...ys) + Math.max(...ys)) / 2
      const wcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM, centreMode: cfg.centreMode, governor: cfg.governor, massDepthMM: cfg.massDepthMM, anchorAtMM: anchorFn }
      let memo = snapAnchors.get(cfgSig)
      if (!memo) { memo = new Map(); snapAnchors.set(cfgSig, memo); if (snapAnchors.size > 4) snapAnchors.delete(snapAnchors.keys().next().value!) }
      const at = wrapGroup(sized, wcfg, pts.map(([x, y]) => [x - gx, y - gy] as [number, number]), MIN_EFFECT_MM, sizeMM, memo)
      let model: unknown
      if (!at) {
        model = { contour: free.contour, grid: free.grid, effSize: sizeMM, ladder: [], idx: 0, segments: free.grid.segments }
      } else {
        const contour = sized(at.sizeMM)
        // computeGrid's registration phase is measured FROM THE SHAPE'S BBOX CORNER and must
        // anchor a LATTICE NODE. The wrap's origin is the group's MIDDLE — between nodes for
        // even layouts — so the phase comes from a real magnet position instead.
        // The wrap's seat coordinates live in the frame of ITS size, and the shape's coordinates
        // SCALE with size — so at any display size the anchor seat is seat0 x (eff / at.sizeMM).
        // At exact tangency the wrap's float check and the seat test's integer arithmetic can
        // disagree by under a micron, so step up within the seat test's 0.05mm guard band until
        // the binding seat registers. Declared tolerance alignment, not behavior.
        const seat0 = at.points[0]
        let eff = at.sizeMM
        let shown = contour
        let grid: GridResult
        for (let bump = 0; ; bump += 0.01) {
          eff = at.sizeMM + bump
          shown = bump === 0 ? contour : sized(eff)
          const b2 = bbox(shown.outer.pts)
          const sc = eff / at.sizeMM
          grid = computeGrid(shown, { ...cfg, forcePhaseMM: [seat0[0] * sc - b2.minX, seat0[1] * sc - b2.minY], ...(anchorFn ? { centreOverrideMM: anchorFn(eff) } : {}) })
          if (grid.anchors.length >= at.count || bump >= 0.06) break
        }
        model = { contour: shown, grid, effSize: eff, ladder: [], idx: 0, segments: grid.segments }
      }
      snapCache.set(sk, model)
      if (snapCache.size > FREE_CAP) snapCache.delete(snapCache.keys().next().value!)
      ctx.postMessage({ id, model: { ...(model as object), stops } })
    } else {
      const k = cfgSig + '|' + sizeMM
      let hit = freeCache.get(k)
      if (!hit) {
        const contour = sized(sizeMM)
        const aFn = anchorFnFor(sized, cfg, cfgSig, sig)
        hit = { contour, grid: computeGrid(contour, aFn ? { ...cfg, centreOverrideMM: aFn(sizeMM) } : cfg) }
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
