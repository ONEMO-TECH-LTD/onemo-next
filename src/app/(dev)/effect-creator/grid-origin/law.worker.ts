// law.worker.ts — runs the Law engine off the main thread. Pure dispatch: the same
// bridge/engine calls the page would make inline, nothing computed here.

import { autoFlapInBand, BANDS, computeGrid, fitSizeInBand, solveBands, type BandId, type BandLadder, type BandSolveResult, type BoundaryTruth, type GridConfig, type GridResult, type Placement, type Rung } from '@/lib/magnetic-grid/engine'
import { contourIdentity, makeSizer } from '@/lib/effect/magnetic-grid-bridge'
import type { Contour } from '@/lib/effect/types'

interface SolveRequest {
  engineId: 'v351-centre-clone'
  id: number
  base: Contour
  boundaryTruth: BoundaryTruth
  offsetMM: number
  cfg: GridConfig
  mode: BandId | 'free'
  sizeMM: number
  /** Selected rung on the band's ladder; null = the band's last (highest-count) rung. */
  rungSel: number | null
  /** Selected co-lawful layout on that rung; null = the first (gravity-ordered). */
  layoutSel: number | null
  /** Auto cap in whole mm; null = fixed flap. */
  autoFlapMaxMM?: number | null
}

/** What the tab renders for a rung chip: the final Rung's size and count plus each co-lawful layout's placement. */
type RungSummary = Pick<Rung, 'sizeMM' | 'magnetCount'> & { layouts: Placement[] }

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
  wrapCfg: GridConfig,
  solve: (sized: (mm: number) => Contour) => BandSolveResult,
): CachedBandSolve {
  const key = JSON.stringify(wrapCfg)
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
  ladder.rungs.map((r) => ({ sizeMM: r.sizeMM, magnetCount: r.magnetCount, layouts: r.layouts.map((l) => l.candidate.placement) }))

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, engineId, base, boundaryTruth, offsetMM, cfg, mode, sizeMM, rungSel, layoutSel, autoFlapMaxMM } = e.data
  try {
    if (engineId !== 'v351-centre-clone') throw new Error('wrong engine identity')
    const sized = makeSizer(base, offsetMM)
    if(boundaryTruth.contourIdentity!==contourIdentity(base))throw new Error('boundary truth does not match supplied contour')
    const sig = JSON.stringify([boundaryTruth.contourIdentity, offsetMM])
    if (sig !== shapeSig) { shapeSig = sig; freeCache.clear(); solves.clear() }
    const wrapCfg: GridConfig = autoFlapMaxMM != null
      ? { ...cfg, wrapMode: 'auto', autoFlapCapMM: autoFlapMaxMM }
      : { ...cfg, wrapMode: 'fixed' }
    if (mode !== 'free') {
      const cached = solvedFor(sized, wrapCfg, (cachedSizer) => autoFlapMaxMM != null
        ? autoFlapInBand(cachedSizer, cfg, autoFlapMaxMM)
        : solveBands(cachedSizer, wrapCfg))
      const solved = cached.result
      const band = BANDS.find((b) => b.id === mode) ?? BANDS[0]
      const ladder = solved.bands.find((b) => b.band === band.id)!
      if (ladder.rungs.length) {
        const idx = Math.max(0, Math.min(rungSel ?? ladder.rungs.length - 1, ladder.rungs.length - 1))
        const layoutIdx = Math.max(0, Math.min(layoutSel ?? 0, ladder.rungs[idx].layouts.length - 1))
        const grid = fitSizeInBand(solved, band.id, idx, layoutIdx)
        const eff = ladder.rungs[idx].sizeMM
        ctx.postMessage({ id, model: { contour: cached.contoursBySize.get(eff)!, grid, effSize: eff, ladder: summarise(ladder), idx, layoutIdx, refusal: null, segments: grid.segments, autoFlapMM: autoFlapMaxMM != null && grid.wrap.status === 'lawful' ? grid.wrap.appliedFlapMM : null } })
      } else {
        // The band accepts nothing: show its floor size as measured, with the typed refusal.
        const grid = solved.gridsBySize.get(band.minMM)!
        ctx.postMessage({ id, model: { contour: cached.contoursBySize.get(band.minMM)!, grid, effSize: band.minMM, ladder: [], idx: 0, layoutIdx: 0, refusal: ladder.refusal?.code ?? null, segments: grid.segments, autoFlapMM: null } })
      }
    } else {
      const k = JSON.stringify(wrapCfg) + '|' + sizeMM
      let hit = freeCache.get(k)
      if (!hit) {
        const contour = sized(sizeMM)
        hit = { contour, grid: computeGrid(contour, sizeMM, wrapCfg) }
        freeCache.set(k, hit)
        if (freeCache.size > FREE_CAP) freeCache.delete(freeCache.keys().next().value!)
      }
      const freeAuto = autoFlapMaxMM != null && hit.grid.wrap.status === 'lawful' ? hit.grid.wrap.appliedFlapMM : null
      ctx.postMessage({ id, model: { contour: hit.contour, grid: hit.grid, effSize: sizeMM, ladder: [], idx: 0, layoutIdx: 0, refusal: null, segments: hit.grid.segments, autoFlapMM: freeAuto } })
    }
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
