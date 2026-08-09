// cutout-grabcut — the LIGHT refinement brush (Dan 2026-08-07). Paint roughly over a missed area;
// GrabCut (OpenCV iterated graph-cut) snaps to the real colour edges and adds it to the selection
// (or carves it, on erase). NO deep model; runs on the OpenCV we already ship for
// nothing extra to download. Loads OpenCV lazily on the first stroke, never at page open.

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

// GrabCut is O(pixels·iterations); cap the work resolution so a stroke stays well under a second on
// a phone. The raw result is upscaled back to full res; the completed engine matte owns the
// nearest-neighbour edge polish. 512 is Photoshop-refine territory and keeps edges faithful.
const GC_MAX = 512        // work-resolution cap (grabcut is O(pixels·iters))
const GC_ITERS = 3        // graph-cut iterations
const HALO_MULT = 3       // standalone: probable-fg halo radius = HALO_MULT × brush (a colour model to grow from)
const CORRIDOR_MULT = 2.5 // refine: the grabcut label only applies within CORRIDOR_MULT × brush of the stroke
const CORRIDOR_MIN_PX = 24 // floor for the refine corridor radius (full-res px)

/** GrabCut brush (Dan 2026-08-07: a SEPARATE tool that recognises a shape ON ITS OWN, and also
 *  refines the u2net cut). Two modes, chosen by whether a base selection exists:
 *   • STANDALONE (no base): paint roughly over an object → grabcut grows from the stroke to the
 *     object's real edges and returns that whole shape (no corridor — there is nothing to protect).
 *   • REFINE (base exists): add/erase the stroke region, bounded to a corridor so the rest of the
 *     cut is preserved (erase can't destroy, add can't over-reach — meta R12-1).
 *  `stroke` points are FULL-RES image px; `brushPx` the swath radius. */
export async function grabCutRefine(
  image: HTMLCanvasElement, base: Mask | null, stroke: { x: number; y: number }[], brushPx: number, erase: boolean,
): Promise<Mask> {
  const W = image.width, H = image.height
  let baseArea = 0
  if (base) for (let i = 0; i < base.data.length; i++) if (base.data[i]) baseArea++
  const fromScratch = baseArea === 0 // no cut yet → recognise the painted shape on its own
  if (fromScratch && erase) return { data: base ? new Uint8Array(base.data) : new Uint8Array(W * H), w: W, h: H } // nothing to carve; do not load or allocate OpenCV

  const cv = await loadCv()
  const scale = Math.min(1, GC_MAX / Math.max(W, H))
  const w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale))

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
  if (fromScratch) {
    // STANDALONE: bg everywhere, a generous halo of PROBABLE fg around the stroke (a fg colour
    // model to grow from), the stroke swath itself DEFINITE fg. GrabCut expands to the object edge.
    gc.data.fill(cv.GC_PR_BGD)
    for (const p of stroke) stamp(p.x * scale, p.y * scale, r * HALO_MULT, cv.GC_PR_FGD)
    for (const p of stroke) { stamp(p.x * scale, p.y * scale, r, cv.GC_FGD); marked++ }
  } else {
    // REFINE: seed from the current selection, stamp the stroke as hard fg (add) / bg (erase)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const bx = Math.min(W - 1, Math.round(x / scale)), by = Math.min(H - 1, Math.round(y / scale))
      gc.data[y * w + x] = base!.data[by * W + bx] ? cv.GC_PR_FGD : cv.GC_PR_BGD
    }
    for (const p of stroke) { stamp(p.x * scale, p.y * scale, r, erase ? cv.GC_BGD : cv.GC_FGD); marked++ }
  }

  const out = new Uint8Array(base ? base.data : new Uint8Array(W * H)) // refine starts from base; scratch from empty
  const bgd = new cv.Mat(), fgd = new cv.Mat()
  try {
    if (marked > 0) cv.grabCut(rgb, gc, new cv.Rect(0, 0, w, h), bgd, fgd, GC_ITERS, cv.GC_INIT_WITH_MASK)
    const fg = (v: number) => v === cv.GC_FGD || v === cv.GC_PR_FGD
    if (fromScratch) {
      // STANDALONE: the whole grabcut result IS the recognised shape (no corridor — nothing to protect)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const sx = Math.min(w - 1, Math.round(x * scale)), sy = Math.min(h - 1, Math.round(y * scale))
        out[y * W + x] = fg(gc.data[sy * w + sx]) ? 1 : 0
      }
    } else {
      // REFINE — CORRIDOR BOUND (meta R12-1): cv.grabCut relabels EVERY probable pixel globally, so on
      // a colour-uniform subject an erase stroke could flip the WHOLE object to background. Apply the
      // grabcut label only INSIDE a corridor around the stroke; everywhere else the base is preserved.
      // The snap stays local — erase can't destroy, add can't over-reach (erase-bounded-by-gesture).
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
    src.delete(); rgb.delete(); gc.delete(); bgd.delete(); fgd.delete()
  }
  return { data: out, w: W, h: H }
}
