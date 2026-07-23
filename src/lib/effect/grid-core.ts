// grid-core.ts — internal magnetic-grid REGISTRATION engine (Session 59). Pure mm computation, no DOM / no three.
//
// The model (SSOT _ssot-workbench/_briefs/magnetic-grid-standard-brief.md §10/§12/§13, locked 2026-07-21):
//   • FIXED lattice, launch family 48/96 (§13.1) — points never move; the whole grid translates as a
//     rigid bulk, CENTRED on the shape (centroid/bbox), best of the centred parities kept.
//   • PER-SPOT padding (interp A): a node is valid = inside the silhouette AND ≥ pad (10mm radius from
//     the magnet centre) from the REAL outline — per-node, no erosion (pinched shapes keep all regions).
//   • ONE physics metric everywhere: HOLD COVERAGE (no outline point beyond HOLD_REACH of a magnet).
//     Auto pitch × pattern selection (autoGrid), margin growth (balancedFit) and the coverage-verified
//     perimeter belt all rank by it — shape-agnostic, no shape-name branches.
//   • MARGIN model: the design never resizes; an outward margin band grows (capped) until covered.
//   • Procedural sizes: zero-point ladder `size = (n−1)·pitch + 2·pad (+2·frame)` → 70+48k (§13.2).

import type { Contour, Pt } from './types'
import { pointInContour } from './polygon'
import { insetRingMM } from './offset'

/** THE 48/68 SYSTEM (§13.5d, locked): one lattice, two atoms — straight 48, diagonal 68 (=48√2).
 *  'standard' = straight rows only · 'diamond' = diagonal (68) links only · 'quincunx' (dice) = the
 *  mix (legal ONLY at pitch 96 — its centres land at 48-offsets, the canvas's own dice; a 48-dice
 *  would need 24-offsets, and NOTHING halves either atom). There is no granular/24/72 anywhere. */
export type GridPattern = 'standard' | 'quincunx' | 'diamond'
/** ATTACHMENT LAW (§5 / §10.2): 'magnetic' = single-sided, registers on the garment's 96-dice canvas
 *  (the whole 48/68 grid system applies) · 'twinfix' = two mirror-grid halves clamp any fabric — same
 *  grid laws effect-side, NO garment constraint, the counterpart twin is part of the product ·
 *  'velcro' = NO grid at all: the back is a full velcro hook in the silhouette; any shape, any size. */
export type Attachment = 'magnetic' | 'twinfix' | 'velcro'
/** 'auto' (DEFAULT — the §10.7 law): magnet size is SIZE-DRIVEN, never a knob. ≤100mm effects run
 *  all-6mm (light); above 100mm the FOCAL anchors (radial extremes — where peel starts) take 8mm and
 *  the rest stay 6mm; from 200mm the focal window widens (proportional ramp — more 8mm as size/weight
 *  grows). Manual all6/all8/corners8 remain admin experiments. */
export type MagnetPlan = 'auto' | 'all6' | 'all8' | 'corners8'
export type MagnetDia = 6 | 8

export const DEFAULT_PITCH_MM = 48
export const LAUNCH_PITCHES_MM = [48, 96] as const
export const PADDING_FLOOR_MM = 10
export const MIN_ANCHORS = 2
export const TARGET_ANCHORS = 4
/** How far a magnet holds material down before an edge would lift — a PHYSICAL distance, independent of
 *  the chosen grid pitch. Tunable after coupon testing. */
export const HOLD_REACH_MM = 48
/** CORNER TOLERANCE on the pad distance: a convex corner ROUNDING may bring the outline slightly
 *  inside the pad radius — the REAL 70mm product's corner magnets sit ~9mm from the corner arc and
 *  hold (standard rungs must seat their canonical grid at exact size, no margin needed). Tunable. */
export const PAD_CORNER_TOL_MM = 1.5
/** Minimum fraction of the application ring (radius = pad) inside material — the second gate: corner
 *  rounding clips a small arc of the ring (~29% on the squircle) while a thin arm loses ~half, so
 *  encroachment beyond a clipped corner stays invalid. Tunable (coupon later). */
export const RING_COVERAGE_MIN = 0.7
/** Focal-ramp law thresholds (§10.7, coupon-tunable): below FOCAL_SIZE all-6; above, radial extremes
 *  take 8mm; from RAMP2 the focal window widens to 75% of max radius. */
export const FOCAL_SIZE_MM = 100
export const FOCAL_RAMP2_MM = 200

export interface GridConfig {
  attachment?: Attachment // default 'magnetic'
  pitchMM?: number
  paddingMM?: number
  pattern?: GridPattern
  plan?: MagnetPlan
  perimeterOnly?: boolean // default true — magnetic belt (drop redundant interior)
  center?: 'centroid' | 'bbox' // where the fixed grid is anchored (A/B). default 'centroid'
  /** STRICT pad law: disable the convex-corner tolerance (used by zero-point SIZING solves — a
   *  standard size is defined by the exact pad, the tolerance only rescues seating on rounded corners
   *  at a given size). */
  strictPad?: boolean
  /** LIGHT-mode thinning of 48-composed grids (Dan 2026-07-21: "keep central 3-4, remove 2 and 5"):
   *  per axis keep the ends + alternate inward, always keeping the central pair → 96/48/96 gaps.
   *  A 262 (48×6) light row becomes 1·3·4·6. Applied only at pitch 48 with ≥5 lines. */
  sparseThin?: boolean
  /** User product law: after the final perimeter belt, add only the minimum safe anchors that improve
   *  an uncovered outline region. Admin experiments leave this off. */
  rescueCoverage?: boolean
}

export interface Anchor { p: Pt; dia: MagnetDia }

export interface GridResult {
  attachment: Attachment
  /** twin-fix: the effect ships as a PAIR — this grid is also its mirror counterpart's grid. */
  twinRequired: boolean
  anchors: Anchor[]
  rescueAnchors: Pt[] // omitted lattice/off-lattice anchors added only to recover uncovered material
  candidates: Pt[]      // interior points dropped by perimeter mode (faint viz)
  flaps: Pt[]
  ok: boolean
  issues: string[]
  pitchCentreMM: number
  edgeRangeMM: [number, number]
  applicationPadMM: number
}

type BBox = { minX: number; minY: number; maxX: number; maxY: number }
function bbox(pts: ReadonlyArray<Pt>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}
function dist(a: Pt, b: Pt) { return Math.hypot(a[0] - b[0], a[1] - b[1]) }

/** Shortest distance from point `p` to segment a–b. */
function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const vx = b[0] - a[0], vy = b[1] - a[1]
  const wx = p[0] - a[0], wy = p[1] - a[1]
  const c1 = vx * wx + vy * wy
  if (c1 <= 0) return Math.hypot(wx, wy)
  const c2 = vx * vx + vy * vy
  if (c2 <= c1) return Math.hypot(p[0] - b[0], p[1] - b[1])
  const t = c1 / c2
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy))
}
/** Shortest distance from `p` to the outline ring (any edge). Used for the per-node padding test — checked
 *  against the REAL outline (no erosion) so pinched shapes (a duck's head + body) keep BOTH regions. */
function distToRing(p: Pt, ring: ReadonlyArray<Pt>): number {
  let m = Infinity
  for (let i = 0, n = ring.length; i < n; i++) { const d = distToSeg(p, ring[i], ring[(i + 1) % n]); if (d < m) m = d }
  return m
}

function distToContour(p: Pt, contour: Contour): number {
  let d = distToRing(p, contour.outer.pts)
  for (const hole of contour.holes) d = Math.min(d, distToRing(p, hole.pts))
  return d
}

/** The most-interior point of the silhouette (pole of inaccessibility, sampled) + its distance to the edge.
 *  Used as the guaranteed single-magnet fallback when the sparse grid seats none. */
function deepestPoint(contour: Contour, bb: BBox): { p: Pt; d: number } | null {
  const step = Math.max(2, Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / 24)
  let best: Pt | null = null, bestD = -1
  for (let x = bb.minX; x <= bb.maxX; x += step) for (let y = bb.minY; y <= bb.maxY; y += step) {
    const p: Pt = [x, y]
    if (!pointInContour(p, contour)) continue
    const d = distToContour(p, contour)
    if (d > bestD) { bestD = d; best = p }
  }
  return best ? { p: best, d: bestD } : null
}

/** Area centroid of a polygon ring (balances material). Falls back to bbox centre if degenerate. */
function polyCentroid(ring: ReadonlyArray<Pt>): Pt {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % n]
    const cross = x0 * y1 - x1 * y0
    a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross
  }
  a *= 0.5
  if (Math.abs(a) < 1e-6) { const b = bbox(ring); return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2] }
  return [cx / (6 * a), cy / (6 * a)]
}

