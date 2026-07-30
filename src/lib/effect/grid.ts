/** UI-independent magnetic-grid entry point. */
import { jsonByteLength } from './grid-cache'
import {
  gridLadderCacheKey,
  gridPlanCacheKey,
  planContourFromRecipe,
  resolveGridPlan,
  semanticLadderFromRecipe,
  type GridMode,
  type GridPlanOptions,
  type LadderRecipe,
  type PlanRecipe,
  type ResolvedGridPlan,
  type SemanticRung,
  type SizeLaw,
} from './grid-core'

export * from './grid-core'

export type GridJob =
  | { operation: 'ladder'; recipe: LadderRecipe; law?: SizeLaw; mode?: GridMode; options?: GridPlanOptions }
  | { operation: 'plan'; recipe: PlanRecipe; options?: GridPlanOptions }

export type GridJobResult =
  | { operation: 'ladder'; key: string; value: SemanticRung[] }
  | { operation: 'plan'; key: string; value: ResolvedGridPlan }

export type GridPlanJob = Extract<GridJob, { operation: 'plan' }>
export type GridPlanJobResult = Extract<GridJobResult, { operation: 'plan' }>

export interface GridCacheSeed {
  job: GridPlanJob
  result: GridPlanJobResult
}

export interface GridWorkerEnvelope {
  result: GridJobResult
  cacheSeeds: GridCacheSeed[]
}

export const GRID_CACHE_SEED_MAX_BYTES = 1024 * 1024
export const GRID_CACHE_SEED_ENVELOPE_MAX_BYTES = 4 * 1024 * 1024

/** Pure direct/public handler. */
export function handleGridJob(job: GridJob): GridJobResult {
  if (job.operation === 'ladder') {
    return {
      operation: 'ladder',
      key: gridLadderCacheKey(job.recipe, job.law, job.mode, job.options),
      value: semanticLadderFromRecipe(job.recipe, job.law, job.mode, job.options),
    }
  }
  return {
    operation: 'plan',
    key: gridPlanCacheKey(job.recipe, job.options),
    value: resolveGridPlan(planContourFromRecipe(job.recipe), job.options),
  }
}

function rungPlanRecipe(recipe: LadderRecipe, rung: SemanticRung): PlanRecipe {
  if (recipe.kind === 'standard') {
    return {
      kind: 'standard',
      shape: recipe.shape,
      widthMM: rung.designSizeMM,
      heightMM: rung.designSizeMM,
    }
  }
  if (recipe.kind === 'rounded-square') {
    return { kind: 'rounded-square', sizeMM: rung.designSizeMM, radiusMM: recipe.radiusMM }
  }
  return {
    kind: 'uniform-contour',
    unitContour: recipe.unitContour,
    longestMM: rung.designSizeMM,
  }
}

/** Worker transport adds exact retained-rung plans without changing the public result. */
export function handleGridWorkerJob(job: GridJob): GridWorkerEnvelope {
  if (job.operation === 'plan') {
    return { result: handleGridJob(job), cacheSeeds: [] }
  }

  const result = handleGridJob(job)
  if (result.operation !== 'ladder') return { result, cacheSeeds: [] }
  const cacheSeeds: GridCacheSeed[] = []
  let envelopeBytes = 0
  for (const rung of result.value) {
    const options = job.recipe.kind === 'uniform-contour' && job.recipe.maxMarginMM != null
      ? { ...job.options, baseMarginMM: rung.marginMM }
      : job.options
    const seedJob: GridPlanJob = {
      operation: 'plan',
      recipe: rungPlanRecipe(job.recipe, rung),
      options: { ...options, construction: rung.construction },
    }
    const seed: GridCacheSeed = {
      job: seedJob,
      result: {
        operation: 'plan',
        key: gridPlanCacheKey(seedJob.recipe, seedJob.options),
        value: resolveGridPlan(planContourFromRecipe(seedJob.recipe), seedJob.options),
      },
    }
    const seedBytes = jsonByteLength(seed)
    if (seedBytes > GRID_CACHE_SEED_MAX_BYTES) continue
    if (envelopeBytes + seedBytes > GRID_CACHE_SEED_ENVELOPE_MAX_BYTES) break
    cacheSeeds.push(seed)
    envelopeBytes += seedBytes
  }
  return { result, cacheSeeds }
}
