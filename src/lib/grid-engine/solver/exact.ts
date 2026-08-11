// EXACT PREDICATES — blueprint §9: "filtered robust predicates with exact fallback for
// orientation, intersection, tangency and equality. Exact fallback is necessary because the
// canonical square answer is tangency at clearance exactly 12mm; an epsilon would change a lawful
// answer."
//
// The filter: evaluate in doubles with a forward error bound; when the magnitude clears the bound
// the sign is provably correct and the double answer stands. Otherwise fall back to EXACT integer
// arithmetic — every input coordinate is a finite decimal (traced pixels), so it converts to a
// scaled BigInt with no loss, and a BigInt determinant has no rounding at all.

import type { PointMM } from './contract'

// BigInt CONSTRUCTOR calls, not literals: the repo targets ES2017, where the `0n` literal syntax is
// a compile error while the BigInt type itself (lib: esnext) and runtime are fully available.
const BIG_ZERO = BigInt(0)
const BIG_TEN = BigInt(10)

/** A finite decimal as an exact scaled integer: value = mantissa · 10^-exponent10. */
interface ScaledInt {
  readonly mantissa: bigint
  readonly exponent10: number
}

/** Exact conversion — decomposes the number's own decimal text, so nothing is rounded. */
export function toScaledInt(value: number): ScaledInt {
  if (!Number.isFinite(value)) throw new RangeError('exact predicate on a non-finite value')
  const negative = value < 0 || Object.is(value, -0)
  const [coeff, expText] = Math.abs(value).toExponential().split('e')
  const exp = Number(expText)
  const [whole, frac = ''] = coeff.split('.')
  const digits = BigInt(whole + frac)
  const exponent10 = frac.length - exp
  return { mantissa: negative ? -digits : digits, exponent10 }
}

/** Bring two scaled ints to a common scale, exactly. */
function align(a: ScaledInt, b: ScaledInt): readonly [bigint, bigint] {
  if (a.exponent10 === b.exponent10) return [a.mantissa, b.mantissa]
  if (a.exponent10 > b.exponent10) {
    return [a.mantissa, b.mantissa * BIG_TEN ** BigInt(a.exponent10 - b.exponent10)]
  }
  return [a.mantissa * BIG_TEN ** BigInt(b.exponent10 - a.exponent10), b.mantissa]
}

const subExact = (a: ScaledInt, b: ScaledInt): ScaledInt => {
  const [x, y] = align(a, b)
  return { mantissa: x - y, exponent10: Math.max(a.exponent10, b.exponent10) }
}

const mulExact = (a: ScaledInt, b: ScaledInt): ScaledInt => ({
  mantissa: a.mantissa * b.mantissa,
  exponent10: a.exponent10 + b.exponent10,
})

const signOf = (v: ScaledInt): -1 | 0 | 1 => (v.mantissa < BIG_ZERO ? -1 : v.mantissa > BIG_ZERO ? 1 : 0)

/**
 * ORIENTATION — the sign of the cross product (b−a) × (c−a). Filtered: the double path carries a
 * standard forward error bound (Shewchuk's ccwerrboundA form); inside the bound, exact BigInt.
 */
export function orientation(a: PointMM, b: PointMM, c: PointMM): -1 | 0 | 1 {
  const detLeft = (b[0] - a[0]) * (c[1] - a[1])
  const detRight = (b[1] - a[1]) * (c[0] - a[0])
  const det = detLeft - detRight
  const detSum = Math.abs(detLeft) + Math.abs(detRight)
  // 3.33e-16 ≈ (3 + 16ε)ε for IEEE doubles — the standard filter bound.
  if (Math.abs(det) > 3.3306690738754716e-16 * detSum) return det > 0 ? 1 : -1
  // Exact fallback.
  const ax = toScaledInt(a[0]); const ay = toScaledInt(a[1])
  const bx = toScaledInt(b[0]); const by = toScaledInt(b[1])
  const cx = toScaledInt(c[0]); const cy = toScaledInt(c[1])
  return signOf(
    subExact(
      mulExact(subExact(bx, ax), subExact(cy, ay)),
      mulExact(subExact(by, ay), subExact(cx, ax)),
    ),
  )
}

/** Exact coordinate equality — doubles compare exactly by IEEE, so === is already exact here. */
export const samePoint = (a: PointMM, b: PointMM): boolean => a[0] === b[0] && a[1] === b[1]

