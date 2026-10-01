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

/** EDGE PADDING — the shape's own stand-off, added to the magnet's rim when the outline wraps
 *  (Dan, 2026-09-22: "wrap will use the offset - aka edge padding of the shape").
 *
 *  It is the brand pattern's reach: the cosmetic disc is the magnet's rim grown by this much, and
 *  the outline presses against the GROWN disc instead of the bare rim. Two controls, because they
 *  are two different facts — the rim is the magnet's own physical clearance and is locked at 12;
 *  the edge padding is the covering footprint and differs per pitch (the sparse 96 lattice needs a
 *  larger cell than the granular 48 before the double-offset join reads as fluid).
 *
 *  It reaches the WRAP only. Registration, the seat predicate, the legal area and therefore every
 *  band are measured on the bare rim exactly as before, so raising this grows the outline and moves
 *  nothing else — node-to-node stays 48/96 and a released record keeps its band.
 *
 *  UNITS — PER SIDE. It pads THE LINE THAT WRAPS THE GRID and nothing else: the outline stands off
 *  this much further, the effect grows by twice it (120 -> 132 at 6, -> 144 at 12), and the disc is
 *  untouched. The cell is the DISC's business — see DISC_OFFSET_MM.
 *
 *  SUPERSEDES the 2026-08-25 flap deletion (`afa67ccd`), which removed `flapMM`/`seatMarginMM` as a
 *  duplicate of the padding disc. The duplicate part of that ruling stands — `seatMarginMM` is NOT
 *  coming back, because an allowance may never shrink the legal seating area. */
export const EDGE_PADDING_MM = 0
export const EDGE_PADDING_FLOOR_MM = 0
export const EDGE_PADDING_CEIL_MM = 24

/** THE PADDING'S SHAPE — what the 12mm padding LOOKS like, per seated magnet (Dan, 2026-09-22).
 *
 *  The 24mm magnetic lattice is invisible; what is visible is the padding disc the shape contains.
 *  Until now that disc could only be a circle, because the page drew `<circle>` and the engine only
 *  ever stated a radius. The disc is a SQUARE of `2 * padding` with a corner radius, so:
 *
 *    circle   — 24mm square at FULL radius (12). Geometrically the circle drawn today; the default,
 *               so nothing changes until a mode is chosen.
 *    squircle — 24mm square, radius exposed, 11mm by default.
 *    offset   — the 24mm square grown by EDGE padding (4mm a side by default, making 32mm), radius
 *               exposed, 12.8mm by default. The sparse 96 lattice needs the larger cell before the
 *               double-offset join between neighbours reads as fluid, and a 24mm cell is too small
 *               to hold an 8mm magnet on a garment.
 *
 *  Values only. The disc's geometry is built in `padding-disc.ts` from these; nothing is drawn from
 *  a literal in a component. */
export type PaddingShape = 'circle' | 'squircle' | 'offset'
export const PADDING_SHAPE: PaddingShape = 'circle'
/** Corner radius defaults, per mode. `circle` takes no dial: its radius IS half the cell, which is
 *  what makes it a circle, so exposing it would offer a control that can only make it wrong. */
export const SQUIRCLE_RADIUS_MM = 11
export const OFFSET_SQUIRCLE_RADIUS_MM = 12.8
export const SQUIRCLE_RADIUS_FLOOR_MM = 0
export const SQUIRCLE_RADIUS_CEIL_MM = 16

/** THE DISC'S OWN OFFSET — how far the `offset` mode grows its cell past the rim. 4mm a side over
 *  the 12mm rim is the 32mm sparse cell Dan draws.
 *
 *  This is NOT the edge padding. Dan, 2026-09-22: "the discs are 1 category of the additions the
 *  edge padding is another", and "the line that wraps the grid must be padded = edge padding".
 *  The disc offset grows the CELL; the edge padding grows the LINE. Feeding one number to both is
 *  what made a 24mm edge padding inflate every disc to 72mm across and draw a released square as a
 *  four-petal blob. */
export const DISC_OFFSET_MM = 4
export const DISC_OFFSET_FLOOR_MM = 0
export const DISC_OFFSET_CEIL_MM = 24

/** THE SHAPE'S CORNER RADIUS — how round the wrapping line's corners are, as a value Dan sets and
 *  locks rather than a side effect of the padding (Dan, 2026-09-22: "why by default it adds radius
 *  i need the controls for that for me to set and lock shape radius").
 *
 *  Growing an outline with ROUND joins produces corner arcs equal to the offset distance, so a 24mm
 *  edge padding silently gave 24mm corners and a padded square read soft. The two are separated the
 *  exact way: offset by `(padding - radius)` with SHARP joins, then by `radius` with round ones. The
 *  total stand-off is unchanged; only the corner is chosen.
 *
 *  `null` means FOLLOW THE PADDING — the released behaviour, so nothing moves until Dan sets a
 *  value. 0 is a genuine setting: square corners. */
export const SHAPE_RADIUS_MM: number | null = null
export const SHAPE_RADIUS_FLOOR_MM = 0
export const SHAPE_RADIUS_CEIL_MM = 48

