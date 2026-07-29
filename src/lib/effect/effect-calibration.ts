/**
 * Admin-released starting values. Consumers receive these as inputs; engine recipes always carry
 * the value that affected their output so calibration changes remain explicit and cache-safe.
 */
export const DEFAULT_ROUNDED_SQUARE_CALIBRATION = {
  sideMM: 70,
  radiusMM: 10,
  minimumAnchors: 4,
} as const
