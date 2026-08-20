// Neutral exact clearance kernel. The supplied contour is lifted losslessly to BigInt integer
// units (every finite float is m·2^e — one common power of two makes them all integers, no
// rounding, no policy quantum). Squared distances are then exact integers; sign and ordering
// decisions never touch a float.

import type { Contour, Pt, Rational } from '../spec'
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
  if (value === 0) return { mantissa: 0n, exponent: 0 }
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  const bits = view.getBigUint64(0)
  const sign = bits >> 63n === 1n ? -1n : 1n
  const exp = Number((bits >> 52n) & 0x7ffn)
  const frac = bits & 0xfffffffffffffn
  const mantissa = exp === 0 ? frac : (1n << 52n) | frac
  const exponent = exp === 0 ? -1074 : exp - 1075
  // strip trailing zero bits so the common shift stays small
  let m = mantissa, e = exponent
  while (m !== 0n && (m & 1n) === 0n) { m >>= 1n; e += 1 }
  return { mantissa: sign * m, exponent: e }
}

/** Lift a supplied contour (outer + holes) to exact integer geometry. */
export function exactContour(contour: Contour): ExactContour {
  const rings = [contour.outer, ...contour.holes]
  let shift = 0
  for (const ring of rings) for (const [x, y] of ring.pts) {
    shift = Math.max(shift, -floatParts(x).exponent, -floatParts(y).exponent)
  }
  const unit = 1n << BigInt(shift)
  const lift = (v: number): bigint => {
    const { mantissa, exponent } = floatParts(v)
    return mantissa * (1n << BigInt(exponent + shift))
  }
  const segments: ExactSegment[] = []
  let minX = 0n, minY = 0n, maxX = 0n, maxY = 0n
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
  return mantissa * (1n << BigInt(e))
}

/** integer units → exact rational mm. */
export const toMM = (units: bigint, c: ExactContour): Rational => rational(units, c.unit)

/**
 * Exact squared distance from an integer point to a segment, as a rational
 * (the foot of the perpendicular is rational in the segment parameter).
 */
export function segmentDist2(px: bigint, py: bigint, s: ExactSegment): Rational {
  const dx = s.bx - s.ax, dy = s.by - s.ay
  const len2 = dx * dx + dy * dy
  const wx = px - s.ax, wy = py - s.ay
  if (len2 === 0n) return rational(wx * wx + wy * wy, 1n)
  const t = wx * dx + wy * dy // parameter numerator; t/len2 ∈ [0,1] means foot is interior
  if (t <= 0n) return rational(wx * wx + wy * wy, 1n)
  if (t >= len2) { const ex = px - s.bx, ey = py - s.by; return rational(ex * ex + ey * ey, 1n) }
  // perpendicular distance² = cross² / len2, exact
  const cross = wx * dy - wy * dx
  return rational(cross * cross, len2)
}

/** Exact squared distance to the nearest boundary feature, plus which segments bind it. */
export function nearestDist2(px: bigint, py: bigint, c: ExactContour): { d2: Rational; binding: ExactSegment[] } {
  let best: Rational | null = null
  let binding: ExactSegment[] = []
  for (const s of c.segments) {
    const d2 = segmentDist2(px, py, s)
    if (!best) { best = d2; binding = [s]; continue }
    const l = d2.n * best.d, r = best.n * d2.d
    if (l < r) { best = d2; binding = [s] }
    else if (l === r) binding.push(s)
  }
  return { d2: best ?? rational(0n, 1n), binding }
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
    const crosses = den > 0n ? lhs < num : lhs > num
    if (crosses) inside = !inside
  }
  return inside
}

export const ptFromUnits = (px: bigint, py: bigint, c: ExactContour): Pt => [Number(px) / Number(c.unit), Number(py) / Number(c.unit)]
