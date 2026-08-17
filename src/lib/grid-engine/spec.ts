// grid-engine/spec.ts — SUB 2, THE LOGIC / SPEC SYSTEM.
//
// Dan, 2026-08-10: "Sub 2 — the LOGIC / SPEC system. Every value math input that controls and feeds
// the engine — spacing, padding, ceiling, the lattice, the magnet bodies. It holds no maths of its
// own. It is the feed, not the calculator."
//
// So: VALUES ONLY. No arithmetic anywhere in this file, not even on its own values.
//
// THE GUARD — Dan, 2026-08-10: "these must be admin sealed values touched once… make it lockable in
// code as well so they are never under risk of being changed accidentally - we need the guard".
//
// THREE levels of write, and the code level always wins:
//   1. SEALED IN CODE — cannot be written at runtime by any route. Changing it means editing this
//      file and releasing it. Law 8.1's model: precompute → calibrate → LOCK → serve.
//   2. RELEASED OPTIONS ONLY — not freehand, but selectable between released values. `selectPitch`
//      is that writer and it is the only one. A typed write is refused.
//   3. OPEN — writable through applyGridValue, inside its limits, once deliberately unlocked.
//
// applyGridValue and selectPitch are the ONLY writers. Neither throws and neither silently accepts:
// each returns the unchanged spec plus a reason. A refused write is visible, not swallowed.

/** The lattice, the padding, the ceiling and the field size — the released law inputs. */
export interface GridSpec {
  /**
   * THE lattice. One only, 48mm centre to centre (law 1.1). Every magnet the system can ever place
   * sits on it. Sealed — it is not a calibration, it is the system.
   */
  basePitchMM: number
  /**
   * How densely that one lattice is POPULATED, in millimetres. Law 1.2: "96 is the same lattice,
   * populated more sparsely. It is not a second grid." So 96 takes every second base point — it
   * never lays a different lattice. Must be a whole multiple of basePitchMM.
   */
  pitchMM: number
  /** The safe radius each magnet owns, measured FROM ITS CENTRE (law 2.1). */
  paddingMM: number
  /** Generator stop. Nothing publishes above it (law 3.11). */
  maxSizeMM: number
  /**
   * How many rows and columns the field carries. Dan, 2026-08-10: "this must be part of the grid law
   * — number of rows and columns", after settling on nine. A law input, not a canvas preference.
   */
  positionsPerAxis: number
}

/** The magnet bodies. Diameters only — which magnet goes where is the engine's call (law 5.7). */
interface MagnetSpec {
  smallMM: number
  largeMM: number
}

/**
 * Where the lattice sits against the shape: 'point' puts a magnet on the shape's centre, 'gap' puts
 * the centre between four. A released value, never something a view decides — it was briefly derived
 * from the zoom stop, which made the lattice move when you zoomed.
 *
 * It is also not a place to encode a preferred LAYOUT. A run of four can only centre in the gap, but
 * that is an answer about one layout; making it the default silently re-registers every field.
 */
export type Registration = 'gap' | 'point'

export interface GridSystemSpec {
  grid: GridSpec
  magnet: MagnetSpec
  registration: Registration
}

export type GridKey = keyof GridSpec

/**
 * SEALED IN CODE. Cannot be changed at runtime by any route. `basePitchMM` is the lattice itself —
 * not a calibration, the system.
 */
const SEALED_IN_CODE: ReadonlySet<GridKey> = new Set<GridKey>(['basePitchMM'])

/**
 * RELEASED OPTIONS ONLY. Law 8.6 names the pitch as rigid canon: the admin selects between the
 * launch pitches, and the value is never typed in freehand. `selectPitch` is the writer.
 */
const OPTIONS_ONLY: ReadonlySet<GridKey> = new Set<GridKey>(['pitchMM'])

export function isSealedInCode(key: GridKey): boolean {
  return SEALED_IN_CODE.has(key)
}

export function isOptionsOnly(key: GridKey): boolean {
  return OPTIONS_ONLY.has(key)
}

/** Bounds a value must satisfy to be accepted. Outside them the write is refused, not clamped. */
const LIMITS: Record<GridKey, { min: number; max: number }> = {
  basePitchMM: { min: 48, max: 48 },
  pitchMM: { min: 48, max: 96 },
  paddingMM: { min: 1, max: 60 },
  maxSizeMM: { min: 20, max: 1000 },
  // a lower bound of one is a real field — a single magnet. The upper bound is what the admin panel
  // can show without becoming unreadable; it is a surface bound, and no law names a maximum.
  positionsPerAxis: { min: 1, max: 99 },
}

export type WriteRefusal = 'sealed-in-code' | 'options-only' | 'not-a-number' | 'not-a-count' | 'out-of-range'

