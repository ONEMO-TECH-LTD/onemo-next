// compute/structure.ts — pure shape/arrangement MEASURES for the judge. No product values, no
// thresholds, no classification: every function returns numbers or value-free predicates; the
// logic layer compares them against released calibration values. (Moved here from the judge —
// QA build-audit 2026-08-15: geometry belongs in compute/, the judge only ranks.)

import { Clipper, FillRule, type Path64, type Paths64 } from '@countertype/clipper2-ts'
import {
  computeContinuousFeasibleSet,
  CONTINUOUS_REGISTRATION_QUANTUM_MM,
  type ContinuousFeasibilityResult,
} from './continuous-feasibility'
import { prepareExactContour, distanceToPreparedContour, pointInPreparedContour } from './grid-prepared'
import type { Contour, Pt } from './types'

/** Scanline profile across one axis: per sample line, the outermost span and its centre. */
export function scanProfile(
  pts: ReadonlyArray<Pt>,
  axis: 0 | 1,
  lo: number,
  hi: number,
  samples: number,
): { span: number; centre: number }[] {
  const out: { span: number; centre: number }[] = []
  for (let i = 1; i < samples; i++) {
    const c = lo + ((hi - lo) * i) / samples
    let mn = Infinity
    let mx = -Infinity
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j]
      const b = pts[(j + 1) % pts.length]
      const a1 = a[axis]
      const b1 = b[axis]
      if (a1 === b1) continue
      if ((a1 <= c && b1 > c) || (b1 <= c && a1 > c)) {
        const other = axis === 0 ? 1 : 0
        const x = a[other] + ((c - a1) / (b1 - a1)) * (b[other] - a[other])
        if (x < mn) mn = x
        if (x > mx) mx = x
      }
    }
    if (mn <= mx) out.push({ span: mx - mn, centre: (mn + mx) / 2 })
  }
  return out
}

/** Sampled material area strictly above a horizontal line (y-down frame: y < yLine).
 *  All spans per scanline (paired crossings), not just the outermost — concave rows count
 *  their true material only. Pure measurement; the caller owns any bound. */
export function areaAboveLine(
  pts: ReadonlyArray<Pt>,
  yLine: number,
  samples: number,
): number {
  let minY = Infinity
  for (const p of pts) if (p[1] < minY) minY = p[1]
  if (!(yLine > minY) || samples < 1) return 0
  const dy = (yLine - minY) / samples
  let area = 0
  for (let i = 0; i < samples; i++) {
    const c = minY + (i + 0.5) * dy
    const xs: number[] = []
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j]
      const b = pts[(j + 1) % pts.length]
      if (a[1] === b[1]) continue
      if ((a[1] <= c && b[1] > c) || (b[1] <= c && a[1] > c)) {
        xs.push(a[0] + ((c - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
      }
    }
    xs.sort((m, n) => m - n)
    for (let k = 0; k + 1 < xs.length; k += 2) area += (xs[k + 1] - xs[k]) * dy
  }
  return area
}

/** Middle-third minimum span over end-third maximum span — the waist measure. */
export function waistRatio(rows: ReadonlyArray<{ span: number }>): number {
  const third = Math.floor(rows.length / 3)
  if (third < 1) return 1
  const midMin = Math.min(...rows.slice(third, rows.length - third).map((r) => r.span))
  const endMax = Math.max(
    ...rows.slice(0, third).map((r) => r.span),
    ...rows.slice(rows.length - third).map((r) => r.span),
  )
  return endMax > 0 ? midMin / endMax : 1
}

export interface ShapeFeatures {
  /** Linear drift of row centres across the height, as a fraction of the width. */
  diagSlopeFrac: number
  /** Pearson correlation of row span with vertical position (+1 = widens downward). */
  taperCorr: number
  /** Waist ratios along each axis. */
  waistY: number
  waistX: number
  /** Worst row-centre deviation from the vertical axis, as a fraction of the width. */
  mirrorDeviationFrac: number
  tall: boolean
}

/** All scanline-derived shape features in one pass. Pure measurement — no thresholds. */
export function shapeFeatures(contour: Contour, samples: number): ShapeFeatures | null {
  const pts = contour.outer.pts
  if (pts.length < 3) return null
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const width = maxX - minX
  if (!(width > 0)) return null
  const rows = scanProfile(pts, 1, minY, maxY, samples)
  const cols = scanProfile(pts, 0, minX, maxX, samples)
  if (rows.length < 4 || cols.length < 4) return null
  const n = rows.length
  const ys = rows.map((_, i) => i / (n - 1))
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  const cxs = rows.map((r) => r.centre)
  const meanC = cxs.reduce((a, b) => a + b, 0) / n
  let cov = 0
  let varY = 0
  for (let i = 0; i < n; i++) {
    cov += (ys[i] - meanY) * (cxs[i] - meanC)
    varY += (ys[i] - meanY) ** 2
  }
  const diagSlopeFrac = varY > 0 ? cov / varY / width : 0
  const spans = rows.map((r) => r.span)
  const meanS = spans.reduce((a, b) => a + b, 0) / n
  let covS = 0
  let varS = 0
  for (let i = 0; i < n; i++) {
    covS += (ys[i] - meanY) * (spans[i] - meanS)
    varS += (spans[i] - meanS) ** 2
  }
  const taperCorr = varS > 0 ? covS / Math.sqrt(varY * varS) : 0
  const cx = (minX + maxX) / 2
  let mirrorDeviationFrac = 0
  for (const r of rows) {
    const d = Math.abs(r.centre - cx) / width
    if (d > mirrorDeviationFrac) mirrorDeviationFrac = d
  }
  return {
    diagSlopeFrac,
    taperCorr,
    waistY: waistRatio(rows),
    waistX: waistRatio(cols),
    mirrorDeviationFrac,
    tall: maxY - minY >= width,
  }
}

/** The deepest-material point (sampled pole of inaccessibility) over an NxN field. */
export function deepestPointSampled(contour: Contour, samples: number): Pt | null {
  const prepared = prepareExactContour(contour)
  const bb = prepared.bbox
  let best: Pt | null = null
  let bestD = -Infinity
  for (let i = 1; i < samples; i++) {
    for (let j = 1; j < samples; j++) {
      const p: Pt = [
        bb.minX + ((bb.maxX - bb.minX) * i) / samples,
        bb.minY + ((bb.maxY - bb.minY) * j) / samples,
      ]
      if (!pointInPreparedContour(p, prepared)) continue
      const d = distanceToPreparedContour(p, prepared)
      if (d > bestD) {
        bestD = d
        best = p
      }
    }
  }
  return best
}

/** Every point reflected about the set's own vertical centre lands on another point. */
export function pointsMirrorSymmetric(points: ReadonlyArray<Pt>): boolean {
  let minX = Infinity
  let maxX = -Infinity
  for (const [x] of points) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  const cx = minX + (maxX - minX) / 2
  const tol = 1e-6
  return points.every(([x, y]) =>
    points.some(([bx, by]) => Math.abs(bx - (2 * cx - x)) < tol && Math.abs(by - y) < tol),
  )
}

/** The points are every combination of their distinct columns and rows — a filled block. */
export function pointsFillBlock(points: ReadonlyArray<Pt>, cellMM: number): boolean {
  const q = (n: number) => Math.round(n / cellMM)
  const xs = new Set(points.map(([x]) => q(x)))
  const ys = new Set(points.map(([, y]) => q(y)))
  if (xs.size * ys.size !== points.length) return false
  const have = new Set(points.map(([x, y]) => `${q(x)}:${q(y)}`))
  for (const x of xs) for (const y of ys) if (!have.has(`${x}:${y}`)) return false
  return true
}

/** Single-linkage connectivity: every point reaches every other through links <= capMM. */
export function pointsOneComponent(points: ReadonlyArray<Pt>, capMM: number): boolean {
  const n = points.length
  if (n < 2) return true
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const a = points[i]
      const b = points[j]
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= capMM + 1e-6) parent[find(i)] = find(j)
    }
  const root = find(0)
  for (let i = 1; i < n; i++) if (find(i) !== root) return false
  return true
}

// ─── T5 · certified neutral descriptors ────────────────────────────────────────────────────────
//
// Compute MEASURES; it never classifies, thresholds, exempts or ranks. Each descriptor certifies
// its own optimum over the WHOLE feasible set — T4's positive-area components AND T4's exact
// witnesses, because a lower-dimensional witness can be the global optimum — by exactly one
// admissible method: an exact argopt, an outward-bounded interval, or an honest
// DECISION_INDETERMINATE. No vertex set, canonical projection, directional extremum or fixed
// sample implies completeness on its own; where one is used, the proof that makes it complete is
// written at its call site. No proof transfers between descriptors.
//
// Set operations run on T4's own 1µm integer lattice through the same Clipper representation, so
// "exact" means exact there, and T4's envelope is CARRIED into every result rather than restated.
// Areas and first moments accumulate in BigInt: at 1µm a 120mm contour drives the moment sum past
// 3e17, well beyond Number.MAX_SAFE_INTEGER (9.0e15), where a double is silently wrong. A value is
// reported EXACT only when its rational form converts losslessly; otherwise it is an outward-
// rounded INTERVAL and lo !== hi.
//
// Direction is a property of the descriptor's physical meaning, not a caller choice.

// FORMULA PROVENANCE. The coverage fraction, the width-normalised hanging measure and the
// distribution variance key are ENGINEERING. The designated briefs rule the ORDER these feed
// (Logic Spec §2 / Product Base §11) and leave every numerical definition open; none of them is a
// ruled value.
//
// BigInt is built with BigInt(n): this project targets ES2017, where BigInt literals are unavailable.

const LATTICE = 1 / CONTINUOUS_REGISTRATION_QUANTUM_MM
const B0 = BigInt(0)
const B1 = BigInt(1)
const B2 = BigInt(2)
const B3 = BigInt(3)
const B6 = BigInt(6)
const B10 = BigInt(10)
const LATTICE_BIG = BigInt(Math.round(1 / CONTINUOUS_REGISTRATION_QUANTUM_MM))
const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER)
const ULP = 2 ** -52

