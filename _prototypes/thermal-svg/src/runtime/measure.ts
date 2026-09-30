// Measures where the content's visible outline actually is. Text is laid out by its font box (not the
// letters) and dropped files can carry empty margins, so the engine alone can't know the true size or
// centre. Browser-only: rasterises the engine's 'mask' layer (no offset applied).

import { renderThermal, type ThermalConfig } from '../engine'
import { rasterize } from './raster'

export interface InkBounds {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Visible outline of the content, in output units. null when nothing is drawn. */
export async function inkBounds(config: ThermalConfig, fontCss = ''): Promise<InkBounds | null> {
  const { width, height } = config.output
  const scale = Math.min(1, 800 / Math.max(width, height)) * 2
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const { svg } = renderThermal(config, { id: 'measure', layer: 'mask', pixelWidth: w, pixelHeight: h, fontCss })
  const cv = await rasterize(svg, w, h)
  const px = cv.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 127) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  return { x0: x0 / scale, y0: y0 / scale, x1: (x1 + 1) / scale, y1: (y1 + 1) / scale }
}

/** Offset (output units) that puts the visible outline's centre on the output's centre. */
export function centreOffset(config: ThermalConfig, b: InkBounds): { x: number; y: number } {
  const r = (v: number) => Math.round(v * 100) / 100
  return { x: r(config.output.width / 2 - (b.x0 + b.x1) / 2), y: r(config.output.height / 2 - (b.y0 + b.y1) / 2) }
}
