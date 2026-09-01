import type { BandRung, BandSolve, CanonExperimentTrace, Contour, GridConfig, Pt, WrapConfig } from './types'
import { DEFAULT_PITCH_MM, PADDING_FLOOR_MM, PHASE_STEP_MM } from './grid-magnet-spec'
import {
  bestSeatedCandidate, enumerateCanonPhaseWindows, enumerateFreePhaseMax, fallbackRevealSizes,
  latticeAt, makeCircleSeatPredicate, makeContourSeatPredicate, type CanonPhaseCandidate,
  type FreePhaseCandidate,
} from './units/layout'
import { bbox } from './foundation/geometry'
import { wrapGroup } from './units/wrap'
import { holdingFactsOf, inBand, rankByHolding, sparseExtremeHold } from './units/judge'

const localise = (points: ReadonlyArray<Pt>): Pt[] => {
  if (!points.length) return []
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  return points.map(([x, y]) => [x - cx, y - cy])
}

const freeIdentity = (points: ReadonlyArray<Pt>, pitch: number): string => {
  let minX = Infinity, minY = Infinity
  for (const [x, y] of points) { minX = Math.min(minX, x); minY = Math.min(minY, y) }
  return points.map(([x, y]) => `${Math.round((x - minX) / pitch)},${Math.round((y - minY) / pitch)}`)
    .sort().join(';')
}

type WrappedCandidate = {
  rung: BandRung
  id: string
  phaseMM: Pt
  window?: Pt
}

type SearchCache = {
  canon: Array<[string, CanonPhaseCandidate]>
  free: Array<[string, FreePhaseCandidate]>
  witnesses: Array<{ revealMM: number; points: Pt[] }>
  phasePairs: number; windows: number; fitsCalls: number; cacheHits: number
}
const searchCache = new Map<string, SearchCache>()
const wrapCache = new Map<string, BandRung | null>()

