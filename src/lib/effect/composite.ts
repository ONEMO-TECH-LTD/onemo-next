// Shaped-effect 2D compositing primitives (Lane A / Kai) — PURE 2D canvas, NO three.js.
//
// The ONE magic-blend composite lives here so BOTH the (legacy) 3D pipeline and the new 2D-first
// `prepareEffect` import the SAME composeFront (composite parity, lean-spec §5.2) without dragging
// three.js into the Phase-A (WebGL-free) creation path. `pipeline.ts` re-exports composeFront for
// its existing consumers; `prepare-effect.ts` imports it here directly.

// ── Filters v2 (KAI-9125) — one-tap PRESETS: named canvas `ctx.filter` recipes layered ahead of the
//    manual image-fx. ctx.filter on a 2D canvas supports grayscale/sepia/contrast/brightness/saturate/
//    hue-rotate, so these are cheap + print-faithful (the SAME composite feeds 3D + print). ──
export type PresetKey = 'none' | 'bw' | 'noir' | 'sepia' | 'vivid' | 'fade' | 'cool' | 'warm' | 'duotone'
export const PRESET_LABELS: Record<PresetKey, string> = {
  none: 'None', bw: 'B&W', noir: 'Noir', sepia: 'Sepia', vivid: 'Vivid', fade: 'Fade', cool: 'Cool', warm: 'Warm', duotone: 'Duotone',
}
const PRESET_FILTER: Record<PresetKey, string> = {
  none: '',
  bw: 'grayscale(1)',
  noir: 'grayscale(1) contrast(1.45) brightness(0.92)',
  sepia: 'sepia(0.8)',
  vivid: 'saturate(1.55) contrast(1.12)',
  fade: 'contrast(0.85) brightness(1.1) saturate(0.78)',
  cool: 'saturate(1.12) hue-rotate(-14deg) brightness(1.02)',
  warm: 'sepia(0.28) saturate(1.22) brightness(1.04)',
  duotone: 'grayscale(1) sepia(0.6) saturate(2.2) hue-rotate(168deg)',
}
export const presetFilter = (key: PresetKey | undefined): string => PRESET_FILTER[key ?? 'none'] ?? ''

/**
 * Compose the front texture: a SHARP subject over a BLURRED copy of the real-photo background.
 * `bgBlurPx = 0` → no blur (the full sharp original photo = effect OFF). Used for the default build
 * AND for live editor re-blur (toggle / intensity) — same source canvases, no re-segmentation.
 * Filters v2: `vignette` (0..1) darkens the corners; `tint` (css color | null) washes the whole
 * composite — both image-stage appearance, baked so 3D == print.
 */
export function composeFront(
  origCanvas: HTMLCanvasElement,
  subjCanvas: HTMLCanvasElement,
  bgBlurPx: number,
  // #28: image adjustments baked at compose time — the SAME canvas feeds the 3D texture and the
  // print artwork, so adjustments are print-faithful by construction. CSS-filter string parts.
  fxFilter?: string,
  vignette = 0,
  tint: string | null = null,
): HTMLCanvasElement {
  const fw = origCanvas.width, fh = origCanvas.height
  const front = document.createElement('canvas')
  front.width = fw; front.height = fh
  const ctx = front.getContext('2d')!
  const fx = fxFilter && fxFilter !== 'none' ? fxFilter : ''
  if (bgBlurPx > 0) { ctx.filter = `${fx} blur(${bgBlurPx}px)`.trim(); ctx.drawImage(origCanvas, 0, 0) }
  else { if (fx) ctx.filter = fx; ctx.drawImage(origCanvas, 0, 0) }
  ctx.filter = fx || 'none'
  ctx.drawImage(subjCanvas, 0, 0, fw, fh) // sharp subject on top of the (blurred) real background
  ctx.filter = 'none'
  // Filters v2 composite effects (applied over the finished composite):
  if (tint) { ctx.save(); ctx.globalAlpha = 0.22; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(0, 0, fw, fh); ctx.restore() }
  if (vignette > 0) {
    const g = ctx.createRadialGradient(fw / 2, fh / 2, Math.min(fw, fh) * 0.32, fw / 2, fh / 2, Math.max(fw, fh) * 0.72)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${Math.max(0, Math.min(1, vignette)) * 0.72})`)
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, fw, fh); ctx.restore()
  }
  return front
}

/** A strongly-blurred copy of a canvas — the edge-lip texture source (smooth rim colour, no banding). */
export function blurCanvas(src: HTMLCanvasElement, blurPx: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width; c.height = src.height
  const ctx = c.getContext('2d')!
  if (blurPx > 0) { ctx.filter = `blur(${blurPx}px)`; ctx.drawImage(src, 0, 0); ctx.filter = 'none' }
  else ctx.drawImage(src, 0, 0)
  return c
}

/** ImageData → a canvas (for the BEN subject matte + the full-photo source layer). */
export function imageDataToCanvas(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = img.width; c.height = img.height
  c.getContext('2d')!.putImageData(img, 0, 0)
  return c
}
