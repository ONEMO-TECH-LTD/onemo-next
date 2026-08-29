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

export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type MagnetDia = 6 | 8

export interface Anchor { p: Pt; dia: MagnetDia }

export interface WrapConfig {
  pitchMM?: number
  paddingMM?: number
  magnetDiaMM?: number
  /** Centre mode + governor — the existing centring system decides where the group sits. */
  centreMode?: number
  governor?: number
  massDepthMM?: number
  /** Baked anchor query (anchor bake): the governed centre at any size, positions measured once
   *  on the shape and scaled — replaces per-size mesh re-measurement. In-worker only. */
  /** REQUIRED: the governed centre at any size. Wrap never derives a centre — that is centring's,
   *  and a unit may not call another unit. The sequencer supplies it. */
  anchorAtMM: (mm: number) => Pt
  /** Perimeter belt — drop fully-surrounded interior seats, keeping the rim. Reused from the
   *  voting bench. Applied to the ARRANGEMENT before the wrap is solved, so the shape still
   *  wraps tight around exactly the magnets that remain. */
  perimeterOnly?: boolean
  // NO flap dial. In this engine it would be `radius = padding + flap` — one number behind two
  // controls — and it would also shrink the legal seating area, which is exactly the job T1 says
  // an allowance must never do. The padding IS the reach here.
}

export interface WrapAt {
  count: number
  sizeMM: number
  /** How far the group's middle ended up from the governed anchor. */
  centreOffMM: number
  points: Pt[]
  originMM: Pt
  /** The governed centre the Centre mode named — what the canvas should mark as the centre.
   *  NOT the lattice origin: that sits on a magnet and is meaningless as a centre. */
  anchorMM: Pt
  gapsMM: number[]
}

/** One rung the band offers: a revealed layout at its exact contact size. */
export interface BandRung { at: WrapAt; revealMM: number }

/** What a band solve returns: the lawful offers judge allowed, and — only when there are none — a
 *  calibration witness layout selected from the SAME generated population. The witness is never an
 *  offer and is never lawful. */
export interface BandSolve {
  offers: BandRung[]
  bestSeated: { revealMM: number; points: Pt[] } | null
}

// The engine's request/response vocabulary.
export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  /** Manual calibration: force this registration (mm phase) instead of searching. */
  forcePhaseMM?: Pt
  /** Clearance a region must survive to count as a mass for centring. */
  massDepthMM?: number
  /** Centre mode — 0 box · 1 core · 2 masses · 3 weight · 4 deep · 5 top. */
  centreMode?: number
  /** Which mass rules in Masses mode — 0 smallest · 1 deepest · 2 top. */
  governor?: number
  /** Baked governed centre for this size (anchor bake) — skips per-size anchor derivation.
   *  Positions are shape features and scale linearly; re-measuring per size is mesh noise. */
  centreOverrideMM?: Pt
  /** 'light' skips island outlines (display-only work) — used by walk-internal solves. */
  segmentsDetail?: 'full' | 'light'
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — perimeter belt drops surrounded interior nodes
  /** The outline is a true circle: judge against the analytic curve, not its flattened chords. */
  circle?: boolean
}

export interface GridResult {
  anchors: Anchor[]
  pitchCentreMM: number
  /** Every lattice position at the chosen phase, seated or not. */
  lattice: Pt[]
  /** The phase the search chose, mm. */
  phaseMM: Pt
  /** Registration offset from the canonical phase, mm per axis — the pan class. */
  panMM: Pt
  /** The spot radius the erosion used — the padding, centre-measured. */
  spotRadiusMM: number
  /** Outline points where a disc touches (within one snap step of its margined edge). */
  contactsMM: Pt[]
  /** The legal area's islands with depth masses — what centring anchored on. */
  segments: SafeSegment[]
  /** The active centre-mode's candidate target(s) — drawn so the aim is visible. */
  centresMM: Pt[]
  /** THE centre that governed the winning layout — the main point of the centring system. */
  centreMainMM: Pt
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
