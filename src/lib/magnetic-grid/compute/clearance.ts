// Neutral exact clearance kernel. The supplied contour is lifted losslessly to BigInt integer
// units (every finite float is m·2^e — one common power of two makes them all integers, no
// rounding, no policy quantum). Squared distances are then exact integers; sign and ordering
// decisions never touch a float.

import type { Contour, Pt } from '../spec'
import type { ExactRational } from './exact-real'
import { rational } from './exact-real'

export interface ExactSegment {
  readonly ax: bigint; readonly ay: bigint; readonly bx: bigint; readonly by: bigint
  readonly minX: bigint; readonly minY: bigint; readonly maxX: bigint; readonly maxY: bigint
  /** Which supplied ring and edge produced this segment — witness provenance. */
  readonly ring: number; readonly edge: number
}

export interface ExactContour {
  /** Integer unit: one real mm = 2^shift units. */
  readonly shift: number
  readonly unit: bigint
  readonly segments: readonly ExactSegment[]
  readonly minX: bigint; readonly minY: bigint; readonly maxX: bigint; readonly maxY: bigint
}

const floatParts = (value: number): { mantissa: bigint; exponent: number } => {
  if (!Number.isFinite(value)) throw new Error('exact contour: non-finite coordinate')
  if (value === 0) return { mantissa: BigInt(0), exponent: 0 }
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  const bits = view.getBigUint64(0)
  const sign = bits >> BigInt(63) === BigInt(1) ? -BigInt(1) : BigInt(1)
  const exp = Number((bits >> BigInt(52)) & BigInt('0x7ff'))
  const frac = bits & BigInt('0xfffffffffffff')
  const mantissa = exp === 0 ? frac : (BigInt(1) << BigInt(52)) | frac
  const exponent = exp === 0 ? -1074 : exp - 1075
  // strip trailing zero bits so the common shift stays small
  let m = mantissa, e = exponent
  while (m !== BigInt(0) && (m & BigInt(1)) === BigInt(0)) { m >>= BigInt(1); e += 1 }
  return { mantissa: sign * m, exponent: e }
}

/** Lift a supplied contour (outer + holes) to exact integer geometry. */
export function exactContour(contour: Contour): ExactContour {
  const rings = [contour.outer, ...contour.holes]
  // At least 2^12 units per mm so certified refinement has room below the coarsest input
  // (integer-mm inputs would otherwise make 1mm the finest unit). Still a power of two: lossless.
  let shift = 12
  for (const ring of rings) for (const [x, y] of ring.pts) {
    shift = Math.max(shift, -floatParts(x).exponent, -floatParts(y).exponent)
  }
  const unit = BigInt(1) << BigInt(shift)
  const lift = (v: number): bigint => {
    const { mantissa, exponent } = floatParts(v)
    return mantissa * (BigInt(1) << BigInt(exponent + shift))
  }
  const segments: ExactSegment[] = []
  let minX = BigInt(0), minY = BigInt(0), maxX = BigInt(0), maxY = BigInt(0)
  let first = true
  rings.forEach((ring, ringIndex) => {
    const pts = ring.pts
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ax = lift(pts[j][0]), ay = lift(pts[j][1]), bx = lift(pts[i][0]), by = lift(pts[i][1])
      const seg: ExactSegment = {
        ax, ay, bx, by,
        minX: ax < bx ? ax : bx, maxX: ax > bx ? ax : bx,
        minY: ay < by ? ay : by, maxY: ay > by ? ay : by,
        ring: ringIndex, edge: i,
      }
      segments.push(seg)
      if (first) { minX = seg.minX; maxX = seg.maxX; minY = seg.minY; maxY = seg.maxY; first = false }
      else {
        if (seg.minX < minX) minX = seg.minX; if (seg.maxX > maxX) maxX = seg.maxX
        if (seg.minY < minY) minY = seg.minY; if (seg.maxY > maxY) maxY = seg.maxY
      }
    }
  })
  return { shift, unit, segments, minX, minY, maxX, maxY }
}

/** mm → integer units, exact for any float mm. */
export const toUnits = (mm: number, c: ExactContour): bigint => {
  const { mantissa, exponent } = floatParts(mm)
  const e = exponent + c.shift
  if (e < 0) throw new Error('toUnits: value finer than the contour unit')
  return mantissa * (BigInt(1) << BigInt(e))
}

/** integer units → exact rational mm. */
export const toMM = (units: bigint, c: ExactContour): ExactRational => rational(units, c.unit)

/**
 * Exact squared distance from an integer point to a segment, as a rational
 * (the foot of the perpendicular is rational in the segment parameter).
 */
export function segmentDist2(px: bigint, py: bigint, s: ExactSegment): ExactRational {
  const dx = s.bx - s.ax, dy = s.by - s.ay
  const len2 = dx * dx + dy * dy
  const wx = px - s.ax, wy = py - s.ay
  if (len2 === BigInt(0)) return rational(wx * wx + wy * wy, BigInt(1))
  const t = wx * dx + wy * dy // parameter numerator; t/len2 ∈ [0,1] means foot is interior
  if (t <= BigInt(0)) return rational(wx * wx + wy * wy, BigInt(1))
  if (t >= len2) { const ex = px - s.bx, ey = py - s.by; return rational(ex * ex + ey * ey, BigInt(1)) }
  // perpendicular distance² = cross² / len2, exact
  const cross = wx * dy - wy * dx
  return rational(cross * cross, len2)
}

