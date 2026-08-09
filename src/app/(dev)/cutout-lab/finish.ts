// cutout-lab — finishing glue. PURE COMPOSITION of v5.3.1 engine calls (no own geometry math,
// ARCHITECTURE.md law 1): AI mask → v5.3.1 mask hygiene → trace → outline-resolve → SVG path.
// Plus the two canvas render helpers the shell draws with (kept out of the React component, law 3).

import type { Mask } from '@/lib/mask-tools/types'
import { effectiveTextureDim } from '@/lib/effect/mask'
import { finishMLResultEdges, matteToMLResult } from '@/lib/effect/segment-ml'
import { blendPercentToPixels, composeEffectArtwork } from '@/lib/effect/composite'
import { shapeBBox, shapeToSVGPathD, transformShape, type VShape } from '@/lib/vector-core'
import {
  detailToFloorMm,
  resolveTraceOutline,
  TRACE_OUTLINE_DEFAULTS,
  TRACE_OUTLINE_PIXEL_DEFAULTS,
  traceSettingsToPixelUnits,
  type TraceOutlineInput,
  type TraceOutlineSettings,
} from '@/lib/effect/trace-outline-controls'
import { prepareEffect, EFFECT_BUILD_CONFIG } from '@/lib/effect/prepare-effect'
import type { PreparedEffectBase } from '@/lib/effect/prepare-effect'
import type { MLResult } from '@/lib/effect/segment-ml'

export type { TraceOutlineSettings }

export interface OutlineBounds { minX: number; minY: number; maxX: number; maxY: number }
export interface FinishResult { d: string; bounds: OutlineBounds; shape: VShape }

/** Direct-pixel all-off reset used for Paint and when edits fold a recipe into a baked source. */
export const ZERO_SETTINGS: TraceOutlineSettings = { ...TRACE_OUTLINE_PIXEL_DEFAULTS }

/** Dan's named vector recipes. ZERO/PURE are direct pixels; the retained CSV rows are converted
 * against each accepted source so their pre-pixel calibration remains shape-identical. */
export const VECTOR_PRESETS = [
  { name: 'ZERO', units: 'px', detail: 0, offset: 0, simplify: 0, smooth: 0, radius: 0 },
  { name: 'PURE', units: 'px', detail: 0, offset: 1, simplify: 0, smooth: 0, radius: 0 },
  { name: 'CLASSIC', units: 'legacy', detail: 0, offset: 2, simplify: 15, smooth: 0, radius: 10 },
  { name: 'TECHNO', units: 'legacy', detail: 10, offset: 3, simplify: 0, smooth: 20, radius: 2 },
  { name: 'EDGY', units: 'legacy', detail: 13, offset: 4, simplify: 0, smooth: 1, radius: 1 },
  { name: 'FLUID', units: 'legacy', detail: 0, offset: 4, simplify: 100, smooth: 0, radius: 13 },
  { name: 'SPACE', units: 'legacy', detail: 80, offset: 15, simplify: 0, smooth: 0, radius: 5 },
] as const
export type VectorPresetName = (typeof VECTOR_PRESETS)[number]['name']

const MM_BASE = 70 // proto scale anchor (v5.3.1 longestSideMM) — only scales the mm-true tool floors

const drawnOutlineInput = (
  shape: VShape, ring: { x: number; y: number }[], w: number, h: number,
): TraceOutlineInput => ({
  vectorShape: shape,
  rawTracePx: ring.map((p) => [p.x, h - p.y] as [number, number]),
  maskWidthPx: w,
  maskHeightPx: h,
  mmPerPx: MM_BASE / Math.max(w, h),
})

const preparedOutlineInput = (prepared: PreparedEffectBase): TraceOutlineInput => ({
  vectorShape: prepared.spec.vectorShape,
  rawTracePx: prepared.spec.rawTracePx,
  maskWidthPx: prepared.spec.maskWidthPx,
  maskHeightPx: prepared.spec.maskHeightPx,
  mmPerPx: prepared.spec.mmPerPx,
})

