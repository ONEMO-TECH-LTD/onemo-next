// Magnetic-grid compute seat kernel — the exact predicate, and nothing else.
//
// One question, answered exactly: does a disc of radius r, centred at p, lie
// completely inside this outline? Tangency counts as inside — a disc touching
// the boundary is legal, because the material reaches exactly that far.
//
// Everything is integer arithmetic on a fixed quantum. No square roots, no
// epsilon, no tolerance. Distance comparisons are done squared, in BigInt, so
// "exactly 12mm" compares equal instead of nearly equal.
//
// This module knows nothing about magnets, bands, grids or ONEMO. It takes a
// ring and a radius and answers a geometric question.


import type { BBox, CentrePhaseCandidate, CentrePlacementMeasurement, Contour, ExactPoint, ExactReal, ExtremeCornerMeasurement, Pt, Rational } from '../spec'
import { DEFAULT_PITCH_MM, FIELD_POSITIONS_PER_AXIS } from '../spec'
import {
  addRational,
  affineExact,
  approximateExact,
  compareRational,
  divideRational,
  multiplyRational,
  rational,
  rationalFromNumber,
  signQuadraticAtExact,
  squareRational,
  subtractRational,
} from './exact-real'

/** Exact-tangency band — the same tolerance the seat predicate treats as "at the edge". */
export const TANGENT_GUARD_MM = 0.05

export interface Prepared {
  /** Size of one integer step, in millimetres. */
  readonly quantumMM: number
  /** The ring in integer quanta, duplicate-free, at least three vertices. */
  readonly ring: readonly Pt[]
  /** Bounds in integer quanta. */
  readonly box: BBox
}

type ExactSeatPoint=readonly [Rational,Rational]
const exactSeatPoint=([x,y]:Pt):ExactSeatPoint=>[rationalFromNumber(x),rationalFromNumber(y)]
const exactSeatMinus=(a:ExactSeatPoint,b:ExactSeatPoint):ExactSeatPoint=>[subtractRational(a[0],b[0]),subtractRational(a[1],b[1])]
const exactSeatCross=(a:ExactSeatPoint,b:ExactSeatPoint)=>subtractRational(multiplyRational(a[0],b[1]),multiplyRational(a[1],b[0]))

export function exactPointInMaterial(contour:Contour,pointMM:Pt):boolean{
  const point=exactSeatPoint(pointMM)
  const locate=(ring:ReadonlyArray<Pt>):'IN'|'OUT'|'ON'=>{
    const points=ring.map(exactSeatPoint);let winding=0
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[j],b=points[i],turn=compareRational(exactSeatCross(exactSeatMinus(b,a),exactSeatMinus(point,a)),rational(0))
      const withinX=compareRational(point[0],compareRational(a[0],b[0])<=0?a[0]:b[0])>=0&&compareRational(point[0],compareRational(a[0],b[0])>=0?a[0]:b[0])<=0
      const withinY=compareRational(point[1],compareRational(a[1],b[1])<=0?a[1]:b[1])>=0&&compareRational(point[1],compareRational(a[1],b[1])>=0?a[1]:b[1])<=0
      if(turn===0&&withinX&&withinY)return'ON'
      const ay=compareRational(a[1],point[1]),by=compareRational(b[1],point[1])
      if(ay<=0&&by>0&&turn>0)winding++;else if(ay>0&&by<=0&&turn<0)winding--
    }
    return winding===0?'OUT':'IN'
  }
  return locate(contour.outer.pts)==='IN'&&contour.holes.every(hole=>locate(hole.pts)==='OUT')
}

export const exactSeatIsLegal=(contour:Contour,point:Pt,nearestSquared:Rational,radiusSquared:Rational):boolean=>
  exactPointInMaterial(contour,point)&&compareRational(nearestSquared,radiusSquared)>=0

export type ExactAffineNode = { coefficient: ExactSeatPoint; offset: ExactSeatPoint; point: ExactPoint }
export type ExactAffinePointInput = Omit<ExactAffineNode, 'point'>
export type SeatQuadratic = readonly [Rational, Rational, Rational]
export interface ExactAffineCandidateMeasurement {
  nodes: readonly ExactPoint[]
  seated: readonly ExactPoint[]
  belt: readonly ExactPoint[]
  interior: readonly ExactPoint[]
  affineSeated: readonly ExactAffineNode[]
  affineBelt: readonly ExactAffineNode[]
  seatedExtremeCorners: readonly boolean[]
  beltExtremeCorners: readonly boolean[]
  xLineCount: number
  yLineCount: number
}

