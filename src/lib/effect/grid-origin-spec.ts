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

/** Size bands, ends 1mm shy so no size lives in two bands. B5 keeps its ceiling. */
export interface Band { readonly id: 1 | 2 | 3 | 4 | 5; readonly minMM: number; readonly maxMM: number }
export const BANDS: ReadonlyArray<Band> = Object.freeze([
  Object.freeze({ id: 1 as const, minMM: 24, maxMM: 71 }),
  Object.freeze({ id: 2 as const, minMM: 72, maxMM: 119 }),
  Object.freeze({ id: 3 as const, minMM: 120, maxMM: 167 }),
  Object.freeze({ id: 4 as const, minMM: 168, maxMM: 215 }),
  Object.freeze({ id: 5 as const, minMM: 216, maxMM: 264 }),
])

/** Registration search phase step — how finely the lattice slides under the shape.
 *  RULED 2026-08-18: continuous 1mm registration — Dan tested the dial and locked 1mm; the
 *  per-band selection is correct for the first time with it. 12 (the cell increment) remains
 *  an admin test value, not the law. */
export const PHASE_STEP_MM = 1
export const PHASE_STEP_FLOOR_MM = 1

/** Flap allowance — the invisible margin every disc wears (Dan's contact law): band options
 *  are the sizes where the edge presses against spot + allowance. RULED 2026-08-19: the
 *  factory default is 0 — edge-to-edge tangency; any margin is an explicit admin grant. */
export const FLAP_MM = 0
export const FLAP_FLOOR_MM = 0
export const FLAP_CEIL_MM = 48

/** Snap scan size step. */
export const SNAP_STEP_MM = 1

/** Auto flap — the micro-module's scan: allowance tried from 0 up in this step, granting only
 *  what the band needs to produce a contact variant, capped by the admin max. */
export const AUTO_FLAP_STEP_MM = 2
export const AUTO_FLAP_MAX_MM = 12

/** Voting dominance tiers — strict: the top force always beats the next, never blends.
 *  VOTING_ORDER picks which force sits on which tier (0 = magnets > wrap > centring). */
export const SEAT_WEIGHT = 100000
export const FLAP_WEIGHT = 100
export const BALANCE_WEIGHT = 1
export const VOTING_ORDER = 0

/** Mass depth — clearance a region must survive to count as a MASS (limbs and slivers die
 *  shallow, true masses survive deep). Admin-dialled; 12 = every legal point counts. */
export const MASS_DEPTH_MM = 16
export const MASS_DEPTH_FLOOR_MM = 12
export const MASS_DEPTH_CEIL_MM = 24

/** Positioning law — 0 voting (count/centring/coverage compete across swept slides) ·
 *  1 centre rules (grid locked to the centre by parity; seats pick among 4 parity slides). */
export const POSITIONING = 0

/** Governor — which mass rules in Masses mode: 0 smallest · 1 deepest · 2 top (gravity) ·
 *  3 top-small (upper-half smallest, else topmost). */
export const GOVERNOR = 0

/** Centre mode — which centre drives anchoring and balance. Test switch:
 *  0 box · 1 core (erosion mean) · 2 masses (adaptive, default) · 3 weight (material
 *  centroid) · 4 deep (deepest point) · 5 top (highest mass). */
export const CENTRE_MODE = 2
