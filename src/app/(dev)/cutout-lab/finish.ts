// cutout-lab — finishing glue. PURE COMPOSITION of v5.3.1 engine calls (no own geometry math,
// ARCHITECTURE.md law 1): AI mask → v5.3.1 mask hygiene → trace → outline-resolve → SVG path.
// Plus the two canvas render helpers the shell draws with (kept out of the React component, law 3).

import type { Mask } from '@/lib/cutout-ai/types'
import { composeEffectArtwork, presetFilter, PRESET_LABELS, type ArtworkFillMode, type PresetKey } from '@/lib/effect/composite'
import { postProcessMask, smoothMask } from '@/lib/effect/mask'
import { traceContourRaw } from '@/lib/effect/contour'
import { rdpClosed, type Vec2Px } from '@/lib/outline-core/math'
import { shapeBBox, shapeToSVGPathD, type VShape } from '@/lib/vector-core'
import {
  resolveTraceOutline,
  TRACE_OUTLINE_DEFAULTS,
  type TraceOutlineSettings,
} from '@/app/(dev)/effect-creator/v5.3.1/user/editor/producers'

export type { TraceOutlineSettings }

/** v5.3.1's OWN auto config (seed-defaults.ts AUTO_TUNE — "organic by default", T6): the SOURCE
 *  stays the sharp low-node trace (detail 100, offset 0, sharp joins — v5.3.1's deliberate birth,
 *  mobile-editable), and the default look is applied as REVERSIBLE adjustments on top:
 *  simplify 40 · straighten 20 · smooth 45. Zero the sliders → the raw sharp trace. These are the
 *  starting constants Dan tunes on-device; the locked golden config replaces them here. */
export const AUTO_SETTINGS: TraceOutlineSettings = { ...TRACE_OUTLINE_DEFAULTS, simplify: 40, straighten: 20, smooth: 45 }

const MM_BASE = 70 // proto scale anchor (v5.3.1 longestSideMM) — only scales the mm-true tool floors

export interface OutlineBounds { minX: number; minY: number; maxX: number; maxY: number }

/** AI mask → v5.3.1 finishing → resolved outline as an SVG path d + its bounds (image-px space).
 *  Bounds may extend past the image (Offset) — the compose expands the canvas to them. */
export function finishOutline(mask: Mask, settings: TraceOutlineSettings): { d: string; bounds: OutlineBounds } | null {
  const { w, h } = mask
  const clean = smoothMask(postProcessMask(mask.data, w, h), w, h, 3)
  const ring = traceContourRaw(clean, w, h) // canvas ImageData is y-down = editor space already
  if (!ring) return null
  const straight = rdpClosed(ring.map(([x, y]) => [x, y] as Vec2Px), 1.0)
  if (straight.length < 3) return null
  const vectorShape: VShape = { paths: [{ anchors: straight.map(([x, y]) => ({ p: { x, y }, hIn: null, hOut: null, corner: true })) }] }
  const resolved = resolveTraceOutline(
    {
      vectorShape,
      // producers' re-derive flips rawTracePx y-up→down internally, so hand it y-up:
      rawTracePx: ring.map(([x, y]) => [x, h - y] as [number, number]),
      maskWidthPx: w,
      maskHeightPx: h,
      mmPerPx: MM_BASE / Math.max(w, h),
    },
    settings,
  )
  if (!resolved) return null
  const bb = shapeBBox(resolved, 1)
  return { d: shapeToSVGPathD(resolved, 2), bounds: { minX: bb.minX, minY: bb.minY, maxX: bb.maxX, maxY: bb.maxY } }
}

/** Green-kept / red-removed overlay pixels for the mask. */
export function maskOverlay(mask: Mask): ImageData {
  const { data, w, h } = mask
  const ov = new ImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    if (data[i]) { ov.data[o] = 34; ov.data[o + 1] = 197; ov.data[o + 2] = 94; ov.data[o + 3] = 104 }
    else { ov.data[o] = 239; ov.data[o + 1] = 68; ov.data[o + 2] = 68; ov.data[o + 3] = 86 }
  }
  return ov
}

