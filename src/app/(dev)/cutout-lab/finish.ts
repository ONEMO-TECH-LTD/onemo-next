// cutout-lab — finishing glue. PURE COMPOSITION of v5.3.1 engine calls (no own geometry math,
// ARCHITECTURE.md law 1): AI mask → v5.3.1 mask hygiene → trace → outline-resolve → SVG path.
// Plus the two canvas render helpers the shell draws with (kept out of the React component, law 3).

import { CHIP_RANGE } from './ui-config'
import { perfGesture } from '@/app/(dev)/effect-creator/v5.3.1/dev/PerfHUD'
import type { Mask } from '@/lib/mask-tools/types'
import { effectiveTextureDim, smoothMask } from '@/lib/effect/mask'
import { matteToMLResult } from '@/lib/effect/segment-ml'
import { blendPercentToPixels, composeEffectArtwork, presetFilter, type ArtworkFillMode, type PresetKey } from '@/lib/effect/composite'
import { flattenShape, ringToVPath, shapeBBox, shapeToSVGPathD, transformShape, type VShape } from '@/lib/vector-core'
import { resampleClosedUniform, type Vec2Px } from '@/lib/outline-core'
import {
  detailToFloorMm,
  resolveTraceOutline,
  TRACE_OUTLINE_DEFAULTS,
  type TraceOutlineSettings,
} from '@/app/(dev)/effect-creator/v5.3.1/user/editor/producers'
import { prepareEffect, EFFECT_BUILD_CONFIG } from '@/lib/effect/prepare-effect'
import { GLOBAL_OFF, mintIds, resolve } from '@/lib/effect/outline-resolve'
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
export const BLEND_DEFAULTS: BlendSettings = { blend: 0, fill: 'clamp', preset: 'none', vignette: 0, tint: null, scale: 100, panX: 0, panY: 0 } // Dan 2026-08-07: DEFAULT blend 0 — raw cutout, no pillow. blend>0 is the opt-in composite; fill CLAMP; mirror the opt-in corrected mosaic.



// ── drawn shapes (paint hand tool) — same finishing, same knobs, no AI ──

/** A drawn (already-vector) shape through the SAME v5.3.1 resolver the AI trace uses — the drawn
 *  shape is a first-class OutlineSource: every knob + reversibility
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
/** Mirror mosaic materialized over ONLY the composed region (I2 contract: allocation O(region),
 *  never the full 3w×3h). Same per-axis flip pattern as the full mosaic, drawn shifted by the
 *  region origin — pixel-identical to the full-mosaic canvas over [rx0, ry0)+(W, H). */