const exactSeatDot = (a: ExactSeatPoint, b: ExactSeatPoint): Rational =>
  addRational(multiplyRational(a[0], b[0]), multiplyRational(a[1], b[1]))
const exactSeatTwice = (value: Rational): Rational => multiplyRational(rational(2), value)
const exactSeatPointAt = (point: ExactAffinePointInput, scale: ExactReal): ExactPoint => {
  const x = affineExact(scale, point.coefficient[0], point.offset[0])
  const y = affineExact(scale, point.coefficient[1], point.offset[1])
  return { x, y, approximateMM: [approximateExact(x), approximateExact(y)] }
}
const exactSeatLinearSign = (coefficient: Rational, offset: Rational, scale: ExactReal) =>
  signQuadraticAtExact(rational(0), coefficient, offset, scale)
const exactSeatQuadraticSign = (value: SeatQuadratic, scale: ExactReal) =>
  signQuadraticAtExact(value[0], value[1], value[2], scale)

const exactAffineInRing = (ring: ReadonlyArray<Pt>, point: ExactAffinePointInput, scale: ExactReal): boolean => {
  const points = ring.map(exactSeatPoint)
  let winding = 0
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[previous], b = points[index]
    const ay = exactSeatLinearSign(subtractRational(a[1], point.coefficient[1]), multiplyRational(rational(-1), point.offset[1]), scale)
    const by = exactSeatLinearSign(subtractRational(b[1], point.coefficient[1]), multiplyRational(rational(-1), point.offset[1]), scale)
    const segment = exactSeatMinus(b, a)
    const relativeCoefficient = exactSeatMinus(point.coefficient, a)
    const crossA = exactSeatCross(segment, relativeCoefficient)
    const crossB = exactSeatCross(segment, point.offset)
    const turn = exactSeatLinearSign(crossA, crossB, scale)
    if (ay <= 0 && by > 0 && turn > 0) winding++
    else if (ay > 0 && by <= 0 && turn < 0) winding--
  }
  return winding !== 0
}

const exactSeatDistance = (
  point: ExactAffinePointInput,
  a: ExactSeatPoint,
  b: ExactSeatPoint,
  radiusSquared: Rational,
  scale: ExactReal,
): boolean => {
  const segment = exactSeatMinus(b, a)
  const relativeCoefficient = exactSeatMinus(point.coefficient, a)
  const projectionA = exactSeatDot(relativeCoefficient, segment)
  const projectionB = exactSeatDot(point.offset, segment)
  const lengthSquared = exactSeatDot(segment, segment)
  const start = exactSeatLinearSign(projectionA, projectionB, scale)
  const end = exactSeatLinearSign(subtractRational(projectionA, lengthSquared), projectionB, scale)
  let distance: SeatQuadratic
  if (start <= 0) {
    distance = [exactSeatDot(relativeCoefficient, relativeCoefficient), exactSeatTwice(exactSeatDot(relativeCoefficient, point.offset)), exactSeatDot(point.offset, point.offset)]
  } else if (end >= 0) {
    const endCoefficient = exactSeatMinus(point.coefficient, b)
    distance = [exactSeatDot(endCoefficient, endCoefficient), exactSeatTwice(exactSeatDot(endCoefficient, point.offset)), exactSeatDot(point.offset, point.offset)]
  } else {
    const crossA = exactSeatCross(relativeCoefficient, segment), crossB = exactSeatCross(point.offset, segment)
    distance = [
      multiplyRational(crossA, crossA),
      exactSeatTwice(multiplyRational(crossA, crossB)),
      subtractRational(multiplyRational(crossB, crossB), multiplyRational(radiusSquared, lengthSquared)),
    ]
    return exactSeatQuadraticSign(distance, scale) >= 0
  }
  return exactSeatQuadraticSign([distance[0], distance[1], subtractRational(distance[2], radiusSquared)], scale) >= 0
}

const compareSeatQuadratic = (left: SeatQuadratic, right: SeatQuadratic, scale: ExactReal) =>
  exactSeatQuadraticSign([
    subtractRational(left[0], right[0]), subtractRational(left[1], right[1]), subtractRational(left[2], right[2]),
  ], scale)

