// Magnetic Grid Law spec — ruled values and data contracts only.

export type Pt = [number, number]
export type PointMM = readonly [number, number]
export type BBox = { minX: number; minY: number; maxX: number; maxY: number }

export type ExactInteger = string
export interface Rational { numerator: ExactInteger; denominator: ExactInteger }
export interface AlgebraicReal {
  polynomial: readonly ExactInteger[]
  isolating: readonly [Rational, Rational]
  rootIndex: number
}
export type ExactReal = Rational | AlgebraicReal
export interface ExactPoint { x: ExactReal; y: ExactReal; approximateMM: PointMM }
export interface ExactCentreRegion {
  id: string
  centre: ExactPoint
  area: ExactReal
  peakClear: ExactReal
  upperHalf: boolean
}
export interface ExactCentreEvidence {
  id: string
  box: ExactPoint
  core: ExactPoint | null
  weight: ExactPoint
  regions: readonly ExactCentreRegion[]
  masses: readonly ExactCentreRegion[]
}
export interface ExactCentreInput {
  contour: Contour
  policy: CentrePolicy
}
export interface ExactCentreDecision {
  policy: CentrePolicy
  target: ExactPoint
  branch: 'box' | 'core' | 'weight' | 'deep' | 'top' | 'mass'
  evidenceId: string
  regionId: string | null
}
export type ExactCentreEvaluation =
  | { status: 'lawful'; decisions: readonly [ExactCentreDecision, ...ExactCentreDecision[]] }
  | { status: 'refused'; decisions: readonly []; code: 'CENTRE_EVIDENCE_MISSING' | 'CENTRE_EVIDENCE_UNRESOLVED' | 'CENTRE_MATERIAL_INVALID' }

export interface Ring { pts: Pt[] }
export interface Contour { outer: Ring; holes: Ring[] }

export type BandId = 1 | 2 | 3 | 4
export interface Band { readonly id: BandId; readonly minMM: number; readonly maxMM: number }
export const BANDS: ReadonlyArray<Band> = Object.freeze([
  Object.freeze({ id: 1 as const, minMM: 24, maxMM: 71 }),
  Object.freeze({ id: 2 as const, minMM: 72, maxMM: 119 }),
  Object.freeze({ id: 3 as const, minMM: 120, maxMM: 167 }),
  Object.freeze({ id: 4 as const, minMM: 168, maxMM: 215 }),
])

export const GRID_PITCH_MM = 48
export const SPOT_RADIUS_MM = 12
export const MASS_DEPTH_MM = 16
export const MAGNET_DIA_SMALL_MM = 6
export const MAGNET_DIA_LARGE_MM = 8
export const MIN_ANCHORS = 2

export type CoverageMode = 'perimeter' | 'full'
export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type Governor = 0 | 1 | 2 | 3
export type CentrePolicy =
  | { mode: 'box' }
  | { mode: 'core' }
  | { mode: 'weight' }
  | { mode: 'deep' }
  | { mode: 'top' }
  | { mode: 'masses'; governor: 'smallest' | 'deepest' | 'top' | 'top-small' }

export interface MassMeasurement {
  areaMM2: number
  centreMM: Pt
  peakClearMM: number
  bbox: BBox
  rings: Pt[][]
}

export interface RegionMeasurement extends MassMeasurement {
  meanMM: Pt
  masses: MassMeasurement[]
}

export interface CentreMeasurements {
  box: Pt
  core: Pt
  weight: Pt
  regions: readonly RegionMeasurement[]
  masses: readonly CentreRegionRef[]
  midY: number
}

export interface CentreRegionRef {
  region: MassMeasurement
  regionIndex: number
  massIndex: number | null
}

export interface CentreDecision {
  policy: CentrePolicy
  target: Pt
  branch: 'box' | 'core' | 'weight' | 'deep' | 'top' | 'mass'
  regionIndex: number | null
  massIndex: number | null
}

export interface ParityCandidateMeasurement {
  phaseMM: Pt
  seated: readonly Pt[]
  canonAxes: 0 | 1 | 2
  excessMM: number
  xRelation: 'node' | 'gap'
  yRelation: 'node' | 'gap'
}

export interface CentreBaselineInput {
  contour: Contour
  regions: readonly RegionMeasurement[]
  policy: CentrePolicy
  candidates: readonly ParityCandidateMeasurement[]
}

export interface CentreBaselineResult {
  centre: CentreDecision
  phaseMM: Pt
  seated: readonly Pt[]
  canonAxes: 0 | 1 | 2
}
