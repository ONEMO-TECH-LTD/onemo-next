// Shaped-effect 2D compositing primitives (Lane A / Kai) — PURE 2D canvas, NO three.js.
//
// The ONE magic-blend composite lives here so BOTH the (legacy) 3D pipeline and the new 2D-first
// `prepareEffect` import the SAME composeFront (composite parity, lean-spec §5.2) without dragging
// three.js into the Phase-A (WebGL-free) creation path. `prepare-effect.ts` imports it here directly.
//
// ── v5.3·P2 (KAI-9147) — CROSS-BROWSER SVG-FILTER ENGINE ─────────────────────────────────────────
// The image bake now runs through an SVG <filter> (feGaussianBlur + feColorMatrix/feComponentTransfer)
// rasterised to a canvas via a **Blob URL**. This replaces (a) the old `ctx.filter` colour bake — a
// silent no-op on Safari's 2D canvas (`'filter' in ctx === false`) — and (b) the interim jsBlur box
// blur (c5fa505). One mechanism, every engine incl. WebKit / iOS Safari.
//   • The OUTER svg is loaded via a Blob URL — a *data-URL* svg renders EMPTY on WebKit (the verified
//     gotcha); the inner source <image> is a data-URL, which is fine.
//   • The CSS-filter SHORTHAND interface is unchanged: callers still pass a CSS string
//     (`brightness(110%) contrast(105%) …` / the presets). composeFront PARSES it into the spec-exact
//     SVG primitives (W3C Filter Effects §filter-function reference), so the baked look matches both
//     the live 2D-editor preview (which already uses SVG feGaussianBlur + CSS style.filter) AND is
//     identical on every engine. Colour runs in sRGB (matches CSS filter), blur in linearRGB (matches
//     the editor's <feGaussianBlur>).

// ── Filters v2 (KAI-9125) — one-tap PRESETS: named CSS-filter recipes (the interface; baked via the
//    SVG engine below, no longer `ctx.filter`). The SAME composite feeds 3D + print (parity). ──
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

// ── CSS filter shorthand → SVG filter primitives (W3C Filter Effects §filter functions) ───────────
// The CSS shorthands are DEFINED as these exact SVG primitives, so a faithful translation is identical
// to the CSS filter on any engine. Blur is handled separately (bgBlurPx) — any blur() here is ignored.
function sepiaMatrix(a: number): string {
  const inv = 1 - a // a=0 → identity, a=1 → full sepia
  const r = [0.393 + 0.607 * inv, 0.769 - 0.769 * inv, 0.189 - 0.189 * inv, 0, 0]
  const g = [0.349 - 0.349 * inv, 0.686 + 0.314 * inv, 0.168 - 0.168 * inv, 0, 0]
  const b = [0.272 - 0.272 * inv, 0.534 - 0.534 * inv, 0.131 + 0.869 * inv, 0, 0]
  return [...r, ...g, ...b, 0, 0, 0, 1, 0].join(' ')
}
function linFuncs(slope: number, intercept: number): string {
  const f = (ch: string) => `<feFunc${ch} type="linear" slope="${slope}" intercept="${intercept}"/>`
  return f('R') + f('G') + f('B')
}
/** Parse a CSS filter string into the equivalent SVG <filter> body (colour primitives only). */
export function cssColorFilterToSvg(filter?: string | null): string {
  if (!filter || filter === 'none') return ''
  const out: string[] = []
  const re = /([\w-]+)\(([^)]*)\)/g
  let m: RegExpExecArray | null
  const num = (s: string) => (s.trim().endsWith('%') ? parseFloat(s) / 100 : parseFloat(s)) || 0
  while ((m = re.exec(filter)) !== null) {
    const fn = m[1], raw = m[2].trim()
    switch (fn) {
      case 'grayscale': { const a = Math.min(1, Math.max(0, num(raw))); out.push(`<feColorMatrix type="saturate" values="${1 - a}"/>`); break }
      case 'saturate': { out.push(`<feColorMatrix type="saturate" values="${Math.max(0, num(raw))}"/>`); break }
      case 'sepia': { out.push(`<feColorMatrix type="matrix" values="${sepiaMatrix(Math.min(1, Math.max(0, num(raw))))}"/>`); break }
      case 'hue-rotate': { out.push(`<feColorMatrix type="hueRotate" values="${parseFloat(raw) || 0}"/>`); break }
      case 'brightness': { out.push(`<feComponentTransfer>${linFuncs(Math.max(0, num(raw)), 0)}</feComponentTransfer>`); break }
      case 'contrast': { const a = Math.max(0, num(raw)); out.push(`<feComponentTransfer>${linFuncs(a, (1 - a) * 0.5)}</feComponentTransfer>`); break }
      default: break // blur() etc. handled elsewhere
    }
  }
  return out.join('')
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('[composite] SVG-filter image failed to load'))
    im.src = url
  })
}

