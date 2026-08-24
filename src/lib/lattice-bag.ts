import {
  Clipper,
  EndType,
  FillRule,
  JoinType,
  PointInPolygonResult,
  type Path64,
  type Paths64,
} from '@countertype/clipper2-ts'
import { pointInPolygon } from './effect/polygon'
import { exactPerimeterCoverage, HOLD_REACH_MM } from './effect/grid-core'
import type { Pt } from './effect/types'

export const LATTICE_PITCH_MM = 48
export const DISK_DIAMETER_MM = 24
export const MAX_BAG_DISKS = 1000

export const BAG_BANDS = [
  { id: 'B1', minMM: 24, maxMM: 71 },
  { id: 'B2', minMM: 72, maxMM: 119 },
  { id: 'B3', minMM: 120, maxMM: 167 },
  { id: 'B4', minMM: 168, maxMM: 216 },
] as const

export type BagBandId = typeof BAG_BANDS[number]['id']

const DISK_RADIUS_MM = DISK_DIAMETER_MM / 2
const FIT_EPSILON_MM = 0.001
const MAX_CENTRE_SHIFT_MM = 1
const CLIPPER_SCALE = 1000
const MAX_ROTATION_RAD = Math.PI / 4
const ROTATION_STEP_RAD = 5 * Math.PI / 180
const DISCOVERY_STEPS = 24
const SAFE_REGION_CACHE = new WeakMap<ReadonlyArray<Pt>, Map<number, Paths64>>()

export interface BagContact {
  disk: Pt
  outline: Pt
  clearanceMM: number
}

export interface PreparedBag {
  outline: Pt[]
}

export type BagShapeClass =
  | 'Square'
  | 'Portrait rectangle'
  | 'Landscape rectangle'
  | 'Circle / oval'
  | 'Diamond'

export interface BagFit {
  seats: Pt[]
  outline: Pt[]
  centre: Pt
  materialCentre: Pt
  sizeMM: number
  centredSizeMM: number
  centreShiftMM: number
  contacts: BagContact[]
  peripheryGaps: Pt[]
  uncoveredPeripheryMM: number
  option: string
  rotation: number
}

export interface BagBandResult {
  id: BagBandId
  minMM: number
  maxMM: number
  candidates: BagFit[]
}

interface BagLayout {
  seats: Pt[]
  label: string
}

interface GridTransform {
  x: number
  y: number
  rotation: number
}

function polygonCentroid(ring: ReadonlyArray<Pt>): Pt {
  let twiceArea = 0
  let x = 0
  let y = 0
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index]
    const b = ring[(index + 1) % ring.length]
    const cross = a[0] * b[1] - b[0] * a[1]
    twiceArea += cross
    x += (a[0] + b[0]) * cross
    y += (a[1] + b[1]) * cross
  }
  if (Math.abs(twiceArea) < Number.EPSILON) return ring[0]
  return [x / (3 * twiceArea), y / (3 * twiceArea)]
}

function pointMean(points: ReadonlyArray<Pt>): Pt {
  const total = points.reduce(([x, y], point) => [x + point[0], y + point[1]] as Pt, [0, 0] as Pt)
  return [total[0] / points.length, total[1] / points.length]
}

function closestPointOnSegment(point: Pt, a: Pt, b: Pt): { point: Pt; distance: number } {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const length2 = dx * dx + dy * dy
  const t = length2 === 0
    ? 0
    : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2))
  const closest: Pt = [a[0] + dx * t, a[1] + dy * t]
  return { point: closest, distance: Math.hypot(point[0] - closest[0], point[1] - closest[1]) }
}

function nearestBoundary(point: Pt, ring: ReadonlyArray<Pt>) {
  let nearest = { point: ring[0], distance: Infinity }
  for (let index = 0; index < ring.length; index++) {
    const candidate = closestPointOnSegment(point, ring[index], ring[(index + 1) % ring.length])
    if (candidate.distance < nearest.distance) nearest = candidate
  }
  return nearest
}