export function solveCanonExperiment(
  sized: (mm: number) => Contour, cfg: GridConfig, loMM: number, hiMM: number, minMM: number,
  anchorAtMM: (mm: number) => Pt, canonNodesMM: ReadonlyArray<Pt>, cacheIdentity?: string,
): BandSolve & { trace: CanonExperimentTrace } {
  const started = Date.now(), pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const canonLocal = localise(canonNodesMM)
  const trace: CanonExperimentTrace = {
    source: 'none', canonSeats: canonNodesMM.length, populations: 0, wraps: 0,
    retained: 0, readded: 0, phasePairs: 0, windows: 0, fitsCalls: 0, cacheHits: 0, elapsedMs: 0,
  }
  const canon = new Map<string, CanonPhaseCandidate>()
  const free = new Map<string, FreePhaseCandidate>()
  const witnesses: Array<{ revealMM: number; points: Pt[] }> = []
  const searchKey = cacheIdentity ? JSON.stringify([
    cacheIdentity, loMM, hiMM, pitch, cfg.paddingMM, cfg.circle, canonLocal,
  ]) : null
  const cached = searchKey ? searchCache.get(searchKey) : undefined

  if (cached) {
    for (const [id, candidate] of cached.canon) canon.set(id, candidate)
    for (const [id, candidate] of cached.free) free.set(id, candidate)
    witnesses.push(...cached.witnesses)
    trace.phasePairs = cached.phasePairs; trace.windows = cached.windows
    trace.fitsCalls = cached.fitsCalls; trace.cacheHits = cached.cacheHits
  } else for (const mm of fallbackRevealSizes(loMM, hiMM)) {
    if (canonLocal.length) {
      const search = enumerateCanonPhaseWindows(
        sized(mm), { ...cfg, perimeterOnly: false }, canonLocal, anchorAtMM(mm), mm, PHASE_STEP_MM)
      trace.phasePairs += search.phasePairs; trace.windows += search.windows
      trace.fitsCalls += search.fitsCalls; trace.cacheHits += search.cacheHits
      for (const candidate of search.candidates) if (!canon.has(candidate.id)) canon.set(candidate.id, candidate)
      for (const candidate of search.freeCandidates) {
        witnesses.push({ revealMM: mm, points: candidate.points })
        const id = freeIdentity(candidate.points, pitch)
        if (!free.has(id)) free.set(id, candidate)
      }
    } else {
      const search = enumerateFreePhaseMax(
        sized(mm), { ...cfg, perimeterOnly: false }, anchorAtMM(mm), mm, PHASE_STEP_MM)
      trace.phasePairs += search.phasePairs; trace.fitsCalls += search.fitsCalls; trace.cacheHits += search.cacheHits
      for (const candidate of search.candidates) {
        witnesses.push({ revealMM: mm, points: candidate.points })
        const id = freeIdentity(candidate.points, pitch)
        if (!free.has(id)) free.set(id, candidate)
      }
    }
  }
  if (!cached) {
    if (searchKey) searchCache.set(searchKey, {
      canon: [...canon], free: [...free], witnesses: [...witnesses],
      phasePairs: trace.phasePairs, windows: trace.windows,
      fitsCalls: trace.fitsCalls, cacheHits: trace.cacheHits,
    })
    if (searchKey && searchCache.size > 12) searchCache.delete(searchCache.keys().next().value!)
  }
  trace.populations = canon.size + free.size

  const wrap = (points: ReadonlyArray<Pt>, revealMM: number, frameMidMM?: Pt): BandRung | null => {
    const key = searchKey ? JSON.stringify([
      searchKey, minMM, revealMM, frameMidMM, points,
    ]) : null
    if (key && wrapCache.has(key)) return wrapCache.get(key) ?? null
    trace.wraps++
    const wcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM, anchorAtMM, frameMidMM }
    const at = wrapGroup(sized, wcfg, points, minMM, revealMM)
    const rung = at && inBand(at.sizeMM, loMM, hiMM) ? { at, revealMM, roles: [] as BandRung['roles'] } : null
    if (key) wrapCache.set(key, rung)
    if (key && wrapCache.size > 512) wrapCache.delete(wrapCache.keys().next().value!)
    return rung
  }
  const facts = ({ rung }: WrappedCandidate) =>
    holdingFactsOf(sized(rung.at.sizeMM), rung.at.points, rung.at.anchorMM)
  const stable = (rows: WrappedCandidate[]) => rows.sort((a, b) =>
    a.rung.at.sizeMM - b.rung.at.sizeMM || a.rung.at.centreOffMM - b.rung.at.centreOffMM
    || a.id.localeCompare(b.id))

  const fullRows: WrappedCandidate[] = []
  for (const candidate of canon.values()) {
    const rung = wrap(candidate.points, candidate.revealMM, [0, 0])
    if (rung) fullRows.push({ rung, id: candidate.id, phaseMM: candidate.phaseMM, window: candidate.window })
  }
  stable(fullRows)
  fullRows.sort((a, b) => b.rung.at.count - a.rung.at.count)

  const sparseRows: WrappedCandidate[] = []
  for (const parent of fullRows) {
    const sparse = sparseExtremeHold(
      sized(parent.rung.at.sizeMM), parent.rung.at.points, parent.rung.at.anchorMM)
    const rung = sparse.length ? wrap(localise(sparse), parent.rung.revealMM) : null
    if (rung) sparseRows.push({ ...parent, rung, id: `s:${parent.id}` })
  }
  stable(sparseRows)

  const settleFree = (first: BandRung): BandRung => {
    let rung = first
    for (;;) {
      const contour = sized(rung.at.sizeMM), box = bbox(contour.outer.pts)
      const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
      const fits = cfg.circle
        ? makeCircleSeatPredicate((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2,
          Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2, radius)
        : makeContourSeatPredicate(contour, radius)
      if (!fits) return rung
      const seed = rung.at.points[0], mod = (v: number) => ((v % pitch) + pitch) % pitch
      const expanded = latticeAt(box, pitch, mod(seed[0] - box.minX), mod(seed[1] - box.minY)).filter(fits)
      if (expanded.length <= rung.at.count) return rung
      const next = wrap(localise(expanded), rung.revealMM)
      if (!next) return rung
      trace.readded += expanded.length - rung.at.count
      rung = next
    }
  }
  const maxRows: WrappedCandidate[] = []
  for (const [id, candidate] of free) {
    const rung = wrap(localise(candidate.points), candidate.revealMM)
    if (rung) maxRows.push({ rung: settleFree(rung), id, phaseMM: candidate.phaseMM })
  }
  const maxFreeCount = Math.max(0, ...maxRows.map((candidate) => candidate.rung.at.count))
  for (let index = maxRows.length - 1; index >= 0; index--)
    if (maxRows[index].rung.at.count < maxFreeCount) maxRows.splice(index, 1)
  stable(maxRows)

  const scoredFull = rankByHolding([...fullRows, ...sparseRows], facts, cfg.holdingRules)
  const scoredSparse = rankByHolding(sparseRows, facts, cfg.holdingRules)
  const scoredMax = rankByHolding(maxRows, facts, cfg.holdingRules)
  const selected: Array<[BandRung | undefined, 'optimal' | 'min' | 'max', WrappedCandidate | undefined]> = [
    [scoredFull[0]?.rung, 'optimal', scoredFull[0]],
    [scoredSparse[0]?.rung, 'min', scoredSparse[0]],
    [scoredMax[0]?.rung, 'max', scoredMax[0]],
  ]
  const offers: BandRung[] = [], kept = new Map<string, BandRung>()
  const shipped = (rung: BandRung) => rung.at.sizeMM.toFixed(2) + '|'
    + rung.at.points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).sort().join(';')
  for (const [rung, role, candidate] of selected) {
    if (!rung) continue
    const id = shipped(rung), same = kept.get(id)
    if (same) same.roles.push(role)
    else { const copy = { ...rung, roles: [role] }; kept.set(id, copy); offers.push(copy) }
    if (role === 'optimal' && candidate) {
      trace.source = candidate.id.startsWith('s:') || rung.at.count < canonNodesMM.length
        ? 'canon-partial' : 'canon-full'
      trace.retained = rung.at.count; trace.winningPhaseMM = candidate.phaseMM; trace.winningWindow = candidate.window
    }
  }
  if (!fullRows.length && scoredMax[0]) {
    trace.source = 'free-fallback'; trace.retained = scoredMax[0].rung.at.count
    trace.winningPhaseMM = scoredMax[0].phaseMM
  }
  trace.elapsedMs = Date.now() - started
  return { offers, bestSeated: bestSeatedCandidate(witnesses), trace }
}
