// editor/producers.ts — PRODUCER ADAPTERS (R8 — Creator v5 monolith split, seam 1).
//
// The pure "source producers" of the editor: given a shape kind + params + the canvas dims, build the
// VShape (or the transient preview ring `d`) that becomes the editor's OutlineSource. These are PURE
// functions — no React state, no store, no side effects — so they're unit-testable and swappable
// (swap-test: replace this module, the editor's source-seeding contract is unchanged). The stateful
// pickers in OutlineEditor (pickShape/nudgeParam/previewParam/commitShape/rerollBlob) call these with
// explicit args; the library-def kinds (circle/square/star/…) are produced directly via shape-library.

import { generateShapeRing, resampleClosed, type ShapeKind, type ShapeParams } from '../shapes'
import { ringToVPath, type VShape } from '@/lib/vector-core'
import { rdpClosed, type Vec2Px } from '@/lib/outline-core/math'

/** the parametric param bag the editor carries (every field optional; `kind` is passed separately). */
type ShapeParamBag = Omit<ShapeParams, 'kind'>
import { MIN_ANCHOR_SEPARATION_MM } from '@/lib/effect/geometry-truth'
import { maskFromImageData } from '@/lib/effect/image-shape'
import { smoothMask } from '@/lib/effect/mask'
import { traceContourRaw } from '@/lib/effect/contour'

export type Dims = { widthPx: number; heightPx: number }

// Run-3 live generators: dense internal sample → ONE Schneider fit at spawn → vector path out.
// Segments never leave the generator (blueprint modules/generators.md).
export const GEN_VECTOR_KINDS = new Set<ShapeKind>(['daisy', 'pinwheel', 'form', 'blob'])

/** display-only ring → SVG polyline `d` (transient previews render rings, never documents). */
function ringPathD(ring: ReadonlyArray<readonly [number, number]>): string { // KAI-9066: module-internal (only shapePreviewD uses it; no external consumer)
  return ring.length ? `M ${ring.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z` : ''
}

/** TRANSIENT PREVIEW ONLY: the live morph shown while a generator tick-bar drags — a display ring `d`,
 *  never geometry (commitShape fits ONCE into the vector on release). */
export function shapePreviewD(kind: ShapeKind, params: ShapeParamBag, dims: Dims): string {
  const { widthPx, heightPx } = dims
  const ring = resampleClosed(generateShapeRing({ ...params, kind }, widthPx, heightPx), Math.max(widthPx, heightPx) / 220)
  return ringPathD(ring)
}

/** Run 3: a live generator's output FITTED ONCE into a true vector path (sub-10ms). `mmPerPx` pins the
 *  finger-distinct pair floor (KAI-8974 — a PHYSICAL fact); falls back to the dims-based estimate. */
export function vecFromGenerator(kind: ShapeKind, params: ShapeParamBag, dims: Dims, mmPerPx?: number): VShape {
  const { widthPx, heightPx } = dims
  const ring = resampleClosed(generateShapeRing({ ...params, kind }, widthPx, heightPx), Math.max(widthPx, heightPx) / 600)
  const tol = Math.max(0.4, Math.min(widthPx, heightPx) / 1600)
  const minPair = MIN_ANCHOR_SEPARATION_MM / (mmPerPx || 70 / Math.max(widthPx, heightPx))
  const path = ringToVPath(ring.map(([x, y]) => ({ x, y })), 60, tol, undefined, tol * 2, minPair)
  return { paths: [path] }
}

/** Image upload (V4): decode → threshold mask → the SAME machinery as Magic — smoothMask →
 *  traceContourRaw → RDP-straight polygon. NO corner-pin, NO fairing: the result is a raw
 *  marching-squares OutlineSource; the editor's tools shape it (impartial with Magic / stock / drawn).
 *  Winding matches Magic's source (signedArea<0 in y-down editor space) so the mesh edge can never
 *  invert for an upload. The caller box-fits it before it becomes the source. */
export async function vecFromImageFile(file: File): Promise<VShape> {
  const bmp = await createImageBitmap(file)
  try {
    const MAX = 512
    const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height))
    const w = Math.max(2, Math.round(bmp.width * k)), h = Math.max(2, Math.round(bmp.height * k))
    const cv = document.createElement('canvas')
    cv.width = w; cv.height = h
    const ctx = cv.getContext('2d')!
    ctx.drawImage(bmp, 0, 0, w, h)
    const { mask, width, height } = maskFromImageData(ctx.getImageData(0, 0, w, h))
    // mask hygiene Magic applies before tracing — Otsu on anti-aliased edges leaves sub-px jitter.
    const ring = traceContourRaw(smoothMask(mask, width, height, 3), width, height)
    if (!ring) throw new Error('No clear shape found — try an image with a stronger silhouette')
    // canvas coords ARE y-down (= editor space). traceContourRaw normalizes CCW; reverse it so the
    // upload source matches Magic's source winding (signedArea<0 in y-down) — no edge inversion.
    const oriented = [...ring].reverse()
    const straight = rdpClosed(oriented.map(([x, y]) => [x, y] as Vec2Px), 1.0)
    if (straight.length < 3) throw new Error('No clear shape found — try an image with a stronger silhouette')
    return { paths: [{ anchors: straight.map(([x, y]) => ({ p: { x, y }, hIn: null, hOut: null, corner: true })) }] }
  } finally {
    bmp.close()
  }
}
