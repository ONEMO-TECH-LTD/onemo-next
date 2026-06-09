// ML segmentation adapter — BEN2-ONNX via transformers.js (Lane A / Kai)
// Per FINAL-SPEC: browser default = onnx-community/BEN2-ONNX (MIT) via transformers.js.
// REAL user images have NO alpha and often non-uniform backgrounds, so subject isolation needs
// an ML matting model — not alpha or flood-fill. This is the default path.
//
// transformers.js exposes a `background-removal` pipeline: segmenter([url]) → RawImage RGBA where
// alpha = the subject matte. We derive the binary mask from alpha and reuse the RGB for the texture.

import type { MaskResult } from './mask'
import { postProcessMask } from './mask'

const MODEL_ID = 'onnx-community/BEN2-ONNX'

// Lazy, cached. Dynamic import keeps transformers.js + onnxruntime-web out of SSR and the eager bundle.
let segmenterPromise: Promise<(input: string[]) => Promise<unknown>> | null = null

function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const mod = await import('@huggingface/transformers')
      mod.env.allowLocalModels = false // fetch weights from the HF hub
      // Per FINAL-SPEC runtime preference: webgpu → wasm. WebGPU is dramatically faster and
      // keeps the main thread far less blocked than wasm.
      let seg
      try {
        seg = await mod.pipeline('background-removal', MODEL_ID, { device: 'webgpu' })
      } catch {
        seg = await mod.pipeline('background-removal', MODEL_ID) // wasm fallback
      }
      return seg as unknown as (input: string[]) => Promise<unknown>
    })()
  }
  return segmenterPromise
}

interface RawImageLike {
  width: number
  height: number
  toCanvas: () => HTMLCanvasElement | OffscreenCanvas
}

/** ML result: low-res mask for the contour + a HIGH-RES texture buffer so the front isn't pixelated. */
export interface MLResult extends MaskResult {
  texImage: ImageData
  texMask: Uint8Array
  texW: number
  texH: number
}

/** Downscale the BEN2 RGBA output to `dim`, y-up, returning pixels + alpha mask. */
function rasterize(srcCanvas: HTMLCanvasElement | OffscreenCanvas, dim: number) {
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
  ctx.drawImage(srcCanvas as CanvasImageSource, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const m = new Uint8Array(w * h)
  for (let p = 0, i = 3; p < m.length; p++, i += 4) m[p] = img.data[i] > 128 ? 1 : 0
  return { img, m, w, h }
}

/**
 * Run BEN2 background removal. Returns a LOW-res mask (for the contour) and a HIGH-res texture
 * buffer (for the front face) so the projected image stays sharp on large objects.
 */
export async function segmentML(url: string, maskDim = 512, texDim = 1600): Promise<MLResult> {
  const segmenter = await getSegmenter()
  const result = (await segmenter([url])) as RawImageLike[] | RawImageLike
  const raw = (Array.isArray(result) ? result[0] : result) as RawImageLike
  if (!raw?.toCanvas) throw new Error('BEN2 returned no image')

  const srcCanvas = raw.toCanvas()
  const lo = rasterize(srcCanvas, maskDim)
  const hi = rasterize(srcCanvas, texDim)
  const mask = postProcessMask(lo.m, lo.w, lo.h)
  return {
    mask, width: lo.w, height: lo.h, imageData: lo.img,
    texImage: hi.img, texMask: hi.m, texW: hi.w, texH: hi.h,
  }
}

export const ML_ADAPTER_ID = 'ben2-onnx'
