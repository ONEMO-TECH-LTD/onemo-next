// Magnetic-grid Logic: Centre policy over completed neutral measurements.

import type {
  BandLawDecision,
  Band,
  BBox,
  CandidateGeometry,
  CandidateLawEvaluation,
  CentreBranchMeasurement,
  CentreDecision,
  CentreLawEvaluation,
  CentreMeasurements,
  CentreMode,
  CentrePhaseCandidate,
  CentrePlacementMeasurement,
  CentrePolicy,
  EvaluationPolicy,
  ExactPoint,
  ExactReal,
  ExtremeCornerMeasurement,
  CandidateInspection,
  Governor,
  LawfulCandidateMeasurement,
  LawReduction,
  LegacyGridAnchor,
  MagnetPlan,
  PerimeterMeasurement,
  Pt,
  Refusal,
  RootedCandidateGeometry,
  WrapEvaluation,
  WrapMeasurement,
  WrapPolicy,
} from './spec'
import {
  BANDS,
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
  MIN_ANCHORS,
} from './spec'
import { compareExact, compareExactToRational } from './compute'

const QUANTUM_KEY_MM = 0.001
const mod = (v: number, m: number) => ((v % m) + m) % m

/** Preserved numeric Centre predicate; intentionally unreferenced until its named T3 consumer. */
export function parityHolds(seat: ReadonlyArray<Pt>, target: Pt, bb: BBox, pitch: number): boolean {
  if (!seat.length) return false
  const lines = (axis: 0 | 1) => new Set(seat.map((s) => Math.round(s[axis] / QUANTUM_KEY_MM))).size
  const onNode = (axis: 0 | 1) => {
    const off = mod(seat[0][axis] - target[axis], pitch)
    return off < pitch / 4 || off > pitch * 3 / 4
  }
  void bb
  return (lines(0) % 2 === 1) === onNode(0) && (lines(1) % 2 === 1) === onNode(1)
}

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

