// Portable orchestration only: measurements in, Logic verdict out.

import { centreMeasurements, exactCentreEvidence, type ExactCentreEvidence, type ExactContour, type MeasuredRegion } from './compute'
import { chooseCentreRulesCandidate, evaluateCentrePolicy, evaluateExactCentre } from './logic'
import type {
  CentreBaselineInput, CentreBaselineResult, CentreBranchEvidence, CentrePolicy,
  ExactCentreInput, ExactCentreVerdict,
} from './spec'

export function evaluateCentreBaseline(input: CentreBaselineInput): CentreBaselineResult | null {
  const measured = centreMeasurements(input.contour, input.regions)
  const centre = evaluateCentrePolicy(measured, input.policy)
  const candidate = chooseCentreRulesCandidate(input.candidates)
  if (!candidate) return null
  return { centre, phaseMM: candidate.phaseMM, seated: candidate.seated, canonAxes: candidate.canonAxes }
}

/**
 * Project certified evidence onto the neutral record the centre law selects from, then apply the
 * ruled policy. Engine sequences and assembles; it takes no view on which branch should win — the
 * projection carries every island and every depth mass, and logic alone ranks them.
 */
function branchesOf(evidence: ExactCentreEvidence): { islands: CentreBranchEvidence[]; masses: CentreBranchEvidence[] } {
  const asBranch = (region: MeasuredRegion, islandIndex: number, massIndex: number | null): CentreBranchEvidence => ({
    islandIndex,
    massIndex,
    area: region.areaMM2,
    peakClear: region.peakClear,
    centre: region.centre,
    maximum: region.deepest.status,
    coEqual: region.coEqual,
  })
  const islands: CentreBranchEvidence[] = []
  const masses: CentreBranchEvidence[] = []
  evidence.islands.forEach((island, islandIndex) => {
    islands.push(asBranch(island, islandIndex, null))
    if (island.masses.length) {
      island.masses.forEach((mass, massIndex) => masses.push(asBranch(mass, islandIndex, massIndex)))
    } else {
      // an island with no surviving depth mass governs as itself — the donor's fallback, preserved
      masses.push(asBranch(island, islandIndex, null))
    }
  })
  return { islands, masses }
}

export function exactCentreInput(evidence: ExactCentreEvidence): ExactCentreInput {
  const { islands, masses } = branchesOf(evidence)
  const fixed = (p: { x: { n: bigint; d: bigint }; y: { n: bigint; d: bigint } }) => ({ x: { lo: p.x, hi: p.x }, y: { lo: p.y, hi: p.y } })
  return {
    evidenceId: evidence.id,
    unresolved: evidence.reasons,
    box: fixed(evidence.box),
    weight: fixed(evidence.weight),
    core: evidence.core,
    islands,
    masses,
    midY: evidence.midY,
  }
}

/** The governed centre of one supplied contour under one ruled policy, or a typed refusal. */
export function exactCentre(contour: ExactContour, policy: CentrePolicy): ExactCentreVerdict {
  // Engine sequences and assembles. It takes no view on whether unresolved evidence matters to this
  // policy — that is a law question, and the provenance travels into the input for logic to weigh.
  return evaluateExactCentre(exactCentreInput(exactCentreEvidence(contour)), policy)
}

export * from './spec'
