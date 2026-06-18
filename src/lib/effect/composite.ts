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

// ── Safari-safe blur (KAI-9122) ─────────────────────────────────────────────────────────────────
// Safari's 2D canvas has NO `ctx.filter` (verified: WebKit `'filter' in ctx === false`), so the
// magic-blend / offset-fill blur — baked via `ctx.filter='blur()'` — silently no-ops on iOS while the
// SVG-filter editor preview shows it. This is the CORE effect, so it gets a real JS blur: a separable
// running-sum box blur, 3 passes ≈ Gaussian, O(w·h) regardless of radius. Works on every engine.
function boxBlurAxis(px: Uint8ClampedArray, w: number, h: number, r: number, vertical: boolean) {
  const win = 2 * r + 1
  const outerN = vertical ? w : h          // number of lines (columns if vertical, rows if not)
  const innerN = vertical ? h : w          // length of each line
  const innerStride = (vertical ? w : 1) * 4
  const outerStride = vertical ? 4 : w * 4
  const line = new Float32Array(innerN * 4)
  for (let o = 0; o < outerN; o++) {
    const base = o * outerStride
    let sr = 0, sg = 0, sb = 0, sa = 0
    for (let k = -r; k <= r; k++) {
      const idx = base + Math.min(innerN - 1, Math.max(0, k)) * innerStride
      sr += px[idx]; sg += px[idx + 1]; sb += px[idx + 2]; sa += px[idx + 3]
    }
    for (let i = 0; i < innerN; i++) {
      const li = i * 4
      line[li] = sr / win; line[li + 1] = sg / win; line[li + 2] = sb / win; line[li + 3] = sa / win
      const addI = base + Math.min(innerN - 1, Math.max(0, i + r + 1)) * innerStride
      const subI = base + Math.min(innerN - 1, Math.max(0, i - r)) * innerStride
      sr += px[addI] - px[subI]; sg += px[addI + 1] - px[subI + 1]; sb += px[addI + 2] - px[subI + 2]; sa += px[addI + 3] - px[subI + 3]
    }
    for (let i = 0; i < innerN; i++) {
      const idx = base + i * innerStride, li = i * 4
      px[idx] = line[li]; px[idx + 1] = line[li + 1]; px[idx + 2] = line[li + 2]; px[idx + 3] = line[li + 3]
    }
  }
}

/** A blurred copy of a canvas — Safari-safe (no ctx.filter). radiusPx 0 → an untouched copy.
 *  Blur is low-frequency, so we blur a downscaled (≤640px) copy and upscale — visually identical to a
 *  full-res blur, ~10× faster, so a live blend drag stays smooth even on a multi-megapixel photo. */
export function jsBlur(src: HTMLCanvasElement, radiusPx: number): HTMLCanvasElement {
  const w = src.width, h = src.height
  const out = document.createElement('canvas'); out.width = w; out.height = h
  const octx = out.getContext('2d')!; octx.imageSmoothingEnabled = true
  const r = Math.max(0, Math.round(radiusPx))
  if (r === 0 || w === 0 || h === 0) { octx.drawImage(src, 0, 0); return out }
  const MAX = 640
  const k = Math.min(1, MAX / Math.max(w, h))
  const sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k))
  const small = document.createElement('canvas'); small.width = sw; small.height = sh
  const sctx = small.getContext('2d')!; sctx.imageSmoothingEnabled = true
  sctx.drawImage(src, 0, 0, sw, sh) // downscale
  const img = sctx.getImageData(0, 0, sw, sh)
  const rr = Math.min(Math.max(1, Math.round(r * k)), Math.floor((Math.min(sw, sh) - 1) / 2)) || 1
  for (let pass = 0; pass < 3; pass++) { boxBlurAxis(img.data, sw, sh, rr, false); boxBlurAxis(img.data, sw, sh, rr, true) }
  sctx.putImageData(img, 0, 0)
  octx.drawImage(small, 0, 0, w, h) // upscale back to full res (bilinear smooths the box steps)
  return out
}

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
  // BACKGROUND: the blur is the CORE effect (magic-blend + offset-fill). Bake it with a JS blur — NOT
  // ctx.filter, which is a no-op on Safari's 2D canvas — so it renders on iOS, not just Chromium.
  // (Colour fx below still rides ctx.filter; that's Chrome-only but secondary per the product brief.)
  const bg = bgBlurPx > 0 ? jsBlur(origCanvas, bgBlurPx) : origCanvas
  if (fx) ctx.filter = fx
  ctx.drawImage(bg, 0, 0)
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

/** A strongly-blurred copy of a canvas — the edge-lip texture source (smooth rim colour, no banding).
 *  Safari-safe: was `ctx.filter='blur()'`, a no-op on iOS that left the rim sharp/banded. */
export function blurCanvas(src: HTMLCanvasElement, blurPx: number): HTMLCanvasElement {
  return jsBlur(src, blurPx)
}

/** ImageData → a canvas (for the BEN subject matte + the full-photo source layer). */
export function imageDataToCanvas(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = img.width; c.height = img.height
  c.getContext('2d')!.putImageData(img, 0, 0)
  return c
}
