// sizes.ts — effect size bands (lean-spec §9a), carried as DATA.
//
// Size is a CUSTOMER CHOICE: a band that sets the physical scale → drives the price multiplier.
// Base shape = 70×70mm (the ONEMO square baseline); bands scale the longest side from there.
// Mirrors the EFFECT_TYPES pattern — a new band is one entry here, NEVER a rename across the codebase.
// The mm geometry from prepareEffect is REFERENCE geometry (built at the 70mm base); the band sets the
// FINAL-physical-mm by uniform scale. The 2D shape is unaffected — it just scales (§9a).

import type { Contour, Pt } from './types'

/** The base square baseline (EFFECT_BUILD_CONFIG.longestSideMM). */
export const BASE_LONGEST_SIDE_MM = 70

export const EFFECT_SIZES = {
  s70: { id: 's70', label: 'Standard · 70mm', longestSideMm: 70, priceMultiplier: 1 },
  s140: { id: 's140', label: 'Large · 140mm', longestSideMm: 140, priceMultiplier: 2.4 },
} as const

export type EffectSize = keyof typeof EFFECT_SIZES // 's70' | 's140'

export interface FinalBBox {
  widthMm: number
  heightMm: number
  minXMm: number
  minYMm: number
}

function bbox(pts: ReadonlyArray<Pt>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

/**
 * Scale the base (reference) mm geometry to the band's FINAL physical size: the longest side maps to
 * `band.longestSideMm`. Geometry scales uniformly (the shape is identical, just bigger). Returns the
 * scaled contour + the scale factor + the final bounding box (mm) — for the manufacturing payload.
 */
export function toFinalPhysicalMm(
  geometryMM: Contour,
  size: EffectSize,
): { geometry: Contour; scale: number; finalBBox: FinalBBox } {
  const band = EFFECT_SIZES[size]
  const bb = bbox(geometryMM.outer.pts)
  const baseLongest = Math.max(bb.w, bb.h) || 1
  const scale = band.longestSideMm / baseLongest
  const scalePts = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x * scale, y * scale] as Pt)
  const geometry: Contour = {
    outer: { pts: scalePts(geometryMM.outer.pts) },
    holes: geometryMM.holes.map((h) => ({ pts: scalePts(h.pts) })),
  }
  const fb = bbox(geometry.outer.pts)
  return { geometry, scale, finalBBox: { widthMm: fb.w, heightMm: fb.h, minXMm: fb.minX, minYMm: fb.minY } }
}