const exactSegmentSquared = (
  point: ExactAffinePointInput,
  a: ExactSeatPoint,
  b: ExactSeatPoint,
  scale: ExactReal,
): SeatQuadratic => {
  const segment = exactSeatMinus(b, a), relativeCoefficient = exactSeatMinus(point.coefficient, a)
  const projectionA = exactSeatDot(relativeCoefficient, segment), projectionB = exactSeatDot(point.offset, segment)
  const lengthSquared = exactSeatDot(segment, segment)
  const start = exactSeatLinearSign(projectionA, projectionB, scale)
  const end = exactSeatLinearSign(subtractRational(projectionA, lengthSquared), projectionB, scale)
  if (start <= 0 || compareRational(lengthSquared, rational(0)) === 0) return [
    exactSeatDot(relativeCoefficient, relativeCoefficient), exactSeatTwice(exactSeatDot(relativeCoefficient, point.offset)), exactSeatDot(point.offset, point.offset),
  ]
  if (end >= 0) {
    const coefficient = exactSeatMinus(point.coefficient, b)
    return [exactSeatDot(coefficient, coefficient), exactSeatTwice(exactSeatDot(coefficient, point.offset)), exactSeatDot(point.offset, point.offset)]
  }
  const crossA = exactSeatCross(relativeCoefficient, segment), crossB = exactSeatCross(point.offset, segment)
  return [
    divideRational(multiplyRational(crossA, crossA), lengthSquared),
    divideRational(exactSeatTwice(multiplyRational(crossA, crossB)), lengthSquared),
    divideRational(multiplyRational(crossB, crossB), lengthSquared),
  ]
}

export function measureExactAffineClearance(
  contour: Contour,
  point: ExactAffinePointInput,
  scale: ExactReal,
): { inside: boolean; nearestSquared: SeatQuadratic } {
  const inside = exactAffineInRing(contour.outer.pts, point, scale)
    && contour.holes.every((hole) => !exactAffineInRing(hole.pts, point, scale))
  let nearest: SeatQuadratic | null = null
  for (const ring of [contour.outer, ...contour.holes]) {
    for (let index = 0, previous = ring.pts.length - 1; index < ring.pts.length; previous = index++) {
      const distance = exactSegmentSquared(point, exactSeatPoint(ring.pts[previous]), exactSeatPoint(ring.pts[index]), scale)
      if (!nearest || compareSeatQuadratic(distance, nearest, scale) < 0) nearest = distance
    }
  }
  return { inside, nearestSquared: nearest ?? [rational(0), rational(0), rational(0)] }
}

