// cutout-wand — the contrast bucket (Photoshop magic-wand class), an add-on microservice.
// REAL open-source algorithm (magic-wand-tool, MIT: scanline flood-fill by color tolerance +
// contour tracing) — NOT an approximation (Dan 2026-08-06: "take existing lib, use it as bucket
// fill"). Pure: pixels + a tap point in → a region Mask out. ONE-LAW compliant: the region only
// ever shapes the OUTLINE (union/subtract in the shell); no blend semantics, no AI, no downloads.
import MagicWand from 'magic-wand-tool'
import type { Mask } from '@/lib/cutout-ai/types'

/** The module's own calibration default (Photoshop's classic wand default). The SHELL never
 *  passes a tolerance — replace/tune it HERE. */
export const WAND_TOLERANCE = 32

/** Contrast-grown region under a tap on a canvas: classic fuzzy-select (pixel I/O lives in the
 *  module — the shell hands a canvas + a point, nothing else). */
export function wandRegion(canvas: HTMLCanvasElement, x: number, y: number, tolerance = WAND_TOLERANCE): Mask {
  const image = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height)
  return wandMask(image, x, y, tolerance)
}

/** Contrast-grown region under a tap: classic fuzzy-select. tolerance = color distance (0-255). */
export function wandMask(image: ImageData, x: number, y: number, tolerance = WAND_TOLERANCE): Mask {
  const res = MagicWand.floodFill(
    { data: image.data, width: image.width, height: image.height, bytes: 4 },
    Math.max(0, Math.min(image.width - 1, Math.round(x))),
    Math.max(0, Math.min(image.height - 1, Math.round(y))),
    tolerance, null, true,
  )
  const data = new Uint8Array(image.width * image.height)
  if (res?.data) {
    // the library's OWN border smoothing (gaussBlurOnlyBorder) — coarse flood edges → smooth
    const sm = MagicWand.gaussBlurOnlyBorder({ data: res.data, width: image.width, height: image.height, bounds: res.bounds }, 5)
    const src = sm?.data ?? res.data
    for (let i = 0; i < data.length; i++) data[i] = src[i] ? 1 : 0
    fillHoles(data, image.width, image.height)
  }
  return { data, w: image.width, h: image.height }
}

/** Fill enclosed holes: background is only what connects to the image border — everything else
 *  inside the region becomes region (the 'gaps' a tolerance flood leaves on textured content). */
function fillHoles(mask: Uint8Array, w: number, h: number): void {
  const outside = new Uint8Array(w * h)
  const stack: number[] = []
  const push = (p: number) => { if (!mask[p] && !outside[p]) { outside[p] = 1; stack.push(p) } }
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }
  while (stack.length) {
    const p = stack.pop()!
    const x = p % w, y = (p - x) / w
    if (x > 0) push(p - 1)
    if (x < w - 1) push(p + 1)
    if (y > 0) push(p - w)
    if (y < h - 1) push(p + w)
  }
  for (let i = 0; i < mask.length; i++) if (!mask[i] && !outside[i]) mask[i] = 1
}
