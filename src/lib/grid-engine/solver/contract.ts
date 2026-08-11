// THE PUBLIC DATA CONTRACT — blueprint §2, and nothing besides.
//
// This file is types only. It imports nothing from the engine (blueprint §1: "contract.ts imports
// nothing from the engine") and holds no values: every number the solver uses arrives through
// SolveRequest.spec, which is the guarded law input. A literal in here would be a second door past
// the guard — the defect class the separation suite exists to kill.

/** One point, millimetres. x right, y down — the tracer's own frame. */
export type PointMM = readonly [number, number]

/** Blueprint §2.1: the six centre constructions, all returned, none a default (EC-08). */
export const CENTRE_METHODS = [
  'box',
  'oriented-box',
  'area',
  'perimeter',
  'vertices',
  'maximum-clearance',
] as const
export type CentreMethod = (typeof CENTRE_METHODS)[number]

/** EC-03: bands 2 and 3 are operational. 1 is below the pair floor; 4 is ruled non-operational. */
export type OperationalBand = 2 | 3

/** L6: parity decides registration per axis — an even run sits in the gap, an odd run on a point. */
export type AxisRegistration = 'point' | 'gap'

/** L7: one lattice; 96 is the same lattice thinned. These are the two populations of EC-05. */
export type PopulationPitchMM = 48 | 96

/**
 * Every law value the solve uses. Guarded upstream (spec.ts's one guard); the solver treats it as
 * read-only fact. `sparseFactor` is a law input like the rest — blueprint §2.1 names it explicitly.
 */
export interface GridEngineSpec {
  readonly basePitchMM: number
  readonly sparseFactor: number
  readonly paddingMM: number
  readonly positionsPerAxis: number
  readonly bands: readonly OperationalBand[]
  readonly centreMethods: readonly CentreMethod[]
}

/**
 * Blueprint §2.1. There is NO size, cap, target, shape name, rotation, lattice offset, chosen
 * registration, ranking weight or tolerance input — L8's "No size inputs may exist" is enforced by
 * this shape having nowhere to put one.
 */
export interface SolveRequest {
  readonly outline: readonly PointMM[]
  readonly spec: GridEngineSpec
  readonly flapLimitsMM: readonly [number, number]
}

/** M3: refused explicitly, never repaired into an answer (G2). */
export type UnsupportedOutlineReason =
  | 'fewer-than-three-vertices'
  | 'zero-area'
  | 'self-intersection'
  | 'multiple-rings'
  | 'non-finite-coordinate'

export interface UnsupportedOutlineResult {
  readonly status: 'unsupported-outline'
  readonly reason: UnsupportedOutlineReason
}

