// Portable orchestration only: measurements in, Logic verdict out.

import { centreMeasurements } from './compute'
import { chooseCentreRulesCandidate, evaluateCentrePolicy } from './logic'
import type { CentreBaselineInput, CentreBaselineResult } from './spec'

export function evaluateCentreBaseline(input: CentreBaselineInput): CentreBaselineResult | null {
  const measured = centreMeasurements(input.contour, input.regions)
  const centre = evaluateCentrePolicy(measured, input.policy)
  const candidate = chooseCentreRulesCandidate(input.candidates)
  if (!candidate) return null
  return { centre, phaseMM: candidate.phaseMM, seated: candidate.seated, canonAxes: candidate.canonAxes }
}

export * from './spec'
