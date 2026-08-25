// grid-magnet-wrap-compute.ts — COMPUTE: wrap. Self-contained, exact.
//
// ONE job: add N magnets, shrink the shape onto them.
//
// Method (Clipper2, the recommended geometry route — no physics loop, no iteration artifacts):
//
//   1. Deflate the outline by the disc radius. The remaining region is exactly where a magnet
//      CENTRE is allowed to sit.
//   2. The magnets are a rigid group with local offsets L1..Ln, so the grid origin O is valid iff
//      every O+Li lies in that region — i.e. iff O lies in the INTERSECTION of the region
//      translated by each -Li.
//   3. Non-empty intersection ⟺ the group fits at this size. Empty ⟺ it does not.
//   4. Binary-search the size for the smallest one that still fits. That is the tightest wrap,
//      computed rather than converged on, so it cannot stop early or jitter.
//
// Deliberately disconnected from the rest of the engine: no centring modes, no governing mass, no
// safe-area islands, no voting, no coverage, no flap. Inputs are the outline, the pitch and the
// radius. Nothing here reads a policy.

import { Clipper, FillRule, JoinType, EndType, PointInPolygonResult, type Paths64 } from '@countertype/clipper2-ts'
import type { Contour, Pt } from './types'
import { DEFAULT_PITCH_MM, MAGNET_DIA_SMALL_MM, MAGNET_DIA_LARGE_MM, PADDING_FLOOR_MM } from './grid-magnet-spec'
import { computeGrid, type GridConfig, type GridResult } from './grid-magnet'
import { centroidOf, safeSegments, spotRadiusOf } from './grid-magnet-compute'
import { MANUFACTURING_OFFSET_ARC_TOLERANCE_MM } from './offset'
import { applyCoverage, centeringAnchors, governMass, type CentreMode, type Governor } from './grid-magnet-logic'
import type { SafeSegment } from './grid-magnet-compute'

/** mm → integer microns; Clipper64 is integer-robust. */
const S = 1000



export interface WrapConfig {
  pitchMM?: number
  paddingMM?: number
  magnetDiaMM?: number
  /** Centre mode + governor — the existing centring system decides where the group sits. */
  centreMode?: number
  governor?: number
  massDepthMM?: number
  /** Perimeter belt — drop fully-surrounded interior seats, keeping the rim. Reused from the
   *  voting bench. Applied to the ARRANGEMENT before the wrap is solved, so the shape still
   *  wraps tight around exactly the magnets that remain. */
  perimeterOnly?: boolean
  // NO flap dial. In this engine it would be `radius = padding + flap` — one number behind two
  // controls — and it would also shrink the legal seating area, which is exactly the job T1 says
  // an allowance must never do. The padding IS the reach here.
}

export interface WrapAt {
  count: number
  sizeMM: number
  /** How far the group's middle ended up from the governed anchor. */
  centreOffMM: number
  points: Pt[]
  originMM: Pt
  /** The governed centre the Centre mode named — what the canvas should mark as the centre.
   *  NOT the lattice origin: that sits on a magnet and is meaningless as a centre. */
  anchorMM: Pt
  gapsMM: number[]
}

