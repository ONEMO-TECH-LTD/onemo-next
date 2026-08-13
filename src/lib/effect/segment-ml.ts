// ML segmentation adapter — main-thread wrapper over the cut-out worker (ben.worker.ts · G5).
// Production = self-hosted u2netp -> lazy Silueta -> visible caller-owned flood-fill, WASM EP.
//
// The heavy ML inference runs in a WEB WORKER (ben.worker.ts) so the main thread stays responsive.
// The worker returns the full-res RGBA matte; THIS module does the (cheap, DOM-bound) canvas
// rasterize/downscale + alpha→mask on the main thread.
//
// G5 hardening:
//  • WATCHDOG (TD-E): a hung model never used to reject — the promise just sat forever. A 120 s
//    timer now terminates the worker and rejects loudly instead of leaving an eternal shimmer.
//  • PROGRESS: the worker's 'downloading-model' / 'cutting' states are forwarded to the caller so
//    the shimmer can say what the wait actually is.

import type { MaskResult } from './mask'
import { featherMask, postProcessMask } from './mask'

/** ML result: low-res mask for the contour + a HIGH-RES texture buffer so the front isn't pixelated. */
export interface MLResult extends MaskResult {
  texImage: ImageData
  texMask: Uint8Array
  texW: number
  texH: number
  /** The model that actually produced this cut, reported by the worker. */
  adapterId: string
}

export type SegmentProgress = 'downloading-model' | 'cutting'

/** TD-E: inference watchdog — a hung worker/model rejects instead of hanging the journey forever. */
const INFERENCE_WATCHDOG_MS = 120_000 // mobile CPU is slower than desktop — give heavy models room before declaring a hang

// ─── Cut-out web worker (off-main-thread inference) ───────────────────────────
// One worker per mounted owner. It keeps the production ORT sessions warm until owner disposal.

let segmentWorker: Worker | null = null
let reqSeq = 0
const pending = new Map<
  number,
  {
    resolve: (v: { data: Uint8ClampedArray; width: number; height: number; adapter: string }) => void
    reject: (e: Error) => void
    onProgress?: (s: SegmentProgress) => void
    watchdog: ReturnType<typeof setTimeout>
  }
>()

function settle(id: number) {
  const p = pending.get(id)
  if (p) { clearTimeout(p.watchdog); pending.delete(id) }
  return p
}

function resetSegmentWorker(error: Error, worker = segmentWorker): void {
  if (worker !== segmentWorker) return
  segmentWorker = null
  worker?.terminate()
  for (const [id] of pending) settle(id)?.reject(error)
}

function getSegmentWorker(): Worker {
  if (!segmentWorker) {
    const worker = new Worker(new URL('./ben.worker.ts', import.meta.url), { type: 'module' })
    segmentWorker = worker
    worker.onmessage = (e: MessageEvent) => {
      const { id, ok, data, width, height, error, progress, adapter } = e.data as {
        id: number; ok?: boolean; data?: ArrayBuffer; width?: number; height?: number; error?: string
        progress?: SegmentProgress; adapter?: string
      }
      if (progress) { pending.get(id)?.onProgress?.(progress); return } // interim state, not a settle
      const p = settle(id)
      if (!p) return
      if (ok && data && adapter) p.resolve({ data: new Uint8ClampedArray(data), width: width!, height: height!, adapter })
      else if (ok && data) p.reject(new Error('Cut-out worker omitted its adapter identity'))
      else p.reject(new Error(error || 'Cut-out worker failed'))
    }
    worker.onerror = (e) => resetSegmentWorker(new Error(e.message || 'Cut-out worker error'), worker)
    worker.onmessageerror = () => resetSegmentWorker(new Error('Cut-out worker message failed'), worker)
  }
  return segmentWorker
}

/** Run inference in the worker → full-res RGBA matte (alpha = subject). Main thread stays free. */
function runInWorker(
  url: string,
  onProgress?: (s: SegmentProgress) => void,
): Promise<{ data: Uint8ClampedArray; width: number; height: number; adapter: string }> {
  const id = ++reqSeq
  return new Promise((resolve, reject) => {
    const watchdog = setTimeout(() => {
      if (!pending.has(id)) return
      resetSegmentWorker(new Error(`Magic timed out after ${INFERENCE_WATCHDOG_MS / 1000}s — the cut-out model never responded`))
    }, INFERENCE_WATCHDOG_MS)
    pending.set(id, { resolve, reject, onProgress, watchdog })
    try {
      const worker = getSegmentWorker()
      worker.postMessage({ id, url })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      if (segmentWorker) resetSegmentWorker(err)
      else settle(id)?.reject(err)
    }
  })
}

export class SegmentMLCancelled extends Error {
  constructor() {
    super('Cut-out cancelled')
    this.name = 'SegmentMLCancelled'
  }
}

/** Cancel active inference without discarding an idle warm worker. */
export function cancelSegmentML(): void {
  if (pending.size) resetSegmentWorker(new SegmentMLCancelled())
}

/** End the mounted owner's worker lifetime and release its warm sessions. */
export function disposeSegmentML(): void {
  if (segmentWorker || pending.size) resetSegmentWorker(new SegmentMLCancelled())
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

/** Downscale the worker RGBA output to `dim`, y-up, returning pixels + alpha mask. */
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
 * Run background removal (inference off-thread in ben.worker). Returns a LOW-res mask (for the
 * contour) and a HIGH-res texture buffer (for the front face) so the projected image stays sharp.
 * `onProgress` surfaces the worker's honest wait states (G5).
 */
export async function segmentML(
  url: string,
  maskDim = 512,
  texDim = 1600,
  onProgress?: (s: SegmentProgress) => void,
): Promise<MLResult> {
  const raw = await runInWorker(url, onProgress)
  const srcCanvas = rgbaToCanvas(raw.data, raw.width, raw.height)
  return matteToMLResult(srcCanvas, maskDim, texDim, raw.adapter)
}

/** Full-res RGBA matte canvas (alpha = subject) → the shared MLResult contract. */
export function matteToMLResult(matte: HTMLCanvasElement, maskDim: number, texDim: number, adapterId: string): MLResult {
  const lo = rasterize(matte, maskDim)
  const hi = rasterize(matte, texDim)
  const mask = postProcessMask(lo.m, lo.w, lo.h)
  return {
    mask, width: lo.w, height: lo.h, imageData: lo.img,
    texImage: hi.img, texMask: hi.m, texW: hi.w, texH: hi.h,
    adapterId,
  }
}

/**
 * Apply the one shared Cutout edge finish to an already-produced segmentation result. AI and
 * non-AI sources enter here only after they have the same MLResult contract, so downstream
 * preparation cannot diverge by detector. The raw binary masks remain untouched; only the
 * continuous subject alpha used by composition is feathered.
 */
export function finishMLResultEdges(result: MLResult, radiusPx: number): MLResult {
  const radius = Math.max(0, Math.round(radiusPx))
  if (radius === 0) return result
  const alpha = new Uint8Array(result.texW * result.texH)
  for (let i = 0; i < alpha.length; i++) alpha[i] = result.texImage.data[i * 4 + 3]
  const maskMax = Math.max(result.width, result.height, 1)
  const texRadius = Math.max(1, Math.round(radius * Math.max(result.texW, result.texH) / maskMax))
  const finishedAlpha = featherMask(alpha, result.texW, result.texH, texRadius)
  const texImage = new ImageData(new Uint8ClampedArray(result.texImage.data), result.texW, result.texH)
  for (let i = 0; i < finishedAlpha.length; i++) texImage.data[i * 4 + 3] = finishedAlpha[i]
  return { ...result, texImage }
}