/** Is c on the CLOSED segment [a,b]? Exact: collinear by orientation, then bound by coordinates. */
export function onSegment(a: PointMM, b: PointMM, c: PointMM): boolean {
  // bbox reject FIRST — exact and free. A point outside the segment's closed bounding box cannot
  // be on it, and this guard removes ~99% of orientation calls from the boundary loop (the
  // point-in-polygon hot path on 6k-edge traces).
  if (
    c[0] < Math.min(a[0], b[0]) || c[0] > Math.max(a[0], b[0]) ||
    c[1] < Math.min(a[1], b[1]) || c[1] > Math.max(a[1], b[1])
  ) return false
  if (orientation(a, b, c) !== 0) return false
  return (
    Math.min(a[0], b[0]) <= c[0] &&
    c[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= c[1] &&
    c[1] <= Math.max(a[1], b[1])
  )
}

/**
 * COMPLETE closed-segment intersection classification — §3.1 needs "one simple closed polygon",
 * which proper-crossing detection alone cannot prove: collinear overlap, T-touches and endpoint
 * contact all break simplicity without any proper crossing. Every contact class is classified.
 */
export function segmentsIntersect(
  p1: PointMM,
  p2: PointMM,
  p3: PointMM,
  p4: PointMM,
): 'none' | 'proper' | 'touch' | 'overlap' {
  const d1 = orientation(p3, p4, p1)
  const d2 = orientation(p3, p4, p2)
  const d3 = orientation(p1, p2, p3)
  const d4 = orientation(p1, p2, p4)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return 'proper'
  }

  // Collinear cases: overlap when the 1-D projections share more than a point.
  if (d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0) {
    const [lo1, hi1] = p1[0] === p2[0] ? [Math.min(p1[1], p2[1]), Math.max(p1[1], p2[1])] : [Math.min(p1[0], p2[0]), Math.max(p1[0], p2[0])]
    const [lo2, hi2] = p1[0] === p2[0] ? [Math.min(p3[1], p4[1]), Math.max(p3[1], p4[1])] : [Math.min(p3[0], p4[0]), Math.max(p3[0], p4[0])]
    const lo = Math.max(lo1, lo2)
    const hi = Math.min(hi1, hi2)
    if (lo > hi) return 'none'
    return lo === hi ? 'touch' : 'overlap'
  }

  // Endpoint / T-touch cases.
  if (d1 === 0 && onSegment(p3, p4, p1)) return 'touch'
  if (d2 === 0 && onSegment(p3, p4, p2)) return 'touch'
  if (d3 === 0 && onSegment(p1, p2, p3)) return 'touch'
  if (d4 === 0 && onSegment(p1, p2, p4)) return 'touch'
  return 'none'
}

/**
 * Point-in-polygon with EXACT boundary decisions (§3.3's "exact point-in-polygon"): a point ON the
 * boundary is classified 'boundary' by the exact onSegment test before any ray is cast, so the
 * crossing count never has to make the call an epsilon would corrupt.
 */
export function pointInPolygon(
  x: PointMM,
  points: readonly PointMM[],
): 'inside' | 'outside' | 'boundary' {
  const n = points.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (onSegment(points[j], points[i], x)) return 'boundary'
  }
  let crossings = 0
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [, yi] = points[i]
    const [, yj] = points[j]
    if (yi > x[1] === yj > x[1]) continue
    // The edge straddles the horizontal line through x. Which side is the crossing on? Decided by
    // the exact orientation of the edge against x — no division, no rounding.
    const upward = yj < yi
    const o = orientation(points[j], points[i], x)
    if ((upward && o > 0) || (!upward && o < 0)) crossings++
  }
  return crossings % 2 === 1 ? 'inside' : 'outside'
}


/**
 * EXACT signed-area SIGN of a ring — §3.1's zero-area refusal and §3.2's winding decision may not
 * ride on a float shoelace: cancellation near zero is precisely where the answer matters. Summed
 * exactly in scaled integers; the sign is the whole answer.
 */
export function signedAreaSign(points: readonly PointMM[]): -1 | 0 | 1 {
  let mantissa = BIG_ZERO
  let exponent10 = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const term = subExact(
      mulExact(toScaledInt(points[j][0]), toScaledInt(points[i][1])),
      mulExact(toScaledInt(points[i][0]), toScaledInt(points[j][1])),
    )
    if (exponent10 === term.exponent10) mantissa += term.mantissa
    else if (exponent10 > term.exponent10) mantissa += term.mantissa * BIG_TEN ** BigInt(exponent10 - term.exponent10)
    else { mantissa = mantissa * BIG_TEN ** BigInt(term.exponent10 - exponent10) + term.mantissa; exponent10 = term.exponent10 }
  }
  return mantissa < BIG_ZERO ? -1 : mantissa > BIG_ZERO ? 1 : 0
}

