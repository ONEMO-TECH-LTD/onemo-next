// prepare-effect.ts — the 2D-first, ONE-ENGINE effect preparation (lean-spec §8.2).
//
// PURE 2D: segmentation + contour TRACER + the magic-blend composite, with ALL geometry resolution
// (simplification, corner-rounding, smoothing, winding, self-intersection) routed through the single
// deterministic `outline-core` engine — NOT the legacy `contour.ts` fork. Produces a `EffectSpecDraft`
// (mm geometry, shape-compatible with the existing draft so the editor/consumers are unchanged) + the
// composite canvases. There is **no `three` import here**: the 3D half is `buildMeshFromSpec` (Phase B).
//
// `prepareEffect(url, 'standard')` = the instant flat ONEMO square (full photo, rounded corners via
// outline-core). `prepareEffect(url, 'shaped')` = BEN subject silhouette. Both collapse the two old
// builders (buildSquareShape / buildShape) into one path that grounds geometry in mm through one engine.
//
// THREE-FREE: the marching-squares tracer in `contour.ts` is tracer-only (the legacy fork that used
// three.js — smoothClosed/filletCorners — was retired in §8.2b-2), so the whole creation graph is
// three-free; the 3D half is `buildMeshFromSpec` (Phase B), the only place three.js is touched.

import type { Contour, Pt, EffectSpecDraft } from './types'

/**
 * Build params for the effect engine (geometry sizing + texture res). `minCornerAngleDeg` /
 * `cornerRadiusMM` are unused (outline-core owns corner rounding) — kept for shape-API compatibility.
 */
export interface ShapeBuildConfig {
  longestSideMM: number   // physical size of the effect's longest side
  thicknessMM: number     // body thickness (§9: 1mm)
  edgeRadiusMM: number    // SHORT rounded-edge fillet radius
  edgeSegments: number
  rdpEpsilonMM: number
  maxImageDim: number     // mask/contour downscale cap
  textureDim: number      // front-texture cap (high res so the projected image stays sharp)
  paddingMM: number       // flat image margin around the subject
  minCornerAngleDeg: number // unused (outline-core owns rounding) — kept for API compat
  cornerRadiusMM: number    // unused (outline-core owns rounding) — kept for API compat
  squareCornerMM: number    // corner radius of the standard square
}
import { loadImageData, segment, adapterIdFor, dilateMask, smoothMask, type MaskResult } from './mask'
import { segmentML, ML_ADAPTER_ID } from './segment-ml'
import { traceContourRaw } from './contour'
import { composeFront, blurCanvas, imageDataToCanvas } from './composite'
import type { EffectType } from './effect-types'
import {
  applyOutlineCommands,
  resolveOutlineDocument,
  repairSimplePolygon,
  rdpClosed,
  contentHash,
  type OutlineDocument,
  type OutlineNode,
  type OutlineGenerator,
  type Vec2Px,
} from '@/lib/outline-core'

/**
 * Config for the 2D-first path. Carries forward the proven build values but pins
 * §9/§9a: 1mm body + 70mm base. (Note §9: edgeRadiusMM 0.15 was tuned for a 0.5mm body — the
 * rounded-lip radius must be re-pinned for the 1mm body; tracked as a §9 follow-up.) minCornerAngleDeg
 * / cornerRadiusMM are unused here (outline-core owns rounding) but kept for type compatibility.
 */
export const EFFECT_BUILD_CONFIG: ShapeBuildConfig = {
  longestSideMM: 70, // §9a: 70mm base square
  thicknessMM: 1, // §9: 1mm body (supersedes 0.5)
  edgeRadiusMM: 0.15, // §9 follow-up: re-pin lip radius for the 1mm body
  edgeSegments: 14,
  rdpEpsilonMM: 0.4,
  maxImageDim: 1200,
  textureDim: 2400,
  paddingMM: 1.5,
  minCornerAngleDeg: 135, // unused (rounding via outline-core) — kept for ShapeBuildConfig compat
  cornerRadiusMM: 24, // unused (rounding via outline-core) — kept for ShapeBuildConfig compat
  squareCornerMM: 8, // ONEMO square 8mm corners
}

export interface PreparedEffect {
  /** mm draft spec — shape-compatible with the legacy EffectSpecDraft (editor/consumers unchanged). */
  spec: EffectSpecDraft
  /** the canonical outline document the geometry was resolved from (provenance; persistence later). */
  outlineDocument: OutlineDocument
  /** the ONE magic-blend front composite (Phase-A hero face = 3D front texture = print artwork). */
  composite: HTMLCanvasElement
  /** strongly-blurred edge-lip composite (smooth rim colour, no banding). */
  edgeComposite: HTMLCanvasElement
  /** source layers for live re-blend (toggle / intensity) without re-segmentation. */
  frontSrc: { origCanvas: HTMLCanvasElement; subjCanvas: HTMLCanvasElement; defaultBlurPx: number }
  widthMM: number
  heightMM: number
}

