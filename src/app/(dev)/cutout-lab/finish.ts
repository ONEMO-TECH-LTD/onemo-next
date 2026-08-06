// cutout-lab — finishing glue. PURE COMPOSITION of v5.3.1 engine calls (no own geometry math,
// ARCHITECTURE.md law 1): AI mask → v5.3.1 mask hygiene → trace → outline-resolve → SVG path.
// Plus the two canvas render helpers the shell draws with (kept out of the React component, law 3).

import type { Mask } from '@/lib/cutout-ai/types'
import { dilateMask, effectiveTextureDim } from '@/lib/effect/mask'
import { matteToMLResult } from '@/lib/effect/segment-ml'
import { composeEffectArtwork, presetFilter, PRESET_LABELS, type ArtworkFillMode, type PresetKey } from '@/lib/effect/composite'
import { flattenShape, shapeBBox, shapeToSVGPathD, transformShape, type VShape } from '@/lib/vector-core'
import {
  detailToFloorMm,
  resolveTraceOutline,
  TRACE_OUTLINE_DEFAULTS,
  type TraceOutlineSettings,
} from '@/app/(dev)/effect-creator/v5.3.1/user/editor/producers'
import { prepareEffect, EFFECT_BUILD_CONFIG } from '@/lib/effect/prepare-effect'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import type { MLResult } from '@/lib/effect/segment-ml'

export type { TraceOutlineSettings }

export interface OutlineBounds { minX: number; minY: number; maxX: number; maxY: number }
export interface FinishResult { d: string; bounds: OutlineBounds; shape: VShape }

/** Calibration baseline (Dan 2026-08-05): EVERYTHING ZERO — the raw full-fidelity sharp trace,
 *  no recipe applied (engine detail 100 renders as knob 0: the Detail knob is UI-inverted).
 *  The golden config gets dialed from zero on-device and locked here. */
/** TRUE all-off — the reset used when adjustments FOLD into a baked source (edit modes). */
export const ZERO_SETTINGS: TraceOutlineSettings = { ...TRACE_OUTLINE_DEFAULTS }

export const AUTO_SETTINGS: TraceOutlineSettings = {
  ...TRACE_OUTLINE_DEFAULTS,
  // Dan's default config for ANY shape (2026-08-06): offset 3, the rest 10.
  // detail is UI-inverted (knob 10 = engine 90); straighten/curve stay 0 (off the surface).
  detail: 90, offset: 3, simplify: 10, smooth: 10, radius: 10,
}

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
export const BLEND_DEFAULTS: BlendSettings = { blend: 100, fill: 'mirror', preset: 'none', vignette: 0, tint: null, scale: 100, panX: 0, panY: 0 } // Dan 2026-08-06: default blend 100 (compositing ON by default); blend 0 remains the no-composite state — raw image under the vector mask
export { PRESET_LABELS }
export type { PresetKey }



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

/** Flattened ring of a shape (vector-core op kept OUT of the UI — module boundary). */
export const shapeRing = (shape: VShape): { x: number; y: number }[] =>
  (flattenShape(shape, 0.5)[0] ?? []).map((p) => ({ x: p.x, y: p.y }))

/** SVG path of a shape (serialization kept OUT of the UI — module boundary). */
export const shapePathD = (shape: VShape): string => shapeToSVGPathD(shape, 2)

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

