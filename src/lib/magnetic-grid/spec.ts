// grid-origin-spec.ts — SPEC: values only. No arithmetic, no policy.

/** The lattice, centre to centre. */
export const DEFAULT_PITCH_MM = 48

/** Released pitches. 96 = the 48 lattice thinned (every second point); 24 = fine bench tier. */
export const RELEASED_PITCHES_MM: ReadonlyArray<{ mm: number; label: string }> = Object.freeze([
  Object.freeze({ mm: 24, label: '24 mm' }),
  Object.freeze({ mm: 48, label: '48 mm' }),
  Object.freeze({ mm: 96, label: '96 mm' }),
])

/** Padding slider range — admin test bounds around the locked 12. */
export const PADDING_FLOOR_MM = 10
export const PADDING_CEIL_MM = 30

/** Released padding — locked 12mm, measured from the magnet centre. */
export const RELEASED_PADDING_MM = 12

/** Smallest effect — one 24mm cell. */
export const MIN_EFFECT_MM = 24

/** Field positions per axis (9×9). */
export const FIELD_POSITIONS_PER_AXIS = 9

/** Extra size past the board's span so a shape can pad past the outermost spots (408 → 420). */
export const SIZE_CEIL_MARGIN_MM = 12

/** Magnet body diameters. */
export const MAGNET_DIA_SMALL_MM = 6
export const MAGNET_DIA_LARGE_MM = 8

/** Fewest seated magnets the perimeter belt may thin down to. */
export const MIN_ANCHORS = 2

/** Shape sizes are even millimetres (Dan, 2026-08-23); the ladder steps by 2. */
export const SIZE_STEP_MM = 2

/** Size bands of even sizes, inclusive; no size lives in two bands. */
export type BandId = 1 | 2 | 3 | 4
export interface Band { readonly id: BandId; readonly minMM: number; readonly maxMM: number }
export const BANDS: ReadonlyArray<Band> = Object.freeze([
  Object.freeze({ id: 1 as const, minMM: 24, maxMM: 70 }),
  Object.freeze({ id: 2 as const, minMM: 72, maxMM: 118 }),
  Object.freeze({ id: 3 as const, minMM: 120, maxMM: 166 }),
  Object.freeze({ id: 4 as const, minMM: 168, maxMM: 214 }),
])

/** Flap allowance — the invisible margin every disc wears (Dan's contact law): band options
 *  are the sizes where the edge presses against spot + allowance. RULED 2026-08-19: the
 *  factory default is 0 — edge-to-edge tangency; any margin is an explicit admin grant. */
export const FLAP_MM = 0
export const FLAP_FLOOR_MM = 0
export const FLAP_CEIL_MM = 48

/** Minimum touch (Dan, 2026-08-23): how many perimeter-belt discs must wrap within the flap; the
 *  rest may carry air — shape imperfection is allowed. Admin dial, default 1. */
export const MIN_TOUCH = 1
export const MIN_TOUCH_FLOOR = 1
export const MIN_TOUCH_CEIL = 8

/** Mass depth — clearance a region must survive to count as a MASS (limbs and slivers die
 *  shallow, true masses survive deep). Admin-dialled; 12 = every legal point counts. */
export const MASS_DEPTH_MM = 16
export const MASS_DEPTH_FLOOR_MM = 12
export const MASS_DEPTH_CEIL_MM = 24

/** Governor — which mass rules in Masses mode: 0 smallest · 1 deepest · 2 top (gravity) ·
 *  3 top-small (upper-half smallest, else topmost). */
export const GOVERNOR = 0

/** Centre mode — which centre drives anchoring and balance. Test switch:
 *  0 box · 1 core (erosion mean) · 2 masses (adaptive, default) · 3 weight (material
 *  centroid) · 4 deep (deepest point) · 5 top (highest mass). */
export const CENTRE_MODE = 2

export type Pt = [number, number]
export interface BoundaryTruth {
  rule: 'supplied-final-contour'
  contourIdentity: string
}
/** Nearest-outline witness for one belt disc; clearanceMM is on the 1 mm ruler (ruler-zero is not literal touch). */
export interface ContactWitness { beltAnchorMM: Pt; outlinePointMM: Pt; clearanceMM: number }
type WrapRefusalReason = 'invalid-boundary' | 'empty-belt'
export type WrapMeasurement =
  | { status: 'measured'; beltClearancesMM: readonly number[]; witnesses: readonly ContactWitness[]; refusal: null }
  | { status: 'refused'; requiredFlapMM: null; witnesses: readonly []; refusal: { code: 'NO_WRAPPED_LAYOUT_IN_BAND'; reason: WrapRefusalReason } }