function ringArea(ring: ReadonlyArray<Pt>): number {
  let twice = 0
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length]
    twice += x0 * y1 - x1 * y0
  }
  return Math.abs(twice / 2)
}

/** Material centroid: hole area is removed regardless of ring winding. */
function contourCentroid(contour: Contour): Pt {
  const outerC = polyCentroid(contour.outer.pts)
  const outerA = ringArea(contour.outer.pts)
  let area = outerA, x = outerC[0] * outerA, y = outerC[1] * outerA
  for (const hole of contour.holes) {
    const holeA = ringArea(hole.pts), holeC = polyCentroid(hole.pts)
    area -= holeA; x -= holeC[0] * holeA; y -= holeC[1] * holeA
  }
  return area > 1e-6 ? [x / area, y / area] : outerC
}

/** Node positions along an axis at fixed `step` with a phase offset, spanning [min, max]. */
function axisFrom(min: number, max: number, step: number, phase: number): number[] {
  if (step <= 0 || max <= min) return [(min + max) / 2]
  const res: number[] = []
  let x = min + (((phase % step) + step) % step)
  while (x - step >= min - 1e-6) x -= step
  for (; x <= max + 1e-6; x += step) if (x >= min - 1e-6) res.push(x)
  return res
}

/** Lattice across the bbox at PHASE (ox, oy). Pattern selects a subset of the 48mm lattice.
 *  `checker` (diamond only): which checkerboard half of the main lattice to keep (0 | 1). */
function latticeAt(bb: BBox, pitch: number, pattern: GridPattern, ox: number, oy: number, checker = 0): Pt[] {
  const out: Pt[] = []
  const cross = (xs: number[], ys: number[]) => { for (const x of xs) for (const y of ys) out.push([x, y]) }
  if (pattern === 'quincunx') {
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox), axisFrom(bb.minY, bb.maxY, pitch, oy))
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox + pitch / 2), axisFrom(bb.minY, bb.maxY, pitch, oy + pitch / 2))
  } else if (pattern === 'diamond') {
    // checkerboard on the main lattice: keep nodes where (ix+iy) parity matches → alternating diagonal
    // set (nearest neighbours at pitch·√2). Both parities are tried by the placement search.
    const xs = axisFrom(bb.minX, bb.maxX, pitch, ox), ys = axisFrom(bb.minY, bb.maxY, pitch, oy)
    for (let i = 0; i < xs.length; i++) for (let j = 0; j < ys.length; j++) {
      if ((i + j) % 2 === checker) out.push([xs[i], ys[j]])
    }
  } else {
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox), axisFrom(bb.minY, bb.maxY, pitch, oy))
  }
  const seen = new Set<string>(); const uniq: Pt[] = []
  for (const p of out) { const k = p[0].toFixed(2) + ',' + p[1].toFixed(2); if (!seen.has(k)) { seen.add(k); uniq.push(p) } }
  return uniq
}

/** Greedy min-spacing thinning: keep only magnets whose application rings never overlap — no two centres
 *  closer than `minDist` (= 2× the padding radius). Deepest-in-material anchors are kept first, then the
 *  most central. */
function thinBySpacing(pts: Pt[], minDist: number, contour: Contour, c: Pt): Pt[] {
  const ranked = pts
    .map((p) => ({ p, d: distToContour(p, contour), r: dist(p, c) }))
    .sort((a, b) => b.d - a.d || a.r - b.r) // deepest in material first, then most central
  const kept: Pt[] = []
  for (const { p } of ranked) {
    let clear = true
    for (const q of kept) if (dist(p, q) < minDist - 1e-6) { clear = false; break }
    if (clear) kept.push(p)
  }
  return kept
}

/** Outline points further than `reach` from the nearest magnet (uncovered/flap-risk). Samples ALONG
 *  the edges (step ≤ reach/2), not just polygon vertices — a low-poly shape (diamond = 4 verts,
 *  triangle = 3) would otherwise leave its long edge-midpoints unchecked and falsely "hold" with a
 *  handful of corner magnets. Shape-agnostic: high-poly shapes were always fine; this makes low-poly
 *  ones obey the same hold-coverage law. */
function flapVerts(contour: Contour, seated: ReadonlyArray<Pt>, reach: number): Pt[] {
  const step = reach / 2
  const out: Pt[] = []
  const check = (p: Pt) => {
    let nd = Infinity
    for (const a of seated) { const d = dist(p, a); if (d < nd) nd = d }
    if (nd > reach) out.push(p)
  }
  for (const ring of [contour.outer, ...contour.holes]) {
    const pts = ring.pts
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      check(a)
      const segLen = dist(a, b)
      const k = Math.floor(segLen / step)
      for (let j = 1; j <= k; j++) {
        const t = (j * step) / segLen
        check([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
      }
    }
  }
  return out
}

/** Contiguous uncovered samples on each closed outline ring. The wrap merge makes one region when a
 *  flap crosses a ring's array boundary, so rescue is per physical gap rather than per vertex index. */
function flapRegions(contour: Contour, seated: ReadonlyArray<Pt>, reach: number): Pt[][] {
  const step = reach / 2
  const uncovered = (p: Pt) => seated.every((a) => dist(p, a) > reach)
  const out: Pt[][] = []
  for (const ring of [contour.outer, ...contour.holes]) {
    const samples: Pt[] = []
    const pts = ring.pts
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      samples.push(a)
      const segLen = dist(a, b)
      const k = Math.floor(segLen / step)
      for (let j = 1; j <= k; j++) {
        const t = (j * step) / segLen
        samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
      }
    }
    const groups: Pt[][] = []
    let current: Pt[] = []
    for (const p of samples) {
      if (uncovered(p)) current.push(p)
      else if (current.length) { groups.push(current); current = [] }
    }
    if (current.length) groups.push(current)
    if (groups.length > 1 && samples.length && uncovered(samples[0]) && uncovered(samples[samples.length - 1])) {
      groups[0] = [...groups[groups.length - 1], ...groups[0]]
      groups.pop()
    }
    out.push(...groups)
  }
  return out
}

/** Region-local off-lattice fallback. Among safe, spacing-valid material points that improve this flap,
 *  prefer the point covering most samples, then the deepest point in material. */
function deepestSafePointForRegion(
  contour: Contour,
  region: ReadonlyArray<Pt>,
  pad: number,
  seated: ReadonlyArray<Pt>,
): Pt | null {
  if (!region.length) return null
  const rb = bbox(region)
  const minX = rb.minX - pad, maxX = rb.maxX + pad
  const minY = rb.minY - pad, maxY = rb.maxY + pad
  const step = Math.max(1, Math.min(maxX - minX, maxY - minY) / 24)
  let best: Pt | null = null, bestGain = 0, bestDepth = -1
  for (let x = minX; x <= maxX; x += step) for (let y = minY; y <= maxY; y += step) {
    const p: Pt = [x, y]
    if (!pointInContour(p, contour)) continue
    const depth = distToContour(p, contour)
    if (depth < pad) continue
    if (seated.some((a) => dist(p, a) < 2 * pad - 1e-6)) continue
    let gain = 0
    for (const flap of region) if (dist(p, flap) <= HOLD_REACH_MM) gain++
    if (gain > bestGain || (gain === bestGain && gain > 0 && depth > bestDepth)) {
      best = p; bestGain = gain; bestDepth = depth
    }
  }
  return best
}

/** Perimeter split: a node is INTERIOR when it has seated neighbours on all four sides (within `step`).
 *  Returns [perimeter, interior]. Thin shapes have no fully-surrounded node → everything is perimeter. */
function splitPerimeter(seated: ReadonlyArray<Pt>, step: number): { belt: Pt[]; interior: Pt[] } {
  const R = step * 1.45
  const belt: Pt[] = [], interior: Pt[] = []
  for (let i = 0; i < seated.length; i++) {
    const p = seated[i]
    let l = false, r = false, u = false, d = false
    for (let j = 0; j < seated.length; j++) {
      if (j === i) continue
      const dx = seated[j][0] - p[0], dy = seated[j][1] - p[1]
      if (Math.hypot(dx, dy) > R) continue
      if (dx > 1) r = true; else if (dx < -1) l = true
      if (dy > 1) u = true; else if (dy < -1) d = true
    }
    if (l && r && u && d) interior.push(p); else belt.push(p)
  }
  return { belt, interior }
}
function neighbourStep(pitch: number, pattern: GridPattern): number {
  return pattern === 'quincunx' ? pitch / Math.SQRT2
    : pattern === 'diamond' ? pitch * Math.SQRT2 // checkerboard: nearest kept neighbours are diagonal
    : pitch
}