export const pixelSettingsForPrepared = (prepared: PreparedEffectBase, settings: TraceOutlineSettings) =>
  traceSettingsToPixelUnits(preparedOutlineInput(prepared), settings)

export function settingsForVectorPreset(prepared: PreparedEffectBase, name: VectorPresetName): TraceOutlineSettings {
  const preset = VECTOR_PRESETS.find((candidate) => candidate.name === name)!
  if (preset.units === 'px') return {
    ...ZERO_SETTINGS,
    detail: preset.detail,
    offset: preset.offset,
    simplify: preset.simplify,
    smooth: preset.smooth,
    radius: preset.radius,
  }
  return pixelSettingsForPrepared(prepared, {
    ...TRACE_OUTLINE_DEFAULTS,
    spatialUnit: 'legacy',
    detail: 100 - preset.detail,
    offset: preset.offset,
    simplify: preset.simplify,
    smooth: preset.smooth,
    radius: preset.radius,
  })
}


/** Green-kept / red-removed overlay pixels for the mask. */
export function maskOverlay(mask: Mask, mode: 'add' | 'erase' = 'add'): ImageData {
  // ONE color at a time (Dan device r7): ADD tints the SELECTION green (what's included);
  // ERASE tints the OUTSIDE red (what's excluded/erasable) — the selection itself stays clean.
  const { data, w, h } = mask
  const ov = new ImageData(w, h)
  const erase = mode === 'erase'
  const [r, g, b] = erase ? [239, 68, 68] : [34, 197, 94]
  for (let i = 0; i < w * h; i++) {
    if (erase ? data[i] : !data[i]) continue // erase marks OUTSIDE the selection; add marks inside
    const o = i * 4
    ov.data[o] = r; ov.data[o + 1] = g; ov.data[o + 2] = b; ov.data[o + 3] = 110
  }
  return ov
}

// ── blend layer (the s59-decoupled v5.3.1 2D artwork operation, verified by its own test gates) ──

export interface BlendSettings {
  blend: number            // 0..100 — magic-blend percent (blurred bg + sharp subject) = fill intensity
}
export const BLEND_DEFAULTS: BlendSettings = { blend: 0 }



// ── drawn shapes (paint hand tool) — same finishing, same knobs, no AI ──

/** A drawn (already-vector) shape through the SAME v5.3.1 resolver the AI trace uses — the drawn
 *  shape is a first-class OutlineSource: every knob + reversibility
 *  apply identically. `ring` = the raw resampled stroke (provenance → detail/offset re-derive). */
export function finishDrawn(
  shape: import('@/lib/vector-core').VShape, ring: { x: number; y: number }[], w: number, h: number,
  settings: TraceOutlineSettings,
): FinishResult | null {
  const resolved = resolveTraceOutline(drawnOutlineInput(shape, ring, w, h), settings)
  if (!resolved) return null
  const bb = shapeBBox(resolved, 1)
  return { d: shapeToSVGPathD(resolved, 2), bounds: { minX: bb.minX, minY: bb.minY, maxX: bb.maxX, maxY: bb.maxY }, shape: resolved }
}



// ── ENGINE-NATIVE AI path (Dan's root-cause call, s62): STOP approximating the compositing —
// build the engine's own preseg (MLResult) from the model's SOFT matte and run prepareShaped:
// padding, soft-matte subject, default blend, composite — all the v1→v5.3.1 behavior BY DEFAULT,
// zero glue re-implementation. Removing u2net never removed the settings; the glue had bypassed
// the pipeline (prepareEffect) that owns them.

/** Model mask (+soft alpha) → the SAME cutout format the worker trio renders (Dan's slot law:
 *  u2net is the sole cut; matteToMLResult stays slot-generic (one MLResult contract) so nothing downstream may
 *  differ from pure v5.3.1). Build the full-res RGBA matte exactly like ben.worker does — original
 *  RGB at the working cap, model alpha canvas-upscaled onto it — then run the engine's OWN shared
 *  tail (`matteToMLResult`: lo mask @ the bridge's maskDim + hi texture @ the device cap, y-up,
 *  post-processed). All dims are the BRIDGE'S config, none the lab's. */
