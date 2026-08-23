// Magnetic-grid Logic: Centre policy over completed neutral measurements.

import type { Anchor, BandId, BBox, Band, BandLadder, CentreMeasurements, CentreMode, CentrePhaseCandidate, CentrePlacementMeasurement, Concession, ExtremeCornerMeasurement, Governor, LawfulLayout, MagnetPlan, ParityMeasurement, PerimeterMeasurement, PlacementCandidate, Pt, RefusalCode, Rung, WrapEvaluation, WrapMeasurement, WrapPolicy } from './spec'
import {
  BANDS,
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
  MIN_ANCHORS,
} from './spec'
/** Which band a size falls in — dominant side against the band ranges. Null above the last. */
export function bandOf(sizeMM: number): Band | null {
  for (const b of BANDS) if (sizeMM >= b.minMM && sizeMM <= b.maxMM) return b
  return null
}

/** Which mass rules — the switchable governor: 0 smallest area · 1 deepest · 2 top (gravity) ·
 *  3 top-small — RULED 2026-08-19: among masses in the shape's upper half the smallest governs;
 *  if nothing lives in the upper half, the topmost governs. The small mass needs the precision,
 *  the upper mass needs the anchor; a bottom sliver can never rule, and the governor stays
 *  stable across the size ladder. */
export function governMass<M extends { areaMM2: number; centreMM: Pt; peakClearMM?: number }>(
  masses: ReadonlyArray<M>, governor: Governor, midY?: number,
): M | null {
  if (!masses.length) return null
  if (governor === 3) {
    const mid = midY ?? Math.min(...masses.map((m) => m.centreMM[1]))
    const upper = masses.filter((m) => m.centreMM[1] >= mid)
    if (upper.length) return governMass(upper, 0)
    return governMass(masses, 2)
  }
  let best = masses[0]
  for (const m of masses) {
    if (governor === 0 && m.areaMM2 < best.areaMM2) best = m
    if (governor === 1 && (m.peakClearMM ?? 0) > (best.peakClearMM ?? 0)) best = m
    if (governor === 2 && m.centreMM[1] > best.centreMM[1]) best = m
  }
  return best
}

/**
 * The centres a mode aims at — the switchable test system. Every returned point both anchors
 * the slide walk and (for single-target modes) is the balance target. Mode 2 returns every
 * mass centre; its balance target is then the governing mass via centeringRef.
 */
export function centeringAnchors(
  mode: CentreMode,
  measured: CentreMeasurements,
): Pt[] {
  if (mode === 0) return [measured.box]
  if (mode === 3) return [measured.weight]
  if (mode === 1) return [measured.core]
  if (mode === 4) return [measured.deep]
  if (mode === 5) return [measured.top]
  // Mode 2 — adaptive: every mass centre anchors; scoring chooses between them.
  return measured.masses.length ? measured.masses.map((m) => m.centreMM) : [measured.box]
}

/** The four class-derived Centre phases. Geometry is measured later by compute. */
export function centrePhaseCandidates(target: Pt, bb: BBox, pitch: number): CentrePhaseCandidate[] {
  const bxc = target[0] - bb.minX, byc = target[1] - bb.minY
  const half = pitch / 2
  const clsOf = (side: number) => bandOf(side)?.id ?? BANDS[BANDS.length - 1].id
  const canX = clsOf(bb.maxX - bb.minX) % 2 === 1 ? bxc : bxc + half
  const canY = clsOf(bb.maxY - bb.minY) % 2 === 1 ? byc : byc + half
  const otherX = canX === bxc ? bxc + half : bxc
  const otherY = canY === byc ? byc + half : byc
  return [
    { phaseMM: [canX, canY], canon: 2 },
    { phaseMM: [otherX, canY], canon: 1 },
    { phaseMM: [canX, otherY], canon: 1 },
    { phaseMM: [otherX, otherY], canon: 0 },
  ]
}

