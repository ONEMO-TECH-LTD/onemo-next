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

/** SIZE BANDS — measured on the INNER LEGAL AREA, every 48mm a new band (Dan, 2026-08-29:
 *  "free shapes are actually less predictable so the range in which the shape is must be measure by
 *  inner legal area ... B2 is 48-96mm range for legal area and this continues like this").
 *
 *  The legal area is what the outline leaves after the magnet's own 12mm rim is taken off every
 *  boundary — the region a magnet CENTRE may occupy. Banding on it means a band says how many
 *  magnet positions the shape can carry across its dominant axis: B1 holds one, B2 two, B3 three.
 *  Band and class then agree by construction rather than by coincidence — measured across the whole
 *  library, a record's legal band equals its frame's larger axis in all 163 cases.
 *
 *  Banding on the OUTER box was the bug: a pointed or diagonal outline is far bigger than the area
 *  inside it that can hold anything. Sixteen triangle records sat one band too high for exactly
 *  that reason, and a diamond's outline overstates its legal extent by 10mm at 2×2 alone.
 *
 *  Ends 1mm shy of the next start so no size lives in two bands. Values only — the 48mm repeat is
 *  asserted by the separation gate, so the table cannot drift off the rule. */
export const BAND_STEP_MM = 48
export interface Band { readonly id: number; readonly minMM: number; readonly maxMM: number }
export const BANDS: ReadonlyArray<Band> = Object.freeze([
  Object.freeze({ id: 1, minMM: 0, maxMM: 47 }),
  Object.freeze({ id: 2, minMM: 48, maxMM: 95 }),
  Object.freeze({ id: 3, minMM: 96, maxMM: 143 }),
  Object.freeze({ id: 4, minMM: 144, maxMM: 191 }),
  Object.freeze({ id: 5, minMM: 192, maxMM: 239 }),
  Object.freeze({ id: 6, minMM: 240, maxMM: 287 }),
  Object.freeze({ id: 7, minMM: 288, maxMM: 335 }),
  Object.freeze({ id: 8, minMM: 336, maxMM: 383 }),
  Object.freeze({ id: 9, minMM: 384, maxMM: 431 }),
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
