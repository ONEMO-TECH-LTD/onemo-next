// Shaped-effect 2D compositing primitives (Lane A / Kai) — PURE 2D canvas, NO three.js.
//
// The ONE magic-blend composite lives here so BOTH the (legacy) 3D pipeline and the new 2D-first
// `prepareEffect` import the SAME composeFront (composite parity, lean-spec §5.2) without dragging
// three.js into the Phase-A (WebGL-free) creation path. `pipeline.ts` re-exports composeFront for
// its existing consumers; `prepare-effect.ts` imports it here directly.

/**
 * Compose the front texture: a SHARP subject over a BLURRED copy of the real-photo background.
 * `bgBlurPx = 0` → no blur (the full sharp original photo = effect OFF). Used for the default build
 * AND for live editor re-blur (toggle / intensity) — same source canvases, no re-segmentation.
 */
export function composeFront(
  origCanvas: HTMLCanvasElement,
  subjCanvas: HTMLCanvasElement,
  bgBlurPx: number,
): HTMLCanvasElement {
  const fw = origCanvas.width, fh = origCanvas.height
  const front = document.createElement('canvas')
  front.width = fw; front.height = fh
  const ctx = front.getContext('2d')!
  if (bgBlurPx > 0) { ctx.filter = `blur(${bgBlurPx}px)`; ctx.drawImage(origCanvas, 0, 0); ctx.filter = 'none' }
  else ctx.drawImage(origCanvas, 0, 0)
  ctx.drawImage(subjCanvas, 0, 0, fw, fh) // sharp subject on top of the (blurred) real background
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
