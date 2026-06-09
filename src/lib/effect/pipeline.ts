// Shaped-effect pipeline (Lane A / Kai)
// image URL → segmentation → contour → simplify → mm → custom rounded-edge mesh + bled texture.
// Returns a draft geometry + texture + EffectSpecDraft. Browser/preview only (no canonical/checkout).

import * as THREE from 'three'
import type { Contour, Pt, EffectSpecDraft } from './types'
import { loadImageData, segment, adapterIdFor, dilateMask, smoothMask, type MaskResult } from './mask'
import { segmentML, ML_ADAPTER_ID } from './segment-ml'
import { buildContour } from './contour'
import { buildShapedGeometry } from './mesh'
import { composeFront } from './composite'

// composeFront moved to composite.ts (three-free) so the 2D-first prepareEffect can reuse the ONE
// composite primitive without dragging three.js into the WebGL-free creation path. Re-exported here
// so existing consumers (ShapedModel) keep importing it from `@/lib/effect/pipeline`.
export { composeFront } from './composite'

export interface ShapeBuildConfig {
  longestSideMM: number   // physical size of the cut-out's longest side (default 100)
  thicknessMM: number     // body thickness (~0.8)
  edgeRadiusMM: number    // SHORT rounded-edge fillet radius (~0.15)
  edgeSegments: number
  rdpEpsilonMM: number    // 0.2–0.4
  maxImageDim: number     // mask/contour downscale cap (low res is fine for the silhouette)
  textureDim: number      // front-texture cap (HIGH res so the projected image stays sharp)
  paddingMM: number       // flat IMAGE margin around the subject (same image, full thickness)
  minCornerAngleDeg: number // round corners sharper than this angle; 0 = off
  cornerRadiusMM: number    // fillet RADIUS applied to those corners (generous = bigger round)
  squareCornerMM: number    // corner radius of the DEFAULT square (before Magic-wand cut-out)
}

export const DEFAULT_BUILD_CONFIG: ShapeBuildConfig = {
  longestSideMM: 100,
  thicknessMM: 0.5,          // Dan: 0.5mm
  edgeRadiusMM: 0.15,        // short rounded lip
  edgeSegments: 14,          // fillet rounding segments (smoother rim, fewer facet lines)
  rdpEpsilonMM: 0.4,         // RDP to corner points, THEN Chaikin rounds them → smooth curves
  maxImageDim: 1200,         // mask res (Catmull-Rom provides smoothness, so this can be moderate)
  textureDim: 2400,          // front-texture cap raised toward source res (less downscale/pixelation)
  paddingMM: 1.5,            // Dan 2026-06-06: small flat image margin around the subject
  minCornerAngleDeg: 135,    // round any corner sharper than 135° (catch broad shoulder/bottom corners too)
  cornerRadiusMM: 24,        // BIG generous fillet radius (Dan's red line ≈ 20%+ of width)
  squareCornerMM: 8,         // Dan: default square has 8mm rounded corners (ONEMO square)
}

export interface ShapeBuildResult {
  geometry: THREE.BufferGeometry
  texture: THREE.CanvasTexture
  edgeTexture: THREE.CanvasTexture  // strongly-blurred copy for the rim (no banding)
  spec: EffectSpecDraft
  widthMM: number
  heightMM: number
  /** Source layers for live re-blur of the front "magic blend" (toggle / intensity) in the editor. */
  frontSrc: { origCanvas: HTMLCanvasElement; subjCanvas: HTMLCanvasElement; defaultBlurPx: number }
}

function contourPxToMM(c: Contour, mmPerPx: number): Contour {
  const conv = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x * mmPerPx, y * mmPerPx] as Pt)
  return { outer: { pts: conv(c.outer.pts) }, holes: c.holes.map((h) => ({ pts: conv(h.pts) })) }
}

function pxBbox(pts: Pt[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  return { w: maxX - minX, h: maxY - minY }
}

/** A rounded-rect ring (px, clockwise) covering [0,0]→[W,H], corner radius rPx. */
function roundedRectRing(W: number, H: number, rPx: number, seg = 8): Pt[] {
  const r = Math.max(0, Math.min(rPx, Math.min(W, H) / 2))
  const arc = (cx: number, cy: number, a0: number, a1: number): Pt[] => {
    const out: Pt[] = []
    for (let i = 0; i <= seg; i++) { const t = a0 + ((a1 - a0) * i) / seg; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]) }
    return out
  }
  return [
    ...arc(r, r, Math.PI, 1.5 * Math.PI),            // top-left
    ...arc(W - r, r, 1.5 * Math.PI, 2 * Math.PI),    // top-right
    ...arc(W - r, H - r, 0, 0.5 * Math.PI),          // bottom-right
    ...arc(r, H - r, 0.5 * Math.PI, Math.PI),        // bottom-left
  ]
}

