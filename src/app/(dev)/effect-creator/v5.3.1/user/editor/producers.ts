// editor/producers.ts — PRODUCER ADAPTERS (R8 — Creator v5 monolith split, seam 1).
//
// The pure "source producers" of the editor: given a shape kind + params + the canvas dims, build the
// VShape (or the transient preview ring `d`) that becomes the editor's OutlineSource. These are PURE
// functions — no React state, no store, no side effects — so they're unit-testable and swappable
// (swap-test: replace this module, the editor's source-seeding contract is unchanged). The stateful
// pickers in OutlineEditor (pickShape/nudgeParam/previewParam/commitShape/rerollBlob) call these with
// explicit args; the library-def kinds (circle/square/star/…) are produced directly via shape-library.

import { generateShapeRing, resampleClosed, type ShapeKind, type ShapeParams } from '../shapes'
import { ringToVPath, flattenPath, type VShape, type VPath } from '@/lib/vector-core'
import { rdpClosed, repairSimplePolygon, type Vec2Px } from '@/lib/outline-core/math'
import { insetRingMM, type OffsetJoin } from '@/lib/effect/offset'

/** the parametric param bag the editor carries (every field optional; `kind` is passed separately). */
type ShapeParamBag = Omit<ShapeParams, 'kind'>
import { MIN_ANCHOR_SEPARATION_MM } from '@/lib/effect/geometry-truth'
import { maskFromImageData } from '@/lib/effect/image-shape'
import { smoothMask } from '@/lib/effect/mask'
import { traceContourRaw } from '@/lib/effect/contour'
import {
  GLOBAL_OFF,
  mintIds,
  outlineCurveFactor,
  outlineRadiusPx,
  resolve,
  type LocalAdjustment,
  type OutlineSource,
} from '@/lib/effect/outline-resolve'

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

// ── GENERATION controls (KAI-9127 Detail / 9128 Offset) — re-derive the SOURCE from the cached AI trace,
//    no AI re-run (DEC-v5-04 / blueprint v5.2 §5). Dan-validated mappings (branch v5poc-detail). ──

/** Detail %: 100 = tightest pixel-clean (RDP floored to ~1px); 0 = coarsest facets. mm-true / scale-invariant. */
export const DETAIL_TIGHT_MM = 0
export const DETAIL_COARSE_MM = 10
export const detailToFloorMm = (pct: number) => {
  const d = Math.max(0, Math.min(100, pct)) / 100
  return DETAIL_COARSE_MM + d * (DETAIL_TIGHT_MM - DETAIL_COARSE_MM)
}
/** Inverse: the Detail % that corresponds to a given mm-floor — so the dial reflects the BORN trace's
 *  detail (value-reflection) instead of a guessed default. */
export const floorMmToDetail = (mm: number) => {
  const span = DETAIL_TIGHT_MM - DETAIL_COARSE_MM || 1
  return Math.round(Math.max(0, Math.min(100, ((mm - DETAIL_COARSE_MM) / span) * 100)))
}
/** Offset %: 0 → 0; 100 → the image's longest side (mm) so it can reach the image edges (bridge split subjects). */
export const offsetPctToMm = (pct: number, imgLongestMm: number) => (Math.max(0, Math.min(100, pct)) / 100) * imgLongestMm

/**
 * GENERATION re-derive: rebuild the editor's SHARP `OutlineSource` shape from the cached raw AI trace at a
 * chosen Detail (+ optional Offset), with NO AI re-run. Detail = RDP simplify to the mm-floor (tight↔coarse);
 * `repairSimplePolygon` drops degenerate/crossing vertices so the staircase can't tear the mesh; Offset
 * (applied LAST, no re-simplify) = Clipper2 outset with the chosen join, expand-only. De-staircasing into
 * smooth curves is the editor's Simplify tool (resolve adjustor), NOT here — this stays a raw sharp polygon
 * source (Generation births the raw sharp geometry; Editing shapes it). Returns null if degenerate.
 */