interface WriteResult {
  spec: GridSystemSpec
  /** Absent when the write was accepted. */
  refused?: WriteRefusal
}

/**
 * THE ONE GUARD. Every write to a law value passes through this function — there is no second path.
 *
 * `via` says how the write arrived, and it only ever RELAXES the options-only level for the caller
 * that level exists for. It cannot reach a sealed key by any route. This is deliberately one writer
 * with a level, not two writers: two doors that both happen to validate is the shape that let a
 * sealed value be written around its own seal.
 */
function writeValue(
  spec: GridSystemSpec,
  key: GridKey,
  value: number,
  via: 'freehand' | 'released-option',
): WriteResult {
  if (isSealedInCode(key)) return { spec, refused: 'sealed-in-code' }
  if (isOptionsOnly(key) && via !== 'released-option') return { spec, refused: 'options-only' }
  if (!Number.isFinite(value)) return { spec, refused: 'not-a-number' }
  const { min, max } = LIMITS[key]
  if (value < min || value > max) return { spec, refused: 'out-of-range' }
  return { spec: { ...spec, grid: { ...spec.grid, [key]: value } } }
}

/** A typed-in value. Refused for anything sealed or options-only. */
export function applyGridValue(spec: GridSystemSpec, key: GridKey, value: number): WriteResult {
  return writeValue(spec, key, value, 'freehand')
}

/**
 * Selecting a released pitch is a CHOICE between released values, never a freehand write. It is not
 * a second guard — it presents its credential to the same one.
 */
export function selectPitch(spec: GridSystemSpec, pitchMM: number): WriteResult {
  if (!LAUNCH_PITCHES_MM.includes(pitchMM)) return { spec, refused: 'out-of-range' }
  return writeValue(spec, 'pitchMM', pitchMM, 'released-option')
}

export function limitsFor(key: GridKey): { min: number; max: number } {
  return LIMITS[key]
}

/** The registrations that exist. There is no third, and neither is ever typed in freehand. */
const RELEASED_REGISTRATIONS: readonly Registration[] = Object.freeze(['gap', 'point'])

/**
 * THE GUARDED ROUTE FOR REGISTRATION — the one this value never had.
 *
 * `registration` is not a GridKey, so it was absent from LIMITS, SEALED_IN_CODE and OPTIONS_ONLY:
 * the guard could not refuse a bad write because there was no door to refuse it at. The shell wrote
 * it with a bare setState, and the separation test could not see that either — it watches for writes
 * into `grid`, and this is a sibling key.
 *
 * It is a released OPTION, like the pitch: chosen between values the system has, never typed. What
 * it should BE for a given shape is the engine's answer (law 6.5); this only guards how it is set.
 */
export function selectRegistration(spec: GridSystemSpec, registration: string): WriteResult {
  // WIDE parameter, exactly like selectPitch takes `number` rather than a union of the two launch
  // pitches. Typed as the union instead, the refusal below could only ever fire on a cast — the
  // guard would be a compile-time promise wearing a runtime guard's clothes, and the acceptance
  // criterion "invalid writes fail explicitly" would be satisfied vacuously.
  if (!RELEASED_REGISTRATIONS.includes(registration as Registration)) {
    return { spec, refused: 'options-only' }
  }
  return { spec: { ...spec, registration: registration as Registration } }
}

/**
 * The current released values, frozen. Mutating them in place throws in strict mode rather than
 * corrupting the baseline every derived result is measured against.
 *
 * There is no tolerance here, and the reason is provenance rather than a rule. Dan's actual words,
 * 2026-08-10, were four: "tolerance 0.05mm - who invented this?" — a QUESTION. Nobody could answer
 * it: the 0.05 was a literal read out of `geometry-truth.ts` and written into the law book as a
 * measured fact, reaching exactly one consumer, the panel row that displayed it. A number with no
 * author is not law, so it went.
 *
 * The sentence that used to stand here — "tolerance is not required, it affects nothing, we have no
 * tolerance, everything must sit on the exact sizing", attributed to Dan — was NEVER SAID BY HIM. It
 * exists in no transcript. It was his question rewritten as his ruling, and it was struck from the
 * law book on 2026-08-11 along with two other fabrications. Quoting him is a claim about the record;
 * make it only from the record.
 */
export const RELEASED: GridSystemSpec = Object.freeze({
  grid: Object.freeze({
    basePitchMM: 48,
    pitchMM: 48,
    paddingMM: 12,
    maxSizeMM: 310,
    positionsPerAxis: 9,
  }),
  magnet: Object.freeze({
    smallMM: 6,
    largeMM: 8,
  }),
  // The released default is the lattice as it stands: a magnet on the shape's centre, 9x9 at fit.
  // It was briefly shipped as 'gap' — that made a four-point layout the whole system's standing
  // state off the back of a request about ONE layout, which was never anyone's call to make here.
  // Which registration a shape ships with is the ENGINE's answer for that shape, not a default.
  registration: 'point',
}) as GridSystemSpec

