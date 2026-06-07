// Shaped-effect engine — shared types (Lane A / Kai)
// ShapeSpecDraft = the browser-side draft per FINAL-SPEC §"Canonical artifact".
// This lane builds the Draft + preview only (no server canonical / checkout / manufacturing).

export type Pt = [number, number] // [x, y]

export interface Ring {
  pts: Pt[] // closed ring, no duplicated last point
}

export interface Contour {
  outer: Ring
  holes: Ring[]
}

/** Real-world dimensions locked by Dan (2026-06-06). */
export interface Dimensions {
  thicknessBodyMM: number // 1.6 locked
  edgeRadiusMM: number    // ~1.0 rounded edge (AMEND-8), not a bevel
  widthMM: number
  heightMM: number
}

/** Browser-side draft spec — the routing surface for preview. Not canonical truth. */
export interface ShapeSpecDraft {
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