/** Exact squared distance to the nearest boundary feature, plus which segments bind it. */
export function nearestDist2(px: bigint, py: bigint, c: ExactContour): { d2: ExactRational; binding: ExactSegment[] } {
  let best: ExactRational | null = null
  let binding: ExactSegment[] = []
  for (const s of c.segments) {
    // Exact prescreen: the segment's bbox is at least this far — skip when provably farther than best.
    if (best) {
      const dx = px < s.minX ? s.minX - px : px > s.maxX ? px - s.maxX : BigInt(0)
      const dy = py < s.minY ? s.minY - py : py > s.maxY ? py - s.maxY : BigInt(0)
      if ((dx * dx + dy * dy) * best.d > best.n) continue
    }
    const d2 = segmentDist2(px, py, s)
    if (!best) { best = d2; binding = [s]; continue }
    const l = d2.n * best.d, r = best.n * d2.d
    if (l < r) { best = d2; binding = [s] }
    else if (l === r) binding.push(s)
  }
  return { d2: best ?? rational(BigInt(0), BigInt(1)), binding }
}

/** Even-odd ray parity against all rings — exact integer crossing test. */
export function insideContour(px: bigint, py: bigint, c: ExactContour): boolean {
  let inside = false
  for (const s of c.segments) {
    const { ax, ay, bx, by } = s
    if ((ay > py) === (by > py)) continue
    // x of the edge at height py, compared without division: px < ax + (py-ay)*(bx-ax)/(by-ay)
    const num = (py - ay) * (bx - ax)
    const den = by - ay
    const lhs = (px - ax) * den
    const crosses = den > BigInt(0) ? lhs < num : lhs > num
    if (crosses) inside = !inside
  }
  return inside
}

export const ptFromUnits = (px: bigint, py: bigint, c: ExactContour): Pt => [Number(px) / Number(c.unit), Number(py) / Number(c.unit)]

/**
 * A certified spatial index over the supplied segments. Buckets are integer cells, so membership is
 * decided by exact integer arithmetic and never by a float or a tolerance. `near` returns every
 * segment that CAN be within a radius of a point box; a segment it omits is provably farther,
 * because its bounding box lies entirely outside the queried box. It therefore prunes work without
 * changing any answer — the same set of binding features survives, found by looking at a
 * neighbourhood instead of at the whole contour.
 */
export interface SegmentIndex {
  readonly cell: bigint
  readonly buckets: ReadonlyMap<string, readonly ExactSegment[]>
  readonly all: readonly ExactSegment[]
}

const cellKey = (ix: bigint, iy: bigint) => `${ix},${iy}`
const cellOf = (v: bigint, cell: bigint) => (v >= BigInt(0) ? v / cell : -((-v + cell - BigInt(1)) / cell))

/** The caller passes the exact segments its own decisions are measured against, so an index can
 *  never answer for a different orientation or feature set than the one in play. */
export function segmentIndex(segments: readonly ExactSegment[], cell: bigint): SegmentIndex {
  const size = cell > BigInt(0) ? cell : BigInt(1)
  const buckets = new Map<string, ExactSegment[]>()
  for (const s of segments) {
    for (let ix = cellOf(s.minX, size); ix <= cellOf(s.maxX, size); ix++) {
      for (let iy = cellOf(s.minY, size); iy <= cellOf(s.maxY, size); iy++) {
        const key = cellKey(ix, iy)
        const list = buckets.get(key)
        if (list) list.push(s); else buckets.set(key, [s])
      }
    }
  }
  return { cell: size, buckets, all: segments }
}

/**
 * Every segment that can lie within `radius` of the integer box [x0,x1]×[y0,y1]. Omitted segments
 * have their whole bounding box outside the expanded box, so their distance exceeds the radius.
 */
export function nearSegments(index: SegmentIndex, x0: bigint, y0: bigint, x1: bigint, y1: bigint, radius: bigint): ExactSegment[] {
  const lo = { x: x0 - radius, y: y0 - radius }, hi = { x: x1 + radius, y: y1 + radius }
  const found = new Set<ExactSegment>()
  for (let ix = cellOf(lo.x, index.cell); ix <= cellOf(hi.x, index.cell); ix++) {
    for (let iy = cellOf(lo.y, index.cell); iy <= cellOf(hi.y, index.cell); iy++) {
      const list = index.buckets.get(cellKey(ix, iy))
      if (!list) continue
      for (const s of list) {
        if (s.maxX < lo.x || s.minX > hi.x || s.maxY < lo.y || s.minY > hi.y) continue
        found.add(s)
      }
    }
  }
  return [...found]
}

/** Exact lower bound on the distance between two integer bounding boxes, squared. */
export function boxGap2(a: ExactSegment, b: ExactSegment): bigint {
  const dx = a.minX > b.maxX ? a.minX - b.maxX : b.minX > a.maxX ? b.minX - a.maxX : BigInt(0)
  const dy = a.minY > b.maxY ? a.minY - b.maxY : b.minY > a.maxY ? b.minY - a.maxY : BigInt(0)
  return dx * dx + dy * dy
}
