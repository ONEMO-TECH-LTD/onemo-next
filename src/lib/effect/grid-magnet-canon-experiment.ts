// TEMPORARY dev-only canon-first experiment. The released ladder remains unchanged.
import type { BandRung, BandSolve, CanonExperimentTrace, Contour, GridConfig, Pt, WrapConfig } from './types'
import { computeGrid } from './grid-magnet'
import { wrapBandLadder } from './grid-magnet-wrap-compute'
import { DEFAULT_PITCH_MM, PADDING_FLOOR_MM } from './grid-magnet-spec'
import { fallbackRevealSizes, makeCircleSeatPredicate, makeContourSeatPredicate } from './units/layout'
import { bbox } from './foundation/geometry'
import { wrapGroup } from './units/wrap'
import { inBand } from './units/judge'

const localise = (pts: ReadonlyArray<Pt>): Pt[] => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  return pts.map(([x, y]) => [x - cx, y - cy] as Pt)
}

const identity = (pts: ReadonlyArray<Pt>, pitch: number): string => {
  return pts.map(([x, y]) => `${Math.round(x / pitch)},${Math.round(y / pitch)}`).sort().join(';')
}

export function solveCanonExperiment(
  sized: (mm: number) => Contour, cfg: GridConfig, loMM: number, hiMM: number, minMM: number,
  anchorAtMM: (mm: number) => Pt, canonNodesMM: ReadonlyArray<Pt>,
): BandSolve & { trace: CanonExperimentTrace } {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const canonLocal = localise(canonNodesMM)
  const wcfg: WrapConfig = { pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM,
    anchorAtMM, frameMidMM: [0, 0] }
  const trace: CanonExperimentTrace = { source: 'none', canonSeats: canonNodesMM.length,
    populations: 0, wraps: 0, retained: 0, readded: 0 }
  const attempt = (pts: ReadonlyArray<Pt>): BandRung | null => {
    trace.wraps++
    const at = wrapGroup(sized, wcfg, pts, minMM, hiMM)
    return at && inBand(at.sizeMM, loMM, hiMM) ? { at, revealMM: hiMM, roles: ['optimal'] } : null
  }

  const whole = attempt(canonLocal)
  if (whole) {
    trace.source = 'canon-full'; trace.populations = 1; trace.retained = whole.at.count
    return { offers: [whole], bestSeated: null, trace }
  }

  const candidates = new Map<string, Pt[]>()
  const settle = (seed: ReadonlyArray<Pt>, first: BandRung): BandRung => {
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
      const next = attempt(expanded)
      if (!next) return rung
      trace.readded += expanded.length - group.length
      group = expanded
      rung = next
    }
  }
  const subsetLocal = (seated: ReadonlyArray<Pt>): Pt[] | null => {
    if (!seated.length) return null
    for (const originNode of canonLocal) {
      const dx = seated[0][0] - originNode[0], dy = seated[0][1] - originNode[1]
      const subset = canonLocal.filter(([x, y]) => seated.some(([px, py]) =>
        Math.abs(px - (x + dx)) < 0.01 && Math.abs(py - (y + dy)) < 0.01))
      if (subset.length === seated.length) return subset
    }
    return null
  }
  const scanCfg: GridConfig = { ...cfg, perimeterOnly: false, segmentsDetail: 'light', forcePhaseMM: undefined }
  for (const mm of fallbackRevealSizes(loMM, hiMM)) {
    const grid = computeGrid(sized(mm), { ...scanCfg, centreOverrideMM: anchorAtMM(mm) }, canonLocal)
    for (const pts of grid.canonSeatings) if (pts.length) {
      const subset = subsetLocal(pts)
      if (subset) candidates.set(identity(subset, pitch), subset)
    }
  }
  const ordered = [...candidates.values()].sort((a, b) => b.length - a.length
    || identity(a, pitch).localeCompare(identity(b, pitch)))
  trace.populations = ordered.length
  for (let i = 0; i < ordered.length;) {
    const count = ordered[i].length
    const lawful: BandRung[] = []
    while (i < ordered.length && ordered[i].length === count) {
      const group = ordered[i++], rung = attempt(group)
      if (rung) lawful.push(settle(group, rung))
    }
    if (lawful.length) {
      lawful.sort((a, b) => a.at.centreOffMM - b.at.centreOffMM || a.at.sizeMM - b.at.sizeMM)
      const winner = lawful[0]
      trace.source = 'canon-partial'; trace.retained = winner.at.count
      return { offers: [winner], bestSeated: null, trace }
    }
  }

  const fallback = wrapBandLadder(sized, cfg, loMM, hiMM, minMM, anchorAtMM)
  const max = [...fallback.offers].sort((a, b) => b.at.count - a.at.count || a.at.sizeMM - b.at.sizeMM)[0]
  if (max) {
    max.roles = ['max']; trace.source = 'free-fallback'; trace.retained = max.at.count
    return { offers: [max], bestSeated: fallback.bestSeated, trace }
  }
  return { offers: [], bestSeated: fallback.bestSeated, trace }
}
