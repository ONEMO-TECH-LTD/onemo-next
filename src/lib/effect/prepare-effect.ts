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

import type { Pt, EffectSpecDraft } from './types'

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
  minFeatureMM?: number   // manufacturing min-feature floor for the Magic trace (overrides MIN_FEATURE_MM); tunable
  maxImageDim: number     // mask/contour downscale cap
  textureDim: number      // front-texture cap (high res so the projected image stays sharp)
  paddingMM: number       // flat image margin around the subject
  edgeFinishPx?: number   // optional caller-owned contour edge radius; legacy engine default stays 3
  minCornerAngleDeg: number // unused (outline-core owns rounding) — kept for API compat
  cornerRadiusMM: number    // unused (outline-core owns rounding) — kept for API compat
  squareCornerMM: number    // corner radius of the standard square
}
import { loadImageData, segment, adapterIdFor, dilateMask, smoothMask, effectiveTextureDim, type MaskResult } from './mask'
import { segmentML, type MLResult } from './segment-ml'
import { traceContourRaw } from './contour'
import { blendPixelsToPercent, composeEffectArtwork, blurCanvas, imageDataToCanvas } from './composite'
import type { EffectType } from './effect-types'
import { rdpClosed, type Vec2Px } from '@/lib/outline-core/math'
// REBUILD-PLAN-v2 §B1 — truth at birth: geometry is born as ONE VShape; the manufacturing contour
// is DERIVED from it. Shaped generation emits the RAW marching-squares straight polygon (no Stage B).
import { contourFromShape, MIN_FEATURE_MM } from './geometry-truth'
import { DEFAULT_ROUNDED_SQUARE_CALIBRATION } from './effect-calibration'
import { roundedSquareShape } from './rounded-square'
import { type VShape } from '@/lib/vector-core'
// RAW-TRACE simplification floor (Dan 2026-06-15): the sub-pixel marching-squares-staircase floor.
// The ACTUAL trace simplification is mm-floored to the manufacturing minimum-feature size
// (MIN_FEATURE_MM, see geometry-truth) so a clean object traces as a clean straight-faceted polygon;
// this px value is only the lower bound so the epsilon never drops below the sampling grid. NOT
// smoothing — fewer facets, sharp corners kept; the editor owns shaping post-generation.
const RAW_TRACE_RDP_PX = 1.0

/**
 * Config for the 2D-first path. Carries forward the proven build values but pins
 * §9/§9a: 1mm body + 70mm base. (Note §9: edgeRadiusMM 0.15 was tuned for a 0.5mm body — the
 * rounded-lip radius must be re-pinned for the 1mm body; tracked as a §9 follow-up.) minCornerAngleDeg
 * / cornerRadiusMM are unused here (outline-core owns rounding) but kept for type compatibility.
 */
export const EFFECT_BUILD_CONFIG: ShapeBuildConfig = {
  longestSideMM: 70, // §9a: 70mm base square
  thicknessMM: 1, // §9: 1mm body (supersedes 0.5)
  // EDGE PROFILE (Dan, 2026-06-15 — ACCEPTED fix, kept): "almost straight everywhere with slightly
  // rounded edges — no groove, no full rounded bevel." On the 1mm body, 0.5mm = r = half = a FULL
  // half-round (the outward lip Dan rejected). 0.2mm = a real ~0.6mm straight wall + a short 0.2mm
  // soft corner top & bottom = straight cut, softly rounded. The groove was the post-gen winding
  // inversion, fixed in mesh.ts (canonical CCW / orientRing). (NOT parked — regressing this is wrong;
  // the mesh-edge test + payload golden are updated to THIS straight-wall design.)
  edgeRadiusMM: 0.2,
  edgeSegments: 18,
  rdpEpsilonMM: 0.4,
  minFeatureMM: MIN_FEATURE_MM, // Magic-trace simplification floor (Dan-tunable; see geometry-truth)
  maxImageDim: 1200,
  textureDim: 2400,
  paddingMM: 1.5,
  minCornerAngleDeg: 135, // unused (rounding via outline-core) — kept for ShapeBuildConfig compat
  cornerRadiusMM: 24, // unused (rounding via outline-core) — kept for ShapeBuildConfig compat
  squareCornerMM: DEFAULT_ROUNDED_SQUARE_CALIBRATION.radiusMM,
}

