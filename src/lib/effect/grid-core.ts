// grid-core.ts — internal magnetic-grid REGISTRATION engine (Session 59). Pure mm computation, no DOM / no three.
//
// The model (SSOT _ssot-workbench/_briefs/magnetic-grid-standard-brief.md §10/§12/§13, locked 2026-07-21):
//   • FIXED lattice, launch family 48/96 (§13.1) — points never move; the whole grid translates as a
//     rigid bulk. Auto searches centred and padded-edge phases; manual modes inherit the same placement
//     law while restricting the pitch/pattern family.
//   • PER-SPOT padding (interp A): a node is valid = inside the silhouette AND ≥ pad (10mm radius from
//     the magnet centre) from the REAL outline — per-node, no erosion (pinched shapes keep all regions).
//   • Grid geometry chooses the legal topology. HOLD COVERAGE is measured from the PERIMETER BELT:
//     interior magnets never compensate for an uncovered corner/edge. Inside one conforming topology,
//     covered phase beats uncovered phase; a geometric catalogue publishes covered constructions only.
//   • MARGIN model: the design never resizes; an outward margin band grows (capped) until covered.
//   • Procedural sizes: enumerate legal lattice extents, then solve the earliest upward even-whole-mm
//     contour size that accepts each extent. The grid extent is the catalogue authority; shape mm is
//     derived output.

import type { Contour, Pt } from './types'
import { DEFAULT_CIRCLE_TESSELLATION_CALIBRATION } from './effect-calibration'
import { MANUFACTURING_TOLERANCE_MM } from './geometry-truth'
import { roundedSquareContourMM } from './rounded-square'
import { insetRingMM, MANUFACTURING_OFFSET_ARC_TOLERANCE_MM } from './offset'
import {
  PreparedContourSource,
  distanceToPreparedContour,
  pointInPreparedContour,
  prepareExactContour,
  type GridBBox as BBox,
  type PreparedContour,
} from './grid-prepared'

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
 *  grows). Manual all6/all8/corners8 remain explicit experiments. */
export type MagnetPlan = 'auto' | 'all6' | 'all8' | 'corners8'
export type MagnetDia = 6 | 8

export const DEFAULT_PITCH_MM = 48
export const LAUNCH_PITCHES_MM = [48, 96] as const
export const PADDING_FLOOR_MM = 10
export const MIN_ANCHORS = 2
export const TARGET_ANCHORS = 4
/** Prepared contours approximate curves with straight chords. At the 70mm zero-point, the 0.05mm
 * manufacturing flatten produces 0.00333mm chord sagitta on the R=11 corner; one tenth of the source
 * tolerance bounds it. This is an internal representation epsilon, never a product padding tolerance. */
const GRID_ARITHMETIC_EPSILON_MM = MANUFACTURING_TOLERANCE_MM / 10
/** Cross-engine trigonometry can differ below meaningful manufacturing precision. Rank physically
 * equal phases and serialize their construction on one derived quantum so Node/WebKit publish the
 * same lattice identity. One thousandth of the source tolerance is representation-only. */
const GRID_CONSTRUCTION_QUANTUM_MM = MANUFACTURING_TOLERANCE_MM / 1000
function gridConstructionUnit(value: number): number {
  return Math.round(value / GRID_CONSTRUCTION_QUANTUM_MM)
}
function canonicalGridCoordinate(value: number): number {
  const canonical = gridConstructionUnit(value) * GRID_CONSTRUCTION_QUANTUM_MM
  return Object.is(canonical, -0) ? 0 : canonical
}
/** How far a magnet holds material down before an edge would lift — a PHYSICAL distance, independent of
 *  the chosen grid pitch. Tunable after coupon testing. */
export const HOLD_REACH_MM = 48
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
  /** LIGHT-mode thinning of 48-composed grids (Dan 2026-07-21: "keep central 3-4, remove 2 and 5"):
   *  per axis keep the ends + alternate inward, always keeping the central pair → 96/48/96 gaps.
   *  A 262 (48×6) light row becomes 1·3·4·6. Applied only at pitch 48 with ≥5 lines. */
  sparseThin?: boolean
  /** Exact catalogue construction. When present, delivery validates and uses these lattice nodes
   * instead of independently solving another phase/population. */
  construction?: GridConstruction
}

export interface Anchor { p: Pt; dia: MagnetDia }

export interface GridConstruction {
  pattern: GridPattern
  pitchMM: number
  originMM: Pt
  basisMM: [Pt, Pt]
  population: Array<[number, number]>
}

export interface GridResult {
  attachment: Attachment
  /** twin-fix: the effect ships as a PAIR — this grid is also its mirror counterpart's grid. */
  twinRequired: boolean
  anchors: Anchor[]
  candidates: Pt[]      // interior points dropped by perimeter mode (faint viz)
  flaps: Pt[]
  uncoveredMM: number
  ok: boolean
  issues: string[]
  pitchCentreMM: number
  edgeRangeMM: [number, number]
  applicationPadMM: number
}

function dist(a: Pt, b: Pt) { return Math.hypot(a[0] - b[0], a[1] - b[1]) }

/** The most-interior point of the silhouette (pole of inaccessibility, sampled) + its distance to the edge.
 *  Used as the guaranteed single-magnet fallback when the sparse grid seats none. */
function deepestPoint(prepared: PreparedContour, bb: BBox): { p: Pt; d: number } | null {
  const step = Math.max(2, Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / 24)
  let best: Pt | null = null, bestD = -1
  for (let x = bb.minX; x <= bb.maxX; x += step) for (let y = bb.minY; y <= bb.maxY; y += step) {
    const p: Pt = [x, y]
    if (!pointInPreparedContour(p, prepared)) continue
    const d = distanceToPreparedContour(p, prepared)
    if (d > bestD) { bestD = d; best = p }
  }
  return best ? { p: best, d: bestD } : null
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
function thinBySpacing(pts: Pt[], minDist: number, prepared: PreparedContour, c: Pt): Pt[] {
  const ranked = pts
    .map((p) => ({ p, d: distanceToPreparedContour(p, prepared), r: dist(p, c) }))
    .sort((a, b) => b.d - a.d || a.r - b.r) // deepest in material first, then most central
  const kept: Pt[] = []
  for (const { p } of ranked) {
    let clear = true
    for (const q of kept) if (dist(p, q) < minDist - 1e-6) { clear = false; break }
    if (clear) kept.push(p)
  }
  return kept
}

export interface PerimeterCoverage {
  gaps: Pt[]
  uncoveredMM: number
}

function cross(a: Pt, b: Pt, c: Pt): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function convexHull(points: ReadonlyArray<Pt>): Pt[] {
  const sorted = [...points]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .filter((point, index, all) =>
      index === 0 || Math.abs(point[0] - all[index - 1][0]) > 1e-7
        || Math.abs(point[1] - all[index - 1][1]) > 1e-7)
  if (sorted.length <= 2) return sorted
  const lower: Pt[] = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-9) {
      lower.pop()
    }
    lower.push(point)
  }
  const upper: Pt[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-9) {
      upper.pop()
    }
    upper.push(point)
  }
  lower.pop()
  upper.pop()
  return [...lower, ...upper]
}

type Interval = [number, number]

function mergeIntervals(intervals: Interval[]): Interval[] {
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: Interval[] = []
  for (const interval of intervals) {
    const last = merged[merged.length - 1]
    if (!last || interval[0] > last[1] + 1e-9) merged.push([...interval])
    else if (interval[1] > last[1]) last[1] = interval[1]
  }
  return merged
}

function clipRange(
  interval: Interval,
  start: number,
  end: number,
  min: number,
  max: number,
): Interval | null {
  const delta = end - start
  let [lo, hi] = interval
  if (Math.abs(delta) < 1e-12) return start >= min - 1e-9 && start <= max + 1e-9 ? interval : null
  const t0 = (min - start) / delta, t1 = (max - start) / delta
  lo = Math.max(lo, Math.min(t0, t1))
  hi = Math.min(hi, Math.max(t0, t1))
  return lo <= hi + 1e-9 ? [lo, hi] : null
}

