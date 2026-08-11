// THE PUBLIC DATA CONTRACT — blueprint §2, and nothing besides.
//
// Blueprint §1: "contract.ts — request, result and failure types only." TYPES ONLY — no runtime
// value lives here (§4: the centre registry is owned by centres.ts, which also owns §9's
// canonical registry order). Every number the solver uses arrives through SolveRequest.spec, the
// guarded law input; a literal here would be a second door past the guard.
//
// Every construct cites the canon clause it implements (blueprint §§2, 3, 6.3, 7.1–7.8, 8.0–8.4, 9).

/** One point, millimetres. x right, y down — the tracer's own frame. */
export type PointMM = readonly [number, number]

/** Blueprint §2.1: the six centre constructions. TYPE ONLY — the registry array and its §9
 *  canonical order live in centres.ts (B6). */
export type CentreMethod =
  | 'box'
  | 'oriented-box'
  | 'area'
  | 'perimeter'
  | 'vertices'
  | 'maximum-clearance'

/** EC-03: bands 2 and 3 are operational. 1 is below the pair floor; 4 is ruled non-operational. */
export type OperationalBand = 2 | 3

/** L6: parity decides registration per axis — an even run sits in the gap, an odd run on a point. */
export type AxisRegistration = 'point' | 'gap'

/**
 * B5: the two populations are SEMANTIC slots — base, and base thinned by the guarded sparseFactor
 * (L7). Their numeric pitch is DERIVED and carried as a value, never fixed in the type: a spec
 * mutation (base pitch, sparse factor) must produce a type-correct rederived population.
 */
export type PopulationSlot = 'base' | 'sparse'

/**
 * §9 / B4: where exact event ordering or equality requires it, a value is carried as its defining
 * polynomial plus an isolating interval — never as a rounded double. "Algebraic contact roots are
 * represented by defining polynomial plus isolating interval only where exact event
 * ordering/equality requires it. Ordinary non-boundary arithmetic need not be promoted."
 */
export interface ExactValue {
  /**
   * Coefficients of the defining polynomial, constant term first — CANONICAL DECIMAL STRINGS
   * (§9: "IDs hash canonical exact numeric encodings, never runtime object order"; a JS number
   * cannot carry general exact integer/rational identity).
   */
  readonly polynomial: readonly string[]
  /** Isolating interval containing exactly this root, endpoints as canonical decimal strings. */
  readonly isolating: readonly [string, string]
  /** A double approximation for display and non-identity arithmetic. Never the identity. */
  readonly approx: number
}

/** §7.2: a closed lawful interval whose endpoints carry exact identity. */
export interface ExactInterval {
  readonly lo: ExactValue
  readonly hi: ExactValue
}

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

/** M3 §3.1: refused explicitly, never repaired into an answer (G2). */
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
 * §7.6 / B1, second field of the pair: one magnet's record — coordinate, its minimum implied disc
 * clearance, and the disc contact that attains it. "Also re-evaluate every magnet disc and retain
 * its minimum clearance as an invariant." Distinct from the region binding and never renamed into it.
 */
export interface MagnetRecord {
  /** Shape frame — §2.2: "returned magnet coordinate is qshape = q − a". */
  readonly coordinateMM: PointMM
  readonly impliedDiscClearanceMM: number
  readonly discContact: {
    readonly outlineEdgeIndex: number
    readonly closestOutlinePointMM: PointMM
  }
}

/**
 * §7.6 / B1, first field of the pair: the REGION binding contact — "the minimum exact boundary
 * separation between Q(A) and the manufactured outline… retain the lexicographically first tuple
 * (separation, population, regionFeature, outlineFeature, closestPoints)". This explains the
 * manufactured size; the disc clearance above proves implied support. Two facts, two fields.
 */
export interface RegionBindingContact {
  readonly separationMM: number
  readonly population: PopulationSlot
  /** The region feature in contact: a pair-box edge or corner, named by pair-box index + feature. */
  readonly regionFeature: {
    readonly pairBoxIndex: number
    readonly kind: 'edge' | 'corner'
    readonly which: 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  }
  /** The outline feature in contact: an edge or a vertex, by index. */
  readonly outlineFeature: {
    readonly kind: 'edge' | 'vertex'
    readonly index: number
  }
  readonly closestPoints: {
    readonly onRegionMM: PointMM
    readonly onOutlineMM: PointMM
  }
}

