import { pointInPolygon } from './effect/polygon'
import type { Pt } from './effect/types'

export const LATTICE_PITCH_MM = 48
export const DISK_DIAMETER_MM = 24
export const MAX_BAG_DISKS = 1000

const DISK_RADIUS_MM = DISK_DIAMETER_MM / 2
const FIT_EPSILON_MM = 0.001
const OPTIMIZER_STEPS = 120

export interface BagContact {
  disk: Pt
  outline: Pt
  clearanceMM: number
}

export interface PreparedBag {
  outline: Pt[]
}

export interface BagFit {
  seats: Pt[]
  outline: Pt[]
  centre: Pt
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

function settleGrid(
  outline: ReadonlyArray<Pt>,
  localSeats: ReadonlyArray<Pt>,
  seed: GridTransform,
  allowRotation: boolean,
) {
  const transform = { ...seed }
  for (let iteration = 0; iteration < OPTIMIZER_STEPS; iteration++) {
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

function tightFit(outline: ReadonlyArray<Pt>, localSeats: ReadonlyArray<Pt>, allowRotation: boolean) {
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
  for (let iteration = 0; iteration < 34; iteration++) {
    const middle = (lower + upper) / 2
    const settled = settleGrid(scaledOutline(outline, middle), localSeats, best, allowRotation)
    if (settled) {
      upper = middle
      best = settled
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
    centre: [fit.transform.x, fit.transform.y],
    sizeMM: fit.scale,
    contacts: nearest.filter((contact) => Math.abs(contact.clearanceMM) <= minimum + 0.05),
    option: OPTION_AXES[optionIndex].label,
    rotation: fit.transform.rotation,
  }
}

export function fitBagOptions(prepared: PreparedBag, count: number, allowRotation = false): BagFit[] {
  const options = count === 1 ? [0] : OPTION_AXES.map((_, index) => index)
  return options.map((optionIndex) => fitBagOption(prepared, count, optionIndex, allowRotation))
}

export function fitBagCount(prepared: PreparedBag, count: number): BagFit {
  return fitBagOptions(prepared, count)[0]
}