function interiorCore(ring: ReadonlyArray<Pt>): Pt {
  const centroid = polygonCentroid(ring)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of ring) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  let best = pointInPolygon(centroid, ring)
    ? { point: centroid, clearance: nearestBoundary(centroid, ring).distance }
    : { point: ring[0], clearance: -Infinity }
  for (let iy = 0; iy <= 32; iy++) {
    for (let ix = 0; ix <= 32; ix++) {
      const point: Pt = [minX + (maxX - minX) * ix / 32, minY + (maxY - minY) * iy / 32]
      if (!pointInPolygon(point, ring)) continue
      const clearance = nearestBoundary(point, ring).distance
      if (clearance > best.clearance) best = { point, clearance }
    }
  }
  if (!(best.clearance >= 0)) throw new Error('The uploaded shape has no interior')
  return best.point
}

export function normalizeBagOutline(ring: ReadonlyArray<Pt>): Pt[] {
  if (ring.length < 3) throw new Error('A shape needs at least three outline points')
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of ring) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const longest = Math.max(maxX - minX, maxY - minY)
  if (!(longest > 0)) throw new Error('The uploaded shape has no area')
  const scaled = ring.map(([x, y]) => [x / longest, y / longest] as Pt)
  const core = interiorCore(scaled)
  return scaled.map(([x, y]) => [x - core[0], y - core[1]])
}

const OPTION_AXES = [
  { label: 'Vertical', distance: ([x]: Pt) => Math.abs(x) },
  { label: 'Horizontal', distance: (([, y]: Pt) => Math.abs(y)) },
  { label: 'Diagonal ↘', distance: (([x, y]: Pt) => Math.abs(x - y)) },
  { label: 'Diagonal ↗', distance: (([x, y]: Pt) => Math.abs(x + y)) },
] as const

function latticeSeats(count: number, optionIndex: number): Pt[] {
  const radius = Math.ceil((Math.sqrt(count) - 1) / 2)
  const seats: Pt[] = []
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) seats.push([x, y])
  }
  const axis = OPTION_AXES[optionIndex]
  seats.sort((a, b) => {
    const distance = a[0] ** 2 + a[1] ** 2 - b[0] ** 2 - b[1] ** 2
    if (distance !== 0) return distance
    const axisFirst = axis.distance(a) - axis.distance(b)
    if (axisFirst !== 0) return axisFirst
    if (a[1] !== b[1]) return a[1] - b[1]
    return a[0] - b[0]
  })
  return seats.slice(0, count).map(([x, y]) => [x * LATTICE_PITCH_MM, y * LATTICE_PITCH_MM])
}

function outlineBounds(outline: ReadonlyArray<Pt>) {
  const xs = outline.map(([x]) => x)
  const ys = outline.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
}

export function classifyBag(prepared: PreparedBag): BagShapeClass {
  const bounds = outlineBounds(prepared.outline)
  const centre: Pt = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]
  const rx = bounds.width / 2 || 1
  const ry = bounds.height / 2 || 1
  const ellipseError = prepared.outline.reduce((sum, [x, y]) => (
    sum + Math.abs(Math.hypot((x - centre[0]) / rx, (y - centre[1]) / ry) - 1)
  ), 0) / prepared.outline.length
  const diamondError = prepared.outline.reduce((sum, [x, y]) => (
    sum + Math.abs(Math.abs((x - centre[0]) / rx) + Math.abs((y - centre[1]) / ry) - 1)
  ), 0) / prepared.outline.length
  if (diamondError < 0.09) return 'Diamond'
  if (ellipseError < 0.09) return 'Circle / oval'
  const aspect = bounds.width / bounds.height
  if (aspect < 0.82) return 'Portrait rectangle'
  if (aspect > 1.22) return 'Landscape rectangle'
  return 'Square'
}

function rectangularSeats(count: number, columns: number, rows: number): Pt[] {
  const seats: Pt[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      seats.push([
        (column - (columns - 1) / 2) * LATTICE_PITCH_MM,
        (row - (rows - 1) / 2) * LATTICE_PITCH_MM,
      ])
    }
  }
  return seats.slice(0, count)
}

