// cutout-lab — finishing glue. PURE COMPOSITION of v5.3.1 engine calls (no own geometry math,
// ARCHITECTURE.md law 1): AI mask → v5.3.1 mask hygiene → trace → outline-resolve → SVG path.
// Plus the two canvas render helpers the shell draws with (kept out of the React component, law 3).

import type { Mask } from '@/lib/cutout-ai/types'
import { dilateMask, effectiveTextureDim, smoothMask } from '@/lib/effect/mask'
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

/** EDIT-GRADE SKELETON: the engine's fitter reduces any resolved outline to sparse anchors with
 *  curve handles (corners >60° pinned as corner anchors) — visually identical, node count suitable
 *  for finger editing (Dan 2026-08-06: raw traces are uneditable on mobile). */
export function editableShape(shape: VShape): VShape {
  const flat = (flattenShape(shape, 0.5)[0] ?? []).map((q) => [q.x, q.y] as Vec2Px)
  if (flat.length < 3) return shape
  let perim = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < flat.length; i++) {
    const a = flat[i], b = flat[(i + 1) % flat.length]
    perim += Math.hypot(b[0] - a[0], b[1] - a[1])
    if (a[0] < minX) minX = a[0]; if (a[0] > maxX) maxX = a[0]
    if (a[1] < minY) minY = a[1]; if (a[1] > maxY) maxY = a[1]
  }
  const dense = resampleClosedUniform(flat, Math.max(2, perim / 500)).map(([x, y]) => ({ x, y }))
  const tol = Math.max(2, Math.min(maxX - minX, maxY - minY) * 0.01)
  const fitted = ringToVPath(dense, 60, tol)
  return fitted.anchors.length >= 3 ? { paths: [fitted] } : shape
}

/** PER-NODE vector edit through the ENGINE's local-adjustment machinery (outline-resolve
 *  LocalAdjustment: radius = single-corner fillet px, curve = tangent bend factor 0..2). The base
 *  shape stays immutable; each call re-resolves from it — reversible, value-true. */
export function nodeAdjust(base: VShape, pi: number, ai: number, adj: { radius?: number; curve?: number }): VShape {
  // SET-to-value semantics (Dan): sharpen the anchor first (corner, no handles), then apply the
  // engine's local fillet/bend — so radius 0 = a SHARP node, and every knob value is absolute,
  // not stacked on the current rounding.
  const sharpened: VShape = {
    paths: base.paths.map((path, i) => i !== pi ? path : ({
      anchors: path.anchors.map((a, j) => j !== ai ? a : ({ ...a, hIn: null, hOut: null, corner: true })),
    })),
  }
  const withIds = mintIds(sharpened)
  const id = withIds.paths[pi]?.anchors[ai]?.id
  if (!id) return base
  if (!adj.radius && !adj.curve) return withIds // radius/curve 0 = the sharpened node
  return resolve(
    { shape: withIds, klass: 'generated', mmPerPx: 1, maskHeightPx: 1 },
    { global: { ...GLOBAL_OFF }, local: { [id]: adj } },
  )
}

/** TRUE current values for a node (value reflection by MEASUREMENT): curvature radius from the
 *  circumcircle of (hIn, p, hOut); curve factor from handle length vs the engine's 0.33·edge base. */
export function measureNode(shape: VShape, pi: number, ai: number): { radius: number; curve: number } {
  const path = shape.paths[pi]
  const a = path?.anchors[ai]
  if (!a || (!a.hIn && !a.hOut)) return { radius: 0, curve: 0 }
  const n = path.anchors.length
  const prev = path.anchors[(ai - 1 + n) % n].p, next = path.anchors[(ai + 1) % n].p
  const eMin = Math.min(Math.hypot(a.p.x - prev.x, a.p.y - prev.y), Math.hypot(next.x - a.p.x, next.y - a.p.y)) || 1
  const hLen = Math.max(a.hIn ? Math.hypot(a.hIn.x - a.p.x, a.hIn.y - a.p.y) : 0, a.hOut ? Math.hypot(a.hOut.x - a.p.x, a.hOut.y - a.p.y) : 0)
  const curve = Math.round(Math.min(2, hLen / (0.33 * eMin)) * 100)
  // local curvature radius AT the anchor: circumcircle of on-curve neighbours sampled just before
  // and after the node (handles are collinear on smooth anchors, so they can't be used directly)
  let radius = 0
  if (a.hIn && a.hOut) {
    const bez = (p0: {x:number;y:number}, c1: {x:number;y:number}, c2: {x:number;y:number}, p3: {x:number;y:number}, t: number) => {
      const u = 1 - t
      return { x: u*u*u*p0.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*p3.x, y: u*u*u*p0.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*p3.y }
    }
    const pv = path.anchors[(ai - 1 + n) % n], nx2 = path.anchors[(ai + 1) % n]
    const A = bez(pv.p, pv.hOut ?? pv.p, a.hIn, a.p, 0.85)
    const B = a.p
    const C = bez(a.p, a.hOut, nx2.hIn ?? nx2.p, nx2.p, 0.15)
    const ab = Math.hypot(B.x - A.x, B.y - A.y), bc = Math.hypot(C.x - B.x, C.y - B.y), ca = Math.hypot(A.x - C.x, A.y - C.y)
    const area2 = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y))
    radius = area2 > 1e-6 ? Math.round((ab * bc * ca) / (2 * area2)) : 0
  }
  return { radius: Math.min(200, radius), curve: Math.min(200, curve) } // clamped to the knob scale
}

/** Flattened ring of a shape (vector-core op kept OUT of the UI — module boundary). */
/** Insert an anchor ON the outline nearest (x,y) — exact bezier split (de Casteljau), so the
 *  curve is unchanged by insertion. Returns null when the tap is farther than `tol` from the line. */
