// cutout-wand — CONTRAST BUCKET sub-module, v2 (Dan device r4: 'the best there is').
// VENDOR: OpenCV.js floodFill — the industrial magic-wand (Photoshop-class): tolerance measured
// against the SEED in FIXED_RANGE mode, 8-connectivity, mask-only fill. Replaces magic-wand-tool
// (2014-era single-pixel-seed flood — leaked on photo noise) AND the glue fillHoles step (slop:
// a background flood that surrounded the object swallowed the object as an 'enclosed hole').
// Interface unchanged: tap in → region mask out. Loads lazily on first use (13MB wasm, cached).

export const WAND_TOLERANCE = 32 // Photoshop's classic default; live knob 4–100 in the shell

export interface WandMask { data: Uint8Array; w: number; h: number }

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

/** Pre-warm the wand engine (optional — first tap otherwise pays the one-time wasm init). */
export function warmWand(): void { void loadCv().catch(() => { cvReady = null }) }

/** Contrast-grown region from a tapped point (image px coords). Pixel I/O is module-owned. */
export async function wandRegion(image: HTMLCanvasElement, x: number, y: number, tolerance: number = WAND_TOLERANCE): Promise<WandMask> {
  const cv = await loadCv()
  const w = image.width, h = image.height
  const id = image.getContext('2d')!.getImageData(0, 0, w, h)
  const src = cv.matFromImageData(id)          // RGBA
  const rgb = new cv.Mat()
  cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB)
  const mask = cv.Mat.zeros(h + 2, w + 2, cv.CV_8UC1)
  const seed = new cv.Point(Math.max(0, Math.min(w - 1, Math.round(x))), Math.max(0, Math.min(h - 1, Math.round(y))))
  const lo = new cv.Scalar(tolerance, tolerance, tolerance)
  const up = new cv.Scalar(tolerance, tolerance, tolerance)
  // FIXED_RANGE = Photoshop semantics (diff vs the SEED, not the neighbor — no gradient creep);
  // MASK_ONLY: the image is never mutated; 8-connectivity; fill value 255 into the mask.
  const flags = 8 | cv.FLOODFILL_MASK_ONLY | cv.FLOODFILL_FIXED_RANGE | (255 << 8)
  cv.floodFill(rgb, mask, seed, new cv.Scalar(0, 0, 0), new cv.Rect(), lo, up, flags)
  const out = new Uint8Array(w * h)
  const md = mask.data, stride = w + 2
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) out[yy * w + xx] = md[(yy + 1) * stride + (xx + 1)] ? 1 : 0
  src.delete(); rgb.delete(); mask.delete()
  return { data: out, w, h }
}