export type ObjectiveDirection = 'maximize' | 'minimize'
export type DescriptorUnit = 'count' | 'ratio' | 'mm' | 'mm2' | 'mm3'
export type DescriptorStatus = 'EXACT' | 'INTERVAL' | 'DECISION_INDETERMINATE'

/** Certified optimal registrations: cells for a set-valued optimum, points for exact ones. */
export interface DescriptorArgopt {
  regions: ReadonlyArray<ReadonlyArray<Pt>>
  points: ReadonlyArray<Pt>
}

export interface ComponentDescriptorEvidence {
  componentIndex: number
  /** False when this component's own search did not certify; `lo` then only bounds it. */
  resolved: boolean
  lo: number
  hi: number
  argopt: DescriptorArgopt | null
}

export interface WitnessDescriptorEvidence {
  witnessMM: Pt
  lo: number
  hi: number
}

export interface DescriptorEvidence {
  units: DescriptorUnit
  direction: ObjectiveDirection
  status: DescriptorStatus
  lo: number
  hi: number
  argopt: DescriptorArgopt | null
  completenessProof: string
  sourceEnvelope: ContinuousFeasibilityResult['envelope']
  /** Phase one: the local optimum on each positive-area component of F. */
  perComponent: ReadonlyArray<ComponentDescriptorEvidence>
  /** Phase one: the exact value at each T4 witness, which may hold the global optimum. */
  witnessEvidence: ReadonlyArray<WitnessDescriptorEvidence>
}

/** What every descriptor needs: the material, the pattern, and the complete feasible set. */
export interface DescriptorSubject {
  contour: Contour
  offsetsMM: ReadonlyArray<Pt>
  effectiveRadiusMM: number
  feasible: ContinuousFeasibilityResult
}

interface Interval {
  lo: number
  hi: number
}

const outwardDown = (v: number): number => v - Math.abs(v) * ULP - Number.MIN_VALUE
const outwardUp = (v: number): number => v + Math.abs(v) * ULP + Number.MIN_VALUE

/** A rational converted to doubles: lossless when it can be, outward-bounded when it cannot. */
function ratioToInterval(num: bigint, den: bigint): Interval {
  if (den === B0) throw new RangeError('Descriptor ratio has a zero denominator.')
  const negative = num < B0 !== den < B0
  const n = num < B0 ? -num : num
  const d = den < B0 ? -den : den
  if (n % d === B0) {
    const q = n / d
    if (q <= MAX_SAFE_BIG) {
      const v = Number(negative ? -q : q)
      return { lo: v, hi: v }
    }
  }
  let decimals = 9
  let unit = B10 ** BigInt(decimals)
  let scaled = (n * unit) / d
  while (decimals > 0 && scaled + B1 > MAX_SAFE_BIG) {
    decimals -= 1
    unit = B10 ** BigInt(decimals)
    scaled = (n * unit) / d
  }
  if (scaled + B1 > MAX_SAFE_BIG) throw new RangeError('Descriptor ratio exceeds a representable range.')
  const denom = Number(unit)
  const lowMagnitude = outwardDown(Number(scaled) / denom)
  const highMagnitude = outwardUp(Number(scaled + B1) / denom)
  return negative
    ? { lo: -highMagnitude, hi: -lowMagnitude }
    : { lo: lowMagnitude, hi: highMagnitude }
}

/** A Contour copy of a readonly ring — the prepared-contour door takes a mutable point list. */
function ringContour(ring: ReadonlyArray<Pt>): Contour {
  return { outer: { pts: ring.map(([x, y]) => [x, y] as Pt) }, holes: [] }
}

function toLatticePath(ring: ReadonlyArray<Pt>): Path64 | null {
  if (ring.length < 3) return null
  const flat: number[] = []
  for (const [x, y] of ring) flat.push(Math.round(x * LATTICE), Math.round(y * LATTICE))
  return Clipper.makePath(flat)
}

function toLatticePaths(rings: ReadonlyArray<ReadonlyArray<Pt>>): Paths64 {
  const paths: Paths64 = []
  for (const ring of rings) {
    const path = toLatticePath(ring)
    if (path) paths.push(path)
  }
  return paths
}

function fromLatticePaths(paths: Paths64): ReadonlyArray<ReadonlyArray<Pt>> {
  return paths.map((path) => path.map(({ x, y }) => [x / LATTICE, y / LATTICE] as Pt))
}

function contourBounds(pts: ReadonlyArray<Pt>): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

function boundsContour(bounds: ReturnType<typeof contourBounds>): Contour {
  return {
    outer: {
      pts: [
        [bounds.minX, bounds.minY],
        [bounds.maxX, bounds.minY],
        [bounds.maxX, bounds.maxY],
        [bounds.minX, bounds.maxY],
      ],
    },
    holes: [],
  }
}

/** Exact integer area and first moments of a lattice region. Sign-normalised to a positive area. */
function integerAreaAndMoments(paths: Paths64): {
  twiceArea: bigint
  sixMomentX: bigint
  sixMomentY: bigint
} {
  let twiceArea = B0
  let sixMomentX = B0
  let sixMomentY = B0
  for (const path of paths) {
    for (let index = 0; index < path.length; index += 1) {
      const a = path[index]
      const b = path[(index + 1) % path.length]
      const ax = BigInt(Math.round(a.x)), ay = BigInt(Math.round(a.y))
      const bx = BigInt(Math.round(b.x)), by = BigInt(Math.round(b.y))
      const cross = ax * by - bx * ay
      twiceArea += cross
      sixMomentX += (ax + bx) * cross
      sixMomentY += (ay + by) * cross
    }
  }
  return twiceArea < B0
    ? { twiceArea: -twiceArea, sixMomentX: -sixMomentX, sixMomentY: -sixMomentY }
    : { twiceArea, sixMomentX, sixMomentY }
}

/** The material on the lattice, prepared once per descriptor call. */
interface MaterialSubject {
  paths: Paths64
  bounds: ReturnType<typeof contourBounds>
  twiceArea: bigint
  sixMomentX: bigint
  sixMomentY: bigint
}

function materialSubject(contour: Contour): MaterialSubject {
  const path = toLatticePath(contour.outer.pts)
  if (!path) throw new RangeError('Material contour must have at least three vertices.')
  const paths: Paths64 = [path]
  return { paths, bounds: contourBounds(contour.outer.pts), ...integerAreaAndMoments(paths) }
}

/**
 * The material beyond one axis-aligned lattice cut, with its exact area AND first moment.
 *
 * One clip serves both the hanging measure and peel leverage, so there is no second clipping path.
 * Exact on the lattice: with the cut at integer `c`, ∫|c − u|dA = ±(c·A − ∫u dA), and both terms
 * come from the BigInt kernel, so the moment is one rational — no centroid division and no float
 * accumulation.
 */
function clippedAreaAndMoment(
  subject: MaterialSubject,
  axis: 0 | 1,
  keepBelow: boolean,
  cutMM: number,
): { areaMM2: Interval; momentMM3: Interval } {
  const cut = Math.round(cutMM * LATTICE)
  const b = subject.bounds
  let x0 = Math.round(b.minX * LATTICE) - 1
  let x1 = Math.round(b.maxX * LATTICE) + 1
  let y0 = Math.round(b.minY * LATTICE) - 1
  let y1 = Math.round(b.maxY * LATTICE) + 1
  if (axis === 0) {
    if (keepBelow) x1 = Math.min(x1, cut)
    else x0 = Math.max(x0, cut)
  } else if (keepBelow) y1 = Math.min(y1, cut)
  else y0 = Math.max(y0, cut)
  const zero: Interval = { lo: 0, hi: 0 }
  if (x1 <= x0 || y1 <= y0) return { areaMM2: zero, momentMM3: zero }
  const window = Clipper.makePath([x0, y0, x1, y0, x1, y1, x0, y1])
  const clipped = Clipper.intersect(subject.paths, [window], FillRule.NonZero)
  if (!clipped.length) return { areaMM2: zero, momentMM3: zero }
  const { twiceArea, sixMomentX, sixMomentY } = integerAreaAndMoments(clipped)
  const sixMoment = axis === 0 ? sixMomentX : sixMomentY
  const cutBig = BigInt(cut)
  const numerator = keepBelow
    ? B3 * cutBig * twiceArea - sixMoment
    : sixMoment - B3 * cutBig * twiceArea
  return {
    areaMM2: ratioToInterval(twiceArea, B2 * LATTICE_BIG * LATTICE_BIG),
    momentMM3: ratioToInterval(numerator, B6 * LATTICE_BIG * LATTICE_BIG * LATTICE_BIG),
  }
}

interface PaddedBox {
  leftMM: number
  rightMM: number
  topMM: number
  bottomMM: number
}

/** The padded grid box for a registration: the magnet centres grown by the effective radius. */
function paddedBox(subject: DescriptorSubject, t: Pt): PaddedBox {
  const xs = subject.offsetsMM.map(([x]) => x)
  const ys = subject.offsetsMM.map(([, y]) => y)
  const r = subject.effectiveRadiusMM
  return {
    leftMM: t[0] + Math.min(...xs) - r,
    rightMM: t[0] + Math.max(...xs) + r,
    topMM: t[1] + Math.min(...ys) - r,
    bottomMM: t[1] + Math.max(...ys) + r,
  }
}

/** The padded block's own width — the hanging measure's normaliser. Registration-invariant. */
function paddedWidthMM(subject: DescriptorSubject): number {
  const xs = subject.offsetsMM.map(([x]) => x)
  return Math.max(...xs) - Math.min(...xs) + 2 * subject.effectiveRadiusMM
}

function requireSubject(subject: DescriptorSubject): void {
  if (!subject.offsetsMM.length) throw new RangeError('At least one pattern offset is required.')
  if (!(subject.effectiveRadiusMM > 0) || !Number.isFinite(subject.effectiveRadiusMM))
    throw new RangeError('Effective radius must be positive and finite.')
}

/**
 * Phase two: restrict phase-one evidence against the certified global anchor.
 *
 * The envelope is the tight one — min(lo)/min(hi) to minimise, max(lo)/max(hi) to maximise. An
 * UNRESOLVED component is never filtered out: it makes the whole descriptor indeterminate unless
 * its retained DIRECTION-RELEVANT bound proves it cannot win, and a missing such bound always
 * means it can. `complete` is false when phase one could not gather all of its own evidence.
 */