/**
 * One material-derived arrangement in one population — §6.2: the connected components of the
 * active-pair graph, at least one edge, so a single magnet can never appear (L4).
 */
export interface ArrangementRecord {
  /**
   * Canonical id: vertex list + edge list, so topology is part of identity — §6.2 ("canonical
   * vertex-and-edge identity") and §9 ("IDs hash canonical exact numeric encodings").
   */
  readonly id: string
  readonly population: PopulationSlot
  /** Derived pitch value for this population — a value, not a type literal (B5). */
  readonly populationPitchMM: number
  /** The window extent this component was found in — provenance, not geometry. */
  readonly windowRows: number
  readonly windowColumns: number
  /** L6, per axis: rows and columns can carry different parity. */
  readonly registration: { readonly x: AxisRegistration; readonly y: AxisRegistration }
  /** §7.6 / B3: per-magnet records — coordinate, implied disc clearance, disc contact. */
  readonly magnets: readonly MagnetRecord[]
  /** Active pair edges as index pairs into magnets. */
  readonly edges: ReadonlyArray<readonly [number, number]>
  /** §7.1: each edge's padded box… */
  readonly pairBoxesMM: readonly BoxMM[]
  /**
   * §7.1: Q(A) — the exact region union — is CANONICALLY REPRESENTED by its ordered constituent
   * pair boxes above. A single polygon ring cannot encode it: the 2×2 union is a RING with a 24×24
   * centre hole, so publishing one ring would be a false polygon. Union geometry is always derived
   * from pairBoxesMM; no second representation exists to drift from it.
   */
}

/** §8.0: the population's relationship to every tested centre — evidence, never a gate (EC-08). */
export interface CentreRelationship {
  readonly centreMethod: CentreMethod
  readonly shapeCentreMM: PointMM
  readonly magnetCentroidMM: PointMM
  readonly displacementMM: PointMM
  readonly distanceMM: number
}

/**
 * §8.3 / B2: a material extremity is an outline point ATTAINING a manufactured bound — all points
 * at shapeLeft, shapeRight, shapeTop or shapeBottom. On a polygon: a vertex, or a collinear
 * boundary segment canonicalised by its ordered endpoints. "No radial extremity, angular cone or
 * nearest-disc distance is part of flap."
 */
export interface MaterialExtremity {
  readonly side: 'left' | 'right' | 'top' | 'bottom'
  /** A vertex carries one point; a collinear segment carries its two ordered endpoints. */
  readonly kind: 'vertex' | 'segment'
  readonly pointsMM: readonly PointMM[]
  /** That side's population-specific overhang (§8.3). */
  readonly sideOverhangMM: number
}

/**
 * §8.4 / B2: one maximal connected outside-box boundary chain — the exact segment/box intersections
 * partition the manufactured boundary against the complement of the grid box. A chain is a
 * limb-candidate exactly when it contains a material extremity; otherwise unsupported-zone. The
 * exemption is never approved by the engine: any over-limit limb remains exception-pending for
 * applied visual confirmation.
 */
export interface OverhangZone {
  readonly population: PopulationSlot
  readonly sidesCrossed: ReadonlyArray<'left' | 'right' | 'top' | 'bottom'>
  /** Ordered boundary coordinates of the chain, shape frame. */
  readonly boundaryMM: readonly PointMM[]
  readonly bboxMM: BoxMM
  /** Maximum side overhang from §8.2 attained on this chain. */
  readonly maxOverhangMM: number
  readonly containedExtremities: readonly MaterialExtremity[]
  readonly classification: 'unsupported-zone' | 'limb-candidate'
  /** Present exactly when the chain exceeds the selected switch: always pending, never approved. */
  readonly exception?: 'exception-pending'
}

/**
 * §7.7 / EC-13: twin-fix classification, per population. DESCRIPTIVE — an over-limit twin fix is
 * reported with sizeEligible:false, never dropped: an answer that omits candidates cannot be
 * audited against the ones it kept. The limit is derived from guarded values at solve time
 * (twinFixBaseSpan + max flap limit), never stored as an engine literal.
 */
export interface FixClassification {
  readonly kind: 'twin-fix' | 'multi-fix'
  readonly sizeEligible: boolean
  readonly limitMM: number
}

/**
 * §8.1–§8.4 evidence for one population. Flap is per population because the two arrangements have
 * different coordinates and extents; "there is no singular family-level reach".
 */
