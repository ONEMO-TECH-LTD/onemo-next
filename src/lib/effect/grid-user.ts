import type { Contour } from './types'
import {
  nearestSemanticRung,
  resolveUserSemanticLadder,
  resolveUserGridPlan,
  stdShapeContour,
  type Attachment,
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

export type { Attachment, ResolvedGridPlan, SemanticRung }