/** Per-anchor magnet size. corners8 → 8mm at the RADIAL EXTREMES — the anchors farthest from the
 *  layout's centre, which are the true focal points on ANY geometry (a square's corners, a rotated
 *  diamond's vertices, a star's tips). The old bbox-corner test missed every rotated shape. */
function assignSizes(seated: Pt[], plan: MagnetPlan, effectSizeMM: number): Anchor[] {
  if (plan === 'all8') return seated.map((p) => ({ p, dia: 8 as MagnetDia }))
  if (plan === 'all6' || seated.length === 0) return seated.map((p) => ({ p, dia: 6 as MagnetDia }))
  if (plan === 'auto' && effectSizeMM <= FOCAL_SIZE_MM) return seated.map((p) => ({ p, dia: 6 as MagnetDia }))
  let cx = 0, cy = 0
  for (const p of seated) { cx += p[0]; cy += p[1] }
  cx /= seated.length; cy /= seated.length
  const radii = seated.map((p) => Math.hypot(p[0] - cx, p[1] - cy))
  const maxR = Math.max(...radii)
  // focal window: the radial extremes; on the auto plan it WIDENS proportionally past RAMP2 (§10.7 —
  // bigger/heavier pieces get more 8mm focal anchors, the interior stays 6mm)
  const widen = plan === 'auto' && effectSizeMM >= FOCAL_RAMP2_MM
  const cut = widen ? maxR * 0.75 : maxR - 1.5
  return seated.map((p, i) => ({ p, dia: (maxR > 1 && radii[i] >= cut ? 8 : 6) as MagnetDia }))
}

/**
 * Magnet grid for a silhouette contour (mm). Phase-optimizes the fixed-pitch lattice to seat the MOST
 * magnets on material (max coverage per axis — never collapses), then in perimeter mode drops only the
 * fully-surrounded interior nodes (a magnetic belt). Each magnet keeps its application ring on material.
 */
