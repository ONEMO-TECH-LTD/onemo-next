// Shaped-effect engine — shared types (Lane A / Kai)
// EffectSpecDraft = the browser-side draft per FINAL-SPEC §"Canonical artifact".
// This lane builds the Draft + preview only (no server canonical / checkout / manufacturing).

import type { VShape } from '@/lib/vector-core'

export type Pt = [number, number] // [x, y]

// Grid engine shared vocabulary — moved here (S2) so units never import one another for a type.
export type BBox = { minX: number; minY: number; maxX: number; maxY: number }

/** A mass inside an island — the region surviving the depth probe, with its outline. */
export interface SafeMass {
  areaMM2: number
  /** The deepest point of the mass — always inside the material. */
  centreMM: Pt
  /** The mass's peak clearance, mm. */
  peakClearMM: number
  bbox: BBox
  rings: Pt[][]
}

/** One connected island of the legal magnet-centre area, measured on a mesh. */
export interface SafeSegment {
  areaMM2: number
  /** The island's deepest point — max clearance, never a concave void. */
  centreMM: Pt
  /** The island's area-average point — can sit in a concave void; a test-mode reference. */
  meanMM: Pt
  /** The island's peak clearance, mm — how deep its most buried point sits. */
  peakClearMM: number
  bbox: BBox
  /** The island's edge-offset outline(s) — smooth closed rings, mm, engine y-up. */
  rings: Pt[][]
  /** Sub-masses at the depth probe: limbs and slivers die shallow, true masses survive. */
  masses: SafeMass[]
}

export interface AnchorBake {
  refMM: number
  boxC: Pt
  weightC: Pt
  /** Deepest island's deep point at reference — the global Deep anchor. */
  deepC: Pt
  refMidY: number
  masses: Array<{ centreMM: Pt; areaMM2: number; peakClearMM: number }>
}

// Classifier vocabulary — shared so no unit imports another for a type.
/** How many magnet lines an axis of this length can carry, 1..5. */
export type AxisClass = 1 | 2 | 3 | 4 | 5

/** Slim = the minor axis carries one or two lines, so the frame is a chain or a ladder.
 *  Standard = three or four lines on the minor axis — a real two-dimensional field. */
export type FrameKind = 'square' | 'slim' | 'standard'

export interface ShapeClass {
  /** Node lines the box can carry on each axis. */
  cx: AxisClass
  cy: AxisClass
  /** The product band — the dominant axis class (Compute System §4). */
  band: AxisClass
  kind: FrameKind
  /** Which axis is dominant; 'none' when square. */
  dominant: 'x' | 'y' | 'none'
  widthMM: number
  heightMM: number
  /** Material area over bounding-box area — how much of its box the shape actually fills. */
  fill: number
  /** The candidate node frame this pair implies: cx by cy lines, spanning 2n-1 cells per axis. */
  frame: { cols: AxisClass; rows: AxisClass; capacity: number }
}

export type CentreMode = 0 | 1 | 2 | 3 | 4 | 5
export type Governor = 0 | 1 | 2 | 3


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
  /** SHA-256 of the ORIGINAL uploaded bytes — the manufacturing record's true source identity.
   *  Captured at ORDER / SAVE (Dan 2026-06-16: NOT stored at upload — privacy + cost), so it is
   *  absent until that flow records it; the payload then uses a MARKED `ref-fallback:` (see payload.ts). */
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
