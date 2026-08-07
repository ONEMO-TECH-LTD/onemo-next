// mask-tools — the PAINT tool's math (I2e pure move out of cutout-lab/finish.ts): shape→mask
// rasterization, mask booleans, engine-owned polish, painted-swath rasterization. Pure,
// engine-calling via smoothMask only — framework-free, liftable.

import { smoothMask } from '@/lib/effect/mask'
import { flattenShape, type VShape } from '@/lib/vector-core'
import type { Mask } from '@/lib/cutout-ai/types'

/** Rasterize a drawn shape to a Mask (subject matte for the blend layer — inside = subject). */
export function maskFromShape(shape: import('@/lib/vector-core').VShape, w: number, h: number): Mask {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const ring = flattenShape(shape, 0.5)[0] ?? []
  ctx.beginPath()
  ring.forEach((p: { x: number; y: number }, i: number) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill()
  const px = ctx.getImageData(0, 0, w, h).data
  const data = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) data[i] = px[i * 4 + 3] > 128 ? 1 : 0
  return { data, w, h }
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
export function polishMask(mask: Mask, brushPx: number): Mask {
  const r = Math.max(2, Math.round(brushPx / 3))
  return { data: smoothMask(mask.data, mask.w, mask.h, r), w: mask.w, h: mask.h }
}

export function subtractMasks(base: Mask, sub: Mask): Mask {
  const data = new Uint8Array(base.data)
  for (let i = 0; i < data.length; i++) if (sub.data[i]) data[i] = 0
  return { data, w: base.w, h: base.h }
}

/** NO-HOLES LAW (Dan 2026-08-07: "the entire shape must be no holes for wand and AI same" —
 *  micro-holes in the subject matte let the blur pillow bleed through as image artifacts).
 *  Flood the background from the border; any empty region NOT reachable from the border is an
 *  enclosed hole → filled solid (data=1, soft=255 — a SOLID subject, no semi-transparent residue;
 *  outer-edge softness is untouched because only border-unreachable zeros are filled).
 *  Applied at the flow's single mask-acceptance seam, every source. NOTE: editCommit's
 *  maskFromShape bypasses this seam SAFELY — one closed ring cannot enclose a hole. */
export function fillEnclosedHoles(mask: Mask): Mask {
  const { w, h } = mask
  const src = mask.data
  const reach = new Uint8Array(w * h)
  const stack: number[] = []
  for (let x = 0; x < w; x++) { if (!src[x]) stack.push(x); const b = (h - 1) * w + x; if (!src[b]) stack.push(b) }
  for (let y = 0; y < h; y++) { const l = y * w; if (!src[l]) stack.push(l); const r = l + w - 1; if (!src[r]) stack.push(r) }
  while (stack.length) {
    const p = stack.pop()!
    if (reach[p] || src[p]) continue
    reach[p] = 1
    const x = p % w
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (p >= w) stack.push(p - w)
    if (p < w * (h - 1)) stack.push(p + w)
  }
  // fill per-REGION with a size cap (Dan 2026-08-07: the hole guard must never affect AI
  // precision — a large 'enclosed' region behind a thin model bridge is a real concavity, e.g.
  // between legs, not a micro-hole; only genuinely small dropouts are filled).
  let data: Uint8Array | null = null
  let soft: Uint8Array | null = null
  const seen = new Uint8Array(w * h)
  for (let p0 = 0; p0 < w * h; p0++) {
    if (src[p0] || reach[p0] || seen[p0]) continue
    const px: number[] = []
    const q = [p0]
    while (q.length) {
      const p = q.pop()!
      if (p < 0 || p >= w * h || seen[p] || src[p] || reach[p]) continue
      seen[p] = 1; px.push(p)
      const x = p % w
      if (x > 0) q.push(p - 1)
      if (x < w - 1) q.push(p + 1)
      q.push(p - w, p + w)
    }
    if (!data) { data = new Uint8Array(src); soft = mask.soft ? new Uint8Array(mask.soft) : null }
    for (const p of px) { data[p] = 1; if (soft) soft[p] = 255 }
  }
  if (!data) return mask
  const out: Mask = { data, w, h }
  if (soft) out.soft = soft
  return out
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

/** Live selection area — cheap op-effect check (the loud interior-erase no-op depends on it). */
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
): Mask {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'
  ctx.lineWidth = Math.max(1, brushPx * 2) // 1px floor (Dan: brush down to 1)
  ctx.beginPath()
  stroke.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.stroke()
  // closed gesture → fill the interior too
  const first = stroke[0], last = stroke[stroke.length - 1]
  let perim = 0
  for (let i = 1; i < stroke.length; i++) perim += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y)
  if (perim > 0 && Math.hypot(first.x - last.x, first.y - last.y) < perim * 0.2) {
    ctx.closePath(); ctx.fill()
  }
  const px = ctx.getImageData(0, 0, w, h).data
  const data = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) data[i] = px[i * 4 + 3] > 128 ? 1 : 0
  return { data, w, h }
}
