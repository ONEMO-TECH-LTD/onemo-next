// Shaped-effect engine — shared types (Lane A / Kai)
// EffectSpecDraft = the browser-side draft per FINAL-SPEC §"Canonical artifact".
// This lane builds the Draft + preview only (no server canonical / checkout / manufacturing).

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
  geometryMM: Contour          // simplified contour in mm (outer + holes)
  dimensions: Dimensions
  generator: {
    adapter: string            // segmentation adapter id
    lane: 'kai'
    version: string
  }
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
