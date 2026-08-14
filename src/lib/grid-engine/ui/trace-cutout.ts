// grid-engine shell — the ADMIN SHELL'S OWN LOGIC FILE, by necessity only (law 1.1).
//
// Reading a file, decoding an image and calling the Cutout Lab's tracer are browser IO and a sibling
// module. The portable unit may touch none of them (law 1.1a), so they live here on the scaffolding.
//
// The outline comes back in the PICTURE'S OWN FRACTIONS — 0..1 across and down — so drawing it is a
// plain multiply against whatever box the picture currently occupies. No millimetres are decided
// here, nothing is handed to the engine, and no size is implied (law 12.1).
//
// No y-flip: image space runs down and so does the SVG's, which is exactly why flipping it once
// before turned the shape upside down.

import { traceContourRaw } from '@/lib/effect/contour'

/** The silhouette as fractions of the picture's own box. */
export type OutlineUV = Array<[number, number]>

/**
 * What the tracer actually produced: the ring in the source image's own INTEGER PIXEL coordinates,
 * with the image box it came from.
 *
 * It was being discarded — only the UV projection was returned — so anything downstream would have
 * had to reconstruct raw coordinates by multiplying UV back up, which is a lossy round trip through
 * data we already had exactly. Preserving it is browser-IO preparation, not geometry: no value here
 * is computed, only kept.
 */
export interface TracedCutout {
  readonly outlineUV: OutlineUV
  readonly ring: {
    readonly points: ReadonlyArray<readonly [number, number]>
    readonly width: number
    readonly height: number
  }
}

export async function traceCutout(file: File): Promise<TracedCutout | null> {
  const bitmap = await createImageBitmap(file)
  const w = bitmap.width
  const h = bitmap.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const data = ctx.getImageData(0, 0, w, h).data
  const mask = new Uint8Array(w * h)
  let opaque = 0
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] > 128) {
      mask[i] = 1
      opaque++
    }
  }
  // A cut-out has transparency. Without it there is no silhouette, only the picture's own border —
  // tracing that gives a rectangle, which is how a "real traced contour" turned out to be a frame.
  if (opaque === 0 || opaque > w * h * 0.995) return null

  const ring = traceContourRaw(mask, w, h)
  if (!ring || ring.length < 3) return null
  return {
    outlineUV: ring.map(([x, y]) => [x / w, y / h] as [number, number]),
    ring: { points: ring.map(([x, y]) => [x, y] as const), width: w, height: h },
  }
}
