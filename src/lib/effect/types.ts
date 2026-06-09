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
 * Real-world dimensions of the cut-out. This tracing-engine preview ships the CURRENT working
 * values from DEFAULT_BUILD_CONFIG (thicknessMM 0.5 / edgeRadiusMM 0.15). The thicker ~1.6-2mm
 * body + slight front-top fillet seen on the physical sample is a DEFERRED conditional add-on
 * (edge-round), pending Dan's physical-sample thickness lock — not part of this engine ship.
 * See _team-work/kai-sidekick/real-sample-reflections.md.
 */
export interface Dimensions {
  thicknessBodyMM: number // current preview build value (DEFAULT_BUILD_CONFIG.thicknessMM)
  edgeRadiusMM: number    // current preview build value; rounded-edge profile is the deferred add-on
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
