// M3 — THE CANONICAL MATERIAL REGION. Blueprint §3, implemented clause by clause.
//
// §3.1: exactly one simple closed polygon. The upstream tracer supplies one solid outline and drops
// holes (Dan, 08-10: "it becomes a solid blob"), so hole semantics are not invented here — a
// degenerate input is REFUSED, never repaired into an answer (G2).
//
// §3.2: canonicalisation without changing geometry — winding and start-index changes become
// byte-identical, and every non-duplicate vertex survives exactly. Nothing is simplified.
//
// §3.3: the immutable edge kernel and the one predicate everything rests on:
//   supported(q) ⇔ clearanceP(q) ≥ R — the whole disc on material (L2), boundary CLOSED, no epsilon.
//   Tangency is lawful: the square's own canon publishes at clearance exactly 12.000.

import type { BoxMM, PointMM, UnsupportedOutlineReason } from './contract'

export interface OutlineEdge {
  readonly a: PointMM
  readonly b: PointMM
  readonly dx: number
  readonly dy: number
  readonly lengthSq: number
  readonly bbox: BoxMM
}

export interface CanonicalOutline {
  /** §3.2: counter-clockwise, rotated to the lexicographically smallest vertex. */
  readonly points: readonly PointMM[]
  readonly edges: readonly OutlineEdge[]
  readonly bboxMM: BoxMM
  readonly longestSideMM: number
}

export type CanonicalisationOutcome =
  | { readonly ok: true; readonly outline: CanonicalOutline }
  | { readonly ok: false; readonly reason: UnsupportedOutlineReason }

/** §3.2 step 3: the exact shoelace-area sign. Twice the signed area; sign is all we need. */
function signedAreaTwice(points: readonly PointMM[]): number {
  let sum = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j][0] * points[i][1] - points[i][0] * points[j][1]
  }
  return sum
}

/** §3.2 step 4's comparator: lexicographic (x, y). */
function lexLess(a: PointMM, b: PointMM): boolean {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])
}