export interface PopulationEvidence {
  readonly arrangement: ArrangementRecord
  /**
   * §6.3 — classification is a property of THIS PUBLISHED OCCURRENCE, not of the geometry record:
   * four-corner `optimum` requires being the FIRST lawful published size in the arrangement's own
   * interval, so the same arrangement id is `intermediate` at every later size. DESCRIPTION, never
   * selection — Dan: the engine presents all options; optimal is decided manually.
   */
  readonly classification: 'floor' | 'intermediate' | 'optimum'
  /** §8.1: the padded grid bounding box — nothing inside it is flap. */
  readonly gridBoxMM: BoxMM
  /** §8.2: the four exact overhangs — the complete flap measure. */
  readonly overhangMM: {
    readonly left: number
    readonly right: number
    readonly top: number
    readonly bottom: number
  }
  readonly overhangSpreadMM: number
  /**
   * §8.2: the switch outcomes, ORDERED one-for-one from SolveRequest.flapLimitsMM — exactly the two
   * guarded values, no extra or missing keys, no runtime object-order drift. Passing the larger
   * never implies passing the smaller.
   */
  readonly flapOutcomes: ReadonlyArray<{ readonly limitMM: number; readonly passes: boolean }>
  /** §7.6: the region binding contact — what set the size (B1). */
  readonly regionBinding: RegionBindingContact
  /** §7.7: per-population fix classification (canon §2.2 lists it per population). */
  readonly fix: FixClassification
  /** §8.0: relationship to every tested centre. */
  readonly centreRelationships: readonly CentreRelationship[]
  /** §8.3: every outline point attaining a manufactured bound. */
  readonly extremities: readonly MaterialExtremity[]
  /** §8.4: the outside-box boundary chains — the only zones entering EC-09 flap coverage. */
  readonly overhangZones: readonly OverhangZone[]
}

/**
 * One family — EC-07's answer. Both populations proven at ONE published size and ONE scale
 * (EC-05 / §7.3); a pair holding at base at one size and at sparse at another is two answers.
 */
export interface MeasuredCutoutVariantFamily {
  readonly familyId: string
  readonly band: OperationalBand
  readonly centreMethod: CentreMethod
  /** The tested centre in the source outline's own frame. */
  readonly centreMM: PointMM
  /** The parity target the shape centre is placed on, engine frame, labelled diagnostic (§5.2). */
  readonly parityTargetMM: PointMM
  /** B3: family per-axis registration — the parity target's own parity, shared by both populations. */
  readonly registration: { readonly x: AxisRegistration; readonly y: AxisRegistration }
  /** L10 + grid-spec §6: whole even millimetres, upward, inside a lawful interval. */
  readonly publishedEvenMM: number
  readonly scale: number
  readonly widthMM: number
  readonly heightMM: number
  /** §7.2 / B4: the exact lawful scale interval — endpoints carry algebraic identity… */
  readonly lawfulScaleInterval: ExactInterval
  /** …and the same interval in manufactured millimetres ("the exact source interval and
   *  manufactured-size interval"). */
  readonly lawfulSizeIntervalMM: ExactInterval
  /** Canon §2.2 names these explicitly on the family. */
  readonly arrangementIdBase: string
  readonly arrangementIdSparse: string
  readonly populations: Readonly<Record<PopulationSlot, PopulationEvidence>>
  /** §8.2: the combined outcomes, same ordered form — a family passes a switch only when BOTH
   *  populations pass it. */
  readonly familyFlapOutcomes: ReadonlyArray<{ readonly limitMM: number; readonly passes: boolean }>
  /** Family-level description derived from the two populations' OCCURRENCE classifications (§6.3). */
  readonly classification: 'floor' | 'intermediate' | 'optimum'
  /**
   * B3 / canon §2.2: "a status derived only from the settled hard predicates" — containment held,
   * publication inside the lawful interval, both populations coupled. Nothing unruled enters it.
   */
  readonly status: 'lawful'
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
 * §7.8 / EC-11b: offerings are a DERIVED VIEW. Until the separation value and thinning rule are
 * ruled and supplied as guarded product inputs: status is 'separation-policy-unresolved',
 * rawFamilyIds is complete, ladderFamilyIds is empty. The engine may not guess 12, 24 or 48,
 * use first-fit, or hide clustered answers behind an undocumented UI filter.
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