// EMPTY-STOMACH CACHE (§I2b law 4): the decoded original at the texture cap + the scratch
// canvases are built ONCE per accepted artwork (keyed on its object URL) and REUSED every tap —
// never re-decoded or re-allocated — until replacement or unmount releases them.
let presegCache: {
  url: string; base: HTMLCanvasElement; ow: number; oh: number
  matte: HTMLCanvasElement; alpha: HTMLCanvasElement; av: ImageData; aw: number; ah: number
} | null = null

/** Release upload-owned raster scratch when its artwork is replaced or unmounted. */
export function disposePrepareAICache(): void { presegCache = null }

async function buildPreseg(url: string, mask: Mask): Promise<MLResult> {
  const { w, h } = mask
  const texDim = effectiveTextureDim()
  if (presegCache?.url !== url) {
    // original image at the working cap (y-down; matteToMLResult's rasterize does the y-up flip)
    const img = new Image(); img.src = url
    await img.decode()
    const s = Math.min(1, texDim / Math.max(img.naturalWidth, img.naturalHeight))
    const ow = Math.max(1, Math.round(img.naturalWidth * s)), oh = Math.max(1, Math.round(img.naturalHeight * s))
    const base = document.createElement('canvas'); base.width = ow; base.height = oh
    base.getContext('2d')!.drawImage(img, 0, 0, ow, oh)
    const matte = document.createElement('canvas'); matte.width = ow; matte.height = oh
    presegCache = { url, base, ow, oh, matte, alpha: document.createElement('canvas'), av: new ImageData(1, 1), aw: 0, ah: 0 }
  }
  const cache = presegCache
  const { ow, oh, matte } = cache
  const mctx = matte.getContext('2d')!
  mctx.clearRect(0, 0, ow, oh)
  mctx.drawImage(cache.base, 0, 0) // reset the scratch from the cached decode — no per-tap decode
  // model alpha at its own res (soft channel when the model provides one, binary otherwise) —
  // canvas bilinear upscale to full res is EXACTLY how ben.worker turns model-res alpha into the
  // soft full-res matte (never ctx.filter — a documented Safari no-op, composite.ts KAI-9147).
  if (cache.aw !== w || cache.ah !== h) { cache.alpha.width = w; cache.alpha.height = h; cache.av = new ImageData(w, h); cache.aw = w; cache.ah = h }
  const a = cache.alpha, av = cache.av
  const soft = mask.soft
  for (let i = 0; i < w * h; i++) av.data[i * 4 + 3] = soft ? soft[i] : (mask.data[i] ? 255 : 0)
  a.getContext('2d')!.putImageData(av, 0, 0)
  mctx.globalCompositeOperation = 'destination-in'
  mctx.drawImage(a, 0, 0, ow, oh)
  mctx.globalCompositeOperation = 'source-over'
  // ONE LAW for every source (Dan 2026-08-06 final): brushes define the OUTLINE only — the subject
  // is ALWAYS the outline's own matte, and the blend band is the OFFSET ring. No tool ever defines
  // a blend area; blur never depends on which tool drew the shape.
  const r = matteToMLResult(matte, EFFECT_BUILD_CONFIG.maxImageDim, texDim, 'brushed')
  return r
}

/** The lab's engine config = prepareShaped's, with ONE parameter changed through the engine's own
 *  cfg API: paddingMM 0 (Dan 2026-08-06 value-reflection: knob Offset 0 must mean a trace with NO
 *  built-in offset — the 1.5mm product padding hid an outset the knob didn't show; expansion is the
 *  Offset knob's job, reflected truthfully). */
const LAB_CFG = { ...EFFECT_BUILD_CONFIG, minFeatureMM: detailToFloorMm(100), paddingMM: 0, edgeFinishPx: 8 }
export const EDGE_FINISH_DEFAULT = LAB_CFG.edgeFinishPx

