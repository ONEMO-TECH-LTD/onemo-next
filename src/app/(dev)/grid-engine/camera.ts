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

/** 1 is fit: the whole padded field. There is nothing wider, so the view can never leave the field. */
export const ZOOM_FIT = 1
export const ZOOM_MAX = 12

/**
 * WHERE THE CAMERA STARTS. Dan, 2026-08-10: "make grid to zoom 5 points on the launch we dont need
 * 9x9 default with the bands 2/3/4".
 *
 * The FIELD is unchanged — nine positions, as released. This is the view only, so zooming out still
 * reaches the whole field.
 *
 * Fit frames the padded field: eight steps of lattice plus a step of margin each side = 480mm.
 * Five positions is four steps = 192mm, plus half a step of air each side so the outer magnets are
 * not cut by the frame = 216mm. The camera is the ratio between them.
 *
 * (5/3 was the first attempt and it framed 288mm, which still holds SEVEN positions — the readout
 * said so. The number below is measured against that readout, not reasoned about.)
 */
export const ZOOM_DEFAULT = 480 / 216
/** One press. A plain factor — the ladder that used to live here was grid logic wearing a UI hat. */
export const ZOOM_STEP = 1.5

export function zoomIn(zoom: number): number {
  return Math.min(ZOOM_MAX, zoom * ZOOM_STEP)
}

export function zoomOut(zoom: number): number {
  return Math.max(ZOOM_FIT, zoom / ZOOM_STEP)
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