function classifiedSeats(
  prepared: PreparedBag,
  count: number,
  shapeClass: BagShapeClass,
): { seats: Pt[]; label: string } {
  const bounds = outlineBounds(prepared.outline)
  const measuredAspect = bounds.width / bounds.height
  const targetAspect = shapeClass === 'Portrait rectangle'
    ? Math.min(measuredAspect, 0.72)
    : shapeClass === 'Landscape rectangle'
      ? Math.max(measuredAspect, 1 / 0.72)
      : 1
  let best: { columns: number; rows: number; error: number } | null = null
  for (let columns = 1; columns <= count; columns++) {
    if (count % columns !== 0) continue
    const rows = count / columns
    const width = DISK_DIAMETER_MM + (columns - 1) * LATTICE_PITCH_MM
    const height = DISK_DIAMETER_MM + (rows - 1) * LATTICE_PITCH_MM
    const error = Math.abs(Math.log(width / height / targetAspect))
    if (!best || error < best.error) best = { columns, rows, error }
  }
  const fallbackAxis = shapeClass === 'Landscape rectangle' ? 1 : shapeClass === 'Diamond' ? 2 : 0
  const fallback = latticeSeats(count, fallbackAxis)
  const fallbackBounds = outlineBounds(fallback)
  const fallbackWidth = fallbackBounds.width + DISK_DIAMETER_MM
  const fallbackHeight = fallbackBounds.height + DISK_DIAMETER_MM
  const fallbackError = Math.abs(Math.log(fallbackWidth / fallbackHeight / targetAspect))
  const rectangularClass = shapeClass === 'Portrait rectangle' || shapeClass === 'Landscape rectangle'
  if (!best || (!rectangularClass && fallbackError + 0.05 < best.error)) {
    return { seats: fallback, label: `${shapeClass} standard` }
  }
  return {
    seats: rectangularSeats(count, best.columns, best.rows),
    label: `${shapeClass} · ${best.columns}×${best.rows}`,
  }
}

function fitPreparedSeats(
  prepared: PreparedBag,
  localSeats: Pt[],
  option: string,
  allowRotation: boolean,
  solver = tightFit,
): BagFit {
  const fit = solver(prepared.outline, localSeats, allowRotation)
  const outline = scaledOutline(prepared.outline, fit.scale)
  const seats = localSeats.map((seat) => transformSeat(seat, fit.transform))
  const nearest = seats.map((disk) => {
    const hit = nearestBoundary(disk, outline)
    return { disk, outline: hit.point, clearanceMM: hit.distance - DISK_RADIUS_MM }
  })
  const minimum = Math.min(...nearest.map((contact) => Math.abs(contact.clearanceMM)))
  const periphery = exactPerimeterCoverage(
    { outer: { pts: outline }, holes: [] },
    seats,
    HOLD_REACH_MM,
    'standard',
    LATTICE_PITCH_MM,
  )
  return {
    seats,
    outline,
    centre: pointMean(seats),
    materialCentre: polygonCentroid(outline),
    sizeMM: fit.scale,
    centredSizeMM: fit.centredScale,
    centreShiftMM: fit.centreShiftMM,
    contacts: nearest.filter((contact) => Math.abs(contact.clearanceMM) <= minimum + 0.05),
    peripheryGaps: periphery.gaps,
    uncoveredPeripheryMM: periphery.uncoveredMM,
    option,
    rotation: fit.transform.rotation,
  }
}