function bbox(pts: ReadonlyArray<Pt | Vec2Px>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

/**
 * Largest global corner radius in [0, hi] that resolves WITHOUT a self-intersection (mirrors the
 * editor's self-correcting default rounding) — binary-searches resolve(doc @ r) so the default round
 * adapts per shape instead of a blind value that might cross on tight geometry.
 */
function maxSafeGlobalRadius(doc: OutlineDocument, hi: number): number {
  const clean = (r: number) =>
    resolveOutlineDocument(
      { ...doc, style: { ...doc.style, globalOutlineCornerRadiusPx: r } },
      { flattenTolerancePx: 0.5 },
    ).issues.length === 0
  if (clean(hi)) return hi
  let lo = 0, h = hi
  for (let i = 0; i < 14 && h - lo > 2; i++) { const m = (lo + h) / 2; if (clean(m)) lo = m; else h = m }
  return Math.floor(lo)
}

/** Build an OutlineDocument from a raw pixel ring (clean → control nodes), resolved corners via outline-core. */
function docFromRawRing(
  ringPx: Vec2Px[],
  W: number,
  H: number,
  sourceHash: string,
  generator: OutlineGenerator,
  type: EffectType,
  radiusPx: number,
  selfCorrect: boolean,
): OutlineDocument {
  const eps = type === 'shaped' ? Math.max(2, Math.max(W, H) * 0.022) : 1
  const minSpacing = Math.max(3, Math.max(W, H) * 0.008)
  const cleaned = repairSimplePolygon(rdpClosed(ringPx, eps), minSpacing)
  const ctrl = cleaned.length >= 3 ? cleaned : ringPx
  const nodes: OutlineNode[] = ctrl.map((p, i) => ({
    id: `n${i}`,
    p: [p[0], p[1]] as Vec2Px,
    role: 'corner',
    corner: { mode: 'inherit' },
  }))
  const image = { widthPx: W, heightPx: H, sourceHash, orientation: 'baked' as const }
  const env = { image, mode: (type === 'shaped' ? 'auto' : 'semi_auto') as 'auto' | 'semi_auto' }
  const base = (radius: number) => ({
    rings: [{ id: 'r1', role: 'outer' as const, closed: true as const, nodes }],
    // shaped (organic) outlines carry default spline smoothing: the sparse control ring renders as
    // CURVES between anchors instead of chord facets (the choppy-pill bug, Dan 2026-06-10).
    style: { globalOutlineCornerRadiusPx: radius, smoothing: type === 'shaped' ? 0.55 : 0 },
    generator,
  })
  // self-correct: pick the largest non-self-intersecting radius for the cut-out (square uses its fixed 8mm)
  const safe = selfCorrect ? maxSafeGlobalRadius(applyOutlineCommands(base(0), [], env), radiusPx) : radiusPx
  return applyOutlineCommands(base(safe), [], env)
}

/**
 * G2 (blueprint §7): the subject's COLOUR pixels come from the user's ORIGINAL full-resolution
 * photo; the segmentation matte supplies the SHAPE (alpha) only. The model's returned RGB runs at
 * its internal processing resolution — using it as the texture is what made new images pixelated.
 * Both canvases are y-up; the matte stretches to the original's dims (soft alpha edge = the cut edge).
 */
function subjectFromOriginal(origCanvas: HTMLCanvasElement, matteCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = origCanvas.width
  c.height = origCanvas.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(origCanvas, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(matteCanvas, 0, 0, c.width, c.height)
  ctx.globalCompositeOperation = 'source-over'
  return c
}

/**
 * Prepare an effect (2D, one-engine). `type='standard'` = instant flat ONEMO square; `type='shaped'` =
 * BEN subject silhouette. Returns the mm draft + the composite canvases (NO three).
 * `onProgress` surfaces the shaped path's honest wait states (G5: download vs inference).
 */
export async function prepareEffect(
  url: string,
  type: EffectType,
  cfg: ShapeBuildConfig = EFFECT_BUILD_CONFIG,
  onProgress?: (s: 'downloading-model' | 'cutting' | 'fallback') => void,
): Promise<PreparedEffect> {
  // Full photo (texture res), y-up, for the composite + edge-lip source.
  const orig = await loadImageData(url, cfg.textureDim)
  const fw = orig.width, fh = orig.height
  const origCanvas = imageDataToCanvas(orig)
  const sourceHash = contentHash(url)

  let ringPx: Vec2Px[]
  let W: number, H: number
  let mmPerPx: number
  let subjCanvas: HTMLCanvasElement
  let defaultBlurPx: number
  let generator: OutlineGenerator
  let adapterId: string
  let selfCorrect: boolean
  let radiusHiPx: number

  if (type === 'shaped') {
    // BEN subject segmentation (fallback: flood-fill). seg.mask is already post-processed.
    let seg: MaskResult
    let texImage: ImageData
    let mlMatte = false
    try {
      const r = await segmentML(url, cfg.maxImageDim, cfg.textureDim, onProgress)
      seg = r; adapterId = ML_ADAPTER_ID; texImage = r.texImage; mlMatte = true
    } catch (e) {
      console.warn('[shaped] ML segmentation unavailable — falling back to flood-fill:', e)
      onProgress?.('fallback') // G4: a degraded cut must never be silent
      const img = await loadImageData(url, cfg.textureDim)
      seg = segment(img); adapterId = adapterIdFor(img); texImage = seg.imageData
    }
    const { mask, width, height } = seg
    W = width; H = height
    // mmPerPx from the raw silhouette bbox (longest side → longestSideMM)
    const coarse = traceContourRaw(mask, width, height)
    if (!coarse) throw new Error('No silhouette found — try an image with a clearer subject/background.')
    const cb = bbox(coarse)
    mmPerPx = cfg.longestSideMM / Math.max(cb.w, cb.h, 1)
    // padding (flat image margin) + symmetric denoise, then the raw tracer
    const padPx = Math.max(0, Math.round(cfg.paddingMM / mmPerPx))
    const dilated = padPx > 0 ? dilateMask(mask, width, height, padPx) : mask
    const workMask = smoothMask(dilated, width, height, 3)
    const raw = traceContourRaw(workMask, width, height)
    if (!raw) throw new Error('Contour build failed after segmentation.')
    ringPx = raw
    // G2: subject COLOUR from the ORIGINAL full-res photo; the matte supplies alpha (shape) only.
    // (Fallback flood-fill has no alpha matte — its texImage IS the source pixels, used as-is.)
    subjCanvas = mlMatte ? subjectFromOriginal(origCanvas, imageDataToCanvas(texImage)) : imageDataToCanvas(texImage)
    defaultBlurPx = Math.max(6, Math.round(fw / 50))
    generator = { type: 'ben2_auto', maskHash: contentHash(`${sourceHash}:${width}x${height}`) }
    selfCorrect = true
    radiusHiPx = Math.round(Math.min(W, H) * 0.25)
  } else {
    // square: the full-image rectangle; outline-core rounds the 8mm corners (one engine, no pre-rounding)
    W = fw; H = fh
    mmPerPx = cfg.longestSideMM / Math.max(fw, fh, 1)
    ringPx = [[0, 0], [fw, 0], [fw, fh], [0, fh]]
    subjCanvas = origCanvas // no matte → blend is a no-op (subj = full photo, blur 0)
    defaultBlurPx = 0
    generator = { type: 'manual' } // standard square has no BEN provenance; the SDF-blend generator is wired with Hug later
    adapterId = 'standard'
    selfCorrect = false
    radiusHiPx = cfg.squareCornerMM / mmPerPx
  }

  // ── ONE ENGINE: raw ring → OutlineDocument → resolveOutlineDocument (corners via applyCornerRadii,
  //    NOT contour.filletCorners; policy.downstream_corner_rounding === 'disabled') → flattened mm.
  const outlineDocument = docFromRawRing(ringPx, W, H, sourceHash, generator, type, radiusHiPx, selfCorrect)
  const resolved = resolveOutlineDocument(outlineDocument, { flattenTolerancePx: 0.5 })
  const outerFlatPx = resolved.flattenedRingsPx[0] ?? ringPx
  const outerMM: Pt[] = outerFlatPx.map(([x, y]) => [x * mmPerPx, y * mmPerPx] as Pt)
  const geometryMM: Contour = { outer: { pts: outerMM }, holes: [] } // solid cut-out (Dan, §9)
  const bb = bbox(outerMM)
  const widthMM = bb.w, heightMM = bb.h

  // ── composite (the ONE magic-blend) + edge-lip source (strong blur). Reused, never re-composed per surface.
  const composite = composeFront(origCanvas, subjCanvas, defaultBlurPx)
  const edgeComposite = blurCanvas(origCanvas, Math.max(16, Math.round(fw / 22)))

  const spec: EffectSpecDraft = {
    sourceRef: url,
    maskWidthPx: W,
    maskHeightPx: H,
    mmPerPx,
    geometryMM,
    dimensions: { thicknessBodyMM: cfg.thicknessMM, edgeRadiusMM: cfg.edgeRadiusMM, widthMM, heightMM },
    generator: { adapter: adapterId, lane: 'kai', version: '0.3.0' },
    diagnostics: {
      rawContourNodes: ringPx.length,
      simplifiedNodes: outerFlatPx.length,
      holes: 0,
      rdpEpsilonMM: cfg.rdpEpsilonMM,
    },
  }

  return {
    spec,
    outlineDocument,
    composite,
    edgeComposite,
    frontSrc: { origCanvas, subjCanvas, defaultBlurPx },
    widthMM,
    heightMM,
  }
}
