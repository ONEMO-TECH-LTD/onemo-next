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

/** One inspected size: what is rendered, plus EVERY lawful layout the laws admitted there.
 *  Free mode and band solving return the same record from the same path. */
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
  parityTrue: boolean
  centreErrorMM: number
  concessions: Concession[]
  /** Every layout at this size that satisfies Centre and Fit — nothing hidden. */
  layouts: LawLayout[]
  /** What the displayed grid is: the marked layout, a manual registration, or nothing lawful. */
  displaySource: 'recommended-layout' | 'manual-registration' | 'no-lawful-layout'
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ONE CONFIGURATION OWNER (Dan, 2026-08-23: "all the specs must be inside spec module … no
// spec value must be hardcoded, it must be exposed to be changed and calibrated").
//
// Spec declares names, types, bounds, options and DEFAULTS. The runtime consumes the ACTIVE
// CONFIGURED value — never the constant. Every field below is result-affecting and has a control;
// values that cannot change a verdict (viewport, colours, cache capacities) stay with their owner.

export type Coverage = 'full' | 'perimeter'

/** Every calibration the solver reads. Non-optional by construction: no downstream default,
 *  clamp or fallback is permitted, so a missing field is a validation failure, not a 0. */
export interface SolverConfig {
  readonly bands: readonly Band[]
  readonly sizeStepMM: number
  readonly registrationStepMM: number
  readonly pitchMM: number
  readonly fieldPositionsPerAxis: number
  readonly paddingMM: number
  readonly freeSizeMinMM: number
  readonly freeSizeMaxMM: number
  readonly outlineOffsetMM: number
  readonly flapEnabled: boolean
  readonly flapLimitMM: number
  readonly autoFlapEnabled: boolean
  readonly autoFlapCapMM: number
  /** RETIRED IN INCREMENT 2 — kept here only so Increment 1 changes no behaviour. */
  readonly minTouch: number
  readonly centreMode: CentreMode
  readonly governor: Governor
  readonly massDepthMM: number
  readonly measurementStepMM: number
  readonly coverage: Coverage
  readonly magnetPlan: MagnetPlan
  readonly magnetDiaSmallMM: number
  readonly magnetDiaLargeMM: number
  readonly minAnchors: number
  readonly contourFlattenRefMM: number
  readonly contourMaxVertices: number
  /** Centre-ruler sampling. These shape the mass/island geometry the anchor is measured from, so
   *  they are calibration, not internals: exposed under advanced Centre sampling. */
  readonly centreSampleMaxVertices: number
  readonly centreMeshQuantumMM: number
  readonly centreRefineStepMM: number
  /** Seat-kernel resolution: the integer lattice the exact in-material test runs on, and the band
   *  around the spot radius where that exact test replaces the float shortcut. Identity/acceleration
   *  rather than law — but exposed, because nothing the solver reads may be hidden. */
  readonly seatQuantumMM: number
  readonly seatGuardMM: number
  /** Two magnet lines closer than this count as one line when parity is measured. */
  readonly parityLineQuantumMM: number
  /** How many lattice steps apart two magnets may sit and still form a ruled pair/population —
   *  1 = the dense 48 grid only, 2 = the ruled 96 sparse population as well. */
  readonly maxPopulationStep: number
}

/** What varies per request rather than per calibration. */
export interface SolveInput {
  readonly contour: Contour
  readonly requestedSizeMM: number
  readonly forcedPhaseMM: Pt | null
}

export const SOLVER_DEFAULTS: SolverConfig = Object.freeze({
  bands: BANDS,
  sizeStepMM: SIZE_STEP_MM,
  registrationStepMM: 1,
  pitchMM: DEFAULT_PITCH_MM,
  fieldPositionsPerAxis: FIELD_POSITIONS_PER_AXIS,
  paddingMM: RELEASED_PADDING_MM,
  freeSizeMinMM: MIN_EFFECT_MM,
  freeSizeMaxMM: (FIELD_POSITIONS_PER_AXIS - 1) * DEFAULT_PITCH_MM + 2 * RELEASED_PADDING_MM + SIZE_CEIL_MARGIN_MM,
  outlineOffsetMM: 0,
  flapEnabled: true,
  flapLimitMM: FLAP_MM,
  autoFlapEnabled: false,
  autoFlapCapMM: FLAP_MM,
  minTouch: MIN_TOUCH,
  centreMode: CENTRE_MODE as CentreMode,
  governor: GOVERNOR as Governor,
  massDepthMM: MASS_DEPTH_MM,
  measurementStepMM: 1,
  coverage: 'perimeter',
  magnetPlan: 'all6',
  magnetDiaSmallMM: MAGNET_DIA_SMALL_MM,
  magnetDiaLargeMM: MAGNET_DIA_LARGE_MM,
  minAnchors: MIN_ANCHORS,
  contourFlattenRefMM: 250,
  contourMaxVertices: 600,
  centreSampleMaxVertices: 800,
  centreMeshQuantumMM: 0.01,
  centreRefineStepMM: 0.5,
  seatQuantumMM: 0.001,
  seatGuardMM: 0.05,
  parityLineQuantumMM: 0.001,
  maxPopulationStep: 2,
})

type NumberField = { [K in keyof SolverConfig]: SolverConfig[K] extends number ? K : never }[keyof SolverConfig]
type ToggleField = { [K in keyof SolverConfig]: SolverConfig[K] extends boolean ? K : never }[keyof SolverConfig]

export type SolverControl =
  | { kind: 'number'; field: NumberField; label: string; unit: 'mm' | ''; min: number; max: number; step: number; group: ControlGroup; retired?: string }
  | { kind: 'toggle'; field: ToggleField; label: string; group: ControlGroup; retired?: string }
  | { kind: 'options'; field: 'pitchMM' | 'centreMode' | 'governor' | 'coverage' | 'magnetPlan'; label: string; options: ReadonlyArray<{ value: number | string; label: string }>; group: ControlGroup; retired?: string }
  | { kind: 'bands'; field: 'bands'; label: string; group: ControlGroup }

export type ControlGroup = 'search' | 'grid' | 'law' | 'centre' | 'output' | 'contour'

/** Every control the v3.5.4 admin dash renders. `retired` marks a control kept visible but
 *  inactive with its reason — never deleted, because the comparison tabs still explain it. */
export const SOLVER_CONTROLS: readonly SolverControl[] = Object.freeze([
  { kind: 'bands', field: 'bands', label: 'Size bands', group: 'search' },
  { kind: 'number', field: 'sizeStepMM', label: 'Size scan step', unit: 'mm', min: 1, max: 24, step: 1, group: 'search' },
  { kind: 'number', field: 'registrationStepMM', label: 'Placement step · grid slide', unit: 'mm', min: 1, max: 24, step: 1, group: 'search' },
  { kind: 'number', field: 'measurementStepMM', label: 'Measurement ruler', unit: 'mm', min: 1, max: 4, step: 1, group: 'search' },
  { kind: 'options', field: 'pitchMM', label: 'Grid pitch', options: RELEASED_PITCHES_MM.map((p) => ({ value: p.mm, label: p.label })), group: 'grid' },
  { kind: 'number', field: 'paddingMM', label: 'Magnet padding · per spot', unit: 'mm', min: PADDING_FLOOR_MM, max: PADDING_CEIL_MM, step: 1, group: 'grid' },
  { kind: 'number', field: 'fieldPositionsPerAxis', label: 'Board positions per axis', unit: '', min: 3, max: 15, step: 1, group: 'grid' },
  { kind: 'number', field: 'magnetDiaSmallMM', label: 'Magnet body · small', unit: 'mm', min: 4, max: 12, step: 1, group: 'grid' },
  { kind: 'number', field: 'magnetDiaLargeMM', label: 'Magnet body · large', unit: 'mm', min: 4, max: 12, step: 1, group: 'grid' },
  { kind: 'toggle', field: 'flapEnabled', label: 'Flap limit active', group: 'law' },
  { kind: 'number', field: 'flapLimitMM', label: 'Flap · outer overhang limit', unit: 'mm', min: FLAP_FLOOR_MM, max: FLAP_CEIL_MM, step: 1, group: 'law' },
  { kind: 'toggle', field: 'autoFlapEnabled', label: 'Auto flap', group: 'law' },
  { kind: 'number', field: 'autoFlapCapMM', label: 'Auto flap cap', unit: 'mm', min: FLAP_FLOOR_MM, max: FLAP_CEIL_MM, step: 1, group: 'law' },
  { kind: 'number', field: 'minTouch', label: 'Minimum touch · belt magnets that must wrap', unit: '', min: MIN_TOUCH_FLOOR, max: MIN_TOUCH_CEIL, step: 1, group: 'law' },
  { kind: 'number', field: 'minAnchors', label: 'Fewest magnets a layout may hold', unit: '', min: 1, max: 8, step: 1, group: 'law' },
  { kind: 'options', field: 'centreMode', label: 'Centre mode', options: [{ value: 0, label: 'Box' }, { value: 1, label: 'Core' }, { value: 2, label: 'Masses' }, { value: 3, label: 'Weight' }, { value: 4, label: 'Deep' }, { value: 5, label: 'Top' }], group: 'centre' },
  { kind: 'options', field: 'governor', label: 'Mass governor', options: [{ value: 0, label: 'Smallest' }, { value: 1, label: 'Deepest' }, { value: 2, label: 'Top' }, { value: 3, label: 'Top-small' }], group: 'centre' },
  { kind: 'number', field: 'massDepthMM', label: 'Mass depth · clearance to count', unit: 'mm', min: MASS_DEPTH_FLOOR_MM, max: MASS_DEPTH_CEIL_MM, step: 1, group: 'centre' },
  { kind: 'options', field: 'coverage', label: 'Coverage', options: [{ value: 'full', label: 'Full grid' }, { value: 'perimeter', label: 'Perimeter belt' }], group: 'output' },
  { kind: 'options', field: 'magnetPlan', label: 'Magnet plan', options: [{ value: 'all6', label: 'All 6mm' }, { value: 'all8', label: 'All 8mm' }, { value: 'corners8', label: 'Corners 8' }], group: 'output' },
  { kind: 'number', field: 'freeSizeMinMM', label: 'Free size · minimum', unit: 'mm', min: MIN_EFFECT_MM, max: 400, step: 2, group: 'output' },
  { kind: 'number', field: 'freeSizeMaxMM', label: 'Free size · maximum', unit: 'mm', min: MIN_EFFECT_MM, max: 600, step: 2, group: 'output' },
  { kind: 'number', field: 'outlineOffsetMM', label: 'Outline offset · grow / shrink', unit: 'mm', min: -15, max: 15, step: 1, group: 'contour' },
  { kind: 'number', field: 'contourFlattenRefMM', label: 'Contour flatten reference', unit: 'mm', min: 50, max: 1000, step: 10, group: 'contour' },
  { kind: 'number', field: 'contourMaxVertices', label: 'Outline resolution · max vertices', unit: '', min: 100, max: 4000, step: 50, group: 'contour' },
  { kind: 'number', field: 'centreSampleMaxVertices', label: 'Centre sampling · max vertices', unit: '', min: 100, max: 4000, step: 50, group: 'centre' },
  { kind: 'number', field: 'centreMeshQuantumMM', label: 'Centre mesh quantum', unit: 'mm', min: 0.001, max: 1, step: 0.001, group: 'centre' },
  { kind: 'number', field: 'centreRefineStepMM', label: 'Centre island refine step', unit: 'mm', min: 0.1, max: 4, step: 0.1, group: 'centre' },
  { kind: 'number', field: 'seatQuantumMM', label: 'Seat kernel quantum', unit: 'mm', min: 0.001, max: 0.1, step: 0.001, group: 'grid' },
  { kind: 'number', field: 'seatGuardMM', label: 'Seat exact-test band', unit: 'mm', min: 0.01, max: 1, step: 0.01, group: 'grid' },
  { kind: 'number', field: 'parityLineQuantumMM', label: 'Parity line quantum', unit: 'mm', min: 0.001, max: 1, step: 0.001, group: 'centre' },
  { kind: 'number', field: 'maxPopulationStep', label: 'Layout populations · max lattice step', unit: '', min: 1, max: 4, step: 1, group: 'search' },
])

export class SolverConfigError extends Error {}

/** The ONE ingress validator. Refuses missing, non-finite, out-of-range, unknown-option and
 *  overlapping-band configurations. Nothing downstream repairs a configuration. */
export function validateSolverConfig(value: unknown): SolverConfig {
  if (!value || typeof value !== 'object') throw new SolverConfigError('configuration must be an object')
  const cfg = value as Record<string, unknown>
  for (const control of SOLVER_CONTROLS) {
    const got = cfg[control.field]
    if (control.kind === 'number') {
      if (typeof got !== 'number' || !Number.isFinite(got)) throw new SolverConfigError(`${control.field}: number required`)
      if (got < control.min || got > control.max) throw new SolverConfigError(`${control.field}: ${got} outside ${control.min}..${control.max}`)
    } else if (control.kind === 'toggle') {
      if (typeof got !== 'boolean') throw new SolverConfigError(`${control.field}: boolean required`)
    } else if (control.kind === 'options') {
      if (!control.options.some((option) => option.value === got)) throw new SolverConfigError(`${control.field}: unknown option ${String(got)}`)
    } else {
      const bands = got as unknown
      if (!Array.isArray(bands) || !bands.length) throw new SolverConfigError('bands: at least one band required')
      let previousMax = -Infinity
      for (const band of bands as Band[]) {
        if (!band || typeof band.minMM !== 'number' || typeof band.maxMM !== 'number') throw new SolverConfigError('bands: min/max required')
        if (band.maxMM < band.minMM) throw new SolverConfigError(`band ${band.id}: max below min`)
        if (band.minMM <= previousMax) throw new SolverConfigError(`band ${band.id}: overlaps the band below`)
        previousMax = band.maxMM
      }
    }
  }
  const config = cfg as unknown as SolverConfig
  if (config.freeSizeMaxMM < config.freeSizeMinMM) throw new SolverConfigError('free size: maximum below minimum')
  if (config.magnetDiaLargeMM < config.magnetDiaSmallMM) throw new SolverConfigError('magnet bodies: large below small')
  return config
}

// ─────────────────────────────────────────────────────────────────────────────
// v3.5.4 THREE-LAW RESULT MODEL. A layout keeps its OWN size and evidence; a magnet count groups
// layouts, it never identifies them (Dan: "every lawful variation is returned, never the first fit").

export interface LawLayout {
  /** Stable identity at one size: the physical held set on the whole-mm grid. */
  readonly heldKey: string
  /** Scale-free identity: the same arrangement grown is the SAME layout, published once. */
  readonly shapeKey: string
  readonly family: string
  readonly populationStep: number
  readonly sizeMM: number
  readonly phaseMM: Pt
  readonly anchors: Anchor[]
  readonly seated: Pt[]
  readonly lattice: Pt[]
  readonly magnetCount: number
  /** Centre evidence: the region's balance point against the governed anchor, on the ruler. */
  readonly centreMissMM: readonly [number, number]
  readonly parityTrue: boolean
  /** Fit evidence: containment of the ruled region and its four outer overhangs. */
  readonly contained: boolean
  readonly overhangsMM: readonly [number, number, number, number]
  readonly regionMM: BBox
}

/** One magnet count inside one band: every distinct lawful layout, with one marked. */
export interface CountTier {
  readonly band: BandId
  readonly magnetCount: number
  readonly sizeMM: number
  readonly layouts: readonly LawLayout[]
  readonly recommendedLayoutIndex: number
}


/** One band's ladder of count tiers, or the typed reason the band published nothing. */
export type RefusalCode = 'NO_CENTRE' | 'NO_SEATED_POPULATION' | 'NO_LAWFUL_LAYOUT_IN_BAND'
export interface BandLadder { band: BandId; rungs: CountTier[]; refusal: null | { code: RefusalCode } }
/** Every size solved once and stored; tier/layout selection renders from here without a solve. */
export interface BandSolveResult { bands: BandLadder[]; gridsBySize: ReadonlyMap<number, GridResult> }