function settleGrid(
  outline: ReadonlyArray<Pt>,
  localSeats: ReadonlyArray<Pt>,
  seed: GridTransform,
  allowRotation: boolean,
) {
  const transform = { ...seed }
  for (let iteration = 0; iteration < DISCOVERY_STEPS; iteration++) {
    let forceX = 0
    let forceY = 0
    let torque = 0
    let violations = 0
    let moment = 0
    for (const local of localSeats) {
      const disk = transformSeat(local, transform)
      const hit = nearestBoundary(disk, outline)
      const inside = pointInPolygon(disk, outline)
      const clearance = inside ? hit.distance - DISK_RADIUS_MM : -hit.distance - DISK_RADIUS_MM
      if (clearance >= -FIT_EPSILON_MM) continue
      const dx = disk[0] - hit.point[0]
      const dy = disk[1] - hit.point[1]
      const distance = Math.hypot(dx, dy) || 1
      const direction = inside ? 1 : -1
      const pushX = dx / distance * -clearance * direction
      const pushY = dy / distance * -clearance * direction
      forceX += pushX
      forceY += pushY
      const armX = disk[0] - transform.x
      const armY = disk[1] - transform.y
      torque += armX * pushY - armY * pushX
      moment += armX * armX + armY * armY
      violations++
    }
    if (violations === 0) return transform
    transform.x += forceX / violations * 0.72
    transform.y += forceY / violations * 0.72
    if (allowRotation && moment > 0) transform.rotation += torque / moment * 0.45
  }
  return null
}

function discoveryFit(outline: ReadonlyArray<Pt>, localSeats: ReadonlyArray<Pt>, allowRotation: boolean) {
  let upper = DISK_DIAMETER_MM
  let best: GridTransform = { x: 0, y: 0, rotation: 0 }
  for (;;) {
    const settled = settleGrid(scaledOutline(outline, upper), localSeats, best, allowRotation)
    if (settled) {
      best = settled
      break
    }
    upper *= 1.25
    if (upper > 100_000) throw new Error('The rigid lattice group could not fit inside the uploaded shape')
  }
  let lower = 0
  for (let iteration = 0; iteration < 10; iteration++) {
    const middle = (lower + upper) / 2
    const settled = settleGrid(scaledOutline(outline, middle), localSeats, best, allowRotation)
    if (settled) {
      upper = middle
      best = settled
    } else {
      lower = middle
    }
  }
  const materialCentre = polygonCentroid(outline)
  const centre = pointMean(localSeats.map((seat) => transformSeat(seat, best)))
  const centreShiftMM = Math.hypot(
    centre[0] - materialCentre[0] * upper,
    centre[1] - materialCentre[1] * upper,
  )
  return { scale: upper, centredScale: upper, transform: best, centreShiftMM }
}

function transformSeat([x, y]: Pt, transform: GridTransform): Pt {
  const cosine = Math.cos(transform.rotation)
  const sine = Math.sin(transform.rotation)
  return [
    transform.x + x * cosine - y * sine,
    transform.y + x * sine + y * cosine,
  ]
}

function scaledOutline(outline: ReadonlyArray<Pt>, scale: number) {
  return outline.map(([x, y]) => [x * scale, y * scale] as Pt)
}

function clipperPath(outline: ReadonlyArray<Pt>, scale: number): Path64 {
  const path = outline.map(([x, y]) => ({
    x: Math.round(x * scale * CLIPPER_SCALE),
    y: Math.round(y * scale * CLIPPER_SCALE),
  }))
  return Clipper.isPositive(path) ? path : path.reverse()
}

function safeRegions(outline: ReadonlyArray<Pt>, scale: number): Paths64 {
  let byScale = SAFE_REGION_CACHE.get(outline)
  if (!byScale) {
    byScale = new Map()
    SAFE_REGION_CACHE.set(outline, byScale)
  }
  const cached = byScale.get(scale)
  if (cached) return cached
  const safe = Clipper.inflatePaths(
    [clipperPath(outline, scale)],
    -DISK_RADIUS_MM * CLIPPER_SCALE,
    JoinType.Round,
    EndType.Polygon,
  )
  byScale.set(scale, safe)
  return safe
}