export interface PreparedEffectBase {
  /** mm draft spec — carries the vector truth (`spec.vectorShape`) + its derived contour. */
  spec: EffectSpecDraft
  /** source layers for live re-blend (toggle / intensity) without re-segmentation. */
  frontSrc: { origCanvas: HTMLCanvasElement; subjCanvas: HTMLCanvasElement; defaultBlurPx: number; defaultBlendPercent: number }
  widthMM: number
  heightMM: number
}

export interface PreparedEffect extends PreparedEffectBase {
  /** the ONE magic-blend front composite (Phase-A hero face = 3D front texture = print artwork). */
  composite: HTMLCanvasElement
  /** strongly-blurred edge-lip composite (smooth rim colour, no banding). */
  edgeComposite: HTMLCanvasElement
}

export interface PrepareEffectOptions {
  /** Preserve the shared full-output default; bounded callers that consume only spec/frontSrc may opt out. */
  buildOutputs?: boolean
}

/**
 * STANDARD BIRTH (pure, directly testable — KAI-8975/P2): the ONEMO square is the WHOLE photo —
 * a full-image rectangle with the released corner-radius calibration, true vector from birth. This is THE one
 * construction: prepareEffect's standard branch AND the editor's Reset both call it (the
 * shape-library 'square' is the editor's centered 72% seed, NOT product birth — substituting it
 * shipped a zoomed photo, Dan's 2026-06-11 catch).
 */