/** The launch pitches. 24 and 72 do not exist anywhere in the system (law 1.3). */
export const LAUNCH_PITCHES_MM: readonly number[] = Object.freeze([48, 96])

// ─────────────────────────────────────────────────────────────────────────────
// CALIBRATION — the values fed to the lifted v1 engine. Values only, same law as above.
//
// Dan, 2026-08-14: "the entire v1 is already correct — 10mm or 12/24mm semantics are just that …
// the semantics are calibration." The engine in compute/ is the proven v1 code, BYTE-VERBATIM.
// What is writable here is exactly what that engine's own API accepts as input — padding, frame,
// size ceilings, margins, density, pattern, magnet plan, centering. The engine's internal physics
// constants (hold reach 48, focal thresholds 100/200, the determinism quantum) are SEALED IN CODE
// at level 1: they live in compute/grid-core.ts as released constants, and changing one is a code
// edit and a release, never a runtime write. This block states the seams; it does not fork them.

/**
 * PB §4's axis-class table. This is NOT the offered-band list: a band says which product is sold,
 * an axis class says how an edge is classified, and they are only numerically alike. Classifying
 * from the band list made classification depend on which bands a caller happened to enable.
 */
export interface AxisClassSpec {
  axisClass: number
  minMM: number
  maxMM: number
}

export interface BandSpec {
  /** Product label. Bands group sizes; which bands are offered is product law. */
  band: number
  /** Smallest and largest manufactured longest-side this band may publish, millimetres. */
  minSizeMM: number
  maxSizeMM: number
  /** Whether the product currently offers this band. Hidden bands still compute. */
  released: boolean
}

/**
 * The engine-input calibration — every field maps 1:1 onto a parameter the verbatim v1 engine
 * already accepts (GridPlanOptions / SizeLaw). Nothing here invents a knob the engine lacks.
 */
export interface CalibrationSpec {
  /** GridPlanOptions.plan — magnet sizing plan; 'auto' is the size-driven focal law. */
  plan: 'auto' | 'all6' | 'all8' | 'corners8'
  /** GridPlanOptions.center — where the rigid grid anchors. */
  center: 'centroid' | 'bbox'
  /** Flap law (Dan 2026-08-11): preferred per-side overhang bound, millimetres. */
  flapTightMM: number
  /** Flap law: the outer acceptance bound — a side beyond this refuses the placement.
   *  28, measured off Dan's own approved duck frames (2026-08-14): the lawful band-3 seat
   *  carries a 26-28mm crown above the held top row; the side placements he refused (30+)
   *  stay refused. */
  flapMaxMM: number
  /** Flap law's limb exception (Dan: "unless it is trivial limb especially at the bottom"):
   *  any side may overhang up to this before the placement is refused outright — hanging legs,
   *  bodies and arms are lawful; the tiers still rank them below tight wraps. */
  flapLimbMM: number
  /** The judge's template-placement sweep step, millimetres, within one lattice cell. */
  sweepStepMM: number
  /** ENFORCED centering (Dan 2026-08-14): the assembly's horizontal centre may sit at most this
   *  far from the shape's — beyond it the placement is refused, never merely ranked lower. */
  centerToleranceMM: number
  /** THE SYMMETRY LAW (Dan's balance-and-symmetry brief, calibrated on the bat yardstick):
   *  a shape whose left and right halves mirror (every scanline's centre within this fraction
   *  of its width from the shape's axis) demands a mirror-symmetric layout — asymmetric
   *  arrangements rank below symmetric ones there. Asymmetric shapes (the duck, the tilted
   *  pill) are untouched. */
  symmetryTolFrac: number
  /** THE STRUCTURE LAW thresholds (Dan's ruled canon: "arrangement follows the shape's
   *  extremes" — triangle-shape takes a triangle, waisted shape takes corners spanning the
   *  waist, standing mass takes the narrow column, diagonal takes diagonal). */
  structureWaistRatio: number
  structureTaperCorr: number
  structureDiagSlope: number
  /** Uniform shapes split by MASS WIDTH (Dan: the bot is a "narrow standing mass" — column hold;
   *  the poke is a full blob — corner square): median scanline width over the widest. */
  structureMassRatio: number
  /** The judge's size step inside a band, millimetres (sizes stay even). */
  sizeStepMM: number
  /** THE STRIP LAW's link bound: the longest anchor-to-anchor link that still bonds material —
   *  the released vocabulary's own maximum, the 48x96 mixed-step diagonal sqrt(48^2+96^2) = 107.3 — the longest link any released arrangement carries (Dan's ruled canon triangle)
   *  (Dan's ruled canon triangle carries exactly this link; the 135.8 corner-fling stays out).
   *  Every arrangement must be ONE component under links within this bound. */
  stripLinkMM: number
  /** The corners class demands real spread on both axes — the padded block must span at least
   *  this per axis (one 48 step + padding). Was a literal in the judge (QA adjudication). */
  cornersMinExtentMM: number
  /** Measurement resolutions the judge requests from compute (QA: decision inputs belong in
   *  the spec, not as literals in the judge). */
  structureScanlines: number
  massFieldSamples: number
  /** ENGINEERING budgets the certified descriptors require from their caller. They bound search
   *  cost only: exceeding one returns an honest indeterminate, never a guessed value, so no
   *  product answer depends on the number chosen. Same seam as the resolutions above. */
  peelToleranceMM3: number
  peelMaxEvaluations: number
  distributionMaxCells: number
  /** PB §4 axis classes. Independent of which bands are offered. */
  axisClasses: readonly AxisClassSpec[]
  /** The size bands. Ranges are product law; solved sizes inside them are engine output. */
  bands: readonly BandSpec[]
  /** The released layout templates (Dan's canon arrangements), in base-lattice steps. The judge
   *  proposes each at swept positions; the ENGINE validates and measures — never re-solves. */
  templates: ReadonlyArray<LayoutTemplate>
  /** Which frames each class×band cell may hypothesise. Traced data — see PatternPolicy. */
  patternPolicy: PatternPolicy
  /** How nodes are classified illegal/marginal/strong. Authored ENGINEERING — see the policy. */
  nodeClassification: NodeClassificationPolicy
  /** P4's released switch. Logic applies it; Compute only measures the reach. */
  unsupportedExtent: UnsupportedExtentPolicy
}