function balancedFeasibleTranslation(regions: Paths64, target: Pt): Pt | null {
  const targetPoint = {
    x: Math.round(target[0] * CLIPPER_SCALE),
    y: Math.round(target[1] * CLIPPER_SCALE),
  }
  let best: Pt | null = null
  let bestDistance2 = Infinity
  const outerRegions = regions.filter((path) => Clipper.isPositive(path))
  for (const path of outerRegions.length > 0 ? outerRegions : regions) {
    if (Clipper.pointInPolygon(targetPoint, path) !== PointInPolygonResult.IsOutside) {
      return [targetPoint.x / CLIPPER_SCALE, targetPoint.y / CLIPPER_SCALE]
    }
    for (let index = 0; index < path.length; index++) {
      const a = path[index]
      const b = path[(index + 1) % path.length]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const length2 = dx * dx + dy * dy
      const t = length2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((targetPoint.x - a.x) * dx + (targetPoint.y - a.y) * dy) / length2))
      const x = a.x + dx * t
      const y = a.y + dy * t
      const distance2 = (x - targetPoint.x) ** 2 + (y - targetPoint.y) ** 2
      if (distance2 >= bestDistance2) continue
      best = [x / CLIPPER_SCALE, y / CLIPPER_SCALE]
      bestDistance2 = distance2
    }
  }
  return best
}

function feasibleTranslation(
  outline: ReadonlyArray<Pt>,
  scale: number,
  localSeats: ReadonlyArray<Pt>,
  rotation: number,
): Pt | null {
  const safe = safeRegions(outline, scale)
  if (safe.length === 0) return null
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  let feasible = safe
  for (const [x, y] of localSeats) {
    const seatX = Math.round((x * cosine - y * sine) * CLIPPER_SCALE)
    const seatY = Math.round((x * sine + y * cosine) * CLIPPER_SCALE)
    feasible = Clipper.intersect(
      feasible,
      Clipper.translatePaths(safe, -seatX, -seatY),
      FillRule.NonZero,
    )
    if (feasible.length === 0) return null
  }
  return balancedFeasibleTranslation(feasible, targetTranslation(outline, scale, localSeats, rotation))
}

function targetTranslation(
  outline: ReadonlyArray<Pt>,
  scale: number,
  localSeats: ReadonlyArray<Pt>,
  rotation: number,
): Pt {
  const materialCentre = polygonCentroid(outline)
  const localCentre = pointMean(localSeats)
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  const rotatedCentre: Pt = [
    localCentre[0] * cosine - localCentre[1] * sine,
    localCentre[0] * sine + localCentre[1] * cosine,
  ]
  return [materialCentre[0] * scale - rotatedCentre[0], materialCentre[1] * scale - rotatedCentre[1]]
}

function rotationAngles(allowRotation: boolean) {
  if (!allowRotation) return [0]
  const angles: number[] = []
  for (let step = -9; step <= 9; step++) {
    const angle = Math.max(-MAX_ROTATION_RAD, Math.min(MAX_ROTATION_RAD, step * ROTATION_STEP_RAD))
    angles.push(Math.abs(angle) < 1e-9 ? 0 : angle)
  }
  return angles
}

function nearestTransform(
  outline: ReadonlyArray<Pt>,
  scale: number,
  localSeats: ReadonlyArray<Pt>,
  allowRotation: boolean,
): { transform: GridTransform; centreShiftMM: number } | null {
  let best: { transform: GridTransform; centreShiftMM: number } | null = null
  for (const rotation of rotationAngles(allowRotation)) {
    const translation = feasibleTranslation(outline, scale, localSeats, rotation)
    if (!translation) continue
    const target = targetTranslation(outline, scale, localSeats, rotation)
    const centreShiftMM = Math.hypot(translation[0] - target[0], translation[1] - target[1])
    if (best && centreShiftMM >= best.centreShiftMM) continue
    best = {
      transform: { x: translation[0], y: translation[1], rotation },
      centreShiftMM,
    }
  }
  return best
}

function centredTransform(
  outline: ReadonlyArray<Pt>,
  scale: number,
  localSeats: ReadonlyArray<Pt>,
  allowRotation: boolean,
): GridTransform | null {
  const candidate = nearestTransform(outline, scale, localSeats, allowRotation)
  if (!candidate || candidate.centreShiftMM > FIT_EPSILON_MM) return null
  const target = targetTranslation(outline, scale, localSeats, candidate.transform.rotation)
  return { x: target[0], y: target[1], rotation: candidate.transform.rotation }
}