export function insertNode(shape: VShape, x: number, y: number, tol: number): { shape: VShape; pi: number; ai: number } | null {
  type Hit = { pi: number; ai: number; t: number; d: number }
  let best = null as Hit | null
  shape.paths.forEach((path, pi) => {
    const n = path.anchors.length
    for (let ai = 0; ai < n; ai++) {
      const a = path.anchors[ai], b = path.anchors[(ai + 1) % n]
      const p0 = a.p, c1 = a.hOut ?? a.p, c2 = b.hIn ?? b.p, p3 = b.p
      for (let k = 1; k < 32; k++) {
        const t = k / 32, u = 1 - t
        const px = u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x
        const py = u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y
        const d = Math.hypot(px - x, py - y)
        if (!best || d < best.d) best = { pi, ai, t, d }
      }
    }
  })
  if (!best || best.d > tol) return null
  const { pi, ai, t } = best
  const path = shape.paths[pi], n = path.anchors.length
  const a = path.anchors[ai], b = path.anchors[(ai + 1) % n]
  const p0 = a.p, c1 = a.hOut ?? a.p, c2 = b.hIn ?? b.p, p3 = b.p
  const lerp = (u: { x: number; y: number }, v: { x: number; y: number }) => ({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t })
  const q0 = lerp(p0, c1), q1 = lerp(c1, c2), q2 = lerp(c2, p3)
  const r0 = lerp(q0, q1), r1 = lerp(q1, q2), pt = lerp(r0, r1)
  const anchors = path.anchors.map((an, j) => {
    if (j === ai) return { ...an, hOut: an.hOut ? q0 : null }
    if (j === (ai + 1) % n) return { ...an, hIn: an.hIn ? q2 : null }
    return an
  })
  const inserted = { p: pt, hIn: a.hOut || b.hIn ? r0 : null, hOut: a.hOut || b.hIn ? r1 : null, corner: !(a.hOut || b.hIn) }
  anchors.splice(ai + 1, 0, inserted)
  return { shape: { paths: shape.paths.map((pp, j) => j === pi ? { anchors } : pp) }, pi, ai: ai + 1 }
}

/** Delete an anchor (min 3 must remain — a shape needs area). Neighbors keep their handles. */
export function deleteNode(shape: VShape, pi: number, ai: number): VShape | null {
  const path = shape.paths[pi]
  if (!path || path.anchors.length <= 3) return null
  return { paths: shape.paths.map((pp, j) => j === pi ? { anchors: pp.anchors.filter((_, k) => k !== ai) } : pp) }
}

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
  // ONE LAW for every source (Dan 2026-08-06 final): brushes define the OUTLINE only — the subject
  // is ALWAYS the outline's own matte, and the blend band is the OFFSET ring. No tool ever defines
  // a blend area; blur never depends on which tool drew the shape.
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
  // BLUR-FALLOFF PAD (Dan 16:43 'bottom transparency in preview'): the SVG blur at a canvas edge
  // bleeds into transparency; with the compose frame ending at the outline bbox, that falloff band
  // (≈3σ) reached INSIDE the outline — the semi-transparent ring. Pad the frame by 3σ so the
  // falloff lands in discarded margin, then crop back to the true frame.
  const blendEff = mirror ? b.blend / 3 : b.blend // mosaic is 3x wide — keep the blur physically equal
  const pad = Math.ceil(3 * blendPercentToPixels(blendEff, original.width)) + 2
  const { canvas, frame } = await composeEffectArtwork({
    originalCanvas: original,
    subjectCanvas: subject,
    outputBoundsPx: { minX: bUp.minX + sx - pad, minY: bUp.minY + sy - pad, maxX: bUp.maxX + sx + pad, maxY: bUp.maxY + sy + pad },
    blendPercent: blendEff,
    fillMode: mirror ? 'clamp' : (b.fill as ArtworkFillMode),
    fxFilter: presetFilter(b.preset),
    vignette: b.vignette / 100,
    tint: b.tint,
  })
  // flip the composed (padded) frame to y-down and clip with the outline (scaled into tex space)
  const fw = frame.width, fh = frame.height
  const ox = frame.originX - sx, oy = frame.originY - sy // y-up tex-space origin
  const flipped = document.createElement('canvas'); flipped.width = fw; flipped.height = fh
  const fctx = flipped.getContext('2d')!
  fctx.translate(0, fh); fctx.scale(1, -1)
  fctx.drawImage(canvas, 0, 0)
  const oyDown = texH - (oy + fh) // y-down origin of the padded frame in tex space
  const clipped = document.createElement('canvas'); clipped.width = fw; clipped.height = fh
  const cctx = clipped.getContext('2d')!
  const path = new Path2D()
  path.addPath(new Path2D(d), new DOMMatrix().scale(k))
  cctx.translate(-ox, -oyDown)
  cctx.clip(path)
  cctx.drawImage(flipped, ox, oyDown)
  // crop the pad away — the returned canvas must match the outline bounds the caller draws with
  const x0 = Math.floor(bUp.minX + sx), y0u = Math.floor(bUp.minY + sy)
  const w0 = Math.max(1, Math.ceil(bUp.maxX + sx) - x0), h0 = Math.max(1, Math.ceil(bUp.maxY + sy) - y0u)
  const oyDown0 = texH - ((y0u - sy) + h0)
  const out = document.createElement('canvas'); out.width = w0; out.height = h0
  out.getContext('2d')!.drawImage(clipped, (frame.originX - x0), (oyDown - oyDown0), fw, fh)
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
