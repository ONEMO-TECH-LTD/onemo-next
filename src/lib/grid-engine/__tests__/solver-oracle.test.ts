// §11.1: the oracle and the engine must produce the same family set — nothing missed, nothing
// invented. The oracle walks even sizes with its own geometry; the engine solves exact intervals.
// Agreement between two implementations that share no geometry is the evidence.

import { describe, expect, it } from 'vitest'
import { solve } from '../solver/solve'
import { canonicaliseOutline } from '../solver/canonical-outline'
import { centreOf } from '../solver/centres'
import { oracleEnumerate } from '../oracle/oracle'
import type { PointMM, SolveRequest } from '../solver/contract'

const spec = {
  basePitchMM: 48,
  sparseFactor: 2,
  paddingMM: 12,
  positionsPerAxis: 9,
  bands: [2, 3] as const as Array<2 | 3>,
  centreMethods: ['box'] as const as Array<'box'>,
}

const keyOfFamily = (f: {
  band: number
  centreMethod: string
  publishedEvenMM: number
  populations: Record<'base' | 'sparse', { arrangement: { magnets: ReadonlyArray<{ coordinateMM: PointMM }> } }>
}, target: PointMM) =>
  `${f.band}|${f.centreMethod}|${f.publishedEvenMM}|` +
  // oracle keys are ENGINE-frame vertices; families carry shape-frame (q − a) — translate back
  f.populations.base.arrangement.magnets.map((m) => `${m.coordinateMM[0] + target[0]},${m.coordinateMM[1] + target[1]}`).join(';') +
  '|' +
  f.populations.sparse.arrangement.magnets.map((m) => `${m.coordinateMM[0] + target[0]},${m.coordinateMM[1] + target[1]}`).join(';')

const agree = (outline: PointMM[]) => {
  const request: SolveRequest = { outline, spec, flapLimitsMM: [12, 24] }
  const engine = solve(request)
  expect(engine.status).toBe('solved')
  if (engine.status !== 'solved') return
  const canon = canonicaliseOutline(outline)
  if (!canon.ok) throw new Error('fixture refused')
  const centres = spec.centreMethods.map((m) => ({ method: m, centreMM: centreOf(canon.outline, m) }))
  const oracle = oracleEnumerate(request, centres)

  const engineKeys = new Set(
    engine.families.map((f) => keyOfFamily(f as never, f.parityTargetMM)),
  )
  const oracleKeys = new Set(
    oracle.map((k) => `${k.band}|${k.centreMethod}|${k.publishedEvenMM}|${k.baseVertices}|${k.sparseVertices}`),
  )
  const missed = [...oracleKeys].filter((k) => !engineKeys.has(k))
  const invented = [...engineKeys].filter((k) => !oracleKeys.has(k))
  expect(missed.slice(0, 5), `engine MISSED ${missed.length} oracle families`).toEqual([])
  expect(invented.slice(0, 5), `engine INVENTED ${invented.length} families the oracle refutes`).toEqual([])
}

describe('§11.1 oracle agreement — no shared geometry, same answer set', () => {
  it('the canon square', () => {
    agree([
      [-50, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ])
  }, 120000)

  it('an L solid — material-derived partial populations', () => {
    agree([
      [-50, -50],
      [10, -50],
      [10, 10],
      [50, 10],
      [50, 50],
      [-50, 50],
    ])
  }, 120000)
})
