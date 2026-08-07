// mask-tools — the PAINT tool's math (I2e pure move out of cutout-lab/finish.ts): shape→mask
// rasterization, mask booleans, engine-owned polish, painted-swath rasterization. Pure,
// engine-calling via smoothMask only — framework-free, liftable.

import { smoothMask } from '@/lib/effect/mask'
import { flattenShape, type VShape } from '@/lib/vector-core'
import type { Mask } from '@/lib/mask-tools/types'

/** PAINT-SHAPER config (Dan 2026-08-07: admin-changeable). The paint tool's internal factors,
 *  formerly hardcoded — surfaced so an admin can calibrate the tool without a code change. */
export interface PaintConfig {
  swathMult: number  // stroke swath width = brush × swathMult
  polishDiv: number  // outline smoothing radius = brush ÷ polishDiv (bigger = softer)
  closeFrac: number  // a gesture closes into a filled loop when its endpoints are < perimeter × closeFrac apart
}
export const PAINT_DEFAULTS: PaintConfig = { swathMult: 2, polishDiv: 3, closeFrac: 0.2 }

/** Rasterize a drawn shape to a BINARY Mask (subject matte for the blend layer — inside = subject).
 *  Shares solidShapeMask's rasterizer; drops the soft channel (the paint-edit mask is binary). */
export function maskFromShape(shape: VShape, w: number, h: number): Mask {
  return { data: solidShapeMask(shape, w, h).data, w, h }
}

/** Mask booleans for the DRAW add/erase combination (Dan's two examples: a drawn loop unions into
 *  or subtracts from the current selection GEOMETRICALLY — no AI). The result re-enters
 *  finishOutline, so padding + smoothing give the elegant joins. */
export function unionMasks(base: Mask, add: Mask): Mask {
  const data = new Uint8Array(base.data)
  for (let i = 0; i < data.length; i++) if (add.data[i]) data[i] = 1
  return { data, w: base.w, h: base.h }
}
/** Normalize a painted combination with the ENGINE'S own mask smoothing (box-blur + re-threshold):
 *  fills concave bites and shaves nubs smaller than the radius — the 'insect bites' where strokes
 *  meet the mask (Dan 2026-08-06). Radius rides the brush size (bold brush = bolder polish). */
export function polishMask(mask: Mask, brushPx: number, polishDiv = PAINT_DEFAULTS.polishDiv): Mask {
  const r = Math.max(2, Math.round(brushPx / polishDiv))
  return { data: smoothMask(mask.data, mask.w, mask.h, r), w: mask.w, h: mask.h }
}

export function subtractMasks(base: Mask, sub: Mask): Mask {
  const data = new Uint8Array(base.data)
  for (let i = 0; i < data.length; i++) if (sub.data[i]) data[i] = 0
  return { data, w: base.w, h: base.h }
}

/** SHAPE-IS-TRUTH normalization (E6/E7, Dan's ruling: "outlined shape is solid fill"): rasterize
 *  the RESOLVED outline as the one truth — inside solid (data 1, soft 255), the outer edge band
 *  soft from the rasterizer's own anti-aliasing, outside dropped for real. After this, tint ≡
 *  outline ≡ matte ≡ Save by construction: no orphan islands (the trace keeps the largest loop
 *  only), no unpainted slivers (inside is solid). */
export function solidShapeMask(shape: VShape, w: number, h: number): Mask {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const ring = flattenShape(shape, 0.5)[0] ?? []
  ctx.beginPath()
  ring.forEach((p: { x: number; y: number }, i: number) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill()
  const px = ctx.getImageData(0, 0, w, h).data
  const data = new Uint8Array(w * h)
  const soft = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) { const a = px[i * 4 + 3]; soft[i] = a; data[i] = a > 128 ? 1 : 0 }
  return { data, w, h, soft }
}

/** Foreground pixel count — the never-empty erase guard uses it. */
export function maskArea(mask: Mask): number {
  let a = 0
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i]) a++
  return a
}

/** Rasterize a painted brush gesture to a Mask: the thick swath along the stroke (round caps —
 *  WYSIWYG with the brush cursor), plus the enclosed interior when the gesture closes a loop
 *  (Dan's green-blob semantics: a loop means the whole region). */
export function swathMask(
  stroke: { x: number; y: number }[], brushPx: number, w: number, h: number,
  cfg: Pick<PaintConfig, 'swathMult' | 'closeFrac'> = PAINT_DEFAULTS,
): Mask {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'
  ctx.lineWidth = Math.max(1, brushPx * cfg.swathMult) // 1px floor (Dan: brush down to 1)
  ctx.beginPath()
  stroke.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.stroke()
  // closed gesture → fill the interior too
  const first = stroke[0], last = stroke[stroke.length - 1]
  let perim = 0
  for (let i = 1; i < stroke.length; i++) perim += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y)
  if (perim > 0 && Math.hypot(first.x - last.x, first.y - last.y) < perim * cfg.closeFrac) {
    ctx.closePath(); ctx.fill()
  }
  const px = ctx.getImageData(0, 0, w, h).data
  const data = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) data[i] = px[i * 4 + 3] > 128 ? 1 : 0
  return { data, w, h }
}