export function traceSourceFromRaw(
  rawTracePx: ReadonlyArray<readonly [number, number]>, maskHeightPx: number, mmPerPx: number,
  detailPct: number, offsetMM: number, join: OffsetJoin,
): VShape | null {
  if (!rawTracePx.length) return null
  const eps = Math.max(1, detailToFloorMm(detailPct) / (mmPerPx || 1))
  const yDown = rawTracePx.map(([x, y]) => [x, maskHeightPx - y] as Vec2Px)
  let pts = rdpClosed(yDown, eps)
  pts = repairSimplePolygon(pts, 1)
  if (pts.length < 3) return null
  let path: VPath = { anchors: pts.map(([x, y]) => ({ p: { x, y }, hIn: null, hOut: null, corner: true })) }
  if (offsetMM > 0) {
    const k = mmPerPx || 1
    const ringMM = flattenPath(path, 0.3).map((p) => [p.x * k, p.y * k] as [number, number])
    const off = insetRingMM(ringMM, offsetMM, join)
    if (off && off.length >= 3) path = { anchors: off.map(([x, y]) => ({ p: { x: x / k, y: y / k }, hIn: null, hOut: null, corner: true })) }
  }
  return { paths: [path] }
}

export interface TraceOutlineInput {
  vectorShape: VShape
  rawTracePx?: ReadonlyArray<readonly [number, number]>
  maskWidthPx: number
  maskHeightPx: number
  mmPerPx: number
}

export interface TraceOutlineSettings {
  detail: number
  offset: number
  offsetJoin: OffsetJoin
  radius: number
  curve: number
  simplify: number
  smooth: number
  straighten: number
}

/** The reflected v5 birth recipe: full trace fidelity, no optional vector reshaping applied. */
export const TRACE_OUTLINE_DEFAULTS: TraceOutlineSettings = {
  detail: 100,
  offset: 0,
  offsetJoin: 'sharp',
  radius: 0,
  curve: 0,
  simplify: 0,
  smooth: 0,
  straighten: 0,
}

/** Apply the existing v5.3.1 generation + whole-outline controls without its UI/store/history shell. */
export function resolveTraceOutline(
  input: TraceOutlineInput,
  settings: TraceOutlineSettings,
): VShape | null {
  const generationChanged = settings.detail !== 100 || settings.offset > 0
  const raw = input.rawTracePx
  const sourceShape = generationChanged && raw?.length
    ? traceSourceFromRaw(
        raw,
        input.maskHeightPx,
        input.mmPerPx,
        settings.detail,
        offsetPctToMm(
          settings.offset,
          Math.max(input.maskWidthPx, input.maskHeightPx) * input.mmPerPx,
        ),
        settings.offsetJoin,
      )
    : input.vectorShape
  if (!sourceShape) return null

  const shape = settings.curve > 0 ? mintIds(sourceShape) : sourceShape
  const local: Record<string, LocalAdjustment> = {}
  if (settings.curve > 0) {
    const curve = outlineCurveFactor(settings.curve)
    for (const path of shape.paths) for (const anchor of path.anchors) {
      if (anchor.id) local[anchor.id] = { curve }
    }
  }
  const source: OutlineSource = {
    shape,
    klass: 'generated',
    mmPerPx: input.mmPerPx,
    maskHeightPx: input.maskHeightPx,
    rawTracePx: raw ? raw.map(([x, y]) => [x, y]) : undefined,
  }
  const global = {
    ...GLOBAL_OFF,
    simplify: settings.simplify,
    smooth: settings.smooth,
    straighten: settings.straighten,
  }
  const withoutRadius = resolve(source, { global, local })
  return resolve(source, {
    global: {
      ...global,
      radius: outlineRadiusPx(settings.radius, withoutRadius),
    },
    local,
  })
}
