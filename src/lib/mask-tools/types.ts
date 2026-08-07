// mask-tools — the neutral mask/point types shared across the cutout lab. Moved out of the deleted
// cutout-ai (SAM) stack (Dan 2026-08-07: EdgeSAM removed; u2net is the only cut, GrabCut the brush).

/** Binary mask, row-major, length w*h. 1 = object, 0 = background. `soft` (optional) is the
 *  continuous alpha (0-255) — the engine-parity matte channel. */
export interface Mask {
  data: Uint8Array
  w: number
  h: number
  soft?: Uint8Array
}

/** A point in normalized image space (0..1). label 1 = include, 0 = exclude (legacy field kept
 *  for the paint/grabcut stroke callers). */
export interface Point {
  x: number
  y: number
  label?: 0 | 1
}
