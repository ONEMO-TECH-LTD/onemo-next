// EXACT PAIR-BOX CONTAINMENT — blueprint §7.1 (the region and predicate) and §7.2 (the complete
// event set and interval construction). No monotonicity, no bisection, no millimetre walk.
//
// The placement (§5.2): T(p) = a + σ·(p − Cκ). All solve-time coordinates here are RELATIVE — the
// outline as v' = v − Cκ (source frame about the centre) and the box relative to the target a — so
// the containment question is "is b inside σ·P' ?" with P' = the centred source outline.
//
// §7.2's events, in that frame: box corner b against outline edge [v,w], d = w − v:
//     cross(d, b) − σ·cross(d, v) = 0                (A − σB = 0)
// outline vertex v against box edge [b,c], e = c − b:
//     σ·cross(e, v) − cross(e, b) = 0
// Retain σ = A/B when positive, within the ceiling, and the contact lies on both closed segments.
// Then evaluate every root and one witness per open piece with the EXACT containment test:
//   1. all four corners inside-or-on;  2. every box-edge subsegment between outline crossings has
//   an inside-or-on witness;  3. no proper crossing into exterior.

import type { BoxMM, PointMM } from './contract'
import { pointInPolygon } from './exact'

export interface ScaleInterval {
  readonly lo: number
  readonly hi: number
  /** §7.2: the exact contact that opened / closed this piece, for §7.6's binding explanation. */
  readonly openContact?: ContactRef
  readonly closeContact?: ContactRef
}

export interface ContactRef {
  readonly boxFeature: { readonly kind: 'corner' | 'edge'; readonly index: number }
  readonly outlineFeature: { readonly kind: 'vertex' | 'edge'; readonly index: number }
}

const cross2 = (a: PointMM, b: PointMM) => a[0] * b[1] - a[1] * b[0]

/** The four corners and four edges of a box, in canonical order (x0,y0)→(x1,y0)→(x1,y1)→(x0,y1). */
export function boxCorners(b: BoxMM): PointMM[] {
  return [
    [b.x0, b.y0],
    [b.x1, b.y0],
    [b.x1, b.y1],
    [b.x0, b.y1],
  ]
}

/** Scale the centred source outline by σ. */
const scaled = (centred: readonly PointMM[], sigma: number): PointMM[] =>
  centred.map(([x, y]) => [x * sigma, y * sigma])

/**
 * §7.2 exact containment of one box in σ·P′: corners inside-or-on, every box-edge subsegment
 * between boundary crossings verified, no proper crossing into exterior. Sufficient because the
 * accepted outline is one solid simple polygon (§3.1).
 */
export function boxContainedAt(box: BoxMM, centred: readonly PointMM[], sigma: number): boolean {
  const poly = scaled(centred, sigma)
  const corners = boxCorners(box)
  for (const c of corners) {
    if (pointInPolygon(c, poly) === 'outside') return false
  }
  // box edges: split at outline intersections; each open subsegment needs an inside witness
  const n = poly.length
  for (let e = 0; e < 4; e++) {
    const p = corners[e]
    const q = corners[(e + 1) % 4]
    // gather intersection parameters of segment pq with every outline edge
    const ts: number[] = [0, 1]
    for (let i = 0; i < n; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % n]
      const t = segmentIntersectionParam(p, q, a, b)
      if (t !== null && t > 0 && t < 1) ts.push(t)
    }
    ts.sort((x, y) => x - y)
    for (let i = 0; i + 1 < ts.length; i++) {
      const mid = (ts[i] + ts[i + 1]) / 2
      const w: PointMM = [p[0] + (q[0] - p[0]) * mid, p[1] + (q[1] - p[1]) * mid]
      if (pointInPolygon(w, poly) === 'outside') return false
    }
  }
  return true
}

/** Parameter t on [p,q] where it crosses [a,b], or null when parallel / off-segment. */
function segmentIntersectionParam(p: PointMM, q: PointMM, a: PointMM, b: PointMM): number | null {
  const r: PointMM = [q[0] - p[0], q[1] - p[1]]
  const s: PointMM = [b[0] - a[0], b[1] - a[1]]
  const denom = cross2(r, s)
  if (denom === 0) return null
  const ap: PointMM = [a[0] - p[0], a[1] - p[1]]
  const t = cross2(ap, s) / denom
  const u = cross2(ap, r) / denom
  if (u < 0 || u > 1) return null
  return t
}

/**
 * §7.2: the complete event set for one box against the centred outline, then the exact lawful
 * interval set I(e). Events at both vertex-edge directions; the sorted roots plus 0 and σmax
 * partition (0, σmax]; every root and one witness per open piece is evaluated with the full
 * predicate, so over-generated supporting-line roots cannot create an answer.
 */
