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
  maxImageDim: number     // mask/contour downscale cap
  textureDim: number      // front-texture cap (high res so the projected image stays sharp)
  paddingMM: number       // flat image margin around the subject
  minCornerAngleDeg: number // unused (outline-core owns rounding) — kept for API compat
  cornerRadiusMM: number    // unused (outline-core owns rounding) — kept for API compat
  squareCornerMM: number    // corner radius of the standard square
}
import { loadImageData, segment, adapterIdFor, dilateMask, smoothMask, deviceMaxTextureDim, type MaskResult } from './mask'
import { segmentML, ML_ADAPTER_ID } from './segment-ml'
import { traceContourRaw } from './contour'
import { composeFront, blurCanvas, imageDataToCanvas } from './composite'
import type { EffectType } from './effect-types'
import { rdpClosed, type Vec2Px } from '@/lib/outline-core'
// REBUILD-PLAN-v2 §B1 — truth at birth: geometry is born as ONE VShape; the manufacturing contour
// is DERIVED from it. Shaped generation emits the RAW marching-squares straight polygon (no Stage B).
import { contourFromShape } from './geometry-truth'
import { filletShape, type VShape } from '@/lib/vector-core'
// RAW-TRACE simplification (Dan 2026-06-15): RDP epsilon that removes ONLY the sub-pixel marching-
// squares staircase, leaving true straight edges + sharp corners. NOT smoothing — the editor owns that.
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
  maxImageDim: 1200,
  textureDim: 2400,
  paddingMM: 1.5,
  minCornerAngleDeg: 135, // unused (rounding via outline-core) — kept for ShapeBuildConfig compat
  cornerRadiusMM: 24, // unused (rounding via outline-core) — kept for ShapeBuildConfig compat
  squareCornerMM: 8, // ONEMO square 8mm corners
}

export interface PreparedEffect {
  /** mm draft spec — carries the vector truth (`spec.vectorShape`) + its derived contour. */
  spec: EffectSpecDraft
  /** the ONE magic-blend front composite (Phase-A hero face = 3D front texture = print artwork). */
  composite: HTMLCanvasElement
  /** strongly-blurred edge-lip composite (smooth rim colour, no banding). */
  edgeComposite: HTMLCanvasElement
  /** source layers for live re-blend (toggle / intensity) without re-segmentation. */
  frontSrc: { origCanvas: HTMLCanvasElement; subjCanvas: HTMLCanvasElement; defaultBlurPx: number }
  widthMM: number
  heightMM: number
}

/**
 * STANDARD BIRTH (pure, directly testable — KAI-8975/P2): the ONEMO square is the WHOLE photo —
 * a full-image rectangle with the 8mm corner fillet, true vector from birth. This is THE one
 * construction: prepareEffect's standard branch AND the editor's Reset both call it (the
 * shape-library 'square' is the editor's centered 72% seed, NOT product birth — substituting it
 * shipped a zoomed photo, Dan's 2026-06-11 catch).
 */
export function standardBirthShape(widthPx: number, heightPx: number, cfg: ShapeBuildConfig = EFFECT_BUILD_CONFIG): { vectorShape: VShape; mmPerPx: number; radiusPx: number } {
  const mmPerPx = cfg.longestSideMM / Math.max(widthPx, heightPx, 1)
  const base: VShape = { paths: [{ anchors: [
    { p: { x: 0, y: 0 }, corner: true }, { p: { x: widthPx, y: 0 }, corner: true },
    { p: { x: widthPx, y: heightPx }, corner: true }, { p: { x: 0, y: heightPx }, corner: true },
  ] }] }
  const radiusPx = Math.min(Math.round(cfg.squareCornerMM / mmPerPx), Math.floor(Math.min(widthPx, heightPx) / 2))
  return { vectorShape: filletShape(base, radiusPx), mmPerPx, radiusPx }
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
  // Full photo (texture res), y-up, for the composite + edge-lip source. NO policy cap (Dan,
  // plan v2.1 §B5): the texture carries the source's full resolution up to the device's physical
  // GPU maximum. (cfg.textureDim remains the config floor for tests/back-compat.)
  const texDim = Math.max(cfg.textureDim, deviceMaxTextureDim())
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
      const r = await segmentML(url, cfg.maxImageDim, texDim, onProgress)
      seg = r; adapterId = ML_ADAPTER_ID; texImage = r.texImage; mlMatte = true
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
    const workMask = smoothMask(dilated, width, height, 3)
    const raw = traceContourRaw(workMask, width, height)
    if (!raw) throw new Error('Contour build failed after segmentation.')
    ringPx = raw
    // G2: subject COLOUR from the ORIGINAL full-res photo; the matte supplies alpha (shape) only.
    // (Fallback flood-fill has no alpha matte — its texImage IS the source pixels, used as-is.)
    subjCanvas = mlMatte ? subjectFromOriginal(origCanvas, imageDataToCanvas(texImage)) : imageDataToCanvas(texImage)
    defaultBlurPx = Math.max(6, Math.round(fw / 50))
  } else {
    // square: the full-image rectangle; outline-core rounds the 8mm corners (one engine, no pre-rounding)
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
    // The editor applies radius / smooth / detail / snap on top — non-destructive, reversible to
    // straight — and re-derives from spec.rawTracePx (set below). Flip to MASK-PX Y-DOWN (vector space).
    const yDown = ringPx.map(([x, y]) => [x, H - y] as Vec2Px)
    const straight = rdpClosed(yDown, RAW_TRACE_RDP_PX)
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

  // ── composite (the ONE magic-blend) + edge-lip source (strong blur). Reused, never re-composed per surface.
  const composite = composeFront(origCanvas, subjCanvas, defaultBlurPx)
  const edgeComposite = blurCanvas(origCanvas, Math.max(16, Math.round(fw / 22)))

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
      rdpEpsilonMM: cfg.rdpEpsilonMM,
    },
  }

  return {
    spec,
    composite,
    edgeComposite,
    frontSrc: { origCanvas, subjCanvas, defaultBlurPx },
    widthMM,
    heightMM,
  }
}