/** Exact affine lattice seating for one Centre/parity branch at one exact scale. */
export function measureExactAffineCandidate(
  contour: Contour,
  targetCoefficient: ExactSeatPoint,
  targetOffset: ExactSeatPoint,
  scale: ExactReal,
  xGap: boolean,
  yGap: boolean,
  pitchMM: number,
  radiusMM: Rational,
): ExactAffineCandidateMeasurement {
  const radiusSquared = squareRational(radiusMM)
  const first = -Math.floor(FIELD_POSITIONS_PER_AXIS / 2)
  const entries: Array<{ ix: number; iy: number; affine: ExactAffinePointInput; point: ExactPoint; seated: boolean }> = []
  for (let yi = 0; yi < FIELD_POSITIONS_PER_AXIS; yi++) for (let xi = 0; xi < FIELD_POSITIONS_PER_AXIS; xi++) {
    const point: ExactAffinePointInput = {
      coefficient: targetCoefficient,
      offset: [
        addRational(targetOffset[0], rationalFromNumber((first + xi + (xGap ? .5 : 0)) * pitchMM)),
        addRational(targetOffset[1], rationalFromNumber((first + yi + (yGap ? .5 : 0)) * pitchMM)),
      ],
    }
    const clearance = measureExactAffineClearance(contour, point, scale)
    const legal = clearance.inside && exactSeatQuadraticSign([
      clearance.nearestSquared[0], clearance.nearestSquared[1], subtractRational(clearance.nearestSquared[2], radiusSquared),
    ], scale) >= 0
    entries.push({ ix: xi, iy: yi, affine: point, point: exactSeatPointAt(point, scale), seated: legal })
  }
  const nodes = entries.map((entry) => entry.point)
  const seatedEntries = entries.filter((entry) => entry.seated)
  const occupied = new Set(seatedEntries.map((entry) => `${entry.ix}:${entry.iy}`))
  const interiorEntries = seatedEntries.filter((entry) =>
    occupied.has(`${entry.ix - 1}:${entry.iy}`) && occupied.has(`${entry.ix + 1}:${entry.iy}`)
    && occupied.has(`${entry.ix}:${entry.iy - 1}`) && occupied.has(`${entry.ix}:${entry.iy + 1}`))
  const interiorIds = new Set(interiorEntries.map((entry) => `${entry.ix}:${entry.iy}`))
  const beltEntries = seatedEntries.filter((entry) => !interiorIds.has(`${entry.ix}:${entry.iy}`))
  const extremeCorners = (population: typeof seatedEntries) => {
    if (!population.length) return []
    const xs = population.map((entry) => entry.ix), ys = population.map((entry) => entry.iy)
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    return population.map((entry) => (entry.ix === minX || entry.ix === maxX) && (entry.iy === minY || entry.iy === maxY))
  }
  return {
    nodes,
    seated: seatedEntries.map((entry) => entry.point),
    belt: beltEntries.map((entry) => entry.point),
    interior: interiorEntries.map((entry) => entry.point),
    affineSeated: seatedEntries.map((entry) => ({ ...entry.affine, point: entry.point })),
    affineBelt: beltEntries.map((entry) => ({ ...entry.affine, point: entry.point })),
    seatedExtremeCorners: extremeCorners(seatedEntries),
    beltExtremeCorners: extremeCorners(beltEntries),
    xLineCount: new Set(seatedEntries.map((entry) => entry.ix)).size,
    yLineCount: new Set(seatedEntries.map((entry) => entry.iy)).size,
  }
}

const big = (n: number): bigint => BigInt(n)
/** This project targets ES2017, where BigInt LITERALS (`0n`) do not compile. */
const ZERO = BigInt(0)

/** Twice the signed area of the triangle abc. Sign gives the turn direction. */
function orient(a: Pt, b: Pt, c: Pt): bigint {
  return big(b[0] - a[0]) * big(c[1] - a[1]) - big(b[1] - a[1]) * big(c[0] - a[0])
}

/** p lies on the closed segment ab. */
function onSegment(p: Pt, a: Pt, b: Pt): boolean {
  if (orient(a, b, p) !== ZERO) return false
  return (
    p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) &&
    p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1])
  )
}

/**
 * Quantise a millimetre ring to integer quanta and drop repeated vertices.
 *
 * Throws rather than guesses: a ring that collapses below three distinct
 * vertices, or encloses no area, is not a shape this can answer about.
 */
export function prepare(ringMM: readonly Pt[], quantumMM = 0.001): Prepared {
  if (!(quantumMM > 0) || !Number.isFinite(quantumMM)) {
    throw new RangeError('quantum must be finite and positive')
  }
  const scaled: Pt[] = []
  for (const [x, y] of ringMM) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError('outline contains a non-finite coordinate')
    }
    const p: Pt = [Math.round(x / quantumMM), Math.round(y / quantumMM)]
    const last = scaled[scaled.length - 1]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) scaled.push(p)
  }
  const first = scaled[0]
  const last = scaled[scaled.length - 1]
  if (first && last && scaled.length > 1 && first[0] === last[0] && first[1] === last[1]) scaled.pop()
  if (scaled.length < 3) throw new RangeError('outline needs at least three distinct vertices')

  let twiceArea = ZERO
  for (let i = 0; i < scaled.length; i++) {
    const a = scaled[i]!
    const b = scaled[(i + 1) % scaled.length]!
    twiceArea += big(a[0]) * big(b[1]) - big(b[0]) * big(a[1])
  }
  if (twiceArea === ZERO) throw new RangeError('outline encloses no area')

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of scaled) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { quantumMM, ring: Object.freeze(scaled), box: { minX, minY, maxX, maxY } }
}

export type Location = 'IN' | 'OUT' | 'ON'