function globalAnchor(
  direction: ObjectiveDirection,
  units: DescriptorUnit,
  completenessProof: string,
  subject: DescriptorSubject,
  perComponent: ReadonlyArray<ComponentDescriptorEvidence>,
  witnessEvidence: ReadonlyArray<WitnessDescriptorEvidence>,
  exact: boolean,
  complete = true,
): DescriptorEvidence {
  const indeterminate = (): DescriptorEvidence => ({
    units,
    direction,
    status: 'DECISION_INDETERMINATE',
    lo: Number.NaN,
    hi: Number.NaN,
    argopt: null,
    completenessProof,
    sourceEnvelope: subject.feasible.envelope,
    perComponent,
    witnessEvidence,
  })
  const resolved: Array<{ lo: number; hi: number; argopt: DescriptorArgopt }> = [
    ...perComponent
      .filter((item) => item.resolved && item.argopt !== null)
      .map((item) => ({ lo: item.lo, hi: item.hi, argopt: item.argopt as DescriptorArgopt })),
    ...witnessEvidence.map((item) => ({
      lo: item.lo,
      hi: item.hi,
      argopt: { regions: [], points: [item.witnessMM] } as DescriptorArgopt,
    })),
  ]
  if (!complete || !resolved.length) return indeterminate()
  const envelopeLo =
    direction === 'minimize'
      ? Math.min(...resolved.map((item) => item.lo))
      : Math.max(...resolved.map((item) => item.lo))
  const envelopeHi =
    direction === 'minimize'
      ? Math.min(...resolved.map((item) => item.hi))
      : Math.max(...resolved.map((item) => item.hi))
  // An unresolved component may only be ignored when its retained DIRECTION-RELEVANT bound puts it
  // out of contention: minimising needs a finite `lo`, maximising a finite `hi`. Missing that bound
  // always means the component could still win.
  const unresolvedCanWin = perComponent.some((item) => {
    if (item.resolved && item.argopt !== null) return false
    const bound = direction === 'minimize' ? item.lo : item.hi
    if (!Number.isFinite(bound)) return true
    return direction === 'minimize' ? bound <= envelopeHi : bound >= envelopeLo
  })
  if (unresolvedCanWin) return indeterminate()
  const tied = resolved.filter((item) =>
    direction === 'minimize' ? item.lo <= envelopeHi : item.hi >= envelopeLo,
  )
  return {
    units,
    direction,
    status: exact ? 'EXACT' : 'INTERVAL',
    lo: envelopeLo,
    hi: envelopeHi,
    argopt: {
      regions: tied.flatMap((item) => item.argopt.regions),
      points: tied.flatMap((item) => item.argopt.points),
    },
    completenessProof,
    sourceEnvelope: subject.feasible.envelope,
    perComponent,
    witnessEvidence,
  }
}

// ─── hierarchy ─────────────────────────────────────────────────────────────────────────────────

export interface SafeComponentNode {
  levelIndex: number
  clearanceLevelMM: number
  /** Certified: a disc of the level's radius fits, so the local width is at least twice it. */
  widthFloorMM: number
  areaMM2Lo: number
  areaMM2Hi: number
  ringMM: ReadonlyArray<Pt>
  parentIndex: number | null
  parentStatus: 'RESOLVED' | 'INDETERMINATE' | 'ROOT'
  persistenceLevels: number
}

export interface ComponentHierarchyLevel {
  clearanceLevelMM: number
  status: ContinuousFeasibilityResult['status']
  envelope: ContinuousFeasibilityResult['envelope']
  nodes: ReadonlyArray<SafeComponentNode>
  witnessesMM: ReadonlyArray<Pt>
  /**
   * No component AND no witness. Such a level is evidence only when T4 certified infeasibility;
   * otherwise its own `status` is indeterminate and it may not be read as ordinary evidence.
   */
  collapsed: boolean
}

export interface ComponentHierarchy {
  levels: ReadonlyArray<ComponentHierarchyLevel>
}

/**
 * Component and persistence evidence at CALLER-CALIBRATED clearance levels.
 *
 * The levels are the caller's alone: finite, positive, strictly increasing and distinct, or the
 * call is rejected. Nothing here defaults, and no r+4/r+8/r+12 ladder exists. Only certified
 * quantities are reported — the level, the width floor the erosion actually proves, exact area and
 * persistence. Strong/marginal classification is Logic's and is not computed.
 */
export function buildComponentHierarchy(
  contour: Contour,
  levelsMM: ReadonlyArray<number>,
  callerWitnessesByLevel: ReadonlyArray<ReadonlyArray<Pt>> = [],
): ComponentHierarchy {
  if (!levelsMM.length) throw new RangeError('Clearance levels must be supplied by the caller.')
  levelsMM.forEach((level, index) => {
    if (!Number.isFinite(level) || level <= 0)
      throw new RangeError('Clearance levels must be finite and positive.')
    if (index > 0 && level <= levelsMM[index - 1])
      throw new RangeError('Clearance levels must be strictly increasing and distinct.')
  })

  const domain = boundsContour(contourBounds(contour.outer.pts))

  const levels: ComponentHierarchyLevel[] = levelsMM.map((level, levelIndex) => {
    const feasible = computeContinuousFeasibleSet({
      contour,
      permittedDomain: domain,
      effectiveRadiusMM: level,
      offsetsMM: [[0, 0]],
      exactWitnessesMM: callerWitnessesByLevel[levelIndex] ?? [],
    })
    const nodes = feasible.components.map((ring) => {
      const { twiceArea } = integerAreaAndMoments(toLatticePaths([ring]))
      const area = ratioToInterval(twiceArea, B2 * LATTICE_BIG * LATTICE_BIG)
      return {
        levelIndex,
        clearanceLevelMM: level,
        widthFloorMM: 2 * level,
        areaMM2Lo: area.lo,
        areaMM2Hi: area.hi,
        ringMM: ring,
        parentIndex: null as number | null,
        parentStatus: 'ROOT' as SafeComponentNode['parentStatus'],
        persistenceLevels: 1,
      }
    })
    return {
      clearanceLevelMM: level,
      status: feasible.status,
      envelope: feasible.envelope,
      nodes,
      witnessesMM: feasible.exactWitnessesMM,
      collapsed: feasible.components.length === 0 && feasible.exactWitnessesMM.length === 0,
    }
  })

  // Parent resolution by an EXACT set test — child ⊆ parent iff the difference is empty. No
  // representative point is chosen, so an ambiguous nesting returns indeterminate instead of a
  // guess. Erosion monotonicity predicts exactly one parent; the code verifies rather than assumes.
  for (let levelIndex = 1; levelIndex < levels.length; levelIndex += 1) {
    const parents = levels[levelIndex - 1].nodes
    for (const node of levels[levelIndex].nodes) {
      const child = toLatticePaths([node.ringMM])
      const containing: number[] = []
      parents.forEach((parent, parentIndex) => {
        const remainder = Clipper.difference(child, toLatticePaths([parent.ringMM]), FillRule.NonZero)
        if (integerAreaAndMoments(remainder).twiceArea === B0) containing.push(parentIndex)
      })
      if (containing.length === 1) {
        node.parentIndex = containing[0]
        node.parentStatus = 'RESOLVED'
      } else {
        node.parentIndex = null
        node.parentStatus = 'INDETERMINATE'
      }
    }
  }

  for (let levelIndex = levels.length - 2; levelIndex >= 0; levelIndex -= 1)
    levels[levelIndex].nodes.forEach((node, nodeIndex) => {
      const deepest = levels[levelIndex + 1].nodes
        .filter((child) => child.parentStatus === 'RESOLVED' && child.parentIndex === nodeIndex)
        .reduce((best, child) => Math.max(best, child.persistenceLevels), 0)
      node.persistenceLevels = 1 + deepest
    })

  return { levels }
}

// ─── P8 · balance — minimize, mm² ──────────────────────────────────────────────────────────────

/**
 * ‖t + mean(offsets) − materialCentroid‖². INTERVAL-REFINED INCUMBENT, not an exact argopt.
 *
 * The structure is exact: the value is the squared distance to t* = centroid − mean(offsets), and a
 * strictly convex quadratic attains its minimum over a closed set either at the unconstrained
 * minimiser — STRICTLY INTERIOR whenever t* ∈ F, precisely the case a vertex/projection/extremum
 * recipe misses — or on the boundary, where on each edge it is minimised at the exact point-to-
 * segment projection. So {t*} ∪ {per-edge projections and endpoints} provably contains the optimum
 * of the exact problem.
 *
 * What is NOT exact is t* itself: the centroid is a rational that converts to an interval, and the
 * search runs from that interval's midpoint. The returned point is therefore an incumbent whose
 * value is bracketed to ±ρ, the centroid box's half-diagonal, and the argopt is an equivalent set
 * under that bracket — not a certified exact minimiser.
 */
