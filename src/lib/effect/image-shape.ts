// effect/image-shape — Run 10: an uploaded IMAGE becomes a cut shape, vectorised under the hood.
// Pure mask derivation (headless-testable): real transparency → the opaque pixels ARE the shape;
// otherwise Otsu's threshold on luminance splits the image in two, and the side that does NOT own
// the border is the shape (handles dark-on-light scans AND light-on-dark logos). The mask then
// rides the SAME machinery as Magic: traceContourRaw → fairing → Schneider fit — one tracer, no fork.

export interface ImageLike {
  data: Uint8ClampedArray
  width: number
  height: number
}

export function maskFromImageData(img: ImageLike): { mask: Uint8Array; width: number; height: number } {
  const { data, width, height } = img
  const n = width * height
  const mask = new Uint8Array(n)
  // transparency rule: ≥2% transparent pixels = a real alpha silhouette
  let transparent = 0
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 128) transparent++
  if (transparent > n * 0.02) {
    for (let i = 0; i < n; i++) mask[i] = data[i * 4 + 3] >= 128 ? 1 : 0
    return { mask, width, height }
  }
  // luminance → Otsu threshold (maximal between-class variance)
  const hist = new Array<number>(256).fill(0)
  const lum = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const l = Math.round(0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2])
    lum[i] = l
    hist[l]++
  }
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let sumB = 0, wB = 0, maxVar = -1, thr = 127
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = n - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB, mF = (sum - sumB) / wF
    const v = wB * wF * (mB - mF) * (mB - mF)
    if (v > maxVar) { maxVar = v; thr = t }
  }
  // the border belongs to the BACKGROUND — the shape is whichever side the border isn't
  let borderDark = 0, borderTotal = 0
  const tally = (i: number) => { borderTotal++; if (lum[i] <= thr) borderDark++ }
  for (let x = 0; x < width; x++) { tally(x); tally((height - 1) * width + x) }
  for (let y = 1; y < height - 1; y++) { tally(y * width); tally(y * width + width - 1) }
  const shapeIsDark = borderDark < borderTotal / 2
  for (let i = 0; i < n; i++) mask[i] = (lum[i] <= thr) === shapeIsDark ? 1 : 0
  return { mask, width, height }
}