function box(pts: ReadonlyArray<Pt>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

function inside(o: ReadonlyArray<Pt>, px: number, py: number): boolean {
  let hit = false
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const xi = o[i][0], yi = o[i][1], xj = o[j][0], yj = o[j][1]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

function nearestDist(o: ReadonlyArray<Pt>, px: number, py: number): number {
  let bd = Infinity
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const ax = o[j][0], ay = o[j][1]
    const abx = o[i][0] - ax, aby = o[i][1] - ay
    const ab2 = abx * abx + aby * aby
    let t = ab2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / ab2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const vx = px - (ax + t * abx), vy = py - (ay + t * aby)
    const d2 = vx * vx + vy * vy
    if (d2 < bd) bd = d2
  }
  return Math.sqrt(bd)
}

/**
 * Where a magnet centre may sit: the outline deflated by the disc radius.
 *
 * Deflated by radius + the arc tolerance, deliberately. A round offset is drawn as line segments
 * that may bulge OUTWARD of the true curve by up to that tolerance, and outward here means a
 * magnet allowed to sit nearer the edge than the padding permits — measured at 11.95mm against a
 * 12mm law before this was added. Paying the tolerance on the deflation puts the whole error on
 * the safe side: never closer than the padding, at most a hair further.
 */
function seatRegion(outer: ReadonlyArray<Pt>, radiusMM: number): Paths64 | null {
  const flat: number[] = []
  for (const [x, y] of outer) flat.push(Math.round(x * S), Math.round(y * S))
  const tol = MANUFACTURING_OFFSET_ARC_TOLERANCE_MM
  const region = Clipper.inflatePaths([Clipper.makePath(flat)], -(radiusMM + tol) * S, JoinType.Round, EndType.Polygon, 2, tol * S)
  return region && region.length ? region : null
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
function governedCentre(outer: ReadonlyArray<Pt>, cfg: WrapConfig, detail: 'full' | 'light' = 'full'): Pt {
  const bb = box(outer)
  const boxC: Pt = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const r = spotRadiusOf(pad)
  const mode = (cfg.centreMode ?? 2) as CentreMode
  const gov = (cfg.governor ?? 0) as Governor
  const segs = safeSegments(outer, r, Math.max(r, cfg.massDepthMM ?? 16), detail)
  const cands = centeringAnchors(mode, segs, boxC, centroidOf(outer))
  if (mode !== 2) return cands[0] ?? boxC
  const masses = segs.flatMap((sg) => (sg.masses.length ? sg.masses : [sg]))
  return governMass(masses, gov, boxC[1])?.centreMM ?? cands[0] ?? boxC
}

/**
 * The lawful position closest to a target point.
 *
 * The valid set is a REGION, not a list of corners. If the target lies inside it, the target IS
 * the answer — the group can sit exactly there. Only when it lies outside does the nearest point
 * on the boundary apply, and that is a point on an EDGE, not the nearest vertex.
 *
 * Choosing among vertices was why centring appeared to do nothing: it returned an arbitrary
 * corner of the lawful region instead of the lawful position nearest the centroid.
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
  /** Optional anchor memo, shared across calls. The governed centre depends only on the SIZE, so
   *  solving many arrangements over the same size range recomputes the same mesh dozens of times
   *  without it — that was seconds per layout. */
  anchorMemo?: Map<number, Pt>,
): WrapAt | null {
  if (!group.length) return null
  const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const g = group.map((p) => [p[0], p[1]] as Pt)
  const xs = g.map((p) => p[0]), ys = g.map((p) => p[1])
  const mid: Pt = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]

  const anchors = anchorMemo ?? new Map<number, Pt>()
  const anchorAt = (mm: number, exact = false): Pt => {
    const k = Math.round(mm * 100)
    const hit = anchors.get(k)
    if (hit && !exact) return hit
    const a = governedCentre(sized(mm).outer.pts, cfg, exact ? 'full' : 'light')
    if (!exact) anchors.set(k, a)
    return a
  }
  const heldAt = (mm: number, exact = false): Pt | null => {
    const outer = sized(mm).outer.pts
    const anchor = anchorAt(mm, exact)
    const centred: Pt = [anchor[0] - mid[0], anchor[1] - mid[1]]
    let ok = true
    for (const [lx, ly] of g) {
      const px = centred[0] + lx, py = centred[1] + ly
      if (!inside(outer, px, py) || nearestDist(outer, px, py) < radius) { ok = false; break }
    }
    if (ok) return centred
    const region = seatRegion(outer, radius)
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
  const origin = heldAt(hi, true) ?? heldAt(hi)
  if (!origin) return null
  const outer = sized(hi).outer.pts
  const anchor = anchorAt(hi, true)
  const pts = g.map(([lx, ly]) => [origin[0] + lx, origin[1] + ly] as Pt)
  const finalMid: Pt = [origin[0] + mid[0], origin[1] + mid[1]]
  return {
    count: pts.length,
    sizeMM: Math.round(hi * 100) / 100,
    centreOffMM: Math.round(Math.hypot(finalMid[0] - anchor[0], finalMid[1] - anchor[1]) * 10) / 10,
    points: pts,
    originMM: origin,
    anchorMM: anchor,
    gapsMM: pts.map((q) => Math.max(0, nearestDist(outer, q[0], q[1]) - radius)),
  }
}

/**
 * Add `count` magnets and wrap the shape around them.
 *
 * CENTRE FIRST, exactly as Centre-rules does it: the lattice is not searched, it is PINNED — the
 * magnet group's own middle is placed on the governed centre (a single magnet's centre on it, a
 * pair's midpoint on it, a 2x2's middle cell on it). Deviation from the centre is therefore zero
 * by construction, not by preference.
 *
 * WRAP SECOND: with the group pinned, the only free variable is size. The shape is shrunk to the
 * smallest size at which every magnet is still held — so it is centred AND wrapped, and the size
 * is the one that achieves both. Nothing slides off the centre to buy a tighter wrap, and nothing
 * grows past its wrap to buy centring.
 */
export function wrap(
  sized: (mm: number) => Contour, cfg: WrapConfig, count: number, minMM: number, maxMM: number,
): WrapAt | null {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const want = Math.max(1, Math.round(count))
  const half = pitch / 2

  // Candidate arrangements: the `want` seats nearest the group's own middle, in four lattice
  // parities and both tie-break orders, so a pair may lie along either axis.
  const groups: Pt[][] = []
  const span = Math.ceil(Math.sqrt(want)) + 2
  for (const ox of [0, half]) for (const oy of [0, half]) {
    const all: Pt[] = []
    for (let ix = -span; ix <= span; ix++) for (let iy = -span; iy <= span; iy++)
      all.push([ox + ix * pitch, oy + iy * pitch])
    for (const axis of [0, 1]) {
      const sorted = [...all].sort((a, b) => {
        const da = Math.hypot(a[0], a[1]), db = Math.hypot(b[0], b[1])
        if (Math.abs(da - db) > 1e-9) return da - db
        return axis === 0 ? a[0] - b[0] || a[1] - b[1] : a[1] - b[1] || a[0] - b[0]
      })
      const picked = sorted.slice(0, want)
      // The belt thins the arrangement BEFORE the size is solved — wrapping around magnets that
      // were then thrown away would leave the shape loose around the ones that stayed.
      groups.push(cfg.perimeterOnly ? applyCoverage(picked, true, pitch).seated : picked)
    }
  }

  /** The group's own middle — the point the Centre law puts on the anchor. */
  const midOf = (group: ReadonlyArray<Pt>): Pt => {
    const xs = group.map((g) => g[0]), ys = group.map((g) => g[1])
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  }

  // The anchor moves with the shape, so it must be the anchor FOR THE SIZE BEING TESTED — a
  // coarse cache made the pin disagree with the size and the wrap stopped short of contact.
  // Cached per size (shared across arrangements) and taken at the cheap detail, which affects
  // cost only: the centre point is identical either way.
  const anchors = new Map<number, Pt>()
  const anchorAt = (mm: number, exact = false): Pt => {
    const k = Math.round(mm * 100)
    const hit = anchors.get(k)
    if (hit && !exact) return hit
    const a = governedCentre(sized(mm).outer.pts, cfg, exact ? 'full' : 'light')
    if (!exact) anchors.set(k, a)
    return a
  }

  /**
   * Is this size lawful for this arrangement, and where does the group sit if so?
   *
   * The group STARTS centred — its middle on the governed centroid — and shifts only as far as
   * the wrap actually demands: the answer is the lawful position NEAREST that centred one. So the
   * deviation is never chosen, it is whatever the tighter wrap required and no more.
   */
  const heldAt = (group: Pt[], mid: Pt, mm: number, exact = false): Pt | null => {
    const outer = sized(mm).outer.pts
    const anchor = anchorAt(mm, exact)
    const centred: Pt = [anchor[0] - mid[0], anchor[1] - mid[1]]
    // Centred position lawful? Then there is nothing to trade.
    let ok = true
    for (const [lx, ly] of group) {
      const px = centred[0] + lx, py = centred[1] + ly
      if (!inside(outer, px, py) || nearestDist(outer, px, py) < radius) { ok = false; break }
    }
    if (ok) return centred
    // Otherwise the nearest lawful position — the minimum shift that buys this tighter wrap.
    const region = seatRegion(outer, radius)
    if (!region) return null
    const valid = validOrigins(region, group)
    if (!valid) return null
    return pickOrigin(valid, centred)
  }

  // Every arrangement is solved to ITS OWN tightest wrap, so every candidate below is already a
  // tight, fully-pressed solution — the wrap is never traded away.
  const cands: Array<{ size: number; group: Pt[]; mid: Pt; off: number }> = []
  for (const group of groups) {
    const mid = midOf(group)
    if (!heldAt(group, mid, maxMM)) continue           // never held, at any size
    // Smallest size that still holds it, pinned on the centre throughout.
    let lo = minMM, hi = maxMM
    if (heldAt(group, mid, lo)) hi = lo
    else while (hi - lo > 0.01) {
      const m = (lo + hi) / 2
      if (heldAt(group, mid, m)) hi = m; else lo = m
    }
    const at = heldAt(group, mid, hi)
    if (!at) continue
    const a = anchorAt(hi)
    cands.push({ size: hi, group, mid, off: Math.hypot(at[0] + mid[0] - a[0], at[1] + mid[1] - a[1]) })
  }
  if (!cands.length) return null

  // Among those tight solutions the winner is the one CLOSEST TO THE CENTROID — not the smallest
  // shape at any centring cost. The candidates are the same group at the four lattice parities, so
  // they differ by exactly a half-pitch shift; that half-pitch is therefore what a centring gain
  // may cost in size. Beyond it the shape is growing for a placement it cannot justify.
  const floor = Math.min(...cands.map((c) => c.size))
  const inReach = cands.filter((c) => c.size <= floor + pitch / 2)
  const won = inReach.reduce((b, c) =>
    c.off < b.off - 0.01 || (Math.abs(c.off - b.off) <= 0.01 && c.size < b.size) ? c : b)

  // Settle on the exact anchor for the answer.
  const origin = heldAt(won.group, won.mid, won.size, true) ?? heldAt(won.group, won.mid, won.size)
  if (!origin) return null
  const outer = sized(won.size).outer.pts
  const anchor = anchorAt(won.size, true)
  const pts = won.group.map(([lx, ly]) => [origin[0] + lx, origin[1] + ly] as Pt)
  const finalMid: Pt = [origin[0] + won.mid[0], origin[1] + won.mid[1]]
  return {
    count: pts.length,
    sizeMM: Math.round(won.size * 100) / 100,
    centreOffMM: Math.round(Math.hypot(finalMid[0] - anchor[0], finalMid[1] - anchor[1]) * 10) / 10,
    points: pts,
    originMM: origin,
    anchorMM: anchor,
    gapsMM: pts.map((q) => Math.max(0, nearestDist(outer, q[0], q[1]) - radius)),
  }
}

/** The wrapped answer as the canvas draws it. Display only — nothing is decided here. */
export function wrapGrid(
  sized: (mm: number) => Contour, cfg: WrapConfig, at: WrapAt,
): { contour: Contour; grid: GridResult } {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const radius = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const dia = cfg.magnetDiaMM === MAGNET_DIA_LARGE_MM ? MAGNET_DIA_LARGE_MM : MAGNET_DIA_SMALL_MM
  const contour = sized(at.sizeMM)
  const bb = box(contour.outer.pts)
  const seed = at.points[0] ?? at.originMM
  const reach = Math.ceil(Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) / pitch) + 2
  const lattice: Pt[] = []
  for (let ix = -reach; ix <= reach; ix++) for (let iy = -reach; iy <= reach; iy++)
    lattice.push([seed[0] + ix * pitch, seed[1] + iy * pitch])
  const mod = (v: number, m: number) => ((v % m) + m) % m
  return {
    contour,
    grid: {
      anchors: at.points.map((p) => ({ p, dia })),
      pitchCentreMM: pitch,
      lattice,
      phaseMM: [mod(seed[0] - bb.minX, pitch), mod(seed[1] - bb.minY, pitch)],
      panMM: [0, 0],
      spotRadiusMM: radius,
      contactsMM: at.points.filter((_, i) => (at.gapsMM[i] ?? Infinity) <= 0.6),
      segments: [],
      centresMM: [at.anchorMM],
      centreMainMM: at.anchorMM,
    },
  }
}