function tightFit(outline: ReadonlyArray<Pt>, localSeats: ReadonlyArray<Pt>, allowRotation: boolean) {
  let centredScale = DISK_DIAMETER_MM
  let centredLower = 0
  let centred: GridTransform = { x: 0, y: 0, rotation: 0 }
  for (;;) {
    const candidate = centredTransform(outline, centredScale, localSeats, allowRotation)
    if (candidate) {
      centred = candidate
      break
    }
    centredLower = centredScale
    centredScale *= 1.25
    if (centredScale > 100_000) throw new Error('The rigid lattice group could not fit inside the uploaded shape')
  }

  let centredUpper = centredScale
  while (centredUpper - centredLower > FIT_EPSILON_MM) {
    const middle = (centredLower + centredUpper) / 2
    const candidate = centredTransform(outline, middle, localSeats, allowRotation)
    if (candidate) {
      centredUpper = middle
      centred = candidate
    } else {
      centredLower = middle
    }
  }
  centredScale = centredUpper

  let lower = 0
  let upper = centredScale
  let tightest = { scale: centredScale, transform: centred, centreShiftMM: 0 }
  while (upper - lower > FIT_EPSILON_MM) {
    const middle = (lower + upper) / 2
    const candidate = nearestTransform(outline, middle, localSeats, allowRotation)
    if (candidate) {
      upper = middle
      tightest = { scale: middle, ...candidate }
    } else {
      lower = middle
    }
  }

  const shiftIsWorthwhile = (scale: number, centreShiftMM: number) => (
    centreShiftMM <= MAX_CENTRE_SHIFT_MM + FIT_EPSILON_MM
    && 2 * centreShiftMM <= centredScale - scale + FIT_EPSILON_MM
  )
  if (shiftIsWorthwhile(tightest.scale, tightest.centreShiftMM)) {
    return { ...tightest, centredScale }
  }

  lower = tightest.scale
  upper = centredScale
  let balanced = { scale: centredScale, transform: centred, centreShiftMM: 0 }
  while (upper - lower > FIT_EPSILON_MM) {
    const middle = (lower + upper) / 2
    const candidate = nearestTransform(outline, middle, localSeats, allowRotation)
    if (!candidate || !shiftIsWorthwhile(middle, candidate.centreShiftMM)) {
      lower = middle
      continue
    }
    upper = middle
    balanced = { scale: middle, transform: candidate.transform, centreShiftMM: candidate.centreShiftMM }
  }
  return { ...balanced, centredScale }
}

export function prepareBag(normalizedOutline: ReadonlyArray<Pt>): PreparedBag {
  return { outline: normalizedOutline.map((point) => [...point] as Pt) }
}

export function fitClassifiedBag(prepared: PreparedBag, count: number, allowRotation = false): BagFit {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BAG_DISKS) {
    throw new Error(`Disk count must be between 1 and ${MAX_BAG_DISKS}`)
  }
  const classified = classifiedSeats(prepared, count, classifyBag(prepared))
  return fitPreparedSeats(prepared, classified.seats, classified.label, allowRotation)
}

function classifiedLayouts(prepared: PreparedBag, count: number): BagLayout[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BAG_DISKS) {
    throw new Error(`Disk count must be between 1 and ${MAX_BAG_DISKS}`)
  }
  const detected = classifyBag(prepared)
  const classes: BagShapeClass[] = [detected, 'Square', 'Portrait rectangle', 'Landscape rectangle']
  const layouts = classes.map((shapeClass) => classifiedSeats(prepared, count, shapeClass))
  if (count > 1) {
    layouts.push({ seats: latticeSeats(count, 2), label: 'Diagonal ↘ standard' })
    layouts.push({ seats: latticeSeats(count, 3), label: 'Diagonal ↗ standard' })
  }
  const seen = new Set<string>()
  return layouts
    .filter(({ seats }) => {
      const identity = seats.map(([x, y]) => `${x},${y}`).sort().join('|')
      if (seen.has(identity)) return false
      seen.add(identity)
      return true
    })
}

export function fitClassifiedOptions(prepared: PreparedBag, count: number, allowRotation = false): BagFit[] {
  return classifiedLayouts(prepared, count)
    .map(({ seats, label }) => fitPreparedSeats(prepared, seats, label, allowRotation))
}