/** Exact location of an integer point against the ring. Winding, no tolerance. */
export function locate(shape: Prepared, p: Pt): Location {
  const { ring, box } = shape
  if (p[0] < box.minX || p[0] > box.maxX || p[1] < box.minY || p[1] > box.maxY) return 'OUT'
  let winding = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    if (onSegment(p, a, b)) return 'ON'
    if (a[1] <= p[1]) {
      if (b[1] > p[1] && orient(a, b, p) > ZERO) winding++
    } else if (b[1] <= p[1] && orient(a, b, p) < ZERO) winding--
  }
  return winding === 0 ? 'OUT' : 'IN'
}

/**
 * Is the squared distance from p to segment ab at least r²?
 *
 * Three cases, all exact: p projects before a, after b, or onto the segment's
 * interior — where the perpendicular distance is |cross| / |v|, so the test
 * becomes cross² >= r²·|v|² with no division and no root.
 */
function atLeast(p: Pt, a: Pt, b: Pt, r2: bigint): boolean {
  const vx = big(b[0] - a[0]), vy = big(b[1] - a[1])
  const wx = big(p[0] - a[0]), wy = big(p[1] - a[1])
  const dot = wx * vx + wy * vy
  if (dot <= ZERO) return wx * wx + wy * wy >= r2
  const len2 = vx * vx + vy * vy
  if (dot >= len2) {
    const ux = big(p[0] - b[0]), uy = big(p[1] - b[1])
    return ux * ux + uy * uy >= r2
  }
  const cross = vx * wy - vy * wx
  return cross * cross >= r2 * len2
}

/**
 * Does the closed disc of radius `radius` (in quanta) centred at `p` lie wholly
 * inside the outline?
 *
 * A centre exactly `radius` from the nearest edge PASSES — the disc is tangent
 * to the boundary and every part of it is on material. This is the whole reason
 * the arithmetic is integer: at 12.000000000mm the comparison must be equal, not
 * nearly equal.
 */
export function holds(shape: Prepared, p: Pt, radius: number): boolean {
  if (locate(shape, p) === 'OUT') return false
  const r2 = big(radius) * big(radius)
  const { ring } = shape
  for (let i = 0; i < ring.length; i++) {
    if (!atLeast(p, ring[i]!, ring[(i + 1) % ring.length]!, r2)) return false
  }
  return true
}