/** One region of the shape that no magnet holds: its area, its middle, and its outline(s). */
export interface UnheldPatch {
  areaMM2: number
  /** The patch's own centre — the coordinate a magnet would have to occupy to hold it. */
  centreMM: Pt
  rings: Pt[][]
}

/**
 * WHAT THE MAGNETS DO NOT HOLD — measured, never thresholded.
 *
 * The shape minus the union of every magnet's hold disc. Whatever survives is material with no
 * magnet on it, returned as real polygons with exact areas.
 *
 * THE ONE NUMBER, and why it is not invented: the caller passes the lattice cell's CIRCUMRADIUS,
 * pitch/√2 — the radius at which the four magnets around a cell exactly cover it, leaving no void
 * between them. Two other candidates are wrong and both were tried: the 12mm spot radius is the
 * magnet's own protected area and makes ~85% of every shape read as unheld; half the pitch leaves
 * the diamond void between every four magnets uncovered, so material surrounded on all four sides
 * reads as unheld. The circumradius is a fact about the board, not a dial.
 *
 * Nothing is compared against a constant. Two layouts are measured with the same disc, so "this
 * one leaves less unheld than that one" is a fact about the pair.
 *
 * A MEASUREMENT. It decides nothing; it is the number a rule can finally be written against.
 */