/** Draw the sticker preview: checkerboard + the image clipped to the resolved outline. */
export function drawCutout(target: HTMLCanvasElement, image: HTMLCanvasElement, d: string): void {
  const w = image.width, h = image.height
  target.width = w; target.height = h
  const ctx = target.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  const t = 16
  for (let y = 0; y < h; y += t) for (let x = 0; x < w; x += t) { ctx.fillStyle = ((x / t + y / t) & 1) ? '#e5e7eb' : '#f8fafc'; ctx.fillRect(x, y, t, t) }
  ctx.save()
  ctx.clip(new Path2D(d))
  ctx.drawImage(image, 0, 0)
  ctx.restore()
}

// ── blend layer (the s59-decoupled v5.3.1 2D artwork operation, verified by its own test gates) ──

export interface BlendSettings {
  blend: number            // 0..100 — magic-blend percent (blurred bg + sharp subject)
  fill: ArtworkFillMode    // clamp | tile
  preset: PresetKey        // colour preset (composite.ts PRESET_LABELS)
  vignette: number         // 0..100 → 0..1
  tint: string | null      // css colour wash or null
}
export const BLEND_DEFAULTS: BlendSettings = { blend: 0, fill: 'clamp', preset: 'none', vignette: 0, tint: null }
export { PRESET_LABELS }
export type { PresetKey }

/** Subject pixels = the image masked by the AI mask (alpha from mask, colour from the image). */
export function subjectFromMask(image: HTMLCanvasElement, mask: Mask): HTMLCanvasElement {
  const { w, h } = mask
  const alpha = document.createElement('canvas'); alpha.width = w; alpha.height = h
  const av = new ImageData(w, h)
  for (let i = 0; i < w * h; i++) av.data[i * 4 + 3] = mask.data[i] ? 255 : 0
  alpha.getContext('2d')!.putImageData(av, 0, 0)
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(alpha, 0, 0, c.width, c.height)
  return c
}

/** Bake the sticker at the OUTLINE's bounds: the engine expands the canvas past the image frame and
 *  fills the exposed space (Clamp stretches edge pixels / Tile repeats) — background expansion
 *  faked with zero generative AI (the s59 frame-origin capability). Returns a transparent-backed
 *  canvas clipped to the outline, plus its frame origin in image space. */
export async function bakeSticker(
  image: HTMLCanvasElement, mask: Mask, d: string, bounds: OutlineBounds, b: BlendSettings,
): Promise<{ canvas: HTMLCanvasElement; originX: number; originY: number }> {
  const { canvas, frame } = await composeEffectArtwork({
    originalCanvas: image,
    subjectCanvas: subjectFromMask(image, mask),
    outputBoundsPx: bounds,
    blendPercent: b.blend,
    fillMode: b.fill,
    fxFilter: presetFilter(b.preset),
    vignette: b.vignette / 100,
    tint: b.tint,
  })
  const out = document.createElement('canvas'); out.width = frame.width; out.height = frame.height
  const ctx = out.getContext('2d')!
  ctx.translate(-frame.originX, -frame.originY)
  ctx.clip(new Path2D(d))
  ctx.drawImage(canvas, frame.originX, frame.originY)
  return { canvas: out, originX: frame.originX, originY: frame.originY }
}

/** Preview: the baked sticker over a checkerboard, at the expanded frame size. */
export async function composeSticker(
  target: HTMLCanvasElement, image: HTMLCanvasElement, mask: Mask, d: string, bounds: OutlineBounds, b: BlendSettings,
): Promise<void> {
  const baked = await bakeSticker(image, mask, d, bounds, b)
  const w = baked.canvas.width, h = baked.canvas.height
  target.width = w; target.height = h
  const ctx = target.getContext('2d')!
  const t = 16
  for (let y = 0; y < h; y += t) for (let x = 0; x < w; x += t) { ctx.fillStyle = ((x / t + y / t) & 1) ? '#e5e7eb' : '#f8fafc'; ctx.fillRect(x, y, t, t) }
  ctx.drawImage(baked.canvas, 0, 0)
}