/**
 * DEFAULT product: the flat ONEMO square — the full photo on a rounded-rect effect (8mm corners),
 * NO segmentation. Instant. Reuses the same mesh + suede material as the cut-out so the Magic-wand
 * upgrade (buildShape → BEN) is a seamless swap. Returns the same shape as buildShape.
 */
export async function buildSquareShape(
  url: string,
  cfg: ShapeBuildConfig = DEFAULT_BUILD_CONFIG
): Promise<ShapeBuildResult> {
  const orig = await loadImageData(url, cfg.textureDim) // y-up RGBA full photo
  const fw = orig.width, fh = orig.height
  const origCanvas = document.createElement('canvas')
  origCanvas.width = fw; origCanvas.height = fh
  origCanvas.getContext('2d')!.putImageData(orig, 0, 0)

  const mmPerPx = cfg.longestSideMM / Math.max(fw, fh, 1)
  const rPx = cfg.squareCornerMM / mmPerPx
  const ringPx = roundedRectRing(fw, fh, rPx)
  const contourMM: Contour = { outer: { pts: ringPx.map(([x, y]) => [x * mmPerPx, y * mmPerPx] as Pt) }, holes: [] }

  const { geometry, widthMM, heightMM } = buildShapedGeometry(contourMM, {
    thicknessMM: cfg.thicknessMM,
    edgeRadiusMM: cfg.edgeRadiusMM,
    edgeSegments: cfg.edgeSegments,
    mmPerPx,
    imgW: fw,
    imgH: fh,
  })

  // Square texture = the full SHARP photo (no blend — there's no subject matte until the wand runs).
  const texture = new THREE.CanvasTexture(origCanvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true

  const edgeBlurPx = Math.max(16, Math.round(fw / 22))
  const edgeCanvas = document.createElement('canvas')
  edgeCanvas.width = fw; edgeCanvas.height = fh
  const ectx = edgeCanvas.getContext('2d')!
  ectx.filter = `blur(${edgeBlurPx}px)`; ectx.drawImage(origCanvas, 0, 0); ectx.filter = 'none'
  const edgeTexture = new THREE.CanvasTexture(edgeCanvas)
  edgeTexture.colorSpace = THREE.SRGBColorSpace
  edgeTexture.flipY = false
  edgeTexture.wrapS = edgeTexture.wrapT = THREE.ClampToEdgeWrapping
  edgeTexture.needsUpdate = true

  const spec: EffectSpecDraft = {
    sourceRef: url,
    maskWidthPx: fw,
    maskHeightPx: fh,
    mmPerPx,
    geometryMM: contourMM,
    dimensions: { thicknessBodyMM: cfg.thicknessMM, edgeRadiusMM: cfg.edgeRadiusMM, widthMM, heightMM },
    generator: { adapter: 'square', lane: 'kai', version: '0.2.0' },
    diagnostics: { rawContourNodes: ringPx.length, simplifiedNodes: ringPx.length, holes: 0, rdpEpsilonMM: cfg.rdpEpsilonMM },
  }

  // No subject matte for the square → blend is a no-op (subjCanvas = the full photo, defaultBlurPx 0).
  return { geometry, texture, edgeTexture, spec, widthMM, heightMM, frontSrc: { origCanvas, subjCanvas: origCanvas, defaultBlurPx: 0 } }
}

export async function buildShape(
  url: string,
  cfg: ShapeBuildConfig = DEFAULT_BUILD_CONFIG
): Promise<ShapeBuildResult> {
  // Default: ML subject segmentation (BEN2-ONNX). Fallback: flood-fill (no-ML) if the model
  // can't load. Real user images have no alpha + non-uniform backgrounds → ML is the real tool.
  let seg: MaskResult
  let adapterId: string
  let texImage: ImageData, texW: number, texH: number // BEN matte → the SHARP subject layer only
  try {
    const r = await segmentML(url, cfg.maxImageDim, cfg.textureDim)
    seg = r
    adapterId = ML_ADAPTER_ID
    texImage = r.texImage; texW = r.texW; texH = r.texH
  } catch (e) {
    console.warn('[shaped] ML segmentation unavailable — falling back to flood-fill:', e)
    const img = await loadImageData(url, cfg.textureDim)
    seg = segment(img)
    adapterId = adapterIdFor(img)
    texImage = seg.imageData; texW = seg.width; texH = seg.height
  }
  const { mask, width, height } = seg

  // px → mm: longest contour side maps to longestSideMM
  // (need a first contour pass in px to know the bbox; epsilon also depends on mmPerPx,
  // so do a provisional mmPerPx from a coarse pass, then the real simplify.)
  const coarse = buildContour(mask, width, height, 1)
  if (!coarse) throw new Error('No silhouette found — try an image with a clearer subject/background.')
  const { w: bw, h: bh } = pxBbox(coarse.contour.outer.pts)
  const mmPerPx = cfg.longestSideMM / Math.max(bw, bh, 1)

  const epsilonPx = cfg.rdpEpsilonMM / mmPerPx
  // expand outward by padding + bevel: flat cap = subject + paddingMM (image), bevel sits beyond
  const expandMM = cfg.paddingMM
  const padPx = Math.max(0, Math.round(expandMM / mmPerPx))
  const dilated = padPx > 0 ? dilateMask(mask, width, height, padPx) : mask
  const workMask = smoothMask(dilated, width, height, 3) // round sub-feature tip/notch noise symmetrically (both ears, any image)
  const cornerRadiusPx = cfg.cornerRadiusMM / mmPerPx
  const built = buildContour(workMask, width, height, epsilonPx, cfg.minCornerAngleDeg, cornerRadiusPx)
  if (!built) throw new Error('Contour build failed after simplification.')

  const contourMM = contourPxToMM(built.contour, mmPerPx)

  const { geometry, widthMM, heightMM } = buildShapedGeometry(contourMM, {
    thicknessMM: cfg.thicknessMM,
    edgeRadiusMM: cfg.edgeRadiusMM,
    edgeSegments: cfg.edgeSegments,
    mmPerPx,
    imgW: width,
    imgH: height,
  })

  // Texture build — the "magic blend": SHARP subject over a BLURRED copy of the REAL photo background.
  // The background is the actual image (preserved, so hugging out reveals the real surroundings), but
  // softly blurred for the premium look. Source canvases are returned so the editor can re-blur live
  // (toggle / intensity) without re-running BEN.
  const orig = await loadImageData(url, cfg.textureDim) // y-up RGBA, full original (with background)
  const fw = orig.width, fh = orig.height
  const origCanvas = document.createElement('canvas')
  origCanvas.width = fw; origCanvas.height = fh
  origCanvas.getContext('2d')!.putImageData(orig, 0, 0)

  const subjCanvas = document.createElement('canvas') // sharp subject only (BEN matte)
  subjCanvas.width = texW; subjCanvas.height = texH
  subjCanvas.getContext('2d')!.putImageData(texImage, 0, 0)

  const defaultBgBlurPx = Math.max(6, Math.round(fw / 50))
  const front = composeFront(origCanvas, subjCanvas, defaultBgBlurPx)
  const texture = new THREE.CanvasTexture(front)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false // image is loaded y-up + UV v = py/H → upright without an extra flip
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true

  // EDGE texture = a STRONGLY blurred copy of the photo, so the rounded lip reads as a smooth colour
  // gradient (no per-pixel banding). Blur scales with size → works for any image.
  const edgeBlurPx = Math.max(16, Math.round(fw / 22))
  const edgeCanvas = document.createElement('canvas')
  edgeCanvas.width = fw; edgeCanvas.height = fh
  const ectx = edgeCanvas.getContext('2d')!
  ectx.filter = `blur(${edgeBlurPx}px)`
  ectx.drawImage(origCanvas, 0, 0)
  ectx.filter = 'none'
  const edgeTexture = new THREE.CanvasTexture(edgeCanvas)
  edgeTexture.colorSpace = THREE.SRGBColorSpace
  edgeTexture.flipY = false
  edgeTexture.wrapS = edgeTexture.wrapT = THREE.ClampToEdgeWrapping
  edgeTexture.needsUpdate = true


  const spec: EffectSpecDraft = {
    sourceRef: url,
    maskWidthPx: width,
    maskHeightPx: height,
    mmPerPx,
    geometryMM: contourMM,
    dimensions: {
      thicknessBodyMM: cfg.thicknessMM,
      edgeRadiusMM: cfg.edgeRadiusMM,
      widthMM,
      heightMM,
    },
    generator: { adapter: adapterId, lane: 'kai', version: '0.2.0' },
    diagnostics: {
      rawContourNodes: built.rawNodes,
      simplifiedNodes: built.simplifiedNodes,
      holes: contourMM.holes.length,
      rdpEpsilonMM: cfg.rdpEpsilonMM,
    },
  }

  return { geometry, texture, edgeTexture, spec, widthMM, heightMM, frontSrc: { origCanvas, subjCanvas, defaultBlurPx: defaultBgBlurPx } }
}
