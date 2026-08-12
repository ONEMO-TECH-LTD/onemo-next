// mask-tools — the PAINT tool's math (I2e pure move out of cutout-lab/finish.ts): shape→mask
// rasterization, mask booleans, engine-owned polish, painted-swath rasterization. Pure,
// engine-calling via smoothMask only — framework-free, liftable.

import { smoothMask } from '@/lib/effect/mask'
import { flattenShape, type VShape } from '@/lib/vector-core'
import type { Mask } from '@/lib/mask-tools/types'

/** PAINT-SHAPER config (Dan 2026-08-07: admin-changeable). The paint tool's internal factors,
 *  formerly hardcoded — surfaced so an admin can calibrate the tool without a code change. */
export interface PaintConfig {
  autoTuneStrength: number  // 0..3; gesture wobble correction before the stroke becomes a shape
  polishStrength: number  // 0..1; outline smoothing radius = completed-shape scale × strength
  closeFrac: number  // a gesture closes into a filled loop when its endpoints are < perimeter × closeFrac apart
}
export const PAINT_DEFAULTS: PaintConfig = { autoTuneStrength: 0.5, polishStrength: 0.2, closeFrac: 0.5 }

type StrokePoint = { x: number; y: number }

const pointLineDistance = (p: StrokePoint, a: StrokePoint, b: StrokePoint): number => {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  if (!l2) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function rdpOpen(points: StrokePoint[], epsilon: number): StrokePoint[] {
  if (points.length <= 2 || epsilon <= 0) return points.slice()
  let farthest = 0, index = -1
  const first = points[0], last = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const distance = pointLineDistance(points[i], first, last)
    if (distance > farthest) { farthest = distance; index = i }
  }
  if (farthest <= epsilon || index < 0) return [first, last]
  const left = rdpOpen(points.slice(0, index + 1), epsilon)
  const right = rdpOpen(points.slice(index), epsilon)
  return left.slice(0, -1).concat(right)
}

/** Paint-only gesture Autotune. It removes sampling jitter before rasterization; brush diameter is
 * deliberately absent. The tolerance scales with the gesture extent, so the same intended line or
 * curve receives the same correction at different drawing sizes. Endpoints remain exact. */
export function autoTunePaintStroke(stroke: StrokePoint[], strength = PAINT_DEFAULTS.autoTuneStrength): StrokePoint[] {
  const intensity = Math.max(0, Math.min(3, strength))
  const amount = Math.min(1, intensity)
  const points = stroke.filter((point, index) => !index || point.x !== stroke[index - 1].x || point.y !== stroke[index - 1].y)
  if (intensity <= 0 || points.length <= 2) return points.map((point) => ({ ...point }))

  let filtered = points.map((point) => ({ ...point }))
  const passes = Math.ceil(intensity * 3)
  for (let pass = 0; pass < passes; pass++) {
    const prior = filtered
    filtered = prior.map((point, index) => {
      if (!index || index === prior.length - 1) return point
      const average = {
        x: (prior[index - 1].x + 2 * point.x + prior[index + 1].x) / 4,
        y: (prior[index - 1].y + 2 * point.y + prior[index + 1].y) / 4,
      }
      return { x: point.x + (average.x - point.x) * amount, y: point.y + (average.y - point.y) * amount }
    })
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const point of filtered) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }
  const extent = Math.hypot(maxX - minX, maxY - minY)
  return rdpOpen(filtered, extent * 0.025 * intensity)
}

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
/** Shape-relative smoothing radius. Area supplies the shape's characteristic scale; the shorter
 *  occupied bound prevents a long thin mark from receiving a radius wider than the shape itself. */
export function paintSmoothingRadius(mask: Mask, strength = PAINT_DEFAULTS.polishStrength): number {
  if (strength <= 0) return 0
  let area = 0, minX = mask.w, minY = mask.h, maxX = -1, maxY = -1
  for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
    if (!mask.data[y * mask.w + x]) continue
    area++
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (!area) return 0
  const equivalentRadius = Math.sqrt(area / Math.PI)
  const boundsRadius = Math.min(maxX - minX + 1, maxY - minY + 1) / 2
  return Math.max(1, Math.round(Math.min(equivalentRadius, boundsRadius) * Math.min(1, strength)))
}

/** Normalize a painted combination with the ENGINE'S own mask smoothing (box-blur + re-threshold):
 *  fills concave bites and shaves nubs smaller than the radius — the 'insect bites' where strokes
 *  meet the mask (Dan 2026-08-06). The completed shape, never the brush, owns the radius. */
export function polishMask(mask: Mask, strength = PAINT_DEFAULTS.polishStrength): Mask {
  if (strength <= 0) return { data: mask.data.slice(), w: mask.w, h: mask.h }
  const r = paintSmoothingRadius(mask, strength)
  if (!r) return { data: mask.data.slice(), w: mask.w, h: mask.h }
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

export function shouldClosePaintStroke(stroke: { x: number; y: number }[], closeFrac: number): boolean {
  if (closeFrac <= 0 || stroke.length < 2) return false
  const first = stroke[0], last = stroke[stroke.length - 1]
  let perimeter = 0
  for (let index = 1; index < stroke.length; index++) perimeter += Math.hypot(stroke[index].x - stroke[index - 1].x, stroke[index].y - stroke[index - 1].y)
  return perimeter > 0 && Math.hypot(first.x - last.x, first.y - last.y) < perimeter * closeFrac
}

/** Rasterize a painted brush gesture to a Mask: the thick swath along the stroke (round caps —
 *  WYSIWYG with the brush cursor), plus the enclosed interior when the gesture closes a loop
 *  (Dan's green-blob semantics: a loop means the whole region). */
export function swathMask(
  stroke: { x: number; y: number }[], brushPx: number, w: number, h: number,
  cfg: Pick<PaintConfig, 'autoTuneStrength' | 'closeFrac'> = PAINT_DEFAULTS,
): Mask {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'
  ctx.lineWidth = Math.max(1, brushPx)
  const tunedStroke = autoTunePaintStroke(stroke, cfg.autoTuneStrength)
  if (tunedStroke.length === 1) {
    ctx.beginPath()
    ctx.arc(tunedStroke[0].x, tunedStroke[0].y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
  } else if (tunedStroke.length > 1) {
    ctx.beginPath()
    ctx.moveTo(tunedStroke[0].x, tunedStroke[0].y)
    for (let i = 1; i < tunedStroke.length - 1; i++) {
      const point = tunedStroke[i], next = tunedStroke[i + 1]
      ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2)
    }
    ctx.lineTo(tunedStroke[tunedStroke.length - 1].x, tunedStroke[tunedStroke.length - 1].y)
    ctx.stroke()
  }
  // closed gesture → fill the interior too
  if (shouldClosePaintStroke(stroke, cfg.closeFrac)) {
    ctx.closePath(); ctx.fill()
  }
  const px = ctx.getImageData(0, 0, w, h).data
  const data = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) data[i] = px[i * 4 + 3] > 128 ? 1 : 0
  return { data, w, h }
}