/** Proper segment intersection for the §3.1 self-intersection refusal. Shared endpoints excluded. */
function segmentsCross(p1: PointMM, p2: PointMM, p3: PointMM, p4: PointMM): boolean {
  const d = (o: PointMM, a: PointMM, b: PointMM) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const d1 = d(p3, p4, p1)
  const d2 = d(p3, p4, p2)
  const d3 = d(p1, p2, p3)
  const d4 = d(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/**
 * §3.1 + §3.2. Refuses before it repairs; canonicalises without changing geometry.
 */
export function canonicaliseOutline(input: readonly PointMM[]): CanonicalisationOutcome {
  // §3.1: every coordinate finite.
  for (const [x, y] of input) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { ok: false, reason: 'non-finite-coordinate' }
    }
  }

  // §3.2 step 1: drop a repeated closing vertex and consecutive duplicates. Coordinates untouched.
  const stripped: PointMM[] = []
  for (const p of input) {
    const last = stripped[stripped.length - 1]
    if (last && last[0] === p[0] && last[1] === p[1]) continue
    stripped.push(p)
  }
  while (
    stripped.length > 1 &&
    stripped[0][0] === stripped[stripped.length - 1][0] &&
    stripped[0][1] === stripped[stripped.length - 1][1]
  ) {
    stripped.pop()
  }

  // §3.1: fewer than three DISTINCT vertices is not a polygon.
  if (stripped.length < 3) return { ok: false, reason: 'fewer-than-three-vertices' }

  // §3.1: zero signed area is a line, not material.
  const area2 = signedAreaTwice(stripped)
  if (area2 === 0) return { ok: false, reason: 'zero-area' }

  // §3.2 step 3: orient counter-clockwise. Screen frame is y-down, where CCW area is negative in
  // the usual shoelace convention; the blueprint's own harness treats positive area as CCW in the
  // abstract plane, so we normalise on the SIGN and record the convention once, here: after this
  // block, signedAreaTwice(points) > 0.
  const ccw = area2 > 0 ? [...stripped] : [...stripped].reverse()

  // §3.1: self-intersection is refused. O(n²) over edges, shared endpoints excluded — exactness
  // over speed; this runs once per frozen outline (L16), never on interaction.
  const n = ccw.length
  for (let i = 0; i < n; i++) {
    const a1 = ccw[i]
    const a2 = ccw[(i + 1) % n]
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue // adjacent through the wrap
      const b1 = ccw[j]
      const b2 = ccw[(j + 1) % n]
      if (segmentsCross(a1, a2, b1, b2)) return { ok: false, reason: 'self-intersection' }
    }
  }

  // §3.2 step 4: rotate to the lexicographically smallest vertex; ties broken by the following
  // sequence. Ties are resolved by comparing forward from each candidate.
  let start = 0
  for (let i = 1; i < n; i++) {
    if (lexLess(ccw[i], ccw[start])) start = i
    else if (ccw[i][0] === ccw[start][0] && ccw[i][1] === ccw[start][1]) {
      // exact duplicate coordinates elsewhere in the ring: compare following sequences
      for (let k = 1; k < n; k++) {
        const a = ccw[(i + k) % n]
        const b = ccw[(start + k) % n]
        if (a[0] === b[0] && a[1] === b[1]) continue
        if (lexLess(a, b)) start = i
        break
      }
    }
  }
  const points: PointMM[] = []
  for (let i = 0; i < n; i++) points.push(ccw[(start + i) % n])

  // §3.3: the immutable edge kernel, prepared once.
  const edges: OutlineEdge[] = []
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    edges.push({
      a,
      b,
      dx,
      dy,
      lengthSq: dx * dx + dy * dy,
      bbox: {
        x0: Math.min(a[0], b[0]),
        y0: Math.min(a[1], b[1]),
        x1: Math.max(a[0], b[0]),
        y1: Math.max(a[1], b[1]),
      },
    })
  }

  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const bboxMM: BoxMM = {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  }

  return {
    ok: true,
    outline: {
      points,
      edges,
      bboxMM,
      // G1: scale is relative to the OUTLINE's own longest side — transparent image margin is not
      // the shape and never enters the measurement.
      longestSideMM: Math.max(bboxMM.x1 - bboxMM.x0, bboxMM.y1 - bboxMM.y0),
    },
  }
}

/** §3.3: exact point-to-segment distance — the clamped projection, no library. */
export function distanceToEdge(x: PointMM, e: OutlineEdge): number {
  const t = e.lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((x[0] - e.a[0]) * e.dx + (x[1] - e.a[1]) * e.dy) / e.lengthSq))
  const px = e.a[0] + t * e.dx
  const py = e.a[1] + t * e.dy
  return Math.hypot(x[0] - px, x[1] - py)
}

/** §3.3: exact even-odd point-in-polygon against P. */
export function insideOutline(x: PointMM, outline: CanonicalOutline): boolean {
  let c = false
  const pts = outline.points
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > x[1] !== yj > x[1] && x[0] < ((xj - xi) * (x[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/**
 * §3.3: signed clearance — positive inside, negative outside, distance to the nearest boundary.
 * The one primitive the whole engine stands on.
 */
export function clearanceMM(x: PointMM, outline: CanonicalOutline): number {
  let min = Infinity
  for (const e of outline.edges) {
    const d = distanceToEdge(x, e)
    if (d < min) min = d
  }
  return insideOutline(x, outline) ? min : min === 0 ? 0 : -min
}

/**
 * §3.3: supported(q) ⇔ clearanceP(q) ≥ R. CLOSED comparison, no epsilon — tangency is lawful,
 * which is what lets the square publish at exactly 72/120 with clearance exactly the padding.
 */
export function supported(q: PointMM, outline: CanonicalOutline, paddingMM: number): boolean {
  return clearanceMM(q, outline) >= paddingMM
}