function discInterval(a: Pt, b: Pt, centre: Pt, radius: number): Interval | null {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const ox = a[0] - centre[0], oy = a[1] - centre[1]
  const qa = dx * dx + dy * dy
  const qb = 2 * (ox * dx + oy * dy)
  const qc = ox * ox + oy * oy - radius * radius
  if (qa < 1e-12) return qc <= 1e-9 ? [0, 1] : null
  const discriminant = qb * qb - 4 * qa * qc
  if (discriminant < -1e-9) return null
  const root = Math.sqrt(Math.max(0, discriminant))
  const lo = Math.max(0, (-qb - root) / (2 * qa))
  const hi = Math.min(1, (-qb + root) / (2 * qa))
  return lo <= hi + 1e-9 ? [lo, hi] : null
}

function capsuleIntervals(a: Pt, b: Pt, first: Pt, second: Pt, radius: number): Interval[] {
  const intervals: Interval[] = []
  const firstDisc = discInterval(a, b, first, radius)
  const secondDisc = discInterval(a, b, second, radius)
  if (firstDisc) intervals.push(firstDisc)
  if (secondDisc) intervals.push(secondDisc)
  const axisX = second[0] - first[0], axisY = second[1] - first[1]
  const length = Math.hypot(axisX, axisY)
  if (length > 1e-9) {
    const ux = axisX / length, uy = axisY / length
    const along = (point: Pt) => (point[0] - first[0]) * ux + (point[1] - first[1]) * uy
    const across = (point: Pt) => -(point[0] - first[0]) * uy + (point[1] - first[1]) * ux
    let strip: Interval | null = clipRange([0, 1], along(a), along(b), 0, length)
    if (strip) strip = clipRange(strip, across(a), across(b), -radius, radius)
    if (strip) intervals.push(strip)
  }
  return mergeIntervals(intervals)
}

function miterHullInterval(a: Pt, b: Pt, hull: ReadonlyArray<Pt>, radius: number): Interval[] {
  let interval: Interval | null = [0, 1]
  for (let i = 0; i < hull.length && interval; i++) {
    const first = hull[i], second = hull[(i + 1) % hull.length]
    const ex = second[0] - first[0], ey = second[1] - first[1]
    const edgeLength = Math.hypot(ex, ey)
    const side = (point: Pt) => ex * (point[1] - first[1]) - ey * (point[0] - first[0])
    interval = clipRange(interval, side(a), side(b), -radius * edgeLength, Infinity)
  }
  return interval ? [interval] : []
}

/** Exact unsupported intervals per manufactured ring. The outer ring uses the seated anchors' wrap:
 *  fabric BETWEEN perimeter magnets is pinned by those endpoints, and interior nodes cannot enlarge
 *  the convex hull to mask a tip or lobe. Each hole rim instead requires its own radial support from
 *  a seated anchor; being inside the outer hull does not cover a cut-out. */
export function exactPerimeterCoverage(
  contour: Contour,
  seated: ReadonlyArray<Pt>,
  safeRadius: number,
): PerimeterCoverage {
  const hull = convexHull(seated)
  const gaps: Pt[] = []
  let uncoveredMM = 0
  for (const [ringIndex, ring] of [contour.outer, ...contour.holes].entries()) {
    const pts = ring.pts
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      const segLen = dist(a, b)
      if (segLen < 1e-9) continue
      const ux = (b[0] - a[0]) / segLen, uy = (b[1] - a[1]) / segLen
      const intervals = ringIndex > 0
        ? mergeIntervals(seated.flatMap((anchor) => {
            const interval = discInterval(a, b, anchor, safeRadius)
            return interval ? [interval] : []
          }))
        : hull.length === 0 ? []
          : hull.length === 1
            ? [discInterval(a, b, hull[0], safeRadius)].filter((value): value is Interval => !!value)
            : hull.length === 2
              ? capsuleIntervals(a, b, hull[0], hull[1], safeRadius)
              : miterHullInterval(a, b, hull, safeRadius)
      let coveredTo = 0
      const gapPoint = (lo: number, hi: number): Pt => {
        const t = (lo + hi) / 2
        return [a[0] + ux * t, a[1] + uy * t]
      }
      for (const [loT, hiT] of intervals) {
        const lo = loT * segLen, hi = hiT * segLen
        if (lo > coveredTo + 1e-7) {
          gaps.push(gapPoint(coveredTo, lo))
          uncoveredMM += lo - coveredTo
        }
        if (hi > coveredTo) coveredTo = hi
      }
      if (coveredTo < segLen - 1e-7) {
        gaps.push(gapPoint(coveredTo, segLen))
        uncoveredMM += segLen - coveredTo
      }
    }
  }
  return { gaps, uncoveredMM }
}

function neighbourStep(pitch: number, pattern: GridPattern): number {
  return pattern === 'quincunx' ? pitch / Math.SQRT2
    : pattern === 'diamond' ? pitch * Math.SQRT2 // checkerboard: nearest kept neighbours are diagonal
    : pitch
}

function fullyRegisteredOnBBox(
  bb: BBox,
  pts: ReadonlyArray<Pt>,
  floorMM: number,
): boolean {
  if (!pts.length) return false
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]
    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]
  }
  const atFloor = (inset: number) => inset <= floorMM
  return atFloor(minX - bb.minX) && atFloor(bb.maxX - maxX)
    && atFloor(minY - bb.minY) && atFloor(bb.maxY - maxY)
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

function anchorGridExtentMM(anchors: ReadonlyArray<Anchor>, padEff: number): number {
  if (!anchors.length) return 0
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const anchor of anchors) {
    const [x, y] = anchor.p
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return Math.round(Math.max(maxX - minX, maxY - minY) + 2 * padEff)
}

function anchorGridDimensionsMM(
  anchors: ReadonlyArray<Anchor>,
  padEff: number,
): [number, number] {
  if (!anchors.length) return [0, 0]
  const xs = anchors.map(({ p }) => p[0])
  const ys = anchors.map(({ p }) => p[1])
  return [
    Math.round(Math.max(...xs) - Math.min(...xs) + 2 * padEff),
    Math.round(Math.max(...ys) - Math.min(...ys) + 2 * padEff),
  ]
}

function constructionBasis(pattern: GridPattern, pitchMM: number): [Pt, Pt] {
  if (pattern === 'diamond') return [[pitchMM, pitchMM], [pitchMM, -pitchMM]]
  if (pattern === 'quincunx') return [[pitchMM, 0], [pitchMM / 2, pitchMM / 2]]
  return [[pitchMM, 0], [0, pitchMM]]
}

function constructionFromAnchors(
  pattern: GridPattern,
  pitchMM: number,
  anchors: ReadonlyArray<Anchor>,
): GridConstruction {
  if (!anchors.length) throw new RangeError('A grid construction requires at least one anchor.')
  const points = anchors.map(({ p: [x, y] }) =>
    [canonicalGridCoordinate(x), canonicalGridCoordinate(y)] as Pt)
    .sort(([leftX, leftY], [rightX, rightY]) => leftX - rightX || leftY - rightY)
  const originMM = points[0]
  const basisMM = constructionBasis(pattern, pitchMM)
  const [[ax, ay], [bx, by]] = basisMM
  const determinant = ax * by - ay * bx
  const population = points.map((p, anchorIndex) => {
    const dx = p[0] - originMM[0]
    const dy = p[1] - originMM[1]
    const first = Math.round((dx * by - dy * bx) / determinant)
    const second = Math.round((ax * dy - ay * dx) / determinant)
    const roundTrip: Pt = [
      originMM[0] + first * ax + second * bx,
      originMM[1] + first * ay + second * by,
    ]
    if (dist(roundTrip, p) > MANUFACTURING_TOLERANCE_MM) {
      throw new Error(`${pattern} anchor ${anchorIndex} is not on its declared lattice.`)
    }
    return [first, second] as [number, number]
  }).sort(([leftFirst, leftSecond], [rightFirst, rightSecond]) =>
    leftFirst - rightFirst || leftSecond - rightSecond)
  return { pattern, pitchMM, originMM: [...originMM] as Pt, basisMM, population }
}

