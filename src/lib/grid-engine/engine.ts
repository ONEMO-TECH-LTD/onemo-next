// grid-engine/engine.ts — SUB 1, THE ENGINE. Pure computing.
//
// Dan, 2026-08-10: "Sub 1 — the ENGINE. Pure computing. Takes a shape and the values, works out the
// layout and the size. It holds no values of its own — every number it uses arrives from Sub 2."
//
// So: no constants, no defaults, no literals standing in for law. Every number in here is either
// read off the spec it was handed or produced by arithmetic on those. Pure millimetres — it has
// never heard of a screen, a pixel, a zoom or a framework.

import type { GridSpec, GridSystemSpec, Registration } from './spec'

export type PointMM = [number, number]

/** A rectangle of the field, in millimetres. */
export interface RegionMM {
  x: number
  y: number
  w: number
  h: number
}

/**
 * The spot each magnet occupies on the fabric — two paddings across, whatever the padding is.
 *
 * The rule was stated at 10mm: "each magnet has a safe padding area of 10mm calculated from the
 * centre, means each magnet is occupying a 20mm spot on the fabric". The padding was then locked at
 * 12 (Dan, 2026-08-10: "decided for 12mm padding - locked decision change the logic in laws and
 * briefs and in the code"), so the spot is 24mm today. The RULE never changed — only its input — and
 * this function has always read the value rather than the example, which is why quoting the 10/20
 * example as if it were current was a doc defect and not a behaviour one.
 */
export function cellDiameterMM(grid: GridSpec): number {
  return 2 * grid.paddingMM
}

/**
 * How many base-lattice steps lie between two populated magnets. 48mm → every point; 96mm → every
 * second. This is what makes 96 a THINNING of the one lattice rather than a lattice of its own.
 */
function populationStride(grid: GridSpec): number {
  const stride = grid.pitchMM / grid.basePitchMM
  if (!Number.isInteger(stride) || stride < 1) {
    throw new RangeError('Populated pitch must be a whole multiple of the base lattice.')
  }
  return stride
}

/**
 * How far the lattice sits from the shape's centre.
 *
 * A PROPERTY OF THE LAYOUT, NEVER OF A VIEW. It was briefly derived from the zoom stop, which made
 * the lattice physically move when you zoomed — a view concern in charge of the geometry.
 *
 * HALF THE BASE LATTICE, never half the populated pitch. Dan, 2026-08-11: "why switching to 96mm
 * moves the grid? it must hide the points not move it."
 *
 * This offset anchors THE one lattice, and the lattice cannot depend on how much of itself is
 * populated. Reading it off the populated pitch made the anchor 24mm at 48 and 48mm at 96, so
 * choosing the thinned population dragged every remaining magnet 24mm sideways — measured on the
 * page: 48mm gave columns at -166 -118 -70 -22 26 74 122 170, and 96mm gave -142 -46 50 146, which
 * shares not one position with it. Law 1.2 says 96 is a THINNING of the 48 lattice; a set that
 * shares no point with it is a second lattice, which is exactly what law 1.1 forbids.
 *
 * The superseded reasoning was that at 96 the shape should centre in the gap between two POPULATED
 * magnets, which needs half a populated step. That is true as far as it goes, and it is why this was
 * written that way — but it buys symmetry by moving the lattice, and the lattice is the thing that
 * must hold still. The cost is stated rather than hidden: at 96 with gap registration the shape's
 * centre sits half a base step from a populated magnet rather than midway between two, so the four
 * are not symmetric about it. That is a registration question — answered by the match's parity and
 * by the pan — not a licence for the population to relay the grid.
 */
export function registrationOffsetMM(grid: GridSpec, registration: Registration): number {
  return registration === 'gap' ? grid.basePitchMM / 2 : 0
}

/**
 * The empty millimetres beyond the outermost cells, so the field visibly ENDS.
 *
 * ONE MAGNET SPOT — 24mm at the locked 12mm padding. Dan, 2026-08-11: "there is padding post 9x9 so
 * that shape that needs to fit the outmost grid points has canvas space… add 24mm on each side" and
 * "it must be not 48 and not 72 I said 24".
 *
 * It is the spot rather than the number, so it moves with the padding like everything else. This is
 * the ONLY margin in the system: a shape reaching the outermost points has exactly this much canvas
 * beyond it, and no surface adds a second one on top.
 *
 * (It was a full lattice step, 48mm, from an earlier ruling. That produced no visible margin at all
 * once the camera scaled to the shape — the same 48 sat in the numerator and the denominator and
 * cancelled — while an empty field had no margin either. One value, one behaviour.)
 */
function fieldMarginMM(grid: GridSpec): number {
  return cellDiameterMM(grid)
}

/**
 * The magnet block at the released row and column count — the field WITHOUT its margin.
 *
 * This is what a camera scales against: divide it by the shape's size and the margin around the
 * block survives into the view instead of cancelling out.
 */
export function fieldSpanMM(spec: GridSystemSpec): number {
  return (spec.grid.positionsPerAxis - 1) * spec.grid.basePitchMM + cellDiameterMM(spec.grid)
}

/** Grow a region about its centre so it is never narrower than the field the law asks for. */
export function withMinimumSpan(spec: GridSystemSpec, region: RegionMM): RegionMM {
  const floor = fieldSpanMM(spec)
  const out = { ...region }
  if (out.w < floor) {
    const cx = out.x + out.w / 2
    out.x = cx - floor / 2
    out.w = floor
  }
  if (out.h < floor) {
    const cy = out.y + out.h / 2
    out.y = cy - floor / 2
    out.h = floor
  }
  return out
}

