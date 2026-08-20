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

// ---- exact centre law contracts ---------------------------------------------------------------

/** A certified enclosure of a rational quantity, as compute publishes it. */
export interface Bounds { readonly lo: Rational; readonly hi: Rational }
export interface BoundedPoint { readonly x: Bounds; readonly y: Bounds }

/** What kind of evidence a region's clearance maximum turned out to be. */
export type MaximumKind = 'certified' | 'tie' | 'plateau' | 'unresolved'

/**
 * One selectable branch, reduced to what selection needs and nothing else. `centre` is present only
 * for a certified single point; a ridge or a tie names none, and `maximum` says which it was so the
 * co-maximal evidence can be recovered rather than flattened into a refusal.
 */
export interface CentreBranchEvidence {
  readonly islandIndex: number
  readonly massIndex: number | null
  readonly area: Bounds
  readonly peakClear: Bounds | null
  readonly centre: BoundedPoint | null
  readonly maximum: MaximumKind
  /**
   * The finitely many co-equal maxima of this branch, when its maximum is a tie. A ridge has no
   * finite set and leaves this empty — the distinction matters, because a finite tie can be an
   * enumerated CentreTie a grid can still be placed on, and a continuum cannot.
   */
  readonly coEqual: readonly BoundedPoint[]
}

export interface ExactCentreInput {
  /** content identity of the measured evidence these branches came from */
  readonly evidenceId: string
  /**
   * Anything the region construction could not settle. It travels as PROVENANCE, not as a verdict:
   * whether it matters depends on the policy — a box or weight centre is read from the shape alone
   * and is unaffected by an unresolved island. Only the law may decide that.
   */
  readonly unresolved: readonly string[]
  readonly box: BoundedPoint
  readonly weight: BoundedPoint
  readonly core: BoundedPoint | null
  readonly islands: readonly CentreBranchEvidence[]
  readonly masses: readonly CentreBranchEvidence[]
  readonly midY: Rational
}

export type CentreRefusalCode =
  | 'NO_SAFE_CORE'
  | 'NO_CENTRE'
  | 'CENTRE_EVIDENCE_UNRESOLVED'
  | 'CENTRE_TIE_UNRESOLVED'

export type CentreBranchName = 'box' | 'core' | 'weight' | 'deep' | 'top' | 'mass'

/**
 * One governed centre. It names the branch that produced it, so a tie is a set of real decisions
 * rather than bare coordinates. Branch indices locate a decision WITHIN an evidence set; they are
 * not identity on their own — `(0, null)` is the first island of every contour at every scale — so
 * the verdict also carries the evidence id and the applied policy, once each, because one evidence
 * set and one policy produced every decision in it. Downstream this becomes cache and result
 * identity, and either omission would make two different decisions indistinguishable.
 */
export interface CentreChoice {
  readonly target: BoundedPoint
  readonly branch: CentreBranchName
  readonly islandIndex: number | null
  readonly massIndex: number | null
}

/**
 * The three outcomes R14 §6.1 authorizes, and no fourth. Either one governed centre, or an explicit
 * tie of finitely many co-equal centres a grid can still be placed on, or a typed refusal.
 * A co-maximal CONTINUUM is not a result: it establishes no unique governed centre and no finite
 * set, so it refuses — carrying the plateau in its reason rather than pretending to be an answer.
 */
export type ExactCentreVerdict =
  | { readonly status: 'decided'; readonly policy: CentrePolicy; readonly evidenceId: string; readonly decision: CentreChoice }
  | { readonly status: 'tie'; readonly policy: CentrePolicy; readonly evidenceId: string; readonly decisions: readonly [CentreChoice, CentreChoice, ...CentreChoice[]] }
  | { readonly status: 'refused'; readonly policy: CentrePolicy; readonly evidenceId: string; readonly code: CentreRefusalCode; readonly reason: string }
