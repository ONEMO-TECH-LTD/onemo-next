import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  handleGridJob,
  gridLadderCacheKey,
  gridPlanCacheKey,
  ladderShapeFromRecipe,
  planContourFromRecipe,
  resolveGridPlan,
  semanticLadder,
  type GridJob,
} from '../grid'
import { assertGridJsonByteEqual, gridJsonBytes } from '../grid-byte-oracle'
import {
  DENSE_REAL_AI_GRID_CONTOUR,
  GRID_S0_ORACLE_CORPUS,
  REAL_AI_GRID_CORPUS,
} from '../grid-s0-corpus'

function directGridJob(job: GridJob) {
  return job.operation === 'ladder'
    ? {
        operation: 'ladder' as const,
        key: gridLadderCacheKey(job.recipe, job.law, job.mode, job.options),
        value: semanticLadder(ladderShapeFromRecipe(job.recipe), job.law, job.mode, job.options),
      }
    : {
        operation: 'plan' as const,
        key: gridPlanCacheKey(job.recipe, job.options),
        value: resolveGridPlan(planContourFromRecipe(job.recipe), job.options),
      }
}

describe('S0 full-JSON byte oracle and corpus', () => {
  it('fails loudly when any serialized output byte changes', () => {
    expect(() => assertGridJsonByteEqual(
      { operation: 'plan', value: { ok: false } },
      { operation: 'plan', value: { ok: true } },
      'intentional drift probe',
    )).toThrow('full JSON differs')
  })

  it.each(GRID_S0_ORACLE_CORPUS)('$name is full-JSON byte-identical direct, handled, and cloned', ({ name, job }) => {
    const direct = directGridJob(job)
    const handled = handleGridJob(job)
    const cloned = structuredClone(handled)

    expect(() => assertGridJsonByteEqual(handled, direct, `${name} handled`)).not.toThrow()
    expect(() => assertGridJsonByteEqual(cloned, direct, `${name} cloned`)).not.toThrow()
    expect(gridJsonBytes(handled)).toBe(gridJsonBytes(direct))
  })

  it('records a genuine Magic-derived final contour and its simplification diagnostics', () => {
    const { spec } = REAL_AI_GRID_CORPUS
    const sourceBytes = readFileSync(resolve(process.cwd(), REAL_AI_GRID_CORPUS.sourceAsset))
    expect(REAL_AI_GRID_CORPUS.sourceKind).toBe('real-ai-magic')
    expect(createHash('sha256').update(sourceBytes).digest('hex')).toBe(REAL_AI_GRID_CORPUS.sourceAssetSha256)
    expect(spec.generator.adapter).toBe('u2netp')
    expect(spec.diagnostics.rawContourNodes).toBeGreaterThan(spec.diagnostics.simplifiedNodes)
    expect(spec.diagnostics.simplifiedNodes).toBe(spec.geometryMM.outer.pts.length)
    expect(spec.diagnostics.holes).toBe(spec.geometryMM.holes.length)
    expect(DENSE_REAL_AI_GRID_CONTOUR.outer.pts).toHaveLength(spec.diagnostics.simplifiedNodes * 8)
  })
})