export function balanceEvidence(subject: DescriptorSubject): DescriptorEvidence {
  requireSubject(subject)
  const material = materialSubject(subject.contour)
  if (material.twiceArea === B0) throw new RangeError('Material contour has zero area.')
  const centroidX = ratioToInterval(material.sixMomentX, B3 * material.twiceArea * LATTICE_BIG)
  const centroidY = ratioToInterval(material.sixMomentY, B3 * material.twiceArea * LATTICE_BIG)
  const meanX = subject.offsetsMM.reduce((sum, [x]) => sum + x, 0) / subject.offsetsMM.length
  const meanY = subject.offsetsMM.reduce((sum, [, y]) => sum + y, 0) / subject.offsetsMM.length
  const target: Pt = [(centroidX.lo + centroidX.hi) / 2 - meanX, (centroidY.lo + centroidY.hi) / 2 - meanY]
  // Half-diagonal of the centroid's own uncertainty box: every distance below is certain to ±ρ.
  const rho = Math.hypot(centroidX.hi - centroidX.lo, centroidY.hi - centroidY.lo) / 2

  const valueAt = (point: Pt): Interval => {
    const distance = Math.hypot(point[0] - target[0], point[1] - target[1])
    const low = Math.max(0, distance - rho)
    const high = distance + rho
    return { lo: outwardDown(low * low), hi: outwardUp(high * high) }
  }

  const perComponent = subject.feasible.components.map((ring, componentIndex) => {
    const prepared = prepareExactContour(ringContour(ring))
    if (pointInPreparedContour(target, prepared)) {
      const value = valueAt(target)
      return {
        componentIndex,
        resolved: true,
        lo: value.lo,
        hi: value.hi,
        argopt: { regions: [], points: [target] } as DescriptorArgopt,
      }
    }
    let best: { point: Pt; value: Interval } | null = null
    for (let index = 0; index < ring.length; index += 1) {
      const a = ring[index]
      const b = ring[(index + 1) % ring.length]
      for (const point of [[a[0], a[1]] as Pt, segmentProjection(target, a, b)]) {
        const value = valueAt(point)
        if (!best || value.lo < best.value.lo) best = { point, value }
      }
    }
    return best
      ? {
          componentIndex,
          resolved: true,
          lo: best.value.lo,
          hi: best.value.hi,
          argopt: { regions: [], points: [best.point] } as DescriptorArgopt,
        }
      : { componentIndex, resolved: false, lo: Number.NaN, hi: Number.NaN, argopt: null }
  })

  const witnessEvidence = subject.feasible.exactWitnessesMM.map((witness) => {
    const value = valueAt(witness)
    return { witnessMM: witness, lo: value.lo, hi: value.hi }
  })

  return globalAnchor(
    'minimize',
    'mm2',
    'interval-refined incumbent: strictly convex quadratic searched from the centroid interval midpoint — interior minimiser when t* is inside, else the per-edge projection; value bracketed by the centroid box',
    subject,
    perComponent,
    witnessEvidence,
    false,
  )
}

function segmentProjection(point: Pt, a: Pt, b: Pt): Pt {
  const vx = b[0] - a[0]
  const vy = b[1] - a[1]
  const lengthSquared = vx * vx + vy * vy
  if (lengthSquared === 0) return [a[0], a[1]]
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * vx + (point[1] - a[1]) * vy) / lengthSquared))
  return [a[0] + t * vx, a[1] + t * vy]
}

// ─── P3 · upper hanging mass — minimize, mm ────────────────────────────────────────────────────

/**
 * Material area above the TOP PADDED EDGE, y < min_i(t_y + o_iy) − r, divided by the padded block
 * width: the DEPTH of mass hanging past the protected boundary rather than past the anchor
 * centre-line. Minimised. Units mm — dividing by the padded block width is an ENGINEERING
 * normalisation, chosen so the measure is a DEPTH comparable across arrangements of different
 * widths rather than an area that grows with the block. It is not a ruled formula.
 *
 * EXACT BY PROVED MONOTONICITY, not by taking a directional extremum on faith: the edge is affine
 * in t_y, the area above a horizontal line is monotone in that line's position, and the block width
 * is registration-invariant. The value therefore depends on t_y alone and increases with it, so the
 * optimum is attained on each component's minimum-t_y face.
 *
 * The argopt is the COMPLETE equivalent set at lattice resolution: the strip of the component within
 * one quantum of that face, returned as a region. Returning only the face's existing vertices made
 * the set un-composable — a caller restricting the next priority to it would silently discard every
 * other equally-optimal registration on the same face.
 *
 * The reported interval covers the WHOLE strip: `lo` is the value on the face, `hi` the value one
 * quantum below it, which by the same monotonicity is the worst any returned point can score. A
 * strip bracketed only at its face would hand the next priority a set containing points worse than
 * the interval admits.
 */
export function upperHangingMassEvidence(subject: DescriptorSubject): DescriptorEvidence {
  requireSubject(subject)
  const material = materialSubject(subject.contour)
  const width = paddedWidthMM(subject)
  if (!(width > 0)) throw new RangeError('Padded block width must be positive.')
  const valueAt = (t: Pt): Interval => {
    const { areaMM2 } = clippedAreaAndMoment(material, 1, true, paddedBox(subject, t).topMM)
    return { lo: outwardDown(areaMM2.lo / width), hi: outwardUp(areaMM2.hi / width) }
  }

  const perComponent = subject.feasible.components.map((ring, componentIndex) => {
    let minY = Infinity
    for (const [, y] of ring) if (y < minY) minY = y
    const face = ring.filter(([, y]) => y === minY).map(([x, y]) => [x, y] as Pt)
    if (!face.length)
      return { componentIndex, resolved: false, lo: Number.NaN, hi: Number.NaN, argopt: null }
    const best = valueAt(face[0])
    // Monotone in t_y, so one quantum below the face is the worst point the strip can contain.
    const worst = valueAt([face[0][0], minY + CONTINUOUS_REGISTRATION_QUANTUM_MM])
    const value = { lo: best.lo, hi: worst.hi }
    // The complete equivalent set: everything in the component within one quantum of the optimal
    // face, cut exactly on the lattice so the strip can be restricted to by the next priority.
    const bounds = contourBounds(ring)
    const strip = Clipper.makePath([
      Math.round(bounds.minX * LATTICE) - 1,
      Math.round(minY * LATTICE),
      Math.round(bounds.maxX * LATTICE) + 1,
      Math.round(minY * LATTICE),
      Math.round(bounds.maxX * LATTICE) + 1,
      Math.round((minY + CONTINUOUS_REGISTRATION_QUANTUM_MM) * LATTICE),
      Math.round(bounds.minX * LATTICE) - 1,
      Math.round((minY + CONTINUOUS_REGISTRATION_QUANTUM_MM) * LATTICE),
    ])
    const cells = Clipper.intersect(toLatticePaths([ring]), [strip], FillRule.NonZero)
    return {
      componentIndex,
      resolved: true,
      lo: value.lo,
      hi: value.hi,
      argopt: { regions: fromLatticePaths(cells), points: face } as DescriptorArgopt,
    }
  })

  const witnessEvidence = subject.feasible.exactWitnessesMM.map((witness) => {
    const value = valueAt(witness)
    return { witnessMM: witness, lo: value.lo, hi: value.hi }
  })

  return globalAnchor(
    'minimize',
    'mm',
    'exact by proved monotonicity in t_y; the returned one-quantum strip is the complete equivalent set and its interval covers every point in it',
    subject,
    perComponent,
    witnessEvidence,
    false,
  )
}

// ─── P4 · unsupported extent — minimize, mm ────────────────────────────────────────────────────

/**
 * One major support region's reach past the padded box, in MATERIAL space.
 *
 * The region handed in is a magnet-CENTRE region — the body eroded by the safe radius — so its
 * bounds are reconstructed to the physical support envelope they stand for before the reach is
 * taken. Without that, a solid body reads as a trivial limb.
 */
export interface RegionReach {
  regionIndex: number
  leftMM: number
  rightMM: number
  topMM: number
  bottomMM: number
}

export interface UnsupportedExtentEvidence extends DescriptorEvidence {
  /** Per-side reach beyond the padded box at the certified optimum. */
  reachMM: { left: number; right: number; top: number; bottom: number }
  maxSideScoreMM: number
  /**
   * Per-region contribution in MATERIAL space — the physical support envelope reconstructed from
   * each centre-space safe-core region — so Logic can apply its ruled exemption and switch against
   * the material a region actually supports. Compute applies neither.
   */
  perRegion: ReadonlyArray<RegionReach>
}

/**
 * Per-side reach of material beyond the padded grid box; the score is the largest side.
 *
 * CERTIFIED ON THE LATTICE, not by a floating candidate recipe with an epsilon membership test.
 * The score separates into one function of t_x and one of t_y:
 *   score(t) = max( max(0, t_x+kL, −t_x+kR), max(0, t_y+kT, −t_y+kB) )
 * so its sublevel set {score ≤ s} is exactly the axis-aligned rectangle
 * [kR−s, s−kL] × [kB−s, s−kT], which grows monotonically with s. The minimum over a component is
 * therefore the least s whose rectangle meets it, found by bisection with an exact Clipper
 * intersection as the test. The constants are quantised to integers ONCE and the rectangle is built
 * by integer arithmetic alone, so no rounding can admit a coordinate the constraint forbids. The
 * result is reported as the one-quantum bracket the bisection actually proves.
 *
 * The two halves of F are deliberately measured in different senses and are NOT reconciled: area
 * components are searched on the conservative lattice set, while exact witnesses are scored on true
 * geometry. A boundary witness can therefore win outright, which is the point.
 *
 * Compute reports the per-side and per-region evidence and stops: the trivial-limb exemption and
 * the 12/24 switch are ruled policy and belong to Logic, so nothing here applies or invents them.
 */
