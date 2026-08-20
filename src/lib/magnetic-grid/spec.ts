// Magnetic Grid Law spec — ruled values and data contracts only.

export type Pt = [number, number]
export type PointMM = readonly [number, number]
export type BBox = { minX: number; minY: number; maxX: number; maxY: number }

/** Exact rational value — BigInt terms, normalized by compute/exact-real. */
export interface Rational { readonly n: bigint; readonly d: bigint }
export interface ExactPoint { readonly x: Rational; readonly y: Rational }

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
