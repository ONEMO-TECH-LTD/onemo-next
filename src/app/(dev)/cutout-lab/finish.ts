// cutout-lab — finishing glue. PURE COMPOSITION of v5.3.1 engine calls (no own geometry math,
// ARCHITECTURE.md law 1): AI mask → v5.3.1 mask hygiene → trace → outline-resolve → SVG path.
// Plus the two canvas render helpers the shell draws with (kept out of the React component, law 3).

import type { Mask } from '@/lib/cutout-ai/types'
import { composeEffectArtwork, presetFilter, PRESET_LABELS, type ArtworkFillMode, type PresetKey } from '@/lib/effect/composite'
import { dilateMask, postProcessMask, smoothMask } from '@/lib/effect/mask'
import { traceContourRaw } from '@/lib/effect/contour'
import { rdpClosed, type Vec2Px } from '@/lib/outline-core/math'
import { flattenShape, shapeBBox, shapeToSVGPathD, type VShape } from '@/lib/vector-core'
import {
  resolveTraceOutline,
  TRACE_OUTLINE_DEFAULTS,
  type TraceOutlineSettings,
} from '@/app/(dev)/effect-creator/v5.3.1/user/editor/producers'

export type { TraceOutlineSettings }

/** Calibration baseline (Dan 2026-08-05): EVERYTHING ZERO — the raw full-fidelity sharp trace,
 *  no recipe applied (engine detail 100 renders as knob 0: the Detail knob is UI-inverted).
 *  The golden config gets dialed from zero on-device and locked here. */
export const AUTO_SETTINGS: TraceOutlineSettings = { ...TRACE_OUTLINE_DEFAULTS }

const MM_BASE = 70 // proto scale anchor (v5.3.1 longestSideMM) — only scales the mm-true tool floors
const PADDING_MM = 1.5 // v5.3.1 EFFECT_BUILD_CONFIG.paddingMM — the cut line NEVER touches the
// subject edge: the mask is dilated outward by this physical margin before tracing, so the visible
// outline is clean margin, not the segmentation staircase (the original 'perfect edges' rule #1)

export interface OutlineBounds { minX: number; minY: number; maxX: number; maxY: number }

/** AI mask → v5.3.1 finishing → resolved outline as an SVG path d + its bounds (image-px space).
 *  Bounds may extend past the image (Offset) — the compose expands the canvas to them. */
export interface FinishResult { d: string; bounds: OutlineBounds; shape: VShape }

export function finishOutline(mask: Mask, settings: TraceOutlineSettings): FinishResult | null {
  const { w, h } = mask
  const mmPerPx = MM_BASE / Math.max(w, h)
  const padPx = Math.max(0, Math.round(PADDING_MM / mmPerPx))
  const padded = padPx > 0 ? dilateMask(postProcessMask(mask.data, w, h), w, h, padPx) : postProcessMask(mask.data, w, h)
  const clean = smoothMask(padded, w, h, 3)
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
  return { d: shapeToSVGPathD(resolved, 2), bounds: { minX: bb.minX, minY: bb.minY, maxX: bb.maxX, maxY: bb.maxY }, shape: resolved }
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

export type FillChoice = ArtworkFillMode | 'mirror'
export interface BlendSettings {
  blend: number            // 0..100 — magic-blend percent (blurred bg + sharp subject) = fill intensity
  fill: FillChoice         // clamp | tile | mirror (mirror = seamless flipped expansion, glue-built)
  preset: PresetKey        // colour preset (composite.ts PRESET_LABELS)
  vignette: number         // 0..100 → 0..1
  tint: string | null      // css colour wash or null
  scale: number            // artwork zoom %, 100 = 1:1 (the shape stays; the image moves under it)
  panX: number             // artwork pan, % of width  (−50..50)
  panY: number             // artwork pan, % of height (−50..50)
}
export const BLEND_DEFAULTS: BlendSettings = { blend: 50, fill: 'clamp', preset: 'none', vignette: 0, tint: null, scale: 100, panX: 0, panY: 0 } // blend 50 ≈ v5.3.1's default magic-blend blur (max(6, w/50)px) — rule #3: the blend is the product look, always on
export { PRESET_LABELS }
export type { PresetKey }

/** Subject pixels = the image masked by the AI mask — with a SOFT feathered alpha edge (rule #2 of
 *  the original 'perfect edges' compositing: v5.3.1's matte is continuous/anti-aliased, never a
 *  hard 1px binary cut; residual tracing imperfections dissolve in the feather + blend). */
export function subjectFromMask(image: HTMLCanvasElement, mask: Mask): HTMLCanvasElement {
  const { w, h } = mask
  const alpha = document.createElement('canvas'); alpha.width = w; alpha.height = h
  const av = new ImageData(w, h)
  for (let i = 0; i < w * h; i++) av.data[i * 4 + 3] = mask.data[i] ? 255 : 0
  alpha.getContext('2d')!.putImageData(av, 0, 0)
  const soft = document.createElement('canvas'); soft.width = w; soft.height = h
  const sctx = soft.getContext('2d')!
  sctx.filter = `blur(${Math.max(1, w / 700)}px)` // ~1.5px feather at working res
  sctx.drawImage(alpha, 0, 0)
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(soft, 0, 0, c.width, c.height)
  return c
}

/** Bake the sticker at the OUTLINE's bounds: the engine expands the canvas past the image frame and
 *  fills the exposed space (Clamp stretches edge pixels / Tile repeats) — background expansion
 *  faked with zero generative AI (the s59 frame-origin capability). Returns a transparent-backed
 *  canvas clipped to the outline, plus its frame origin in image space. */
/** Artwork transform: the image (and its subject matte) move/zoom UNDER the fixed shape —
 *  v5.3.1's art-transform semantics, applied in image space before the compose. */
function transformArtwork(src: HTMLCanvasElement, b: BlendSettings): HTMLCanvasElement {
  if (b.scale === 100 && b.panX === 0 && b.panY === 0) return src
  const w = src.width, h = src.height
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const s = Math.max(0.05, b.scale / 100)
  ctx.translate(w / 2 + (b.panX / 100) * w, h / 2 + (b.panY / 100) * h)
  ctx.scale(s, s)
  ctx.drawImage(src, -w / 2, -h / 2)
  return c
}

/** 3×3 mirror mosaic — each neighbour tile is the image flipped about the shared edge, so the
 *  expansion transitions seamlessly (Dan: tile must MIRROR, plain repeat seams). Glue-built:
 *  the engine's tile/clamp fill stays untouched; mirror hands the engine a bigger original. */
function mirrorMosaic(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width, h = src.height
  const c = document.createElement('canvas'); c.width = w * 3; c.height = h * 3
  const ctx = c.getContext('2d')!
  for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) {
    ctx.save()
    const fx = tx === 1 ? 1 : -1, fy = ty === 1 ? 1 : -1
    ctx.translate(tx * w + (fx === -1 ? w : 0), ty * h + (fy === -1 ? h : 0))
    ctx.scale(fx, fy)
    ctx.drawImage(src, 0, 0)
    ctx.restore()
  }
  return c
}