export const PADDING_SHAPES: ReadonlyArray<{
  id: PaddingShape; label: string
  /** Does this variant carry a corner-radius dial? `circle` does not: its radius IS half the cell,
   *  which is what makes it a circle, so a dial could only make it wrong. Stated here so no surface
   *  has to ask WHICH mode it is looking at — a surface that branches on a mode id is deciding. */
  exposesRadius: boolean
  /** ...and a disc-offset dial. The EDGE padding is not a disc dial at all — it belongs to the
   *  wrapping line and is offered in every mode. */
  exposesDiscOffset: boolean
  /** The values this variant starts at when chosen. */
  radiusMM: number
  discOffsetMM: number
}> = Object.freeze([
  Object.freeze({ id: 'circle' as PaddingShape, label: 'circle', exposesRadius: false, exposesDiscOffset: false, radiusMM: 0, discOffsetMM: 0 }),
  Object.freeze({ id: 'squircle' as PaddingShape, label: 'squircle', exposesRadius: true, exposesDiscOffset: false, radiusMM: SQUIRCLE_RADIUS_MM, discOffsetMM: 0 }),
  Object.freeze({ id: 'offset' as PaddingShape, label: 'offset', exposesRadius: true, exposesDiscOffset: true, radiusMM: OFFSET_SQUIRCLE_RADIUS_MM, discOffsetMM: DISC_OFFSET_MM }),
])


/** THE OVALS — the three Dan drew (2026-09-09), in millimetres of outline. Authored, not derived: the
 *  smallest legal ellipse around a 2x2 magnet grid is 92x92, a circle, where the drawn one is 84x120.
 *  Values only; which magnets each holds is the lattice's answer, computed in the library. */
export const OVAL_SIZES_MM: ReadonlyArray<{ readonly widthMM: number; readonly heightMM: number }> = Object.freeze([
  Object.freeze({ widthMM: 72, heightMM: 120 }),
  Object.freeze({ widthMM: 84, heightMM: 120 }),
  Object.freeze({ widthMM: 96, heightMM: 168 }),
])

/** Smallest effect — one 24mm cell. */
export const MIN_EFFECT_MM = 24

/** Protector padding — how far from a magnet's edge material still counts as held (mm). The
 *  admin dial's default; was a literal in the page and the worker until T1 S3 (2026-09-02). */
export const PROTECTION_PADDING_MM = 24

/** THE BOARD — 9 columns by 11 rows (Dan, 2026-08-29: "the max grid is rectangular 9 columns and
 *  10-11 rows" / "next step in 96mm grid is 9x11 — so this can be max size for now"). It is the
 *  ONLY cap: "we don't have to limit the grid engine at all, it calculates and spits out anything".
 *  The garment's own receiver canvas is 7x9 regular and 9x11 at most. */
export const FIELD_COLUMNS = 9
export const FIELD_ROWS = 11

/** The board in MILLIMETRES of legal area — the span the outermost magnet centres may occupy. It is
 *  the fixed fact; how many POSITIONS it holds depends on the lattice in use, so a coarser pitch
 *  reaches the same board with fewer of them (Dan, 2026-08-29: the sparser tier is "the same lattice
 *  just sparser"). Reading the position count as pitch-free published layouts that could not
 *  physically sit on the board. The conversion lives in library/geometry.ts — spec states values. */
export const BOARD_WIDTH_MM = 384
export const BOARD_HEIGHT_MM = 480

/** DEFECT, filed not fixed: the engine's size ceiling reads this for BOTH axes, so it models the
 *  board as square and caps every shape at 420mm. A portrait shape can lawfully reach 504mm. */
export const FIELD_POSITIONS_PER_AXIS = FIELD_COLUMNS

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
 *  library, a record's legal band equals its frame's larger axis for every published catalogue record.
 *
 *  Banding on the OUTER box was the bug: a pointed or diagonal outline is far bigger than the area
 *  inside it that can hold anything. Sixteen triangle records sat one band too high for exactly
 *  that reason, and a diamond's outline overstates its legal extent by 10mm at 2×2 alone.
 *
 *  Runs to B11 because that is the board: 9 columns spans 384mm of legal area and 11 rows spans
 *  480mm, and the board is the only cap (Dan, 2026-08-29). The table DESCRIBES the board; it is not
 *  licence to generate at the top of it.
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
  Object.freeze({ id: 10, minMM: 432, maxMM: 479 }),
  Object.freeze({ id: 11, minMM: 480, maxMM: 527 }),
])

/** Snap scan size step. */
export const SNAP_STEP_MM = 1

/** Canon-smart placement resolution — one full lattice period is searched at this step. */
export const PHASE_STEP_MM = 1


/** REMOVED 2026-08-30 (Dan): the mass-depth dial and its 16mm default. Nothing ruled the 16 — it was
 *  4mm past the padding for no reason anyone could trace — and it was measurably harmful: a region
 *  probed 4mm deeper than the legal area is 8mm narrower, which cost the classifier a whole magnet
 *  position at every size (a 120mm square read 2 across where it seats 3). A region is now MASS
 *  exactly where a magnet centre may sit, so there is one depth, not two, and no dial can change
 *  what a shape is.
 *
 *  What it cost: a thin neck can no longer be excluded from governing the centre by depth alone.
 *  Islands still separate wherever material narrows past a magnet's own clearance. */

/** Governor — which mass rules in Masses mode: 0 smallest · 1 deepest · 2 top (gravity) ·
 *  3 top-small (upper-half smallest, else topmost). */
export const GOVERNOR = 0

/** Centre mode — which centre drives anchoring and balance. Test switch:
 *  0 box · 1 core (erosion mean) · 2 masses (adaptive, default) · 3 weight (material
 *  centroid) · 4 deep (deepest point) · 5 top (highest mass). */
export const CENTRE_MODE = 2