/**
 * EXACT support decision — §9: tangency is a lawful answer, so the comparison dist(q, boundary) ≥ R
 * cannot ride on Math.hypot. Compared as SQUARED distance against R², in exact scaled integers,
 * with the projection parameter handled as an exact rational (t = dot/len², cleared of the
 * denominator before comparing). Returns the sign of dist² − R².
 *
 * For one segment [a,b] and point q with d = b − a:
 *   t* = ((q−a)·d) / |d|²  clamped to [0,1]
 *   interior: |q−a|²·|d|² − ((q−a)·d)²  vs  R²·|d|²   (both sides exact integers)
 *   endpoint: |q−v|²  vs  R²
 */
/**
 * §9: FILTERED robust predicate with exact fallback — the sign of dist(q,[a,b])² − r².
 *
 * The filter, per branch: evaluate the deciding expression D in doubles, alongside a magnitude M
 * that is the SAME expression with every subtraction made an addition of absolute values. Forward
 * error analysis bounds the accumulated rounding of D by C·ε·M, where ε = 2⁻⁵² and C is a stated
 * combinatorial constant safely above the operation depth of the branch (≤6 rounding steps per term
 * path for the endpoint branch, ≤12 for the interior branch; C is taken at 16 and 64 respectively —
 * DELIBERATELY LOOSE, because a loose-but-valid bound only routes more cases to the exact path and
 * can never produce a wrong sign; there is no tuned epsilon anywhere in the decision).
 * |D| > C·ε·M ⇒ the double sign is provably correct. Otherwise: exact scaled-integer arithmetic
 * from the RAW coordinates.
 */
const EPS = Number.EPSILON
const FILTER_C_ENDPOINT = 16
const FILTER_C_INTERIOR = 64

export function segmentDistanceSqCmp(q: PointMM, a: PointMM, b: PointMM, r: number): -1 | 0 | 1 {
  // ---- fast filtered path, doubles ----
  const fqax = q[0] - a[0]
  const fqay = q[1] - a[1]
  const fdx = b[0] - a[0]
  const fdy = b[1] - a[1]
  const flenSq = fdx * fdx + fdy * fdy
  const fdot = fqax * fdx + fqay * fdy

  if (flenSq === 0 || fdot <= 0) {
    const D = fqax * fqax + fqay * fqay - r * r
    const M = fqax * fqax + fqay * fqay + r * r
    if (Math.abs(D) > FILTER_C_ENDPOINT * EPS * M) return D > 0 ? 1 : -1
  } else if (fdot >= flenSq) {
    const fqbx = q[0] - b[0]
    const fqby = q[1] - b[1]
    const D = fqbx * fqbx + fqby * fqby - r * r
    const M = fqbx * fqbx + fqby * fqby + r * r
    if (Math.abs(D) > FILTER_C_ENDPOINT * EPS * M) return D > 0 ? 1 : -1
  } else {
    const fcross = fqax * fdy - fqay * fdx
    const D = fcross * fcross - r * r * flenSq
    const M = fcross * fcross + r * r * flenSq
    if (Math.abs(D) > FILTER_C_INTERIOR * EPS * M) return D > 0 ? 1 : -1
  }
  // NOTE the regime itself (endpoint vs interior) is decided by the float dot/lenSq comparisons; at
  // their equality boundaries the two formulas agree by continuity, so a misclassified borderline
  // regime cannot change the exact sign computed below.

  // ---- exact fallback, scaled integers from the raw inputs ----
  const qax = subExact(toScaledInt(q[0]), toScaledInt(a[0]))
  const qay = subExact(toScaledInt(q[1]), toScaledInt(a[1]))
  const dx = subExact(toScaledInt(b[0]), toScaledInt(a[0]))
  const dy = subExact(toScaledInt(b[1]), toScaledInt(a[1]))
  const addE = (u: ScaledInt, v: ScaledInt): ScaledInt => {
    const [x, y] = align(u, v)
    return { mantissa: x + y, exponent10: Math.max(u.exponent10, v.exponent10) }
  }
  const rr = mulExact(toScaledInt(r), toScaledInt(r))

  const lenSq = addE(mulExact(dx, dx), mulExact(dy, dy))
  const dot = addE(mulExact(qax, dx), mulExact(qay, dy))

  if (signOf(lenSq) === 0 || signOf(dot) <= 0) {
    const distSq = addE(mulExact(qax, qax), mulExact(qay, qay))
    return signOf(subExact(distSq, rr))
  }
  if (signOf(subExact(dot, lenSq)) >= 0) {
    const qbx = subExact(toScaledInt(q[0]), toScaledInt(b[0]))
    const qby = subExact(toScaledInt(q[1]), toScaledInt(b[1]))
    const distSq = addE(mulExact(qbx, qbx), mulExact(qby, qby))
    return signOf(subExact(distSq, rr))
  }
  const cross = subExact(mulExact(qax, dy), mulExact(qay, dx))
  return signOf(subExact(mulExact(cross, cross), mulExact(rr, lenSq)))
}
