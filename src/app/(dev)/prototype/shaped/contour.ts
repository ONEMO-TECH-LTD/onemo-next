import type { BinaryMask } from './shape-spec'

export interface Point2 {
  x: number
  y: number
}

type Segment = [Point2, Point2]

function key(point: Point2) {
  return `${Math.round(point.x * 2)}:${Math.round(point.y * 2)}`
}

function polygonArea(points: Point2[]) {
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  return area * 0.5
}

function distancePointToSegment(point: Point2, start: Point2, end: Point2) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  const x = start.x + t * dx
  const y = start.y + t * dy
  return Math.hypot(point.x - x, point.y - y)
}

export function simplifyRdp(points: Point2[], epsilon: number): Point2[] {
  if (points.length < 4) return points

  const closed = points[0].x === points[points.length - 1].x && points[0].y === points[points.length - 1].y
  const source = closed ? points.slice(0, -1) : points

  const simplifyOpen = (items: Point2[]): Point2[] => {
    if (items.length <= 2) return items
    let maxDistance = 0
    let maxIndex = 0
    for (let i = 1; i < items.length - 1; i += 1) {
      const distance = distancePointToSegment(items[i], items[0], items[items.length - 1])
      if (distance > maxDistance) {
        maxDistance = distance
        maxIndex = i
      }
    }

    if (maxDistance <= epsilon) {
      return [items[0], items[items.length - 1]]
    }

    const left = simplifyOpen(items.slice(0, maxIndex + 1))
    const right = simplifyOpen(items.slice(maxIndex))
    return left.slice(0, -1).concat(right)
  }

  const simplified = simplifyOpen(source.concat(source[0])).slice(0, -1)
  return simplified.length >= 3 ? simplified : source
}

export function chaikinSmooth(points: Point2[], iterations: number) {
  let current = points
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next: Point2[] = []
    for (let i = 0; i < current.length; i += 1) {
      const a = current[i]
      const b = current[(i + 1) % current.length]
      next.push({
        x: a.x * 0.75 + b.x * 0.25,
        y: a.y * 0.75 + b.y * 0.25,
      })
      next.push({
        x: a.x * 0.25 + b.x * 0.75,
        y: a.y * 0.25 + b.y * 0.75,
      })
    }
    current = next
  }
  return current
}

export function extractOuterContour(mask: BinaryMask) {
  const segments: Segment[] = []
  const edgePoint = (x: number, y: number, edge: 'top' | 'right' | 'bottom' | 'left'): Point2 => {
    switch (edge) {
      case 'top':
        return { x: x + 0.5, y }
      case 'right':
        return { x: x + 1, y: y + 0.5 }
      case 'bottom':
        return { x: x + 0.5, y: y + 1 }
      case 'left':
        return { x, y: y + 0.5 }
    }
  }

  for (let y = 0; y < mask.height - 1; y += 1) {
    for (let x = 0; x < mask.width - 1; x += 1) {
      const tl = mask.data[y * mask.width + x] > 127
      const tr = mask.data[y * mask.width + x + 1] > 127
      const br = mask.data[(y + 1) * mask.width + x + 1] > 127
      const bl = mask.data[(y + 1) * mask.width + x] > 127
      const crossings: Point2[] = []

      if (tl !== tr) crossings.push(edgePoint(x, y, 'top'))
      if (tr !== br) crossings.push(edgePoint(x, y, 'right'))
      if (br !== bl) crossings.push(edgePoint(x, y, 'bottom'))
      if (bl !== tl) crossings.push(edgePoint(x, y, 'left'))

      if (crossings.length === 2) {
        segments.push([crossings[0], crossings[1]])
      } else if (crossings.length === 4) {
        segments.push([crossings[0], crossings[3]])
        segments.push([crossings[1], crossings[2]])
      }
    }
  }

  const adjacency = new Map<string, Point2[]>()
  segments.forEach(([a, b]) => {
    const ak = key(a)
    const bk = key(b)
    adjacency.set(ak, [...(adjacency.get(ak) ?? []), b])
    adjacency.set(bk, [...(adjacency.get(bk) ?? []), a])
  })

  const visited = new Set<string>()
  const loops: Point2[][] = []

  segments.forEach(([start]) => {
    const startKey = key(start)
    if (visited.has(startKey)) return
    const loop: Point2[] = []
    let current = start
    let previousKey = ''

    for (let guard = 0; guard < segments.length * 2; guard += 1) {
      const currentKey = key(current)
      if (visited.has(currentKey) && currentKey === startKey && loop.length > 2) break
      visited.add(currentKey)
      loop.push(current)
      const nextCandidates = adjacency.get(currentKey) ?? []
      const next = nextCandidates.find((candidate) => key(candidate) !== previousKey) ?? nextCandidates[0]
      if (!next) break
      previousKey = currentKey
      current = next
      if (key(current) === startKey) break
    }

    if (loop.length >= 3) {
      loops.push(loop)
    }
  })

  if (loops.length === 0) {
    return []
  }

  const largest = loops.reduce((best, next) => {
    return Math.abs(polygonArea(next)) > Math.abs(polygonArea(best)) ? next : best
  })

  const smoothed = chaikinSmooth(largest, 2)
  const simplified = simplifyRdp(smoothed, 1.25)

  return polygonArea(simplified) < 0 ? simplified.reverse() : simplified
}

export function contourBounds(contour: Point2[]) {
  return contour.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  )
}