export function unsupportedExtentEvidence(
  subject: DescriptorSubject,
  regionsMM: ReadonlyArray<Contour> = [],
): UnsupportedExtentEvidence {
  requireSubject(subject)
  const bounds = contourBounds(subject.contour.outer.pts)
  const xs = subject.offsetsMM.map(([x]) => x)
  const ys = subject.offsetsMM.map(([, y]) => y)
  const r = subject.effectiveRadiusMM
  const kL = Math.min(...xs) - r - bounds.minX
  const kR = bounds.maxX - (Math.max(...xs) + r)
  const kT = Math.min(...ys) - r - bounds.minY
  const kB = bounds.maxY - (Math.max(...ys) + r)
  // Exact witnesses keep the true-geometry score above; the lattice search below uses the same
  // constants quantised ONCE to integers, so the rectangle is built without any float rounding.
  const scoreAt = (t: Pt): number => Math.max(0, t[0] + kL, -t[0] + kR, t[1] + kT, -t[1] + kB)
  const q = (v: number): number => Math.round(v * LATTICE)
  const KL = q(Math.min(...xs)) - q(r) - q(bounds.minX)
  const KR = q(bounds.maxX) - (q(Math.max(...xs)) + q(r))
  const KT = q(Math.min(...ys)) - q(r) - q(bounds.minY)
  const KB = q(bounds.maxY) - (q(Math.max(...ys)) + q(r))
  /**
   * The sublevel rectangle for score ≤ S in integer lattice units. Every bound is an integer
   * comparison, so no lattice coordinate outside the constraint can be admitted: a lower bound is
   * `KR − S` and an upper bound `S − KL` exactly, with no rounding to widen either side.
   */
  const sublevelPath = (sLattice: number): Path64 | null => {
    if (sLattice < 0) return null
    const x0 = KR - sLattice
    const x1 = sLattice - KL
    const y0 = KB - sLattice
    const y1 = sLattice - KT
    if (x1 < x0 || y1 < y0) return null
    return Clipper.makePath([x0, y0, x1, y0, x1, y1, x0, y1])
  }

  const perComponent = subject.feasible.components.map((ring, componentIndex) => {
    const componentPaths = toLatticePaths([ring])
    const ringBounds = contourBounds(ring)
    const meets = (sLattice: number): boolean => {
      const rect = sublevelPath(sLattice)
      if (!rect) return false
      return (
        integerAreaAndMoments(Clipper.intersect(componentPaths, [rect], FillRule.NonZero))
          .twiceArea !== B0
      )
    }
    const latticeScore = (X: number, Y: number): number => Math.max(0, X + KL, -X + KR, Y + KT, -Y + KB)
    let high = Math.max(
      latticeScore(q(ringBounds.minX), q(ringBounds.minY)),
      latticeScore(q(ringBounds.maxX), q(ringBounds.maxY)),
      latticeScore(q(ringBounds.minX), q(ringBounds.maxY)),
      latticeScore(q(ringBounds.maxX), q(ringBounds.minY)),
    )
    if (!meets(high)) return { componentIndex, resolved: false, lo: 0, hi: Number.NaN, argopt: null }
    let low = 0
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (meets(mid)) high = mid
      else low = mid + 1
    }
    const rect = sublevelPath(high)
    const cells = rect ? Clipper.intersect(componentPaths, [rect], FillRule.NonZero) : []
    return {
      componentIndex,
      resolved: true,
      lo: outwardDown(Math.max(0, high - 1) / LATTICE),
      hi: outwardUp(high / LATTICE),
      argopt: { regions: fromLatticePaths(cells), points: [] } as DescriptorArgopt,
    }
  })

  const witnessEvidence = subject.feasible.exactWitnessesMM.map((witness) => {
    const value = scoreAt(witness)
    return { witnessMM: witness, lo: outwardDown(value), hi: outwardUp(value) }
  })

  const anchor = globalAnchor(
    'minimize',
    'mm',
    'certified on the 1µm lattice: the sublevel set is an axis-aligned rectangle, bisected against an exact Clipper intersection, reported as the one-quantum bracket the bisection proves',
    subject,
    perComponent,
    witnessEvidence,
    false,
  )
  const optimum =
    anchor.argopt?.points[0] ?? (anchor.argopt?.regions.length ? anchor.argopt.regions[0][0] : null)
  const box = optimum ? paddedBox(subject, optimum) : null
  return {
    ...anchor,
    reachMM: {
      left: box ? Math.max(0, box.leftMM - bounds.minX) : Number.NaN,
      right: box ? Math.max(0, bounds.maxX - box.rightMM) : Number.NaN,
      top: box ? Math.max(0, box.topMM - bounds.minY) : Number.NaN,
      bottom: box ? Math.max(0, bounds.maxY - box.bottomMM) : Number.NaN,
    },
    maxSideScoreMM: optimum ? scoreAt(optimum) : Number.NaN,
    perRegion: box
      ? regionsMM.map((region, regionIndex) => {
          // CENTRE SPACE IS NOT MATERIAL SPACE. A major support region is a MAGNET-CENTRE region:
          // the body already eroded by the safe radius, so a magnet centred anywhere in it clears
          // the outline. Its raw bounds therefore sit r inside the material it supports, and
          // comparing them to the padded box measures the wrong thing — it mislabels a solid body
          // as a limb, because the body's own core is always r short of its outline.
          // The envelope this region supports is `core ⊕ disc(r)` — every point within r of a
          // lawful magnet centre. What is exact is a statement about THAT set's bounds, and only
          // that: the axis-aligned bounds of `core ⊕ disc(r)` are the core's bounds expanded by r
          // on each side, because the extreme point of the dilation is the core's extreme pushed
          // out by the disc's radius. No claim is made about inverting the erosion that produced
          // the core — a limb whose extremum vanishes under erosion is not recovered by this, and
          // is not what is being measured. A per-side question needs no dilation engine.
          const core = contourBounds(region.outer.pts)
          const supported = {
            minX: core.minX - subject.effectiveRadiusMM,
            maxX: core.maxX + subject.effectiveRadiusMM,
            minY: core.minY - subject.effectiveRadiusMM,
            maxY: core.maxY + subject.effectiveRadiusMM,
          }
          return {
            regionIndex,
            leftMM: Math.max(0, box.leftMM - supported.minX),
            rightMM: Math.max(0, supported.maxX - box.rightMM),
            topMM: Math.max(0, box.topMM - supported.minY),
            bottomMM: Math.max(0, supported.maxY - box.bottomMM),
          }
        })
      : [],
  }
}

// ─── P5 · peel leverage — minimize, mm³ ────────────────────────────────────────────────────────

export interface PeelBudget {
  /** Certified width at which the search may stop, in mm³. Caller-owned. */
  toleranceMM3: number
  /** Maximum evaluations, enforced on EVERY cache miss — bounds, loop and witnesses alike. */
  maxEvaluations: number
}

/**
 * Peel leverage: the first moment of unsupported material about each padded box edge,
 * ∫ (distance beyond the edge) dA, in mm³; the score is the largest side. Minimised.
 *
 * ONE GLOBAL SUBLEVEL BRACKET — no Lipschitz claim, no generic framework, no search over cells.
 * Each side's integrand is a hinge of one padded edge, so left and top rise with their own
 * coordinate while right and bottom fall with theirs, and score = max of the four. The set
 * {score <= k} is therefore exactly an axis-aligned lattice rectangle, found by certified
 * coordinate bisection. Two rectangles are built at every threshold: INNER, from each side's .hi,
 * holds only points PROVEN at or under k and is what gets returned; OUTER, from each side's .lo,
 * holds every possibly-lawful point, so its emptiness PROVES nothing reaches k. `high` moves only
 * on inner non-emptiness, `low` only on outer emptiness, and a probe neither proof resolves stops
 * the bisection rather than moving an unproved bound. Budget exhaustion or a bracket wider than the
 * caller's tolerance returns DECISION_INDETERMINATE with no partial set.
 */
