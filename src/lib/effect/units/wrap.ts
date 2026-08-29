// units/wrap.ts — WRAP: a fixed magnet set in, the tightest lawful size out.
//
// Moved from grid-magnet-wrap-compute.ts (S2 step 5). It receives a group and an ANCHOR QUERY and
// solves only contact size — it no longer reaches into centring for the governed centre, because a
// unit may not call another unit. The caller supplies the anchor at every size wrap bisects.
//
// Its three rebuilt primitives are gone: box, inside and nearestDist were duplicates of bbox,
// pointInOuter and edgeDistMM, and nearestDist was a brute scan where the original is indexed.

import { Clipper, FillRule, JoinType, EndType, PointInPolygonResult, type Paths64 } from '@countertype/clipper2-ts'
import type { Contour, Pt, WrapAt, WrapConfig } from '../types'
import { edgeDistToContourMM, pointInContour } from '../foundation/geometry'
import { MANUFACTURING_OFFSET_ARC_TOLERANCE_MM } from '../offset'
import { PADDING_FLOOR_MM } from '../grid-magnet-spec'

/** Micron scale — private to wrap. */
const S = 1000

function seatRegion(contour: Contour, radiusMM: number): Paths64 | null {
  const outer = contour.outer.pts
  const flat: number[] = []
  for (const [x, y] of outer) flat.push(Math.round(x * S), Math.round(y * S))
  const tol = MANUFACTURING_OFFSET_ARC_TOLERANCE_MM
  const region = Clipper.inflatePaths([Clipper.makePath(flat)], -(radiusMM + tol) * S, JoinType.Round, EndType.Polygon, 2, tol * S)
  if (!region || !region.length) return null
  if (!contour.holes.length) return region
  // Every supplied hole is a boundary: inflate it by the same radius and subtract it, so no magnet
  // centre can sit in a hole or within a spot radius of its edge.
  const blocked: Paths64 = []
  for (const hole of contour.holes) {
    const hf: number[] = []
    for (const [x, y] of hole.pts) hf.push(Math.round(x * S), Math.round(y * S))
    const grown = Clipper.inflatePaths([Clipper.makePath(hf)], (radiusMM + tol) * S, JoinType.Round, EndType.Polygon, 2, tol * S)
    if (grown && grown.length) blocked.push(...grown)
  }
  if (!blocked.length) return region
  const left = Clipper.difference(region, blocked, FillRule.NonZero)
  return left && left.length ? left : null
}

/** Every grid origin at which the whole rigid group is seated — empty when it cannot fit. */
function validOrigins(region: Paths64, group: ReadonlyArray<Pt>): Paths64 | null {
  let acc: Paths64 | null = null
  for (const [lx, ly] of group) {
    const shifted = Clipper.translatePaths(region, Math.round(-lx * S), Math.round(-ly * S))
    acc = acc === null ? shifted : Clipper.intersect(acc, shifted, FillRule.NonZero)
    if (!acc || acc.length === 0) return null
  }
  return acc && acc.length ? acc : null
}

/**
 * The governed anchor — the existing centring system's answer for this shape.
 *
 * Wrap does not decide where the shape's centre is; the Centre mode and governor do, exactly as
 * they do everywhere else. This is only consulted AFTER the size is settled, so it never affects
 * whether a layout fits or how tight it wraps — it only chooses which of the valid grid origins
 * to take when there is freedom to choose.
 */
function pickOrigin(valid: Paths64, towards: Pt): Pt {
  const tx = Math.round(towards[0] * S), ty = Math.round(towards[1] * S)
  for (const path of valid) {
    if (Clipper.pointInPolygon({ x: tx, y: ty }, path) !== PointInPolygonResult.IsOutside) {
      return towards                                   // already lawful — sit exactly on it
    }
  }
  let best: Pt = towards, bd = Infinity
  for (const path of valid) {
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[(i + 1) % path.length]
      const ax = Number(a.x) / S, ay = Number(a.y) / S
      const bx = Number(b.x) / S, by = Number(b.y) / S
      const dx = bx - ax, dy = by - ay
      const len2 = dx * dx + dy * dy
      let t = len2 > 0 ? ((towards[0] - ax) * dx + (towards[1] - ay) * dy) / len2 : 0
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const qx = ax + t * dx, qy = ay + t * dy
      const d = (qx - towards[0]) ** 2 + (qy - towards[1]) ** 2
      if (d < bd) { bd = d; best = [qx, qy] }
    }
  }
  return best
}

/** Each magnet's gap past its own margined edge — the wrap measurement, in ONE place. The
 *  sequencer needs it again when the population is completed at the shipped size, and a second
 *  copy of this expression is exactly the duplication this module was split to remove. */
export function gapsToContourMM(
  contour: Contour, points: ReadonlyArray<Pt>, radiusMM: number,
): number[] {
  return points.map((q) => Math.max(0, edgeDistToContourMM(contour, q) - radiusMM))
}

/**
 * Solve ONE explicit arrangement: the tightest centred wrap for exactly these magnets.
 *
 * This is the core the count-driven `wrap` already ran internally for each of its candidate
 * blocks; it is exposed because the arrangement is the thing that should be chosen — by coverage,
 * by mass, by hand — and only then wrapped. Local offsets in, tight size and placement out.
 *
 * The group starts CENTRED (its middle on the governed anchor) and shifts only as far as a
 * lawful tighter wrap demands.
 */
export function wrapGroup(
  sized: (mm: number) => Contour, cfg: WrapConfig, group: ReadonlyArray<Pt>, minMM: number, maxMM: number,
  ): WrapAt | null {
  if (!group.length) return null
  const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const g = group.map((p) => [p[0], p[1]] as Pt)
  const xs = g.map((p) => p[0]), ys = g.map((p) => p[1])
  const mid: Pt = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]

  const anchorAt = (mm: number): Pt => cfg.anchorAtMM(mm)
  const heldAt = (mm: number): Pt | null => {
    const c = sized(mm)
    const anchor = anchorAt(mm)
    const centred: Pt = [anchor[0] - mid[0], anchor[1] - mid[1]]
    let ok = true
    for (const [lx, ly] of g) {
      const px = centred[0] + lx, py = centred[1] + ly
      if (!pointInContour([px, py], c) || edgeDistToContourMM(c, [px, py]) < radius) { ok = false; break }
    }
    if (ok) return centred
    const region = seatRegion(c, radius)
    if (!region) return null
    const valid = validOrigins(region, g)
    if (!valid) return null
    return pickOrigin(valid, centred)
  }

  if (!heldAt(maxMM)) return null
  let lo = minMM, hi = maxMM
  if (heldAt(lo)) hi = lo
  else while (hi - lo > 0.01) {
    const m = (lo + hi) / 2
    if (heldAt(m)) hi = m; else lo = m
  }
  const origin = heldAt(hi)
  if (!origin) return null
  const anchor = anchorAt(hi)
  const pts = g.map(([lx, ly]) => [origin[0] + lx, origin[1] + ly] as Pt)
  const finalMid: Pt = [origin[0] + mid[0], origin[1] + mid[1]]
  return {
    count: pts.length,
    sizeMM: Math.round(hi * 100) / 100,
    centreOffMM: Math.round(Math.hypot(finalMid[0] - anchor[0], finalMid[1] - anchor[1]) * 10) / 10,
    points: pts,
    originMM: origin,
    anchorMM: anchor,
    gapsMM: gapsToContourMM(sized(hi), pts, radius),
  }
}
