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

export type WriteRefusal = 'sealed-in-code' | 'options-only' | 'not-a-number' | 'out-of-range'

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

export interface BandSpec {
  /** Product label. Bands group sizes; which bands are offered is product law. */
  band: number
  /** Smallest and largest manufactured longest-side this band may publish, millimetres. */
  minSizeMM: number
  maxSizeMM: number
  /** The magnet count this band aims for (Dan's canon: pair minimum, four optimal, six above). */
  targetMagnets: number
  /** Whether the product currently offers this band. Hidden bands still compute. */
  released: boolean
}

/**
 * The engine-input calibration — every field maps 1:1 onto a parameter the verbatim v1 engine
 * already accepts (GridPlanOptions / SizeLaw). Nothing here invents a knob the engine lacks.
 */
export interface CalibrationSpec {
  /** SizeLaw.frameMM — frame stroke per side. */
  frameMM: number
  /** SizeLaw.maxTestedMM — largest physically tested size; rungs above ship hidden. */
  maxTestedMM: number
  /** GridPlanOptions.maxGrowMM — outward margin band an adaptive plan may add to seek balance. */
  maxGrowMM: number
  /** GridPlanOptions.density — 'standard' (48-first) or 'light' (96-first). */
  density: 'standard' | 'light'
  /** GridPlanOptions.mode — 'auto' or a pinned pattern. */
  mode: 'auto' | 'standard' | 'quincunx' | 'diamond'
  /** GridPlanOptions.plan — magnet sizing plan; 'auto' is the size-driven focal law. */
  plan: 'auto' | 'all6' | 'all8' | 'corners8'
  /** GridPlanOptions.center — where the rigid grid anchors. */
  center: 'centroid' | 'bbox'
  /** Flap law (Dan 2026-08-11): preferred per-side overhang bound, millimetres. */
  flapTightMM: number
  /** Flap law: the outer acceptance bound — a side beyond this refuses the placement. */
  flapMaxMM: number
  /** Flap law's limb exception (Dan: "unless it is trivial limb especially at the bottom"):
   *  any side may overhang up to this before the placement is refused outright — hanging legs,
   *  bodies and arms are lawful; the tiers still rank them below tight wraps. */
  flapLimbMM: number
  /** The judge's template-placement sweep step, millimetres, within one lattice cell. */
  sweepStepMM: number
  /** The judge's size step inside a band, millimetres (sizes stay even). */
  sizeStepMM: number
  /** The size bands. Ranges are product law; solved sizes inside them are engine output. */
  bands: readonly BandSpec[]
  /** The released layout templates (Dan's canon arrangements), in base-lattice steps. The judge
   *  proposes each at swept positions; the ENGINE validates and measures — never re-solves. */
  templates: ReadonlyArray<LayoutTemplate>
}

export interface LayoutTemplate {
  name: string
  /** Magnet positions in whole base-lattice steps, [across, down]. */
  steps: ReadonlyArray<readonly [number, number]>
}

export const RELEASED_CALIBRATION: CalibrationSpec = Object.freeze({
  frameMM: 1,
  maxTestedMM: 214,
  maxGrowMM: 12,
  density: 'light',
  mode: 'auto',
  plan: 'auto',
  center: 'centroid',
  flapTightMM: 12,
  flapMaxMM: 24,
  flapLimbMM: 40,
  sweepStepMM: 8,
  sizeStepMM: 2,
  bands: Object.freeze([
    Object.freeze({ band: 1, minSizeMM: 24, maxSizeMM: 72, targetMagnets: 1, released: false }),
    Object.freeze({ band: 2, minSizeMM: 72, maxSizeMM: 120, targetMagnets: 2, released: true }),
    Object.freeze({ band: 3, minSizeMM: 120, maxSizeMM: 168, targetMagnets: 4, released: true }),
    Object.freeze({ band: 4, minSizeMM: 168, maxSizeMM: 216, targetMagnets: 6, released: false }),
  ]) as readonly BandSpec[],
  // Dan's canon arrangements (2026-08-13 walkthrough): pair either way; the 48 square; the
  // 48-wide x 96-tall rectangle and its transpose; the 96 square; the six-point 48x96 blocks.
  templates: Object.freeze([
    Object.freeze({ name: 'single', steps: [[0, 0]] }),
    Object.freeze({ name: 'pair-v', steps: [[0, 0], [0, 1]] }),
    Object.freeze({ name: 'pair-h', steps: [[0, 0], [1, 0]] }),
    Object.freeze({ name: 'square-48', steps: [[0, 0], [1, 0], [0, 1], [1, 1]] }),
    Object.freeze({ name: 'rect-48x96', steps: [[0, 0], [1, 0], [0, 2], [1, 2]] }),
    Object.freeze({ name: 'rect-96x48', steps: [[0, 0], [2, 0], [0, 1], [2, 1]] }),
    Object.freeze({ name: 'square-96', steps: [[0, 0], [2, 0], [0, 2], [2, 2]] }),
    Object.freeze({ name: 'six-48x96', steps: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] }),
    Object.freeze({ name: 'six-96x48', steps: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] }),
  ] as unknown as LayoutTemplate[]) as ReadonlyArray<LayoutTemplate>,
}) as CalibrationSpec

export type CalibrationNumberKey =
  | 'frameMM'
  | 'maxTestedMM'
  | 'maxGrowMM'
  | 'flapTightMM'
  | 'flapMaxMM'
  | 'flapLimbMM'
  | 'sweepStepMM'
  | 'sizeStepMM'

/** Bounds a calibration write must satisfy. Outside them the write is refused, not clamped. */
const CALIBRATION_LIMITS: Record<CalibrationNumberKey, { min: number; max: number }> = {
  frameMM: { min: 0, max: 10 },
  maxTestedMM: { min: 20, max: 1000 },
  maxGrowMM: { min: 0, max: 80 },
  flapTightMM: { min: 0, max: 60 },
  flapMaxMM: { min: 0, max: 80 },
  flapLimbMM: { min: 0, max: 120 },
  sweepStepMM: { min: 1, max: 48 },
  sizeStepMM: { min: 2, max: 48 },
}

const RELEASED_DENSITIES: readonly CalibrationSpec['density'][] = Object.freeze([
  'standard',
  'light',
])
const RELEASED_MODES: readonly CalibrationSpec['mode'][] = Object.freeze([
  'auto',
  'standard',
  'quincunx',
  'diamond',
])
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
  const { min, max } = CALIBRATION_LIMITS[key]
  if (value < min || value > max) return { calibration, refused: 'out-of-range' }
  return { calibration: { ...calibration, [key]: value } }
}

/** Released-options writers — a choice between values the system has, never typed freehand. */
export function selectCalibrationOption(
  calibration: CalibrationSpec,
  key: 'density' | 'mode' | 'plan' | 'center',
  value: string,
): { calibration: CalibrationSpec; refused?: WriteRefusal } {
  const released: Record<typeof key, readonly string[]> = {
    density: RELEASED_DENSITIES,
    mode: RELEASED_MODES,
    plan: RELEASED_PLANS,
    center: RELEASED_CENTERS,
  }
  if (!released[key].includes(value)) return { calibration, refused: 'options-only' }
  return { calibration: { ...calibration, [key]: value } }
}

export function calibrationLimitsFor(key: CalibrationNumberKey): { min: number; max: number } {
  return CALIBRATION_LIMITS[key]
}
