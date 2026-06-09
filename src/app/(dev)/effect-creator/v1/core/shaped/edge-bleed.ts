// Edge colour bleed (Lane A / Kai)
// Per FINAL-SPEC AMEND-3: nearest-interior RGB dilation (not a flat colour, not feMorphology as
// the algorithm). The rounded edge band wraps slightly past the silhouette in UV space; bleeding
// foreground colour outward into the background ring makes the edge read as colour-bled, not white.
//
// Implementation: iterative 1px dilation of foreground colour into background pixels (a cheap
// distance-transform-style nearest-interior fill). Returns a canvas for THREE.CanvasTexture.

export function bleedTexture(
  img: ImageData,
  mask: Uint8Array,
  width: number,
  height: number,
  iterations = 24
): HTMLCanvasElement {
  const src = img.data
  // working RGB buffers + a "filled" flag (starts = mask)
  const r = new Uint8ClampedArray(width * height)
  const g = new Uint8ClampedArray(width * height)
  const b = new Uint8ClampedArray(width * height)
  const filled = new Uint8Array(width * height)
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    r[p] = src[i]; g[p] = src[i + 1]; b[p] = src[i + 2]
    filled[p] = mask[p]
  }

  let frontier = filled
  for (let it = 0; it < iterations; it++) {
    const next = Uint8Array.from(frontier)
    let changed = false
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x
        if (frontier[p]) continue
        // average of already-filled 4-neighbours
        let cr = 0, cg = 0, cb = 0, cnt = 0
        if (x > 0 && frontier[p - 1]) { cr += r[p - 1]; cg += g[p - 1]; cb += b[p - 1]; cnt++ }
        if (x < width - 1 && frontier[p + 1]) { cr += r[p + 1]; cg += g[p + 1]; cb += b[p + 1]; cnt++ }
        if (y > 0 && frontier[p - width]) { cr += r[p - width]; cg += g[p - width]; cb += b[p - width]; cnt++ }
        if (y < height - 1 && frontier[p + width]) { cr += r[p + width]; cg += g[p + width]; cb += b[p + width]; cnt++ }
        if (cnt) {
          r[p] = cr / cnt; g[p] = cg / cnt; b[p] = cb / cnt
          next[p] = 1
          changed = true
        }
      }
    }
    frontier = next
    if (!changed) break
  }

  const out = new ImageData(width, height)
  const od = out.data
  for (let p = 0, i = 0; p < width * height; p++, i += 4) {
    od[i] = r[p]; od[i + 1] = g[p]; od[i + 2] = b[p]; od[i + 3] = 255
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.putImageData(out, 0, 0)
  return canvas
}
