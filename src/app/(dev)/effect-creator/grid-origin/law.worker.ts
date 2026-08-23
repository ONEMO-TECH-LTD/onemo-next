// law.worker.ts — runs the Law engine off the main thread. Pure dispatch: the same
// bridge/engine calls the page would make inline, nothing computed here.

import { computeGrid, fitSizeInBand, solveBands, validateSolverConfig, type BandId, type BandLadder, type BandSolveResult, type BoundaryTruth, type GridResult, type Pt, type CountTier, type SolverConfig } from '@/lib/magnetic-grid/engine'
import { contourIdentity, makeSizer } from '@/lib/effect/magnetic-grid-bridge'
import type { Contour } from '@/lib/effect/types'

interface SolveRequest {
  engineId: 'v351-centre-clone'
  id: number
  base: Contour
  boundaryTruth: BoundaryTruth
  /** The complete calibration, exactly as the dash set it. Validated at ingress; never repaired. */
  cfg: SolverConfig
  mode: BandId | 'free'
  sizeMM: number
  /** Manual registration — a per-request input, not a calibration. */
  forcedPhaseMM: Pt | null
  /** Selected rung on the band's ladder; null = the band's last (highest-count) rung. */
  rungSel: number | null
  /** Selected co-lawful layout on that rung; null = the first (gravity-ordered). */
  layoutSel: number | null
}

/** What the tab renders for a tier chip: the count, its first lawful size, and every distinct
 *  lawful layout kept there — with the marked one named. Nothing is hidden from the surface. */
type LayoutSummary = { family: string; magnetCount: number; sizeMM: number; overhangsMM: readonly number[]; recommended: boolean }
type RungSummary = Pick<CountTier, 'sizeMM' | 'magnetCount'> & { layouts: LayoutSummary[] }

const ctx = self as unknown as Worker

// Computed once = computed. The whole ladder is solved once per shape + config and every rung
// renders from that stored result; Free/manual sizes are cached per size. A new shape clears all.
let shapeSig = ''
const freeCache = new Map<string, { contour: Contour; grid: GridResult }>()
interface CachedBandSolve { result: BandSolveResult; contoursBySize: Map<number, Contour> }
const solves = new Map<string, CachedBandSolve>()
const FREE_CAP = 400
const SOLVE_CAP = 6

function solvedFor(
  rawSizer: (mm: number) => Contour,
  cfg: SolverConfig,
  solve: (sized: (mm: number) => Contour) => BandSolveResult,
): CachedBandSolve {
  const key = JSON.stringify(cfg)
  let cached = solves.get(key)
  if (!cached) {
    const contoursBySize = new Map<number, Contour>()
    const sized = (mm: number): Contour => {
      let contour = contoursBySize.get(mm)
      if (!contour) { contour = rawSizer(mm); contoursBySize.set(mm, contour) }
      return contour
    }
    cached = { result: solve(sized), contoursBySize }
    solves.set(key, cached)
    if (solves.size > SOLVE_CAP) solves.delete(solves.keys().next().value!)
  }
  return cached
}

const summarise = (ladder: BandLadder): RungSummary[] =>
  ladder.rungs.map((tier) => ({
    sizeMM: tier.sizeMM,
    magnetCount: tier.magnetCount,
    layouts: tier.layouts.map((layout, index) => ({
      family: layout.family, magnetCount: layout.magnetCount, sizeMM: layout.sizeMM,
      overhangsMM: layout.overhangsMM, recommended: index === tier.recommendedLayoutIndex,
    })),
  }))

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, engineId, base, boundaryTruth, cfg: rawCfg, mode, sizeMM, forcedPhaseMM, rungSel, layoutSel } = e.data
  try {
    if (engineId !== 'v351-centre-clone') throw new Error('wrong engine identity')
    // ONE ingress: the configuration is validated here or the request is refused. Nothing
    // downstream defaults, clamps or reinterprets it (Dan, 2026-08-23 — Spec is the single owner).
    const cfg = validateSolverConfig(rawCfg)
    const sized = makeSizer(base, cfg)
    if(boundaryTruth.contourIdentity!==contourIdentity(base))throw new Error('boundary truth does not match supplied contour')
    const sig = JSON.stringify([boundaryTruth.contourIdentity, cfg.outlineOffsetMM, cfg.contourFlattenRefMM, cfg.contourMaxVertices])
    if (sig !== shapeSig) { shapeSig = sig; freeCache.clear(); solves.clear() }
    if (mode !== 'free') {
      const cached = solvedFor(sized, cfg, (cachedSizer) => solveBands(cachedSizer, cfg))
      const solved = cached.result
      const band = cfg.bands.find((b) => b.id === mode)
      if (!band) throw new Error(`band ${mode} is not in the configured bands`)
      const ladder = solved.bands.find((b) => b.band === band.id)!
      if (ladder.rungs.length) {
        const idx = Math.max(0, Math.min(rungSel ?? ladder.rungs.length - 1, ladder.rungs.length - 1))
        const layoutIdx = Math.max(0, Math.min(layoutSel ?? 0, ladder.rungs[idx].layouts.length - 1))
        const grid = fitSizeInBand(solved, band.id, idx, layoutIdx)
        const eff = ladder.rungs[idx].sizeMM
        ctx.postMessage({ id, model: { contour: cached.contoursBySize.get(eff)!, grid, effSize: eff, ladder: summarise(ladder), idx, layoutIdx, refusal: null, segments: grid.segments, autoFlapMM: cfg.autoFlapEnabled ? Math.max(0, ...(grid.layouts[0]?.overhangsMM ?? [0])) : null } })
      } else {
        // The band accepts nothing: show its floor size as measured, with the typed refusal.
        const grid = solved.gridsBySize.get(band.minMM)!
        ctx.postMessage({ id, model: { contour: cached.contoursBySize.get(band.minMM)!, grid, effSize: band.minMM, ladder: [], idx: 0, layoutIdx: 0, refusal: ladder.refusal?.code ?? null, segments: grid.segments, autoFlapMM: null } })
      }
    } else {
      const k = JSON.stringify([cfg, forcedPhaseMM]) + '|' + sizeMM
      let hit = freeCache.get(k)
      if (!hit) {
        const contour = sized(sizeMM)
        hit = { contour, grid: computeGrid(contour, sizeMM, cfg, forcedPhaseMM) }
        freeCache.set(k, hit)
        if (freeCache.size > FREE_CAP) freeCache.delete(freeCache.keys().next().value!)
      }
      const freeAuto = cfg.autoFlapEnabled ? Math.max(0, ...(hit.grid.layouts[0]?.overhangsMM ?? [0])) : null
      ctx.postMessage({ id, model: { contour: hit.contour, grid: hit.grid, effSize: sizeMM, ladder: [], idx: 0, layoutIdx: 0, refusal: null, segments: hit.grid.segments, autoFlapMM: freeAuto } })
    }
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
