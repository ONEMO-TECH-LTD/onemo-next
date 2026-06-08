// Segmentation → binary mask (Lane A / Kai)
//
// Per FINAL-SPEC the browser default is BEN2-ONNX via transformers.js, behind a
// `SegmentationAdapter`. That ML adapter (segment-ml.ts) is now the ACTIVE default in
// pipeline.ts; the fast built-in adapter here (alpha-channel when present, else border
// flood-fill background removal) is the FALLBACK behind the same interface, used only when
// the model can't load. Segmentation is one pluggable stage.

export interface MaskResult {
  mask: Uint8Array // 1 = foreground, 0 = background
  width: number
  height: number
  imageData: ImageData // the (downscaled) source pixels, for texture + edge bleed
}

export interface SegmentationAdapter {
  id: string
  run(img: ImageData): Uint8Array // returns 0/1 mask, length = w*h
}

/** Load an image URL into ImageData, downscaled so max dimension ≤ maxDim (speed). */
export async function loadImageData(url: string, maxDim = 512): Promise<ImageData> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = url
  })
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  // Load y-UP (row 0 = bottom of the photo): flip vertically so geometry py → world +y is upright.
  // Texture is built from this same y-up buffer, so shape + texture stay consistent (v = py/H, flipY=false).
  ctx.translate(0, h)
  ctx.scale(1, -1)
  ctx.drawImage(img, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

function hasAlpha(img: ImageData): boolean {
  const d = img.data
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < 250) return true
  }
  return false
}

/** Adapter: use the PNG alpha channel directly. */
const alphaAdapter: SegmentationAdapter = {
  id: 'alpha',
  run(img) {
    const { data, width, height } = img
    const mask = new Uint8Array(width * height)
    for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
      mask[p] = data[i + 3] > 128 ? 1 : 0
    }
    return mask
  },
}

/**
 * Adapter: remove a near-uniform background by flood-filling from the image borders.
 * Works for product/word shots on a solid (white/coloured) background.
 */
const bgFloodAdapter: SegmentationAdapter = {
  id: 'bg-flood',
  run(img) {
    const { data, width, height } = img
    const n = width * height
    // background reference colour = average of the 4 corners
    const corners = [0, width - 1, (height - 1) * width, height * width - 1]
    let br = 0, bg = 0, bb = 0
    for (const c of corners) {
      br += data[c * 4]; bg += data[c * 4 + 1]; bb += data[c * 4 + 2]
    }
    br /= 4; bg /= 4; bb /= 4
    const TOL = 38 // colour distance tolerance
    const tol2 = TOL * TOL
    const isBgColour = (p: number) => {
      const dr = data[p * 4] - br, dg = data[p * 4 + 1] - bg, db = data[p * 4 + 2] - bb
      return dr * dr + dg * dg + db * db <= tol2
    }
    const bgFlag = new Uint8Array(n) // 1 = confirmed background (border-connected)
    const stack: number[] = []
    for (let x = 0; x < width; x++) {
      stack.push(x, (height - 1) * width + x)
    }
    for (let y = 0; y < height; y++) {
      stack.push(y * width, y * width + width - 1)
    }
    while (stack.length) {
      const p = stack.pop()!
      if (bgFlag[p] || !isBgColour(p)) continue
      bgFlag[p] = 1
      const x = p % width, y = (p - x) / width
      if (x > 0) stack.push(p - 1)
      if (x < width - 1) stack.push(p + 1)
      if (y > 0) stack.push(p - width)
      if (y < height - 1) stack.push(p + width)
    }
    const mask = new Uint8Array(n)
    for (let p = 0; p < n; p++) mask[p] = bgFlag[p] ? 0 : 1
    return mask
  },
}

/** Morphological close→open to clean speckles + fill pinholes. 1px structuring element. */
function cleanup(mask: Uint8Array, w: number, h: number): Uint8Array {
  const dilate = (src: Uint8Array) => {
    const out = new Uint8Array(src.length)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        let v = src[p]
        if (!v) {
          if (x > 0 && src[p - 1]) v = 1
          else if (x < w - 1 && src[p + 1]) v = 1
          else if (y > 0 && src[p - w]) v = 1
          else if (y < h - 1 && src[p + w]) v = 1
        }
        out[p] = v
      }
    }
    return out
  }
  const erode = (src: Uint8Array) => {
    const out = new Uint8Array(src.length)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        let v = src[p]
        if (v) {
          if (x > 0 && !src[p - 1]) v = 0
          else if (x < w - 1 && !src[p + 1]) v = 0
          else if (y > 0 && !src[p - w]) v = 0
          else if (y < h - 1 && !src[p + w]) v = 0
        }
        out[p] = v
      }
    }
    return out
  }
  return erode(dilate(dilate(erode(mask)))) // open then close
}

