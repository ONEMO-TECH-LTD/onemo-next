/**
 * Admin-released starting values and named representation calibrations. Recipe inputs travel with
 * their jobs; engine-owned representation values enter the policy signature so both stay cache-safe.
 */
export const DEFAULT_ROUNDED_SQUARE_CALIBRATION = {
  sideMM: 70,
  radiusMM: 10,
  minimumAnchors: 4,
} as const

/** Retained curve-quality floor for product circles below the physical sagitta threshold. */
export const DEFAULT_CIRCLE_TESSELLATION_CALIBRATION = {
  minimumPoints: 96,
} as const