export function peelLeverageEvidence(
  subject: DescriptorSubject,
  budget: PeelBudget,
): DescriptorEvidence {
  requireSubject(subject)
  if (!(budget.toleranceMM3 >= 0) || !Number.isFinite(budget.toleranceMM3))
    throw new RangeError('Peel tolerance must be finite and non-negative.')
  if (!Number.isInteger(budget.maxEvaluations) || budget.maxEvaluations <= 0)
    throw new RangeError('Peel evaluation budget must be a positive integer.')
  const material = materialSubject(subject.contour)
  let evaluations = 0
  const cache = new Map<string, Interval>()
  /** Every cache MISS spends budget; a miss with none left returns null, never a value. */
  const sideMoment = (axis: 0 | 1, keepBelow: boolean, cutMM: number): Interval | null => {
    const key = `${axis}:${keepBelow ? 1 : 0}:${Math.round(cutMM * LATTICE)}`
    const cached = cache.get(key)
    if (cached !== undefined) return cached
    if (evaluations >= budget.maxEvaluations) return null
    evaluations += 1
    const { momentMM3 } = clippedAreaAndMoment(material, axis, keepBelow, cutMM)
    const value: Interval = { lo: momentMM3.lo, hi: momentMM3.hi }
    cache.set(key, value)
    return value
  }
  const sidesAt = (t: Pt): Array<Interval | null> => {
    const box = paddedBox(subject, t)
    return [
      sideMoment(0, true, box.leftMM),
      sideMoment(0, false, box.rightMM),
      sideMoment(1, true, box.topMM),
      sideMoment(1, false, box.bottomMM),
    ]
  }
  /** The score at one registration, as an interval. Null when the budget is spent. */
  const scoreAt = (t: Pt): Interval | null => {
    const values = sidesAt(t)
    if (values.some((value) => value === null)) return null
    const certain = values as Interval[]
    return {
      lo: Math.max(...certain.map((value) => value.lo)),
      hi: Math.max(...certain.map((value) => value.hi)),
    }
  }

  const feasiblePoints: Pt[] = [
    ...subject.feasible.exactWitnessesMM.map(([x, y]) => [x, y] as Pt),
    ...subject.feasible.components.flatMap((component) => component.map(([x, y]) => [x, y] as Pt)),
  ]
  const indeterminate = (reason: string): DescriptorEvidence => ({
    units: 'mm3',
    direction: 'minimize',
    status: 'DECISION_INDETERMINATE',
    lo: Number.NaN,
    hi: Number.NaN,
    argopt: null,
    completenessProof: reason,
    sourceEnvelope: subject.feasible.envelope,
    perComponent: [],
    witnessEvidence: [],
  })
  if (!feasiblePoints.length)
    return indeterminate('no feasible registration exists to bracket the optimum from')

  // FINITE F NEEDS NO RECTANGLE. P3 and P4 routinely restrict the feasible set down to exact
  // witnesses, and a finite set has an exact minimum: price each point once and take the envelope
  // directly. Pushing it through the continuous bracket instead manufactures a bracket width — the
  // caller's tolerance then rejects an answer that was already resolved point by point.
  if (!subject.feasible.components.length) {
    const priced: WitnessDescriptorEvidence[] = []
    for (const witness of subject.feasible.exactWitnessesMM) {
      const value = scoreAt(witness)
      if (!value) return indeterminate('the evaluation budget was spent scoring an exact witness')
      priced.push({ witnessMM: [witness[0], witness[1]], lo: value.lo, hi: value.hi })
    }
    const finite = globalAnchor(
      'minimize',
      'mm3',
      'finite feasible set: every exact registration priced once and the global minimum taken from those values directly, with no continuous bracket to widen it',
      subject,
      [],
      priced,
      false,
    )
    if (finite.status === 'DECISION_INDETERMINATE')
      return { ...indeterminate('no exact registration could be priced'), witnessEvidence: priced }
    if (finite.hi - finite.lo > budget.toleranceMM3)
      return {
        ...indeterminate('the finite feasible set could not be resolved inside the caller tolerance'),
        witnessEvidence: priced,
      }
    return finite
  }

  // ── the sublevel set is a RECTANGLE, and that is what makes this solvable ──
  //
  // Each side's integrand is a hinge of one padded edge, so peel_left and peel_top rise with their
  // own coordinate while peel_right and peel_bottom fall with theirs. score = max of the four, so
  // {score <= k} is exactly [xLo(k), xHi(k)] x [yLo(k), yHi(k)]. Each bound is monotone but has no
  // closed form, so it is found by certified bisection on the 1µm lattice: a coordinate is INSIDE
  // when the side's interval satisfies .hi <= k and OUTSIDE when .lo > k. BOUND CONSTRUCTION has no
  // interval-straddle case: INNER and OUTER each use ONE side of the measured interval
  // consistently, so each coordinate limit is decided outright. REACHABILITY is a separate
  // question — meets() may return unproven — and when neither rectangle resolves a probe the
  // bracket stops rather than moving a bound it never proved. This replaces a branch-and-bound
  // that could not certify a region at any budget.
  const searchBounds = (() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [x, y] of feasiblePoints) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    return {
      minX: Math.round(minX * LATTICE),
      maxX: Math.round(maxX * LATTICE),
      minY: Math.round(minY * LATTICE),
      maxY: Math.round(maxY * LATTICE),
    }
  })()

  type Bound = { kind: 'ok'; lattice: number } | { kind: 'budget' }

  /**
   * The extreme lattice coordinate on one axis still admitted at threshold k.
   *
   * TWO RECTANGLES, each using ONE side of the measured interval consistently, which is what makes
   * both certifiable and removes the straddle case entirely:
   *   INNER  admits a coordinate when the side's `.hi <= k` — every point it holds is PROVEN at or
   *          under k, so INNER(k) is a sublevel set that can be returned.
   *   OUTER  admits a coordinate when the side's `.lo <= k` — it holds every point that could
   *          possibly be at or under k, so OUTER(k) being EMPTY proves no registration reaches k.
   * `rising` marks a side that grows with its coordinate (left, top): its bound is an upper limit.
   */
  const boundFor = (
    axis: 0 | 1,
    keepBelow: boolean,
    rising: boolean,
    k: number,
    mode: 'inner' | 'outer',
  ): Bound => {
    const from = axis === 0 ? searchBounds.minX : searchBounds.minY
    const to = axis === 0 ? searchBounds.maxX : searchBounds.maxY
    const cutAt = (lattice: number): number => {
      const t: Pt = axis === 0 ? [lattice / LATTICE, 0] : [0, lattice / LATTICE]
      const box = paddedBox(subject, t)
      return axis === 0 ? (keepBelow ? box.leftMM : box.rightMM) : keepBelow ? box.topMM : box.bottomMM
    }
    /** True when this coordinate is admitted by the mode's own side of the interval. */
    const admits = (lattice: number): boolean | null => {
      const value = sideMoment(axis, keepBelow, cutAt(lattice))
      if (!value) return null
      return mode === 'inner' ? value.hi <= k : value.lo <= k
    }
    let inside = rising ? from : to
    let outside = rising ? to : from
    const first = admits(inside)
    if (first === null) return { kind: 'budget' }
    if (!first) return { kind: 'ok', lattice: rising ? from - 1 : to + 1 }
    const edge = admits(outside)
    if (edge === null) return { kind: 'budget' }
    if (edge) return { kind: 'ok', lattice: outside }
    while (Math.abs(outside - inside) > 1) {
      const mid = Math.floor((inside + outside) / 2)
      const verdict = admits(mid)
      if (verdict === null) return { kind: 'budget' }
      if (verdict) inside = mid
      else outside = mid
    }
    return { kind: 'ok', lattice: inside }
  }

  type Rect = { x0: number; x1: number; y0: number; y1: number }
  type Sublevel = { kind: 'rect'; rect: Rect } | { kind: 'budget' }

  const sublevelAt = (k: number, mode: 'inner' | 'outer'): Sublevel => {
    const xHi = boundFor(0, true, true, k, mode)
    const xLo = boundFor(0, false, false, k, mode)
    const yHi = boundFor(1, true, true, k, mode)
    const yLo = boundFor(1, false, false, k, mode)
    for (const bound of [xHi, xLo, yHi, yLo]) if (bound.kind === 'budget') return { kind: 'budget' }
    return {
      kind: 'rect',
      rect: {
        x0: (xLo as { lattice: number }).lattice,
        x1: (xHi as { lattice: number }).lattice,
        y0: (yLo as { lattice: number }).lattice,
        y1: (yHi as { lattice: number }).lattice,
      },
    }
  }

  const rectPath = (rect: Rect): Path64 | null =>
    rect.x1 < rect.x0 || rect.y1 < rect.y0
      ? null
      : Clipper.makePath([rect.x0, rect.y0, rect.x1, rect.y0, rect.x1, rect.y1, rect.x0, rect.y1])

  /** Where the component actually meets the rectangle: area, or exact vertex contact. */
  const componentCells = (component: ReadonlyArray<Pt>, rect: Rect): Paths64 => {
    const path = rectPath(rect)
    if (!path) return []
    return Clipper.intersect(toLatticePaths([component]), [path], FillRule.NonZero)
  }
  /**
   * EXACT contact between a component ring and the closed rectangle, CLASSIFIED — not a boolean.
   *
   * Clipper emits nothing for lower-dimensional contact, so `meets` proving a rectangle reachable
   * and the final collection keeping positive-area cells were answering different questions: the
   * bisection could certify a threshold whose equivalent set the collection then could not express,
   * and the descriptor reported an empty set its own bracket contradicted. This returns what the
   * contact IS, so both read one geometry. It does not promise every certified threshold is
   * returnable — a segment or non-lattice crossing is real contact the collection must refuse — it
   * promises the refusal is honest and named instead of disguised as emptiness:
   *   none      — provably disjoint.
   *   points    — a finite contact set, every member exactly on the lattice and returnable.
   *   segment   — a positive-length collinear overlap. Real contact, but not a finite set, and
   *               reducing it to its endpoints would drop every registration between them.
   *   ambiguous — a transversal crossing. Contact is certain, but the crossing point is rational
   *               and need not lie on the lattice, so it cannot be returned exactly.
   * Every test is an integer sign comparison; no division, no tolerance.
   */
  type Contact =
    | { kind: 'none' }
    | { kind: 'points'; points: Pt[] }
    | { kind: 'segment' }
    | { kind: 'ambiguous' }

  const classifyContact = (component: ReadonlyArray<Pt>, rect: Rect): Contact => {
    const pts = component.map(
      ([x, y]) => [Math.round(x * LATTICE), Math.round(y * LATTICE)] as [number, number],
    )
    const orient = (
      ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
    ): number => {
      const value = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
      return value > 0 ? 1 : value < 0 ? -1 : 0
    }
    const onSegment = (
      ax: number, ay: number, bx: number, by: number, px: number, py: number,
    ): boolean =>
      Math.min(ax, bx) <= px && px <= Math.max(ax, bx) &&
      Math.min(ay, by) <= py && py <= Math.max(ay, by)
    const corners: Array<[number, number]> = [
      [rect.x0, rect.y0],
      [rect.x1, rect.y0],
      [rect.x1, rect.y1],
      [rect.x0, rect.y1],
    ]
    /** CLOSED containment: a point ON the ring counts as inside. */
    const inRing = (px: number, py: number): boolean => {
      for (let i = 0; i < pts.length; i += 1) {
        const [ax, ay] = pts[i]
        const [bx, by] = pts[(i + 1) % pts.length]
        if (orient(ax, ay, bx, by, px, py) === 0 && onSegment(ax, ay, bx, by, px, py)) return true
      }
      let inside = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
        const [xi, yi] = pts[i]
        const [xj, yj] = pts[j]
        if (yi > py === yj > py) continue
        const side = orient(xi, yi, xj, yj, px, py)
        if (yj > yi ? side > 0 : side < 0) inside = !inside
      }
      return inside
    }

    // FINITE contacts first: each is a lattice point, so each can be returned exactly.
    const finite = new Map<string, Pt>()
    for (const [x, y] of pts)
      if (x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1)
        finite.set(`${x},${y}`, [x / LATTICE, y / LATTICE])
    for (const [cx, cy] of corners)
      if (inRing(cx, cy)) finite.set(`${cx},${cy}`, [cx / LATTICE, cy / LATTICE])

    let segment = false
    let ambiguous = false
    for (let i = 0; i < pts.length; i += 1) {
      const [ax, ay] = pts[i]
      const [bx, by] = pts[(i + 1) % pts.length]
      for (let c = 0; c < 4; c += 1) {
        const [cx, cy] = corners[c]
        const [dx, dy] = corners[(c + 1) % 4]
        const d1 = orient(ax, ay, bx, by, cx, cy)
        const d2 = orient(ax, ay, bx, by, dx, dy)
        const d3 = orient(cx, cy, dx, dy, ax, ay)
        const d4 = orient(cx, cy, dx, dy, bx, by)
        if (d1 === 0 && d2 === 0) {
          // COLLINEAR. A positive-length overlap is a segment; a single shared endpoint is already
          // in the finite set from the vertex and corner scans above.
          const along = (px: number, py: number): number => (bx !== ax ? px : py)
          const lo = Math.max(
            Math.min(along(ax, ay), along(bx, by)),
            Math.min(along(cx, cy), along(dx, dy)),
          )
          const hi = Math.min(
            Math.max(along(ax, ay), along(bx, by)),
            Math.max(along(cx, cy), along(dx, dy)),
          )
          if (hi > lo) segment = true
          continue
        }
        // TRANSVERSAL: contact is certain, but its point need not be on the lattice.
        if (d1 !== d2 && d3 !== d4 && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0) ambiguous = true
      }
    }
    if (segment) return { kind: 'segment' }
    if (ambiguous) return { kind: 'ambiguous' }
    if (finite.size) return { kind: 'points', points: [...finite.values()] }
    return { kind: 'none' }
  }

  /**
   * Non-emptiness over the WHOLE feasible set. Zero Clipper area is NOT emptiness: a witness in the
   * rectangle, or exact contact between the rectangle and a component, is a certified registration
   * inside it. Only a degenerate zero-area Clipper path that the exact predicate then disproves is
   * reported undecided.
   */
  const meets = (rect: Rect): 'yes' | 'no' | 'unproven' => {
    // An inverted interval is how sublevelAt spells "no such coordinate exists". That is certified
    // emptiness, not uncertain contact — passing the swapped corners on would read as a real
    // rectangle and wrongly report contact.
    if (rect.x1 < rect.x0 || rect.y1 < rect.y0) return 'no'
    for (const witness of subject.feasible.exactWitnessesMM) {
      const lx = Math.round(witness[0] * LATTICE)
      const ly = Math.round(witness[1] * LATTICE)
      if (lx >= rect.x0 && lx <= rect.x1 && ly >= rect.y0 && ly <= rect.y1) return 'yes'
    }
    let touching = false
    for (const component of subject.feasible.components) {
      const cells = componentCells(component, rect)
      if (integerAreaAndMoments(cells).twiceArea !== B0) return 'yes'
      // ONE classification serves both here and the final collection, so the two never disagree
      // about WHETHER contact exists. They can still disagree about whether it is RETURNABLE: a
      // segment or a non-lattice crossing is real contact, so the bisection tightens on it, and the
      // collection then refuses it honestly as DECISION_INDETERMINATE rather than reporting empty.
      if (classifyContact(component, rect).kind !== 'none') return 'yes'
      if (cells.length) touching = true
    }
    return touching ? 'unproven' : 'no'
  }

  // The initial certified high: every feasible point IS a lawful registration, so the least upper
  // score among them is a threshold whose INNER sublevel is certainly non-empty.
  let high = Infinity
  for (const point of feasiblePoints) {
    const value = scoreAt(point)
    if (!value) return indeterminate('the evaluation budget was spent bracketing the optimum')
    if (value.hi < high) high = value.hi
  }
  // A peel moment is an integral of non-negative distance, so zero is always a lawful lower bound.
  let low = 0
  let rect: Rect | null = null
  const settle = (k: number): Rect | null => {
    const inner = sublevelAt(k, 'inner')
    return inner.kind === 'rect' ? inner.rect : null
  }
  const zero = settle(0)
  if (zero && meets(zero) === 'yes') {
    high = 0
    rect = zero
  } else {
    let guard = 0
    while (high - low > budget.toleranceMM3) {
      if (guard > 4096) return indeterminate('the sublevel bisection failed to converge')
      guard += 1
      const mid = (low + high) / 2
      const inner = sublevelAt(mid, 'inner')
      if (inner.kind === 'budget')
        return indeterminate('the evaluation budget was spent inside the sublevel bisection')
      if (meets(inner.rect) === 'yes') {
        // PROVEN reachable at mid: the returned sublevel may shrink to it.
        high = mid
        rect = inner.rect
        continue
      }
      const outer = sublevelAt(mid, 'outer')
      if (outer.kind === 'budget')
        return indeterminate('the evaluation budget was spent proving the outer sublevel')
      if (meets(outer.rect) === 'no') {
        // PROVEN unreachable at mid: nothing can score at or under it.
        low = mid
        continue
      }
      // Neither proof resolves this probe: inner is empty while outer is not, so the truth sits in
      // a band the measurement cannot split. Stop rather than move a bound that was not proved.
      break
    }
    if (high - low > budget.toleranceMM3)
      return indeterminate('the optimum could not be bracketed inside the caller tolerance')
    if (!rect) {
      const settled = settle(high)
      if (!settled) return indeterminate('the settled sublevel rectangle could not be certified')
      rect = settled
    }
  }

  // WITNESS CLOSURE. A witness whose interval straddles `high` may be an optimum or may be worse
  // than the threshold, and neither dropping it nor keeping it silently is sound. Instead the
  // threshold ABSORBS it: admit every witness that could still be at or under `high`, raise `high`
  // to the worst value so admitted, and repeat — each pass can only admit more, so it reaches a
  // fixed point in at most one pass per witness. The caller's tolerance still decides whether the
  // widened bracket is acceptable.
  const scored: Array<{ witness: Pt; lo: number; hi: number }> = []
  for (const witness of subject.feasible.exactWitnessesMM) {
    const value = scoreAt(witness)
    if (!value) return indeterminate('the evaluation budget was spent scoring an exact witness')
    scored.push({ witness: [witness[0], witness[1]], lo: value.lo, hi: value.hi })
  }
  for (let pass = 0; pass <= scored.length; pass += 1) {
    let raised = high
    for (const entry of scored) if (entry.lo <= high && entry.hi > raised) raised = entry.hi
    if (raised === high) break
    high = raised
    rect = null
  }
  if (high - low > budget.toleranceMM3)
    return indeterminate('admitting every candidate witness widened the bracket past the tolerance')
  if (!rect) {
    const reopened = settle(high)
    if (!reopened) return indeterminate('the widened sublevel rectangle could not be certified')
    rect = reopened
  }

  // F ∩ sublevel(high) — the COMPLETE equivalent set, every component against the SAME global
  // threshold, with the exact witnesses that certify inside it.
  const regions: Array<ReadonlyArray<Pt>> = []
  const contactPoints: Pt[] = []
  const perComponent: ComponentDescriptorEvidence[] = []
  for (
    let componentIndex = 0;
    componentIndex < subject.feasible.components.length;
    componentIndex += 1
  ) {
    const component = subject.feasible.components[componentIndex]
    const cells = fromLatticePaths(componentCells(component, rect as Rect))
    if (cells.length) {
      regions.push(...cells)
      perComponent.push({
        componentIndex,
        resolved: true,
        lo: low,
        hi: high,
        argopt: { regions: cells, points: [] } as DescriptorArgopt,
      })
      continue
    }
    // NO POSITIVE AREA. The bisection may still have certified this threshold on lower-dimensional
    // contact; dropping it here is exactly what made the bracket contradict its own equivalent set.
    const contact = classifyContact(component, rect as Rect)
    if (contact.kind === 'segment')
      return indeterminate(
        'the certified sublevel set meets a component along a segment, and a segment is not a finite equivalent set this descriptor can return',
      )
    if (contact.kind === 'ambiguous')
      return indeterminate(
        'the certified sublevel set crosses a component edge at a point that need not lie on the lattice, so the equivalent set cannot be returned exactly',
      )
    const points = contact.kind === 'points' ? contact.points : []
    contactPoints.push(...points)
    perComponent.push({
      componentIndex,
      resolved: true,
      lo: low,
      hi: high,
      argopt: { regions: [], points } as DescriptorArgopt,
    })
  }
  // witnessEvidence is the PRICING RECORD — its contract is the exact value at every T4 witness, so
  // every priced witness appears here whether or not it won. argopt.points is the separate thing:
  // the ADMITTED equivalent set, which excludes any witness proven worse than the closed threshold.
  const witnessEvidence: WitnessDescriptorEvidence[] = scored.map((entry) => ({
    witnessMM: entry.witness,
    lo: entry.lo,
    hi: entry.hi,
  }))
  const points: Pt[] = scored.filter((entry) => entry.lo <= high).map((entry) => entry.witness)
  const returnedPoints: Pt[] = [...contactPoints, ...points]
  if (!regions.length && !returnedPoints.length)
    return indeterminate('the certified sublevel set is empty, which the bracket contradicts')

  // Decision 2: the descriptor comes from the ONE global bracket. perComponent is evidence of each
  // component's share of that same sublevel, never a local optimum recombined into a global claim.
  return {
    units: 'mm3',
    direction: 'minimize',
    status: 'INTERVAL',
    lo: low,
    hi: high,
    argopt: { regions, points: returnedPoints },
    completenessProof:
      'one global dual-rectangle bracket over every component and witness: the score separates into two monotone coordinate pairs, so the sublevel set is an exact lattice rectangle. high moves only when the INNER rectangle (side .hi <= k, every point proven at or under k) is non-empty; low moves only when the OUTER rectangle (side .lo <= k, every possibly-lawful point) is empty. The returned set is F intersected with INNER(high).',
    sourceEnvelope: subject.feasible.envelope,
    perComponent,
    witnessEvidence,
  }
}