export function computeGrid(contourMM: Contour, cfg: GridConfig = {}): GridResult {
  const attachment: Attachment = cfg.attachment ?? 'magnetic'
  // VELCRO LAW: no grid exists — the back is a full velcro hook in the silhouette. Any shape, any
  // size; nothing to seat, nothing to cover. (Engine-owned: ladders, auto and UI all inherit.)
  if (attachment === 'velcro') {
    return {
      attachment, twinRequired: false, anchors: [], rescueAnchors: [], candidates: [], flaps: [], ok: true,
      issues: [], pitchCentreMM: 0, edgeRangeMM: [0, 0], applicationPadMM: 0,
    }
  }
  // GLOBAL LAW (48/68 system): dice centres live at half-pitch — quincunx below 96 would put anchors
  // on 24-offsets (34mm links), which do not exist in the system. Enforced HERE so every caller
  // (manual pins, auto search, ladder solver, app) inherits it; pitchCentreMM reports the truth.
  const reqPitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
  if (!(LAUNCH_PITCHES_MM as readonly number[]).includes(reqPitch)) {
    throw new RangeError(`Unsupported magnetic-grid pitch ${reqPitch}mm; launch pitches are 48mm and 96mm.`)
  }
  const pitch = (cfg.pattern === 'quincunx' && reqPitch < 96) ? 96 : reqPitch
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const pattern = cfg.pattern ?? 'standard'
  const plan = cfg.plan ?? 'auto'
  // GLOBAL LAW (amended, Dan 2026-07-21): the perimeter belt applies to STANDARD and DIAMOND — a
  // diamond's outer 68-ring stands alone, its inner anchors are removable. Only DICE is forced full:
  // its centre magnets ARE the pattern (stripping them leaves plain corners). Every consumer inherits.
  const perimeterOnly = pattern === 'quincunx' ? false : (cfg.perimeterOnly ?? true)
  const centerMode = cfg.center ?? 'centroid'
  const outer = contourMM.outer.pts
  const bb = bbox(outer)
  const issues: string[] = []

  // A node is VALID = inside the silhouette AND its application zone is present. Per node against the
  // REAL outline (no erosion — pinched shapes keep all regions). The full pad ring inside is ideal; a
  // convex corner ROUNDING may clip it (the real 70mm product's corner magnets sit ~9mm from the corner
  // arc and hold — standard rungs must seat their canonical grid at exact size, no margin). Accepted
  // only when BOTH hold: pad deficit within the corner tolerance AND most of the ring present — so
  // encroachment on straight edges / thin arms stays invalid.
  const ringCoverage = (p: Pt): number => {
    const N = 24
    let inside = 0
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2
      if (pointInContour([p[0] + pad * Math.cos(t), p[1] + pad * Math.sin(t)], contourMM)) inside++
    }
    return inside / N
  }
  const valid = (p: Pt) => {
    if (!pointInContour(p, contourMM)) return false
    const d = distToContour(p, contourMM)
    if (d >= pad) return true
    if (cfg.strictPad) return false
    return d >= pad - PAD_CORNER_TOL_MM && ringCoverage(p) >= RING_COVERAGE_MIN
  }

  // FINALIZE a candidate seed into the layout the user actually gets: coverage-verified perimeter belt
  // + light 1·3·4·6 thinning. Placement parities are judged on THIS final layout (not the raw seed) —
  // the old raw-seat-count scoring let a 5-node cross beat a 4-node box, and after the belt dropped the
  // cross's centre the user saw a diamond-arranged result under the STANDARD pattern.
  const finalize = (seed: Pt[]): { seated: Pt[]; interior: Pt[]; rescues: Pt[] } => {
    let seated = seed
    let interior: Pt[] = []
    const rescues: Pt[] = []
    if (perimeterOnly && seated.length > 4) {
      const split = splitPerimeter(seated, neighbourStep(pitch, pattern))
      if (split.belt.length >= MIN_ANCHORS || cfg.rescueCoverage) {
        // COVERAGE-VERIFIED belt (shape-agnostic): dropping an "interior" node must never uncover the
        // rim — on curved/concave shapes a surrounded node can still be the closest cover for a dip.
        const belt = split.belt.slice()
        const pool = split.interior.slice()
        if (!cfg.rescueCoverage) {
          let uncovered = flapVerts(contourMM, belt, HOLD_REACH_MM)
          const fullUncovered = flapVerts(contourMM, seed, HOLD_REACH_MM).length
          while (uncovered.length > fullUncovered && pool.length) {
            let bi = -1, bestGain = 0
            for (let i = 0; i < pool.length; i++) {
              let gain = 0
              for (const v of uncovered) if (dist(v, pool[i]) <= HOLD_REACH_MM) gain++
              if (gain > bestGain) { bestGain = gain; bi = i }
            }
            if (bi < 0) break // no interior node can help — residual is a genuine size/pitch problem
            belt.push(pool[bi]); pool.splice(bi, 1)
            uncovered = flapVerts(contourMM, belt, HOLD_REACH_MM)
          }
        }
        seated = belt; interior = pool
      }
    }
    // LIGHT thinning — 1·3·4·6 (Dan: "keep central 3-4, remove 2 and 5") — along the belt edges only;
    // corners always stay; interior nodes (full-grid mode) thin on the axis cross.
    // LIGHT 1·3·4·6 thinning is a STANDARD-rows law only — a diamond ring's midpoints are structural
    // 68-links, not crowd (thinning them broke the 224 diamond); dice never reaches here (full).
    if (cfg.sparseThin && pattern === 'standard' && pitch === 48 && seated.length >= 5) {
      const r1 = (v: number) => Math.round(v * 10) / 10
      const mains = (vals: number[]): number[] => {
        const u0 = [...new Set(vals.map(r1))].sort((a, b) => a - b)
        return u0.filter((v) => { const m = (((v - u0[0]) % pitch) + pitch) % pitch; return m < 1 || m > pitch - 1 })
      }
      const axisKeep = (u: number[]): Set<number> => {
        if (u.length < 5) return new Set(u)
        const keep = new Set<number>()
        let i = 0, j = u.length - 1, take = true
        while (i <= j) { if (take) { keep.add(u[i]); keep.add(u[j]) } i++; j--; take = !take }
        return keep
      }
      const xs = mains(seed.map((p) => p[0])), ys = mains(seed.map((p) => p[1]))
      if (xs.length >= 5 || ys.length >= 5) {
        const kx = axisKeep(xs), ky = axisKeep(ys)
        const isEnd = (v: number, u: number[]) => u.length > 0 && (Math.abs(v - u[0]) < 1 || Math.abs(v - u[u.length - 1]) < 1)
        const thinned = seated.filter((p) => {
          const x = r1(p[0]), y = r1(p[1])
          const endX = isEnd(x, xs), endY = isEnd(y, ys)
          if (endX && endY) return true
          if (endY) return kx.has(x)
          if (endX) return ky.has(y)
          return kx.has(x) && ky.has(y)
        })
        if (thinned.length >= MIN_ANCHORS) seated = thinned
      }
    }
    if (cfg.rescueCoverage && perimeterOnly && seated.length) {
      // The rescue pool is every safe lattice node omitted from the final belt (interior drop or Light
      // thinning). Each original uncovered region is solved greedily with the minimum improving nodes.
      const same = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6
      const pool = seed.filter((p) => !seated.some((a) => same(a, p)))
      const regions = flapRegions(contourMM, seated, HOLD_REACH_MM)
      for (const region of regions) {
        let remaining = region.filter((p) => seated.every((a) => dist(p, a) > HOLD_REACH_MM))
        while (remaining.length && pool.length) {
          let bi = -1, bestGain = 0
          for (let i = 0; i < pool.length; i++) {
            if (seated.some((a) => dist(pool[i], a) < 2 * pad - 1e-6)) continue
            let gain = 0
            for (const flap of remaining) if (dist(flap, pool[i]) <= HOLD_REACH_MM) gain++
            if (gain > bestGain) { bi = i; bestGain = gain }
          }
          if (bi < 0) break
          const rescue = pool.splice(bi, 1)[0]
          seated.push(rescue); rescues.push(rescue)
          remaining = remaining.filter((p) => dist(p, rescue) > HOLD_REACH_MM)
        }
        if (remaining.length) {
          const rescue = deepestSafePointForRegion(contourMM, remaining, pad, seated)
          if (rescue) { seated.push(rescue); rescues.push(rescue) }
          // No safe improving point is an honest residual flap; the final verdict stays red.
        }
      }
      interior = pool
    }
    return { seated, interior, rescues }
  }

  // CENTER the fixed grid on the shape — balanced by construction (the grid translates as a rigid bulk).
  // A/B: centroid balances MATERIAL (lopsided shapes); bbox-centre balances the FRAME (regular shapes).
  // Each parity's FINAL layout is scored by: coverage (fewest uncovered outline points) → PATTERN
  // CONFORMANCE (nearest-neighbour spacing must match the pattern's own geometry: standard = pitch,
  // quincunx = pitch/√2, diamond = pitch·√2 — a standard grid must read as straight pitch-spaced rows,
  // never a rotated/diamond arrangement) → most seated → best centred.
  let seated: Pt[] = []
  let interior: Pt[] = []
  let rescues: Pt[] = []
  {
    const c: Pt = centerMode === 'bbox'
      ? [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
      : contourCentroid(contourMM)
    const ox0 = (((c[0] - bb.minX) % pitch) + pitch) % pitch
    const oy0 = (((c[1] - bb.minY) % pitch) + pitch) % pitch
    const h = pitch / 2
    const oxs = [ox0, (ox0 + h) % pitch], oys = [oy0, (oy0 + h) % pitch]
    // no two magnets closer than 2× the application radius → their padding rings can never overlap
    const minSpacing = 2 * pad
    const checkers = pattern === 'diamond' ? [0, 1] : [0] // diamond: try both checkerboard halves
    const expectedMp = neighbourStep(pitch, pattern)
    type Cand = { fin: { seated: Pt[]; interior: Pt[]; rescues: Pt[] }; flapN: number; conform: number; bal: number }
    const cands: Cand[] = []
    for (const px of oxs) for (const py of oys) for (const ck of checkers) {
      const nodes = latticeAt(bb, pitch, pattern, px, py, ck)
      const seat = thinBySpacing(nodes.filter(valid), minSpacing, contourMM, c)
      const fin = finalize(seat)
      const flapN = fin.seated.length ? flapVerts(contourMM, fin.seated, HOLD_REACH_MM).length : outer.length
      let mp = Infinity
      for (let i = 0; i < fin.seated.length; i++) for (let j = i + 1; j < fin.seated.length; j++) {
        const d = dist(fin.seated[i], fin.seated[j]); if (d < mp) mp = d
      }
      const conform = fin.seated.length < 2 ? 1 : Math.abs(mp - expectedMp) < 2 ? 1 : 0
      let sx = 0, sy = 0; for (const p of fin.seated) { sx += p[0]; sy += p[1] }
      const bal = fin.seated.length ? Math.hypot(sx / fin.seated.length - c[0], sy / fin.seated.length - c[1]) : 1e9
      cands.push({ fin, flapN, conform, bal })
    }
    // STANDARD and DIAMOND are HARD conformance laws (Dan): standard shows straight pitch-spaced rows
    // or nothing; diamond shows 68-atom (pitch·√2) links or nothing — neither may quietly resolve into
    // the other's arrangement (the honest outcome is flaps + margin growth, or switching mode). Dice
    // keeps coverage-first (its geometry is inherently the mix).
    const pool = (pattern === 'standard' || pattern === 'diamond') && cands.some((k) => k.conform === 1 && k.fin.seated.length >= MIN_ANCHORS)
      ? cands.filter((k) => k.conform === 1)
      : cands
    let bestKey: [number, number, number, number] | null = null
    for (const k of pool) {
      const key: [number, number, number, number] = [k.flapN, -k.conform, -k.fin.seated.length, k.bal]
      const better = !bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1]
        || (key[1] === bestKey[1] && (key[2] < bestKey[2] || (key[2] === bestKey[2] && key[3] < bestKey[3])))))
      if (better) { bestKey = key; seated = k.fin.seated; interior = k.fin.interior; rescues = k.fin.rescues }
    }
  }

  // GUARANTEE ≥1: if the sparse grid seated nothing but the shape can still hold a magnet, drop one at the
  // deepest interior point (a single magnet has no spacing to honour, so grid phase is moot here).
  if (seated.length === 0) {
    const dp = deepestPoint(contourMM, bb)
    if (dp && dp.d >= pad) { seated = [dp.p]; interior = []; if (cfg.rescueCoverage) rescues = [dp.p] }
  }
  const anchors = assignSizes(seated, plan, Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY))

  if (!seated.length) issues.push(`No room for a magnet — too small/thin to keep a magnet ${pad}mm from every edge.`)
  else if (seated.length < MIN_ANCHORS) issues.push(`Too small — only ${seated.length} magnet grips material. Increase the size or the max auto-grow.`)
  const flaps: Pt[] = seated.length ? flapVerts(contourMM, seated, HOLD_REACH_MM) : []
  if (flaps.length > 0) issues.push(`Some edge areas sit more than ${HOLD_REACH_MM}mm from a magnet (red edge) and could lift. Raise the size / max auto-grow.`)

  let minD = 8, maxD = 6
  for (const a of anchors) { if (a.dia < minD) minD = a.dia; if (a.dia > maxD) maxD = a.dia }
  if (anchors.length === 0) { minD = 6; maxD = 6 }

  return {
    attachment, twinRequired: attachment === 'twinfix', anchors, rescueAnchors: rescues, candidates: interior, flaps,
    ok: issues.length === 0,
    issues,
    pitchCentreMM: pitch,
    edgeRangeMM: [pitch + minD, pitch + maxD],
    applicationPadMM: pad,
  }
}


// ─── LAUNCH LAW (§13, locked 2026-07-21) — 48-family only, procedural zero-point ladder ──────────────
// Launch pitches = 48/96 exclusively. Retired 24/72 pitches have no launch or admin exception.
/** Grid density preference: 'light' tries the coarse 96 first (sparse, uncrowded — the garment
 *  aesthetic); 'standard' tries 48 first (denser, firmer hold). Same family either way. */
export type GridDensity = 'standard' | 'light'
function allowedPitches(density: GridDensity): number[] { return density === 'standard' ? [48, 96] : [96, 48] }
/** MERGED COVERAGE LAW (Dan 2026-07-21 — simplify controls): density IS the coverage — 'standard' =
 *  dense/full grid (all interior kept), 'light' = sparse/perimeter belt (interior dropped) + thinning.
 *  Dice always full (its centres ARE the pattern). One control; the old separate Coverage toggle retired. */
export function perimeterForDensity(density: GridDensity, pattern: GridPattern): boolean {
  if (pattern === 'quincunx') return false
  return density === 'light'
}
/** Legal patterns per pitch under the 48/68 system: dice centres live at half-pitch, so quincunx is
 *  legal ONLY at 96 (centres at 48-offsets = the shirt's own dice). Nothing ever sits at 24-offsets. */