/** The engine's G4 progress states surfaced to the shell — a degraded cut must NEVER be silent:
 *  the flood-fill fallback has NO matte (its subject is the raw full image by engine design), so
 *  the user must know when it ran (the 'two layered images' signature, Dan 2026-08-06). */
export type PrepareProgress = 'downloading-model' | 'cutting' | 'fallback'

/** One post-segmentation path: detector identity stops mattering once an MLResult reaches here. */
function prepareCut(url: string, preseg: MLResult, edgeFinishPx: number, onProgress?: (s: PrepareProgress) => void, originalTexture = false): Promise<PreparedEffectBase> {
  const cfg = { ...LAB_CFG, edgeFinishPx }
  return prepareEffect(url, 'shaped', cfg, onProgress, finishMLResultEdges(preseg, edgeFinishPx), { buildOutputs: false, originalTexture })
}

/** Non-AI/brush mask → MLResult → the same edge/prepare path as native u2net. */
export async function prepareAI(url: string, mask: Mask, onProgress?: (s: PrepareProgress) => void, edgeFinishPx = EDGE_FINISH_DEFAULT, originalTexture = false): Promise<PreparedEffectBase> {
  return prepareCut(url, await buildPreseg(url, mask), edgeFinishPx, onProgress, originalTexture)
}

/** Native u2net MLResult → the same edge/prepare path as every other segmentation source. */
export function prepareNative(url: string, preseg: MLResult, onProgress?: (s: PrepareProgress) => void, edgeFinishPx = EDGE_FINISH_DEFAULT, originalTexture = false): Promise<PreparedEffectBase> {
  return prepareCut(url, preseg, edgeFinishPx, onProgress, originalTexture)
}

/** Knob resolution over the engine spec — v5.3.1's own generation-controls path, verbatim.
 *  `viewW` maps the result from the spec's mask space (the BRIDGE'S dims) into the lab canvas's
 *  space via the engine's own transformShape — the spec dims are the bridge's config and need not
 *  match the lab canvas (they diverged when the bridge took over segmentation, 2026-08-06). */
export function finishSpec(prepared: PreparedEffectBase, settings: TraceOutlineSettings, viewW?: number): FinishResult | null {
  const spec = prepared.spec
  const resolved = resolveTraceOutline(preparedOutlineInput(prepared), settings)
  if (!resolved) return null
  const k = viewW ? viewW / Math.max(1, spec.maskWidthPx) : 1
  const view = k === 1 ? resolved : transformShape(resolved, (p) => ({ x: p.x * k, y: p.y * k }))
  const bb = shapeBBox(view, 1)
  return { d: shapeToSVGPathD(view, 2), bounds: { minX: bb.minX, minY: bb.minY, maxX: bb.maxX, maxY: bb.maxY }, shape: view }
}

/** Engine-native sticker bake: the engine's OWN matted subject + original (frontSrc, y-up) through
 *  the one 2D artwork op at the outline's bounds. d/bounds live in mask space (y-down) and are
 *  mapped, Clamp-filled, clipped, and cropped in this necessary Cutout adapter. */
/** Thrown when a bake is superseded — the flow's scheduler swallows it (Cadence Law). */
export class BakeCancelled extends Error { constructor() { super('bake superseded') } }

