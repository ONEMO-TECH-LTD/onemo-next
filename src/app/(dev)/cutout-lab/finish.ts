// cutout-lab — finishing glue. PURE COMPOSITION of v5.3.1 engine calls (no own geometry math,
// ARCHITECTURE.md law 1): AI mask → v5.3.1 mask hygiene → trace → outline-resolve → SVG path.
// Plus the two canvas render helpers the shell draws with (kept out of the React component, law 3).

import type { Mask } from '@/lib/cutout-ai/types'
import { postProcessMask, smoothMask } from '@/lib/effect/mask'
import { traceContourRaw } from '@/lib/effect/contour'
import { rdpClosed, type Vec2Px } from '@/lib/outline-core/math'
import { shapeToSVGPathD, type VShape } from '@/lib/vector-core'
import {
  resolveTraceOutline,
  TRACE_OUTLINE_DEFAULTS,
  type TraceOutlineSettings,
} from '@/app/(dev)/effect-creator/v5.3.1/user/editor/producers'

export type { TraceOutlineSettings }

/** Sticker-ish auto defaults (Dan: refinements automatic, user fine-tunes). All v5.3.1 controls. */
export const AUTO_SETTINGS: TraceOutlineSettings = { ...TRACE_OUTLINE_DEFAULTS, detail: 85, offset: 3, offsetJoin: 'round', smooth: 30 }

const MM_BASE = 70 // proto scale anchor (v5.3.1 longestSideMM) — only scales the mm-true tool floors

/** AI mask → v5.3.1 finishing → resolved outline as an SVG path d (image-px space). */
export function finishOutline(mask: Mask, settings: TraceOutlineSettings): { d: string; shape: VShape } | null {
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
  return { d: shapeToSVGPathD(resolved, 2), shape: resolved }
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
