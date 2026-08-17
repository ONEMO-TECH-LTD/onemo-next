// camera.ts — the shell's OWN logic file, by necessity only.
//
// Dan, 2026-08-10: the shell "may have its own logic file by necessity only — and only for things
// that genuinely don't belong to engine+logic."
//
// Zoom is exactly that. It is a plain view scale: it changes how much of the world you are looking
// at and nothing else. It moves no magnet, shifts no lattice, and decides no layout — the moment it
// did any of those, the picture changed as you zoomed, which is the bug this file exists to prevent.
//
// SCREEN MATHS ONLY. Pixels, aspect, the camera. No pitch, no padding, no lattice.

/** A rectangle in millimetres — the vocabulary the bridge speaks. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 1 is fit: the whole padded field, unscaled. It survives the zoom controls as the canvas's own
 * default — a surface that passes no scale gets the whole field rather than nothing.
 *
 * The stepping API that used to sit here — zoomIn, zoomOut, a maximum and a step — died the moment
 * Dan removed the zoom controls ("Zoom becomes obsolete cause image stays the same full canvas size
 * and grid underneath moves and changes"). It was left behind by a restore and had no caller.
 */
export const ZOOM_FIT = 1

/**
 * How much pinch it takes to change the size by a factor of e. Screen feel, not law: it turns a
 * gesture into a plain factor and knows nothing about millimetres, pitch or padding.
 */
const PINCH_RESPONSE = 100

/**
 * One wheel packet's scale factor.
 *
 * MULTIPLICATIVE ON PURPOSE, so packets COMPOSE — exp(a/k)·exp(b/k) = exp((a+b)/k) — and the same
 * physical gesture lands on the same factor however the browser chops it up. Rounding per packet
 * cannot do that: it is what made a hundred 0.1s move nothing at all while a single 10 moved 13mm.
 *
 * The caller must accumulate this against an UNROUNDED size. Rounding is for what is shown.
 */
export function pinchFactor(deltaY: number): number {
  return Math.exp(deltaY / PINCH_RESPONSE)
}

/**
 * The view box: the framed region, scaled about ITS OWN CENTRE, then widened — never cropped — to
 * the window's aspect so a millimetre is square on both axes.
 *
 * Centre-preserving is the whole contract. Scale about a corner and the drawing crawls across the
 * screen as you zoom, which is what "it zooms to the top left" looks like.
 */
export function viewBox(framed: Box, zoom: number, boxAspect: number): Box {
  const cx = framed.x + framed.w / 2
  const cy = framed.y + framed.h / 2
  const w = framed.w / zoom
  const h = framed.h / zoom

  const view: Box = { x: cx - w / 2, y: cy - h / 2, w, h }
  if (w / h < boxAspect) {
    const widened = h * boxAspect
    view.x = cx - widened / 2
    view.w = widened
  } else {
    const taller = w / boxAspect
    view.y = cy - taller / 2
    view.h = taller
  }
  return view
}
