/**
 * Admin-only magnetic-grid entry point.
 *
 * Experimental controls and low-level engine operations remain available to the
 * grid bench through this module. Creator user code is forbidden from importing it.
 */
import {
  adminLadderCacheKey,
  adminPlanCacheKey,
  ladderShapeFromRecipe,
  planContourFromRecipe,
  resolveAdminGridPlan,
  semanticLadder,
  type GridMode,
  type GridPlanOptions,
  type LadderRecipe,
  type PlanRecipe,
  type ResolvedGridPlan,
  type SemanticRung,
  type SizeLaw,
} from './grid-core'

export * from './grid-core'

export type AdminGridJob =
  | { operation: 'ladder'; recipe: LadderRecipe; law?: SizeLaw; mode?: GridMode }
  | { operation: 'plan'; recipe: PlanRecipe; options?: GridPlanOptions }

export type AdminGridJobResult =
  | { operation: 'ladder'; key: string; value: SemanticRung[] }
  | { operation: 'plan'; key: string; value: ResolvedGridPlan }

/** Pure worker handler. The future Admin worker imports this module as its only semantic door. */
export function handleAdminGridJob(job: AdminGridJob): AdminGridJobResult {
  if (job.operation === 'ladder') {
    return {
      operation: 'ladder',
      key: adminLadderCacheKey(job.recipe, job.law, job.mode),
      value: semanticLadder(ladderShapeFromRecipe(job.recipe), job.law, job.mode),
    }
  }
  return {
    operation: 'plan',
    key: adminPlanCacheKey(job.recipe, job.options),
    value: resolveAdminGridPlan(planContourFromRecipe(job.recipe), job.options),
  }
}