export function bbox(pts: ReadonlyArray<Pt>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

/** Spot radius = the padding, measured from the magnet centre. */
export function spotRadiusOf(padMM: number): number {
  return padMM
}

/** Full field span: the fixed 9×9 board on the base 48 grid, plus one spot either side — 408 at
 *  12 padding. Pitch never changes the board: 96 skips points on it, 24 adds points within it. */
export function fieldSpanMM(padMM: number): number {
  return (FIELD_POSITIONS_PER_AXIS - 1) * DEFAULT_PITCH_MM + 2 * spotRadiusOf(padMM)
}

/** Axis positions at `step` with a phase offset, spanning [min, max]. */
function axisFrom(min: number, max: number, step: number, phase: number): number[] {
  if (step <= 0 || max <= min) return [(min + max) / 2]
  const res: number[] = []
  let x = min + (((phase % step) + step) % step)
  while (x - step >= min - 1e-6) x -= step
  for (; x <= max + 1e-6; x += step) if (x >= min - 1e-6) res.push(x)
  return res
}

/** Lattice across a region at phase (ox, oy). */
export function latticeAt(bb: BBox, pitch: number, ox: number, oy: number): Pt[] {
  const out: Pt[] = []
  for (const x of axisFrom(bb.minX, bb.maxX, pitch, ox))
    for (const y of axisFrom(bb.minY, bb.maxY, pitch, oy)) out.push([x, y])
  return out
}

/** The same lattice generator over an arbitrary region. */
export function latticeOver(region: BBox, pitch: number, phase: Pt): Pt[] {
  return latticeAt(region, pitch, phase[0], phase[1])
}

/** Measure already-ruled Centre phases without choosing between them. */
export function measureCentrePlacements(
  bb: BBox,
  pitch: number,
  candidates: ReadonlyArray<CentrePhaseCandidate>,
  fits: (pt: Pt) => boolean,
  outer: ReadonlyArray<Pt>,
  reach: number,
): CentrePlacementMeasurement[] {
  return candidates.map(({ phaseMM: [px, py], canon }) => {
    const ox = ((px % pitch) + pitch) % pitch
    const oy = ((py % pitch) + pitch) % pitch
    const seated = latticeAt(bb, pitch, ox, oy).filter(fits)
    return { phaseMM: [ox, oy], seated, canon, excessMM: pressExcessMM(outer, seated, reach) }
  })
}

/**
 * Bucketed edge index — accelerates nearest-edge distance and ray parity. Results are
 * BIT-IDENTICAL to the full scans: every edge that could be nearest is examined with the same
 * arithmetic, and edges a query skips contribute no ray crossing by construction. Built once
 * per outline array (WeakMap) — a solve reuses it across its thousands of queries.
 */
interface EdgeIdx {
  cell: number; ox: number; oy: number; cols: number; rows: number
  buckets: number[][]
  yBands: number[][]
  /** Chebyshev ring distance from each cell to the nearest edge-holding cell (BFS). */
  ring: Int16Array
  stamp: Int32Array
  tick: number
}
const EDGE_IDX = new WeakMap<object, EdgeIdx>()
function edgeIdxOf(outer: ReadonlyArray<Pt>): EdgeIdx {
  let idx = EDGE_IDX.get(outer as object)
  if (idx) return idx
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of outer) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const cell = Math.max(4, Math.max(maxX - minX, maxY - minY) / 32)
  const cols = Math.max(1, Math.ceil((maxX - minX) / cell) + 1)
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell) + 1)
  const buckets: number[][] = Array.from({ length: cols * rows }, () => [])
  const yBands: number[][] = Array.from({ length: rows }, () => [])
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const [ax, ay] = outer[j], [bx, by] = outer[i]
    const c0 = Math.max(0, Math.min(cols - 1, Math.floor((Math.min(ax, bx) - minX) / cell)))
    const c1 = Math.max(0, Math.min(cols - 1, Math.floor((Math.max(ax, bx) - minX) / cell)))
    const r0 = Math.max(0, Math.min(rows - 1, Math.floor((Math.min(ay, by) - minY) / cell)))
    const r1 = Math.max(0, Math.min(rows - 1, Math.floor((Math.max(ay, by) - minY) / cell)))
    for (let r = r0; r <= r1; r++) { for (let c = c0; c <= c1; c++) buckets[r * cols + c].push(i); yBands[r].push(i) }
  }
  // dedupe band lists (an edge may span several columns of the same row)
  for (let r = 0; r < rows; r++) yBands[r] = [...new Set(yBands[r])]
  // Ring field: multi-source BFS from edge cells — a deep query starts its scan at the ring
  // that can actually hold the nearest edge instead of expanding through empty space.
  const ring = new Int16Array(cols * rows).fill(-1)
  let frontier: number[] = []
  for (let i = 0; i < cols * rows; i++) if (buckets[i].length) { ring[i] = 0; frontier.push(i) }
  for (let d = 1; frontier.length; d++) {
    const next: number[] = []
    for (const cellIdx of frontier) {
      const cr0 = Math.floor(cellIdx / cols), cc0 = cellIdx % cols
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = cr0 + dr, c = cc0 + dc
        if (rr < 0 || rr >= rows || c < 0 || c >= cols) continue
        const k = rr * cols + c
        if (ring[k] === -1) { ring[k] = d; next.push(k) }
      }
    }
    frontier = next
  }
  idx = { cell, ox: minX, oy: minY, cols, rows, buckets, yBands, ring, stamp: new Int32Array(outer.length), tick: 0 }
  EDGE_IDX.set(outer as object, idx)
  return idx
}

function segDist2(outer: ReadonlyArray<Pt>, i: number, px: number, py: number): number {
  const j = i === 0 ? outer.length - 1 : i - 1
  const [ax, ay] = outer[j], [bx, by] = outer[i]
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  if (t < 0) t = 0; else if (t > 1) t = 1
  const ex = px - (ax + t * dx), ey = py - (ay + t * dy)
  return ex * ex + ey * ey
}