export function unheldOf(outer: ReadonlyArray<Pt>, magnets: ReadonlyArray<Pt>, radiusMM: number): UnheldPatch[] {
  if (outer.length < 3) return []
  const flat: number[] = []
  for (const [x, y] of outer) flat.push(Math.round(x * S), Math.round(y * S))
  const shape: Paths64 = [Clipper.makePath(flat)]
  if (!magnets.length) return ringsOf(shape)
  const discs: Paths64 = magnets.map((m) =>
    Clipper.ellipse({ x: Math.round(m[0] * S), y: Math.round(m[1] * S) }, Math.round(radiusMM * S), undefined, 64))
  const held = Clipper.union(discs, FillRule.NonZero)
  const left = Clipper.difference(shape, held, FillRule.NonZero)
  return left && left.length ? ringsOf(left) : []
}

/** Paths64 → patches in mm, outer rings only (a hole inside a patch is not unheld material). */
function ringsOf(paths: Paths64): UnheldPatch[] {
  const out: UnheldPatch[] = []
  for (const path of paths) {
    const areaMM2 = Clipper.area(path) / (S * S)
    if (areaMM2 <= 0) continue                       // negative area = a hole in a patch
    const ring: Pt[] = path.map((q) => [Number(q.x) / S, Number(q.y) / S] as Pt)
    out.push({ areaMM2, centreMM: centroidOf(ring), rings: [ring] })
  }
  return out.sort((a, b) => b.areaMM2 - a.areaMM2)   // biggest first: the one a magnet should take
}

