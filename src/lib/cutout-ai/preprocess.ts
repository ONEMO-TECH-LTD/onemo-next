// cutout-ai — pure tensor builders (ARCHITECTURE.md). Plain { data, dims } out; no runtime imports.
// Verified inference math from the s62 probe, kept exactly; everything else from the probe is gone.

export interface TensorData {
  data: Float32Array
  dims: number[]
}

// SAM preprocess constants come from THE engine roster spec (ben-chain SAM.edgesam) — one source.
import { SAM, samSoftProb } from '@/lib/effect/ben-chain'
const SAM_MEAN = SAM.edgesam.mean
const SAM_STD = SAM.edgesam.std
const SAM_SIZE = SAM.edgesam.size

/**
 * SAM CHW input (EdgeSAM): aspect-preserving resize (longest side → 1024), zero-pad, normalize.
 * Returns `scale` (original→resized) so prompt coords map into the 1024 space.
 */
export function samCHW(rgba: Uint8ClampedArray, w: number, h: number): TensorData & { scale: number } {
  const T = SAM_SIZE, scale = T / Math.max(w, h), nw = Math.round(w * scale), nh = Math.round(h * scale)
  const plane = T * T, data = new Float32Array(3 * plane) // zeros = padding
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(h - 1, (y / scale) | 0)
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(w - 1, (x / scale) | 0), si = (sy * w + sx) * 4, di = y * T + x
      data[di] = (rgba[si] - SAM_MEAN[0]) / SAM_STD[0]
      data[plane + di] = (rgba[si + 1] - SAM_MEAN[1]) / SAM_STD[1]
      data[2 * plane + di] = (rgba[si + 2] - SAM_MEAN[2]) / SAM_STD[2]
    }
  }
  return { data, dims: [1, 3, T, T], scale }
}

/**
 * Threshold a logit map (mh×mw) to a binary mask at (w×h), nearest-neighbour upscaled.
 * `fx`/`fy` (0..1] = the VALID fraction of the map when it covers a zero-PADDED square (EdgeSAM:
 * aspect-preserving resize + pad → the object lives only in the top-left nw×nh of the 1024 space;
 * stretching the whole padded square onto w×h smears the mask toward the corner on non-square
 * images — the misalignment Dan hit on the phone). Default 1 = the map covers the image exactly.
 */
export function logitsToMask(map: ArrayLike<number>, mh: number, mw: number, w: number, h: number, fx = 1, fy = 1, softOut?: Uint8Array): Uint8Array {
  // BILINEAR upsample of the continuous logit field, threshold AFTER interpolation — the same trick
  // v5.3.1 plays with u2net's soft saliency matte. Hard-thresholding at 256² then nearest-neighbour
  // upscaling bakes the low-res staircase into the edge (the "choppy outline"); interpolating the
  // logits first puts the 0-crossing at sub-pixel positions, so the edge comes out smooth.
  //
  // SOFT ALPHA: samSoftProb — THE one shared logits→probability conversion (engine ben-chain):
  // zero-crossing ramp + [1,2,1]² widening. Plugged-into, not cloned (QA #209 finding 4).
  const src: ArrayLike<number> = softOut ? samSoftProb(map, mh, mw) : map
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const gy = Math.min(mh - 1.001, Math.max(0, (y + 0.5) * fy * mh / h - 0.5))
    const y0 = gy | 0, ty = gy - y0
    for (let x = 0; x < w; x++) {
      const gx = Math.min(mw - 1.001, Math.max(0, (x + 0.5) * fx * mw / w - 0.5))
      const x0 = gx | 0, tx = gx - x0
      const i = y0 * mw + x0
      const v = (src[i] as number) * (1 - tx) * (1 - ty) + (src[i + 1] as number) * tx * (1 - ty)
        + (src[i + mw] as number) * (1 - tx) * ty + (src[i + mw + 1] as number) * tx * ty
      if (softOut ? v > 0.5 : v > 0) out[y * w + x] = 1
      if (softOut) softOut[y * w + x] = Math.round(255 * Math.min(1, Math.max(0, v)))
    }
  }
  return out
}