export function containmentIntervals(
  box: BoxMM,
  centred: readonly PointMM[],
  sigmaMax: number,
): ScaleInterval[] {
  const events: Array<{ sigma: number; contact: ContactRef }> = []
  const corners = boxCorners(box)
  const n = centred.length

  // box corner b vs outline edge [v,w]:  cross(d,b) − σ·cross(d,v) = 0
  for (let ci = 0; ci < 4; ci++) {
    const b = corners[ci]
    for (let i = 0; i < n; i++) {
      const v = centred[i]
      const w = centred[(i + 1) % n]
      const d: PointMM = [w[0] - v[0], w[1] - v[1]]
      const A = cross2(d, b)
      const B = cross2(d, v)
      if (B !== 0) {
        const sigma = A / B
        if (sigma > 0 && sigma <= sigmaMax) {
          // §7.2: retain σ only when "the contact lies on both finite closed segments" — the
          // corner b must fall within the SCALED outline edge [σv, σw], not merely its line.
          // (Omitting this filter kept every supporting-line root: 52s for one duck band.)
          const sx = sigma * d[0]
          const sy = sigma * d[1]
          const t = Math.abs(sx) >= Math.abs(sy) ? (b[0] - sigma * v[0]) / sx : (b[1] - sigma * v[1]) / sy
          if (t >= 0 && t <= 1) {
            events.push({
              sigma,
              contact: { boxFeature: { kind: 'corner', index: ci }, outlineFeature: { kind: 'edge', index: i } },
            })
          }
        }
      }
      // A=B=0 (collinear at all scales): endpoint-coincidence scales on the dominant axis
      else if (A === 0) {
        for (const vert of [v, w]) {
          const dom = Math.abs(vert[0]) >= Math.abs(vert[1]) ? 0 : 1
          if (vert[dom] !== 0) {
            const sigma = b[dom] / vert[dom]
            if (sigma > 0 && sigma <= sigmaMax) {
              events.push({
                sigma,
                contact: { boxFeature: { kind: 'corner', index: ci }, outlineFeature: { kind: 'edge', index: i } },
              })
            }
          }
        }
      }
    }
  }

  // outline vertex v vs box edge [b,c]:  σ·cross(e,v) − cross(e,b) = 0
  for (let ei = 0; ei < 4; ei++) {
    const b = corners[ei]
    const c = corners[(ei + 1) % 4]
    const e: PointMM = [c[0] - b[0], c[1] - b[1]]
    for (let i = 0; i < n; i++) {
      const v = centred[i]
      const B = cross2(e, v)
      const A = cross2(e, b)
      if (B !== 0) {
        const sigma = A / B
        if (sigma > 0 && sigma <= sigmaMax) {
          // §7.2's same finite-segment condition, other direction: the SCALED vertex σv must fall
          // within the box edge's closed span.
          const px = sigma * v[0]
          const py = sigma * v[1]
          const within =
            Math.min(b[0], c[0]) <= px && px <= Math.max(b[0], c[0]) &&
            Math.min(b[1], c[1]) <= py && py <= Math.max(b[1], c[1])
          if (within) {
            events.push({
              sigma,
              contact: { boxFeature: { kind: 'edge', index: ei }, outlineFeature: { kind: 'vertex', index: i } },
            })
          }
        }
      }
    }
  }

  // partition and label
  const sigmas = [...new Set(events.map((e) => e.sigma))].sort((a, b) => a - b)
  const contactAt = (s: number): ContactRef | undefined => events.find((e) => e.sigma === s)?.contact

  const lawfulAt = (s: number) => s > 0 && boxContainedAt(box, centred, s)
  const pieces: Array<{ lo: number; hi: number; lawful: boolean }> = []
  let prev = 0
  for (const s of [...sigmas, sigmaMax]) {
    if (s > prev) {
      const witness = prev === 0 ? s / 2 : (prev + s) / 2
      pieces.push({ lo: prev, hi: s, lawful: lawfulAt(witness) })
    }
    prev = s
  }

  // merge adjacent lawful pieces; keep isolated lawful contact points; attach opening/closing contacts
  const out: ScaleInterval[] = []
  let openLo: number | null = null
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]
    const boundaryLawful = lawfulAt(piece.hi)
    if (piece.lawful && openLo === null) openLo = piece.lo
    const nextLawful = i + 1 < pieces.length ? pieces[i + 1].lawful : false
    if (openLo !== null && !nextLawful) {
      // closes at piece.hi if the boundary itself is lawful, else at piece.hi (open piece ends there)
      out.push({
        lo: openLo,
        hi: piece.hi,
        openContact: contactAt(openLo),
        closeContact: contactAt(piece.hi),
      })
      openLo = null
    }
    // isolated lawful contact point between two unlawful pieces
    if (!piece.lawful && boundaryLawful && !nextLawful && piece.hi < sigmaMax) {
      out.push({ lo: piece.hi, hi: piece.hi, openContact: contactAt(piece.hi), closeContact: contactAt(piece.hi) })
    }
  }
  return out
}

/** Intersect two closed interval sets — §7.3: a component's lawful set is ∩ I(e) over its edges. */
export function intersectIntervals(a: readonly ScaleInterval[], b: readonly ScaleInterval[]): ScaleInterval[] {
  const out: ScaleInterval[] = []
  for (const x of a) {
    for (const y of b) {
      const lo = Math.max(x.lo, y.lo)
      const hi = Math.min(x.hi, y.hi)
      if (lo <= hi) {
        out.push({
          lo,
          hi,
          openContact: x.lo >= y.lo ? x.openContact : y.openContact,
          closeContact: x.hi <= y.hi ? x.closeContact : y.closeContact,
        })
      }
    }
  }
  return out
}