/** Shoelace area of a ring. */
function areaOfRing(pts: ReadonlyArray<Pt>): number {
  let a2 = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  return a2 / 2
}

/** A flap-driven answer: the arrangement the exposed edges demanded, and what remains exposed. */
export interface FlapWrap {
  at: WrapAt
  /** Material no magnet holds, as a share of the shape at its wrapped size. */
  unheldPct: number
  patches: UnheldPatch[]
  /** The patches still touching the outline — the exposed edges the layout failed to pin. */
  edgePatches: UnheldPatch[]
}

/** Does this unheld patch touch the shape's outline (an exposed EDGE, not an interior gap)?
 *  A patch boundary that runs along the outline shares it — any ring point at ~zero distance. */
function touchesOutline(patch: UnheldPatch, outer: ReadonlyArray<Pt>): boolean {
  for (const ring of patch.rings) {
    const step = Math.max(1, Math.floor(ring.length / 48))     // sample; rings are dense
    for (let i = 0; i < ring.length; i += step)
      if (nearestDist(outer, ring[i][0], ring[i][1]) < 0.75) return true
  }
  return false
}

/**
 * THE FLAP LOOP — Dan's rule verbatim (08-25): "use the flap id to identify edges unprotected and
 * place magnets there simple as that and scale or shrink shape for that."
 *
 * One loop, no frames, no scoring:
 *   1. wrap the current magnets (exact size, centred);
 *   2. flap-id the result, keeping only patches that TOUCH THE OUTLINE — unheld material between
 *      the extremes is fine (L2), an unprotected edge is the failure;
 *   3. the next magnet goes to the lattice seat nearest the worst exposed edge — TOP FIRST,
 *      because gravity peels the top flap (L1);
 *   4. re-wrap: the size grows or shrinks to whatever the new arrangement demands (R4).
 * Repeat until the asked-for count is placed. Count is exact (L4): every magnet is placed, the
 * flap only decides WHERE.
 */