function constructionPoints(construction: GridConstruction): Pt[] {
  const expectedBasis = constructionBasis(construction.pattern, construction.pitchMM)
  if (
    construction.originMM.some((value) => !Number.isFinite(value))
    || construction.basisMM.flat().some((value) => !Number.isFinite(value))
    || construction.population.some(([first, second]) =>
      !Number.isInteger(first) || !Number.isInteger(second))
  ) {
    throw new RangeError('Grid construction requires finite geometry and whole-number indices.')
  }
  for (let axis = 0; axis < 2; axis++) for (let component = 0; component < 2; component++) {
    if (Math.abs(construction.basisMM[axis][component] - expectedBasis[axis][component]) > 1e-9) {
      throw new RangeError('Grid construction basis does not match its pattern and pitch.')
    }
  }
  const [[ax, ay], [bx, by]] = construction.basisMM
  return construction.population.map(([first, second]) => [
    construction.originMM[0] + first * ax + second * bx,
    construction.originMM[1] + first * ay + second * by,
  ])
}

/**
 * Magnet grid for a silhouette contour (mm). Phase-optimizes the fixed-pitch lattice for conformance,
 * boundary registration, exact ring coverage, population, then balance; in perimeter mode
 * it drops fully-surrounded interior nodes to produce the magnetic belt. Each magnet keeps its
 * application ring on material.
 */
export function computeGrid(contourMM: Contour, cfg: GridConfig = {}): GridResult {
  return computePreparedGrid(prepareExactContour(contourMM), cfg)
}

export function computePreparedGrid(prepared: PreparedContour, cfg: GridConfig = {}): GridResult {
  return computePreparedGridForExtent(prepared, cfg)
}

