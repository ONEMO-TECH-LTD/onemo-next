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
 * The empty millimetres beyond the outermost cells, so the field visibly ENDS.
 *
 * ONE FULL LATTICE STEP. Dan, 2026-08-10: "make padding beyond grid 48mm not 40mm".
 *
 * (It was the bare gap between two cells — pitch minus cell — which is 24mm at the locked 12mm
 * padding and read as cramped. A whole step is the ruling, and it still stops short of the next
 * position, so the field ends where the law says it ends.)
 */
function fieldMarginMM(grid: GridSpec): number {
  return grid.basePitchMM
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

/** The eight grips on a box. Named by compass point, as the surface draws them. */
export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** The point a handle scales AWAY from — the opposite corner, or the opposite edge's midpoint. */
function anchorFor(box: RegionMM, handle: HandleId): PointMM {
  const l = box.x, r = box.x + box.w, t = box.y, b = box.y + box.h
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2
  switch (handle) {
    case 'nw': return [r, b]
    case 'ne': return [l, b]
    case 'se': return [l, t]
    case 'sw': return [r, t]
    case 'n': return [cx, b]
    case 's': return [cx, t]
    case 'w': return [r, cy]
    case 'e': return [l, cy]
  }
}

/**
 * Drag a handle, get a box. ASPECT IS LOCKED — one factor is derived and applied to both axes, so
 * width and height are never independently adjustable (law 2.1).
 *
 * A corner takes whichever axis the pointer moved furthest along, so the shape follows the hand
 * without ever shearing. An edge takes its own axis alone and the other follows in proportion.
 *
 * The anchor stays put: the opposite corner for a corner grip, the opposite edge for an edge grip.
 */
export function scaleBoxFromHandle(
  box: RegionMM,
  handle: HandleId,
  pointerMM: PointMM,
  minMM: number,
): RegionMM {
  if (box.w <= 0 || box.h <= 0) return box
  const [ax, ay] = anchorFor(box, handle)
  const reachX = Math.abs(pointerMM[0] - ax)
  const reachY = Math.abs(pointerMM[1] - ay)

  const horizontal = handle === 'e' || handle === 'w'
  const vertical = handle === 'n' || handle === 's'
  const k = horizontal
    ? reachX / box.w
    : vertical
      ? reachY / box.h
      : Math.max(reachX / box.w, reachY / box.h)

  // WHOLE MILLIMETRES. Dan, 2026-08-10: "scaling must be in increments of 1mm". The drag is
  // continuous; what it lands on is not. Rounding the driven axis and deriving the other from the
  // ratio keeps the step exact without ever letting the proportions drift.
  const w = Math.max(minMM, Math.round(box.w * k))
  const h = w * (box.h / box.w) // the ratio it arrived with — never recomputed from the pointer

  // Grow away from the anchor, in the direction the handle already lay.
  const x = ax <= box.x + box.w / 2 ? ax : ax - w
  const y = ay <= box.y + box.h / 2 ? ay : ay - h
  return { x, y, w, h }
}

/**
 * Move a placed shape. Whole millimetres, like the scale (Dan, 2026-08-10: "scaling must be in
 * increments of 1mm") — a shape that lands on a fraction cannot be reasoned about in a system whose
 * every other number is exact.
 *
 * SCAFFOLDING, and named as such: in the product nothing drags a shape onto the field. Registration
 * is decided by the count's parity and nothing is chosen (law 9.2), and the layout must sit centred
 * on the shape (law 3.1a). This exists so a placement can be set BY EYE and compared against the one
 * the engine determines — it is a measuring instrument, not a behaviour the product has.
 */
export function moveBoxBy(box: RegionMM, deltaMM: PointMM): RegionMM {
  return { ...box, x: Math.round(box.x + deltaMM[0]), y: Math.round(box.y + deltaMM[1]) }
}