export function standardBirthShape(widthPx: number, heightPx: number, cfg: ShapeBuildConfig = EFFECT_BUILD_CONFIG): { vectorShape: VShape; mmPerPx: number; radiusPx: number } {
  const mmPerPx = cfg.longestSideMM / Math.max(widthPx, heightPx, 1)
  const radiusPx = Math.min(cfg.squareCornerMM / mmPerPx, Math.min(widthPx, heightPx) / 2)
  return {
    vectorShape: roundedSquareShape(widthPx, heightPx, radiusPx),
    mmPerPx,
    radiusPx,
  }
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
 * v5.3·P1 (KAI-9146): the subject matte canvas (subject pixels on transparent, y-up) from a cached
 * segmentation + the original full-photo canvas. Lets the upload-time background cut-out publish a
 * matte for the 2D editor's blend preview on ANY shape (incl. the standard square) without re-running
 * the AI — the SAME derivation the shaped branch uses internally (subjectFromOriginal over the hi-res
 * matte texImage).
 */
export function subjectMatteFromSeg(origCanvas: HTMLCanvasElement, seg: MLResult): HTMLCanvasElement {
  return subjectFromOriginal(origCanvas, imageDataToCanvas(seg.texImage))
}

/**
 * Prepare an effect (2D, one-engine). `type='standard'` = instant flat ONEMO square; `type='shaped'` =
 * BEN subject silhouette. Returns the mm draft + the composite canvases (NO three).
 * `onProgress` surfaces the shaped path's honest wait states (G5: download vs inference).
 * v5.3·P1: `preseg` reuses a segmentation already computed in the background at upload (no AI re-run →
 * instant Magic); when absent the shaped path runs `segmentML` inline exactly as before.
 */
export function prepareEffect(
  url: string,
  type: EffectType,
  cfg?: ShapeBuildConfig,
  onProgress?: (s: 'downloading-model' | 'cutting' | 'fallback') => void,
  preseg?: MLResult,
): Promise<PreparedEffect>
export function prepareEffect(
  url: string,
  type: EffectType,
  cfg: ShapeBuildConfig | undefined,
  onProgress: ((s: 'downloading-model' | 'cutting' | 'fallback') => void) | undefined,
  preseg: MLResult | undefined,
  options: { buildOutputs: false },
): Promise<PreparedEffectBase>
export async function prepareEffect(
  url: string,
  type: EffectType,
  cfg: ShapeBuildConfig = EFFECT_BUILD_CONFIG,
  onProgress?: (s: 'downloading-model' | 'cutting' | 'fallback') => void,
  preseg?: MLResult,
  options?: PrepareEffectOptions,
): Promise<PreparedEffect | PreparedEffectBase> {
  // Full photo (texture res), y-up, for the composite + edge-lip source. F25 (mobile OOM): the
  // working/decode resolution is capped to a mobile memory budget via effectiveTextureDim — never the
  // raw device GPU max, which let a 48-MP photo allocate multi-GB canvases (blueprint invariant 19).
  // The upload-time background cut-out (page.tsx) resolves texDim through the SAME helper.
  const texDim = effectiveTextureDim()
  const orig = await loadImageData(url, texDim)
  const fw = orig.width, fh = orig.height
  const origCanvas = imageDataToCanvas(orig)

  let ringPx: Vec2Px[]
  let W: number, H: number
  let mmPerPx: number
  let subjCanvas: HTMLCanvasElement
  let defaultBlurPx: number
  let adapterId: string

  if (type === 'shaped') {
    // BEN subject segmentation (fallback: flood-fill). seg.mask is already post-processed.
    let seg: MaskResult
    let texImage: ImageData
    let mlMatte = false
    try {
      // v5.3·P1 (KAI-9146): reuse the cut-out computed in the background at upload — no AI re-run, so
      // Magic is instant. `preseg` is the cached segmentML result (same mask/tex dims as this cfg);
      // when absent (direct call / cache miss) we run segmentML inline exactly as before.
      const r = preseg ?? await segmentML(url, cfg.maxImageDim, texDim, onProgress)
      // Record the model that actually ran (u2netp/silueta/…), not a hard-coded detector name.
      seg = r; adapterId = r.adapterId; texImage = r.texImage; mlMatte = true
    } catch (e) {
      console.warn('[shaped] ML segmentation unavailable — falling back to flood-fill:', e)
      onProgress?.('fallback') // G4: a degraded cut must never be silent
      const img = await loadImageData(url, texDim)
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
    const workMask = smoothMask(dilated, width, height, cfg.edgeFinishPx ?? 3)
    const raw = traceContourRaw(workMask, width, height)
    if (!raw) throw new Error('Contour build failed after segmentation.')
    ringPx = raw
    // G2: subject COLOUR from the ORIGINAL full-res photo; the matte supplies alpha (shape) only.
    // (Fallback flood-fill has no alpha matte — its texImage IS the source pixels, used as-is.)
    subjCanvas = mlMatte ? subjectFromOriginal(origCanvas, imageDataToCanvas(texImage)) : imageDataToCanvas(texImage)
    defaultBlurPx = Math.max(6, Math.round(fw / 50))
  } else {
    // square: the full-image rectangle; one radius-parameterised construction owns its rounded corners
    W = fw; H = fh
    mmPerPx = cfg.longestSideMM / Math.max(fw, fh, 1)
    ringPx = [[0, 0], [fw, 0], [fw, fh], [0, fh]]
    subjCanvas = origCanvas // no matte → blend is a no-op (subj = full photo, blur 0)
    defaultBlurPx = 0
    adapterId = 'standard'
  }

  // ── ONE PIPELINE (geometry-truth): the design's geometry is born as a VShape; the
  //    manufacturing contour is DERIVED from it at the named 0.05mm tolerance.
  let vectorShape: VShape
  if (type === 'shaped') {
    // RAW MARCHING-SQUARES (Dan 2026-06-15): generation hands over the PURE straight-line polygon —
    // NO fairing, NO corner-pin, NO bezier fit (Stage B). RDP removes only the sub-pixel marching-
    // squares staircase, so the result is clean straight vector lines with sharp (radius-0) corners.
    // This polygon becomes the editor's immutable OutlineSource; the editor's tools resolve from IT
    // (radius/smooth/detail/snap, reversible to straight). It does NOT re-derive from spec.rawTracePx —
    // that's provenance only (VD3/VD11). Flip to MASK-PX Y-DOWN (vector space).
    const yDown = ringPx.map(([x, y]) => [x, H - y] as Vec2Px)
    // mm-floored simplification (Dan 2026-06-17): collapse sub-feature wobble / marching-squares
    // staircase to the manufacturing minimum-feature size, so a clean object traces as a clean
    // straight-faceted polygon (sharp corners kept) — fewer facets, NOT a curve fit. The editor's
    // tools + auto-tune own shaping on top. mm-true so the same physical floor holds at any image size.
    const rdpEpsPx = Math.max(RAW_TRACE_RDP_PX, (cfg.minFeatureMM ?? MIN_FEATURE_MM) / mmPerPx)
    const straight = rdpClosed(yDown, rdpEpsPx)
    if (straight.length < 3) throw new Error('No silhouette found — try an image with a clearer subject.')
    vectorShape = { paths: [{ anchors: straight.map(([x, y]) => ({ p: { x, y }, hIn: null, hOut: null, corner: true })) }] }
  } else {
    // standard: THE one birth construction (standardBirthShape above — directly regression-tested)
    vectorShape = standardBirthShape(W, H, cfg).vectorShape
  }
  const geometryMM = contourFromShape(vectorShape, { mmPerPx, maskHeightPx: H })
  if (!geometryMM) throw new Error('Geometry derivation failed — degenerate outline.')
  const bb = bbox(geometryMM.outer.pts)
  const widthMM = bb.w, heightMM = bb.h

  const defaultBlendPercent = blendPixelsToPercent(defaultBlurPx, fw)
  const spec: EffectSpecDraft = {
    sourceRef: url,
    maskWidthPx: W,
    maskHeightPx: H,
    mmPerPx,
    vectorShape,
    geometryMM,
    dimensions: { thicknessBodyMM: cfg.thicknessMM, edgeRadiusMM: cfg.edgeRadiusMM, widthMM, heightMM },
    generator: { adapter: adapterId, lane: 'kai', version: '0.3.0' },
    // shaped: the raw marching-squares trace rides along as PROVENANCE/debug only (VD3/VD11) — it is
    // NOT a resolution path; the editor never re-fairs from it (that was the retired Tune pipeline).
    rawTracePx: adapterId !== 'standard' ? ringPx.map(([x, y]) => [x, y] as Pt) : undefined,
    diagnostics: {
      rawContourNodes: ringPx.length,
      simplifiedNodes: geometryMM.outer.pts.length,
      holes: 0,
      rdpEpsilonMM: type === 'shaped' ? (cfg.minFeatureMM ?? MIN_FEATURE_MM) : cfg.rdpEpsilonMM,
    },
  }

  const base: PreparedEffectBase = {
    spec,
    frontSrc: { origCanvas, subjCanvas, defaultBlurPx, defaultBlendPercent },
    widthMM,
    heightMM,
  }
  if (options?.buildOutputs === false) return base

  // ── composite (the ONE magic-blend) + edge-lip source (strong blur). Reused, never re-composed per surface.
  // v5.3·P2 (KAI-9147): composeFront / blurCanvas now bake through the cross-browser SVG-filter engine
  // (async — SVG Image onload). Run both in parallel. The default remains full for every shared caller.
  const [initialArtwork, edgeComposite] = await Promise.all([
    composeEffectArtwork({
      originalCanvas: origCanvas,
      subjectCanvas: subjCanvas,
      blendPercent: defaultBlendPercent,
      fillMode: 'clamp',
    }),
    blurCanvas(origCanvas, Math.max(16, Math.round(fw / 22))),
  ])
  return { ...base, composite: initialArtwork.canvas, edgeComposite }
}
