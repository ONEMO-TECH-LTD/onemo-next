// grid-magnet-spec.ts — SPEC: values only. No arithmetic, no policy.

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

/** SIZE BANDS — **every 48mm is a new band** (Dan, 2026-08-29). One magnet pitch per band from the
 *  smallest effect up; each end 1mm shy of the next start so no size lives in two bands.
 *
 *  Written out as values because spec holds values, never arithmetic — the 48mm repeat is asserted
 *  by the separation gate instead, so the table cannot drift off the rule.
 *
 *  The five that used to be here stopped at 264 and left everything larger homeless: twelve library
 *  records among them, two of which are slim shapes only 73mm and 75mm across their short axis. */
export const BAND_STEP_MM = 48
export interface Band { readonly id: number; readonly minMM: number; readonly maxMM: number }
export const BANDS: ReadonlyArray<Band> = Object.freeze([
  Object.freeze({ id: 1, minMM: 24, maxMM: 71 }),
  Object.freeze({ id: 2, minMM: 72, maxMM: 119 }),
  Object.freeze({ id: 3, minMM: 120, maxMM: 167 }),
  Object.freeze({ id: 4, minMM: 168, maxMM: 215 }),
  Object.freeze({ id: 5, minMM: 216, maxMM: 263 }),
  Object.freeze({ id: 6, minMM: 264, maxMM: 311 }),
  Object.freeze({ id: 7, minMM: 312, maxMM: 359 }),
  Object.freeze({ id: 8, minMM: 360, maxMM: 407 }),
  Object.freeze({ id: 9, minMM: 408, maxMM: 455 }),
])

/** Snap scan size step. */
export const SNAP_STEP_MM = 1


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
