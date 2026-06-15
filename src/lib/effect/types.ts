// Shaped-effect engine — shared types (Lane A / Kai)
// EffectSpecDraft = the browser-side draft per FINAL-SPEC §"Canonical artifact".
// This lane builds the Draft + preview only (no server canonical / checkout / manufacturing).

import type { VShape } from '@/lib/vector-core'

export type Pt = [number, number] // [x, y]

export interface Ring {
  pts: Pt[] // closed ring, no duplicated last point
}

export interface Contour {
  outer: Ring
  holes: Ring[]
}

/**
 * Real-world dimensions of the effect. Values come from EFFECT_BUILD_CONFIG (§9: 1mm body). The
 * rounded-lip edge radius is re-pinned for the 1mm body (§9 follow-up, coupon-confirmed).
 */
export interface Dimensions {
  thicknessBodyMM: number // physical body thickness (EFFECT_BUILD_CONFIG.thicknessMM = 1mm)
  edgeRadiusMM: number    // rounded-edge lip radius (re-pinned for the 1mm body, §9)
  widthMM: number
  heightMM: number
}

/** Browser-side draft spec — the routing surface for preview. Not canonical truth. */
export interface EffectSpecDraft {
  sourceRef: string            // object URL / hash placeholder
  maskWidthPx: number
  maskHeightPx: number
  mmPerPx: number              // px → mm mapping used to build geometry
  /** THE geometry truth, born at generation (REBUILD-PLAN-v2 §B1): true vector curves in mask px,
   *  y-down (the editor's space). Every consumer — editor, 3D, SVG export, manufacturing contour —
   *  derives from this through `geometry-truth.ts` at its own named tolerance. */
  vectorShape: VShape
  /** DERIVED manufacturing contour — `contourFromShape(vectorShape)` at 0.05 mm (mm, y-up). Never
   *  authored independently of `vectorShape`. */
  geometryMM: Contour
  dimensions: Dimensions
  generator: {
    adapter: string            // segmentation adapter id
    lane: 'kai'
    version: string
  }
  /** RAW dense BEN trace (mask px, y-up). V4: PROVENANCE/debug ONLY (VD3/VD11) — NOT a resolution
   *  path; the editor resolves from the OutlineSource, never re-fairs from this. Shaped cut-outs only. */
  rawTracePx?: Pt[]
  /** SHA-256 of the ORIGINAL uploaded bytes (preserve-at-ingest, §B5) — the manufacturing
   *  record's true source identity. Absent only if the ingest backup failed. */
  sourceBytesSha256?: string
  diagnostics: {
    rawContourNodes: number
    simplifiedNodes: number
    holes: number
    rdpEpsilonMM: number
  }
}

export interface SuedeMaterialParams {
  color: string
  roughness: number
  metalness: number
  envMapIntensity: number
  normalScale: number
  bumpScale: number
  sheen: number
  sheenColor: string
  sheenRoughness: number
  normalMap?: string
  roughnessMap?: string
  bumpMap?: string
}
