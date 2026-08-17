// grid-core.ts — EXPLICIT CONSTRUCTION VALIDATION AND DELIVERY. Pure mm computation, no DOM/three.
//
// ONE SELECTOR SHIPS (T8). This module no longer SELECTS anything. It takes the caller's exact
// GridConstruction, proves every node legal against the real outline, proves no two application
// spots overlap, and delivers that population unchanged. A magnetic call WITHOUT a construction is
// REFUSED — there is no phase sweep, no auto search, no growth, no size ladder, and no
// deepest-point fallback to quietly invent one.
//
// What remains of the model:
//   • FIXED lattice, launch family 48/96 — the construction declares its own pitch and pattern, and
//     its basis is checked against them.
//   • PER-SPOT padding: a node is valid = inside the silhouette AND >= pad from the REAL outline —
//     per-node, no erosion, so pinched shapes keep every region.
//   • HOLD COVERAGE is radial at each actual magnet plus the bounded span between outline-adjacent
//     population-rim pairs no farther than 96mm. REPORTED, never used to choose.

import type { Contour, Pt } from './types'
import { MANUFACTURING_TOLERANCE_MM } from './geometry-truth'
import {
  distanceToPreparedContour,
  pointInPreparedContour,
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

export const LAUNCH_PITCHES_MM = [48, 96] as const
export const PADDING_FLOOR_MM = 10
export const MIN_ANCHORS = 2
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
/** How far a magnet holds material down before an edge would lift — a PHYSICAL distance, independent of
 *  the chosen grid pitch. Tunable after coupon testing. */
export const HOLD_REACH_MM = 48
/** Focal-ramp law thresholds (§10.7, coupon-tunable): below FOCAL_SIZE all-6; above, radial extremes
 *  take 8mm; from RAMP2 the focal window widens to 75% of max radius. */
export const FOCAL_SIZE_MM = 100
export const FOCAL_RAMP2_MM = 200

export interface GridConfig {
  attachment?: Attachment // default 'magnetic'
  paddingMM?: number
  plan?: MagnetPlan
  /** THE ONLY WAY TO SEAT MAGNETS. Delivery validates this population and uses it as given. */
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

export interface PerimeterCoverage {
  gaps: Pt[]
  uncoveredMM: number
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
  if (Math.abs(delta) < 1e-12) {
    return start >= min - 1e-9 && start <= max + 1e-9 ? interval : null
  }
  const t0 = (min - start) / delta
  const t1 = (max - start) / delta
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

interface BoundedRimSpan {
  first: Pt
  ux: number
  uy: number
  length: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function pairSpanInterval(
  a: Pt,
  b: Pt,
  span: BoundedRimSpan,
  radius: number,
): Interval | null {
  if (
    Math.max(a[0], b[0]) < span.minX - radius
    || Math.min(a[0], b[0]) > span.maxX + radius
    || Math.max(a[1], b[1]) < span.minY - radius
    || Math.min(a[1], b[1]) > span.maxY + radius
  ) return null
  const along = (point: Pt) =>
    (point[0] - span.first[0]) * span.ux + (point[1] - span.first[1]) * span.uy
  const across = (point: Pt) =>
    -(point[0] - span.first[0]) * span.uy + (point[1] - span.first[1]) * span.ux
  let strip: Interval | null = clipRange([0, 1], along(a), along(b), 0, span.length)
  if (strip) strip = clipRange(strip, across(a), across(b), -radius, radius)
  return strip
}

function ringPositionMM(point: Pt, ring: ReadonlyArray<Pt>): number {
  let travelledMM = 0
  let closest = { distanceMM: Infinity, positionMM: 0 }
  for (let index = 0; index < ring.length; index++) {
    const first = ring[index], second = ring[(index + 1) % ring.length]
    const dx = second[0] - first[0], dy = second[1] - first[1]
    const lengthSquared = dx * dx + dy * dy
    const lengthMM = Math.sqrt(lengthSquared)
    const t = lengthSquared <= 1e-12 ? 0 : Math.max(0, Math.min(1,
      ((point[0] - first[0]) * dx + (point[1] - first[1]) * dy) / lengthSquared,
    ))
    const projected: Pt = [first[0] + t * dx, first[1] + t * dy]
    const distanceMM = dist(point, projected)
    if (distanceMM < closest.distanceMM) {
      closest = { distanceMM, positionMM: travelledMM + t * lengthMM }
    }
    travelledMM += lengthMM
  }
  return closest.positionMM
}

function boundedRimSpans(
  outerRing: ReadonlyArray<Pt>,
  seated: ReadonlyArray<Pt>,
  pattern: GridPattern,
  pitchMM: number,
): BoundedRimSpan[] {
  // A pair spans fabric only when its magnets are consecutive around the real outer outline.
  // Any other short pair is an interior chord — the hull is not a magnet.
  const rim = splitPopulationBoundary(seated, pattern, pitchMM).rim
    .map((point) => ({ point, positionMM: ringPositionMM(point, outerRing) }))
    .sort((left, right) => left.positionMM - right.positionMM
      || left.point[0] - right.point[0] || left.point[1] - right.point[1])
  const maximumSpanMM = Math.max(...LAUNCH_PITCHES_MM)
  const spans: BoundedRimSpan[] = []
  const pairCount = rim.length === 2 ? 1 : rim.length
  for (let index = 0; index < pairCount; index += 1) {
    const first = rim[index].point
    const second = rim[(index + 1) % rim.length].point
    const axisX = second[0] - first[0], axisY = second[1] - first[1]
    const length = Math.hypot(axisX, axisY)
    if (length <= 1e-9 || length > maximumSpanMM + MANUFACTURING_TOLERANCE_MM) continue
    spans.push({
      first,
      ux: axisX / length,
      uy: axisY / length,
      length,
      minX: Math.min(first[0], second[0]),
      maxX: Math.max(first[0], second[0]),
      minY: Math.min(first[1], second[1]),
      maxY: Math.max(first[1], second[1]),
    })
  }
  return spans
}

/** Exact unsupported intervals per manufactured ring. The outer ring is supported radially by
 *  actual magnets plus the bounded fabric span between outline-adjacent lawful population-rim
 *  magnets no farther apart than the launch 96mm maximum. Hole rims remain per-magnet radial.
 *  No hull, miter, interior chord, or non-local bridge exists. */
export function exactPerimeterCoverage(
  contour: Contour,
  seated: ReadonlyArray<Pt>,
  safeRadius: number,
  pattern: GridPattern,
  pitchMM: number,
): PerimeterCoverage {
  const rimSpans = boundedRimSpans(contour.outer.pts, seated, pattern, pitchMM)
  const gaps: Pt[] = []
  let uncoveredMM = 0
  for (const [ringIndex, ring] of [contour.outer, ...contour.holes].entries()) {
    const pts = ring.pts
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      const segLen = dist(a, b)
      if (segLen < 1e-9) continue
      const ux = (b[0] - a[0]) / segLen, uy = (b[1] - a[1]) / segLen
      const coveredIntervals: Interval[] = []
      for (const anchor of seated) {
        const interval = discInterval(a, b, anchor, safeRadius)
        if (interval) coveredIntervals.push(interval)
      }
      // The anchor discs above already cover both endpoints of every span. Add only the bounded
      // connecting strip; recomputing endpoint discs per pair is duplicate geometry.
      if (ringIndex === 0) for (const span of rimSpans) {
        const interval = pairSpanInterval(a, b, span, safeRadius)
        if (interval) coveredIntervals.push(interval)
      }
      const intervals = mergeIntervals(coveredIntervals)
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

function constructionBasis(pattern: GridPattern, pitchMM: number): [Pt, Pt] {
  if (pattern === 'diamond') return [[pitchMM, pitchMM], [pitchMM, -pitchMM]]
  if (pattern === 'quincunx') return [[pitchMM, 0], [pitchMM / 2, pitchMM / 2]]
  return [[pitchMM, 0], [0, pitchMM]]
}

/** Population topology owns the light rim. A node is interior only when the exact lattice
 * population contains its immediate neighbour in both directions on both basis axes. */
function splitPopulationBoundary(
  points: ReadonlyArray<Pt>,
  pattern: GridPattern,
  pitchMM: number,
): { rim: Pt[]; interior: Pt[] } {
  const basis = constructionBasis(pattern, pitchMM)
  const directions: Pt[] = [
    basis[0],
    [-basis[0][0], -basis[0][1]],
    basis[1],
    [-basis[1][0], -basis[1][1]],
  ]
  const key = ([x, y]: Pt) => `${gridConstructionUnit(x)},${gridConstructionUnit(y)}`
  const population = new Set(points.map(key))
  const rim: Pt[] = []
  const interior: Pt[] = []
  for (const point of points) {
    const surrounded = directions.every(([dx, dy]) =>
      population.has(key([point[0] + dx, point[1] + dy])))
    const group = surrounded ? interior : rim
    group.push(point)
  }
  return { rim, interior }
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
 * Deliver one exact construction against a prepared silhouette.
 *
 * VALIDATION, THEN DELIVERY, AND NOTHING ELSE. Every node must sit inside the outline with its full
 * application pad clear of it, and no two application spots may overlap. The population is then
 * delivered exactly as declared — no rim split, no thinning, no re-solve. Coverage and flaps are
 * MEASURED and reported; they never alter what is delivered.
 */
export function computePreparedGrid(prepared: PreparedContour, cfg: GridConfig = {}): GridResult {
  const contourMM = prepared.contour
  const attachment: Attachment = cfg.attachment ?? 'magnetic'
  // VELCRO LAW: no grid exists — the back is a full velcro hook in the silhouette. Any shape, any
  // size; nothing to seat, nothing to cover. This is not a selection, so it survives the cutover.
  if (attachment === 'velcro') {
    return {
      attachment, twinRequired: false, anchors: [], candidates: [], flaps: [], uncoveredMM: 0, ok: true,
      issues: [], pitchCentreMM: 0, edgeRangeMM: [0, 0], applicationPadMM: 0,
    }
  }
  // NO CONSTRUCTION, NO GRID. The old path defaulted the pitch and searched for a phase; refusing is
  // the point of shipping one selector. Logic owns selection and hands the answer down.
  const construction = cfg.construction
  if (!construction) {
    throw new RangeError('A magnetic grid requires an explicit construction; this engine never selects one.')
  }
  const pitch = construction.pitchMM
  if (!(LAUNCH_PITCHES_MM as readonly number[]).includes(pitch)) {
    throw new RangeError(`Unsupported magnetic-grid pitch ${pitch}mm; launch pitches are 48mm and 96mm.`)
  }
  const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)
  const pattern = construction.pattern
  const plan = cfg.plan ?? 'auto'
  const bb = prepared.bbox
  const issues: string[] = []

  // A node is valid only when the complete application spot keeps the hard pad from the manufactured
  // contour. The same physical floor governs sizing and delivery; no corner-specific rescue exists.
  const valid = (p: Pt) => {
    if (!pointInPreparedContour(p, prepared)) return false
    return distanceToPreparedContour(p, prepared) + GRID_ARITHMETIC_EPSILON_MM >= pad
  }

  const seated = constructionPoints(construction)
  if (seated.some((point) => !valid(point))) {
    throw new RangeError('Grid construction places an anchor outside the legal padding floor.')
  }
  for (let i = 0; i < seated.length; i++) for (let j = i + 1; j < seated.length; j++) {
    if (dist(seated[i], seated[j]) < 2 * pad - 1e-6) {
      throw new RangeError('Grid construction overlaps magnet application spots.')
    }
  }

  const anchors = assignSizes(seated, plan, Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY))

  if (!seated.length) issues.push(`No room for a magnet — too small/thin to keep a magnet ${pad}mm from every edge.`)
  else if (seated.length < MIN_ANCHORS) issues.push(`Too small — only ${seated.length} magnet grips material. Increase the size or the max auto-grow.`)
  const coverage = seated.length
    ? exactPerimeterCoverage(contourMM, seated, HOLD_REACH_MM, pattern, pitch)
    : { gaps: [], uncoveredMM: 0 }
  const flaps = coverage.gaps
  if (flaps.length > 0) issues.push(`Some edge areas sit outside the supported magnet spans (red edge) and could lift. Raise the size / max auto-grow.`)

  let minD = 8, maxD = 6
  for (const a of anchors) { if (a.dia < minD) minD = a.dia; if (a.dia > maxD) maxD = a.dia }
  if (anchors.length === 0) { minD = 6; maxD = 6 }

  return {
    attachment, twinRequired: attachment === 'twinfix', anchors,
    /** Always empty: the interior split belonged to the deleted delivery thinning. */
    candidates: [],
    flaps,
    uncoveredMM: coverage.uncoveredMM,
    ok: issues.length === 0,
    issues,
    pitchCentreMM: pitch,
    edgeRangeMM: [pitch + minD, pitch + maxD],
    applicationPadMM: pad,
  }
}

/** Scale a normalized contour (longest side = 1mm) to a real longest-side size in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  const scaleRing = (pts: ReadonlyArray<Pt>) => pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt)
  return { outer: { pts: scaleRing(base.outer.pts) }, holes: base.holes.map((h) => ({ pts: scaleRing(h.pts) })) }
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
