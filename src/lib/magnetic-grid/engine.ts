// Portable orchestration only: measurements in, Logic verdict out.

import { centreMeasurements, measureExactCentreEvidence } from './compute'
import { chooseCentreRulesCandidate, evaluateCentrePolicy, evaluateExactCentrePolicy } from './logic'
import type { CentreBaselineInput, CentreBaselineResult, ExactCentreEvaluation, ExactCentreInput } from './spec'

export function solveCentre(input: ExactCentreInput): ExactCentreEvaluation {
  const measured = measureExactCentreEvidence(input.contour)
  if (measured.status === 'refused') return { status: 'refused', decisions: [], code: measured.code }
  return evaluateExactCentrePolicy(measured.evidence, input.policy)
}

export function evaluateCentreBaseline(input: CentreBaselineInput): CentreBaselineResult | null {
  const measured = centreMeasurements(input.contour, input.regions)
  const centre = evaluateCentrePolicy(measured, input.policy)
  const candidate = chooseCentreRulesCandidate(input.candidates)
  if (!candidate) return null
  return { centre, phaseMM: candidate.phaseMM, seated: candidate.seated, canonAxes: candidate.canonAxes }
}

export * from './spec'
