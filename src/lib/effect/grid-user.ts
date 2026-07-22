import type { Contour } from './types'
import {
  resolveGridPlan,
  type Attachment,
  type ResolvedGridPlan,
} from './grid-core'

/** The complete user-facing input surface for magnetic-grid resolution. */
export interface UserGridPlanOptions {
  attachment: Attachment
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
  return resolveGridPlan(contourMM, { attachment })
}

export type { Attachment, ResolvedGridPlan }
