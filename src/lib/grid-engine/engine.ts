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
 * The spot each magnet occupies on the fabric. Law 2.1: "each magnet has a safe padding area of 10mm
 * calculated from the centre, means each magnet is occupying a 20mm spot on the fabric".
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
 * Half the POPULATED pitch, not half the base lattice: at 96mm the gap the shape must centre in lies
 * between two populated magnets, and half a base step lands back on one of them. What moves is where
 * the shape sits on the lattice, not the lattice — one spacing, one lattice (law 1.1).
 */
export function registrationOffsetMM(grid: GridSpec, registration: Registration): number {
  return registration === 'gap' ? grid.pitchMM / 2 : 0
}

/**
 * The empty millimetres beyond the outermost cells, so the field visibly ENDS. Derived, not chosen:
 * the largest padding that still excludes the next position is the bare gap between two cells.
 */
function fieldMarginMM(grid: GridSpec): number {
  return grid.basePitchMM - cellDiameterMM(grid)
}

/** The span the field occupies at the released row and column count, in millimetres. */
function fieldSpanMM(spec: GridSystemSpec): number {
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
 * Every populated magnet centre inside a region — and NOT one beyond it. Indices walk THE one
 * lattice from its registration; only every stride-th one carries a magnet (law 1.2).
 */
export function magnetsInRegion(
  grid: GridSpec,
  region: RegionMM,
  offsetMM: number,
): PointMM[] {
  const { basePitchMM } = grid
  const stride = populationStride(grid)
  const first = (lo: number) => Math.ceil((lo - offsetMM) / basePitchMM)
  const last = (hi: number) => Math.floor((hi - offsetMM) / basePitchMM)
  const onStride = (i: number) => ((i % stride) + stride) % stride === 0

  const points: PointMM[] = []
  for (let i = first(region.x); i <= last(region.x + region.w); i++) {
    if (!onStride(i)) continue
    for (let j = first(region.y); j <= last(region.y + region.h); j++) {
      if (!onStride(j)) continue
      points.push([offsetMM + i * basePitchMM, offsetMM + j * basePitchMM])
    }
  }
  return points
}

/**
 * PUBLICATION (law 3.23). The exact wrap is the design size; only publication rounds it, and it
 * rounds UP to the next even whole millimetre.
 *
 * Dan, 2026-07-29, having challenged the rule himself: *"we need round to the highest number
 * obviously not lowest because the shape must not be smaller than grid. And this also must round to
 * the next non-odd number so that grid is centered as well with no fractions — we cannot place
 * anything on a fraction, it is just humanly impossible with fabric."*
 *
 * Up, never down: a smaller shape could not hold the grid it was solved for. Even: an odd size puts
 * the grid off-centre. Rounding up can only ever increase a magnet's clearance, never reduce it —
 * asserted in the gate rather than assumed, because a publication that broke the padding floor would
 * be the 9.947mm class returning through a different door.
 *
 * Apply to the EXACT wrap only. Re-applying it to an already-published size drifts upward.
 */
export function publishedSizeMM(exactMM: number): number {
  return 2 * Math.ceil(exactMM / 2)
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