// ─── P2 · coverage and P7 · distribution ───────────────────────────────────────────────────────

/** layers[k] = the part of `base` covered by at least k of `sets`. Exact integer set algebra. */
function depthLayers(base: Paths64, sets: ReadonlyArray<Paths64>): Paths64[] {
  const layers: Paths64[] = [base]
  for (const set of sets) {
    const next: Paths64[] = [layers[0]]
    for (let depth = 1; depth <= layers.length; depth += 1) {
      const carried = layers[depth] ?? []
      const promoted = Clipper.intersect(layers[depth - 1], set, FillRule.NonZero)
      next[depth] = carried.length ? Clipper.union(carried, promoted, FillRule.NonZero) : promoted
    }
    layers.length = 0
    layers.push(...next)
  }
  return layers
}

/** One set shifted by every pattern offset — where a registration puts an anchor inside it. */
function shiftedByOffsets(subject: DescriptorSubject, set: Contour): Paths64 {
  const path = toLatticePaths([set.outer.pts])
  let union: Paths64 = []
  for (const [dx, dy] of subject.offsetsMM) {
    const moved = Clipper.translatePaths(path, -Math.round(dx * LATTICE), -Math.round(dy * LATTICE))
    union = union.length ? Clipper.union(union, moved, FillRule.NonZero) : moved
  }
  return union
}

function deepestLayer(layers: Paths64[]): { depth: number; cells: Paths64 } {
  for (let depth = layers.length - 1; depth >= 1; depth -= 1)
    if (layers[depth] && layers[depth].length) return { depth, cells: layers[depth] }
  // Depth zero is reached everywhere in the base, so the argopt is the whole base component.
  return { depth: 0, cells: layers[0] ?? [] }
}