/** The field padded out, so its own edge is inside anything that frames it. */
export function paddedFieldMM(grid: GridSpec, field: RegionMM): RegionMM {
  const m = fieldMarginMM(grid)
  return { x: field.x - m, y: field.y - m, w: field.w + 2 * m, h: field.h + 2 * m }
}

/**
 * WHERE THE LATTICE ACTUALLY SITS, per axis — registration plus pan, in millimetres.
 *
 * This is a manufacturing coordinate: it is the point every magnet is measured from, and a surface
 * drawing the lattice as a rule must anchor on it or the lines miss the centres they run through
 * (law 8.3). It is produced HERE because adding two millimetre quantities is geometry, and the
 * bridge does none — it was briefly assembled there, which put a coordinate in the wiring.
 */
export function latticeAnchorMM(offsetMM: number | PointMM, panMM: PointMM): PointMM {
  const [ox, oy] = typeof offsetMM === 'number' ? [offsetMM, offsetMM] : offsetMM
  return [ox + panMM[0], oy + panMM[1]]
}

/**
 * Every populated magnet centre inside a region — and NOT one beyond it. Indices walk THE one
 * lattice from its registration; only every stride-th one carries a magnet (law 1.2).
 */
export function magnetsInRegion(
  grid: GridSpec,
  region: RegionMM,
  offsetMM: number | PointMM,
  panMM: PointMM = [0, 0],
): PointMM[] {
  const { basePitchMM } = grid
  const stride = populationStride(grid)
  // The lattice is infinite; PAN slides it against the shape. Per axis, because the shape is held
  // still and the grid is what moves to meet it. Same anchor the rule is drawn on — one definition.
  const [ox, oy] = latticeAnchorMM(offsetMM, panMM)
  const first = (lo: number, o: number) => Math.ceil((lo - o) / basePitchMM)
  const last = (hi: number, o: number) => Math.floor((hi - o) / basePitchMM)
  const onStride = (i: number) => ((i % stride) + stride) % stride === 0

  const points: PointMM[] = []
  for (let i = first(region.x, ox); i <= last(region.x + region.w, ox); i++) {
    if (!onStride(i)) continue
    for (let j = first(region.y, oy); j <= last(region.y + region.h, oy); j++) {
      if (!onStride(j)) continue
      points.push([ox + i * basePitchMM, oy + j * basePitchMM])
    }
  }
  return points
}

/** What a region actually holds — the counts and spans a caller would want to state. */
export interface FieldSummary {
  cols: number
  rows: number
  spanXMM: number
  spanYMM: number
}

/** Counts only what lies INSIDE the region — anything generated beyond it is not part of it. */
export function summariseField(
  grid: GridSpec,
  region: RegionMM,
  points: ReadonlyArray<PointMM>,
): FieldSummary {
  const inside = points.filter(
    ([x, y]) =>
      x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h,
  )
  const cols = new Set(inside.map(([x]) => x)).size
  const rows = new Set(inside.map(([, y]) => y)).size
  return {
    cols,
    rows,
    spanXMM: cols > 1 ? (cols - 1) * grid.pitchMM : 0,
    spanYMM: rows > 1 ? (rows - 1) * grid.pitchMM : 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCALING A PLACED SHAPE — all of it is arithmetic, so all of it is here (law 1.1a).
//
// Dan, 2026-08-10: "scale is the only part must be applied" · "locked proportions only scaling was
// repeated 100 times today". So a handle may only ever scale. Nothing here can stretch a shape:
// the ratio is taken from the box that came in and applied to both axes, so it cannot drift.


/**
 * Set a shape's LONGEST side, keeping its proportions and its centre. Whole millimetres, like every
 * other move (Dan, 2026-08-10: "scaling must be in increments of 1mm").
 *
 * The readout and the handles must agree — a surface that shows one number while the shape is
 * another size is the stale-screen defect law 5.3 exists to prevent.
 */
export function resizeBoxToLongest(box: RegionMM, longestMM: number, minMM: number): RegionMM {
  if (box.w <= 0 || box.h <= 0) return box
  const longest = Math.max(box.w, box.h)
  const k = Math.max(minMM, Math.round(longestMM)) / longest
  const w = box.w * k
  const h = box.h * k
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/** What a run of magnets measures across, edge to edge, including their padding. Law 11.2. */
/**
 * A CENTRED RUN of magnet positions along one axis, in millimetres. GPT Pro's run formula:
 * count n occupies -(n-1), -(n-3), ..., n-1 in half-pitch units. The parity law (Dan, EC-07)
 * falls out of it: an even count straddles the centre (registers in the GAP), an odd count puts
 * a magnet ON it. Registration is therefore DERIVED per axis, never chosen.
 */
export function centredRunMM(grid: GridSpec, count: number): number[] {
  // POPULATED pitch, not the base lattice: in the 96mm population only every second base site
  // carries a magnet, and a measured position must be a site that exists. (Auditor finding R3:
  // measuring 48mm-spaced sites under a 96mm population put a held disc on an empty site.)
  const half = grid.pitchMM / 2
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push((-(count - 1) + 2 * i) * half)
  return out
}

/** The registration a run of this count derives — even in the gap, odd on a magnet (EC-07). */
export function registrationForRun(count: number): Registration {
  return count % 2 === 0 ? 'gap' : 'point'
}

export function bandSpanMM(grid: GridSpec, magnets: number): number {
  return Math.max(0, magnets - 1) * grid.pitchMM + 2 * grid.paddingMM
}