function computePreparedGridForExtent(
  prepared: PreparedContour,
  cfg: GridConfig,
  requiredGridExtentMM?: number,
): GridResult {
  const contourMM = prepared.contour
  const attachment: Attachment = cfg.attachment ?? 'magnetic'
  // VELCRO LAW: no grid exists — the back is a full velcro hook in the silhouette. Any shape, any
  // size; nothing to seat, nothing to cover. (Engine-owned: ladders, auto and UI all inherit.)
  if (attachment === 'velcro') {
    return {
      attachment, twinRequired: false, anchors: [], candidates: [], flaps: [], uncoveredMM: 0, ok: true,
      issues: [], pitchCentreMM: 0, edgeRangeMM: [0, 0], applicationPadMM: 0,
    }
  }
  // GLOBAL LAW (48/68 system): dice centres live at half-pitch — quincunx below 96 would put anchors
  // on 24-offsets (34mm links), which do not exist in the system. Enforced HERE so every caller
  // (manual pins, auto search, ladder solver, app) inherits it; pitchCentreMM reports the truth.
  const reqPitch = cfg.construction?.pitchMM ?? cfg.pitchMM ?? DEFAULT_PITCH_MM
  if (!(LAUNCH_PITCHES_MM as readonly number[]).includes(reqPitch)) {
    throw new RangeError(`Unsupported magnetic-grid pitch ${reqPitch}mm; launch pitches are 48mm and 96mm.`)
  }
  const pitch = (cfg.pattern === 'quincunx' && reqPitch < 96) ? 96 : reqPitch
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const pattern = cfg.construction?.pattern ?? cfg.pattern ?? 'standard'
  const plan = cfg.plan ?? 'auto'
  // GLOBAL LAW (amended, Dan 2026-07-21): the perimeter belt applies to STANDARD and DIAMOND — a
  // diamond's outer 68-ring stands alone, its inner anchors are removable. Only DICE is forced full:
  // its centre magnets ARE the pattern (stripping them leaves plain corners). Every consumer inherits.
  const perimeterOnly = pattern === 'quincunx' ? false : (cfg.perimeterOnly ?? true)
  const centerMode = cfg.center ?? 'centroid'
  const bb = prepared.bbox
  const issues: string[] = []

  // A node is valid only when the complete application spot keeps the hard pad from the manufactured
  // contour. The same physical floor governs sizing and delivery; no corner-specific rescue exists.
  const valid = (p: Pt) => {
    if (!pointInPreparedContour(p, prepared)) return false
    return distanceToPreparedContour(p, prepared) + GRID_ARITHMETIC_EPSILON_MM >= pad
  }

  // FINALIZE a candidate seed into the delivered layout: contour-facing belt + light 1·3·4·6
  // thinning. A Cartesian neighbour enclosure is not a perimeter test on sloped/curved contours:
  // triangle edge holders can be surrounded in x/y while still sitting within physical hold reach.
  // Keep every contour-facing node and drop only nodes deeper than HOLD_REACH_MM. Placement parities
  // are judged on THIS final layout (not the raw seed) —
  // the old raw-seat-count scoring let a 5-node cross beat a 4-node box, and after the belt dropped the
  // cross's centre the result read as a diamond arrangement under the STANDARD pattern.
  const finalize = (seed: Pt[]): { seated: Pt[]; interior: Pt[] } => {
    let seated = seed
    let interior: Pt[] = []
    if (perimeterOnly && seated.length > 4) {
      const contourFacing = seated.filter(
        (point) => distanceToPreparedContour(point, prepared) < HOLD_REACH_MM,
      )
      if (contourFacing.length >= MIN_ANCHORS) {
        interior = seated.filter(
          (point) => distanceToPreparedContour(point, prepared) >= HOLD_REACH_MM,
        )
        seated = contourFacing
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
    return { seated, interior }
  }

  // CENTER the fixed grid on the shape — balanced by construction (the grid translates as a rigid bulk).
  // A/B: centroid balances MATERIAL (lopsided shapes); bbox-centre balances the FRAME (regular shapes).
  // Each parity's FINAL layout is scored by: PATTERN CONFORMANCE (nearest-neighbour spacing must match
  // the pattern's own geometry: standard = pitch, quincunx = pitch/√2, diamond = pitch·√2) →
  // EDGE REGISTRATION → COVERAGE → most seated → best centred. Coverage ranks only inside equally
  // registered legal topology: it cannot resurrect dead-border phases, turn standard into dice, or
  // let interior magnets mask a corner/edge gap.
  let seated: Pt[] = []
  let interior: Pt[] = []
  if (cfg.construction) {
    if (cfg.pitchMM != null && cfg.pitchMM !== cfg.construction.pitchMM) {
      throw new RangeError('Grid construction pitch does not match the requested pitch.')
    }
    if (cfg.pattern != null && cfg.pattern !== cfg.construction.pattern) {
      throw new RangeError('Grid construction pattern does not match the requested pattern.')
    }
    seated = constructionPoints(cfg.construction)
    if (seated.some((point) => !valid(point))) {
      throw new RangeError('Grid construction places an anchor outside the legal padding floor.')
    }
    for (let i = 0; i < seated.length; i++) for (let j = i + 1; j < seated.length; j++) {
      if (dist(seated[i], seated[j]) < 2 * pad - 1e-6) {
        throw new RangeError('Grid construction overlaps magnet application spots.')
      }
    }
  } else {
    const c: Pt = centerMode === 'bbox'
      ? [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
      : prepared.centroid
    const ox0 = (((c[0] - bb.minX) % pitch) + pitch) % pitch
    const oy0 = (((c[1] - bb.minY) % pitch) + pitch) % pitch
    const h = pitch / 2
    const phaseCandidates = (centered: number, min: number, max: number): number[] => {
      const normalized = (value: number) => ((value % pitch) + pitch) % pitch
      const values = [
        normalized(centered),
        normalized(centered + h),
        normalized(pad),
        normalized(max - min - pad),
      ]
      const seen = new Set<string>()
      return values.filter((value) => {
        const key = value.toFixed(6)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    // AUTO TRANSLATION LAW: the centred parities remain candidates, but they are not the whole grid.
    // Edge-derived phases let a rigid lattice register a row/column at either padded contour bound.
    // Shape-agnostic: no triangle/rectangle special case, and every mode uses the same candidates.
    const oxs = phaseCandidates(ox0, bb.minX, bb.maxX)
    const oys = phaseCandidates(oy0, bb.minY, bb.maxY)
    // no two magnets closer than 2× the application radius → their padding rings can never overlap
    const minSpacing = 2 * pad
    const checkers = pattern === 'diamond' ? [0, 1] : [0] // diamond: try both checkerboard halves
    const expectedMp = neighbourStep(pitch, pattern)
    // EDGE REGISTRATION (Dan, 2026-07-28): "the size is optimal when we follow square logic pretty
    // much everywhere — magnets side to side along the edges, with margins encoded between magnet and
    // edge of the effect." Within the LADDER DOMAIN the same edge length registers the same way: a
    // rectangle's 214 side takes the layout a 214 square's side takes. The claim is bounded on
    // purpose — a rung is the size whose surface exactly wraps its magnet array plus both encoded
    // margins (Dan), so a NON-rung size has no zero-point to register on and nothing is claimed for
    // it; off-ladder behaviour is recorded in KAI-9793, not pinned. The term itself is shape- and
    // size-agnostic and runs for every input: it is the CLAIM that is bounded, not the code path.
    // Slack = how far each side's
    // outermost anchor sits BEYOND the application pad — zero means the row reaches its zero-point.
    // Ranked AFTER conformance (registration never buys edge contact with a rotated arrangement) and
    // BEFORE count, which is what previously let an inset 8-anchor phase
    // beat the edge-registered 6-anchor one. Shape-agnostic: symmetric shapes tie and are unaffected.
    // ALL-OR-NOTHING, and that is the whole point. Summed distance-to-the-floor looks equivalent but
    // is WRONG for shapes whose material does not reach the bbox: on a circle it rewards a phase that
    // buys edge contact on two sides by dropping anchors and going asymmetric (166 fell 8 -> 6 with
    // x on 35/83/131 and y on 11/59/107/155 — absurd on a disc). A layout either registers on EVERY
    // side, which is what "magnets side to side along the edges" means, or it earns nothing and the
    // existing count/balance ranking decides exactly as before. Rectangles reach the floor on all
    // four sides and win; circles reach it on none or some, tie, and stay untouched.
    const fullyRegistered = (pts: ReadonlyArray<Pt>): boolean => {
      return fullyRegisteredOnBBox(bb, pts, pad + DEFAULT_LAW.frameMM)
    }
    type Cand = {
      fin: { seated: Pt[]; interior: Pt[] }
      conform: number
      uncoveredPerimeterMM: number
      registered: number
      bal: number
    }
    const cands: Cand[] = []
    for (const px of oxs) for (const py of oys) for (const ck of checkers) {
      const nodes = latticeAt(bb, pitch, pattern, px, py, ck)
      const seat = thinBySpacing(nodes.filter(valid), minSpacing, prepared, c)
      const fin = finalize(seat)
      let mp = Infinity
      for (let i = 0; i < fin.seated.length; i++) for (let j = i + 1; j < fin.seated.length; j++) {
        const d = dist(fin.seated[i], fin.seated[j]); if (d < mp) mp = d
      }
      const conform = fin.seated.length < 2 ? 1 : Math.abs(mp - expectedMp) < 2 ? 1 : 0
      const uncoveredPerimeterMM = fin.seated.length
        ? exactPerimeterCoverage(contourMM, fin.seated, HOLD_REACH_MM).uncoveredMM
        : Infinity
      const registered = fullyRegistered(fin.seated) ? 1 : 0
      let sx = 0, sy = 0; for (const p of fin.seated) { sx += p[0]; sy += p[1] }
      const bal = fin.seated.length ? Math.hypot(sx / fin.seated.length - c[0], sy / fin.seated.length - c[1]) : 1e9
      cands.push({ fin, conform, uncoveredPerimeterMM, registered, bal })
    }
    // STANDARD and DIAMOND are HARD conformance laws (Dan): standard shows straight pitch-spaced rows
    // or nothing; diamond shows 68-atom (pitch·√2) links or nothing — neither may quietly resolve into
    // the other's arrangement (the honest outcome is flaps + margin growth, or switching mode). Dice
    // keeps coverage-first (its geometry is inherently the mix).
    const extentPool = requiredGridExtentMM == null
      ? cands
      : cands.filter((candidate) =>
        anchorGridExtentMM(
          candidate.fin.seated.map((p) => ({ p, dia: 6 })),
          pad,
        ) === requiredGridExtentMM)
    const pool = (pattern === 'standard' || pattern === 'diamond')
      && extentPool.some((k) => k.conform === 1 && k.fin.seated.length >= MIN_ANCHORS)
      ? extentPool.filter((k) => k.conform === 1)
      : extentPool
    let bestKey: number[] | null = null
    for (const k of pool) {
      const key = [
        -k.conform,
        -k.registered,
        gridConstructionUnit(k.uncoveredPerimeterMM),
        -k.fin.seated.length,
        gridConstructionUnit(k.bal),
      ]
      let better = !bestKey
      if (bestKey) {
        for (let i = 0; i < key.length; i++) {
          if (key[i] === bestKey[i]) continue
          better = key[i] < bestKey[i]
          break
        }
      }
      if (better) { bestKey = key; seated = k.fin.seated; interior = k.fin.interior }
    }
  }

  // GUARANTEE ≥1: if the sparse grid seated nothing but the shape can still hold a magnet, drop one at the
  // deepest interior point (a single magnet has no spacing to honour, so grid phase is moot here).
  if (
    seated.length === 0
    && (
      requiredGridExtentMM == null
      || requiredGridExtentMM === Math.round(2 * pad)
    )
  ) {
    const dp = deepestPoint(prepared, bb)
    if (dp && dp.d >= pad) { seated = [dp.p]; interior = [] }
  }
  const anchors = assignSizes(seated, plan, Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY))

  if (!seated.length) issues.push(`No room for a magnet — too small/thin to keep a magnet ${pad}mm from every edge.`)
  else if (seated.length < MIN_ANCHORS) issues.push(`Too small — only ${seated.length} magnet grips material. Increase the size or the max auto-grow.`)
  const coverage = seated.length
    ? exactPerimeterCoverage(contourMM, seated, HOLD_REACH_MM)
    : { gaps: [], uncoveredMM: 0 }
  const flaps = coverage.gaps
  if (flaps.length > 0) issues.push(`Some edge areas sit outside the seated support envelope (red edge) and could lift. Raise the size / max auto-grow.`)

  let minD = 8, maxD = 6
  for (const a of anchors) { if (a.dia < minD) minD = a.dia; if (a.dia > maxD) maxD = a.dia }
  if (anchors.length === 0) { minD = 6; maxD = 6 }

  return {
    attachment, twinRequired: attachment === 'twinfix', anchors, candidates: interior, flaps,
    uncoveredMM: coverage.uncoveredMM,
    ok: issues.length === 0,
    issues,
    pitchCentreMM: pitch,
    edgeRangeMM: [pitch + minD, pitch + maxD],
    applicationPadMM: pad,
  }
}


// ─── LAUNCH LAW (§13, locked 2026-07-21) — 48-family only, procedural zero-point ladder ──────────────
// Launch pitches = 48/96 exclusively. Retired 24/72 pitches have no exception.
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
/** The LAW INPUTS that generate every size procedurally — no hand-picked numbers. */
export interface SizeLaw {
  paddingMM: number   // mag-safe radius from magnet centre (default 10)
  frameMM: number     // frame stroke per side (default 1; 0 = frameless… padding then absorbs it)
  /** The largest physically tested size — a RECORD, not a filter.
   *  LAW 3.12 with its qualifiers intact: Dan, 07-21 — "we can add larger sizes than 200 but we MAY hide
   *  them FOR LAUNCH and test them first." Conditional, and scoped to launch. It was applied now and
   *  unconditionally, which hid untested sizes during the exact phase they exist to be tested in.
   *  Ruled unsanctioned by Dan 07-30. Hiding is a launch-time admin decision under 8.7 — "only fixed are
   *  admin input settings when we decide to lock them" — and no such setting exists yet. */
  maxTestedMM: number
  maxRungMM: number   // generator stop (default 310 — the 4-column shirt max)
}
export const DEFAULT_LAW: SizeLaw = {
  paddingMM: PADDING_FLOOR_MM,
  frameMM: 1,
  maxTestedMM: 214,
  maxRungMM: 310,
}

/** LAW: random/AI-cut silhouettes are capped below the preset range until physically tested. */
export const RANDOM_SHAPE_MAX_MM = 180
/** Shape-source semantics. Standard geometries and curated presets use the predictable product
 * catalogue; generators and AI outlines retain the adaptive pattern search required by freeform. */
export type GridSource = 'std' | 'preset' | 'gen' | 'magic'
/** LAW: the max design size per shape SOURCE — standard geometries and curated presets span the full
 *  system range (maxRungMM); only generated/AI-cut randoms carry the untested cap. */
export function maxDesignMM(source: GridSource, law: SizeLaw = DEFAULT_LAW): number {
  return source === 'gen' || source === 'magic' ? RANDOM_SHAPE_MAX_MM : law.maxRungMM
}
/** LAW: the default adaptive-plan margin allowance — the outward band a freeform plan may add to seek
 *  balance. Catalogue ladders never consume it: a published size is the exact zero-margin grid extent. */
export const DEFAULT_MARGIN_MM = 12
/** LAW: the smallest effect is the single-point (ONE) size — one magnet with its full pad ring. */
export function minEffectMM(law: SizeLaw = DEFAULT_LAW): number { return 2 * (law.paddingMM + law.frameMM) }
/** LAW: resolve a requested design size against the selected source's complete product bounds. */
export function resolveDesignSizeMM(
  requestedMM: number,
  source: GridSource,
  law: SizeLaw = DEFAULT_LAW,
): number {
  return Math.max(minEffectMM(law), Math.min(requestedMM, maxDesignMM(source, law)))
}
/** LAW: rectangle format families by aspect ratio (product naming, not navigation). */
export function rectFormat(wMM: number, hMM: number): 'strip' | 'panoramic' | 'block' {
  const r = Math.max(wMM, hMM) / Math.min(wMM, hMM)
  return r >= 2.5 ? 'strip' : r >= 1.6 ? 'panoramic' : 'block'
}
function circleTessellationPoints(diameterMM: number): number {
  const radiusMM = diameterMM / 2
  // Exact inverse of the sagitta bound. It agrees with law 9.2(b)'s square-root
  // derivation across the catalogue while proving the imported tolerance directly.
  const required = Math.ceil(
    Math.PI / Math.acos(1 - MANUFACTURING_TOLERANCE_MM / radiusMM),
  )
  return Math.max(DEFAULT_CIRCLE_TESSELLATION_CALIBRATION.minimumPoints, required)
}
/** LAW: the standard geometry recipes (product shape definitions — square, its rotated diamond twin,
 *  circle, equilateral triangle, rectangle). Drawn directly in mm; app + bench share these. */
export type StdShape = 'square' | 'rect' | 'circle' | 'triangle' | 'diamondShape'
export function stdShapeContour(shape: StdShape, wMM: number, hMM: number = wMM): Contour {
  if (shape === 'circle') {
    const r = wMM / 2, pts: Pt[] = []
    const pointCount = circleTessellationPoints(wMM)
    for (let i = 0; i < pointCount; i++) { const t = (i / pointCount) * Math.PI * 2; pts.push([r + r * Math.cos(t), r + r * Math.sin(t)]) }
    return { outer: { pts }, holes: [] }
  }
  if (shape === 'triangle') return { outer: { pts: [[0, 0], [wMM, 0], [wMM / 2, wMM * Math.sqrt(3) / 2]] as Pt[] }, holes: [] }
  if (shape === 'diamondShape') return { outer: { pts: [[wMM / 2, 0], [wMM, hMM / 2], [wMM / 2, hMM], [0, hMM / 2]] as Pt[] }, holes: [] }
  return { outer: { pts: [[0, 0], [wMM, 0], [wMM, hMM], [0, hMM]] as Pt[] }, holes: [] } // square / rect
}




/** GRID MODE — the four exposed modes (§ goal 2026-07-21):
 *  auto = source-aware: standard only for product geometries/presets, every legal pattern for
 *  freeform generators/AI · standard = straight (48-atom) links only · quincunx (dice) = the
 *  standard+diamond mix (96 pitch) · diamond = diagonal (68-atom) links only. */
export type GridMode = 'auto' | GridPattern
function automaticPatternsForSource(source: GridSource): ReadonlyArray<GridPattern> {
  return source === 'gen' || source === 'magic'
    ? ['standard', 'diamond', 'quincunx']
    : ['standard']
}
function modeCombos(
  mode: GridMode,
  pinnedPitchMM?: number,
  source: GridSource = 'std',
): { pitchMM: number; pattern: GridPattern }[] {
  const std = [{ pitchMM: 48, pattern: 'standard' as GridPattern }, { pitchMM: 96, pattern: 'standard' as GridPattern }]
  const dia = [{ pitchMM: 48, pattern: 'diamond' as GridPattern }, { pitchMM: 96, pattern: 'diamond' as GridPattern }]
  const dice = [{ pitchMM: 96, pattern: 'quincunx' as GridPattern }]
  const automatic = automaticPatternsForSource(source)
  const combos = mode === 'standard' ? std
    : mode === 'diamond' ? dia
      : mode === 'quincunx' ? dice
        : [...std, ...dia, ...dice].filter(({ pattern }) => automatic.includes(pattern))
  if (pinnedPitchMM == null) return combos
  if (!(LAUNCH_PITCHES_MM as readonly number[]).includes(pinnedPitchMM)) {
    throw new RangeError(`Unsupported magnetic-grid pitch ${pinnedPitchMM}mm; launch pitches are 48mm and 96mm.`)
  }
  const effectivePitchMM = mode === 'quincunx' && pinnedPitchMM < 96 ? 96 : pinnedPitchMM
  return combos.filter((combo) => combo.pitchMM === effectivePitchMM)
}

/** SEMANTIC SIZES: every shape carries the same sequential grid-extent ladder. The physical mm under
 *  each label is the earliest upward even-whole-mm fit for that contour, solved from the live
 *  padding/pitch/pattern.
 *  Anchor-count changes inside one rectangular extent never manufacture extra product sizes. */
export interface SemanticRung {
  label: string
  points: number
  /** Physical longest-side size of this shape at its selected exact fit. */
  sizeMM: number
  /** Shape-independent rectangular extent of the seated lattice, including pad + frame on both sides. */
  gridExtentMM: number
  visible: boolean
  /** Complete lattice identity consumed verbatim by the delivered plan. */
  construction: GridConstruction
}
export type SemanticRungTieBreak = 'higher' | 'first'

/** Select the closest semantic rung. Exact ties are explicit so callers cannot drift. */
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

/** Snap upward to the next legal grid-derived size; clamp only after the final rung. */
export function nextSemanticRung(
  rungs: ReadonlyArray<SemanticRung>,
  targetMM: number,
): SemanticRung {
  return rungs.find((rung) => rung.sizeMM >= targetMM) ?? rungs[rungs.length - 1]
}

export interface RectangleRungResolution {
  longRung: SemanticRung
  shortRung: SemanticRung
  widthRung: SemanticRung
  heightRung: SemanticRung
  longOptions: SemanticRung[]
  shortOptions: SemanticRung[]
}

/** Rectangle system A: both axes select legal grid extents; equality is the square case. */
export function resolveRectangleRungs(
  rungs: ReadonlyArray<SemanticRung>,
  opts: { longMM: number; shortMM: number; orientation: 'landscape' | 'portrait' },
): RectangleRungResolution {
  const longRung = nextSemanticRung(rungs, opts.longMM)
  const shortOptions = rungs.filter((rung) => rung.sizeMM <= longRung.sizeMM)
  const shortRung = shortOptions.length
    ? nextSemanticRung(shortOptions, opts.shortMM)
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

/** Compose two axis rungs into the one exact rectangular lattice that delivery consumes. */
export function deriveRectangleConstruction(
  widthRung: SemanticRung,
  heightRung: SemanticRung,
  law: SizeLaw = DEFAULT_LAW,
  mode: GridMode = 'auto',
  options: Pick<GridPlanOptions, 'pitchMM' | 'source' | 'density' | 'center'> = {},
): GridConstruction | null {
  const padEff = law.paddingMM + law.frameMM
  const density = options.density ?? 'light'
  const pitchOrder = allowedPitches(density)
  const combos = modeCombos(mode, options.pitchMM, options.source).sort((a, b) =>
    pitchOrder.indexOf(a.pitchMM) - pitchOrder.indexOf(b.pitchMM))
  const prepared = prepareExactContour(stdShapeContour(
    'rect',
    widthRung.sizeMM,
    heightRung.sizeMM,
  ))
  for (const combo of combos) {
    const grid = computePreparedGridForExtent(
      prepared,
      {
        pitchMM: combo.pitchMM,
        pattern: combo.pattern,
        paddingMM: padEff,
        center: options.center,
        perimeterOnly: perimeterForDensity(density, combo.pattern),
        sparseThin: density === 'light',
      },
      Math.max(widthRung.gridExtentMM, heightRung.gridExtentMM),
    )
    const dimensions = anchorGridDimensionsMM(grid.anchors, padEff)
    if (
      grid.flaps.length === 0
      && dimensions[0] === widthRung.gridExtentMM
      && dimensions[1] === heightRung.gridExtentMM
    ) {
      return constructionFromAnchors(combo.pattern, combo.pitchMM, grid.anchors)
    }
  }
  return null
}
const BASE_BAND_LABELS = ['2XS', 'XS', 'S', 'M', 'L', 'XL']
function bandLabel(idx: number): string {
  return idx < BASE_BAND_LABELS.length ? BASE_BAND_LABELS[idx] : `${idx - BASE_BAND_LABELS.length + 2}XL`
}
interface SemanticStep {
  points: number
  sizeMM: number
  gridExtentMM: number
  construction: GridConstruction
}

function semanticSteps(
  makeShape: (sizeMM: number) => Contour,
  law: SizeLaw,
  combos: ReadonlyArray<{ pitchMM: number; pattern: GridPattern }>,
  minimumAnchors: number,
  options: Pick<GridPlanOptions, 'density' | 'center'> = {},
): SemanticStep[] {
  const padEff = law.paddingMM + law.frameMM
  const density = options.density ?? 'light'
  const pitchOrder = allowedPitches(density)
  const orderedCombos = [...combos].sort((a, b) => {
    const pitchDifference = pitchOrder.indexOf(a.pitchMM) - pitchOrder.indexOf(b.pitchMM)
    return pitchDifference || legalPatterns(a.pitchMM).indexOf(a.pattern)
      - legalPatterns(b.pitchMM).indexOf(b.pattern)
  })

  // GRID-FIRST: enumerate canonical lattice extents, then exhaust the bounded integer-mm domain for
  // each legal combo and take its first covered construction. The acceptance predicate can contain
  // disjoint islands as a curved contour crosses lattice phases, so bisection is unsound. Extent
  // remains the catalogue authority and physical mm is derived within the configured production bound.
  const steps: SemanticStep[] = []
  let previousSizeMM = Math.ceil(2 * padEff) - 1
  const firstExtentMM = Math.round(2 * padEff)
  for (
    let gridExtentMM = firstExtentMM;
    gridExtentMM <= law.maxRungMM;
    gridExtentMM += DEFAULT_PITCH_MM
  ) {
    const minSizeMM = previousSizeMM + 1
    const maxSizeMM = law.maxRungMM
    let solved: { sizeMM: number; grid: GridResult; combo: typeof orderedCombos[number] } | null = null
    const extentCombos = gridExtentMM === firstExtentMM
      ? [...orderedCombos].sort((a, b) => a.pitchMM - b.pitchMM)
      : orderedCombos
    for (const combo of extentCombos) {
      const gridAt = (sizeMM: number): GridResult => computePreparedGridForExtent(
        prepareExactContour(makeShape(sizeMM)),
        {
          pitchMM: combo.pitchMM,
          pattern: combo.pattern,
          paddingMM: padEff,
          center: options.center,
          perimeterOnly: perimeterForDensity(density, combo.pattern),
          sparseThin: density === 'light',
        },
        gridExtentMM,
      )
      const accepts = (grid: GridResult): boolean =>
        grid.anchors.length >= minimumAnchors
        && grid.flaps.length === 0
        && anchorGridExtentMM(grid.anchors, padEff) === gridExtentMM

      const minimumCandidateMM = gridExtentMM === firstExtentMM
        ? minSizeMM
        : Math.max(minSizeMM, gridExtentMM)
      // Product sizes publish upward on even whole millimetres: an odd size puts the grid centre
      // on a half-millimetre, which cannot be placed repeatably on fabric. The exact geometry remains
      // internal; every seat/coverage predicate is re-evaluated at this published even size.
      const firstCandidateMM = 2 * Math.ceil(minimumCandidateMM / 2)
      for (let sizeMM = firstCandidateMM; sizeMM <= maxSizeMM; sizeMM += 2) {
        const grid = gridAt(sizeMM)
        const accepted = gridExtentMM === firstExtentMM
          ? grid.anchors.length >= minimumAnchors
            && anchorGridExtentMM(grid.anchors, padEff) === gridExtentMM
          : accepts(grid)
        if (accepted) {
          solved = { sizeMM, grid, combo }
          break
        }
      }
      if (solved) break
    }
    if (!solved) continue
    const construction = constructionFromAnchors(
      solved.combo.pattern,
      solved.combo.pitchMM,
      solved.grid.anchors,
    )
    steps.push({
      points: solved.grid.anchors.length,
      sizeMM: solved.sizeMM,
      gridExtentMM,
      construction,
    })
    previousSizeMM = solved.sizeMM
  }
  return steps
}

function labelSemanticSteps(steps: ReadonlyArray<SemanticStep>, law: SizeLaw): SemanticRung[] {
  // LABEL LAW: ONE is the no-grid boundary. The first real grid extent is S, then M/L/XL sequentially
  // with no skips. Labels belong to the grid progression, never to the enclosing shape's physical mm.
  const rungs: SemanticRung[] = []
  let nextIdx = BASE_BAND_LABELS.indexOf('S')
  for (const st of steps) {
    if (st.points === 1) {
      rungs.push({
        label: 'ONE',
        points: 1,
        sizeMM: st.sizeMM,
        gridExtentMM: st.gridExtentMM,
        visible: true,
        construction: st.construction,
      })
      continue
    }
    rungs.push({
      label: bandLabel(nextIdx++),
      points: st.points,
      sizeMM: st.sizeMM,
      gridExtentMM: st.gridExtentMM,
      visible: true,
      construction: st.construction,
    })
  }
  return rungs
}

export function semanticLadder(
  makeShape: (sizeMM: number) => Contour, law: SizeLaw = DEFAULT_LAW, mode: GridMode = 'auto',
  options: Pick<GridPlanOptions, 'pitchMM' | 'source' | 'density' | 'center'> = {},
): SemanticRung[] {
  return labelSemanticSteps(
    semanticSteps(makeShape, law, modeCombos(mode, options.pitchMM, options.source), 1, options),
    law,
  )
}

export interface BalancedGridFit {
  sizeMM: number
  grid: GridResult
  grew: number
}

export interface AutoGridSelection {
  pitchMM: number
  pattern: GridPattern
  fit: BalancedGridFit
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
): AutoGridSelection {
  return autoPreparedGrid(new PreparedContourSource(withMargin), cfg, fromMM, maxGrowMM, opts)
}

function autoPreparedGrid(
  withMargin: PreparedContourSource, cfg: GridConfig, fromMM: number, maxGrowMM: number,
  opts: { minN?: number; density?: GridDensity; pitchMM?: number; pattern?: GridPattern; patterns?: ReadonlyArray<GridPattern> } = {},
): AutoGridSelection {
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
  let fb: {
    pitchMM: number
    pattern: GridPattern
    selectionFit?: BalancedGridFit
  } = {
    pitchMM: pitches[pitches.length - 1],
    pattern: patFor(pitches[pitches.length - 1]).slice(-1)[0],
  }
  let fbUncoveredMM = Infinity
  let firstCovered: AutoGridSelection | null = null
  const finalFit = (
    pitchMM: number,
    pattern: GridPattern,
    selectionFit?: BalancedGridFit,
  ): BalancedGridFit => minN === TARGET_ANCHORS && selectionFit
    ? selectionFit
    : balancedPreparedFit(
      withMargin,
      { ...cfg, pitchMM, pattern },
      fromMM,
      maxGrowMM,
      { target: opts.minN },
    )
  for (const p of pitches) for (const pat of patFor(p)) {
    const fit = balancedPreparedFit(withMargin, { ...cfg, pitchMM: p, pattern: pat }, fromMM, maxGrowMM)
    if (p === fb.pitchMM && pat === fb.pattern) fb.selectionFit = fit
    if (fit.grid.anchors.length >= minN && fit.grid.flaps.length === 0) {
      const selected = { pitchMM: p, pattern: pat, fit: finalFit(p, pat, fit) }
      if (!firstCovered) firstCovered = selected
      const prepared = withMargin.get(selected.fit.sizeMM)
      const floorMM = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
        + DEFAULT_LAW.frameMM
      if (fullyRegisteredOnBBox(
        prepared.bbox,
        selected.fit.grid.anchors.map((anchor) => anchor.p),
        floorMM,
      )) return selected
      continue
    }
    const fallbackAnchors = fb.selectionFit?.grid.anchors.length ?? 0
    if (
      fit.grid.anchors.length >= MIN_ANCHORS
      && (
        fit.grid.uncoveredMM < fbUncoveredMM
        || (
          Math.abs(fit.grid.uncoveredMM - fbUncoveredMM) < 1e-9
          && fit.grid.anchors.length > fallbackAnchors
        )
      )
    ) {
      fb = { pitchMM: p, pattern: pat, selectionFit: fit }
      fbUncoveredMM = fit.grid.uncoveredMM
    }
  }
  if (firstCovered) return firstCovered
  return {
    pitchMM: fb.pitchMM,
    pattern: fb.pattern,
    fit: finalFit(fb.pitchMM, fb.pattern, fb.selectionFit),
  }
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
 * If nothing within the cap fully covers, keep the size with the least uncovered perimeter length (then
 * most magnets). `sized(mm)` produces the real-mm contour. `maxGrowMM = 0` disables growth.
 */
export function balancedFit(
  sized: (mm: number) => Contour, cfg: GridConfig, fromMM: number, maxGrowMM: number,
  opts: { target?: number; step?: number } = {},
): BalancedGridFit {
  return balancedPreparedFit(new PreparedContourSource(sized), cfg, fromMM, maxGrowMM, opts)
}

function balancedPreparedFit(
  sized: PreparedContourSource, cfg: GridConfig, fromMM: number, maxGrowMM: number,
  opts: { target?: number; step?: number } = {},
): BalancedGridFit {
  const target = opts.target ?? TARGET_ANCHORS
  const step = opts.step ?? 3
  const start = Math.round(fromMM)
  const end = start + Math.max(0, maxGrowMM)
  let best: { sizeMM: number; grid: GridResult } | null = null
  for (let mm = start; mm <= end; mm += step) {
    const grid = computePreparedGrid(sized.get(mm), cfg)
    // perfect = fully covered AND ≥ target magnets → take the first (smallest) such size immediately
    if (grid.flaps.length === 0 && grid.anchors.length >= target) return { sizeMM: mm, grid, grew: mm - start }
    // otherwise rank physical uncovered length first, then more magnets; iteration keeps smaller size.
    if (
      !best
      || grid.uncoveredMM < best.grid.uncoveredMM
      || (
        Math.abs(grid.uncoveredMM - best.grid.uncoveredMM) < 1e-9
        && grid.anchors.length > best.grid.anchors.length
      )
    ) {
      best = { sizeMM: mm, grid }
    }
  }
  if (best) return { ...best, grew: best.sizeMM - start }
  const grid = computePreparedGrid(sized.get(start), cfg)
  return { sizeMM: start, grid, grew: 0 }
}

// ─── PRODUCTION FACADE ──────────────────────────────────────────────────────

/** UI-agnostic inputs for resolving one final attachment grid from a real-mm contour. */
export interface GridPlanOptions {
  attachment?: Attachment
  /** Engine-owned automatic-pattern policy derives from shape source. Curated product sources use
   * standard only; freeform generators/AI retain the complete adaptive search. */
  source?: GridSource
  mode?: GridMode
  density?: GridDensity
  paddingMM?: number
  plan?: MagnetPlan
  center?: 'centroid' | 'bbox'
  baseMarginMM?: number
  maxGrowMM?: number
  pitchMM?: number
  targetAnchors?: number
  signedBaseMargin?: boolean
  diagnosticVelcro?: boolean
  /** Catalogue rung construction. Delivery validates and uses it verbatim. */
  construction?: GridConstruction
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
export function resolveGridPlan(
  contourMM: Contour,
  opts: GridPlanOptions = {},
): ResolvedGridPlan {
  const attachment = opts.attachment ?? 'magnetic'
  const source = opts.source ?? 'std'
  const mode = opts.mode ?? 'auto'
  const density = opts.density ?? 'light'
  const requestedBaseMarginMM = opts.baseMarginMM ?? 0
  const baseMarginMM = opts.signedBaseMargin
    ? requestedBaseMarginMM
    : Math.max(0, requestedBaseMarginMM)
  const maxGrowMM = opts.maxGrowMM ?? DEFAULT_MARGIN_MM
  const marginVariants = new PreparedContourSource(
    (marginMM) => contourWithOuterMargin(contourMM, marginMM),
  )
  const manualPattern = mode === 'auto' ? undefined : mode
  const patternForCoverage = manualPattern ?? 'standard'
  const cfg: GridConfig = {
    attachment,
    paddingMM: opts.paddingMM ?? PADDING_FLOOR_MM,
    plan: opts.plan ?? 'auto',
    center: opts.center ?? 'centroid',
    perimeterOnly: perimeterForDensity(density, patternForCoverage),
    sparseThin: density === 'light',
  }

  if (attachment === 'velcro' && !opts.diagnosticVelcro) {
    const effectContour = marginVariants.get(baseMarginMM)
    const grid = computePreparedGrid(effectContour, { ...cfg, attachment })
    return {
      designContourMM: contourMM,
      effectContourMM: effectContour.contour,
      grid,
      pitchMM: 0,
      pattern: null,
      baseMarginMM,
      resolvedMarginMM: baseMarginMM,
      grewMM: 0,
      nearestAnchorMM: null,
    }
  }

  if (opts.construction && attachment !== 'velcro') {
    const effectContour = marginVariants.get(baseMarginMM)
    const grid = computePreparedGrid(effectContour, {
      ...cfg,
      pitchMM: opts.construction.pitchMM,
      pattern: opts.construction.pattern,
      construction: opts.construction,
    })
    return {
      designContourMM: contourMM,
      effectContourMM: effectContour.contour,
      grid,
      pitchMM: opts.construction.pitchMM,
      pattern: opts.construction.pattern,
      baseMarginMM,
      resolvedMarginMM: baseMarginMM,
      grewMM: 0,
      nearestAnchorMM: nearestAnchorPair(grid.anchors)?.distanceMM ?? null,
    }
  }

  const selected = autoPreparedGrid(marginVariants, cfg, baseMarginMM, maxGrowMM, {
    minN: opts.targetAnchors,
    density,
    pitchMM: opts.pitchMM,
    pattern: manualPattern,
    patterns: mode === 'auto' ? automaticPatternsForSource(source) : undefined,
  })
  const fit = selected.fit
  return {
    designContourMM: contourMM,
    effectContourMM: marginVariants.get(fit.sizeMM).contour,
    grid: fit.grid,
    pitchMM: selected.pitchMM,
    pattern: selected.pattern,
    baseMarginMM,
    resolvedMarginMM: fit.sizeMM,
    grewMM: fit.grew,
    nearestAnchorMM: nearestAnchorPair(fit.grid.anchors)?.distanceMM ?? null,
  }
}

// ─── EXACT ASYNC/CACHE CONTRACT ─────────────────────────────────────────────

/** Manual cache contract version. Bump whenever an output-affecting engine algorithm or policy changes. */
export const GRID_ENGINE_CACHE_VERSION = 6

export type StandardLadderShape = Exclude<StdShape, 'rect'>

/** Serializable size-family identity. No function/closure crosses the worker boundary. */
export type LadderRecipe =
  | { kind: 'standard'; shape: StandardLadderShape }
  | { kind: 'rounded-square'; radiusMM: number; minimumAnchors: number }
  | { kind: 'uniform-contour'; unitContour: Contour }

/** Serializable identity of one exact contour to resolve. */
export type PlanRecipe =
  | { kind: 'standard'; shape: StdShape; widthMM: number; heightMM: number }
  | { kind: 'rounded-square'; sizeMM: number; radiusMM: number }
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
  if (recipe.kind === 'rounded-square') {
    if (!Number.isFinite(recipe.radiusMM) || recipe.radiusMM < 0) {
      throw new RangeError('Rounded-square ladder radius must be a non-negative finite number.')
    }
    if (!Number.isInteger(recipe.minimumAnchors) || recipe.minimumAnchors < 1) {
      throw new RangeError('Rounded-square ladder minimum anchors must be a positive integer.')
    }
    return (sizeMM) => roundedSquareContourMM(sizeMM, sizeMM, recipe.radiusMM)
  }
  const unitContour = exactContourCopy(recipe.unitContour, 'Ladder recipe')
  return (sizeMM) => scaleContour(unitContour, sizeMM)
}

/** Execute the complete serialized ladder recipe so output constraints cannot drift outside its key. */
export function semanticLadderFromRecipe(
  recipe: LadderRecipe,
  law: SizeLaw = DEFAULT_LAW,
  mode: GridMode = 'auto',
  options: Pick<GridPlanOptions, 'pitchMM' | 'source' | 'density' | 'center'> = {},
): SemanticRung[] {
  const minimumAnchors = recipe.kind === 'rounded-square' ? recipe.minimumAnchors : 1
  return labelSemanticSteps(
    semanticSteps(
      ladderShapeFromRecipe(recipe),
      law,
      modeCombos(mode, options.pitchMM, options.source),
      minimumAnchors,
      options,
    ),
    law,
  )
}

/** Reconstruct one exact final contour inside the engine/worker. */
export function planContourFromRecipe(recipe: PlanRecipe): Contour {
  if (recipe.kind === 'standard') {
    if (!Number.isFinite(recipe.widthMM) || !Number.isFinite(recipe.heightMM)) {
      throw new RangeError('Standard plan recipe dimensions must be finite.')
    }
    return stdShapeContour(recipe.shape, recipe.widthMM, recipe.heightMM)
  }
  if (recipe.kind === 'rounded-square') {
    return roundedSquareContourMM(recipe.sizeMM, recipe.sizeMM, recipe.radiusMM)
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
  preparedContourEpsilonMM: GRID_ARITHMETIC_EPSILON_MM,
  constructionQuantumMM: GRID_CONSTRUCTION_QUANTUM_MM,
  circleTessellation: DEFAULT_CIRCLE_TESSELLATION_CALIBRATION,
  manufacturingOffsetArcToleranceMM: MANUFACTURING_OFFSET_ARC_TOLERANCE_MM,
  holdReachMM: HOLD_REACH_MM,
  focalSizeMM: FOCAL_SIZE_MM,
  focalRamp2MM: FOCAL_RAMP2_MM,
  defaultLaw: DEFAULT_LAW,
  defaultMarginMM: DEFAULT_MARGIN_MM,
  randomShapeMaxMM: RANDOM_SHAPE_MAX_MM,
  modes: {
    autoBySource: {
      product: modeCombos('auto', undefined, 'std'),
      freeform: modeCombos('auto', undefined, 'gen'),
    },
    standard: modeCombos('standard'),
    quincunx: modeCombos('quincunx'),
    diamond: modeCombos('diamond'),
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

function gridCacheKey(operation: 'ladder' | 'plan', body: unknown): string {
  return canonicalGridCacheValue({
    body,
    cacheVersion: GRID_ENGINE_CACHE_VERSION,
    operation,
    policy: GRID_ENGINE_POLICY_SIGNATURE,
  })
}

export function gridLadderCacheKey(
  recipe: LadderRecipe,
  law: SizeLaw = DEFAULT_LAW,
  mode: GridMode = 'auto',
  options: Pick<GridPlanOptions, 'pitchMM' | 'source' | 'density' | 'center'> = {},
): string {
  ladderShapeFromRecipe(recipe)
  return gridCacheKey('ladder', {
    law: normalizedLaw(law),
    mode,
    options: {
      pitchMM: options.pitchMM ?? null,
      source: options.source ?? 'std',
      density: options.density ?? 'light',
      center: options.center ?? 'centroid',
    },
    recipe,
  })
}

function effectiveGridPlanOptions(opts: GridPlanOptions = {}) {
  return {
    attachment: opts.attachment ?? 'magnetic',
    source: opts.source ?? 'std',
    mode: opts.mode ?? 'auto',
    density: opts.density ?? 'light',
    paddingMM: Math.max(PADDING_FLOOR_MM, opts.paddingMM ?? PADDING_FLOOR_MM),
    plan: opts.plan ?? 'auto',
    center: opts.center ?? 'centroid',
    baseMarginMM: opts.baseMarginMM ?? 0,
    maxGrowMM: Math.max(0, opts.maxGrowMM ?? DEFAULT_MARGIN_MM),
    pitchMM: opts.pitchMM ?? null,
    targetAnchors: opts.targetAnchors ?? TARGET_ANCHORS,
    signedBaseMargin: opts.signedBaseMargin ?? false,
    diagnosticVelcro: opts.diagnosticVelcro ?? false,
    construction: opts.construction ?? null,
  }
}

export function gridPlanCacheKey(recipe: PlanRecipe, opts: GridPlanOptions = {}): string {
  planContourFromRecipe(recipe)
  return gridCacheKey('plan', { options: effectiveGridPlanOptions(opts), recipe })
}