/** Float distance from a point to the outline's nearest edge — the prescreen metric. */
export function edgeDistMM(outer: ReadonlyArray<Pt>, pt: Pt): number {
  const idx = edgeIdxOf(outer)
  const [px, py] = pt
  const cc = Math.max(0, Math.min(idx.cols - 1, Math.floor((px - idx.ox) / idx.cell)))
  const cr = Math.max(0, Math.min(idx.rows - 1, Math.floor((py - idx.oy) / idx.cell)))
  const tick = ++idx.tick
  let best = Infinity
  const maxR = Math.max(idx.cols, idx.rows)
  const r0 = Math.max(0, idx.ring[cr * idx.cols + cc] - 1)
  for (let r = r0; ; r++) {
    // Once every unexamined edge is provably farther than the best, stop.
    if (r > r0) { const lb = (r - 1) * idx.cell; if (lb * lb > best || r > maxR + r0) break }
    for (let dr = -r; dr <= r; dr++) {
      const rr = cr + dr
      if (rr < 0 || rr >= idx.rows) continue
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue
        const c = cc + dc
        if (c < 0 || c >= idx.cols) continue
        for (const e of idx.buckets[rr * idx.cols + c]) {
          if (idx.stamp[e] === tick) continue
          idx.stamp[e] = tick
          const d2 = segDist2(outer, e, px, py)
          if (d2 < best) best = d2
        }
      }
    }
  }
  return Math.sqrt(best)
}