/** An axis-aligned box, millimetres. */
export interface BoxMM {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/**
 * One material-derived arrangement in one population — blueprint §6.2: the connected components of
 * the active-pair graph, at least one edge, so a single magnet can never appear (L4).
 */
export interface ArrangementRecord {
  /** Canonical id: vertex list + edge list, so topology is part of identity (Pixel's audit point). */
  readonly id: string
  readonly populationPitchMM: PopulationPitchMM
  /** The window extent this component was found in — provenance, not geometry. */
  readonly windowRows: number
  readonly windowColumns: number
  /** L6, per axis: rows and columns can carry different parity. */
  readonly registration: { readonly x: AxisRegistration; readonly y: AxisRegistration }
  /**
   * Magnet centres in the SHAPE FRAME — canon §2.2: "returned magnet coordinate is qshape = q − a…
   * no consumer needs the engine's lattice target". These are the coordinates to manufacture from.
   */
  readonly magnetsMM: readonly PointMM[]
  /** Active pair edges as index pairs into magnetsMM. */
  readonly edges: ReadonlyArray<readonly [number, number]>
  /** §7.1: each edge's padded box; their union is the region the shape must encapsulate (L18). */
  readonly pairBoxesMM: readonly BoxMM[]
  /**
   * DESCRIPTION, not selection (Dan: the engine presents all options; optimal is decided manually).
   * floor = exactly one adjacent pair · optimum = four corners of the outermost rectangular extent,
   * first lawful published size in this component's own interval (§6.3) · intermediate = the rest.
   */
  readonly classification: 'floor' | 'intermediate' | 'optimum'
}

/** EC-07's binding explanation: the contact that limits the fit names itself. */
export interface BindingContact {
  readonly populationPitchMM: PopulationPitchMM
  readonly magnetMM: PointMM
  readonly outlineEdgeIndex: number
  readonly closestOutlinePointMM: PointMM
  readonly clearanceMM: number
}

/** §8.0: the population's relationship to every tested centre — evidence, never a gate. */
export interface CentreRelationship {
  readonly centreMethod: CentreMethod
  readonly shapeCentreMM: PointMM
  readonly magnetCentroidMM: PointMM
  readonly displacementMM: PointMM
  readonly distanceMM: number
}

/**
 * §8.2 — Dan's flap model: the padded grid box, four overhangs, their spread. Per population,
 * because the two populations have different extents (EC-09). Both switch outcomes reported;
 * passing 24 never implies passing 12.
 */
export interface PopulationEvidence {
  readonly arrangement: ArrangementRecord
  readonly gridBoxMM: BoxMM
  readonly overhangMM: {
    readonly left: number
    readonly right: number
    readonly top: number
    readonly bottom: number
  }
  readonly overhangSpreadMM: number
  /** keyed by the switch value as a string, e.g. "12" and "24". */
  readonly flapPass: Readonly<Record<string, boolean>>
  /** EC-13 / canon §2.2: per-population fix kind and the size-only eligibility fact. */
  readonly fix: FixClassification
  readonly bindingContact: BindingContact
  readonly centreRelationships: readonly CentreRelationship[]
  /** §8.4: boundary vertices at locally maximal radial distance — where limbs protrude. */
  readonly extremities: readonly MaterialExtremity[]
  /** §8.5: unsupported material OUTSIDE the grid box, per side — the only zones entering flap. */
  readonly outsideBoxZones: readonly OutsideBoxZone[]
}

/** §8.4: a boundary point that is a non-strict local maximum of radial distance from the centre. */
export interface MaterialExtremity {
  readonly pointMM: PointMM
  readonly side: 'left' | 'right' | 'top' | 'bottom'
  readonly overhangMM: number
  readonly exceedsLimit: Readonly<Record<string, boolean>>
}

/** §8.5: one connected run of outline beyond the grid box on one side. */
export interface OutsideBoxZone {
  readonly side: 'left' | 'right' | 'top' | 'bottom'
  readonly maxOverhangMM: number
  readonly outlineLengthMM: number
  readonly classification: 'unsupported-zone' | 'limb-candidate'
  /** L14: the exemption is measured and shown, never applied — always pending a human eye. */
  readonly status: 'exception-pending' | 'within-limit'
}

/**
 * EC-13: twin-fix classification. DESCRIPTIVE — an over-limit twin fix is reported with
 * sizeEligible:false, never dropped, because an answer that omits candidates cannot be audited
 * against the ones it kept.
 */
export interface FixClassification {
  readonly kind: 'twin-fix' | 'multi-fix'
  readonly sizeEligible: boolean
  readonly limitMM: number
}

/**
 * One family — EC-07's answer. Both populations proven at ONE published size and ONE scale (EC-05);
 * a pair holding at 48 at one size and at 96 at another is two answers, not a product.
 */
export interface MeasuredCutoutVariantFamily {
  readonly familyId: string
  readonly band: OperationalBand
  readonly centreMethod: CentreMethod
  /** The tested centre in the source outline's own frame. */
  readonly centreMM: PointMM
  /** The parity target the shape centre is placed on, engine frame (§5.2). */
  readonly parityTargetMM: PointMM
  /** L10 + grid-spec §6: whole even millimetres, upward, inside a lawful interval. */
  readonly publishedEvenMM: number
  readonly scale: number
  readonly widthMM: number
  readonly heightMM: number
  /** The exact lawful scale interval this size was published from (§7.4)… */
  readonly lawfulScaleInterval: readonly [number, number]
  /** …and the same interval in manufactured millimetres (canon: "the exact source interval and
   *  manufactured-size interval"). */
  readonly lawfulSizeIntervalMM: readonly [number, number]
  readonly populations: Readonly<Record<'48' | '96', PopulationEvidence>>
  /** Canon §2.2 names these explicitly on the family. */
  readonly arrangementId48: string
  readonly arrangementId96: string
  /** Family-level description derived from the two populations' classifications (§6.3). */
  readonly classification: 'floor' | 'intermediate' | 'optimum'
}

/** §2.2: an unsuccessful band states itself with the reason — never an empty array (G8). */
export interface EmptyBandRecord {
  readonly band: OperationalBand
  readonly centreMethod: CentreMethod
  readonly reason: string
}

/** §2.2 diagnostics — outside family identity, but deterministic and serialised. */
export interface PendingProductQuestion {
  readonly id: 'disconnected-union'
  readonly affectedWindows: ReadonlyArray<{
    readonly windowId: string
    readonly componentCount: number
  }>
}

/**
 * EC-11b: offerings are a DERIVED VIEW. Until Dan rules the separation value and thinning rule,
 * status is 'separation-policy-unresolved', rawFamilyIds is complete, and there is no ladder.
 * The engine may not guess a separation, fall back to first-fit, or filter in the interface.
 */
export interface Offerings {
  readonly status: 'complete' | 'separation-policy-unresolved'
  readonly rawFamilyIds: readonly string[]
  readonly ladderFamilyIds: readonly string[]
  readonly separationMM?: number
}

export interface SolveResult {
  readonly status: 'solved'
  /** §9: same canonical outline + same guarded spec ⇒ byte-identical result. */
  readonly requestFingerprint: string
  readonly outlineFacts: {
    readonly pointCount: number
    readonly sourceLongestSideMM: number
    readonly bboxMM: BoxMM
  }
  readonly families: readonly MeasuredCutoutVariantFamily[]
  readonly emptyBands: readonly EmptyBandRecord[]
  readonly offerings: Offerings
  readonly diagnostics: {
    readonly outlinePointCount: number
    readonly solveDurationMS: number
    readonly pendingProductQuestions: readonly PendingProductQuestion[]
  }
}

export type SolveOutcome = SolveResult | UnsupportedOutlineResult
