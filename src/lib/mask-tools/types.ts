// mask-tools — neutral mask/point types shared across Cutout Lab.

/** Binary mask, row-major, length w*h. 1 = object, 0 = background. `soft` (optional) is the
 *  continuous alpha (0-255) — the engine-parity matte channel. */
export interface Mask {
  data: Uint8Array
  w: number
  h: number
  soft?: Uint8Array
}

/** A point in normalized image space (0..1). */
export interface Point {
  x: number
  y: number
}
