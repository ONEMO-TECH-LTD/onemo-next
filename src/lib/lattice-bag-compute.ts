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
import { exactPerimeterCoverage } from './effect/grid-core'
import type { Pt } from './effect/types'
import {
  BAG_SOLVER_SPEC,
  DISK_DIAMETER_MM,
  DISK_RADIUS_MM,
  LATTICE_PITCH_MM,
  MAX_BAG_DISKS,
  type BagContact,
  type BagFit,
  type BagLayout,
  type BagShapeClass,
  type BagView,
  type GridTransform,
  type PreparedBag,
} from './lattice-bag-spec'

const SAFE_REGION_CACHE = new WeakMap<ReadonlyArray<Pt>, Map<number, Paths64>>()

export function polygonCentroid(ring: ReadonlyArray<Pt>): Pt {
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
  const bounds = outlineBounds(ring)
  let best = pointInPolygon(centroid, ring)
    ? { point: centroid, clearance: nearestBoundary(centroid, ring).distance }
    : { point: ring[0], clearance: -Infinity }
  for (let iy = 0; iy <= BAG_SOLVER_SPEC.coreSampleSteps; iy++) {
    for (let ix = 0; ix <= BAG_SOLVER_SPEC.coreSampleSteps; ix++) {
      const point: Pt = [
        bounds.minX + bounds.width * ix / BAG_SOLVER_SPEC.coreSampleSteps,
        bounds.minY + bounds.height * iy / BAG_SOLVER_SPEC.coreSampleSteps,
      ]
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
  const bounds = outlineBounds(ring)
  const longest = Math.max(bounds.width, bounds.height)
  if (!(longest > 0)) throw new Error('The uploaded shape has no area')
  const scaled = ring.map(([x, y]) => [x / longest, y / longest] as Pt)
  const core = interiorCore(scaled)
  return scaled.map(([x, y]) => [x - core[0], y - core[1]])
}

export function prepareBag(normalizedOutline: ReadonlyArray<Pt>): PreparedBag {
  return { outline: normalizedOutline.map((point) => [...point] as Pt) }
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
    const axisFirst = axis.distance(a) - axis.distance(b)
    if (axisFirst !== 0) return axisFirst
    const distance = a[0] ** 2 + a[1] ** 2 - b[0] ** 2 - b[1] ** 2
    if (distance !== 0) return distance
    if (a[1] !== b[1]) return a[1] - b[1]
    return a[0] - b[0]
  })
  return seats.slice(0, count).map(([x, y]) => [x * LATTICE_PITCH_MM, y * LATTICE_PITCH_MM])
}

export function outlineBounds(outline: ReadonlyArray<Pt>) {
  const xs = outline.map(([x]) => x)
  const ys = outline.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
}