/**
 * THE ACTIVE UNSUPPORTED-EXTENT LIMIT — Logic Spec P4's per-side 12-or-24mm switch.
 *
 * The Logic Spec releases exactly two positions for this switch and no others; a freehand number is
 * not a position of it. The released default is the tighter one. Compute MEASURES the reach and
 * deliberately applies nothing; this value is what Logic applies it against, and the trivial-limb
 * exemption is REPORTED, never silent — a silently exempted limb is the violation T0b records.
 */
export interface UnsupportedExtentPolicy {
  version: string
  because: string
  /** Exactly one of the released positions. Never a tuned number. */
  activeLimitMM: 12 | 24
  releasedOptionsMM: readonly [12, 24]
}

export interface LayoutTemplate {
  name: string
  /** Magnet positions in whole base-lattice steps, [across, down]. */
  steps: ReadonlyArray<readonly [number, number]>
}

/**
 * WHICH NODE FRAMES A CLASS×BAND CELL MAY HYPOTHESISE — traced to the designated brief, cell by
 * cell. Not derived from span: capacity is a NECESSARY condition and PB §21.4 leaves the final
 * band-specific permission matrix deferred, so a cell the brief does not tabulate permits NOTHING
 * and says so. Nothing here is attributed to a ruling beyond the clause each row cites.
 *
 * The keys are the two independently classified axes (PB §4), whose pairing is the shape's
 * rectangle class exactly as the brief uses it — equal classes are square-like, a taller class is
 * the tall rectangle, a wider class its mirror. Frames are written `across x down` in magnet lines.
 */
export interface FramePermissionCell {
  /** The overall band this cell governs — the key is class x class x BAND, never class alone. */
  band: number
  axisClassX: number
  axisClassY: number
  /** Node frames this cell may hypothesise, `across x down`. Empty when the cell is deferred. */
  frames: readonly string[]
  /** The clause this row rests on, or why it is deferred. */
  source: string
  /**
   * `traced` — the brief authors this permission directly.
   * `engineering-derived` — versioned calibration read off the brief's class standards, which are
   *   frame HYPOTHESES ("capacity, never compulsory"); PB §21.4 still defers the final matrix, so
   *   this is never presented as a ruling.
   * `deferred` — unresolved. Permits nothing.
   */
  status: 'traced' | 'engineering-derived' | 'deferred'
}

export interface PatternPolicy {
  /** Stable identity of this permission set — part of every selector result's identity. */
  version: string
  /** What this table is and is not. */
  because: string
  cells: readonly FramePermissionCell[]
}

