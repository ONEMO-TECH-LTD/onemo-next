// cutout-render — v1's shell PRESENTATION helpers, compiled as an add-on (render code only:
// canvas draws reading state, zero policy, zero engine math). Extracted verbatim from v1
// finish.ts (maskOverlay, drawCutout). Nothing SAM/wand-era.

import type { Mask } from '@/lib/mask-tools/types'

/** Mask tint — ONE color at a time (Dan device r7): ADD tints the SELECTION green (what's
 *  included); ERASE tints the OUTSIDE red (what's excluded/erasable) — the selection stays clean. */
export function maskOverlay(mask: Mask, mode: 'add' | 'erase' = 'add'): ImageData {
  const { data, w, h } = mask
  const ov = new ImageData(w, h)
  const erase = mode === 'erase'
  const [r, g, b] = erase ? [239, 68, 68] : [34, 197, 94]
  for (let i = 0; i < w * h; i++) {
    if (erase ? data[i] : !data[i]) continue // erase marks OUTSIDE the selection; add marks inside
    const o = i * 4
    ov.data[o] = r; ov.data[o + 1] = g; ov.data[o + 2] = b; ov.data[o + 3] = 110
  }
  return ov
}

/** Sticker preview: checkerboard + the image clipped to the resolved outline (blend-0 truth —
 *  the photo clipped by the path IS the result; no compositor involved). */
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