export function measureBagView(fit: BagFit): BagView {
  const raw = outlineBounds([...fit.outline, ...fit.seats])
  const bounds = {
    minX: raw.minX - BAG_SOLVER_SPEC.viewPaddingMM,
    minY: raw.minY - BAG_SOLVER_SPEC.viewPaddingMM,
    width: raw.width + 2 * BAG_SOLVER_SPEC.viewPaddingMM,
    height: raw.height + 2 * BAG_SOLVER_SPEC.viewPaddingMM,
  }
  const gridRadius = Math.ceil(Math.max(bounds.width, bounds.height) / LATTICE_PITCH_MM) + 2
  const gridAxis = Array.from(
    { length: gridRadius * 2 + 1 },
    (_, index) => (index - gridRadius) * LATTICE_PITCH_MM,
  )
  const latticeOrigin = fit.seats[0] ?? fit.centre
  const cosine = Math.cos(fit.rotation)
  const sine = Math.sin(fit.rotation)
  const ghostSeats: BagView['ghostSeats'] = []
  for (let y = -gridRadius; y <= gridRadius; y++) {
    for (let x = -gridRadius; x <= gridRadius; x++) {
      const localX = x * LATTICE_PITCH_MM
      const localY = y * LATTICE_PITCH_MM
      const point: Pt = [
        latticeOrigin[0] + localX * cosine - localY * sine,
        latticeOrigin[1] + localX * sine + localY * cosine,
      ]
      if (
        point[0] < bounds.minX || point[0] > bounds.minX + bounds.width
        || point[1] < bounds.minY || point[1] > bounds.minY + bounds.height
      ) continue
      ghostSeats.push({ point, inside: pointInPolygon(point, fit.outline) })
    }
  }
  return { bounds, gridAxis, gridRadius, latticeOrigin, ghostSeats }
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
  if (diamondError < BAG_SOLVER_SPEC.diamondErrorMax) return 'Diamond'
  if (ellipseError < BAG_SOLVER_SPEC.ovalErrorMax) return 'Circle / oval'
  const aspect = bounds.width / bounds.height
  if (aspect < BAG_SOLVER_SPEC.portraitAspectMax) return 'Portrait rectangle'
  if (aspect > BAG_SOLVER_SPEC.landscapeAspectMin) return 'Landscape rectangle'
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

function classifiedSeats(prepared: PreparedBag, count: number, shapeClass: BagShapeClass): BagLayout {
  const bounds = outlineBounds(prepared.outline)
  const measuredAspect = bounds.width / bounds.height
  const targetAspect = shapeClass === 'Portrait rectangle'
    ? Math.min(measuredAspect, BAG_SOLVER_SPEC.classifiedRectangleAspect)
    : shapeClass === 'Landscape rectangle'
      ? Math.max(measuredAspect, 1 / BAG_SOLVER_SPEC.classifiedRectangleAspect)
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
  if (!best || (!rectangularClass && fallbackError + BAG_SOLVER_SPEC.classifiedFallbackBias < best.error)) {
    return { seats: fallback, label: `${shapeClass} standard` }
  }
  return {
    seats: rectangularSeats(count, best.columns, best.rows),
    label: `${shapeClass} · ${best.columns}×${best.rows}`,
  }
}

function assertCount(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BAG_DISKS) {
    throw new Error(`Disk count must be between 1 and ${MAX_BAG_DISKS}`)
  }
}

export function bagOptionLayouts(count: number): BagLayout[] {
  assertCount(count)
  const options = count === 1 ? [0] : OPTION_AXES.map((_, index) => index)
  return options.map((optionIndex) => ({ seats: latticeSeats(count, optionIndex), label: OPTION_AXES[optionIndex].label }))
}