/**
 * NODE CLASSIFICATION INPUTS — authored ENGINEERING, versioned.
 *
 * PB §8 names strong and marginal regions but releases no threshold, so the separation is stated
 * here rather than invented at call time or attributed to a ruling. A node is STRONG when it
 * survives erosion at the deep level as well as the safe level; MARGINAL when it exists only at the
 * safe level; ILLEGAL when the exact predicate refuses it. The deep level is the authored choice.
 */
export interface NodeClassificationPolicy {
  version: string
  because: string
  /** Clearance levels handed to the component hierarchy, strictly increasing. */
  clearanceLevelsMM: readonly number[]
  /** Which level index (into the above) a node must survive to count as strong. */
  strongLevelIndex: number
}

export const RELEASED_CALIBRATION: CalibrationSpec = Object.freeze({
  plan: 'auto',
  center: 'centroid',
  flapTightMM: 12,
  flapMaxMM: 28,
  flapLimbMM: 40,
  sweepStepMM: 2,
  centerToleranceMM: 12,
  symmetryTolFrac: 0.11,
  structureWaistRatio: 0.6,
  structureTaperCorr: 0.7,
  structureDiagSlope: 0.35,
  structureMassRatio: 0.85,
  sizeStepMM: 2,
  stripLinkMM: 108,
  cornersMinExtentMM: 72,
  structureScanlines: 24,
  massFieldSamples: 40,
  peelToleranceMM3: 1,
  peelMaxEvaluations: 2000,
  distributionMaxCells: 64,
  axisClasses: Object.freeze([
    Object.freeze({ axisClass: 1, minMM: 24, maxMM: 72 }),
    Object.freeze({ axisClass: 2, minMM: 72, maxMM: 120 }),
    Object.freeze({ axisClass: 3, minMM: 120, maxMM: 168 }),
    Object.freeze({ axisClass: 4, minMM: 168, maxMM: 216 }),
    Object.freeze({ axisClass: 5, minMM: 216, maxMM: 264 }),
  ]) as readonly AxisClassSpec[],
  bands: Object.freeze([
    Object.freeze({ band: 1, minSizeMM: 24, maxSizeMM: 72, released: false }),
    Object.freeze({ band: 2, minSizeMM: 72, maxSizeMM: 120, released: true }),
    Object.freeze({ band: 3, minSizeMM: 120, maxSizeMM: 168, released: true }),
    Object.freeze({ band: 4, minSizeMM: 168, maxSizeMM: 216, released: false }),
    // B5 computes like every hidden band: PB §4 tabulates the 216-264 axis class, and PB §12
    // requires every candidate size to be evaluated independently. Whether it is SOLD is
    // presentation policy outside the engine, which is what `released` carries.
    Object.freeze({ band: 5, minSizeMM: 216, maxSizeMM: 264, released: false }),
  ]) as readonly BandSpec[],
  // Dan's canon arrangements (2026-08-13 walkthrough): pair either way; the 48 square; the
  // 48-wide x 96-tall rectangle and its transpose; the 96 square; the six-point 48x96 blocks.
  templates: Object.freeze([
    Object.freeze({ name: 'single', steps: Object.freeze([[0, 0]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'pair-v', steps: Object.freeze([[0, 0], [0, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'pair-h', steps: Object.freeze([[0, 0], [1, 0]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'pair-v-96', steps: Object.freeze([[0, 0], [0, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'pair-h-96', steps: Object.freeze([[0, 0], [2, 0]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'pair-diag', steps: Object.freeze([[0, 0], [1, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'pair-antidiag', steps: Object.freeze([[0, 1], [1, 0]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'run-diag-3', steps: Object.freeze([[0, 0], [1, 1], [2, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'square-48', steps: Object.freeze([[0, 0], [1, 0], [0, 1], [1, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'rect-48x96', steps: Object.freeze([[0, 0], [1, 0], [0, 2], [1, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'rect-96x48', steps: Object.freeze([[0, 0], [2, 0], [0, 1], [2, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'square-96', steps: Object.freeze([[0, 0], [2, 0], [0, 2], [2, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'tri-48-nw', steps: Object.freeze([[0, 0], [1, 0], [0, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'tri-48-ne', steps: Object.freeze([[0, 0], [1, 0], [1, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'tri-48-sw', steps: Object.freeze([[0, 0], [0, 1], [1, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'tri-48-se', steps: Object.freeze([[1, 0], [0, 1], [1, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'tri-96-down', steps: Object.freeze([[0, 0], [2, 0], [1, 2]].map((s) => Object.freeze(s))) }),
    // Dan's canon "top support + distributed lower row" grown to the 96 step (2026-08-15 22:53:
    // band 4 steps UP to the fuller grid): one apex over a base row of three, 96mm below.
    Object.freeze({ name: 'tee-96', steps: Object.freeze([[1, 0], [0, 2], [1, 2], [2, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'tee-96-down', steps: Object.freeze([[0, 0], [1, 0], [2, 0], [1, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'tri-96-up', steps: Object.freeze([[1, 0], [0, 2], [2, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'tri-96x48-down', steps: Object.freeze([[0, 0], [2, 0], [1, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'tri-96x48-up', steps: Object.freeze([[1, 0], [0, 1], [2, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'run-h-3', steps: Object.freeze([[0, 0], [1, 0], [2, 0]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'run-v-3', steps: Object.freeze([[0, 0], [0, 1], [0, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'run-antidiag-3', steps: Object.freeze([[2, 0], [1, 1], [0, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'T-down', steps: Object.freeze([[0, 0], [1, 0], [2, 0], [1, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'T-up', steps: Object.freeze([[1, 0], [0, 1], [1, 1], [2, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'T-right', steps: Object.freeze([[0, 0], [0, 1], [0, 2], [1, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'T-left', steps: Object.freeze([[1, 0], [1, 1], [1, 2], [0, 1]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'L-se', steps: Object.freeze([[0, 0], [0, 1], [0, 2], [1, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'L-sw', steps: Object.freeze([[1, 0], [1, 1], [1, 2], [0, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'L-ne', steps: Object.freeze([[0, 0], [1, 0], [0, 1], [0, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'L-nw', steps: Object.freeze([[0, 0], [1, 0], [1, 1], [1, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'X-5', steps: Object.freeze([[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'six-48x96', steps: Object.freeze([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]].map((s) => Object.freeze(s))) }),
    Object.freeze({ name: 'six-96x48', steps: Object.freeze([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]].map((s) => Object.freeze(s))) }),
  ] as unknown as LayoutTemplate[]) as ReadonlyArray<LayoutTemplate>,
  patternPolicy: Object.freeze({
    version: 'frame-permission-v1',
    because:
      'Keyed by axis class x axis class x BAND. Every populated cell is ENGINEERING-DERIVED ' +
      'calibration read off Logic Spec §5.1, whose class standards are frame HYPOTHESES — the brief ' +
      'says capacity, never compulsory — and PB §21.4 leaves the final band-specific matrix ' +
      'deferred, so no row here is a ruling. A cell the brief does not cover is deferred and permits ' +
      'nothing; capacity alone permits nothing. A product ruling replaces cells and version.',
    cells: Object.freeze([
      // Logic Spec §5.1, square standard — the calibration control every other class walks from.
      Object.freeze({ band: 1, axisClassX: 1, axisClassY: 1, frames: Object.freeze(['1x1']), source: 'logic-spec §5.1 SQUARE B1 single', status: 'engineering-derived' }),
      Object.freeze({ band: 2, axisClassX: 2, axisClassY: 2, frames: Object.freeze(['2x2']), source: 'logic-spec §5.1 SQUARE B2 2x2', status: 'engineering-derived' }),
      Object.freeze({ band: 3, axisClassX: 3, axisClassY: 3, frames: Object.freeze(['3x3']), source: 'logic-spec §5.1 SQUARE B3 3x3', status: 'engineering-derived' }),
      Object.freeze({ band: 4, axisClassX: 4, axisClassY: 4, frames: Object.freeze(['4x4']), source: 'logic-spec §5.1 SQUARE B4 4x4', status: 'engineering-derived' }),
      Object.freeze({ band: 5, axisClassX: 5, axisClassY: 5, frames: Object.freeze(['5x5']), source: 'logic-spec §5.1 SQUARE B5 5x5', status: 'engineering-derived' }),
      // §5.1 tall rectangle — the square standard applied per axis, layouts following the long axis.
      Object.freeze({ band: 2, axisClassX: 1, axisClassY: 2, frames: Object.freeze(['1x2']), source: 'logic-spec §5.1 TALL B2 1x2 column', status: 'engineering-derived' }),
      Object.freeze({ band: 3, axisClassX: 1, axisClassY: 3, frames: Object.freeze(['1x3']), source: 'logic-spec §5.1 TALL B3 1x3', status: 'engineering-derived' }),
      Object.freeze({ band: 3, axisClassX: 2, axisClassY: 3, frames: Object.freeze(['2x3']), source: 'logic-spec §5.1 TALL B3 2x3', status: 'engineering-derived' }),
      Object.freeze({ band: 4, axisClassX: 2, axisClassY: 4, frames: Object.freeze(['2x4']), source: 'logic-spec §5.1 TALL B4 2x4', status: 'engineering-derived' }),
      Object.freeze({ band: 4, axisClassX: 3, axisClassY: 4, frames: Object.freeze(['3x4']), source: 'logic-spec §5.1 TALL B4 3x4', status: 'engineering-derived' }),
      Object.freeze({ band: 5, axisClassX: 3, axisClassY: 5, frames: Object.freeze(['3x5']), source: 'logic-spec §5.1 TALL B5 3x5', status: 'engineering-derived' }),
      Object.freeze({ band: 5, axisClassX: 4, axisClassY: 5, frames: Object.freeze(['4x5']), source: 'logic-spec §5.1 TALL B5 4x5', status: 'engineering-derived' }),
      // §5.1 wide rectangle — "mirror of tall".
      Object.freeze({ band: 2, axisClassX: 2, axisClassY: 1, frames: Object.freeze(['2x1']), source: 'logic-spec §5.1 WIDE B2 2x1 row', status: 'engineering-derived' }),
      Object.freeze({ band: 3, axisClassX: 3, axisClassY: 1, frames: Object.freeze(['3x1']), source: 'logic-spec §5.1 WIDE B3 3x1', status: 'engineering-derived' }),
      Object.freeze({ band: 3, axisClassX: 3, axisClassY: 2, frames: Object.freeze(['3x2']), source: 'logic-spec §5.1 WIDE B3 3x2', status: 'engineering-derived' }),
      Object.freeze({ band: 4, axisClassX: 4, axisClassY: 2, frames: Object.freeze(['4x2']), source: 'logic-spec §5.1 WIDE B4 4x2', status: 'engineering-derived' }),
      Object.freeze({ band: 4, axisClassX: 4, axisClassY: 3, frames: Object.freeze(['4x3']), source: 'logic-spec §5.1 WIDE B4 4x3', status: 'engineering-derived' }),
      Object.freeze({ band: 5, axisClassX: 5, axisClassY: 3, frames: Object.freeze(['5x3']), source: 'logic-spec §5.1 WIDE B5 5x3', status: 'engineering-derived' }),
      Object.freeze({ band: 5, axisClassX: 5, axisClassY: 4, frames: Object.freeze(['5x4']), source: 'logic-spec §5.1 WIDE B5 5x4', status: 'engineering-derived' }),
      // Cells the brief does not tabulate. They permit NOTHING until a ruling fills them in.
      Object.freeze({ band: 4, axisClassX: 1, axisClassY: 4, frames: Object.freeze([]), source: 'not tabulated in logic-spec §5.1; PB §21.4 defers it', status: 'deferred' }),
      Object.freeze({ band: 5, axisClassX: 1, axisClassY: 5, frames: Object.freeze([]), source: 'not tabulated in logic-spec §5.1; PB §21.4 defers it', status: 'deferred' }),
      Object.freeze({ band: 4, axisClassX: 4, axisClassY: 1, frames: Object.freeze([]), source: 'not tabulated in logic-spec §5.1; PB §21.4 defers it', status: 'deferred' }),
      Object.freeze({ band: 5, axisClassX: 5, axisClassY: 1, frames: Object.freeze([]), source: 'not tabulated in logic-spec §5.1; PB §21.4 defers it', status: 'deferred' }),
      Object.freeze({ band: 5, axisClassX: 2, axisClassY: 5, frames: Object.freeze([]), source: 'not tabulated in logic-spec §5.1; PB §21.4 defers it', status: 'deferred' }),
      Object.freeze({ band: 5, axisClassX: 5, axisClassY: 2, frames: Object.freeze([]), source: 'not tabulated in logic-spec §5.1; PB §21.4 defers it', status: 'deferred' }),
    ]) as readonly FramePermissionCell[],
  }) as PatternPolicy,
  nodeClassification: Object.freeze({
    version: 'node-classification-v1',
    because:
      'PB §8 names strong and marginal regions but releases no threshold. AUTHORED ENGINEERING: a ' +
      'node is strong when its region survives erosion at twice the released safe radius as well as ' +
      'at the safe radius itself, marginal when it survives only the safe radius, illegal when the ' +
      'exact predicate refuses it. The doubling is the authored choice and is versioned with this ' +
      'policy; no ruling is claimed for it.',
    clearanceLevelsMM: Object.freeze([12, 24]),
    strongLevelIndex: 1,
  }) as NodeClassificationPolicy,
  unsupportedExtent: Object.freeze({
    version: 'unsupported-extent-v1',
    because:
      'Logic Spec P4 releases a per-side unsupported-extent switch with exactly two positions, 12mm ' +
      'and 24mm, bound by T0 rows 6.7 and 6.8. The released default is the tighter position. T0b ' +
      'records a fixed 40mm ceiling and a silent limb exemption as violations, so no other value is ' +
      'a position of this switch and any exemption granted under it must be reported.',
    activeLimitMM: 12,
    releasedOptionsMM: Object.freeze([12, 24]),
  }) as UnsupportedExtentPolicy,
}) as CalibrationSpec

/** The permission cell governing a pair of axis classes, or null when none is tabulated. */
export function frameCellFor(
  calibration: CalibrationSpec,
  band: number,
  axisClassX: number,
  axisClassY: number,
): FramePermissionCell | null {
  return (
    calibration.patternPolicy.cells.find(
      (cell) =>
        cell.band === band && cell.axisClassX === axisClassX && cell.axisClassY === axisClassY,
    ) ?? null
  )
}

export type CalibrationNumberKey =
  | 'flapTightMM'
  | 'flapMaxMM'
  | 'flapLimbMM'
  | 'sweepStepMM'
  | 'centerToleranceMM'
  | 'sizeStepMM'
  | 'cornersMinExtentMM'
  | 'structureScanlines'
  | 'massFieldSamples'
  | 'symmetryTolFrac'
  | 'structureWaistRatio'
  | 'structureTaperCorr'
  | 'structureDiagSlope'
  | 'structureMassRatio'
  | 'stripLinkMM'

/** Bounds a calibration write must satisfy. Outside them the write is refused, not clamped. */
const CALIBRATION_LIMITS: Record<CalibrationNumberKey, { min: number; max: number }> = {
  flapTightMM: { min: 0, max: 60 },
  flapMaxMM: { min: 0, max: 80 },
  flapLimbMM: { min: 0, max: 120 },
  sweepStepMM: { min: 1, max: 48 },
  centerToleranceMM: { min: 0, max: 60 },
  sizeStepMM: { min: 2, max: 48 },
  cornersMinExtentMM: { min: 24, max: 216 },
  structureScanlines: { min: 8, max: 96 },
  massFieldSamples: { min: 8, max: 128 },
  symmetryTolFrac: { min: 0, max: 1 },
  structureWaistRatio: { min: 0, max: 1 },
  structureTaperCorr: { min: 0, max: 1 },
  structureDiagSlope: { min: 0, max: 1 },
  structureMassRatio: { min: 0, max: 1 },
  stripLinkMM: { min: 48, max: 136 },
}

const COUNT_KEYS: ReadonlySet<CalibrationNumberKey> = new Set([
  'structureScanlines',
  'massFieldSamples',
] as const)

const RELEASED_PLANS: readonly CalibrationSpec['plan'][] = Object.freeze([
  'auto',
  'all6',
  'all8',
  'corners8',
])
const RELEASED_CENTERS: readonly CalibrationSpec['center'][] = Object.freeze(['centroid', 'bbox'])

/** The one guarded writer for numeric calibration values — same shape as applyGridValue. */
export function applyCalibrationValue(
  calibration: CalibrationSpec,
  key: CalibrationNumberKey,
  value: number,
): { calibration: CalibrationSpec; refused?: WriteRefusal } {
  if (!Number.isFinite(value)) return { calibration, refused: 'not-a-number' }
  // COUNT-VALUED KEYS (QA base-closure F1): these describe counts of things — a fractional
  // count has no meaning and is refused, never rounded.
  if (COUNT_KEYS.has(key) && !Number.isInteger(value)) return { calibration, refused: 'not-a-count' }
  const { min, max } = CALIBRATION_LIMITS[key]
  if (value < min || value > max) return { calibration, refused: 'out-of-range' }
  return { calibration: { ...calibration, [key]: value } }
}

/** Released-options writers — a choice between values the system has, never typed freehand. */
export function selectCalibrationOption(
  calibration: CalibrationSpec,
  key: 'plan' | 'center',
  value: string,
): { calibration: CalibrationSpec; refused?: WriteRefusal } {
  const released: Record<typeof key, readonly string[]> = {
    plan: RELEASED_PLANS,
    center: RELEASED_CENTERS,
  }
  if (!released[key].includes(value)) return { calibration, refused: 'options-only' }
  return { calibration: { ...calibration, [key]: value } }
}

/**
 * The P4 switch writer. Two released positions, nothing else — not a range, so no min/max writer
 * may reach it and a freehand value is refused rather than clamped into one of them.
 */
export function selectUnsupportedExtentLimit(
  calibration: CalibrationSpec,
  value: number,
): { calibration: CalibrationSpec; refused?: WriteRefusal } {
  if (value !== 12 && value !== 24) return { calibration, refused: 'options-only' }
  return {
    calibration: {
      ...calibration,
      unsupportedExtent: { ...calibration.unsupportedExtent, activeLimitMM: value },
    },
  }
}

export function calibrationLimitsFor(key: CalibrationNumberKey): { min: number; max: number } {
  return CALIBRATION_LIMITS[key]
}
