import { describe, expect, it } from 'vitest'
import { exactPoint, rational } from '../compute'
import { solveCentre } from '../engine'
import { evaluateExactCentrePolicy } from '../logic'
import type { CentrePolicy, ExactCentreEvidence, ExactCentreRegion } from '../spec'

const region = (id: string, x: number, y: number, area: number, peak: number, upperHalf: boolean): ExactCentreRegion => ({
  id,
  centre: exactPoint([x, y]),
  area: rational(BigInt(area)),
  peakClear: rational(BigInt(peak)),
  upperHalf,
})
const low = region('low', 2, 2, 10, 5, false)
const highSmall = region('high-small', 7, 8, 4, 6, true)
const highDeep = region('high-deep', 8, 7, 8, 9, true)
const evidence: ExactCentreEvidence = {
  id: 'evidence',
  box: exactPoint([5, 5]),
  core: exactPoint([5, 4]),
  weight: exactPoint([4, 5]),
  regions: [low, highDeep],
  masses: [low, highSmall, highDeep],
}
const policies: readonly CentrePolicy[] = [
  { mode: 'box' }, { mode: 'core' }, { mode: 'weight' }, { mode: 'deep' }, { mode: 'top' },
  { mode: 'masses', governor: 'smallest' }, { mode: 'masses', governor: 'deepest' },
  { mode: 'masses', governor: 'top' }, { mode: 'masses', governor: 'top-small' },
]

describe('exact Centre policy', () => {
  it('represents and evaluates all nine accepted Centre policies', () => {
    expect(policies.map((policy) => evaluateExactCentrePolicy(evidence, policy).status)).toEqual(Array(9).fill('lawful'))
  })

  it('builds the policy evidence through Compute without accepting numeric mesh regions', () => {
    const contour = { outer: { pts: [[0, 0], [48, 0], [48, 48], [0, 48]] as [number, number][] }, holes: [] }
    const result = solveCentre({
      contour,
      policy: { mode: 'masses', governor: 'deepest' },
    })
    expect(result.status === 'lawful' && result.decisions[0].target.approximateMM).toEqual([24, 24])
  })

  it('preserves each governor meaning without an iteration-order winner', () => {
    const selected = policies.map((policy) => {
      const result = evaluateExactCentrePolicy(evidence, policy)
      return result.status === 'lawful' ? result.decisions.map((decision) => decision.regionId) : []
    })
    expect(selected).toEqual([
      [null], [null], [null], ['high-deep'], ['high-small'],
      ['high-small'], ['high-deep'], ['high-small'], ['high-small'],
    ])
  })

  it('returns exact ties and unresolved evidence instead of silently choosing', () => {
    const tied = { ...evidence, masses: [highSmall, { ...highSmall, id: 'peer', centre: exactPoint([9, 8]) }] }
    const result = evaluateExactCentrePolicy(tied, { mode: 'top' })
    expect(result.status === 'lawful' && result.decisions.map((decision) => decision.regionId)).toEqual(['high-small', 'peer'])
    const unresolved: ExactCentreEvidence = {
      ...evidence,
      masses: [highSmall, { ...highSmall, id: 'unknown', area: { polynomial: ['-4', '1'], isolating: [rational(BigInt(3)), rational(BigInt(5))] as const, rootIndex: 0 } }],
    }
    expect(evaluateExactCentrePolicy(unresolved, { mode: 'masses', governor: 'smallest' })).toMatchObject({ status: 'refused', code: 'CENTRE_EVIDENCE_UNRESOLVED' })
  })
})