export function legalPatterns(pitchMM: number): GridPattern[] {
  if (pitchMM === 96) return ['standard', 'diamond', 'quincunx']
  if (pitchMM === 48) return ['standard', 'diamond']
  return []
}
/** The admin LAW INPUTS that generate every size procedurally — no hand-picked numbers. */
export interface SizeLaw {
  paddingMM: number   // mag-safe radius from magnet centre (default 10)
  frameMM: number     // frame stroke per side (default 1; 0 = frameless… padding then absorbs it)
  maxTestedMM: number // largest physically tested size → rungs above ship hidden (default 214)
  maxRungMM: number   // generator stop (default 310 — the 4-column shirt max)
}
export const DEFAULT_LAW: SizeLaw = { paddingMM: 10, frameMM: 1, maxTestedMM: 214, maxRungMM: 310 }

/** LAW: random/AI-cut silhouettes are capped below the preset range until physically tested. */
export const RANDOM_SHAPE_MAX_MM = 180
/** LAW: the max design size per shape SOURCE — standard geometries and curated presets span the full
 *  system range (maxRungMM); only generated/AI-cut randoms carry the untested cap. */
export function maxDesignMM(source: 'std' | 'preset' | 'gen' | 'magic', law: SizeLaw = DEFAULT_LAW): number {
  return source === 'gen' || source === 'magic' ? RANDOM_SHAPE_MAX_MM : law.maxRungMM
}
/** LAW: the default auto-margin allowance — the outward band the system may add to reach balance.
 *  (Dan 2026-07-21: keep 12 for testing.) Part of the sizing law: semantic sizes are solved WITH this
 *  allowance, exactly like the live placement — a solver stricter than the engine lies about sizes. */
export const DEFAULT_MARGIN_MM = 12
/** LAW: the smallest effect is the single-point (ONE) size — one magnet with its full pad ring. */
export function minEffectMM(law: SizeLaw = DEFAULT_LAW): number { return 2 * (law.paddingMM + law.frameMM) }
/** LAW: resolve a requested design size against the selected source's complete product bounds. */
export function resolveDesignSizeMM(
  requestedMM: number,
  source: 'std' | 'preset' | 'gen' | 'magic',
  law: SizeLaw = DEFAULT_LAW,
): number {
  return Math.max(minEffectMM(law), Math.min(requestedMM, maxDesignMM(source, law)))
}
/** LAW: rectangle format families by aspect ratio (product naming, not navigation). */
export function rectFormat(wMM: number, hMM: number): 'strip' | 'panoramic' | 'block' {
  const r = Math.max(wMM, hMM) / Math.min(wMM, hMM)
  return r >= 2.5 ? 'strip' : r >= 1.6 ? 'panoramic' : 'block'
}
/** LAW: the standard geometry recipes (product shape definitions — square, its rotated diamond twin,
 *  circle, equilateral triangle, rectangle). Drawn directly in mm; app + bench share these. */
export type StdShape = 'square' | 'rect' | 'circle' | 'triangle' | 'diamondShape'
export function stdShapeContour(shape: StdShape, wMM: number, hMM: number = wMM): Contour {
  if (shape === 'circle') {
    const r = wMM / 2, pts: Pt[] = []
    for (let i = 0; i < 96; i++) { const t = (i / 96) * Math.PI * 2; pts.push([r + r * Math.cos(t), r + r * Math.sin(t)]) }
    return { outer: { pts }, holes: [] }
  }
  if (shape === 'triangle') return { outer: { pts: [[0, 0], [wMM, 0], [wMM / 2, wMM * Math.sqrt(3) / 2]] as Pt[] }, holes: [] }
  if (shape === 'diamondShape') return { outer: { pts: [[wMM / 2, 0], [wMM, hMM / 2], [wMM / 2, hMM], [0, hMM / 2]] as Pt[] }, holes: [] }
  return { outer: { pts: [[0, 0], [wMM, 0], [wMM, hMM], [0, hMM]] as Pt[] }, holes: [] } // square / rect
}




/** GRID MODE — the four user-facing modes (§ goal 2026-07-21):
 *  auto = everything legal + a deepest-material fallback for irregular shapes · standard = straight (48-atom)
 *  links only · quincunx (dice) = the standard+diamond mix (96 pitch) · diamond = diagonal (68-atom)
 *  links only. */
export type GridMode = 'auto' | GridPattern
function modeCombos(mode: GridMode): { pitchMM: number; pattern: GridPattern }[] {
  const std = [{ pitchMM: 48, pattern: 'standard' as GridPattern }, { pitchMM: 96, pattern: 'standard' as GridPattern }]
  const dia = [{ pitchMM: 48, pattern: 'diamond' as GridPattern }, { pitchMM: 96, pattern: 'diamond' as GridPattern }]
  const dice = [{ pitchMM: 96, pattern: 'quincunx' as GridPattern }]
  return mode === 'standard' ? std : mode === 'diamond' ? dia : mode === 'quincunx' ? dice : [...std, ...dia, ...dice]
}

/** SEMANTIC SIZES (Dan, 2026-07-21): every shape carries its own T-shirt ladder keyed by ANCHOR COUNT.
 *  The mm under each sequential label is solved numerically per shape from the live inputs (padding +
 *  frame/margin + mode), so changing the recipe or mode recomputes every size. Strict pad law (sizing),
 *  perimeter belt. Labels continue past 3XL when legal rungs remain under maxRungMM. */
export interface SemanticRung { label: string; points: number; sizeMM: number; visible: boolean }
export type SemanticRungTieBreak = 'higher' | 'first'

/** Select the closest semantic rung. Exact ties are explicit so each semantic door cannot drift. */
export function nearestSemanticRung(
  rungs: ReadonlyArray<SemanticRung>,
  targetMM: number,
  tieBreak: SemanticRungTieBreak = 'higher',
): SemanticRung {
  return rungs.reduce((best, rung) => {
    const nextDistance = Math.abs(rung.sizeMM - targetMM)
    const bestDistance = Math.abs(best.sizeMM - targetMM)
    if (nextDistance < bestDistance) return rung
    if (nextDistance > bestDistance || tieBreak === 'first') return best
    return rung.sizeMM > best.sizeMM ? rung : best
  })
}

export interface RectangleRungResolution {
  longRung: SemanticRung
  shortRung: SemanticRung
  widthRung: SemanticRung
  heightRung: SemanticRung
  longOptions: SemanticRung[]
  shortOptions: SemanticRung[]
}

/** Rectangle system A: legal long/short options and orientation are one engine-owned selection. */
export function resolveRectangleRungs(
  rungs: ReadonlyArray<SemanticRung>,
  opts: { longMM: number; shortMM: number; orientation: 'landscape' | 'portrait' },
): RectangleRungResolution {
  const longRung = nearestSemanticRung(rungs, opts.longMM)
  const shortOptions = rungs.filter((rung) => rung.sizeMM < longRung.sizeMM)
  const shortRung = shortOptions.length
    ? nearestSemanticRung(shortOptions, opts.shortMM)
    : longRung
  const landscape = opts.orientation === 'landscape'
  return {
    longRung,
    shortRung,
    widthRung: landscape ? longRung : shortRung,
    heightRung: landscape ? shortRung : longRung,
    longOptions: rungs.filter((rung) => rung.points >= 2),
    shortOptions,
  }
}
/** Garment-band labels by REAL mm (matches the product canon: 70=S, ~118=M, ~166=L, ~214=XL). A rung
 *  is labeled by the band its solved size falls in, bumping on collision — so each shape naturally
 *  spans its own label range (small shapes reach into 2XS/XS, chunky ones start at L). */
const SIZE_BANDS: ReadonlyArray<readonly [number, string]> = [
  [36, '2XS'], [60, 'XS'], [100, 'S'], [140, 'M'], [190, 'L'], [240, 'XL'], [290, '2XL'], [Infinity, '3XL'],
]
const BASE_BAND_LABELS = ['2XS', 'XS', 'S', 'M', 'L', 'XL']
function bandLabel(idx: number): string {
  return idx < BASE_BAND_LABELS.length ? BASE_BAND_LABELS[idx] : `${idx - BASE_BAND_LABELS.length + 2}XL`
}
interface SemanticStep {
  points: number
  sizeMM: number
  patterns: GridPattern[]
}