export function fitBagOptions(prepared: PreparedBag, count: number, allowRotation = false): BagFit[] {
  return bagOptionLayouts(count)
    .map(({ seats, label }) => fitPreparedSeats(prepared, seats, label, allowRotation))
}

function bagOptionLayouts(count: number): BagLayout[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BAG_DISKS) {
    throw new Error(`Disk count must be between 1 and ${MAX_BAG_DISKS}`)
  }
  const options = count === 1 ? [0] : OPTION_AXES.map((_, index) => index)
  return options.map((optionIndex) => ({
    seats: latticeSeats(count, optionIndex),
    label: OPTION_AXES[optionIndex].label,
  }))
}

export function fitBagCount(prepared: PreparedBag, count: number): BagFit {
  return fitBagOptions(prepared, count)[0]
}

function compareBandFits(a: BagFit, b: BagFit): number {
  return a.uncoveredPeripheryMM - b.uncoveredPeripheryMM
    || b.contacts.length - a.contacts.length
    || a.centreShiftMM - b.centreShiftMM
    || a.seats.length - b.seats.length
    || a.sizeMM - b.sizeMM
    || a.option.localeCompare(b.option)
}

function bandForRequiredSize(sizeMM: number) {
  const requiredWholeMM = Math.ceil(sizeMM - FIT_EPSILON_MM)
  return BAG_BANDS.find(({ minMM, maxMM }) => requiredWholeMM >= minMM && requiredWholeMM <= maxMM)
}

function discoveryCouldReachBand(sizeMM: number, band: typeof BAG_BANDS[number]) {
  const requiredWholeMM = Math.ceil(sizeMM - FIT_EPSILON_MM)
  return requiredWholeMM >= band.minMM - LATTICE_PITCH_MM
    && requiredWholeMM <= band.maxMM + LATTICE_PITCH_MM
}

export function fitOptimalBagBands(
  prepared: PreparedBag,
  allowRotation = false,
  onProgress?: (completed: number, total: number) => void,
): BagBandResult[] {
  const byCount = new Map<number, Array<{ layout: BagLayout; fit: BagFit }>>()
  const exactByLayout = new Map<string, BagFit>()
  const discoveriesForCount = (count: number) => {
    const cached = byCount.get(count)
    if (cached) return cached
    const seenLayouts = new Set<string>()
    const layouts = [
      ...bagOptionLayouts(count),
      ...classifiedLayouts(prepared, count),
    ].filter(({ seats }) => {
      const identity = seats.map(([x, y]) => `${x},${y}`).sort().join('|')
      if (seenLayouts.has(identity)) return false
      seenLayouts.add(identity)
      return true
    })
    const discoveries = layouts.map((layout) => ({
      layout,
      fit: fitPreparedSeats(prepared, layout.seats, layout.label, allowRotation, discoveryFit),
    }))
    byCount.set(count, discoveries)
    return discoveries
  }

  const exactFit = (layout: BagLayout) => {
    const identity = layout.seats.map(([x, y]) => `${x},${y}`).sort().join('|')
    const cached = exactByLayout.get(identity)
    if (cached) return cached
    const fit = fitPreparedSeats(prepared, layout.seats, layout.label, allowRotation)
    exactByLayout.set(identity, fit)
    return fit
  }

  return BAG_BANDS.map((band, bandIndex) => {
    const seatsPerAxis = Math.floor((band.maxMM - DISK_DIAMETER_MM) / LATTICE_PITCH_MM) + 1
    const candidates: BagFit[] = []
    for (let count = 1; count <= seatsPerAxis ** 2; count++) {
      const atCount = discoveriesForCount(count)
        .filter(({ fit }) => discoveryCouldReachBand(fit.sizeMM, band))
      for (const { layout } of atCount) {
        const fit = exactFit(layout)
        if (bandForRequiredSize(fit.sizeMM)?.id === band.id) candidates.push(fit)
      }
    }
    const result = { ...band, candidates: candidates.sort(compareBandFits) }
    onProgress?.(bandIndex + 1, BAG_BANDS.length)
    return result
  })
}