/**
 * Uniform mask smoothing: separable box-blur of the binary mask + 0.5 re-threshold. Rounds small
 * sharp protrusions/notches (e.g. the marching-squares stair-steps at thin spike tips) the SAME way
 * everywhere — symmetric, position-independent, any image. radius is in mask pixels (small → only
 * sub-feature noise is rounded; major shape preserved).
 */
export function smoothMask(mask: Uint8Array, w: number, h: number, radius = 3): Uint8Array {
  const r = Math.max(1, Math.round(radius))
  const win = 2 * r + 1
  const cl = (v: number, hi: number) => (v < 0 ? 0 : v > hi ? hi : v)
  const tmp = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let sum = 0
    for (let k = -r; k <= r; k++) sum += mask[row + cl(k, w - 1)]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / win
      sum += mask[row + cl(x + r + 1, w - 1)] - mask[row + cl(x - r, w - 1)]
    }
  }
  const out = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let k = -r; k <= r; k++) sum += tmp[cl(k, h - 1) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / win >= 0.5 ? 1 : 0
      sum += tmp[cl(y + r + 1, h - 1) * w + x] - tmp[cl(y - r, h - 1) * w + x]
    }
  }
  return out
}

/** Keep only the largest 4-connected foreground component (spec v1 single-component gate). */
function largestComponent(mask: Uint8Array, w: number, h: number): Uint8Array {
  const n = w * h
  const label = new Int32Array(n).fill(-1)
  let best = -1, bestSize = 0, cur = 0
  const stack: number[] = []
  for (let s = 0; s < n; s++) {
    if (!mask[s] || label[s] >= 0) continue
    let size = 0
    stack.push(s)
    label[s] = cur
    while (stack.length) {
      const p = stack.pop()!
      size++
      const x = p % w, y = (p - x) / w
      if (x > 0 && mask[p - 1] && label[p - 1] < 0) { label[p - 1] = cur; stack.push(p - 1) }
      if (x < w - 1 && mask[p + 1] && label[p + 1] < 0) { label[p + 1] = cur; stack.push(p + 1) }
      if (y > 0 && mask[p - w] && label[p - w] < 0) { label[p - w] = cur; stack.push(p - w) }
      if (y < h - 1 && mask[p + w] && label[p + w] < 0) { label[p + w] = cur; stack.push(p + w) }
    }
    if (size > bestSize) { bestSize = size; best = cur }
    cur++
  }
  const out = new Uint8Array(n)
  if (best >= 0) for (let p = 0; p < n; p++) out[p] = label[p] === best ? 1 : 0
  return out
}

/** Shared post-process: clean speckles/pinholes + keep the largest component (single-component gate). */
export function postProcessMask(mask: Uint8Array, w: number, h: number): Uint8Array {
  return largestComponent(cleanup(mask, w, h), w, h)
}

/**
 * Expand the mask outward by N iterations (padding margin around the subject). Uses an OCTAGONAL
 * structuring element (alternate 4-connected "plus" and 8-connected "square" per iteration), which
 * approximates a circular brush — so thin sharp spikes (e.g. bat-ear tips) get ROUNDED instead of
 * squared off into a rectangular stub (a pure 3×3 square dilation was creating that chimney artifact).
 */
export function dilateMask(mask: Uint8Array, w: number, h: number, iterations: number): Uint8Array {
  let cur = mask
  for (let it = 0; it < iterations; it++) {
    const use8 = it % 2 === 1 // alternate plus / square → octagon ≈ circle
    const out = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        if (cur[p]) { out[p] = 1; continue }
        let v = 0
        // 4-connected (plus) always
        if (x > 0 && cur[p - 1]) v = 1
        else if (x < w - 1 && cur[p + 1]) v = 1
        else if (y > 0 && cur[p - w]) v = 1
        else if (y < h - 1 && cur[p + w]) v = 1
        // diagonals only on square iterations
        else if (use8) {
          if (x > 0 && y > 0 && cur[p - w - 1]) v = 1
          else if (x < w - 1 && y > 0 && cur[p - w + 1]) v = 1
          else if (x > 0 && y < h - 1 && cur[p + w - 1]) v = 1
          else if (x < w - 1 && y < h - 1 && cur[p + w + 1]) v = 1
        }
        out[p] = v
      }
    }
    cur = out
  }
  return cur
}

/**
 * Fallback segmentation (NO ML): alpha if present, else border flood-fill.
 * Real user images have no alpha and often non-uniform backgrounds, so this is a fallback only —
 * the default path is ML segmentation (segment-ml.ts / BEN2-ONNX).
 */
export function segment(img: ImageData): MaskResult {
  const adapter = hasAlpha(img) ? alphaAdapter : bgFloodAdapter
  const mask = postProcessMask(adapter.run(img), img.width, img.height)
  return { mask, width: img.width, height: img.height, imageData: img }
}

export function adapterIdFor(img: ImageData): string {
  return hasAlpha(img) ? alphaAdapter.id : bgFloodAdapter.id
}
