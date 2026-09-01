// TEMPORARY dev-only Canon smart-search. The released Current route remains unchanged.
import type { BandRung, BandSolve, CanonExperimentTrace, CanonPriority, Contour, GridConfig, Pt, WrapConfig } from './types'
import { DEFAULT_PITCH_MM, PADDING_FLOOR_MM, PHASE_STEP_MM, SNAP_STEP_MM } from './grid-magnet-spec'
import {
  bestSeatedCandidate, enumerateCanonPhaseWindows, enumerateFreePhaseMax, fallbackRevealSizes,
  latticeAt, makeCircleSeatPredicate, makeContourSeatPredicate, priorityTupleOf, tupleCmp, type CanonPhaseCandidate,
} from './units/layout'
import { bbox } from './foundation/geometry'
import { wrapGroup } from './units/wrap'
import { centringMM, inBand, orderCanonOffers } from './units/judge'

const localise = (pts: ReadonlyArray<Pt>): Pt[] => {
  if (!pts.length) return []
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  return pts.map(([x, y]) => [x - cx, y - cy] as Pt)
}

const identity = (pts: ReadonlyArray<Pt>, pitch: number): string =>
  pts.map(([x, y]) => `${Math.round(x / pitch)},${Math.round(y / pitch)}`).sort().join(';')

const freeIdentity = (pts: ReadonlyArray<Pt>, pitch: number): string => {
  let mx = Infinity, my = Infinity
  for (const p of pts) { mx = Math.min(mx, p[0]); my = Math.min(my, p[1]) }
  return pts.map(([x, y]) => `${Math.round((x - mx) / pitch)},${Math.round((y - my) / pitch)}`)
    .sort().join(';')
}