function semanticSteps(
  makeShape: (sizeMM: number) => Contour,
  law: SizeLaw,
  combos: ReadonlyArray<{ pitchMM: number; pattern: GridPattern }>,
): SemanticStep[] {
  const padEff = law.paddingMM + law.frameMM
  // TWO-TIER SIZE LAW: (1) canonical rungs are EXACT zero-points — the shape holds flap-free at that
  // very size, margin 0, strict pad (sharp geometry; the 70/118/166/214 canon). (2) Only when a
  // mode×shape has NO exact multi-point size at all (a triangle's tips under diamond links) does the
  // solver fall back to the live margin mechanism (band-assisted, recording TOTAL size) — the ladder
  // then shows the true sizes the system actually produces. Never mixed: exact stays exact.
  const solve = (banded: boolean): SemanticStep[] => {
    const steps: SemanticStep[] = []
    let last = 0
    for (let s = Math.ceil(2 * padEff); s <= law.maxRungMM; s += banded ? 2 : 1) {
      let best = 0, bestTotal = s
      const bestPatterns = new Set<GridPattern>()
      for (const cb of combos) {
        const cfg: GridConfig = { pitchMM: cb.pitchMM, pattern: cb.pattern, paddingMM: padEff, perimeterOnly: cb.pattern === 'standard', strictPad: true }
        if (!banded) {
          const g = computeGrid(makeShape(s), cfg)
          if (g.flaps.length) continue
          if (g.anchors.length > best) {
            best = g.anchors.length; bestPatterns.clear(); bestPatterns.add(cb.pattern)
          } else if (g.anchors.length === best && best > 0) bestPatterns.add(cb.pattern)
        } else {
          const design = makeShape(s)
          const w = (m: number): Contour => contourWithOuterMargin(design, m)
          const fit = balancedFit(w, cfg, 0, DEFAULT_MARGIN_MM)
          if (fit.grid.flaps.length) continue
          if (fit.grid.anchors.length > best) {
            best = fit.grid.anchors.length
            bestPatterns.clear(); bestPatterns.add(cb.pattern)
            const eff = w(fit.sizeMM)
            const bb = eff.outer.pts.reduce((a, [x, y]) => [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)], [Infinity, Infinity, -Infinity, -Infinity])
            bestTotal = Math.round(Math.max(bb[2] - bb[0], bb[3] - bb[1]))
          } else if (fit.grid.anchors.length === best && best > 0) bestPatterns.add(cb.pattern)
        }
      }
      if (best > last && bestTotal <= law.maxRungMM && bestTotal > (steps.length ? steps[steps.length - 1].sizeMM : 0)) {
        steps.push({ points: best, sizeMM: bestTotal, patterns: [...bestPatterns] }); last = best
      }
    }
    return steps
  }
  // exact zero-points are canonical; the band-assisted solve (the live margin mechanism) then EXTENDS
  // the ladder wherever exact sizes run out — both for fully-empty ladders (triangle tips) and for
  // shapes whose exact sizes stop short of the system max (a rotated square's 90° vertices exceed the
  // hold reach at exact size beyond ~224). Union: exact first, banded steps only above the exact
  // ceiling (higher count AND larger size), so no canon size ever shifts.
  let steps = solve(false)
  // The band-assisted pass is much more expensive (each size probes several margin steps). Do not run
  // it when the exact ladder already reaches the configured ceiling; it cannot add a larger legal rung.
  const exactNeedsExtension = !steps.some((st) => st.points >= 2)
    || Math.max(...steps.map((st) => st.sizeMM)) < law.maxRungMM
  const banded = exactNeedsExtension ? solve(true) : []
  if (!steps.some((st) => st.points >= 2)) {
    steps = banded
  } else {
    const maxPts = Math.max(...steps.map((st) => st.points))
    const maxSize = Math.max(...steps.map((st) => st.sizeMM))
    for (const st of banded) if (st.points > maxPts && st.sizeMM > maxSize) steps.push(st)
    steps.sort((a, b) => a.sizeMM - b.sizeMM)
  }
  return steps
}

function labelSemanticSteps(steps: ReadonlyArray<SemanticStep>, law: SizeLaw): SemanticRung[] {
  // LABEL LAW: the first multi-point rung anchors the sequence at its mm band (small shapes start at
  // 2XS/XS, chunky ones at M/L); every later rung takes the NEXT label — strictly sequential, no skips,
  // regardless of how far apart a mode's sizes land (Dan: each shape shows its own contiguous range).
  const rungs: SemanticRung[] = []
  let prevIdx = -1
  for (const st of steps) {
    if (st.points === 1) { rungs.push({ label: 'ONE', points: 1, sizeMM: st.sizeMM, visible: st.sizeMM <= law.maxTestedMM }); continue }
    const idx = prevIdx === -1 ? SIZE_BANDS.findIndex(([max]) => st.sizeMM < max) : prevIdx + 1
    prevIdx = idx
    rungs.push({ label: bandLabel(idx), points: st.points, sizeMM: st.sizeMM, visible: st.sizeMM <= law.maxTestedMM })
  }
  return rungs
}

export function semanticLadder(
  makeShape: (sizeMM: number) => Contour, law: SizeLaw = DEFAULT_LAW, mode: GridMode = 'auto',
): SemanticRung[] {
  return labelSemanticSteps(semanticSteps(makeShape, law, modeCombos(mode)), law)
}

/**
 * Unified auto selection (pitch × pattern) under the ONE coverage physics — no shape-name branches.
 * AUTO mode covers everything legal in the 48/68 system (standard straight, diamond diagonal, 96-dice
 * mix) and, via per-node validity + the deepest-point guarantee, can place one fallback anchor in the
 * deepest legal region of an irregular silhouette. Pin `pitchMM`/`pattern` for manual modes — they behave
 * literally. Fewest-uncovered fallback when nothing fully covers.
 */
export function autoGrid(
  withMargin: (m: number) => Contour, cfg: GridConfig, fromMM: number, maxGrowMM: number,
  opts: { minN?: number; density?: GridDensity; pitchMM?: number; pattern?: GridPattern; patterns?: ReadonlyArray<GridPattern> } = {},
): { pitchMM: number; pattern: GridPattern } {
  const minN = opts.minN ?? TARGET_ANCHORS
  let pitches = opts.pitchMM != null ? [opts.pitchMM] : allowedPitches(opts.density ?? 'light')
  // a pinned pattern restricts the pitch search to its legal pitches (dice → 96 only)
  if (opts.pattern != null) {
    const legal = pitches.filter((p) => legalPatterns(p).includes(opts.pattern!))
    pitches = legal.length ? legal : [96]
  }
  const patFor = (p: number): GridPattern[] => opts.pattern != null
    ? [opts.pattern]
    : legalPatterns(p).filter((pattern) => !opts.patterns || opts.patterns.includes(pattern))
  let fb = { pitchMM: pitches[pitches.length - 1], pattern: patFor(pitches[pitches.length - 1]).slice(-1)[0] }
  let fbFlaps = Infinity
  for (const p of pitches) for (const pat of patFor(p)) {
    const fit = balancedFit(withMargin, { ...cfg, pitchMM: p, pattern: pat }, fromMM, maxGrowMM)
    if (fit.grid.anchors.length >= minN && fit.grid.flaps.length === 0) return { pitchMM: p, pattern: pat }
    if (fit.grid.anchors.length >= MIN_ANCHORS && fit.grid.flaps.length < fbFlaps) {
      fb = { pitchMM: p, pattern: pat }; fbFlaps = fit.grid.flaps.length
    }
  }
  return fb
}

/** Scale a normalized contour (longest side = 1mm) to a real longest-side size in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  const scaleRing = (pts: ReadonlyArray<Pt>) => pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt)
  return { outer: { pts: scaleRing(base.outer.pts) }, holes: base.holes.map((h) => ({ pts: scaleRing(h.pts) })) }
}

/**
 * Sizing ADAPTS (always-on, capped): from the selected size, nudge UP in small steps up to `maxGrowMM`
 * and keep the first size that is BALANCED — full hold coverage (zero flaps: no outline point beyond
 * HOLD_REACH of a magnet) and ≥ target magnets. Coverage-by-hold is the shape-agnostic criterion (the
 * old `gaps` bbox heuristic mis-ranked curved shapes — a disc's rim always has padding-blocked nodes).
 * If nothing within the cap fully covers, keep the size with the fewest uncovered outline points (then
 * most magnets). `sized(mm)` produces the real-mm contour. `maxGrowMM = 0` disables growth.
 */
export function balancedFit(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, maxGrowMM: number,
  opts: { target?: number; step?: number } = {},
): { sizeMM: number; grid: GridResult; grew: number } {
  const target = opts.target ?? TARGET_ANCHORS
  const step = opts.step ?? 3
  const start = Math.round(fromMM)
  const end = start + Math.max(0, maxGrowMM)
  let best: { sizeMM: number; grid: GridResult } | null = null
  let bestRank = Infinity
  for (let mm = start; mm <= end; mm += step) {
    const grid = computeGrid(sized(mm), cfg)
    // perfect = fully covered AND ≥ target magnets → take the first (smallest) such size immediately
    if (grid.flaps.length === 0 && grid.anchors.length >= target) return { sizeMM: mm, grid, grew: mm - start }
    // otherwise rank: fewer uncovered points first, then more magnets (negated), then smaller size
    const rank = grid.flaps.length * 1000 - grid.anchors.length
    if (rank < bestRank) { bestRank = rank; best = { sizeMM: mm, grid } }
  }
  if (best) return { ...best, grew: best.sizeMM - start }
  const grid = computeGrid(sized(start), cfg)
  return { sizeMM: start, grid, grew: 0 }
}