/** Even-odd ray parity via the y-band index — identical crossings to the full scan. */
export function pointInOuter(pt: Pt, outer: ReadonlyArray<Pt>): boolean {
  const idx = edgeIdxOf(outer)
  const band = Math.max(0, Math.min(idx.rows - 1, Math.floor((pt[1] - idx.oy) / idx.cell)))
  let inside = false
  for (const i of idx.yBands[band]) {
    const j = i === 0 ? outer.length - 1 : i - 1
    const [xi, yi] = outer[i]
    const [xj, yj] = outer[j]
    const crosses = (yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/**
 * Seat predicate for one outline: centre at least `spotRadiusMM` from every boundary point,
 * tangency passing by equality (exact integer arithmetic, micron quantum).
 * A float prescreen answers the clear cases; only points within a guard band of the exact
 * threshold fall through to the integer test — the answer never changes, only the cost.
 * Null for a degenerate outline.
 */
export function makeSeatPredicate(
  outer: ReadonlyArray<Pt>,
  spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const QUANTUM = 0.001
  const GUARD = 0.05
  let prep: ReturnType<typeof prepare>
  try { prep = prepare(outer, QUANTUM) } catch { return null }
  const rQ = Math.round(spotRadiusMM / QUANTUM)
  return (pt: Pt) => {
    // Ring-field lower bound: a point provably farther than the threshold from every edge
    // skips the distance query entirely — parity alone decides. Same answer, no scan.
    const idx = edgeIdxOf(outer)
    const cc = Math.max(0, Math.min(idx.cols - 1, Math.floor((pt[0] - idx.ox) / idx.cell)))
    const cr = Math.max(0, Math.min(idx.rows - 1, Math.floor((pt[1] - idx.oy) / idx.cell)))
    if ((idx.ring[cr * idx.cols + cc] - 1) * idx.cell > spotRadiusMM + GUARD) return pointInOuter(pt, outer)
    const d = edgeDistMM(outer, pt)
    if (d > spotRadiusMM + GUARD) return pointInOuter(pt, outer)
    if (d < spotRadiusMM - GUARD) return false
    return holds(prep, [Math.round(pt[0] / QUANTUM), Math.round(pt[1] / QUANTUM)], rQ)
  }
}

/**
 * Seat predicate for a TRUE CIRCLE (centre c, radius R): the disc of radius r fits iff
 * |p−c|² ≤ (R−r)² — integer microns, tangency by equality. A flattened polygon's chords sit
 * microns inside the curve and wrongly refuse the zero-margin case; the analytic form cannot.
 */
export function makeCircleSeatPredicate(
  cx: number, cy: number, R: number, spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const QUANTUM = 0.001
  const q = (v: number) => Math.round(v / QUANTUM)
  const slack = q(R) - q(spotRadiusMM)
  if (slack < 0) return null
  const cqx = q(cx), cqy = q(cy), s2 = slack * slack
  return (pt: Pt) => {
    const dx = q(pt[0]) - cqx, dy = q(pt[1]) - cqy
    return dx * dx + dy * dy <= s2
  }
}

/** THE WRAP LAW (Dan, 2026-08-20: "0 flap means magnets and edges touch"): wrap is each
 *  disc PRESSED against the outline. The force is the mean of every seated disc's own gap
 *  past its margined edge (spot + allowance) — zero when every disc that can touch does.
 *  Enforced through the dominance tiers, not preferred. */
export function pressExcessMM(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number): number {
  if (!seated.length) return 0
  let sum = 0
  for (const s of seated) sum += Math.max(0, edgeDistMM(outer, s) - reach)
  return sum / seated.length
}

/** THE RIGID GATE (Dan, 2026-08-20): the worst disc's gap past its margined edge. A layout
 *  qualifies only when EVERY disc touches within the allowance — 0 = touch, 1 = 1mm space.
 *  Normal mode enforces this; Auto mode adapts the allowance instead. */
export function maxPressMM(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number): number {
  let m = 0
  for (const s of seated) { const g = edgeDistMM(outer, s) - reach; if (g > m) m = g }
  return m
}

/** Where discs actually touch: for each seated disc within `slackMM` of its margined edge,
 *  the nearest point on the outline — drawn so tangency is visible, never guessed. */
export function contactPointsMM(
  outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number, slackMM: number,
): Pt[] {
  const out: Pt[] = []
  for (const s of seated) {
    if (edgeDistMM(outer, s) - reach > slackMM) continue
    // nearest outline point: brute over segments (few contacts per solve — cost immaterial)
    let best: Pt = outer[0], bd = Infinity
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
      const [ax, ay] = outer[j], [bx, by] = outer[i]
      const dx = bx - ax, dy = by - ay
      const len2 = dx * dx + dy * dy
      let t = len2 > 0 ? ((s[0] - ax) * dx + (s[1] - ay) * dy) / len2 : 0
      t = Math.max(0, Math.min(1, t))
      const px = ax + t * dx, py = ay + t * dy
      const d = Math.hypot(s[0] - px, s[1] - py)
      if (d < bd) { bd = d; best = [px, py] }
    }
    out.push(best)
  }
  return out
}

/** The allowance a solved layout IMPLIES at its size — the margin needed to HOLD EVERY disc
 *  (the worst gap, matching the wrap law), not merely the first one to touch. Free mode's Auto
 *  readout and the band's granting law therefore speak the same language (pixel full-eval F3).
 *  0 = every disc already tangent. */
export function impliedFlapMM(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, spotRadiusMM: number): number {
  if (!seated.length) return 0
  let g = 0
  for (const a of seated) { const d = edgeDistMM(outer, a) - spotRadiusMM; if (d > g) g = d }
  return Math.max(0, g)
}

/** Marching-squares topology: per corner-sign mask (array position), the cell-edge pairs a
 *  contour crosses. Edges 0=top 1=right 2=bottom 3=left. */

export function splitPerimeter(seated: ReadonlyArray<Pt>, step: number): { belt: Pt[]; interior: Pt[] } {
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

/** Neutral extreme-corner measurements consumed by the magnet-plan policy. */
export function measureExtremeCorners(seated: ReadonlyArray<Pt>, bb: BBox): ExtremeCornerMeasurement[] {
  return seated.map((p) => {
    const ex = Math.abs(p[0] - bb.minX) < 0.6 || Math.abs(p[0] - bb.maxX) < 0.6
    const ey = Math.abs(p[1] - bb.minY) < 0.6 || Math.abs(p[1] - bb.maxY) < 0.6
    return { p, extremeCorner: ex && ey }
  })
}

/** Scale a normalized contour (longest side = 1mm) to a real longest side in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  const scaleRing=(points:ReadonlyArray<Pt>):Pt[]=>points.map(([x,y])=>[x*longestMM,y*longestMM])
  const outer=scaleRing(base.outer.pts),holes=base.holes.map(hole=>({pts:scaleRing(hole.pts)}))
  if(!outer.length)return{outer:{pts:outer},holes}
  const bb=bbox(outer),actual=Math.max(bb.maxX-bb.minX,bb.maxY-bb.minY)
  if(actual===longestMM||actual===0)return{outer:{pts:outer},holes}
  const correction=longestMM/actual
  const correct=(points:ReadonlyArray<Pt>):Pt[]=>points.map(([x,y])=>[
    (x-bb.minX)*correction,
    (y-bb.minY)*correction,
  ])
  return{outer:{pts:correct(outer)},holes:holes.map(hole=>({pts:correct(hole.pts)}))}
}
