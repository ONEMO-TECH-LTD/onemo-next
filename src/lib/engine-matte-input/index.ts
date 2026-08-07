// paint-driver — the painted-mask→engine seam, compiled as an add-on for the PAINT increment
// (Dan 2026-08-07: paint shape + eraser "must be absolutely same" as working v1). Extracted
// verbatim-in-behavior from v1 finish.ts (buildPreseg / prepareAI / finishDrawn). The v5.3.1
// bridge genuinely lacks this seam — it only consumes its own segmentML preseg; this module lets
// a PAINTED mask enter the engine's shaped pipeline as a standard cut. Depends on the engine
// seam matteToMLResult (segment-ml — the engine's own extracted tail; same add-on branch).
// Nothing SAM/wand-era. The engine performs ALL work (prepareEffect, resolveTraceOutline).

import type { Mask } from '@/lib/tool-paint-math/types'
import { effectiveTextureDim } from '@/lib/effect/mask'
import { matteToMLResult, type MLResult } from '@/lib/effect/segment-ml'
import { prepareEffect, EFFECT_BUILD_CONFIG, type PreparedEffect } from '@/lib/effect/prepare-effect'
import { shapeBBox, shapeToSVGPathD, type VShape } from '@/lib/vector-core'
import {
  detailToFloorMm, resolveTraceOutline, type TraceOutlineSettings,
} from '@/app/(dev)/effect-creator/v5.3.1/user/editor/producers'

export type { TraceOutlineSettings }
export interface OutlineBounds { minX: number; minY: number; maxX: number; maxY: number }
export interface FinishResult { d: string; bounds: OutlineBounds; shape: VShape }

/** The lab's engine config = the engine's own, with paddingMM 0 (value-reflection: Offset 0 = no
 *  built-in outset) and the detail floor at full fidelity. Through the engine's own cfg API. */
export const PAINT_LAB_CFG = { ...EFFECT_BUILD_CONFIG, minFeatureMM: detailToFloorMm(100), paddingMM: 0 }

/** Engine G4 progress states — a degraded cut must NEVER be silent. */
export type PrepareProgress = 'downloading-model' | 'cutting' | 'fallback'

// EMPTY-STOMACH CACHE (§I2b law 4): the decoded original at the texture cap + scratch canvases are
// built ONCE per upload (keyed on the object URL) and REUSED every tap — never re-decoded.
let presegCache: {
  url: string; base: HTMLCanvasElement; ow: number; oh: number
  matte: HTMLCanvasElement; alpha: HTMLCanvasElement; av: ImageData; aw: number; ah: number
} | null = null

/** Painted mask (+soft alpha) → the SAME cutout format the engine's worker renders: original RGB
 *  at the working cap, mask alpha canvas-upscaled onto it (bilinear — exactly how ben.worker turns
 *  model-res alpha into the soft full-res matte), then the engine's own shared tail. */
export async function buildPreseg(url: string, mask: Mask): Promise<MLResult> {
  const { w, h } = mask
  const texDim = effectiveTextureDim()
  if (presegCache?.url !== url) {
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
  if (cache.aw !== w || cache.ah !== h) { cache.alpha.width = w; cache.alpha.height = h; cache.av = new ImageData(w, h); cache.aw = w; cache.ah = h }
  const a = cache.alpha, av = cache.av
  const soft = mask.soft
  for (let i = 0; i < w * h; i++) av.data[i * 4 + 3] = soft ? soft[i] : (mask.data[i] ? 255 : 0)
  a.getContext('2d')!.putImageData(av, 0, 0)
  mctx.globalCompositeOperation = 'destination-in'
  mctx.drawImage(a, 0, 0, ow, oh)
  mctx.globalCompositeOperation = 'source-over'
  // ONE LAW for every source (Dan 2026-08-06): brushes define the OUTLINE only — the subject is
  // ALWAYS the outline's own matte; the blend band is the OFFSET ring.
  return matteToMLResult(matte, EFFECT_BUILD_CONFIG.maxImageDim, texDim, 'brushed')
}

/** Painted mask in → the WHOLE v5.3.1 shaped pipeline out (engine performs everything). */
export async function prepareAI(url: string, mask: Mask, onProgress?: (s: PrepareProgress) => void): Promise<PreparedEffect> {
  return prepareEffect(url, 'shaped', PAINT_LAB_CFG, onProgress, await buildPreseg(url, mask))
}

/** A drawn (already-vector) shape through the SAME v5.3.1 resolver the AI trace uses — every knob
 *  + reversibility apply identically. `ring` = the raw resampled stroke (provenance). */
export function finishDrawn(
  shape: VShape, ring: { x: number; y: number }[], w: number, h: number,
  settings: TraceOutlineSettings, mmBase = 70,
): FinishResult | null {
  const resolved = resolveTraceOutline(
    {
      vectorShape: shape,
      rawTracePx: ring.map((p) => [p.x, h - p.y] as [number, number]), // producers expects y-up
      maskWidthPx: w,
      maskHeightPx: h,
      mmPerPx: mmBase / Math.max(w, h),
    },
    settings,
  )
  if (!resolved) return null
  const bb = shapeBBox(resolved, 1)
  return { d: shapeToSVGPathD(resolved, 2), bounds: { minX: bb.minX, minY: bb.minY, maxX: bb.maxX, maxY: bb.maxY }, shape: resolved }
}
