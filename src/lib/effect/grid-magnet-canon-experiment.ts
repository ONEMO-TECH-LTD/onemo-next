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
import { magnetRadiiMM } from './grid-magnet-logic'

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
  frameMidMM?: Pt
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
  const factsCache = new Map<BandRung, ReturnType<typeof holdingFactsOf>>()
  const facts = ({ rung }: WrappedCandidate) => {
    let value = factsCache.get(rung)
    if (!value) {
      value = holdingFactsOf(
        sized(rung.at.sizeMM), rung.at.points, rung.at.anchorMM, rung.at.centreOffMM,
        pitch, cfg.protectionPaddingMM ?? 24, magnetRadiiMM(rung.at.points, cfg.plan ?? 'all6'))
      factsCache.set(rung, value)
      rung.unprotected = value.evidence
    }
    return value
  }
  const stable = (rows: WrappedCandidate[]) => rows.sort((a, b) =>
    a.rung.at.sizeMM - b.rung.at.sizeMM || a.rung.at.centreOffMM - b.rung.at.centreOffMM
    || a.id.localeCompare(b.id))

  const fullRows: WrappedCandidate[] = []
  for (const candidate of canon.values()) {
    const rung = wrap(candidate.points, candidate.revealMM, [0, 0])
    if (rung) fullRows.push({
      rung, id: candidate.id, phaseMM: candidate.phaseMM, window: candidate.window, frameMidMM: [0, 0],
    })
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

  /** Dan's flap repair, bounded and role-safe: one same-count/same-phase swap per parent. */
  const repairOn = !!cfg.holdingRules && (cfg.holdingRules.universal || cfg.holdingRules.top
    || cfg.holdingRules.ends || cfg.holdingRules.balance)
  const phaseOf = (points: ReadonlyArray<Pt>, contour: Contour): Pt => {
    const box = bbox(contour.outer.pts), point = points[0]
    const mod = (value: number) => ((value % pitch) + pitch) % pitch
    return [mod(point[0] - box.minX), mod(point[1] - box.minY)]
  }
  const samePhase = (a: Pt, b: Pt) => {
    const delta = (left: number, right: number) => Math.min(Math.abs(left - right), pitch - Math.abs(left - right))
    return delta(a[0], b[0]) <= 0.01 && delta(a[1], b[1]) <= 0.01
  }
  const improves = (parent: ReturnType<typeof facts>, child: ReturnType<typeof facts>) =>
    child.unprotectedMM < parent.unprotectedMM - 1e-6
    || (Math.abs(child.unprotectedMM - parent.unprotectedMM) <= 1e-6
      && child.unprotectedAreaMM2 < parent.unprotectedAreaMM2 - 1e-6)
  const repairRows = (parents: WrappedCandidate[]): WrappedCandidate[] => {
    if (!repairOn) return parents
    const repaired = [...parents]
    for (const parent of parents) {
      trace.repairCandidates = (trace.repairCandidates ?? 0) + 1
      const parentFacts = facts(parent), target = parentFacts.evidence?.repairTargetMM
      if (!target) continue
      const contour = sized(parent.rung.at.sizeMM), box = bbox(contour.outer.pts)
      const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
      const fits = cfg.circle
        ? makeCircleSeatPredicate((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2,
          Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2, radius)
        : makeContourSeatPredicate(contour, radius)
      if (!fits) continue
      const parentPhase = phaseOf(parent.rung.at.points, contour)
      const occupied = new Set(parent.rung.at.points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`))
      const seats = latticeAt(box, pitch, parentPhase[0], parentPhase[1]).filter(fits)
        .filter(([x, y]) => !occupied.has(`${x.toFixed(3)},${y.toFixed(3)}`))
        .map((point) => ({ point, distance: Math.hypot(point[0] - target[0], point[1] - target[1]) }))
        .sort((a, b) => a.distance - b.distance || a.point[0] - b.point[0] || a.point[1] - b.point[1])
      const local = parent.rung.at.points.map(([x, y]) =>
        [x - parent.rung.at.originMM[0], y - parent.rung.at.originMM[1]] as Pt)
      let at = 0
      while (at < seats.length) {
        trace.repairShells = (trace.repairShells ?? 0) + 1
        const distance = seats[at].distance, shell: Pt[] = []
        while (at < seats.length && Math.abs(seats[at].distance - distance) <= 0.01) shell.push(seats[at++].point)
        const admitted: WrappedCandidate[] = []
        for (const worldSeat of shell) for (let remove = 0; remove < local.length; remove++) {
          trace.repairSwaps = (trace.repairSwaps ?? 0) + 1
          const localSeat: Pt = [worldSeat[0] - parent.rung.at.originMM[0], worldSeat[1] - parent.rung.at.originMM[1]]
          const moved = local.map((point, index) => index === remove ? localSeat : point)
          trace.repairWraps = (trace.repairWraps ?? 0) + 1
          const rung = wrap(moved, parent.rung.revealMM, parent.frameMidMM)
          if (!rung || rung.at.count !== parent.rung.at.count
            || rung.at.centreOffMM > parent.rung.at.centreOffMM + 0.05
            || !samePhase(parentPhase, phaseOf(rung.at.points, sized(rung.at.sizeMM)))) continue
          const candidate: WrappedCandidate = {
            ...parent, rung, id: `repair:${parent.id}:${remove}:${worldSeat[0].toFixed(3)},${worldSeat[1].toFixed(3)}`,
          }
          if (improves(parentFacts, facts(candidate))) {
            admitted.push(candidate)
            trace.repairAdmitted = (trace.repairAdmitted ?? 0) + 1
          }
        }
        if (admitted.length) { repaired.push(...admitted); break }
      }
    }
    return stable(repaired)
  }

  const repairedFullRows = repairRows(fullRows)
  const repairedSparseRows = repairRows(sparseRows)
  const repairedMaxRows = repairRows(maxRows)

  const scoredFull = rankByHolding([...repairedFullRows, ...repairedSparseRows], facts, cfg.holdingRules)
  const scoredSparse = rankByHolding(repairedSparseRows, facts, cfg.holdingRules)
  const scoredMax = rankByHolding(repairedMaxRows, facts, cfg.holdingRules)
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
    if (candidate?.id.startsWith('repair:')) trace.repairedRoles = [...(trace.repairedRoles ?? []), role]
    if (role === 'optimal' && candidate) {
      trace.source = candidate.id.startsWith('s:') || rung.at.count < canonNodesMM.length
        ? 'canon-partial' : 'canon-full'
      trace.retained = rung.at.count; trace.winningPhaseMM = candidate.phaseMM; trace.winningWindow = candidate.window
    }
  }
  for (const offer of offers) if (!offer.unprotected) {
    const value = holdingFactsOf(
      sized(offer.at.sizeMM), offer.at.points, offer.at.anchorMM, offer.at.centreOffMM,
      pitch, cfg.protectionPaddingMM ?? 24, magnetRadiiMM(offer.at.points, cfg.plan ?? 'all6'))
    offer.unprotected = value.evidence
  }
  if (!fullRows.length && scoredMax[0]) {
    trace.source = 'free-fallback'; trace.retained = scoredMax[0].rung.at.count
    trace.winningPhaseMM = scoredMax[0].phaseMM
  }
  trace.elapsedMs = Date.now() - started
  return { offers, bestSeated: bestSeatedCandidate(witnesses), trace }
}
