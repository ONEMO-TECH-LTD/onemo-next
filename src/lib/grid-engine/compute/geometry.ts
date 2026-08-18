// grid-engine/compute/geometry.ts — the exact predicate, and nothing else.
//
// One question, answered exactly: does a disc of radius r, centred at p, lie
// completely inside this outline? Tangency counts as inside — a disc touching
// the boundary is legal, because the material reaches exactly that far.
//
// Everything is integer arithmetic on a fixed quantum. No square roots, no
// epsilon, no tolerance. Distance comparisons are done squared, in BigInt, so
// "exactly 12mm" compares equal instead of nearly equal.
//
// This module knows nothing about magnets, bands, grids or ONEMO. It takes a
// ring and a radius and answers a geometric question.

/** A point. Millimetres at the public edge, integer quanta inside. */
export type Pt = readonly [number, number]

export interface Box {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export interface Prepared {
  /** Size of one integer step, in millimetres. */
  readonly quantumMM: number
  /** The ring in integer quanta, duplicate-free, at least three vertices. */
  readonly ring: readonly Pt[]
  /** Bounds in integer quanta. */
  readonly box: Box
}

const big = (n: number): bigint => BigInt(n)
/** This project targets ES2017, where BigInt LITERALS (`0n`) do not compile. */
const ZERO = BigInt(0)

/** Twice the signed area of the triangle abc. Sign gives the turn direction. */
function orient(a: Pt, b: Pt, c: Pt): bigint {
  return big(b[0] - a[0]) * big(c[1] - a[1]) - big(b[1] - a[1]) * big(c[0] - a[0])
}

/** p lies on the closed segment ab. */
function onSegment(p: Pt, a: Pt, b: Pt): boolean {
  if (orient(a, b, p) !== ZERO) return false
  return (
    p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) &&
    p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1])
  )
}

/**
 * Quantise a millimetre ring to integer quanta and drop repeated vertices.
 *
 * Throws rather than guesses: a ring that collapses below three distinct
 * vertices, or encloses no area, is not a shape this can answer about.
 */
export function prepare(ringMM: readonly Pt[], quantumMM = 0.001): Prepared {
  if (!(quantumMM > 0) || !Number.isFinite(quantumMM)) {
    throw new RangeError('quantum must be finite and positive')
  }
  const scaled: Pt[] = []
  for (const [x, y] of ringMM) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError('outline contains a non-finite coordinate')
    }
    const p: Pt = [Math.round(x / quantumMM), Math.round(y / quantumMM)]
    const last = scaled[scaled.length - 1]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) scaled.push(p)
  }
  const first = scaled[0]
  const last = scaled[scaled.length - 1]
  if (first && last && scaled.length > 1 && first[0] === last[0] && first[1] === last[1]) scaled.pop()
  if (scaled.length < 3) throw new RangeError('outline needs at least three distinct vertices')

  let twiceArea = ZERO
  for (let i = 0; i < scaled.length; i++) {
    const a = scaled[i]!
    const b = scaled[(i + 1) % scaled.length]!
    twiceArea += big(a[0]) * big(b[1]) - big(b[0]) * big(a[1])
  }
  if (twiceArea === ZERO) throw new RangeError('outline encloses no area')

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of scaled) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { quantumMM, ring: Object.freeze(scaled), box: { minX, minY, maxX, maxY } }
}

export type Location = 'IN' | 'OUT' | 'ON'

/** Exact location of an integer point against the ring. Winding, no tolerance. */
export function locate(shape: Prepared, p: Pt): Location {
  const { ring, box } = shape
  if (p[0] < box.minX || p[0] > box.maxX || p[1] < box.minY || p[1] > box.maxY) return 'OUT'
  let winding = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    if (onSegment(p, a, b)) return 'ON'
    if (a[1] <= p[1]) {
      if (b[1] > p[1] && orient(a, b, p) > ZERO) winding++
    } else if (b[1] <= p[1] && orient(a, b, p) < ZERO) winding--
  }
  return winding === 0 ? 'OUT' : 'IN'
}

/**
 * Is the squared distance from p to segment ab at least r²?
 *
 * Three cases, all exact: p projects before a, after b, or onto the segment's
 * interior — where the perpendicular distance is |cross| / |v|, so the test
 * becomes cross² >= r²·|v|² with no division and no root.
 */
function atLeast(p: Pt, a: Pt, b: Pt, r2: bigint): boolean {
  const vx = big(b[0] - a[0]), vy = big(b[1] - a[1])
  const wx = big(p[0] - a[0]), wy = big(p[1] - a[1])
  const dot = wx * vx + wy * vy
  if (dot <= ZERO) return wx * wx + wy * wy >= r2
  const len2 = vx * vx + vy * vy
  if (dot >= len2) {
    const ux = big(p[0] - b[0]), uy = big(p[1] - b[1])
    return ux * ux + uy * uy >= r2
  }
  const cross = vx * wy - vy * wx
  return cross * cross >= r2 * len2
}

/**
 * Does the closed disc of radius `radius` (in quanta) centred at `p` lie wholly
 * inside the outline?
 *
 * A centre exactly `radius` from the nearest edge PASSES — the disc is tangent
 * to the boundary and every part of it is on material. This is the whole reason
 * the arithmetic is integer: at 12.000000000mm the comparison must be equal, not
 * nearly equal.
 */
export function holds(shape: Prepared, p: Pt, radius: number): boolean {
  if (locate(shape, p) === 'OUT') return false
  const r2 = big(radius) * big(radius)
  const { ring } = shape
  for (let i = 0; i < ring.length; i++) {
    if (!atLeast(p, ring[i]!, ring[(i + 1) % ring.length]!, r2)) return false
  }
  return true
}

/** Uniform scale about the bounding-box centre so the longest side is `longestMM`. */
export function scaleRing(ringMM: readonly Pt[], longestMM: number): Pt[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ringMM) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const longest = Math.max(maxX - minX, maxY - minY)
  if (!(longest > 0)) throw new RangeError('outline has no extent')
  const k = longestMM / longest
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return ringMM.map(([x, y]) => [(x - cx) * k, (y - cy) * k] as Pt)
}