export async function bakeSticker(
  image: HTMLCanvasElement, mask: Mask, d: string, bounds: OutlineBounds, b: BlendSettings,
): Promise<{ canvas: HTMLCanvasElement; originX: number; originY: number }> {
  const art = transformArtwork(image, b)
  const subj = transformArtwork(subjectFromMask(image, mask), b)
  const mirror = b.fill === 'mirror'
  const sx = mirror ? image.width : 0, sy = mirror ? image.height : 0
  let original = art, subject = subj
  if (mirror) {
    original = mirrorMosaic(art)
    const big = document.createElement('canvas'); big.width = original.width; big.height = original.height
    big.getContext('2d')!.drawImage(subj, sx, sy) // subject sits in the centre tile, untiled
    subject = big
  }
  const { canvas, frame } = await composeEffectArtwork({
    originalCanvas: original,
    subjectCanvas: subject,
    outputBoundsPx: { minX: bounds.minX + sx, minY: bounds.minY + sy, maxX: bounds.maxX + sx, maxY: bounds.maxY + sy },
    blendPercent: b.blend,
    fillMode: mirror ? 'clamp' : (b.fill as ArtworkFillMode), // mirror: the mosaic covers the frame; clamp guards its rim
    fxFilter: presetFilter(b.preset),
    vignette: b.vignette / 100,
    tint: b.tint,
  })
  const out = document.createElement('canvas'); out.width = frame.width; out.height = frame.height
  const ctx = out.getContext('2d')!
  ctx.translate(-(frame.originX - sx), -(frame.originY - sy))
  ctx.clip(new Path2D(d))
  ctx.drawImage(canvas, frame.originX - sx, frame.originY - sy)
  return { canvas: out, originX: frame.originX - sx, originY: frame.originY - sy }
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

// ── drawn shapes (freeshape / Sculpt) — same finishing, same knobs, no AI ──

/** A drawn (already-vector) shape through the SAME v5.3.1 resolver the AI trace uses — the drawn
 *  shape is a first-class OutlineSource (freeshape contract law 3): every knob + reversibility
 *  apply identically. `ring` = the raw resampled stroke (provenance → detail/offset re-derive). */
export function finishDrawn(
  shape: import('@/lib/vector-core').VShape, ring: { x: number; y: number }[], w: number, h: number,
  settings: TraceOutlineSettings,
): FinishResult | null {
  const resolved = resolveTraceOutline(
    {
      vectorShape: shape,
      rawTracePx: ring.map((p) => [p.x, h - p.y] as [number, number]), // producers expects y-up
      maskWidthPx: w,
      maskHeightPx: h,
      mmPerPx: MM_BASE / Math.max(w, h),
    },
    settings,
  )
  if (!resolved) return null
  const bb = shapeBBox(resolved, 1)
  return { d: shapeToSVGPathD(resolved, 2), bounds: { minX: bb.minX, minY: bb.minY, maxX: bb.maxX, maxY: bb.maxY }, shape: resolved }
}

/** Rasterize a drawn shape to a Mask (subject matte for the blend layer — inside = subject). */
export function maskFromShape(shape: import('@/lib/vector-core').VShape, w: number, h: number): Mask {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const ring = flattenShape(shape, 0.5)[0] ?? []
  ctx.beginPath()
  ring.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill()
  const px = ctx.getImageData(0, 0, w, h).data
  const data = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) data[i] = px[i * 4 + 3] > 128 ? 1 : 0
  return { data, w, h }
}
