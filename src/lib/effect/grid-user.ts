import type { Contour } from './types'
import {
  ladderShapeFromRecipe,
  nearestSemanticRung,
  planContourFromRecipe,
  resolveUserSemanticLadder,
  resolveUserGridPlan,
  stdShapeContour,
  userLadderCacheKey,
  userPlanCacheKey,
  type Attachment,
  type LadderRecipe,
  type PlanRecipe,
  type ResolvedGridPlan,
  type SemanticRung,
  type StdShape,
} from './grid-core'

/** The complete user-facing input surface for magnetic-grid resolution. */
export interface UserGridPlanOptions {
  attachment: Attachment
}

export type UserStandardShape = Exclude<StdShape, 'rect'>

/** Build a standard final contour without exposing admin grid controls to user code. */
export function standardShapeContour(shape: UserStandardShape, sizeMM: number): Contour {
  return stdShapeContour(shape, sizeMM)
}

/**
 * Resolve the production grid using only product-safe defaults.
 *
 * The user path supplies a final real-mm contour and attachment choice. Pattern,
 * pitch, density, centering, magnet plan, and growth policy remain engine-owned.
 */
export function resolveUserPlan(
  contourMM: Contour,
  { attachment }: UserGridPlanOptions,
): ResolvedGridPlan {
  return resolveUserGridPlan(contourMM, attachment)
}

/** Resolve the default magnetic product's distinct semantic sizes. */
export function semanticLadder(makeShape: (sizeMM: number) => Contour): SemanticRung[] {
  return resolveUserSemanticLadder(makeShape)
}

/** User-door rung selection preserves the current first-rung exact-tie behavior. */
export function nearestUserSemanticRung(
  rungs: ReadonlyArray<SemanticRung>,
  targetMM: number,
): SemanticRung {
  return nearestSemanticRung(rungs, targetMM, 'first')
}

/** Resolve a serializable ladder recipe through the constrained User door. */
export function resolveUserLadderRecipe(recipe: LadderRecipe): SemanticRung[] {
  return resolveUserSemanticLadder(ladderShapeFromRecipe(recipe))
}

/** Resolve one serializable contour recipe through the constrained User door. */
export function resolveUserPlanRecipe(
  recipe: PlanRecipe,
  attachment: Attachment,
): ResolvedGridPlan {
  return resolveUserGridPlan(planContourFromRecipe(recipe), attachment)
}

export type UserGridJob =
  | { operation: 'ladder'; recipe: LadderRecipe }
  | { operation: 'plan'; recipe: PlanRecipe; attachment: Attachment }

export type UserGridJobResult =
  | { operation: 'ladder'; key: string; value: SemanticRung[] }
  | { operation: 'plan'; key: string; value: ResolvedGridPlan }

/** Pure worker handler. The future User worker imports this module and therefore cannot forge Admin inputs. */
export function handleUserGridJob(job: UserGridJob): UserGridJobResult {
  if (job.operation === 'ladder') {
    return {
      operation: 'ladder',
      key: userLadderCacheKey(job.recipe),
      value: resolveUserLadderRecipe(job.recipe),
    }
  }
  return {
    operation: 'plan',
    key: userPlanCacheKey(job.recipe, job.attachment),
    value: resolveUserPlanRecipe(job.recipe, job.attachment),
  }
}

export {
  userLadderCacheKey,
  userPlanCacheKey,
  type LadderRecipe,
  type PlanRecipe,
}
export type { Attachment, ResolvedGridPlan, SemanticRung }