export function solveCanonExperiment(
  sized: (mm: number) => Contour, cfg: GridConfig, loMM: number, hiMM: number, minMM: number,
  anchorAtMM: (mm: number) => Pt, canonNodesMM: ReadonlyArray<Pt>,
  /** Priority hold points from the classifier. Absent = today's blind-count behaviour only. */
  priority?: CanonPriority,
): BandSolve & { trace: CanonExperimentTrace } {
  const started = Date.now()
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const canonLocal = localise(canonNodesMM)
  const wcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM,
    anchorAtMM, frameMidMM: [0, 0] }
  const trace: CanonExperimentTrace = {
    source: 'none', canonSeats: canonNodesMM.length, populations: 0, wraps: 0,
    retained: 0, readded: 0, phasePairs: 0, windows: 0, fitsCalls: 0, cacheHits: 0,
    elapsedMs: 0,
  }
  const finish = <T extends BandSolve & { trace: CanonExperimentTrace }>(result: T): T => {
    trace.elapsedMs = Date.now() - started
    return result
  }
  const attemptCanon = (pts: ReadonlyArray<Pt>): BandRung | null => {
    trace.wraps++
    const at = wrapGroup(sized, wcfg, pts, minMM, hiMM)
    return at && inBand(at.sizeMM, loMM, hiMM)
      ? { at, revealMM: hiMM, roles: ['optimal'] } : null
  }
  const whole = attemptCanon(canonLocal)
  if (whole) {
    trace.source = 'canon-full'; trace.populations = 1; trace.retained = whole.at.count
    if (!priority) return finish({ offers: [whole], bestSeated: null, trace })
    // The whole frame holds every priority by construction. A slim whole frame may still centre
    // (Gate 3): the same size ladder as the partial path, on the same unchanged Wrap unit.
    const blind: BandRung = { ...whole, roles: ['canon'] }
    if (!priority.slim) return finish({ offers: [{ ...whole, roles: ['optimal', 'canon'] }], bestSeated: null, trace })
    const rows = [{ rung: whole, id: 'whole' }]
    const ceiling = Math.min(hiMM, whole.at.sizeMM + centringMM(whole.at, priority.centreAxis))
    for (let mm = whole.at.sizeMM + SNAP_STEP_MM; mm <= ceiling + 1e-9; mm += SNAP_STEP_MM) {
      trace.wraps++
      const at = wrapGroup(sized, wcfg, canonLocal, mm, mm)
      if (at && inBand(at.sizeMM, loMM, hiMM)) rows.push({ rung: { at, revealMM: mm, roles: ['optimal'] }, id: 'whole' })
    }
    const best = orderCanonOffers(rows, priority)[0].rung
    const same = Math.abs(best.at.sizeMM - whole.at.sizeMM) < 0.005
    return finish({ offers: same ? [{ ...whole, roles: ['optimal', 'canon'] }] : [{ ...best, roles: ['optimal'] }, blind], bestSeated: null, trace })
  }

  const settleCanon = (seed: ReadonlyArray<Pt>, first: BandRung): BandRung => {
    let group = [...seed], rung = first
    for (;;) {
      const contour = sized(rung.at.sizeMM)
      const bb = bbox(contour.outer.pts)
      const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
      const fits = cfg.circle
        ? makeCircleSeatPredicate((bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2,
          Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2, radius)
        : makeContourSeatPredicate(contour, radius)
      if (!fits) return rung
      const expanded = canonLocal.filter(([x, y]) => fits([rung.at.originMM[0] + x, rung.at.originMM[1] + y]))
      if (expanded.length <= group.length || identity(expanded, pitch) === identity(group, pitch)) return rung
      const next = attemptCanon(expanded)
      if (!next) return rung
      trace.readded += expanded.length - group.length
      group = expanded
      rung = next
    }
  }

  // One sweep, two accumulators (Dan, 2026-09-01: "max must be conditional"). Reveals walk
  // LARGEST-FIRST so the fullest priority window is found at once and floors every later reveal;
  // candidate points are frame-local, so which reveal first produced an id never changes its wrap.
  const candidates = new Map<string, CanonPhaseCandidate>()
  const priorityCandidates = new Map<string, CanonPhaseCandidate>()
  let priorityFloor: number[] | undefined
  for (const mm of fallbackRevealSizes(loMM, hiMM).reverse()) {
    const search = enumerateCanonPhaseWindows(sized(mm), { ...cfg, perimeterOnly: false },
      canonLocal, anchorAtMM(mm), mm, PHASE_STEP_MM, priority, priorityFloor)
    trace.phasePairs += search.phasePairs
    trace.windows += search.windows
    trace.fitsCalls += search.fitsCalls
    trace.cacheHits += search.cacheHits
    for (const candidate of search.candidates) if (!candidates.has(candidate.id)) candidates.set(candidate.id, candidate)
    if (priority) for (const candidate of search.priorityCandidates) {
      const tuple = priorityTupleOf(candidate.id.split(',').map(Number), priority)
      const cmp = priorityFloor ? tupleCmp(tuple, priorityFloor) : 1
      if (cmp < 0) continue
      if (cmp > 0) { priorityFloor = tuple; priorityCandidates.clear() }
      if (!priorityCandidates.has(candidate.id)) priorityCandidates.set(candidate.id, candidate)
    }
  }
  trace.populations = candidates.size
  const maxCanonCount = Math.max(0, ...[...candidates.values()].map((x) => x.points.length))
  const fullest = [...candidates.values()].filter((x) => x.points.length === maxCanonCount)
    .sort((a, b) => a.id.localeCompare(b.id))
  // TWO INDEPENDENT WINNERS from one enumeration (QA F1, 2026-09-01). The blind row and the
  // priority row are each wrapped on their own; either may exist without the other, and only when
  // neither wraps in-band does the solve fall to the free-grid maximum.
  const lawful: Array<{ rung: BandRung; candidate: CanonPhaseCandidate }> = []
  for (const candidate of fullest) {
    const rung = attemptCanon(candidate.points)
    if (rung) lawful.push({ rung: settleCanon(candidate.points, rung), candidate })
  }
  lawful.sort((a, b) => a.rung.at.sizeMM - b.rung.at.sizeMM
    || a.rung.at.centreOffMM - b.rung.at.centreOffMM
    || a.candidate.id.localeCompare(b.candidate.id))
  if (!priority) {
    if (lawful.length) {
      const winner = lawful[0]
      trace.source = 'canon-partial'; trace.retained = winner.rung.at.count
      trace.winningPhaseMM = winner.candidate.phaseMM
      trace.winningWindow = winner.candidate.window
      return finish({ offers: [winner.rung], bestSeated: null, trace })
    }
  } else {
    // PRIORITY-MAX OPTIMAL. Wrapped without settle: settling re-adds every fitting frame node and
    // would undo the very seats the priorities chose to give up. The blind row keeps its settle.
    const priorityLawful = orderCanonOffers([...priorityCandidates.values()].flatMap((candidate) => {
      const rung = attemptCanon(candidate.points)
      if (!rung) return []
      const rows = [{ rung, id: candidate.id, candidate }]
      // SLIM CENTRING (Gate 3). A one- or two-line frame has no partner seats to balance it, so
      // symmetry cannot centre it; size can. The unchanged Wrap unit is asked for the lawful
      // placement at each exact size above the tight one — origin nearest the governed centre —
      // up to the point where growth can no longer pay for itself (key = centring + size, so no
      // size beyond tight + centring(tight) can win). Judge then picks.
      if (priority.slim) {
        const ceiling = Math.min(hiMM, rung.at.sizeMM + centringMM(rung.at, priority.centreAxis))
        for (let mm = rung.at.sizeMM + SNAP_STEP_MM; mm <= ceiling + 1e-9; mm += SNAP_STEP_MM) {
          trace.wraps++
          const at = wrapGroup(sized, wcfg, candidate.points, mm, mm)
          if (at && inBand(at.sizeMM, loMM, hiMM)) rows.push({ rung: { at, revealMM: mm, roles: ['optimal'] }, id: candidate.id, candidate })
        }
      }
      return rows
    }), priority)
    const blind: BandRung | null = lawful.length ? { ...lawful[0].rung, roles: ['canon'] } : null
    const optimal: BandRung | null = priorityLawful.length ? { ...priorityLawful[0].rung, roles: ['optimal'] } : null
    if (blind || optimal) {
      const lead = (optimal ? priorityLawful[0] : lawful[0]) as { rung: BandRung; candidate: CanonPhaseCandidate }
      trace.source = 'canon-partial'; trace.retained = lead.rung.at.count
      trace.winningPhaseMM = lead.candidate.phaseMM
      trace.winningWindow = lead.candidate.window
      if (!blind) return finish({ offers: [optimal!], bestSeated: null, trace })
      if (!optimal) return finish({ offers: [blind], bestSeated: null, trace })
      const same = Math.abs(optimal.at.sizeMM - blind.at.sizeMM) < 0.005
        && identity(optimal.at.points, pitch) === identity(blind.at.points, pitch)
      return finish({ offers: same ? [{ ...blind, roles: ['optimal', 'canon'] }] : [optimal, blind], bestSeated: null, trace })
    }
  }

  const free = new Map<string, { points: Pt[]; revealMM: number; id: string; phaseMM: Pt }>()
  const witnesses: Array<{ revealMM: number; points: Pt[] }> = []
  for (const mm of fallbackRevealSizes(loMM, hiMM)) {
    const search = enumerateFreePhaseMax(sized(mm), { ...cfg, perimeterOnly: false },
      anchorAtMM(mm), mm, PHASE_STEP_MM)
    trace.phasePairs += search.phasePairs
    trace.fitsCalls += search.fitsCalls
    trace.cacheHits += search.cacheHits
    for (const candidate of search.candidates) {
      witnesses.push({ revealMM: mm, points: candidate.points })
      const id = freeIdentity(candidate.points, pitch)
      if (!free.has(id)) free.set(id, {
        points: candidate.points, revealMM: mm, id, phaseMM: candidate.phaseMM,
      })
    }
  }
  trace.populations = free.size
  const ordered = [...free.values()].sort((a, b) => b.points.length - a.points.length || a.id.localeCompare(b.id))
  const freeWcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM, anchorAtMM }
  const settleFree = (first: BandRung): BandRung => {
    let rung = first
    for (;;) {
      const contour = sized(rung.at.sizeMM)
      const bb = bbox(contour.outer.pts)
      const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
      const fits = cfg.circle
        ? makeCircleSeatPredicate((bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2,
          Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2, radius)
        : makeContourSeatPredicate(contour, radius)
      if (!fits) return rung
      const seed = rung.at.points[0]
      const mod = (v: number) => ((v % pitch) + pitch) % pitch
      const expanded = latticeAt(bb, pitch, mod(seed[0] - bb.minX), mod(seed[1] - bb.minY)).filter(fits)
      if (expanded.length <= rung.at.count) return rung
      const at = wrapGroup(sized, freeWcfg, localise(expanded), minMM, hiMM)
      if (!at || !inBand(at.sizeMM, loMM, hiMM)) return rung
      rung = { at, revealMM: rung.revealMM, roles: ['max'] }
    }
  }
  for (let i = 0; i < ordered.length;) {
    const count = ordered[i].points.length
    const atCount: Array<{ rung: BandRung; id: string; phaseMM: Pt }> = []
    while (i < ordered.length && ordered[i].points.length === count) {
      const candidate = ordered[i++]
      trace.wraps++
      const at = wrapGroup(sized, freeWcfg, localise(candidate.points), minMM, hiMM)
      if (at && inBand(at.sizeMM, loMM, hiMM)) {
        const raw: BandRung = { at, revealMM: candidate.revealMM, roles: ['max'] }
        atCount.push({ rung: settleFree(raw), id: candidate.id, phaseMM: candidate.phaseMM })
      }
    }
    if (atCount.length) {
      atCount.sort((a, b) => a.rung.at.sizeMM - b.rung.at.sizeMM
        || a.rung.at.centreOffMM - b.rung.at.centreOffMM || a.id.localeCompare(b.id))
      const winner = atCount[0]
      trace.source = 'free-fallback'; trace.retained = winner.rung.at.count
      trace.winningPhaseMM = winner.phaseMM
      return finish({ offers: [winner.rung], bestSeated: bestSeatedCandidate(witnesses), trace })
    }
  }
  return finish({ offers: [], bestSeated: bestSeatedCandidate(witnesses), trace })
}
