// The centre law, cloned from the accepted centring tab and preserved verbatim. `governMass`, the
// nine branch meanings and the winning-candidate rule are the bodies the bench's behaviour was
// proved on, so they are not rewritten here — only the EVIDENCE they read changes, from a 2mm mesh
// to the exact construction. Decisions stay the donor's; the ruler beneath them is what improves.

import type {
  ClonedCentreDecision,
  CentreMeasurements,
  CentrePolicy,
  Governor,
  ParityCandidateMeasurement,
  Pt,
} from './spec'

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

function decision(policy: CentrePolicy, target: [number, number], branch: ClonedCentreDecision['branch'], regionIndex: number | null, massIndex: number | null): ClonedCentreDecision {
  return { policy, target, branch, regionIndex, massIndex }
}

export function evaluateCentrePolicy(measured: CentreMeasurements, policy: CentrePolicy): ClonedCentreDecision {
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