// ─── PRODUCTION FACADE ──────────────────────────────────────────────────────

/** UI-agnostic inputs for resolving one final attachment grid from a real-mm contour. */
export interface GridPlanOptions {
  attachment?: Attachment
  mode?: GridMode
  density?: GridDensity
  paddingMM?: number
  plan?: MagnetPlan
  center?: 'centroid' | 'bbox'
  baseMarginMM?: number
  maxGrowMM?: number
  pitchMM?: number
  targetAnchors?: number
}

/** Complete engine verdict. A caller renders these facts; it does not reimplement their laws. */
export interface ResolvedGridPlan {
  designContourMM: Contour
  effectContourMM: Contour
  grid: GridResult
  pitchMM: number
  pattern: GridPattern | null
  baseMarginMM: number
  resolvedMarginMM: number
  grewMM: number
  nearestAnchorMM: number | null
}

/** Add/remove only the effect's OUTER margin. Interior cut-outs remain physical cut-outs. */
export function contourWithOuterMargin(contour: Contour, marginMM: number): Contour {
  if (Math.abs(marginMM) < 0.01) return contour
  const outer = insetRingMM(contour.outer.pts, marginMM, 'round')
  if (!outer || outer.length < 3) return contour
  return {
    outer: { pts: outer },
    holes: contour.holes.map((hole) => ({ pts: hole.pts.map(([x, y]) => [x, y] as Pt) })),
  }
}

export interface NearestAnchorPair {
  firstIndex: number
  secondIndex: number
  first: Anchor
  second: Anchor
  distanceMM: number
}

/** Closest seated pair, with stable first-in-iteration tie behavior for deterministic annotations. */
export function nearestAnchorPair(anchors: ReadonlyArray<Anchor>): NearestAnchorPair | null {
  let nearest: NearestAnchorPair | null = null
  for (let i = 0; i < anchors.length; i++) for (let j = i + 1; j < anchors.length; j++) {
    const distanceMM = dist(anchors[i].p, anchors[j].p)
    if (!nearest || distanceMM < nearest.distanceMM) {
      nearest = { firstIndex: i, secondIndex: j, first: anchors[i], second: anchors[j], distanceMM }
    }
  }
  return nearest
}

/**
 * Resolve the complete magnetic-grid law for a production contour. This is the portable engine seam:
 * mode legality, density/coverage, pitch selection, padding, margin adaptation, and truthful resolved
 * measurements live here once. Creator flows call one operation and render the returned facts.
 */
interface ResolverPolicy {
  autoPatterns?: ReadonlyArray<GridPattern>
  perimeterOnly?: boolean
  rescueCoverage?: boolean
  sparseThin?: boolean
  signedBaseMargin?: boolean
  diagnosticVelcro?: boolean
}

function resolveGridPlanWithPolicy(
  contourMM: Contour,
  opts: GridPlanOptions,
  policy: ResolverPolicy,
): ResolvedGridPlan {
  const attachment = opts.attachment ?? 'magnetic'
  const mode = opts.mode ?? 'auto'
  const density = opts.density ?? 'light'
  const requestedBaseMarginMM = opts.baseMarginMM ?? 0
  const baseMarginMM = policy.signedBaseMargin
    ? requestedBaseMarginMM
    : Math.max(0, requestedBaseMarginMM)
  const maxGrowMM = opts.maxGrowMM ?? DEFAULT_MARGIN_MM
  const withMargin = (marginMM: number) => contourWithOuterMargin(contourMM, marginMM)
  const manualPattern = mode === 'auto' ? undefined : mode
  const patternForCoverage = manualPattern ?? 'standard'
  const cfg: GridConfig = {
    attachment,
    paddingMM: opts.paddingMM ?? PADDING_FLOOR_MM,
    plan: opts.plan ?? 'auto',
    center: opts.center ?? 'centroid',
    perimeterOnly: policy.perimeterOnly ?? perimeterForDensity(density, patternForCoverage),
    sparseThin: policy.sparseThin ?? density === 'light',
    rescueCoverage: policy.rescueCoverage,
  }

  if (attachment === 'velcro' && !policy.diagnosticVelcro) {
    const grid = computeGrid(withMargin(baseMarginMM), { ...cfg, attachment })
    return {
      designContourMM: contourMM,
      effectContourMM: withMargin(baseMarginMM),
      grid,
      pitchMM: 0,
      pattern: null,
      baseMarginMM,
      resolvedMarginMM: baseMarginMM,
      grewMM: 0,
      nearestAnchorMM: null,
    }
  }

  const selected = autoGrid(withMargin, cfg, baseMarginMM, maxGrowMM, {
    minN: opts.targetAnchors,
    density,
    pitchMM: opts.pitchMM,
    pattern: manualPattern,
    patterns: policy.autoPatterns,
  })
  const fit = balancedFit(
    withMargin,
    { ...cfg, pitchMM: selected.pitchMM, pattern: selected.pattern },
    baseMarginMM,
    maxGrowMM,
    { target: opts.targetAnchors },
  )
  return {
    designContourMM: contourMM,
    effectContourMM: withMargin(fit.sizeMM),
    grid: fit.grid,
    pitchMM: selected.pitchMM,
    pattern: selected.pattern,
    baseMarginMM,
    resolvedMarginMM: fit.sizeMM,
    grewMM: fit.grew,
    nearestAnchorMM: nearestAnchorPair(fit.grid.anchors)?.distanceMM ?? null,
  }
}

/** Product-safe resolver: signed inward margins are clamped and Velcro has no diagnostic grid. */
export function resolveGridPlan(contourMM: Contour, opts: GridPlanOptions = {}): ResolvedGridPlan {
  return resolveGridPlanWithPolicy(contourMM, opts, {})
}

/** Full Admin resolver: preserves signed offsets and Velcro's diagnostic pitch/pattern preview. */
export function resolveAdminGridPlan(contourMM: Contour, opts: GridPlanOptions = {}): ResolvedGridPlan {
  return resolveGridPlanWithPolicy(contourMM, opts, {
    signedBaseMargin: true,
    diagnosticVelcro: true,
  })
}

/** Internal core operation behind the constrained user door. Dice is absent by construction; the final
 *  Light belt adds only coverage-improving rescue anchors. */
export function resolveUserGridPlan(contourMM: Contour, attachment: Attachment): ResolvedGridPlan {
  return resolveGridPlanWithPolicy(contourMM, { attachment }, {
    autoPatterns: ['standard', 'diamond'],
    perimeterOnly: true,
    rescueCoverage: true,
    sparseThin: true,
  })
}

/** Translation-invariant identity of the manufactured magnetic product. Positions are centred and
 *  quantized to quarter-lattice units: enough to preserve lattice topology while ignoring harmless
 *  off-lattice rescue drift between near-identical sizes. Attributed nodes carry magnet diameter and
 *  rescue membership; the edge set records local adjacency. */
export function finalProductSignature(plan: ResolvedGridPlan): string {
  const anchors = plan.grid.anchors
  if (!anchors.length || !plan.pitchMM) {
    return `${plan.grid.attachment}|${plan.pattern ?? 'none'}|${plan.pitchMM}|[]|[]`
  }
  const pitch = plan.pitchMM
  const cx = anchors.reduce((sum, anchor) => sum + anchor.p[0], 0) / anchors.length
  const cy = anchors.reduce((sum, anchor) => sum + anchor.p[1], 0) / anchors.length
  const isRescue = (p: Pt) => plan.grid.rescueAnchors.some((rescue) => dist(p, rescue) < 1e-4)
  const nodes = anchors.map((anchor) => ({
    x: Math.round(((anchor.p[0] - cx) / pitch) * 4),
    y: Math.round(((anchor.p[1] - cy) / pitch) * 4),
    dia: anchor.dia,
    rescue: isRescue(anchor.p) ? 1 : 0,
  })).sort((a, b) => a.x - b.x || a.y - b.y || a.dia - b.dia || a.rescue - b.rescue)
  const edges: string[] = []
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y
    const quarterLinks = Math.round(Math.hypot(dx, dy))
    if (quarterLinks <= 6) edges.push(`${i}-${j}:${quarterLinks}`) // local adjacency ≤ 1.5 pitches
  }
  const nodeKey = nodes.map((node) => `${node.x},${node.y},${node.dia},${node.rescue}`).join(';')
  return `${plan.grid.attachment}|${plan.pattern ?? 'none'}|${pitch}|${nodeKey}|${edges.join(';')}`
}