export async function bakeStickerEngine(
  prepared: PreparedEffectBase, d: string, bounds: OutlineBounds, maskW: number, maskH: number, b: BlendSettings,
  cancelled?: () => boolean,
): Promise<{ canvas: HTMLCanvasElement }> {
  // COOPERATIVE CANCELLATION (contract Cadence Law): the token is checked between pipeline stages
  // (compose → flip → clip → crop); stages after a positive check are skipped
  // and canvas references drop with this frame, so the memory frees. True mid-draw abort does not
  // exist in the platform.
  const bail = () => { if (cancelled?.()) throw new BakeCancelled() }
  const { origCanvas, subjCanvas } = prepared.frontSrc
  const k = origCanvas.width / maskW
  // DEFAULT = NO COMPOSITING (Dan 2026-08-06): at blend 0 with no other effect, the artwork IS the
  // ORIGINAL image under the vector mask — no subject re-lay, no blur, no compositor call at all,
  // so no matte artifact can exist by construction. The engine op below engages ONLY when blend or
  // another blend-tab effect is switched on (the opt-in edge-case layer: decouple the object,
  // normalise/expand the background).
  const neutral = b.blend === 0
  // OFFSET PAST THE FRAME (Dan 2026-08-06): an outgrown outline still needs the Clamp underlay,
  // but the blend value stays explicit. Inside the frame at blend 0 nothing composites — the
  // original image under the vector mask.
  const outgrown = bounds.minX < 0 || bounds.minY < 0 || bounds.maxX > maskW || bounds.maxY > maskH
  // Blend never wakes implicitly: zero remains a truthful raw-cut default until the user moves it.
  // NO-MATTE GUARD (Dan's law: a full-image composite may not exist ANYWHERE): the flood-fill
  // fallback has no object layer — its 'subject' is the raw full image, which drawn sharp over the
  // blur COVERS it (blend looks dead) or creates duplicate full-frame content. With no matte, blend is forced
  // off and the subject overlay is skipped; the band fill still works for outgrown offsets.
  const matteless = prepared.spec.generator.adapter === 'alpha' || prepared.spec.generator.adapter === 'bg-flood'
  const blend = matteless ? 0 : b.blend
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
  // BLUR-FALLOFF PAD (Dan 16:43 'bottom transparency in preview'): the SVG blur at a canvas edge
  // bleeds into transparency; with the compose frame ending at the outline bbox, that falloff band
  // (≈3σ) reached INSIDE the outline — the semi-transparent ring. Pad the frame by 3σ so the
  // falloff lands in discarded margin, then crop back to the true frame.
  const blurPx = blendPercentToPixels(blend, origCanvas.width)
  const pad = Math.ceil(3 * blurPx) + 2
  bail() // → compose
  let composed
  try {
    composed = await composeEffectArtwork({
      originalCanvas: origCanvas,
      subjectCanvas: subjCanvas,
      outputBoundsPx: { minX: bUp.minX - pad, minY: bUp.minY - pad, maxX: bUp.maxX + pad, maxY: bUp.maxY + pad },
      blendPercent: blend,
      fillMode: 'clamp',
      cancelled,
    })
  } catch (error) {
    bail()
    throw error
  }
  const { canvas, frame } = composed
  bail() // → flip
  // flip the composed (padded) frame to y-down and clip with the outline (scaled into tex space)
  const fw = frame.width, fh = frame.height
  const ox = frame.originX, oy = frame.originY
  const flipped = document.createElement('canvas'); flipped.width = fw; flipped.height = fh
  const fctx = flipped.getContext('2d')!
  fctx.translate(0, fh); fctx.scale(1, -1)
  fctx.drawImage(canvas, 0, 0)
  const oyDown = texH - (oy + fh) // y-down origin of the padded frame in tex space
  bail() // → clip
  const clipped = document.createElement('canvas'); clipped.width = fw; clipped.height = fh
  const cctx = clipped.getContext('2d')!
  const path = new Path2D()
  path.addPath(new Path2D(d), new DOMMatrix().scale(k))
  cctx.translate(-ox, -oyDown)
  cctx.clip(path)
  cctx.drawImage(flipped, ox, oyDown)
  bail() // → crop
  // crop the pad away — the returned canvas must match the outline bounds the caller draws with
  const x0 = Math.floor(bUp.minX), y0u = Math.floor(bUp.minY)
  const w0 = Math.max(1, Math.ceil(bUp.maxX) - x0), h0 = Math.max(1, Math.ceil(bUp.maxY) - y0u)
  const oyDown0 = texH - (y0u + h0)
  const out = document.createElement('canvas'); out.width = w0; out.height = h0
  out.getContext('2d')!.drawImage(clipped, frame.originX - x0, oyDown - oyDown0, fw, fh)
  return { canvas: out }
}
