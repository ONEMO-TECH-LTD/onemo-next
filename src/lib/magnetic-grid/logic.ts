// Centre-rules compatibility logic. No geometry construction.

import type {
  CentreDecision,
  CentreMeasurements,
  CentrePolicy,
  ExactCentreDecision,
  ExactCentreEvaluation,
  ExactCentreEvidence,
  ExactCentreRegion,
  Governor,
  ParityCandidateMeasurement,
  Pt,
} from './spec'
import { compareExact } from './compute'

function exactDecision(
  policy: CentrePolicy,
  target: ExactCentreDecision['target'],
  branch: ExactCentreDecision['branch'],
  evidenceId: string,
  regionId: string | null,
): ExactCentreDecision {
  return { policy, target, branch, evidenceId, regionId }
}

function tiedExtrema(
  values: readonly ExactCentreRegion[],
  valueOf: (value: ExactCentreRegion) => ExactCentreRegion['area'],
  direction: 'min' | 'max',
): readonly ExactCentreRegion[] | null {
  if (!values.length) return []
  try {
    let selected: ExactCentreRegion[] = [values[0]]
    for (const value of values.slice(1)) {
      const comparison = compareExact(valueOf(value), valueOf(selected[0]))
      const wins = direction === 'min' ? comparison < 0 : comparison > 0
      if (wins) selected = [value]
      else if (comparison === 0) selected.push(value)
    }
    return selected
  } catch {
    return null
  }
}

export function evaluateExactCentrePolicy(evidence: ExactCentreEvidence, policy: CentrePolicy): ExactCentreEvaluation {
  const direct = (target: ExactCentreDecision['target'] | null, branch: ExactCentreDecision['branch']): ExactCentreEvaluation =>
    target
      ? { status: 'lawful', decisions: [exactDecision(policy, target, branch, evidence.id, null)] }
      : { status: 'refused', decisions: [], code: 'CENTRE_EVIDENCE_MISSING' }
  if (policy.mode === 'box') return direct(evidence.box, 'box')
  if (policy.mode === 'core') return direct(evidence.core, 'core')
  if (policy.mode === 'weight') return direct(evidence.weight, 'weight')

  let candidates: readonly ExactCentreRegion[] | null
  if (policy.mode === 'deep') candidates = tiedExtrema(evidence.regions, (region) => region.peakClear, 'max')
  else if (policy.mode === 'top') candidates = tiedExtrema(evidence.masses, (mass) => mass.centre.y, 'max')
  else if (policy.governor === 'smallest') candidates = tiedExtrema(evidence.masses, (mass) => mass.area, 'min')
  else if (policy.governor === 'deepest') candidates = tiedExtrema(evidence.masses, (mass) => mass.peakClear, 'max')
  else if (policy.governor === 'top') candidates = tiedExtrema(evidence.masses, (mass) => mass.centre.y, 'max')
  else {
    const upper = evidence.masses.filter((mass) => mass.upperHalf)
    candidates = upper.length
      ? tiedExtrema(upper, (mass) => mass.area, 'min')
      : tiedExtrema(evidence.masses, (mass) => mass.centre.y, 'max')
  }
  if (candidates === null) return { status: 'refused', decisions: [], code: 'CENTRE_EVIDENCE_UNRESOLVED' }
  if (!candidates.length) return { status: 'refused', decisions: [], code: 'CENTRE_EVIDENCE_MISSING' }
  const branch = policy.mode === 'deep' ? 'deep' : policy.mode === 'top' ? 'top' : 'mass'
  return {
    status: 'lawful',
    decisions: candidates.map((candidate) => exactDecision(policy, candidate.centre, branch, evidence.id, candidate.id)) as [ExactCentreDecision, ...ExactCentreDecision[]],
  }
}

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

const governorNumber = (policy: Extract<CentrePolicy, { mode: 'masses' }>): Governor =>
  policy.governor === 'smallest' ? 0
    : policy.governor === 'deepest' ? 1
      : policy.governor === 'top' ? 2 : 3

function decision(policy: CentrePolicy, target: [number, number], branch: CentreDecision['branch'], regionIndex: number | null, massIndex: number | null): CentreDecision {
  return { policy, target, branch, regionIndex, massIndex }
}

export function evaluateCentrePolicy(measured: CentreMeasurements, policy: CentrePolicy): CentreDecision {
  if (policy.mode === 'box') return decision(policy, measured.box, 'box', null, null)
  if (policy.mode === 'weight') return decision(policy, measured.weight, 'weight', null, null)
  if (policy.mode === 'core') return decision(policy, measured.core, 'core', null, null)
  const masses = measured.masses
  if (!masses.length) return decision(policy, measured.box, policy.mode === 'masses' ? 'mass' : policy.mode, null, null)
  if (policy.mode === 'deep') {
    let best = measured.regions[0]
    let regionIndex = 0
    for (let index = 1; index < measured.regions.length; index++) {
      if (measured.regions[index].peakClearMM > best.peakClearMM) { best = measured.regions[index]; regionIndex = index }
    }
    return decision(policy, best.centreMM, 'deep', regionIndex, null)
  }
  if (policy.mode === 'top') {
    let best = masses[0]
    for (const candidate of masses) if (candidate.region.centreMM[1] > best.region.centreMM[1]) best = candidate
    return decision(policy, best.region.centreMM, 'top', best.regionIndex, best.massIndex)
  }
  const governed = governMass(masses.map((item) => item.region), governorNumber(policy), measured.midY)
  const selected = masses.find((item) => item.region === governed) ?? masses[0]
  return decision(policy, selected.region.centreMM, 'mass', selected.regionIndex, selected.massIndex)
}

export function chooseCentreRulesCandidate(candidates: readonly ParityCandidateMeasurement[]): ParityCandidateMeasurement | null {
  let best: ParityCandidateMeasurement | null = null
  for (const candidate of candidates) {
    if (!candidate.seated.length) continue
    const wins = !best
      || candidate.seated.length > best.seated.length
      || (candidate.seated.length === best.seated.length && candidate.canonAxes > best.canonAxes)
      || (candidate.seated.length === best.seated.length && candidate.canonAxes === best.canonAxes && candidate.excessMM < best.excessMM)
    if (wins) best = candidate
  }
  return best
}