/** Centre-rules ordering over completed neutral placement measurements. */
export function chooseCentrePlacement(
  candidates: ReadonlyArray<CentrePlacementMeasurement>,
): CentrePlacementMeasurement | null {
  let best: CentrePlacementMeasurement | null = null
  for (const candidate of candidates) {
    if (!candidate.seated.length) continue
    const wins = !best
      || candidate.seated.length > best.seated.length
      || (candidate.seated.length === best.seated.length && candidate.canon > best.canon)
      || (candidate.seated.length === best.seated.length && candidate.canon === best.canon && candidate.excessMM < best.excessMM)
    if (wins) best = candidate
  }
  return best
}

/** Wrap law over the whole-mm belt measurement; a geometry refusal passes through unchanged. */
export function evaluateWrap(measured: WrapMeasurement, policy: WrapPolicy): WrapEvaluation {
  if (measured.status === 'refused') {
    return { status: 'refused', code: 'NO_WRAPPED_LAYOUT_IN_BAND', reason: measured.refusal.reason, requiredFlapMM: null, allowedFlapMM: null, witnesses: [] }
  }
  const allowedFlapMM = policy.mode === 'fixed' ? policy.allowanceMM : policy.capMM
  if (measured.requiredFlapMM > allowedFlapMM) {
    return {
      status: 'refused',
      code: policy.mode === 'auto' ? 'AUTO_FLAP_CAP_EXCEEDED' : 'WRAP_EXCEEDS_ALLOWANCE',
      requiredFlapMM: measured.requiredFlapMM,
      allowedFlapMM,
      witnesses: measured.witnesses,
    }
  }
  return {
    status: 'lawful',
    requiredFlapMM: measured.requiredFlapMM,
    appliedFlapMM: policy.mode === 'auto' ? measured.requiredFlapMM : policy.allowanceMM,
    witnesses: measured.witnesses,
  }
}

/** Fixed-size/manual inspection concessions: any measured miss of the centre law, and a refused Wrap. */
export function inspectionConcessions(parity: ParityMeasurement, wrap: WrapEvaluation): Concession[] {
  const concessions: Concession[] = []
  if (!parity.parityTrue || parity.centreErrorMM > 0) concessions.push('CENTRE')
  if (wrap.status !== 'lawful') concessions.push('WRAP')
  return concessions
}

/**
 * MAGNET-QUANTITY SCALING over completed candidates (every even size, all four placements):
 * a layout is accepted when it is centred (parity true) and wrap-lawful; each
 * count is published once, at its smallest accepted size in the first band that accepts it,
 * strictly greater than the last published count; every co-lawful layout at that size is kept
 * (Auto keeps the minimum allowance and its ties); vertical eliminates horizontal on an
 * otherwise-equal pair. No score, no fallback, no hidden winner.
 */
