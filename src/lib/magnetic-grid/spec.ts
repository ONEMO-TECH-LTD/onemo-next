// Magnetic Grid Law spec — ruled values and data contracts only.

export type Pt = [number, number]
export type PointMM = readonly [number, number]
export type BBox = { minX: number; minY: number; maxX: number; maxY: number }


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

/** The cloned numeric body's decision shape. §3 deletes it with that body after the gate. */
export interface ClonedCentreDecision {
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
  centre: ClonedCentreDecision
  phaseMM: Pt
  seated: readonly Pt[]
  canonAxes: 0 | 1 | 2
}

// ---- §6.1 exact value contracts ----------------------------------------------------------------
// Declared as the contract writes them. These are the transport and identity forms: §6.1 states
// their purpose is that "Node/browser/worker/cache bytes agree", and §6.4 canonicalizes identity
// with the same decimal-string integers. Compute keeps BigInt arithmetic internally (§6.2) and
// converts here.

/** Exact values serialize with decimal-string integers so Node/browser/worker/cache bytes agree. */
export type ExactInteger = string
export interface Rational { numerator: ExactInteger; denominator: ExactInteger }
export interface AlgebraicReal {
  polynomial: readonly ExactInteger[]
  isolating: readonly [Rational, Rational]
  rootIndex: number
}
export interface CertifiedExpressionReal {
  expressionHash: string
  expression: readonly (ExactInteger | string)[]
  isolating: readonly [Rational, Rational]
  proofId: string
}
export type ExactReal = Rational | AlgebraicReal | CertifiedExpressionReal
export interface ExactScale {
  exact: ExactReal
  approximateMM: number // report/render only; never gates law
}
export interface ExactPoint {
  x: ExactReal
  y: ExactReal
  approximateMM: PointMM // report/render only
}

// ---- §6.1 centre evidence and law contracts -----------------------------------------------------

export interface RegionEvidence {
  id: string
  centres: readonly ExactPoint[]
  area: ExactReal
  peakClear: ExactReal
  rings: readonly (readonly PointMM[])[]
}
export type MassEvidence = RegionEvidence
export interface CentreEvidence {
  id: string
  box: ExactPoint
  core: ExactPoint | null
  weight: ExactPoint
  deepest: readonly ExactPoint[]
  islands: readonly RegionEvidence[]
  masses: readonly MassEvidence[]
}
export interface CentreDecision { target: ExactPoint; policy: CentrePolicy; evidenceId: string }
export interface CentreTie { status: 'tie'; decisions: readonly CentreDecision[] }
export interface RefusalEvidence { readonly [key: string]: string | number | boolean | null }
export interface Refusal { status: 'refused'; code: RefusalCode; evidence: RefusalEvidence }
export interface EvaluationContext { band: BandId; scale: ExactScale; regimeId: string; siteId: string }
export interface CentreBranchMeasurement { context: EvaluationContext; evidence: CentreEvidence }
export interface CentreLawEvaluation {
  context: EvaluationContext
  evidenceId: string
  decisions: readonly CentreDecision[]
  refusal: Refusal | null
}

export type RefusalCode =
  | 'NO_SAFE_CORE'
  | 'NO_CENTRE'
  | 'CENTRE_EVIDENCE_UNRESOLVED'
  | 'CENTRE_TIE_UNRESOLVED'
  | 'NO_PARITY_LAWFUL_PLACEMENT'
  | 'WRAP_EXCEEDS_ALLOWANCE'
  | 'NO_WRAPPED_LAYOUT_IN_BAND'
  | 'AUTO_FLAP_CAP_EXCEEDED'
  | 'RUNG_CONFLICT'
  | 'REGIME_UNRESOLVED'
