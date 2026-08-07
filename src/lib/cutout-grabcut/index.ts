// cutout-grabcut — the LIGHT refinement brush (Dan 2026-08-07). Paint roughly over a missed area;
// GrabCut (OpenCV iterated graph-cut) snaps to the real colour edges and adds it to the selection
// (or carves it, on erase). Deterministic, NO deep model, runs on the OpenCV we already ship for
// nothing extra to download. Replaces the deleted EdgeSAM + wand brushes. Loads OpenCV lazily on
// the first stroke, never at page open.

import type { Mask } from '@/lib/mask-tools/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cvReady: Promise<any> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadCv(): Promise<any> {
  if (!cvReady) {
    cvReady = import('@techstark/opencv-js').then((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cv = (m as any).default ?? m
      return cv.Mat ? cv : new Promise((res) => { cv.onRuntimeInitialized = () => res(cv) })
    })
  }
  return cvReady
}

/** Warm the OpenCV runtime (called on first brush intent — never at page open). */
export function initGrabCut(): Promise<void> { return loadCv().then(() => undefined) }

// GrabCut is O(pixels·iterations); cap the work resolution so a stroke stays well under a second on
// a phone. The result is upscaled back to full res (the outline trace smooths the nearest-neighbour
// stair-step). 512 is Photoshop-refine territory and keeps edges faithful.
const GC_MAX = 512
const GC_ITERS = 3

/** Refine the selection with a rough stroke. `stroke` points are in FULL-RES image px; `brushPx`
 *  the swath radius; `erase` carves the stroke region out, else adds it. GrabCut snaps the marked
 *  region to the true colour boundary. Returns a new full-res binary mask. Requires a base with
 *  both foreground and background (the u2net cut provides it). */
export async function grabCutRefine(
  image: HTMLCanvasElement, base: Mask, stroke: { x: number; y: number }[], brushPx: number, erase: boolean,
): Promise<Mask> {
  const cv = await loadCv()
  const W = image.width, H = image.height
  const scale = Math.min(1, GC_MAX / Math.max(W, H))
  const w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale))

  const dc = document.createElement('canvas'); dc.width = w; dc.height = h
  const dctx = dc.getContext('2d', { willReadFrequently: true })!
  dctx.drawImage(image, 0, 0, w, h)
  const src = cv.matFromImageData(dctx.getImageData(0, 0, w, h))
  const rgb = new cv.Mat(); cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB)

  // seed the grabcut mask from the current selection (probable fg / probable bg)
  const gc = new cv.Mat(h, w, cv.CV_8UC1)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const bx = Math.min(W - 1, Math.round(x / scale)), by = Math.min(H - 1, Math.round(y / scale))
    gc.data[y * w + x] = base.data[by * W + bx] ? cv.GC_PR_FGD : cv.GC_PR_BGD
  }
  // stamp the stroke swath as DEFINITE fg (add) or DEFINITE bg (erase) — the user's hard hint
  const r = Math.max(1, brushPx * scale)
  const mark = erase ? cv.GC_BGD : cv.GC_FGD
  let marked = 0
  for (const p of stroke) {
    const cx = p.x * scale, cy = p.y * scale
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r))
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy
      if (dx * dx + dy * dy <= r * r) { gc.data[y * w + x] = mark; marked++ }
    }
  }

  const out = new Uint8Array(W * H)
  const bgd = new cv.Mat(), fgd = new cv.Mat()
  try {
    if (marked > 0) cv.grabCut(rgb, gc, new cv.Rect(0, 0, w, h), bgd, fgd, GC_ITERS, cv.GC_INIT_WITH_MASK)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = Math.min(w - 1, Math.round(x * scale)), sy = Math.min(h - 1, Math.round(y * scale))
      const v = gc.data[sy * w + sx]
      out[y * W + x] = (v === cv.GC_FGD || v === cv.GC_PR_FGD) ? 1 : 0
    }
  } finally {
    src.delete(); rgb.delete(); gc.delete(); bgd.delete(); fgd.delete()
  }
  return { data: out, w: W, h: H }
}
