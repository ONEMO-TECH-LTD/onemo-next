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

/**
 * HOW FINELY THE LATTICE IS SLID when reading which points a shape carries.
 *
 * A released MEASUREMENT RESOLUTION, not a law value — which is why it sits out
 * here beside the launch pitches rather than inside the guarded spec. It buys
 * precision with time and is the one place the reading approximates anything.
 */
export const PHASE_STEP_MM = 2

/** The launch pitches. 24 and 72 do not exist anywhere in the system (law 1.3). */
export const LAUNCH_PITCHES_MM: readonly number[] = Object.freeze([48, 96])

/**
 * WHICH RELEASED PITCH EACH DECLARED POPULATION IS DRAWN AT.
 *
 * The grammar below declares two populations of the ONE lattice — base takes every point, sparse
 * every second (law 1.2). A surface showing candidates has to draw the population the candidate
 * actually belongs to: at the 96mm view the canvas draws only the sparse points, so a base-population
 * candidate's magnets fell in the gaps between drawn discs — 13,332 of 17,078 highlighted positions
 * landing where no magnet was drawn.
 *
 * Stated as DATA here, beside the grammar that declares the populations, because it is released
 * policy and because this file computes nothing: the values are the launch pitches themselves, read
 * rather than multiplied out.
 */
export const POPULATION_PITCH_MM: Readonly<Record<string, number>> = Object.freeze({
  base: LAUNCH_PITCHES_MM[0]!,
  sparse: LAUNCH_PITCHES_MM[1]!,
})

/**
 * THE ARRANGEMENT GRAMMAR — released input DATA for the installed candidate enumerator.
 *
 * It lives here because it is policy, not calculation: which families exist, which populations the
 * one lattice carries, and the two formal readings the delivered enumerator refuses to choose for
 * us (run spacing, and whether a 1x1 window is a window). Compute may CONSUME it; compute may not
 * OWN it — the seam was authoring it, which put released policy inside the calculation module.
 *
 * The sparse population is every second base point (law 1.2), stated here as the declared
 * population rule rather than inferred from whichever pitch a surface happens to be drawing.
 */
export const RELEASED_ARRANGEMENT_GRAMMAR = Object.freeze({
  schema: 'magnetic-grid-candidate-enumerator/grammar/v1',
  populations: Object.freeze([
    Object.freeze({ id: 'base', origin: Object.freeze({ column: '0', row: '0' }), indexStep: '1' }),
    Object.freeze({ id: 'sparse', origin: Object.freeze({ column: '0', row: '0' }), indexStep: '2' }),
  ]),
  families: Object.freeze({
    single: Object.freeze({}),
    run: Object.freeze({ stepDomain: 'any-positive-whole-population-step' }),
    'rectangle-corners': Object.freeze({}),
    'corner-triangle': Object.freeze({}),
    'full-window': Object.freeze({ oneByOne: 'include' }),
  }),
})
