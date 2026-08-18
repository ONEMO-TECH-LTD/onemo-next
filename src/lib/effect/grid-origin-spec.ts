// grid-origin-spec.ts — SPEC: all the values we hold. Values only, no arithmetic, no policy.
//
// Compute reads these to run its formulas; the bridge reads them to wire a surface; the shell
// renders whatever they say. A number typed anywhere else is a leak.

/** THE lattice, centre to centre. */
export const DEFAULT_PITCH_MM = 48

/**
 * The released pitches a surface may offer. 96 is the SPARSE tier — the same 48 lattice with every
 * second point skipped, more space per magnet; 24 is the fine bench tier.
 */
export const RELEASED_PITCHES_MM: ReadonlyArray<{ mm: number; label: string }> = Object.freeze([
  Object.freeze({ mm: 96, label: '96 mm · sparse' }),
  Object.freeze({ mm: 48, label: '48 mm · standard' }),
  Object.freeze({ mm: 24, label: '24 mm · fine' }),
])

/** The slider's floor for padding — the historical minimum. */
export const PADDING_FLOOR_MM = 10

/** The released padding — Dan, 2026-08-10: "decided for 12mm padding - locked decision". */
export const RELEASED_PADDING_MM = 12

/** The smallest effect the product names — one 24mm cell. */
export const MIN_EFFECT_MM = 24

/** The full field — nine positions per axis on the standard lattice. */
export const FIELD_POSITIONS_PER_AXIS = 9

/** The magnet bodies, by radius. Which body a plan uses is policy; these are the values. */
export const MAGNET_RADIUS_SMALL_MM = 3
export const MAGNET_RADIUS_LARGE_MM = 4

/** Fewest magnets that count as holding; the count auto-fit climbs toward. */
export const MIN_ANCHORS = 2
export const TARGET_ANCHORS = 4