export function wrapFlap(
  sized: (mm: number) => Contour, cfg: WrapConfig, count: number, minMM: number, maxMM: number,
): FlapWrap | null {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const hold = pitch / Math.SQRT2
  const want = Math.max(1, Math.round(count))
  const memo = new Map<number, Pt>()
  // Solved-arrangement cache. The refinement pass revisits the same seat sets many times over,
  // and each solve is a full binary search; without this the duck at 6 costs 36 seconds.
  const solved = new Map<string, WrapAt | null>()
  const gkey = (g: ReadonlyArray<Pt>) =>
    g.map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).sort().join(';')
  const solve = (g: Pt[]): WrapAt | null => {
    const k = gkey(g)
    if (solved.has(k)) return solved.get(k)!
    const r = wrapGroup(sized, cfg, g, minMM, maxMM, memo)
    solved.set(k, r)
    return r
  }

  // Gravity seeds the first magnet: the top of the shape, not its middle (L1 — a single magnet's
  // job is to keep the top from falling). Seat parity along the way comes from the lattice.
  let group: Pt[] = [[0, 0]]
  let at = solve(group)
  if (!at) return null

  const key = (p: Pt) => `${Math.round(p[0])},${Math.round(p[1])}`
  while (group.length < want) {
    const outer = sized(at.sizeMM).outer.pts
    const patches = unheldOf(outer, at.points, hold)
    const exposed = patches.filter((p) => touchesOutline(p, outer))
    // TOP FIRST among exposed edges; largest breaks the tie. No exposed edge → largest patch;
    // nothing unheld at all → the seat furthest from the group (spread, never stack).
    const ranked = (exposed.length ? exposed : patches).sort((a, b) => {
      const ty = Math.max(...a.rings[0].map((q) => q[1])) - Math.max(...b.rings[0].map((q) => q[1]))
      return Math.abs(ty) > pitch / 2 ? -ty : b.areaMM2 - a.areaMM2
    })
    const used = new Set(group.map(key))
    let placed = false
    for (const target of ranked.length ? ranked.map((p) => p.centreMM) : [at.anchorMM]) {
      // Candidate seats around the target, nearest first, in the group's own lattice frame.
      const lx = (target[0] - at.originMM[0]) / pitch, ly = (target[1] - at.originMM[1]) / pitch
      const cands: Pt[] = []
      for (let ix = Math.floor(lx) - 1; ix <= Math.ceil(lx) + 1; ix++)
        for (let iy = Math.floor(ly) - 1; iy <= Math.ceil(ly) + 1; iy++)
          cands.push([ix * pitch, iy * pitch])
      cands.sort((a, b) =>
        Math.hypot(a[0] - lx * pitch, a[1] - ly * pitch) - Math.hypot(b[0] - lx * pitch, b[1] - ly * pitch))
      for (const seat of cands) {
        if (used.has(key(seat))) continue
        const trial = solve([...group, seat])
        if (!trial) continue
        group = [...group, seat]
        at = trial
        placed = true
        break
      }
      if (placed) break
    }
    if (!placed) return null                          // no lawful seat anywhere for the next magnet
  }

  // REFINE AT THE FINAL SIZE. The greedy pass places each magnet against the flap of the SMALLER
  // shape that existed before it — the duck at 2 magnets is 77mm and fully held, so the third had
  // no signal, and only after the growth does the head show as an exposed edge. So: at the landed
  // size, while an edge is exposed, move the magnet that matters least onto the seat nearest the
  // worst exposure — top first — and keep the move only when it lowers the exposure.
  const topOf = (ps: UnheldPatch[]) => ps.length ? Math.max(...ps.map((q) => Math.max(...q.rings[0].map((r) => r[1])))) : -Infinity
  const judge = (a: WrapAt) => {
    const o = sized(a.sizeMM).outer.pts
    const eps = unheldOf(o, a.points, hold).filter((q) => touchesOutline(q, o))
    return { eps, top: topOf(eps), area: eps.reduce((s2, q) => s2 + q.areaMM2, 0) }
  }
  let cur = judge(at)
  for (let round = 0; round < want * 2 && cur.eps.length; round++) {
    const target = [...cur.eps].sort((a, b) => {
      const ty = Math.max(...a.rings[0].map((r) => r[1])) - Math.max(...b.rings[0].map((r) => r[1]))
      return Math.abs(ty) > pitch / 2 ? -ty : b.areaMM2 - a.areaMM2
    })[0].centreMM
    const lx = (target[0] - at.originMM[0]) / pitch, ly = (target[1] - at.originMM[1]) / pitch
    const cands: Pt[] = []
    for (let ix = Math.floor(lx) - 1; ix <= Math.ceil(lx) + 1; ix++)
      for (let iy = Math.floor(ly) - 1; iy <= Math.ceil(ly) + 1; iy++)
        cands.push([ix * pitch, iy * pitch])
    cands.sort((a, b) => Math.hypot(a[0] - lx * pitch, a[1] - ly * pitch) - Math.hypot(b[0] - lx * pitch, b[1] - ly * pitch))
    const used = new Set(group.map(key))
    let improved = false
    for (const seat of cands.slice(0, 3)) {          // the nearest seats to the exposure, no sweep
      if (used.has(key(seat))) continue
      // Move each magnet in turn onto this seat; the first move that lowers the exposure wins.
      for (let m = 0; m < group.length && !improved; m++) {
        const moved = group.map((g, i) => (i === m ? seat : g))
        const trial = solve(moved)
        if (!trial) continue
        const j = judge(trial)
        const better = j.top < cur.top - 1 || (Math.abs(j.top - cur.top) <= 1 && j.area < cur.area - 1)
        if (better) { group = moved; at = trial; cur = j; improved = true }
      }
      if (improved) break
    }
    if (!improved) break
  }

  const outer = sized(at.sizeMM).outer.pts
  const patches = unheldOf(outer, at.points, hold)
  const edgePatches = patches.filter((p) => touchesOutline(p, outer))
  const shapeA = Math.abs(areaOfRing(outer))
  return {
    at,
    unheldPct: shapeA > 0 ? (patches.reduce((s, p) => s + p.areaMM2, 0) / shapeA) * 100 : 0,
    patches,
    edgePatches,
  }
}