/** Wrap law over completed exact belt measurements; no geometry or tolerance enters Logic. */
export function evaluateWrap(measured: WrapMeasurement, policy: WrapPolicy): WrapEvaluation {
  const allowed = policy.mode === 'fixed' ? policy.allowance : policy.cap
  const allowedApproxMM = policy.mode === 'fixed' ? policy.allowanceApproxMM : policy.capApproxMM
  if (measured.refusal) {
    return {
      status: 'refused', code: measured.refusal.code, reason: measured.refusal.reason,
      requiredFlap: measured.requiredFlap, requiredFlapApproxMM: measured.requiredFlapApproxMM,
      allowedFlap: allowed, allowedFlapApproxMM: allowedApproxMM, witnesses: measured.witnesses,
    }
  }
  if (compareExactToRational(measured.requiredFlap, allowed) > 0) {
    return {
      status: 'refused',
      code: policy.mode === 'auto' ? 'AUTO_FLAP_CAP_EXCEEDED' : 'WRAP_EXCEEDS_ALLOWANCE',
      requiredFlap: measured.requiredFlap,
      requiredFlapApproxMM: measured.requiredFlapApproxMM,
      allowedFlap: allowed,
      allowedFlapApproxMM: allowedApproxMM,
      witnesses: measured.witnesses,
    }
  }
  return {
    status: 'lawful',
    requiredFlap: measured.requiredFlap,
    requiredFlapApproxMM: measured.requiredFlapApproxMM,
    appliedFlap: policy.mode === 'auto' ? measured.requiredFlap : policy.allowance,
    appliedFlapApproxMM: policy.mode === 'auto' ? measured.requiredFlapApproxMM : policy.allowanceApproxMM,
    witnesses: measured.witnesses,
  }
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
export function assignSizes(measured: ReadonlyArray<ExtremeCornerMeasurement>, plan: MagnetPlan): LegacyGridAnchor[] {
  if (plan === 'all8') return measured.map(({ p }) => ({ p, dia: MAGNET_DIA_LARGE_MM }))
  if (plan === 'all6') return measured.map(({ p }) => ({ p, dia: MAGNET_DIA_SMALL_MM }))
  return measured.map(({ p, extremeCorner }) => {
    return { p, dia: extremeCorner ? MAGNET_DIA_LARGE_MM : MAGNET_DIA_SMALL_MM }
  })
}

const refusal = (code: Refusal['code'], evidence: Refusal['evidence']): Refusal => ({ status: 'refused', code, evidence })
/** Centre policy over completed neutral exact evidence. */
export function evaluateCentreLaw(measured: CentreBranchMeasurement, policy: CentrePolicy): CentreLawEvaluation {
  const { evidence } = measured
  const requestedPolicy = policy
  let targets: ExactPoint[] = []
  try {
    if (policy.mode === 'box') targets = [evidence.box]
    else if (policy.mode === 'weight') targets = [evidence.weight]
    else if (policy.mode === 'core') targets = evidence.core ? [evidence.core] : []
    else if (policy.mode === 'deep') targets = [...evidence.deepest]
    else if (policy.mode === 'top') {
      const best = measured.frozenMasses.find((mass) => mass.topOrder === 0)
      if (best) targets = [best.centre]
    } else if (measured.frozenMasses.length) {
      let candidates = [...measured.frozenMasses]
      if (policy.governor === 'top-small') {
        const upper = candidates.filter((mass) => mass.upperHalf)
        if (upper.length) candidates = upper
        else candidates = candidates.slice().sort((left, right) => left.topOrder - right.topOrder)
      }
      const order = policy.governor === 'deepest' ? 'peakOrder'
        : policy.governor === 'top' || (policy.governor === 'top-small' && !candidates.some((mass) => mass.upperHalf)) ? 'topOrder'
          : 'areaOrder'
      let best = candidates[0]
      for (const mass of candidates.slice(1)) if (mass[order] < best[order]) best = mass
      targets = [best.centre]
    }
  } catch {
    return {
      context: measured.context,
      evidenceId: evidence.id,
      decisions: [],
      refusal: refusal('CENTRE_EVIDENCE_UNRESOLVED', { evidenceId: evidence.id }),
    }
  }
  if (!targets.length) return {
    context: measured.context,
    evidenceId: evidence.id,
    decisions: [],
    refusal: refusal(policy.mode === 'core' ? 'NO_SAFE_CORE' : 'NO_CENTRE', { evidenceId: evidence.id }),
  }
  const decisions: CentreDecision[] = targets.map((target) => ({ target, policy: requestedPolicy, evidenceId: evidence.id }))
  return { context: measured.context, evidenceId: evidence.id, decisions, refusal: null }
}

export function parityIsLawful(candidate: CandidateGeometry, centre: CentreDecision): boolean {
  void centre
  return (candidate.parityEvidence.x.lineCount % 2 === 1) === (candidate.parityEvidence.x.centreRelation === 'node')
    && (candidate.parityEvidence.y.lineCount % 2 === 1) === (candidate.parityEvidence.y.centreRelation === 'node')
}

export const wrapIsLawful = (requiredFlap: ExactReal, allowedFlap: ExactReal) =>
  compareExact(requiredFlap, allowedFlap) <= 0

export function chooseLawfulCandidate(
  candidates: readonly LawfulCandidateMeasurement[],
): readonly LawfulCandidateMeasurement[] | Refusal {
  if (!candidates.length) return refusal('NO_WRAPPED_LAYOUT_IN_BAND', {})
  const vertical = candidates.filter((candidate) => candidate.orientation === 'vertical')
  return (vertical.length ? vertical : candidates).slice().sort((a, b) => a.measuredId.localeCompare(b.measuredId))
}

export function evaluateCandidateLaws(
  measured: RootedCandidateGeometry,
  config: EvaluationPolicy,
): CandidateLawEvaluation {
  const selected = config.coverage === 'full' ? measured.seated : measured.belt
  const lawfulParity = parityIsLawful(measured, measured.centre)
  const allowed = config.flap.mode === 'fixed' ? config.flap.allowance : config.flap.maxAllowance
  let lawfulWrap = false
  try { lawfulWrap = compareExactToRational(measured.requiredFlap, allowed) <= 0 } catch { lawfulWrap = false }
  if (!lawfulParity || !lawfulWrap) return {
    status: 'refused',
    refusal: refusal(!lawfulParity ? 'NO_PARITY_LAWFUL_PLACEMENT'
      : config.flap.mode === 'auto' ? 'AUTO_FLAP_CAP_EXCEEDED' : 'WRAP_EXCEEDS_ALLOWANCE', { measuredId: measured.measuredId }),
    measured,
    policyIdentity: config.policyIdentity,
  }
  const extremes = config.coverage === 'full' ? measured.seatedExtremeCorners : measured.beltExtremeCorners
  const diameterFor = (index: number): 6 | 8 => config.magnetPlan === 'all8' ? 8 : config.magnetPlan === 'all6' ? 6
    : extremes[index] ? 8 : 6
  const candidate: LawfulCandidateMeasurement = {
    ...measured,
    anchors: selected.map((centre, index) => ({ centre, diameterMM: diameterFor(index) })),
    coverage: config.coverage,
    magnetCount: selected.length,
    parityTrue: true,
    wrapTrue: true,
    appliedFlap: config.flap.mode === 'auto' ? measured.requiredFlap : config.flap.allowance,
    flapMode: config.flap.mode,
    policyIdentity: config.policyIdentity,
  }
  return { status: 'lawful', candidate }
}

/** Fixed-size inspection projection; Logic alone translates measured law failures into concessions. */
export function inspectCandidateLaws(
  evaluation: CandidateLawEvaluation,
  config: EvaluationPolicy,
): CandidateInspection {
  const measured = evaluation.status === 'lawful' ? evaluation.candidate : evaluation.measured
  const selected = config.coverage === 'full' ? measured.seated : measured.belt
  const extremes = config.coverage === 'full' ? measured.seatedExtremeCorners : measured.beltExtremeCorners
  const diameterFor = (index: number): 6 | 8 => config.magnetPlan === 'all8' ? 8 : config.magnetPlan === 'all6' ? 6 : extremes[index] ? 8 : 6
  const parityTrue = evaluation.status === 'lawful' || evaluation.refusal.code !== 'NO_PARITY_LAWFUL_PLACEMENT'
  const wrapTrue = evaluation.status === 'lawful'
    || (evaluation.refusal.code !== 'WRAP_EXCEEDS_ALLOWANCE'
      && evaluation.refusal.code !== 'AUTO_FLAP_CAP_EXCEEDED'
      && evaluation.refusal.code !== 'NO_WRAPPED_LAYOUT_IN_BAND')
  return {
    anchors: evaluation.status === 'lawful' ? evaluation.candidate.anchors
      : selected.map((centre, index) => ({ centre, diameterMM: diameterFor(index) })),
    magnetCount: selected.length,
    parityTrue,
    centreErrorMM: measured.centreErrorMM,
    requiredFlap: measured.requiredFlap,
    requiredFlapApproxMM: measured.requiredFlapApproxMM,
    orientation: measured.orientation,
    concessions: [
      ...(!parityTrue || !measured.centreTrue ? ['CENTRE' as const] : []),
      ...(!wrapTrue ? ['WRAP' as const] : []),
    ],
  }
}

/** First-lawful count ownership, cross-band no-repeat, tie retention and conflict propagation. */
export function reduceBandLadders(
  centres: readonly CentreLawEvaluation[],
  candidates: readonly CandidateLawEvaluation[],
): LawReduction {
  const bands: BandLawDecision[] = BANDS.map((band) => ({ band: band.id, rungs: [], refusal: null }))
  const owned = new Map<number, number>()
  for (const band of bands) {
    const lawfulAtBand = candidates.filter((candidate): candidate is Extract<CandidateLawEvaluation, { status: 'lawful' }> =>
      candidate.status === 'lawful' && candidate.candidate.band === band.band)
    const lawful = lawfulAtBand.filter(({ candidate }) => !lawfulAtBand.some(({ candidate: other }) =>
      compareExact(other.scale.exact, candidate.scale.exact) === 0 && other.magnetCount > candidate.magnetCount))
    const measuredLayouts = new Map<string, string>()
    for (const { candidate } of lawful) {
      const prior = measuredLayouts.get(candidate.measuredId)
      if (prior !== undefined && prior !== candidate.geometryLayoutId) {
        band.refusal = refusal('RUNG_CONFLICT', { band: band.band, measuredId: candidate.measuredId })
        break
      }
      measuredLayouts.set(candidate.measuredId, candidate.geometryLayoutId)
    }
    if (band.refusal) continue
    const counts = [...new Set(lawful.map((candidate) => candidate.candidate.magnetCount))].sort((a, b) => a - b)
    const rungs = [] as BandLawDecision['rungs'][number][]
    for (const magnetCount of counts) {
      if (owned.has(magnetCount)) continue
      const forCount = lawful.filter((candidate) => candidate.candidate.magnetCount === magnetCount)
      let scale = forCount[0].candidate.scale.exact
      for (const candidate of forCount.slice(1)) if (compareExact(candidate.candidate.scale.exact, scale) < 0) scale = candidate.candidate.scale.exact
      let atScale = forCount.filter((candidate) => compareExact(candidate.candidate.scale.exact, scale) === 0).map((candidate) => candidate.candidate)
      const auto = atScale.filter((candidate) => candidate.flapMode === 'auto')
      if (auto.length) {
        let minimum = auto[0].requiredFlap
        for (const candidate of auto.slice(1)) if (compareExact(candidate.requiredFlap, minimum) < 0) minimum = candidate.requiredFlap
        atScale = atScale.filter((candidate) => compareExact(candidate.requiredFlap, minimum) === 0)
      }
      const chosen = chooseLawfulCandidate(atScale)
      if (!Array.isArray(chosen) || !chosen.length) {
        band.refusal = refusal('RUNG_CONFLICT', { band: band.band, magnetCount })
        continue
      }
      const contact = chosen[0].contacts[0]
      const earlier = candidates.filter((candidate) => {
        const measured = candidate.status === 'lawful' ? candidate.candidate : candidate.measured
        const count = candidate.status === 'lawful' ? candidate.candidate.magnetCount : measured.beltCount
        return count === magnetCount && compareExact(measured.scale.exact, scale) < 0
      })
      const earlierSiteIds = centres.filter((centre) =>
        centre.context.band === band.band && compareExact(centre.context.scale.exact, scale) < 0)
        .map((centre) => centre.context.siteId)
      rungs.push({
        band: band.band,
        scale: chosen[0].scale,
        magnetCount,
        firstLawful: {
          regimeId: chosen[0].regimeId,
          priorEvidenceIds: [...new Set([
            ...earlierSiteIds,
            ...earlier.map((candidate) => candidate.status === 'lawful' ? candidate.candidate.measuredId : candidate.measured.measuredId),
          ])],
          contact,
        },
        candidates: chosen,
      })
      owned.set(magnetCount, band.band)
    }
    ;(band as unknown as { rungs: typeof rungs }).rungs = rungs
  }
  const centreRefusal = centres.find((centre) => centre.refusal)?.refusal ?? null
  const candidateRefusal = candidates.find((candidate) => candidate.status === 'refused')
  const reductionRefusal = bands.find((band) => band.refusal)?.refusal ?? null
  return {
    bands,
    globalRefusal: bands.every((band) => !band.rungs.length)
      ? reductionRefusal ?? centreRefusal ?? (candidateRefusal?.status === 'refused' ? candidateRefusal.refusal : null)
      : reductionRefusal,
  }
}