/** Artwork transform: the image (and its subject matte) move/zoom UNDER the fixed shape —
 *  v5.3.1's art-transform semantics (EditorCanvas artXform: centre-scale + pan), image space. */
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
 *  expansion transitions seamlessly (Dan's mirror fill). Glue on TOP of the untouched engine op:
 *  mirror hands the engine a bigger original; the engine's own clamp/tile stays as shipped. */
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

// ── ENGINE-NATIVE AI path (Dan's root-cause call, s62): STOP approximating the compositing —
// build the engine's own preseg (MLResult) from the model's SOFT matte and run prepareShaped:
// padding, soft-matte subject, default blend, composite — all the v1→v5.3.1 behavior BY DEFAULT,
// zero glue re-implementation. Removing u2net never removed the settings; the glue had bypassed
// the pipeline (prepareEffect) that owns them.

/** Model mask (+soft alpha) → the SAME cutout format the worker trio renders (Dan's slot law:
 *  u2net and SAM are slotted AI engines emitting one MLResult contract; nothing downstream may
 *  differ from pure v5.3.1). Build the full-res RGBA matte exactly like ben.worker does — original
 *  RGB at the working cap, model alpha canvas-upscaled onto it — then run the engine's OWN shared
 *  tail (`matteToMLResult`: lo mask @ the bridge's maskDim + hi texture @ the device cap, y-up,
 *  post-processed). All dims are the BRIDGE'S config, none the lab's. */
export async function buildPreseg(url: string, mask: Mask): Promise<MLResult> {
  const { w, h } = mask
  const texDim = effectiveTextureDim()
  // original image at the working cap (y-down; matteToMLResult's rasterize does the y-up flip)
  const img = new Image(); img.src = url
  await img.decode()
  const s = Math.min(1, texDim / Math.max(img.naturalWidth, img.naturalHeight))
  const ow = Math.max(1, Math.round(img.naturalWidth * s)), oh = Math.max(1, Math.round(img.naturalHeight * s))
  const matte = document.createElement('canvas'); matte.width = ow; matte.height = oh
  const mctx = matte.getContext('2d')!
  mctx.drawImage(img, 0, 0, ow, oh)
  // model alpha at its own res (soft channel when the model provides one, binary otherwise) —
  // canvas bilinear upscale to full res is EXACTLY how ben.worker turns model-res alpha into the
  // soft full-res matte (never ctx.filter — a documented Safari no-op, composite.ts KAI-9147).
  const a = document.createElement('canvas'); a.width = w; a.height = h
  const av = new ImageData(w, h)
  const soft = mask.soft
  for (let i = 0; i < w * h; i++) av.data[i * 4 + 3] = soft ? soft[i] : (mask.data[i] ? 255 : 0)
  a.getContext('2d')!.putImageData(av, 0, 0)
  mctx.globalCompositeOperation = 'destination-in'
  mctx.drawImage(a, 0, 0, ow, oh)
  mctx.globalCompositeOperation = 'source-over'
  const { EFFECT_BUILD_CONFIG } = await import('@/lib/effect/prepare-effect')
  return matteToMLResult(matte, EFFECT_BUILD_CONFIG.maxImageDim, texDim, mask.soft ? 'edgesam' : 'brushed')
}

/** The lab's engine config = prepareShaped's, with ONE parameter changed through the engine's own
 *  cfg API: paddingMM 0 (Dan 2026-08-06 value-reflection: knob Offset 0 must mean a trace with NO
 *  built-in offset — the 1.5mm product padding hid an outset the knob didn't show; expansion is the
 *  Offset knob's job, reflected truthfully). */
const LAB_CFG = { ...EFFECT_BUILD_CONFIG, minFeatureMM: detailToFloorMm(100), paddingMM: 0 }

/** The engine's G4 progress states surfaced to the shell — a degraded cut must NEVER be silent:
 *  the flood-fill fallback has NO matte (its subject is the raw full image by engine design), so
 *  the user must know when it ran (the 'two layered images' signature, Dan 2026-08-06). */
export type PrepareProgress = 'downloading-model' | 'cutting' | 'fallback'

/** The engine-native prepare: model matte in → the WHOLE v5.3.1 shaped pipeline out. */
export async function prepareAI(url: string, mask: Mask, onProgress?: (s: PrepareProgress) => void): Promise<PreparedEffect> {
  return prepareEffect(url, 'shaped', LAB_CFG, onProgress, await buildPreseg(url, mask))
}

/** The TRUE v5.3.1 bridge: an untouched segmentML MLResult straight into the shaped pipeline —
 *  exactly what the v5.3.1 flow does. No lab reconstruction of the matte. */
export function prepareNative(url: string, preseg: MLResult, onProgress?: (s: PrepareProgress) => void): Promise<PreparedEffect> {
  return prepareEffect(url, 'shaped', LAB_CFG, onProgress, preseg)
}

/** Knob resolution over the engine spec — v5.3.1's own generation-controls path, verbatim.
 *  `viewW` maps the result from the spec's mask space (the BRIDGE'S dims) into the lab canvas's
 *  space via the engine's own transformShape — the spec dims are the bridge's config and need not
 *  match the lab canvas (they diverged when the bridge took over segmentation, 2026-08-06). */
export function finishSpec(prepared: PreparedEffect, settings: TraceOutlineSettings, viewW?: number): FinishResult | null {
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
  const k = viewW ? viewW / Math.max(1, spec.maskWidthPx) : 1
  const view = k === 1 ? resolved : transformShape(resolved, (p) => ({ x: p.x * k, y: p.y * k }))
  const bb = shapeBBox(view, 1)
  return { d: shapeToSVGPathD(view, 2), bounds: { minX: bb.minX, minY: bb.minY, maxX: bb.maxX, maxY: bb.maxY }, shape: view }
}

/** Engine-native sticker bake: the engine's OWN matted subject + original (frontSrc, y-up) through
 *  the one 2D artwork op at the outline's bounds; mirror/scale/pan glue layers on top unchanged.
 *  d/bounds live in mask space (y-down) — mapped into the frontSrc tex space here. */
export async function bakeStickerEngine(
  prepared: PreparedEffect, d: string, bounds: OutlineBounds, maskW: number, maskH: number, b: BlendSettings,
): Promise<{ canvas: HTMLCanvasElement }> {
  const { origCanvas, subjCanvas } = prepared.frontSrc
  const k = origCanvas.width / maskW
  // DEFAULT = NO COMPOSITING (Dan 2026-08-06): at blend 0 with no other effect, the artwork IS the
  // ORIGINAL image under the vector mask — no subject re-lay, no blur, no compositor call at all,
  // so no matte artifact can exist by construction. The engine op below engages ONLY when blend or
  // another blend-tab effect is switched on (the opt-in edge-case layer: decouple the object,
  // normalise/expand the background).
  const neutral = b.blend === 0 && b.scale === 100 && !b.panX && !b.panY
    && b.preset === 'none' && !b.vignette && !b.tint
  // OFFSET PAST THE FRAME (Dan 2026-08-06): when the outline crosses the image boundary,
  // COMPOSITING ENGAGES BY DEFAULT — the engine's default magic blend wakes (hides the invented
  // band's seams) over the selectable fill underlay (clamp / tile / mirror, Blend tab; mirror is
  // the default — per-axis flipped tiles, edge-to-edge continuity). Inside the frame at blend 0
  // nothing composites — the original image under the vector mask.
  const outgrown = bounds.minX < 0 || bounds.minY < 0 || bounds.maxX > maskW || bounds.maxY > maskH
  // (value-reflection, Dan 15:34: auto-blend is set by the SHELL into the knob state — never a
  // silent override here, so the control always shows the true applied blend.)
  // NO-MATTE GUARD (Dan's law: a full-image composite may not exist ANYWHERE): the flood-fill
  // fallback has no object layer — its 'subject' is the raw full image, which drawn sharp over the
  // blur COVERS it (blend looks dead) or double-layers under scale. With no matte, blend is forced
  // off and the subject overlay is skipped; the band fill still works for outgrown offsets.
  const matteless = prepared.spec.generator.adapter === 'alpha' || prepared.spec.generator.adapter === 'bg-flood'
  if (matteless) b = { ...b, blend: 0 }
  if (neutral && !outgrown && !matteless) {
    const src = origCanvas // the untouched original (y-up, engine convention)
    const fw = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) * k))
    const fh = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) * k))
    const out = document.createElement('canvas'); out.width = fw; out.height = fh
    const ctx = out.getContext('2d')!
    ctx.translate(-bounds.minX * k, -bounds.minY * k)
    const path = new Path2D(); path.addPath(new Path2D(d), new DOMMatrix().scale(k))
    ctx.clip(path)
    ctx.translate(0, src.height); ctx.scale(1, -1)
    ctx.drawImage(src, 0, 0)
    return { canvas: out }
  }
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
    blendPercent: mirror ? b.blend / 3 : b.blend, // mosaic is 3x wide — keep the blur physically equal
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
  ctx.lineWidth = Math.max(2, brushPx * 2)
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