export function classifiedLayouts(prepared: PreparedBag, count: number): BagLayout[] {
  assertCount(count)
  const detected = classifyBag(prepared)
  const classes: BagShapeClass[] = [detected, 'Square', 'Portrait rectangle', 'Landscape rectangle']
  const layouts = classes.map((shapeClass) => classifiedSeats(prepared, count, shapeClass))
  if (count > 1) {
    layouts.push({ seats: latticeSeats(count, 2), label: 'Diagonal ↘ standard' })
    layouts.push({ seats: latticeSeats(count, 3), label: 'Diagonal ↗ standard' })
  }
  const seen = new Set<string>()
  return layouts.filter(({ seats }) => {
    const identity = layoutIdentity(seats)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

export function layoutIdentity(seats: ReadonlyArray<Pt>) {
  return seats.map(([x, y]) => `${x},${y}`).sort().join('|')
}

function transformSeat([x, y]: Pt, transform: GridTransform): Pt {
  const cosine = Math.cos(transform.rotation)
  const sine = Math.sin(transform.rotation)
  return [transform.x + x * cosine - y * sine, transform.y + x * sine + y * cosine]
}

function scaledOutline(outline: ReadonlyArray<Pt>, scale: number) {
  return outline.map(([x, y]) => [x * scale, y * scale] as Pt)
}

function clipperPath(outline: ReadonlyArray<Pt>, scale: number): Path64 {
  const path = outline.map(([x, y]) => ({
    x: Math.round(x * scale * BAG_SOLVER_SPEC.clipperScale),
    y: Math.round(y * scale * BAG_SOLVER_SPEC.clipperScale),
  }))
  return Clipper.isPositive(path) ? path : path.reverse()
}

function safeRegions(outline: ReadonlyArray<Pt>, scale: number): Paths64 {
  let byScale = SAFE_REGION_CACHE.get(outline)
  if (!byScale) {
    byScale = new Map()
    SAFE_REGION_CACHE.set(outline, byScale)
  }
  const cacheKey = Math.round(scale / BAG_SOLVER_SPEC.fitEpsilonMM)
  const cached = byScale.get(cacheKey)
  if (cached) return cached
  const safe = Clipper.inflatePaths(
    [clipperPath(outline, scale)],
    -DISK_RADIUS_MM * BAG_SOLVER_SPEC.clipperScale,
    JoinType.Round,
    EndType.Polygon,
  )
  byScale.set(cacheKey, safe)
  return safe
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

function feasibleRegion(
  outline: ReadonlyArray<Pt>,
  scale: number,
  localSeats: ReadonlyArray<Pt>,
  rotation: number,
): Paths64 {
  const safe = safeRegions(outline, scale)
  if (safe.length === 0) return []
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  let feasible = safe
  for (const [x, y] of localSeats) {
    const seatX = Math.round((x * cosine - y * sine) * BAG_SOLVER_SPEC.clipperScale)
    const seatY = Math.round((x * sine + y * cosine) * BAG_SOLVER_SPEC.clipperScale)
    feasible = Clipper.intersect(feasible, Clipper.translatePaths(safe, -seatX, -seatY), FillRule.NonZero)
    if (feasible.length === 0) return []
  }
  return feasible
}

function candidateTranslations(regions: Paths64, target: Pt): Pt[] {
  const scale = BAG_SOLVER_SPEC.clipperScale
  const targetPoint = { x: Math.round(target[0] * scale), y: Math.round(target[1] * scale) }
  const points: Pt[] = []
  const paths = regions.filter((path) => Clipper.isPositive(path))
  for (const path of paths.length > 0 ? paths : regions) {
    if (Clipper.pointInPolygon(targetPoint, path) !== PointInPolygonResult.IsOutside) points.push(target)
    for (let index = 0; index < path.length; index++) {
      const a = path[index]
      const b = path[(index + 1) % path.length]
      points.push([a.x / scale, a.y / scale])
      const dx = b.x - a.x
      const dy = b.y - a.y
      const length2 = dx * dx + dy * dy
      const t = length2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((targetPoint.x - a.x) * dx + (targetPoint.y - a.y) * dy) / length2))
      points.push([(a.x + dx * t) / scale, (a.y + dy * t) / scale])
    }
  }
  const unique = new Map<string, Pt>()
  for (const point of points) unique.set(`${point[0].toFixed(3)},${point[1].toFixed(3)}`, point)
  return [...unique.values()]
}

function rotationAngles(allowRotation: boolean) {
  if (!allowRotation) return [0]
  const angles: number[] = []
  const steps = Math.round(BAG_SOLVER_SPEC.maxRotationRad / BAG_SOLVER_SPEC.rotationStepRad)
  for (let step = -steps; step <= steps; step++) {
    const angle = Math.max(
      -BAG_SOLVER_SPEC.maxRotationRad,
      Math.min(BAG_SOLVER_SPEC.maxRotationRad, step * BAG_SOLVER_SPEC.rotationStepRad),
    )
    angles.push(Math.abs(angle) < 1e-9 ? 0 : angle)
  }
  return angles
}

function hasFeasibleTransform(
  outline: ReadonlyArray<Pt>,
  scale: number,
  localSeats: ReadonlyArray<Pt>,
  allowRotation: boolean,
) {
  return rotationAngles(allowRotation).some((rotation) => feasibleRegion(outline, scale, localSeats, rotation).length > 0)
}

function measureContacts(seats: ReadonlyArray<Pt>, outline: ReadonlyArray<Pt>): BagContact[] {
  const contacts: BagContact[] = []
  const seen = new Set<string>()
  for (const disk of seats) {
    const inside = pointInPolygon(disk, outline)
    for (let index = 0; index < outline.length; index++) {
      const hit = closestPointOnSegment(disk, outline[index], outline[(index + 1) % outline.length])
      const clearanceMM = inside ? hit.distance - DISK_RADIUS_MM : -hit.distance - DISK_RADIUS_MM
      if (
        clearanceMM < -BAG_SOLVER_SPEC.contactToleranceMM
        || clearanceMM > BAG_SOLVER_SPEC.contactToleranceMM
      ) continue
      const key = `${disk[0].toFixed(3)},${disk[1].toFixed(3)}:${hit.point[0].toFixed(3)},${hit.point[1].toFixed(3)}`
      if (seen.has(key)) continue
      seen.add(key)
      const dx = disk[0] - hit.point[0]
      const dy = disk[1] - hit.point[1]
      const distance = Math.hypot(dx, dy) || 1
      contacts.push({
        disk,
        outline: hit.point,
        clearanceMM,
        inward: [dx / distance, dy / distance],
      })
    }
  }
  return contacts
}

function minimumClearance(seats: ReadonlyArray<Pt>, outline: ReadonlyArray<Pt>) {
  return Math.min(...seats.map((disk) => {
    const hit = nearestBoundary(disk, outline)
    return pointInPolygon(disk, outline)
      ? hit.distance - DISK_RADIUS_MM
      : -hit.distance - DISK_RADIUS_MM
  }))
}

function measuredFit(
  prepared: PreparedBag,
  localSeats: ReadonlyArray<Pt>,
  option: string,
  scale: number,
  transform: GridTransform,
): BagFit {
  const outline = scaledOutline(prepared.outline, scale)
  const seats = localSeats.map((seat) => transformSeat(seat, transform))
  const contacts = measureContacts(seats, outline)
  const centre = pointMean(seats)
  const materialCentre = polygonCentroid(outline)
  const periphery = exactPerimeterCoverage(
    { outer: { pts: outline }, holes: [] },
    seats,
    BAG_SOLVER_SPEC.peripheryReachMM,
    'standard',
    LATTICE_PITCH_MM,
  )
  return {
    seats,
    outline,
    centre,
    materialCentre,
    sizeMM: scale,
    centreShiftMM: Math.hypot(centre[0] - materialCentre[0], centre[1] - materialCentre[1]),
    minimumClearanceMM: minimumClearance(seats, outline),
    contacts,
    opposingContactPairs: 0,
    peripheryGaps: periphery.gaps,
    uncoveredPeripheryMM: periphery.uncoveredMM,
    option,
    rotation: transform.rotation,
  }
}

export function measureTightFits(
  prepared: PreparedBag,
  layout: BagLayout,
  allowRotation: boolean,
): BagFit[] {
  let upper = DISK_DIAMETER_MM
  let lower = 0
  while (!hasFeasibleTransform(prepared.outline, upper, layout.seats, allowRotation)) {
    lower = upper
    upper *= BAG_SOLVER_SPEC.solveGrowthFactor
    if (upper > BAG_SOLVER_SPEC.maximumSolveSizeMM) throw new Error('The rigid lattice group could not fit inside the uploaded shape')
  }
  while (upper - lower > BAG_SOLVER_SPEC.fitEpsilonMM) {
    const middle = (lower + upper) / 2
    if (hasFeasibleTransform(prepared.outline, middle, layout.seats, allowRotation)) upper = middle
    else lower = middle
  }

  // Keep the first feasible scale. Logic owns the configured tolerance for
  // the integer Clipper boundary; enlarging here destroys the opposing contact
  // that defines a snug wrap.
  const evaluationScale = upper
  const fits: BagFit[] = []
  for (const rotation of rotationAngles(allowRotation)) {
    const region = feasibleRegion(prepared.outline, evaluationScale, layout.seats, rotation)
    if (region.length === 0) continue
    const target = targetTranslation(prepared.outline, evaluationScale, layout.seats, rotation)
    for (const [x, y] of candidateTranslations(region, target)) {
      fits.push(measuredFit(prepared, layout.seats, layout.label, evaluationScale, { x, y, rotation }))
    }
  }
  return fits
}
