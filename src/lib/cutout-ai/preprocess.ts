// cutout-ai — pure tensor builders (ARCHITECTURE.md). Plain { data, dims } out; no runtime imports.
// Verified inference math from the s62 probe, kept exactly; everything else from the probe is gone.

export interface TensorData {
  data: Float32Array
  dims: number[]
}

const SAM_MEAN = [123.675, 116.28, 103.53]
const SAM_STD = [58.395, 57.12, 57.375]
const SAM_SIZE = 1024

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

/** SAM HWC raw input [h,w,3] float 0-255 (MobileSAM — preprocessing baked into the encoder). */
export function samHWC(rgba: Uint8ClampedArray, w: number, h: number): TensorData {
  const data = new Float32Array(w * h * 3)
  for (let i = 0; i < w * h; i++) { const j = i * 4; data[i * 3] = rgba[j]; data[i * 3 + 1] = rgba[j + 1]; data[i * 3 + 2] = rgba[j + 2] }
  return { data, dims: [h, w, 3] }
}

/** Threshold a logit map (mh×mw) to a binary mask at (w×h), nearest-neighbour upscaled. */
export function logitsToMask(map: ArrayLike<number>, mh: number, mw: number, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(mh - 1, (y * mh / h) | 0)
    for (let x = 0; x < w; x++) { const sx = Math.min(mw - 1, (x * mw / w) | 0); if (map[sy * mw + sx] > 0) out[y * w + x] = 1 }
  }
  return out
}
