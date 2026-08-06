// cutout-wand — the contrast bucket (Photoshop magic-wand class), an add-on microservice.
// REAL open-source algorithm (magic-wand-tool, MIT: scanline flood-fill by color tolerance +
// contour tracing) — NOT an approximation (Dan 2026-08-06: "take existing lib, use it as bucket
// fill"). Pure: pixels + a tap point in → a region Mask out. ONE-LAW compliant: the region only
// ever shapes the OUTLINE (union/subtract in the shell); no blend semantics, no AI, no downloads.
import MagicWand from 'magic-wand-tool'
import type { Mask } from '@/lib/cutout-ai/types'

/** The module's own calibration default (Photoshop's classic wand default is ~32; 26 held best on
 *  the s62 probes). The SHELL never passes a tolerance — replace/tune it HERE. */
export const WAND_TOLERANCE = 26

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
  if (res?.data) for (let i = 0; i < data.length; i++) data[i] = res.data[i] ? 1 : 0
  return { data, w: image.width, h: image.height }
}