/** How many anchors land in each caller set, at one exact registration. */
function anchorCountsAt(
  subject: DescriptorSubject,
  preparedSets: ReadonlyArray<ReturnType<typeof prepareExactContour>>,
  t: Pt,
): number[] {
  return preparedSets.map(
    (set) =>
      subject.offsetsMM.filter(([dx, dy]) => pointInPreparedContour([t[0] + dx, t[1] + dy], set))
        .length,
  )
}

/**
 * The FRACTION of the caller-classified major support regions holding at least one anchor —
 * covered / total, dimensionless. Maximised. Piecewise-constant in t.
 *
 * EXACT CERTIFIED PARTITION: for region j, U_j = ⋃_i (R_j − o_i) is an exact integer Clipper
 * operation, and the depth layers over the U_j give the maximum-coverage cells exactly. The argopt
 * is returned as CELLS, never a sampled point; witnesses use the exact predicates on the true
 * geometry; and the fraction is an exact rational. An empty caller set is rejected rather than
 * given an invented value.
 */
export function coverageEvidence(
  subject: DescriptorSubject,
  majorSupportRegionsMM: ReadonlyArray<Contour>,
): DescriptorEvidence {
  requireSubject(subject)
  if (!majorSupportRegionsMM.length)
    throw new RangeError('Coverage requires at least one caller-classified major support region.')
  const total = BigInt(majorSupportRegionsMM.length)
  const shifted = majorSupportRegionsMM.map((region) => shiftedByOffsets(subject, region))
  const prepared = majorSupportRegionsMM.map((region) => prepareExactContour(region))

  const perComponent = subject.feasible.components.map((ring, componentIndex) => {
    const { depth, cells } = deepestLayer(depthLayers(toLatticePaths([ring]), shifted))
    const fraction = ratioToInterval(BigInt(depth), total)
    return {
      componentIndex,
      resolved: true,
      lo: fraction.lo,
      hi: fraction.hi,
      argopt: { regions: fromLatticePaths(cells), points: [] } as DescriptorArgopt,
    }
  })

  const witnessEvidence = subject.feasible.exactWitnessesMM.map((witness) => {
    const covered = anchorCountsAt(subject, prepared, witness).filter((count) => count > 0).length
    const fraction = ratioToInterval(BigInt(covered), total)
    return { witnessMM: witness, lo: fraction.lo, hi: fraction.hi }
  })

  return globalAnchor(
    'maximize',
    'ratio',
    'exact certified partition over the major support regions; argopt returned as cells and the fraction as an exact rational',
    subject,
    perComponent,
    witnessEvidence,
    false,
  )
}

export interface DistributionEvidence extends DescriptorEvidence {
  /**
   * The engineering second key, kept separate rather than folded into an opaque score: once the
   * distinct mass count is maximised, the minimum variance of anchors per mass over that argopt.
   */
  anchorVariance: DescriptorEvidence
}

/**
 * Distribution across the caller-classified DISTINCT MASSES — a different set from coverage's.
 *
 * Primary key: the number of masses holding at least one anchor, maximised, by the same exact
 * certified partition. Secondary key: the variance of anchors per mass, minimised, evaluated only
 * over the primary argopt so the lexicographic order is preserved. The two keys are returned
 * SEPARATELY; nothing here combines them into a single number.
 *
 * The per-mass anchor counts are piecewise-constant, so the secondary key is certified over the
 * joint partition of the per-mass depth layers, pruned by real geometry. Only cells and witnesses
 * TIED AT THE PRIMARY MAXIMUM are eligible, preserving the lexicographic order. `maxCells` is a
 * required caller input — there is no default — and exceeding it makes the secondary key
 * DECISION_INDETERMINATE rather than estimated.
 */
export function distributionEvidence(
  subject: DescriptorSubject,
  distinctMassesMM: ReadonlyArray<Contour>,
  maxCells: number,
): DistributionEvidence {
  requireSubject(subject)
  if (!distinctMassesMM.length)
    throw new RangeError('Distribution requires at least one caller-classified distinct mass.')
  if (!Number.isInteger(maxCells) || maxCells <= 0)
    throw new RangeError('Distribution requires a positive integer cell budget from the caller.')
  const shifted = distinctMassesMM.map((mass) => shiftedByOffsets(subject, mass))
  const prepared = distinctMassesMM.map((mass) => prepareExactContour(mass))

  const perComponent = subject.feasible.components.map((ring, componentIndex) => {
    const { depth, cells } = deepestLayer(depthLayers(toLatticePaths([ring]), shifted))
    return {
      componentIndex,
      resolved: true,
      lo: depth,
      hi: depth,
      argopt: { regions: fromLatticePaths(cells), points: [] } as DescriptorArgopt,
    }
  })

  const witnessCounts = subject.feasible.exactWitnessesMM.map((witness) =>
    anchorCountsAt(subject, prepared, witness),
  )
  const witnessEvidence = subject.feasible.exactWitnessesMM.map((witness, index) => {
    const held = witnessCounts[index].filter((count) => count > 0).length
    return { witnessMM: witness, lo: held, hi: held }
  })

  const primary = globalAnchor(
    'maximize',
    'count',
    'exact certified partition over the distinct masses; argopt returned as cells',
    subject,
    perComponent,
    witnessEvidence,
    true,
  )

  const varianceOf = (counts: ReadonlyArray<number>): Interval => {
    const n = BigInt(counts.length)
    const sum = counts.reduce((total, count) => total + BigInt(count), B0)
    const squares = counts.reduce((total, count) => total + BigInt(count) * BigInt(count), B0)
    return ratioToInterval(n * squares - sum * sum, n * n)
  }
  const indeterminateVariance = (reason: string): DescriptorEvidence => ({
    units: 'ratio',
    direction: 'minimize',
    status: 'DECISION_INDETERMINATE',
    lo: Number.NaN,
    hi: Number.NaN,
    argopt: null,
    completenessProof: reason,
    sourceEnvelope: subject.feasible.envelope,
    perComponent: [],
    witnessEvidence: [],
  })

  if (primary.status === 'DECISION_INDETERMINATE')
    return {
      ...primary,
      anchorVariance: indeterminateVariance('the primary distinct-mass key is itself undecided'),
    }

  // Split the primary argopt on each mass's own depth layers: the counts are constant per cell.
  const primaryCells = toLatticePaths(primary.argopt?.regions ?? [])
  let partition: Array<{ cells: Paths64; counts: number[] }> = primaryCells.length
    ? [{ cells: primaryCells, counts: [] }]
    : []
  let overflowed = false
  for (let massIndex = 0; massIndex < distinctMassesMM.length && !overflowed; massIndex += 1) {
    const massPath = toLatticePaths([distinctMassesMM[massIndex].outer.pts])
    const layers = depthLayers(
      primaryCells,
      subject.offsetsMM.map(([dx, dy]) =>
        Clipper.translatePaths(massPath, -Math.round(dx * LATTICE), -Math.round(dy * LATTICE)),
      ),
    )
    const split: Array<{ cells: Paths64; counts: number[] }> = []
    for (const piece of partition) {
      for (let depth = 0; depth < layers.length && !overflowed; depth += 1) {
        const exactDepth =
          depth + 1 < layers.length && layers[depth + 1].length
            ? Clipper.difference(layers[depth], layers[depth + 1], FillRule.NonZero)
            : layers[depth]
        const cells = Clipper.intersect(piece.cells, exactDepth, FillRule.NonZero)
        if (integerAreaAndMoments(cells).twiceArea === B0) continue
        split.push({ cells, counts: [...piece.counts, depth] })
        if (split.length > maxCells) overflowed = true
      }
      if (overflowed) break
    }
    if (!overflowed) partition = split
  }

  // Only candidates tied at the primary maximum are eligible for the secondary key. The cells are
  // already the primary argopt; the witnesses must be filtered by their own primary count.
  const primaryMax = primary.lo
  const evaluated = partition
    .filter((piece) => piece.counts.length === distinctMassesMM.length)
    .map((piece) => ({ piece, value: varianceOf(piece.counts) }))
  const witnessVariance = witnessCounts
    .map((counts, index) => ({ counts, index }))
    .filter(({ counts }) => counts.filter((count) => count > 0).length === primaryMax)
    .map(({ counts, index }) => ({
      witnessMM: subject.feasible.exactWitnessesMM[index],
      value: varianceOf(counts),
    }))

  const anchorVariance =
    overflowed || (!evaluated.length && !witnessVariance.length)
      ? indeterminateVariance(
          'the joint per-mass partition exceeded the caller cell budget; the variance key is not estimated',
        )
      : globalAnchor(
          'minimize',
          'ratio',
          'exact variance over the certified joint partition of the primary argopt, restricted to candidates tied at the primary maximum',
          subject,
          evaluated.map(({ piece, value }, index) => ({
            componentIndex: index,
            resolved: true,
            lo: value.lo,
            hi: value.hi,
            argopt: { regions: fromLatticePaths(piece.cells), points: [] } as DescriptorArgopt,
          })),
          witnessVariance.map(({ witnessMM, value }) => ({
            witnessMM,
            lo: value.lo,
            hi: value.hi,
          })),
          false,
        )
  return { ...primary, anchorVariance }
}

// ─── dominance ─────────────────────────────────────────────────────────────────────────────────

/**
 * Certified dominance only. Direction comes from the evidence's own physical meaning, never from
 * the caller; the caller supplies only a tolerance in the descriptor's own unit. A unit or
 * direction mismatch is an invalid comparison. Any overlap, or either side undecided, preserves
 * both candidates — Compute resolves no tie and invents no equivalence policy.
 */
export function certifiedDominance(
  a: DescriptorEvidence,
  b: DescriptorEvidence,
  tolerance: number,
): boolean {
  if (a.units !== b.units) throw new RangeError('Dominance requires both descriptors in the same unit.')
  if (a.direction !== b.direction) throw new RangeError('Dominance requires a single objective direction.')
  if (!Number.isFinite(tolerance) || tolerance < 0)
    throw new RangeError('Dominance tolerance must be finite and non-negative.')
  if (a.status === 'DECISION_INDETERMINATE' || b.status === 'DECISION_INDETERMINATE') return false
  return a.direction === 'minimize' ? a.hi < b.lo - tolerance : a.lo > b.hi + tolerance
}