/**
 * Rasterise `src` through an SVG <filter> body — cross-browser, incl. WebKit/Safari (the OUTER svg
 * loads via a Blob URL; a data-URL svg renders empty on WebKit). `colorSpace` sets
 * color-interpolation-filters (sRGB for colour to match CSS filter; linearRGB for blur to match the
 * editor's <feGaussianBlur>). Returns a NEW canvas the size of `src`. Async (Image onload).
 */
async function svgFilterBake(src: HTMLCanvasElement, filterBody: string, colorSpace: 'sRGB' | 'linearRGB'): Promise<HTMLCanvasElement> {
  const w = src.width, h = src.height
  const out = document.createElement('canvas'); out.width = w; out.height = h
  const octx = out.getContext('2d')!
  if (!filterBody || w === 0 || h === 0) { octx.drawImage(src, 0, 0); return out }
  const href = src.toDataURL()
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}">` +
    `<filter id="f" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="${colorSpace}">${filterBody}</filter>` +
    `<image href="${href}" xlink:href="${href}" x="0" y="0" width="${w}" height="${h}" filter="url(#f)" preserveAspectRatio="none"/>` +
    `</svg>`
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    octx.drawImage(await loadImg(url), 0, 0, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
  return out
}

/** Plain (filter-free) copy of a canvas. */
function copyCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height
  c.getContext('2d')!.drawImage(src, 0, 0)
  return c
}

/**
 * Compose the front texture: a SHARP subject over a BLURRED copy of the real-photo background.
 * `bgBlurPx = 0` → no blur (the full sharp original photo = effect OFF). Used for the default build
 * AND for live editor re-blur (toggle / intensity) — same source canvases, no re-segmentation.
 * Filters v2: `vignette` (0..1) darkens the corners; `tint` (css color | null) washes the whole
 * composite. v5.3·P2: blur + colour bake through the cross-browser SVG engine (so 3D == print AND it
 * renders on every engine incl. Safari). ASYNC (SVG Image onload).
 */
export async function composeFront(
  origCanvas: HTMLCanvasElement,
  subjCanvas: HTMLCanvasElement,
  bgBlurPx: number,
  // #28: image adjustments baked at compose time — the SAME canvas feeds the 3D texture and the
  // print artwork, so adjustments are print-faithful by construction. CSS-filter string parts.
  fxFilter?: string,
  vignette = 0,
  tint: string | null = null,
): Promise<HTMLCanvasElement> {
  const fw = origCanvas.width, fh = origCanvas.height
  // BACKGROUND: the blur is the CORE effect (magic-blend + offset-fill). Bake it with the SVG engine
  // (feGaussianBlur, linearRGB — matches the editor preview), cross-browser incl. Safari.
  const bg = bgBlurPx > 0 ? await svgFilterBake(origCanvas, `<feGaussianBlur stdDeviation="${bgBlurPx}" />`, 'linearRGB') : origCanvas
  // composite: blurred bg + the sharp subject on top
  let composed = document.createElement('canvas')
  composed.width = fw; composed.height = fh
  composed.getContext('2d')!.drawImage(bg, 0, 0)
  composed.getContext('2d')!.drawImage(subjCanvas, 0, 0, fw, fh)
  // COLOUR fx over the finished composite — spec-exact SVG primitives (sRGB → matches CSS filter).
  const colourBody = cssColorFilterToSvg(fxFilter)
  if (colourBody) composed = await svgFilterBake(composed, colourBody, 'sRGB')
  // Filters v2 composite effects (applied over the finished composite):
  const ctx = composed.getContext('2d')!
  if (tint) { ctx.save(); ctx.globalAlpha = 0.22; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(0, 0, fw, fh); ctx.restore() }
  if (vignette > 0) {
    const g = ctx.createRadialGradient(fw / 2, fh / 2, Math.min(fw, fh) * 0.32, fw / 2, fh / 2, Math.max(fw, fh) * 0.72)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${Math.max(0, Math.min(1, vignette)) * 0.72})`)
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, fw, fh); ctx.restore()
  }
  return composed
}

/** A strongly-blurred copy of a canvas — the edge-lip texture source (smooth rim colour, no banding).
 *  v5.3·P2: cross-browser SVG feGaussianBlur (was the interim jsBlur; before that a no-op ctx.filter). */
export async function blurCanvas(src: HTMLCanvasElement, blurPx: number): Promise<HTMLCanvasElement> {
  if (blurPx <= 0) return copyCanvas(src)
  return svgFilterBake(src, `<feGaussianBlur stdDeviation="${blurPx}" />`, 'linearRGB')
}

/** ImageData → a canvas (for the BEN subject matte + the full-photo source layer). */
export function imageDataToCanvas(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = img.width; c.height = img.height
  c.getContext('2d')!.putImageData(img, 0, 0)
  return c
}
