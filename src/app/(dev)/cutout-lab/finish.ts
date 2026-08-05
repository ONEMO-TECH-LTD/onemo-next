// cutout-lab — finishing glue. PURE COMPOSITION of v5.3.1 engine calls (no own geometry math,
// ARCHITECTURE.md law 1): AI mask → v5.3.1 mask hygiene → trace → outline-resolve → SVG path.
// Plus the two canvas render helpers the shell draws with (kept out of the React component, law 3).

import type { Mask } from '@/lib/cutout-ai/types'
import { dilateMask } from '@/lib/effect/mask'
import { composeEffectArtwork, presetFilter, PRESET_LABELS, type ArtworkFillMode, type PresetKey } from '@/lib/effect/composite'
import { flattenShape, shapeBBox, shapeToSVGPathD, type VShape } from '@/lib/vector-core'
import {
  resolveTraceOutline,
  TRACE_OUTLINE_DEFAULTS,
  type TraceOutlineSettings,
} from '@/app/(dev)/effect-creator/v5.3.1/user/editor/producers'
import { prepareShaped } from '@/app/(dev)/effect-creator/v5.3.1/core/primitives'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import type { MLResult } from '@/lib/effect/segment-ml'

export type { TraceOutlineSettings }

export interface OutlineBounds { minX: number; minY: number; maxX: number; maxY: number }
export interface FinishResult { d: string; bounds: OutlineBounds; shape: VShape }

/** Calibration baseline (Dan 2026-08-05): EVERYTHING ZERO — the raw full-fidelity sharp trace,
 *  no recipe applied (engine detail 100 renders as knob 0: the Detail knob is UI-inverted).
 *  The golden config gets dialed from zero on-device and locked here. */
export const AUTO_SETTINGS: TraceOutlineSettings = { ...TRACE_OUTLINE_DEFAULTS }

const MM_BASE = 70 // proto scale anchor (v5.3.1 longestSideMM) — only scales the mm-true tool floors

export interface OutlineBounds { minX: number; minY: number; maxX: number; maxY: number }

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
  // DEFRINGE (the actual dirty-edge cure): the mask's outermost 1–2px rim is background-coloured
  // contamination — feathering alone BLURS the dirt. Erode the matte into the subject first (eat
  // the rim), THEN feather. Erode = dilate the inverse (mask.ts has the octagonal dilate).
  const inv = new Uint8Array(w * h)
  for (let i = 0; i < inv.length; i++) inv[i] = mask.data[i] ? 0 : 1
  const invGrown = dilateMask(inv, w, h, 2)
  const alpha = document.createElement('canvas'); alpha.width = w; alpha.height = h
  const av = new ImageData(w, h)
  for (let i = 0; i < w * h; i++) av.data[i * 4 + 3] = invGrown[i] ? 0 : 255
  alpha.getContext('2d')!.putImageData(av, 0, 0)
  const soft = document.createElement('canvas'); soft.width = w; soft.height = h
  const sctx = soft.getContext('2d')!
  sctx.filter = `blur(${Math.max(1.5, w / 450)}px)` // ~2.3px feather at working res
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

/** Mask booleans for the DRAW add/erase combination (Dan's two examples: a drawn loop unions into
 *  or subtracts from the current selection GEOMETRICALLY — no AI). The result re-enters
 *  finishOutline, so padding + smoothing give the elegant joins. */
export function unionMasks(base: Mask, add: Mask): Mask {
  const data = new Uint8Array(base.data)
  for (let i = 0; i < data.length; i++) if (add.data[i]) data[i] = 1
  return { data, w: base.w, h: base.h }
}
export function subtractMasks(base: Mask, sub: Mask): Mask {
  const data = new Uint8Array(base.data)
  for (let i = 0; i < data.length; i++) if (sub.data[i]) data[i] = 0
  return { data, w: base.w, h: base.h }
}

// ── ENGINE-NATIVE AI path (Dan's root-cause call, s62): STOP approximating the compositing —
// build the engine's own preseg (MLResult) from the model's SOFT matte and run prepareShaped:
// padding, soft-matte subject, default blend, composite — all the v1→v5.3.1 behavior BY DEFAULT,
// zero glue re-implementation. Removing u2net never removed the settings; the glue had bypassed
// the pipeline (prepareEffect) that owns them.

/** Model mask (+soft alpha) → the engine's MLResult preseg. The engine convention is Y-UP
 *  (segment-ml rasterize): flip rows. imageData/texImage = the image RGB with matte alpha. */
export function buildPreseg(image: HTMLCanvasElement, mask: Mask): MLResult {
  const { w, h } = mask
  // soft alpha: the model's continuous channel, else a feathered binary (brushed/boolean masks)
  let soft = mask.soft
  if (!soft) {
    const a = document.createElement('canvas'); a.width = w; a.height = h
    const av = new ImageData(w, h)
    for (let i = 0; i < w * h; i++) av.data[i * 4 + 3] = mask.data[i] ? 255 : 0
    a.getContext('2d')!.putImageData(av, 0, 0)
    const sc = document.createElement('canvas'); sc.width = w; sc.height = h
    const sctx = sc.getContext('2d')!
    sctx.filter = `blur(${Math.max(1, w / 700)}px)`
    sctx.drawImage(a, 0, 0)
    const sd = sctx.getImageData(0, 0, w, h).data
    soft = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) soft[i] = sd[i * 4 + 3]
  }
  // y-up image pixels (engine rasterize convention)
  const flip = document.createElement('canvas'); flip.width = w; flip.height = h
  const fctx = flip.getContext('2d', { willReadFrequently: true })!
  fctx.translate(0, h); fctx.scale(1, -1)
  fctx.drawImage(image, 0, 0, w, h)
  const img = fctx.getImageData(0, 0, w, h)
  // matte alpha into the y-up pixels + the y-up binary mask
  const data = img.data
  const binUp = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w
    for (let x = 0; x < w; x++) {
      data[(y * w + x) * 4 + 3] = soft[src + x]
      binUp[y * w + x] = mask.data[src + x]
    }
  }
  return {
    mask: binUp, width: w, height: h, imageData: img,
    texImage: img, texMask: binUp, texW: w, texH: h,
    adapterId: mask.soft ? 'edgesam' : 'brushed',
  }
}

