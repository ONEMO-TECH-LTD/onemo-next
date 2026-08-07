// grabcut-lean — Dan priority 4 (LAST, only after 1–3 are device-proven): the v1 GrabCut brush
// logic verbatim (standalone recognise + corridor-bounded refine, never-destroy floors), stripped
// of its heavy dependency. THE 13MB @techstark/opencv-js IS BANNED (Dan 2026-08-07: "grab cut goes
// in only if we strip it to grab cut only… no 13mb"). This module imports NO OpenCV: the adopting
// increment supplies a CvProvider — a slim custom build (core+imgproc grabCut only, ~2–3MB) or a
// standalone grabCut implementation. Until such a provider exists, this module stays unwired.

import type { Mask } from '@/lib/tool-paint-math/types'

/** The minimal OpenCV surface grabCut needs — the slim build must satisfy exactly this, no more. */
export interface CvProvider {
  Mat: new (...a: number[]) => { data: Uint8Array; delete(): void }
  matFromImageData(d: ImageData): { delete(): void }
  cvtColor(src: unknown, dst: unknown, code: number): void
  grabCut(img: unknown, mask: unknown, rect: unknown, bgd: unknown, fgd: unknown, iters: number, mode: number): void
  Rect: new (x: number, y: number, w: number, h: number) => unknown
  COLOR_RGBA2RGB: number
  CV_8UC1: number
  GC_BGD: number; GC_FGD: number; GC_PR_BGD: number; GC_PR_FGD: number
  GC_INIT_WITH_MASK: number
}

// v1 constants, device-proven (Dan: "Grab cut works")
export const GC_MAX = 512        // work-resolution cap (grabcut is O(pixels·iters))
export const GC_ITERS = 3
export const HALO_MULT = 3       // standalone: probable-fg halo = HALO_MULT × brush
export const CORRIDOR_MULT = 2.5 // refine: label applies only within CORRIDOR_MULT × brush of the stroke
export const CORRIDOR_MIN_PX = 24

/** v1 grabCutRefine verbatim, parameterized on the injected provider. STANDALONE (no base):
 *  recognise the painted shape (halo + hard-fg swath, no corridor). REFINE (base): corridor-bounded
 *  add/erase — the label applies only near the stroke; everywhere else the base is preserved
 *  (erase can't destroy, add can't over-reach — meta R12-1). */
export async function grabCutRefine(
  cv: CvProvider,
  image: HTMLCanvasElement, base: Mask | null, stroke: { x: number; y: number }[], brushPx: number, erase: boolean,
): Promise<Mask> {
  const W = image.width, H = image.height
  const scale = Math.min(1, GC_MAX / Math.max(W, H))
  const w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale))

  let baseArea = 0
  if (base) for (let i = 0; i < base.data.length; i++) if (base.data[i]) baseArea++
  const fromScratch = baseArea === 0

  const dc = document.createElement('canvas'); dc.width = w; dc.height = h
  const dctx = dc.getContext('2d', { willReadFrequently: true })!
  dctx.drawImage(image, 0, 0, w, h)
  const src = cv.matFromImageData(dctx.getImageData(0, 0, w, h))
  const rgb = new cv.Mat(); cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB)

  const gc = new cv.Mat(h, w, cv.CV_8UC1)
  const r = Math.max(1, brushPx * scale)
  const stamp = (cx: number, cy: number, rad: number, val: number) => {
    const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(w - 1, Math.ceil(cx + rad))
    const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(h - 1, Math.ceil(cy + rad))
    const r2 = rad * rad
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy
      if (dx * dx + dy * dy <= r2) gc.data[y * w + x] = val
    }
  }
  let marked = 0
  if (fromScratch && erase) return { data: base ? new Uint8Array(base.data) : new Uint8Array(W * H), w: W, h: H }
  if (fromScratch) {
    gc.data.fill(cv.GC_PR_BGD)
    for (const p of stroke) stamp(p.x * scale, p.y * scale, r * HALO_MULT, cv.GC_PR_FGD)
    for (const p of stroke) { stamp(p.x * scale, p.y * scale, r, cv.GC_FGD); marked++ }
  } else {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const bx = Math.min(W - 1, Math.round(x / scale)), by = Math.min(H - 1, Math.round(y / scale))
      gc.data[y * w + x] = base!.data[by * W + bx] ? cv.GC_PR_FGD : cv.GC_PR_BGD
    }
    for (const p of stroke) { stamp(p.x * scale, p.y * scale, r, erase ? cv.GC_BGD : cv.GC_FGD); marked++ }
  }

  const out = new Uint8Array(base ? base.data : new Uint8Array(W * H))
  const bgd = new cv.Mat(), fgd = new cv.Mat()
  try {
    if (marked > 0) cv.grabCut(rgb, gc, new cv.Rect(0, 0, w, h), bgd, fgd, GC_ITERS, cv.GC_INIT_WITH_MASK)
    const fg = (v: number) => v === cv.GC_FGD || v === cv.GC_PR_FGD
    if (fromScratch) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const sx = Math.min(w - 1, Math.round(x * scale)), sy = Math.min(h - 1, Math.round(y * scale))
        out[y * W + x] = fg(gc.data[sy * w + sx]) ? 1 : 0
      }
    } else {
      // CORRIDOR BOUND (meta R12-1): grabCut relabels EVERY probable pixel globally — on a
      // colour-uniform subject an erase could flip the whole object. Label applies only near the
      // stroke; the base is preserved everywhere else.
      const corridorR = Math.max(brushPx * CORRIDOR_MULT, CORRIDOR_MIN_PX)
      const cr2 = corridorR * corridorR
      const seg = stroke.length ? stroke : [{ x: 0, y: 0 }]
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const p of seg) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
      const bx0 = Math.max(0, Math.floor(x0 - corridorR)), by0 = Math.max(0, Math.floor(y0 - corridorR))
      const bx1 = Math.min(W - 1, Math.ceil(x1 + corridorR)), by1 = Math.min(H - 1, Math.ceil(y1 + corridorR))
      const near = (x: number, y: number): boolean => {
        for (let i = 0; i < seg.length; i++) {
          const a = seg[i], b = seg[Math.min(i + 1, seg.length - 1)]
          const dx = b.x - a.x, dy = b.y - a.y
          const L2 = dx * dx + dy * dy
          const t = L2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2)) : 0
          const px = a.x + t * dx - x, py = a.y + t * dy - y
          if (px * px + py * py <= cr2) return true
        }
        return false
      }
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
        if (!near(x, y)) continue
        const sx = Math.min(w - 1, Math.round(x * scale)), sy = Math.min(h - 1, Math.round(y * scale))
        out[y * W + x] = fg(gc.data[sy * w + sx]) ? 1 : 0
      }
    }
  } finally {
    ;(src as { delete(): void }).delete(); rgb.delete(); gc.delete(); bgd.delete(); fgd.delete()
  }
  return { data: out, w: W, h: H }
}

// NEVER-DESTROY floors (v1 flow guards, module-owned so no driver can forget them)
export const MIN_ERASE_KEEP_RATIO = 0.1
export const eraseWouldDestroy = (beforeArea: number, afterArea: number): boolean =>
  afterArea <= beforeArea * MIN_ERASE_KEEP_RATIO