export function reduceBandLadders(candidates: readonly PlacementCandidate[], policy: WrapPolicy): BandLadder[] {
  const isHorizontal = (l: LawfulLayout) => l.candidate.placement.xHalf && !l.candidate.placement.yHalf
  const isVertical = (l: LawfulLayout) => !l.candidate.placement.xHalf && l.candidate.placement.yHalf
  const gravityRank = (l: LawfulLayout) => (isVertical(l) ? 1 : isHorizontal(l) ? 2 : l.candidate.placement.xHalf ? 3 : 0)
  const ladders: BandLadder[] = []
  const owned = new Set<number>()
  let lastPublished = 0
  for (const band of BANDS) {
    const inBand = candidates.filter((c) => c.sizeMM >= band.minMM && c.sizeMM <= band.maxMM)
    // centreErrorMM is report-only. The frozen parity verdict is the Centre law.
    const centred = inBand.filter((c) => c.parityTrue)
    const judged = centred.map((c) => ({ candidate: c, wrap: evaluateWrap(c.wrapMeasurement, policy) }))
    const lawful: LawfulLayout[] = judged.flatMap((j) => j.wrap.status === 'lawful' ? [{ candidate: j.candidate, wrap: j.wrap }] : [])
    const rungs: Rung[] = []
    // Walk the band's accepted sizes in order; at each size publish every count strictly greater
    // than the last published one, smallest first — so a count lands at its smallest accepted size.
    const sizes = [...new Set(lawful.map((l) => l.candidate.sizeMM))].sort((a, b) => a - b)
    for (const sizeMM of sizes) for (const magnetCount of [...new Set(lawful.filter((l) => l.candidate.sizeMM === sizeMM).map((l) => l.candidate.magnetCount))].sort((a, b) => a - b)) {
      if (magnetCount < 1 || magnetCount <= lastPublished || owned.has(magnetCount)) continue
      let atSize = lawful.filter((l) => l.candidate.sizeMM === sizeMM && l.candidate.magnetCount === magnetCount)
      if (policy.mode === 'auto') {
        const minFlap = Math.min(...atSize.map((l) => l.wrap.requiredFlapMM))
        atSize = atSize.filter((l) => l.wrap.requiredFlapMM === minFlap)
      }
      const equal = (a: LawfulLayout, b: LawfulLayout) =>
        a.wrap.requiredFlapMM === b.wrap.requiredFlapMM && a.wrap.appliedFlapMM === b.wrap.appliedFlapMM
      const layouts = atSize
        .filter((l) => !(isHorizontal(l) && atSize.some((v) => isVertical(v) && equal(v, l))))
        .sort((a, b) => gravityRank(a) - gravityRank(b))
      rungs.push({ band: band.id as BandId, sizeMM, magnetCount, layouts })
      owned.add(magnetCount)
      lastPublished = magnetCount
    }
    ladders.push({ band: band.id as BandId, rungs, refusal: rungs.length ? null : { code: bandRefusal(inBand, centred, judged.map((j) => j.wrap), lawful, policy) } })
  }
  return ladders
}

function bandRefusal(
  inBand: readonly PlacementCandidate[], centred: readonly PlacementCandidate[], verdicts: readonly WrapEvaluation[],
  lawful: readonly LawfulLayout[], policy: WrapPolicy,
): RefusalCode {
  if (!inBand.length) return 'NO_CENTRE'
  if (inBand.every((c) => !c.seated.length)) return 'NO_WRAPPED_LAYOUT_IN_BAND'
  if (!centred.length) return 'NO_PARITY_LAWFUL_PLACEMENT'
  if (lawful.length) return 'NO_WRAPPED_LAYOUT_IN_BAND'           // lawful layouts exist, but every count is owned below
  if (verdicts.some((v) => v.status === 'refused' && v.code !== 'NO_WRAPPED_LAYOUT_IN_BAND')) return policy.mode === 'auto' ? 'AUTO_FLAP_CAP_EXCEEDED' : 'WRAP_EXCEEDS_ALLOWANCE'
  return 'NO_WRAPPED_LAYOUT_IN_BAND'
}

/** Perimeter belt: with >4 seated, drop fully-surrounded interior nodes, never below the minimum. */
export function applyCoverage(
  seated: Pt[],
  perimeterOnly: boolean,
  split: PerimeterMeasurement,
): { seated: Pt[]; interior: Pt[] } {
  if (!perimeterOnly || seated.length <= 4) return { seated, interior: [] }
  if (split.belt.length >= MIN_ANCHORS) return { seated: split.belt, interior: split.interior }
  return { seated, interior: [] }
}


/** Per-anchor magnet size. corners8 → the large body on the extreme corners, small elsewhere. */
export function assignSizes(measured: ReadonlyArray<ExtremeCornerMeasurement>, plan: MagnetPlan): Anchor[] {
  if (plan === 'all8') return measured.map(({ p }) => ({ p, dia: MAGNET_DIA_LARGE_MM }))
  if (plan === 'all6') return measured.map(({ p }) => ({ p, dia: MAGNET_DIA_SMALL_MM }))
  return measured.map(({ p, extremeCorner }) => {
    return { p, dia: extremeCorner ? MAGNET_DIA_LARGE_MM : MAGNET_DIA_SMALL_MM }
  })
}
