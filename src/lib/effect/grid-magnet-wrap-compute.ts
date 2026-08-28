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
import { centeringAnchors, governMass, type CentreMode, type Governor } from './grid-magnet-logic'

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
  /** Baked anchor query (anchor bake): the governed centre at any size, positions measured once
   *  on the shape and scaled — replaces per-size mesh re-measurement. In-worker only. */
  anchorAtMM?: (mm: number) => Pt
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
    if (cfg.anchorAtMM) return cfg.anchorAtMM(mm)
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
/** One rung the band offers: a revealed layout at its exact contact size. */
export interface BandRung { at: WrapAt; revealMM: number }

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
  anchorAtMM?: (mm: number) => Pt,
): BandRung[] {
  const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  const scanCfg: GridConfig = { ...cfg, positioning: 1, segmentsDetail: 'light', forcePhaseMM: undefined }
  const wcfg: WrapConfig = {
    pitchMM: cfg.pitchMM, paddingMM: cfg.paddingMM,
    centreMode: cfg.centreMode, governor: cfg.governor, massDepthMM: cfg.massDepthMM,
    anchorAtMM,
  }
  const anchorMemo = new Map<number, Pt>()
  const seen = new Set<string>()
  const rungs: BandRung[] = []
  const SCAN_MM = 1
  for (let mm = loMM; mm <= hiMM + 1e-9; mm += SCAN_MM) {
    const pts = computeGrid(sized(mm), anchorAtMM ? { ...scanCfg, centreOverrideMM: anchorAtMM(mm) } : scanCfg).anchors.map((a) => a.p)
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
    rungs.push({ at, revealMM: mm })
  }
  rungs.sort((a, b) => a.at.sizeMM - b.at.sizeMM)
  return rungs
}
