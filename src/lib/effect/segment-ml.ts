// ML segmentation adapter — BEN2-ONNX via transformers.js (Lane A / Kai)
// Per FINAL-SPEC: browser default = onnx-community/BEN2-ONNX (MIT) via transformers.js.
// REAL user images have NO alpha and often non-uniform backgrounds, so subject isolation needs
// an ML matting model — not alpha or flood-fill. This is the default path.
//
// §8.3: the heavy ML inference runs in a WEB WORKER (ben.worker.ts) so the main thread stays
// responsive (no 30–60s freeze). The worker returns the full-res RGBA matte; THIS module does the
// (cheap, DOM-bound) canvas rasterize/downscale + alpha→mask on the main thread. `segmentML`'s
// signature + `MLResult` shape are UNCHANGED, so `prepareEffect`'s cutout path is untouched.

import type { MaskResult } from './mask'
import { postProcessMask } from './mask'

/** ML result: low-res mask for the contour + a HIGH-RES texture buffer so the front isn't pixelated. */
export interface MLResult extends MaskResult {
  texImage: ImageData
  texMask: Uint8Array
  texW: number
  texH: number
}

// ─── BEN web worker (off-main-thread inference) ──────────────────────────────
// One worker per session (mirrors the old lazy-cached segmenter). The worker runs the transformers
// pipeline; we post a URL and get back the full-res RGBA matte (alpha = subject) via a Promise.

let benWorker: Worker | null = null
let reqSeq = 0
const pending = new Map<
  number,
  { resolve: (v: { data: Uint8ClampedArray; width: number; height: number }) => void; reject: (e: Error) => void }
>()

function getBenWorker(): Worker {
  if (!benWorker) {
    benWorker = new Worker(new URL('./ben.worker.ts', import.meta.url), { type: 'module' })
    benWorker.onmessage = (e: MessageEvent) => {
      const { id, ok, data, width, height, error } = e.data as {
        id: number; ok: boolean; data?: ArrayBuffer; width?: number; height?: number; error?: string
      }
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      if (ok && data) p.resolve({ data: new Uint8ClampedArray(data), width: width!, height: height! })
      else p.reject(new Error(error || 'BEN worker failed'))
    }
    benWorker.onerror = (e) => {
      const err = new Error(e.message || 'BEN worker error')
      for (const [, p] of pending) p.reject(err)
      pending.clear()
    }
  }
  return benWorker
}

/** Run BEN inference in the worker → full-res RGBA matte (alpha = subject). Main thread stays free. */
function runBenInWorker(url: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const id = ++reqSeq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getBenWorker().postMessage({ id, url })
  })
}

/** Full-res RGBA buffer (worker output) → a canvas, so rasterize() can downscale it. */
function rgbaToCanvas(data: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const img = ctx.createImageData(w, h) // correctly-typed ImageData; copy the worker's RGBA in
  img.data.set(data)
  ctx.putImageData(img, 0, 0)
  return c
}

/** Downscale the BEN2 RGBA output to `dim`, y-up, returning pixels + alpha mask. (unchanged) */
function rasterize(srcCanvas: HTMLCanvasElement, dim: number) {
  const sw = srcCanvas.width
  const sh = srcCanvas.height
  const scale = Math.min(1, dim / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  // y-up (row 0 = bottom) so geometry py → world +y is upright (consistent with mesh.ts UV)
  ctx.translate(0, h)
  ctx.scale(1, -1)
  ctx.drawImage(srcCanvas, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const m = new Uint8Array(w * h)
  for (let p = 0, i = 3; p < m.length; p++, i += 4) m[p] = img.data[i] > 128 ? 1 : 0
  return { img, m, w, h }
}

/**
 * Run BEN2 background removal (inference off-thread in ben.worker). Returns a LOW-res mask (for the
 * contour) and a HIGH-res texture buffer (for the front face) so the projected image stays sharp.
 */
export async function segmentML(url: string, maskDim = 512, texDim = 1600): Promise<MLResult> {
  const raw = await runBenInWorker(url) // BEN inference OFF the main thread (no UI freeze)
  const srcCanvas = rgbaToCanvas(raw.data, raw.width, raw.height)
  const lo = rasterize(srcCanvas, maskDim)
  const hi = rasterize(srcCanvas, texDim)
  const mask = postProcessMask(lo.m, lo.w, lo.h)
  return {
    mask, width: lo.w, height: lo.h, imageData: lo.img,
    texImage: hi.img, texMask: hi.m, texW: hi.w, texH: hi.h,
  }
}

export const ML_ADAPTER_ID = 'ben2-onnx'