/** The engine-native prepare: model matte in → the WHOLE v5.3.1 shaped pipeline out. */
export function prepareAI(url: string, image: HTMLCanvasElement, mask: Mask): Promise<PreparedEffect> {
  return prepareShaped(url, buildPreseg(image, mask))
}

/** Knob resolution over the engine spec — v5.3.1's own generation-controls path, verbatim. */
export function finishSpec(prepared: PreparedEffect, settings: TraceOutlineSettings): FinishResult | null {
  const spec = prepared.spec
  const resolved = resolveTraceOutline(
    {
      vectorShape: spec.vectorShape,
      rawTracePx: spec.rawTracePx,
      maskWidthPx: spec.maskWidthPx,
      maskHeightPx: spec.maskHeightPx,
      mmPerPx: spec.mmPerPx,
    },
    settings,
  )
  if (!resolved) return null
  const bb = shapeBBox(resolved, 1)
  return { d: shapeToSVGPathD(resolved, 2), bounds: { minX: bb.minX, minY: bb.minY, maxX: bb.maxX, maxY: bb.maxY }, shape: resolved }
}

/** Engine-native sticker bake: the engine's OWN matted subject + original (frontSrc, y-up) through
 *  the one 2D artwork op at the outline's bounds; mirror/scale/pan glue layers on top unchanged.
 *  d/bounds live in mask space (y-down) — mapped into the frontSrc tex space here. */
export async function bakeStickerEngine(
  prepared: PreparedEffect, d: string, bounds: OutlineBounds, maskW: number, maskH: number, b: BlendSettings,
): Promise<{ canvas: HTMLCanvasElement }> {
  const { origCanvas, subjCanvas } = prepared.frontSrc
  const k = origCanvas.width / maskW
  // y-up tex-space bounds
  const texH = origCanvas.height
  const bUp: OutlineBounds = { minX: bounds.minX * k, minY: texH - bounds.maxY * k, maxX: bounds.maxX * k, maxY: texH - bounds.minY * k }
  const art = transformArtwork(origCanvas, { ...b, panY: -b.panY }) // y-up: pan direction flips
  const subj = transformArtwork(subjCanvas, { ...b, panY: -b.panY })
  const mirror = b.fill === 'mirror'
  const sx = mirror ? origCanvas.width : 0, sy = mirror ? texH : 0
  let original = art, subject = subj
  if (mirror) {
    original = mirrorMosaic(art)
    const big = document.createElement('canvas'); big.width = original.width; big.height = original.height
    big.getContext('2d')!.drawImage(subj, sx, sy)
    subject = big
  }
  const { canvas, frame } = await composeEffectArtwork({
    originalCanvas: original,
    subjectCanvas: subject,
    outputBoundsPx: { minX: bUp.minX + sx, minY: bUp.minY + sy, maxX: bUp.maxX + sx, maxY: bUp.maxY + sy },
    blendPercent: b.blend,
    fillMode: mirror ? 'clamp' : (b.fill as ArtworkFillMode),
    fxFilter: presetFilter(b.preset),
    vignette: b.vignette / 100,
    tint: b.tint,
  })
  // flip the composed frame to y-down and clip with the outline (scaled into tex space)
  const fw = frame.width, fh = frame.height
  const ox = frame.originX - sx, oy = frame.originY - sy // y-up tex-space origin
  const flipped = document.createElement('canvas'); flipped.width = fw; flipped.height = fh
  const fctx = flipped.getContext('2d')!
  fctx.translate(0, fh); fctx.scale(1, -1)
  fctx.drawImage(canvas, 0, 0)
  // y-down origin of the frame in tex space
  const oyDown = texH - (oy + fh)
  const out = document.createElement('canvas'); out.width = fw; out.height = fh
  const ctx = out.getContext('2d')!
  const path = new Path2D()
  path.addPath(new Path2D(d), new DOMMatrix().scale(k))
  ctx.translate(-ox, -oyDown)
  ctx.clip(path)
  ctx.drawImage(flipped, ox, oyDown)
  return { canvas: out }
}

/** Engine-native preview: baked sticker over a checkerboard. */
export async function composeStickerEngine(
  target: HTMLCanvasElement, prepared: PreparedEffect, d: string, bounds: OutlineBounds, maskW: number, maskH: number, b: BlendSettings,
): Promise<void> {
  const baked = await bakeStickerEngine(prepared, d, bounds, maskW, maskH, b)
  const w = baked.canvas.width, h = baked.canvas.height
  target.width = w; target.height = h
  const ctx = target.getContext('2d')!
  const t = 16
  for (let y = 0; y < h; y += t) for (let x = 0; x < w; x += t) { ctx.fillStyle = ((x / t + y / t) & 1) ? '#e5e7eb' : '#f8fafc'; ctx.fillRect(x, y, t, t) }
  ctx.drawImage(baked.canvas, 0, 0)
}