/** One rung the band offers: a revealed layout at its exact contact size. */
export interface BandRung { at: WrapAt }

/**
 * THE BAND LADDER, size-first (Dan's reversal, 2026-08-25): the band is the input, the count is
 * the output. Nothing here invents a layout and nothing walks a gate:
 *
 *   1 · REVEAL — at each scanned size, centre-rules seating (the existing engine, positioning 1)
 *       says which magnets the material carries. The layout is read off the material, not chosen.
 *   2 · WRAP — each distinct revealed layout is handed WHOLE to `wrapGroup`, the proven solver:
 *       the group starts centred on the governed anchor and shifts only the minimum a lawful
 *       tighter wrap demands, bisected to the exact contact size. At that size the lawful region
 *       has collapsed — the binding magnets are pressed, a gap is impossible by construction.
 *   3 · BAND MEMBERSHIP — a layout whose contact size falls outside the band belongs to another
 *       band and is not offered here (ruled 08-24).
 *
 * Composition only: computeGrid and wrapGroup are used as they are, byte-untouched.
 */
export function wrapBandLadder(
  sized: (mm: number) => Contour, cfg: GridConfig, loMM: number, hiMM: number, minMM: number,
): BandRung[] {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const scanCfg: GridConfig = { ...cfg, positioning: 1, segmentsDetail: 'light', forcePhaseMM: undefined }
  const wcfg: WrapConfig = {
    pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM,
    centreMode: cfg.centreMode, governor: cfg.governor, massDepthMM: cfg.massDepthMM,
  }
  const anchorMemo = new Map<number, Pt>()
  const seen = new Set<string>()
  const rungs: BandRung[] = []
  const SCAN_MM = 1
  for (let mm = loMM; mm <= hiMM + 1e-9; mm += SCAN_MM) {
    const pts = computeGrid(sized(mm), scanCfg).anchors.map((a) => a.p)
    if (!pts.length) continue
    // Layout identity: the seated pattern in lattice units, origin-free.
    let mx = Infinity, my = Infinity
    for (const p of pts) { if (p[0] < mx) mx = p[0]; if (p[1] < my) my = p[1] }
    const id = pts.map((p) => Math.round((p[0] - mx) / pitch) + ',' + Math.round((p[1] - my) / pitch)).sort().join(';')
    if (seen.has(id)) continue
    seen.add(id)
    // Local offsets about the group's own middle — wrapGroup pins that middle on the anchor.
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const group = pts.map(([x, y]) => [x - cx, y - cy] as Pt)
    const at = wrapGroup(sized, wcfg, group, minMM, hiMM, anchorMemo)
    if (!at) continue
    if (at.sizeMM < loMM - 0.005 || at.sizeMM > hiMM + 0.005) continue   // another band owns it
    rungs.push({ at })
  }
  rungs.sort((a, b) => a.at.sizeMM - b.at.sizeMM)
  return rungs
}