export type WrapPolicy = ({ mode: 'fixed'; allowanceMM: number } | { mode: 'auto'; capMM: number }) & { minTouch: number }
export type WrapEvaluation =
  | { status: 'lawful'; requiredFlapMM: number; appliedFlapMM: number; witnesses: readonly ContactWitness[] }
  | { status: 'refused'; code: 'WRAP_EXCEEDS_ALLOWANCE' | 'AUTO_FLAP_CAP_EXCEEDED'; requiredFlapMM: number; allowedFlapMM: number; witnesses: readonly ContactWitness[] }
  | { status: 'refused'; code: 'NO_WRAPPED_LAYOUT_IN_BAND'; reason: WrapRefusalReason; requiredFlapMM: null; allowedFlapMM: null; witnesses: readonly [] }
interface Ring { pts: Pt[] }
export interface Contour { outer: Ring; holes: Ring[] }
export interface BBox { minX: number; minY: number; maxX: number; maxY: number }

export interface SafeMass {
  areaMM2: number
  centreMM: Pt
  peakClearMM: number
  bbox: BBox
  rings: Pt[][]
}

export interface SafeSegment extends SafeMass {
  meanMM: Pt
  masses: SafeMass[]
}

export type MagnetPlan = 'all6' | 'all8' | 'corners8'
type MagnetDia = typeof MAGNET_DIA_SMALL_MM | typeof MAGNET_DIA_LARGE_MM
export interface Anchor { p: Pt; dia: MagnetDia }
export type CentreMode = 0 | 1 | 2 | 3 | 4 | 5
export type Governor = 0 | 1 | 2 | 3

export interface CentreMeasurements {
  box: Pt
  weight: Pt
  core: Pt
  deep: Pt
  masses: SafeMass[]
  top: Pt
}

export interface CentrePlacementMeasurement {
  phaseMM: Pt
  seated: Pt[]
  canon: number
  excessMM: number
}

export interface CentrePhaseCandidate { phaseMM: Pt; canon: number }

export interface ExtremeCornerMeasurement { p: Pt; extremeCorner: boolean }

export interface GridConfig {
  pitchMM?: number
  paddingMM?: number
  flapMM?: number
  forcePhaseMM?: Pt
  massDepthMM?: number
  centreMode?: number
  governor?: number
  plan?: MagnetPlan
  perimeterOnly?: boolean
  wrapMode?: 'fixed' | 'auto'
  autoFlapCapMM?: number
  minTouch?: number
}

/** Which parity placement: the canonical frame, or the half-pitch shift on x, y or both. */
export interface Placement { xHalf: boolean; yHalf: boolean }
export interface ParityMeasurement { parityTrue: boolean; centreErrorMM: number }
export type Concession = 'CENTRE' | 'WRAP'

/** One placement at one even size — render-complete for its own phase; Logic judges wrapMeasurement once. */
export interface PlacementCandidate {
  sizeMM: number
  placement: Placement
  phaseMM: Pt
  lattice: Pt[]
  seated: Pt[]
  anchors: Anchor[]
  magnetCount: number
  parityTrue: boolean
  centreErrorMM: number
  wrapMeasurement: WrapMeasurement
}

export interface GridResult {
  anchors: Anchor[]
  pitchCentreMM: number
  lattice: Pt[]
  phaseMM: Pt
  spotRadiusMM: number
  contactsMM: Pt[]
  segments: SafeSegment[]
  centresMM: Pt[]
  centreMainMM: Pt
  wrap: WrapEvaluation
  parityTrue: boolean
  centreErrorMM: number
  concessions: Concession[]
  /** All four parity placements at this size, measured. */
  candidates: PlacementCandidate[]
}

/** A placement Logic accepted: the candidate plus the one lawful Wrap verdict attached to it. */
export interface LawfulLayout { candidate: PlacementCandidate; wrap: Extract<WrapEvaluation, { status: 'lawful' }> }
/** One published magnet count: its band, its first accepted even size, every co-lawful layout (gravity-ordered). */
export interface Rung { band: BandId; sizeMM: number; magnetCount: number; layouts: LawfulLayout[] }
export type RefusalCode =
  | 'NO_CENTRE'
  | 'NO_PARITY_LAWFUL_PLACEMENT'
  | 'WRAP_EXCEEDS_ALLOWANCE'
  | 'NO_WRAPPED_LAYOUT_IN_BAND'
  | 'AUTO_FLAP_CAP_EXCEEDED'
  | 'NO_NEW_MAGNET_COUNT_IN_BAND'
export interface BandLadder { band: BandId; rungs: Rung[]; refusal: null | { code: RefusalCode } }
/** Every even size computed once and stored; rung selection renders from here without a solve. */
export interface BandSolveResult { bands: BandLadder[]; gridsBySize: ReadonlyMap<number, GridResult> }