function mirrorMosaicRegion(src: HTMLCanvasElement, rx0: number, ry0: number, W: number, H: number): HTMLCanvasElement {
  const w = src.width, h = src.height
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) {
    // tile box in mosaic space: [tx·w, ty·h) — skip tiles that miss the region entirely
    if (tx * w >= rx0 + W || (tx + 1) * w <= rx0 || ty * h >= ry0 + H || (ty + 1) * h <= ry0) continue
    ctx.save()
    const fx = tx === 1 ? 1 : -1, fy = ty === 1 ? 1 : -1
    ctx.translate(tx * w + (fx === -1 ? w : 0) - rx0, ty * h + (fy === -1 ? h : 0) - ry0)
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
// EMPTY-STOMACH CACHE (§I2b law 4): the decoded original at the texture cap + the scratch
// canvases are built ONCE per upload (keyed on the object URL; a new upload = new URL = new key)
// and REUSED every tap — never re-decoded, never re-allocated. Clear keeps the URL → cache holds.
let presegCache: {
  url: string; base: HTMLCanvasElement; ow: number; oh: number
  matte: HTMLCanvasElement; alpha: HTMLCanvasElement; av: ImageData; aw: number; ah: number
} | null = null

export async function buildPreseg(url: string, mask: Mask): Promise<MLResult> {
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
  const tA = performance.now()
  for (let i = 0; i < w * h; i++) av.data[i * 4 + 3] = soft ? soft[i] : (mask.data[i] ? 255 : 0)
  a.getContext('2d')!.putImageData(av, 0, 0)
  mctx.globalCompositeOperation = 'destination-in'
  mctx.drawImage(a, 0, 0, ow, oh)
  mctx.globalCompositeOperation = 'source-over'
  perfGesture('preseg-matte', performance.now() - tA)
  // ONE LAW for every source (Dan 2026-08-06 final): brushes define the OUTLINE only — the subject
  // is ALWAYS the outline's own matte, and the blend band is the OFFSET ring. No tool ever defines
  // a blend area; blur never depends on which tool drew the shape.
  const tB = performance.now()
  const r = matteToMLResult(matte, EFFECT_BUILD_CONFIG.maxImageDim, texDim, 'brushed') // brush/paint masks are binary (soft matte died with EdgeSAM)
  perfGesture('preseg-mlresult', performance.now() - tB)
  return r
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

/** The TRUE v5.3.1 bridge: an UNTOUCHED segmentML MLResult straight into the shaped pipeline —
 *  exactly what the v5.3.1 flow does. u2net's matte is verbatim (Dan 2026-08-07: no speculative
 *  fixes on the pure u2net path — they become bugs; the EdgeSAM-era hole guard is deleted with it). */
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
/** Thrown when a bake is superseded — the flow's scheduler swallows it (Cadence Law). */
export class BakeCancelled extends Error { constructor() { super('bake superseded') } }

export async function bakeStickerEngine(
  prepared: PreparedEffect, d: string, bounds: OutlineBounds, maskW: number, maskH: number, b: BlendSettings,
  cancelled?: () => boolean,
): Promise<{ canvas: HTMLCanvasElement }> {
  // COOPERATIVE CANCELLATION (contract Cadence Law): the token is checked between pipeline stages
  // (transform → mosaic → compose → flip → clip → crop); stages after a positive check are skipped
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
  bail() // → transform
  const art = transformArtwork(origCanvas, { ...b, panY: -b.panY }) // y-up: pan direction flips
  const subj = transformArtwork(subjCanvas, { ...b, panY: -b.panY })
  const mirror = b.fill === 'mirror'
  const sx = mirror ? origCanvas.width : 0, sy = mirror ? texH : 0
  let original = art, subject = subj
  // BLUR-FALLOFF PAD (Dan 16:43 'bottom transparency in preview'): the SVG blur at a canvas edge
  // bleeds into transparency; with the compose frame ending at the outline bbox, that falloff band
  // (≈3σ) reached INSIDE the outline — the semi-transparent ring. Pad the frame by 3σ so the
  // falloff lands in discarded margin, then crop back to the true frame.
  // TARGET physical blur px — identical to the historical full-mosaic math (blend/3 on width 3w):
  // the compose op derives blur from ITS source width, so the region-cropped canvas needs the
  // percentage re-expressed for its own width to keep the physical blur byte-equal (I2 hash gate).
  const blurPx = blendPercentToPixels(mirror ? b.blend / 3 : b.blend, mirror ? art.width * 3 : art.width)
  const pad = Math.ceil(3 * blurPx) + 2
  // region origin in mosaic space (mirror only) — INTEGER so the materialized pixels align exactly.
  // The region carries ONE EXTRA blur margin beyond the compose frame: the SVG blur samples the
  // SOURCE canvas, so frame-edge pixels need real mosaic content within kernel reach — beyond
  // ~6σ total the Gaussian tail is below 8-bit quantization (the pixel-identity gate).
  const margin = pad
  const rx0 = mirror ? Math.max(0, Math.floor(bUp.minX + sx - pad) - margin) : 0
  const ry0 = mirror ? Math.max(0, Math.floor(bUp.minY + sy - pad) - margin) : 0
  let blendEff = b.blend
  bail() // → mosaic
  if (mirror) {
    // O(region) materialization (I2): the mosaic exists only over the composed region + pad
    const W = Math.min(art.width * 3, Math.ceil(bUp.maxX + sx + pad) + margin) - rx0
    const H = Math.min(art.height * 3, Math.ceil(bUp.maxY + sy + pad) + margin) - ry0
    original = mirrorMosaicRegion(art, rx0, ry0, W, H)
    const small = document.createElement('canvas'); small.width = W; small.height = H
    small.getContext('2d')!.drawImage(subj, sx - rx0, sy - ry0)
    subject = small
    blendEff = W > 0 ? (b.blend / 3) * (art.width * 3) / W : 0 // same blur px on the region width
  }
  bail() // → compose
  const { canvas, frame } = await composeEffectArtwork({
    originalCanvas: original,
    subjectCanvas: subject,
    outputBoundsPx: { minX: bUp.minX + sx - pad - rx0, minY: bUp.minY + sy - pad - ry0, maxX: bUp.maxX + sx + pad - rx0, maxY: bUp.maxY + sy + pad - ry0 },
    blendPercent: blendEff,
    fillMode: mirror ? 'clamp' : (b.fill as ArtworkFillMode),
    fxFilter: presetFilter(b.preset),
    vignette: b.vignette / 100,
    tint: b.tint,
  })
  bail() // → flip
  // flip the composed (padded) frame to y-down and clip with the outline (scaled into tex space)
  const fw = frame.width, fh = frame.height
  const ox = frame.originX + rx0 - sx, oy = frame.originY + ry0 - sy // y-up tex-space origin (region → mosaic → tex)
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
  const x0 = Math.floor(bUp.minX + sx), y0u = Math.floor(bUp.minY + sy)
  const w0 = Math.max(1, Math.ceil(bUp.maxX + sx) - x0), h0 = Math.max(1, Math.ceil(bUp.maxY + sy) - y0u)
  const oyDown0 = texH - ((y0u - sy) + h0)
  const out = document.createElement('canvas'); out.width = w0; out.height = h0
  out.getContext('2d')!.drawImage(clipped, (frame.originX + rx0 - x0), (oyDown - oyDown0), fw, fh) // originX is REGION-space post-I2 — shift back to mosaic space
  return { canvas: out }
}