/** Constrained user ladder. Candidate discovery remains the existing exhaustive zero-point scan; only
 *  Standard/Diamond candidates are admitted. Each candidate is then resolved through the real user
 *  door, rejected when its theoretical winning pattern is not the product-selected pattern, and
 *  deduplicated by final-product identity. Candidate order is ascending, so the smallest survives. */
export function resolveUserSemanticLadder(
  makeShape: (sizeMM: number) => Contour,
  law: SizeLaw = DEFAULT_LAW,
): SemanticRung[] {
  const userCombos = modeCombos('auto').filter(({ pattern }) => pattern !== 'quincunx')
  const candidates = semanticSteps(makeShape, law, userCombos)
  const seen = new Set<string>()
  const products: SemanticStep[] = []
  for (const candidate of candidates) {
    const plan = resolveUserGridPlan(makeShape(candidate.sizeMM), 'magnetic')
    if (!plan.pattern || !candidate.patterns.includes(plan.pattern) || plan.grid.flaps.length) continue
    const signature = finalProductSignature(plan)
    if (seen.has(signature)) continue
    seen.add(signature)
    products.push({ ...candidate, points: plan.grid.anchors.length })
  }
  return labelSemanticSteps(products, law)
}

// ─── EXACT ASYNC/CACHE CONTRACT ─────────────────────────────────────────────

/** Manual cache contract version. Bump whenever an output-affecting engine algorithm or policy changes. */
export const GRID_ENGINE_CACHE_VERSION = 1

export type StandardLadderShape = Exclude<StdShape, 'rect'>

/** Serializable size-family identity. No function/closure crosses the worker boundary. */
export type LadderRecipe =
  | { kind: 'standard'; shape: StandardLadderShape }
  | { kind: 'uniform-contour'; unitContour: Contour }

/** Serializable identity of one exact contour to resolve. */
export type PlanRecipe =
  | { kind: 'standard'; shape: StdShape; widthMM: number; heightMM: number }
  | { kind: 'uniform-contour'; unitContour: Contour; longestMM: number }
  | { kind: 'final-contour'; contourMM: Contour }

function exactContourCopy(contour: Contour, label: string): Contour {
  const ring = (pts: ReadonlyArray<Pt>, ringLabel: string): Pt[] => {
    if (pts.length < 3) throw new RangeError(`${label} ${ringLabel} must contain at least three points.`)
    return pts.map(([x, y], index) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new RangeError(`${label} ${ringLabel} point ${index} must contain finite coordinates.`)
      }
      return [x, y] as Pt
    })
  }
  return {
    outer: { pts: ring(contour.outer.pts, 'outer ring') },
    holes: contour.holes.map((hole, index) => ({ pts: ring(hole.pts, `hole ${index}`) })),
  }
}

/** Reconstruct the exact size→Contour closure inside the engine/worker. */
export function ladderShapeFromRecipe(recipe: LadderRecipe): (sizeMM: number) => Contour {
  if (recipe.kind === 'standard') return (sizeMM) => stdShapeContour(recipe.shape, sizeMM, sizeMM)
  const unitContour = exactContourCopy(recipe.unitContour, 'Ladder recipe')
  return (sizeMM) => scaleContour(unitContour, sizeMM)
}

/** Reconstruct one exact final contour inside the engine/worker. */
export function planContourFromRecipe(recipe: PlanRecipe): Contour {
  if (recipe.kind === 'standard') {
    if (!Number.isFinite(recipe.widthMM) || !Number.isFinite(recipe.heightMM)) {
      throw new RangeError('Standard plan recipe dimensions must be finite.')
    }
    return stdShapeContour(recipe.shape, recipe.widthMM, recipe.heightMM)
  }
  if (recipe.kind === 'uniform-contour') {
    if (!Number.isFinite(recipe.longestMM)) {
      throw new RangeError('Uniform-contour plan recipe size must be finite.')
    }
    return scaleContour(exactContourCopy(recipe.unitContour, 'Plan recipe'), recipe.longestMM)
  }
  return exactContourCopy(recipe.contourMM, 'Plan recipe')
}

/** Stable, exact serialization for cache identity. Numbers are never rounded and object keys are sorted. */
export function canonicalGridCacheValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError('Grid cache identity accepts finite numbers only.')
    return Object.is(value, -0) ? '-0' : JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalGridCacheValue).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalGridCacheValue(record[key])}`).join(',')}}`
  }
  throw new TypeError(`Unsupported grid cache identity value: ${typeof value}`)
}

const GRID_ENGINE_POLICY_CONTRACT = {
  pitchesMM: [...LAUNCH_PITCHES_MM],
  paddingFloorMM: PADDING_FLOOR_MM,
  minAnchors: MIN_ANCHORS,
  targetAnchors: TARGET_ANCHORS,
  holdReachMM: HOLD_REACH_MM,
  padCornerToleranceMM: PAD_CORNER_TOL_MM,
  ringCoverageMin: RING_COVERAGE_MIN,
  focalSizeMM: FOCAL_SIZE_MM,
  focalRamp2MM: FOCAL_RAMP2_MM,
  defaultLaw: DEFAULT_LAW,
  defaultMarginMM: DEFAULT_MARGIN_MM,
  randomShapeMaxMM: RANDOM_SHAPE_MAX_MM,
  modes: {
    auto: modeCombos('auto'),
    standard: modeCombos('standard'),
    quincunx: modeCombos('quincunx'),
    diamond: modeCombos('diamond'),
  },
  user: {
    autoPatterns: ['standard', 'diamond'],
    perimeterOnly: true,
    rescueCoverage: true,
    sparseThin: true,
    ladderAttachment: 'magnetic',
  },
  admin: {
    signedBaseMargin: true,
    diagnosticVelcro: true,
  },
} as const

/** Engine-owned law/policy identity; UI and worker clients never reconstruct it. */
export const GRID_ENGINE_POLICY_SIGNATURE = canonicalGridCacheValue(GRID_ENGINE_POLICY_CONTRACT)

function normalizedLaw(law: SizeLaw = DEFAULT_LAW): SizeLaw {
  return {
    paddingMM: law.paddingMM,
    frameMM: law.frameMM,
    maxTestedMM: law.maxTestedMM,
    maxRungMM: law.maxRungMM,
  }
}

function gridCacheKey(door: 'user' | 'admin', operation: 'ladder' | 'plan', body: unknown): string {
  return canonicalGridCacheValue({
    body,
    cacheVersion: GRID_ENGINE_CACHE_VERSION,
    door,
    operation,
    policy: GRID_ENGINE_POLICY_SIGNATURE,
  })
}

export function userLadderCacheKey(recipe: LadderRecipe): string {
  ladderShapeFromRecipe(recipe) // validate before admitting a recipe to the cache
  return gridCacheKey('user', 'ladder', { law: normalizedLaw(), recipe })
}

export function adminLadderCacheKey(
  recipe: LadderRecipe,
  law: SizeLaw = DEFAULT_LAW,
  mode: GridMode = 'auto',
): string {
  ladderShapeFromRecipe(recipe)
  return gridCacheKey('admin', 'ladder', { law: normalizedLaw(law), mode, recipe })
}

export function userPlanCacheKey(recipe: PlanRecipe, attachment: Attachment): string {
  planContourFromRecipe(recipe)
  return gridCacheKey('user', 'plan', { attachment, recipe })
}

function effectiveAdminPlanOptions(opts: GridPlanOptions = {}) {
  return {
    attachment: opts.attachment ?? 'magnetic',
    mode: opts.mode ?? 'auto',
    density: opts.density ?? 'light',
    paddingMM: Math.max(PADDING_FLOOR_MM, opts.paddingMM ?? PADDING_FLOOR_MM),
    plan: opts.plan ?? 'auto',
    center: opts.center ?? 'centroid',
    baseMarginMM: opts.baseMarginMM ?? 0,
    maxGrowMM: Math.max(0, opts.maxGrowMM ?? DEFAULT_MARGIN_MM),
    pitchMM: opts.pitchMM ?? null,
    targetAnchors: opts.targetAnchors ?? TARGET_ANCHORS,
  }
}

export function adminPlanCacheKey(recipe: PlanRecipe, opts: GridPlanOptions = {}): string {
  planContourFromRecipe(recipe)
  return gridCacheKey('admin', 'plan', { options: effectiveAdminPlanOptions(opts), recipe })
}
