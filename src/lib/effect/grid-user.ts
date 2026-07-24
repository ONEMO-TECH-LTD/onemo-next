import type { Contour } from './types'
import { jsonByteLength } from './grid-cache'
import {
  ladderShapeFromRecipe,
  nearestSemanticRung,
  planContourFromRecipe,
  resolveUserSemanticLadder,
  resolveUserSemanticLadderWithPlans,
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

export type UserPlanGridJob = Extract<UserGridJob, { operation: 'plan' }>
export type UserPlanGridJobResult = Extract<UserGridJobResult, { operation: 'plan' }>

export interface UserGridCacheSeed {
  job: UserPlanGridJob
  result: UserPlanGridJobResult
}

export interface UserGridWorkerEnvelope {
  result: UserGridJobResult
  cacheSeeds: UserGridCacheSeed[]
}

export const USER_GRID_CACHE_SEED_MAX_BYTES = 1024 * 1024
export const USER_GRID_CACHE_SEED_ENVELOPE_MAX_BYTES = 4 * 1024 * 1024

/** Pure direct/public handler; its outward result remains the worker scheduler's public contract. */
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

function rungPlanRecipe(recipe: LadderRecipe, sizeMM: number): PlanRecipe {
  return recipe.kind === 'standard'
    ? { kind: 'standard', shape: recipe.shape, widthMM: sizeMM, heightMM: sizeMM }
    : { kind: 'uniform-contour', unitContour: recipe.unitContour, longestMM: sizeMM }
}

/** Worker transport adds exact retained-rung plans without changing the public User result. */
export function handleUserGridWorkerJob(job: UserGridJob): UserGridWorkerEnvelope {
  if (job.operation === 'plan') {
    return { result: handleUserGridJob(job), cacheSeeds: [] }
  }

  const { rungs, plans } = resolveUserSemanticLadderWithPlans(ladderShapeFromRecipe(job.recipe))
  const result: UserGridJobResult = {
    operation: 'ladder',
    key: userLadderCacheKey(job.recipe),
    value: rungs,
  }
  const cacheSeeds: UserGridCacheSeed[] = []
  let envelopeBytes = 0
  for (let index = 0; index < rungs.length; index++) {
    const seedJob: UserPlanGridJob = {
      operation: 'plan',
      recipe: rungPlanRecipe(job.recipe, rungs[index].sizeMM),
      attachment: 'magnetic',
    }
    const seed: UserGridCacheSeed = {
      job: seedJob,
      result: {
        operation: 'plan',
        key: userPlanCacheKey(seedJob.recipe, seedJob.attachment),
        value: plans[index],
      },
    }
    const seedBytes = jsonByteLength(seed)
    if (seedBytes > USER_GRID_CACHE_SEED_MAX_BYTES) continue
    if (envelopeBytes + seedBytes > USER_GRID_CACHE_SEED_ENVELOPE_MAX_BYTES) break
    cacheSeeds.push(seed)
    envelopeBytes += seedBytes
  }
  return { result, cacheSeeds }
}

export {
  userLadderCacheKey,
  userPlanCacheKey,
  type LadderRecipe,
  type PlanRecipe,
}
export type { Attachment, ResolvedGridPlan, SemanticRung }
