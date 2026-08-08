// cutout-render — v1's shell PRESENTATION helpers, compiled as an add-on (render code only:
// canvas draws reading state, zero policy, zero engine math). Extracted verbatim from v1
// finish.ts (maskOverlay, drawCutout). Nothing SAM/wand-era.

import type { Mask } from '@/lib/tool-paint-math/types'

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

/** A composed band placement (mask-space bbox of the engine's compose frame), y-flipped exactly as
 *  the shell's SVG draws it. */
export interface ComposedBand { url: string; x: number; y: number; w: number; h: number }

function loadImage(src: string): Promise<HTMLImageElement | null> {
  // load-event, never decode() — decode() can hang unresolved on large data/blob URLs.
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src })
}

/** SAVE the sticker as a TRANSPARENT PNG — pixel-for-pixel what the canvas shows inside the outline:
 *  the photo base, then the engine-composed band (if blend engaged) on top, all clipped to the
 *  resolved outline, transparent everywhere outside. Presentation only — no compositor, no policy;
 *  the composed band is already the engine's own output, drawn with the SAME y-flip the SVG uses.
 *  Renders at the working resolution (imgW×imgH); the full-resolution manufacturing master is a
 *  separate re-bake at order time. Returns null if the browser cannot encode. */
export async function saveStickerPng(
  photo: HTMLCanvasElement, d: string, imgW: number, imgH: number, band: ComposedBand | null,
): Promise<Blob | null> {
  const c = document.createElement('canvas')
  c.width = imgW; c.height = imgH
  const ctx = c.getContext('2d')!
  ctx.save()
  ctx.clip(new Path2D(d)) // transparent outside the cut line by construction
  ctx.drawImage(photo, 0, 0, imgW, imgH)
  if (band) {
    const im = await loadImage(band.url)
    if (im) {
      ctx.save()
      ctx.translate(0, band.y * 2 + band.h) // SVG parity: translate(0 y*2+h) scale(1 -1)
      ctx.scale(1, -1)
      ctx.drawImage(im, band.x, band.y, band.w, band.h)
      ctx.restore()
    }
  }
  ctx.restore()
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'))
}
