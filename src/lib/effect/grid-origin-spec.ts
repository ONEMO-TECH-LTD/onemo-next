// grid-origin-spec.ts — SPEC: values only. No arithmetic, no policy.

/** The lattice, centre to centre. */
export const DEFAULT_PITCH_MM = 48

/** Released pitches. 96 = the 48 lattice thinned (every second point); 24 = fine bench tier. */
export const RELEASED_PITCHES_MM: ReadonlyArray<{ mm: number; label: string }> = Object.freeze([
  Object.freeze({ mm: 96, label: '96 mm' }),
  Object.freeze({ mm: 48, label: '48 mm' }),
  Object.freeze({ mm: 24, label: '24 mm' }),
])

/** Padding slider floor. */
export const PADDING_FLOOR_MM = 10

/** Released padding — locked 12mm, measured from the magnet centre. */
export const RELEASED_PADDING_MM = 12

/** Smallest effect — one 24mm cell. */
export const MIN_EFFECT_MM = 24

/** Field positions per axis (9×9). */
export const FIELD_POSITIONS_PER_AXIS = 9

/** Magnet body radii. */
export const MAGNET_RADIUS_SMALL_MM = 3
export const MAGNET_RADIUS_LARGE_MM = 4

/** Fewest magnets that count as holding; the count auto-fit climbs toward. */
export const MIN_ANCHORS = 2
export const TARGET_ANCHORS = 4

/** The size bands: square references 24/72/120/168/216, each running to the next. */
export interface Band { readonly id: 1 | 2 | 3 | 4 | 5; readonly minMM: number; readonly maxMM: number }
export const BANDS: ReadonlyArray<Band> = Object.freeze([
  Object.freeze({ id: 1 as const, minMM: 24, maxMM: 72 }),
  Object.freeze({ id: 2 as const, minMM: 72, maxMM: 120 }),
  Object.freeze({ id: 3 as const, minMM: 120, maxMM: 168 }),
  Object.freeze({ id: 4 as const, minMM: 168, maxMM: 216 }),
  Object.freeze({ id: 5 as const, minMM: 216, maxMM: 264 }),
])

/** Registration search phase step — the grid's own 12mm increment. */
export const PHASE_STEP_MM = 12

/** Snap scan: size step and ceiling. */
export const SNAP_STEP_MM = 1
export const SNAP_MAX_MM = 300

/** Registration score weights: seats, then flaps, then balance. */
export const SEAT_WEIGHT = 100000
export const FLAP_WEIGHT = 100
