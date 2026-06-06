// Shaped-effect pipeline (Lane A / Kai)
// image URL → segmentation → contour → simplify → mm → custom rounded-edge mesh + bled texture.
// Returns a draft geometry + texture + ShapeSpecDraft. Browser/preview only (no canonical/checkout).

import * as THREE from 'three'
import type { Contour, Pt, ShapeSpecDraft } from './types'
import { loadImageData, segment, adapterIdFor } from './mask'
import { buildContour } from './contour'
import { bleedTexture } from './edge-bleed'
import { buildShapedGeometry } from './mesh'

export interface ShapeBuildConfig {
  longestSideMM: number  // physical size of the cut-out's longest side (default 100)
  thicknessMM: number    // 1.6 locked
  edgeRadiusMM: number   // ~1.0 rounded (AMEND-8)
  edgeSegments: number
  rdpEpsilonMM: number   // 0.2–0.4
  maxImageDim: number    // downscale cap for segmentation speed
}

export const DEFAULT_BUILD_CONFIG: ShapeBuildConfig = {
  longestSideMM: 100,
  thicknessMM: 1.6,
  edgeRadiusMM: 1.0,
  edgeSegments: 6,
  rdpEpsilonMM: 0.3,
  maxImageDim: 512,
}

export interface ShapeBuildResult {
  geometry: THREE.BufferGeometry
  texture: THREE.CanvasTexture
  spec: ShapeSpecDraft
  widthMM: number
  heightMM: number
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

export async function buildShape(
  url: string,
  cfg: ShapeBuildConfig = DEFAULT_BUILD_CONFIG
): Promise<ShapeBuildResult> {
  const img = await loadImageData(url, cfg.maxImageDim)
  const { mask, width, height } = segment(img)

  // px → mm: longest contour side maps to longestSideMM
  // (need a first contour pass in px to know the bbox; epsilon also depends on mmPerPx,
  // so do a provisional mmPerPx from a coarse pass, then the real simplify.)
  const coarse = buildContour(mask, width, height, 1)
  if (!coarse) throw new Error('No silhouette found — try an image with a clearer subject/background.')
  const { w: bw, h: bh } = pxBbox(coarse.contour.outer.pts)
  const mmPerPx = cfg.longestSideMM / Math.max(bw, bh, 1)

  const epsilonPx = cfg.rdpEpsilonMM / mmPerPx
  const built = buildContour(mask, width, height, epsilonPx)
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

  const canvas = bleedTexture(img, mask, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false // image is loaded y-up + UV v = py/H → upright without an extra flip
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true

  const spec: ShapeSpecDraft = {
    sourceRef: url,
    maskWidthPx: width,
    maskHeightPx: height,
    mmPerPx,
    geometryMM: contourMM,
    dimensions: {
      thicknessBodyMM: cfg.thicknessMM,
      edgeRadiusMM: Math.min(cfg.edgeRadiusMM, cfg.thicknessMM / 2),
      widthMM,
      heightMM,
    },
    generator: { adapter: adapterIdFor(img), lane: 'kai', version: '0.1.0' },
    diagnostics: {
      rawContourNodes: built.rawNodes,
      simplifiedNodes: built.simplifiedNodes,
      holes: contourMM.holes.length,
      rdpEpsilonMM: cfg.rdpEpsilonMM,
    },
  }

  return { geometry, texture, spec, widthMM, heightMM }
}
