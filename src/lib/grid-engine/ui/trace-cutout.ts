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
import { rdpClosed, type Vec2Px } from '@/lib/outline-core/math'
import { MIN_FEATURE_MM } from '@/lib/effect/geometry-truth'
import { DEFAULT_LAW } from '@/lib/grid-engine/compute/grid-core'

/** The silhouette as fractions of the picture's own box. */
export type OutlineUV = Array<[number, number]>

export async function traceCutout(file: File): Promise<OutlineUV | null> {
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
  // THE ORIGINAL SILHOUETTE, untouched — what the screen draws is the shape as traced.
  return ring.map(([x, y]) => [x / w, y / h] as [number, number])
}

/**
 * THE ENGINE'S COPY of a traced silhouette — v1's own simplification law applied, nothing else.
 *
 * Verbatim v1 semantics (prepare-effect.ts, Dan 2026-06-17): the cut process cannot render detail
 * under the manufacturing minimum feature, so the marching-squares staircase collapses to straight
 * facets via RDP at that mm floor — mm-true at the largest rung the system publishes. This is what
 * v1 ALWAYS fed its grid engine; the raw ring is thousands of points of uncuttable detail.
 *
 * The DISPLAYED outline is never this one. The screen shows the original; the engine receives the
 * manufacturable shape, exactly as in v1.
 */
export function engineOutline(outline: OutlineUV): OutlineUV {
  const epsilonUV = MIN_FEATURE_MM / DEFAULT_LAW.maxRungMM
  const straight = rdpClosed(outline.map(([u, v]) => [u, v] as Vec2Px), epsilonUV)
  return straight.length >= 3 ? straight.map(([u, v]) => [u, v] as [number, number]) : outline
}
