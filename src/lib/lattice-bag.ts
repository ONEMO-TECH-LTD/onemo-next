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
import type { Pt } from './effect/types'

export const LATTICE_PITCH_MM = 48
export const DISK_DIAMETER_MM = 24
export const MAX_BAG_DISKS = 1000

const DISK_RADIUS_MM = DISK_DIAMETER_MM / 2
const FIT_EPSILON_MM = 0.001
const CLIPPER_SCALE = 1000
const MAX_ROTATION_RAD = Math.PI / 4
const ROTATION_STEP_RAD = 5 * Math.PI / 180

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
  contacts: BagContact[]
  option: string
  rotation: number
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
): BagFit {
  const fit = tightFit(prepared.outline, localSeats, allowRotation)
  const outline = scaledOutline(prepared.outline, fit.scale)
  const seats = localSeats.map((seat) => transformSeat(seat, fit.transform))
  const nearest = seats.map((disk) => {
    const hit = nearestBoundary(disk, outline)
    return { disk, outline: hit.point, clearanceMM: hit.distance - DISK_RADIUS_MM }
  })
  const minimum = Math.min(...nearest.map((contact) => Math.abs(contact.clearanceMM)))
  return {
    seats,
    outline,
    centre: pointMean(seats),
    materialCentre: polygonCentroid(outline),
    sizeMM: fit.scale,
    contacts: nearest.filter((contact) => Math.abs(contact.clearanceMM) <= minimum + 0.05),
    option,
    rotation: fit.transform.rotation,
  }
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
  const safe = Clipper.inflatePaths(
    [clipperPath(outline, scale)],
    -DISK_RADIUS_MM * CLIPPER_SCALE,
    JoinType.Round,
    EndType.Polygon,
  )
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

function centredTransform(
  outline: ReadonlyArray<Pt>,
  scale: number,
  localSeats: ReadonlyArray<Pt>,
  allowRotation: boolean,
): GridTransform | null {
  for (const rotation of rotationAngles(allowRotation)) {
    const target = targetTranslation(outline, scale, localSeats, rotation)
    const translation = feasibleTranslation(outline, scale, localSeats, rotation)
    if (!translation) continue
    if (Math.hypot(translation[0] - target[0], translation[1] - target[1]) > FIT_EPSILON_MM) continue
    return { x: target[0], y: target[1], rotation }
  }
  return null
}

function tightFit(outline: ReadonlyArray<Pt>, localSeats: ReadonlyArray<Pt>, allowRotation: boolean) {
  let upper = DISK_DIAMETER_MM
  let best: GridTransform = { x: 0, y: 0, rotation: 0 }
  for (;;) {
    const candidate = centredTransform(outline, upper, localSeats, allowRotation)
    if (candidate) {
      best = candidate
      break
    }
    upper *= 1.25
    if (upper > 100_000) throw new Error('The rigid lattice group could not fit inside the uploaded shape')
  }
  let lower = 0
  while (upper - lower > FIT_EPSILON_MM) {
    const middle = (lower + upper) / 2
    const candidate = centredTransform(outline, middle, localSeats, allowRotation)
    if (candidate) {
      upper = middle
      best = candidate
    } else {
      lower = middle
    }
  }
  return { scale: upper, transform: best }
}

export function prepareBag(normalizedOutline: ReadonlyArray<Pt>): PreparedBag {
  return { outline: normalizedOutline.map((point) => [...point] as Pt) }
}

function fitBagOption(prepared: PreparedBag, count: number, optionIndex: number, allowRotation: boolean): BagFit {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BAG_DISKS) {
    throw new Error(`Disk count must be between 1 and ${MAX_BAG_DISKS}`)
  }
  const localSeats = latticeSeats(count, optionIndex)
  const fit = tightFit(prepared.outline, localSeats, allowRotation)
  const outline = scaledOutline(prepared.outline, fit.scale)
  const seats = localSeats.map((seat) => transformSeat(seat, fit.transform))
  const nearest = seats.map((disk) => {
    const hit = nearestBoundary(disk, outline)
    return { disk, outline: hit.point, clearanceMM: hit.distance - DISK_RADIUS_MM }
  })
  const minimum = Math.min(...nearest.map((contact) => Math.abs(contact.clearanceMM)))
  return {
    seats,
    outline,
    centre: pointMean(seats),
    materialCentre: polygonCentroid(outline),
    sizeMM: fit.scale,
    contacts: nearest.filter((contact) => Math.abs(contact.clearanceMM) <= minimum + 0.05),
    option: OPTION_AXES[optionIndex].label,
    rotation: fit.transform.rotation,
  }
}

export function fitClassifiedBag(prepared: PreparedBag, count: number, allowRotation = false): BagFit {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BAG_DISKS) {
    throw new Error(`Disk count must be between 1 and ${MAX_BAG_DISKS}`)
  }
  const classified = classifiedSeats(prepared, count, classifyBag(prepared))
  return fitPreparedSeats(prepared, classified.seats, classified.label, allowRotation)
}

export function fitClassifiedOptions(prepared: PreparedBag, count: number, allowRotation = false): BagFit[] {
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
    .map(({ seats, label }) => fitPreparedSeats(prepared, seats, label, allowRotation))
}

export function fitBagOptions(prepared: PreparedBag, count: number, allowRotation = false): BagFit[] {
  const options = count === 1 ? [0] : OPTION_AXES.map((_, index) => index)
  return options.map((optionIndex) => fitBagOption(prepared, count, optionIndex, allowRotation))
}

export function fitBagCount(prepared: PreparedBag, count: number): BagFit {
  return fitBagOptions(prepared, count)[0]
}
