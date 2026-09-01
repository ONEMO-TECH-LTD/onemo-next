// units/protection.ts — post-delivery measurement only. It never enters GridConfig or the solver.

import { Clipper, FillRule, type Path64, type Paths64 } from '@countertype/clipper2-ts'
import type { Contour, MagnetPlan, Pt } from '../types'
import { bbox, pointInContour } from '../foundation/geometry'

const SCALE = 1000
const MAX_SPAN_MM = 96

export interface ProtectionEvidence {
  ringsMM: Pt[][]
  materialAreaMM2: number
  areaMM2: number
  percent: number
  patchCount: number
  boundaryMM: number
}

const pathOf = (points: ReadonlyArray<Pt>) => Clipper.makePath(points.flatMap(([x, y]) =>
  [Math.round(x * SCALE), Math.round(y * SCALE)]))

const areaMM2 = (paths: Paths64) => Math.abs(Number(Clipper.areaPaths(paths))) / (SCALE * SCALE)

function materialOf(contour: Contour): Paths64 {
  let material: Paths64 = [pathOf(contour.outer.pts)]
  if (contour.holes.length) material = Clipper.difference(
    material, contour.holes.map((hole) => pathOf(hole.pts)), FillRule.NonZero)
  return material
}

const keyOf = ([x, y]: Pt) => `${Math.round(x * SCALE)},${Math.round(y * SCALE)}`

function radiiOf(points: ReadonlyArray<Pt>, plan: MagnetPlan): number[] {
  if (plan === 'all8') return points.map(() => 4)
  if (plan === 'all6') return points.map(() => 3)
  const box = bbox(points)
  return points.map(([x, y]) => {
    const extremeX = Math.abs(x - box.minX) < 0.6 || Math.abs(x - box.maxX) < 0.6
    const extremeY = Math.abs(y - box.minY) < 0.6 || Math.abs(y - box.maxY) < 0.6
    return extremeX && extremeY ? 4 : 3
  })
}

function populationRim(points: ReadonlyArray<Pt>, pitchMM: number): Pt[] {
  const population = new Set(points.map(keyOf))
  const directions: Pt[] = [[pitchMM, 0], [-pitchMM, 0], [0, pitchMM], [0, -pitchMM]]
  return points.filter((point) => !directions.every(([dx, dy]) =>
    population.has(keyOf([point[0] + dx, point[1] + dy]))))
}

function ringPosition(point: Pt, ring: ReadonlyArray<Pt>): number {
  let travelled = 0, bestDistance = Infinity, bestPosition = 0
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index], b = ring[(index + 1) % ring.length]
    const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy
    const length = Math.sqrt(length2)
    const t = length2 <= 1e-12 ? 0 : Math.max(0, Math.min(1,
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2))
    const distance = Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy)
    if (distance < bestDistance) { bestDistance = distance; bestPosition = travelled + t * length }
    travelled += length
  }
  return bestPosition
}

const orient = (a: Pt, b: Pt, c: Pt) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
const onSegment = (a: Pt, b: Pt, p: Pt) => Math.abs(orient(a, b, p)) <= 1e-9
  && p[0] >= Math.min(a[0], b[0]) - 1e-9 && p[0] <= Math.max(a[0], b[0]) + 1e-9
  && p[1] >= Math.min(a[1], b[1]) - 1e-9 && p[1] <= Math.max(a[1], b[1]) + 1e-9
function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b)
  return o1 * o2 < -1e-9 && o3 * o4 < -1e-9
    || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)
}

function segmentInside(contour: Contour, a: Pt, b: Pt): boolean {
  if (!pointInContour([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], contour)) return false
  for (const ring of [contour.outer, ...contour.holes]) for (let index = 0; index < ring.pts.length; index++)
    if (segmentsCross(a, b, ring.pts[index], ring.pts[(index + 1) % ring.pts.length])) return false
  return true
}

type Span = { a: Pt; b: Pt; radiusMM: number }

function spansOf(
  contour: Contour, points: ReadonlyArray<Pt>, protectionRadii: ReadonlyArray<number>, pitchMM: number,
): Span[] {
  const pointIndex = new Map(points.map((point, index) => [keyOf(point), index]))
  const rim = populationRim(points, pitchMM)
    .map((point) => ({ point, position: ringPosition(point, contour.outer.pts) }))
    .sort((a, b) => a.position - b.position || a.point[0] - b.point[0] || a.point[1] - b.point[1])
  if (rim.length < 2) return []
  const spans: Span[] = [], pairCount = rim.length === 2 ? 1 : rim.length
  for (let index = 0; index < pairCount; index++) {
    const a = rim[index].point, b = rim[(index + 1) % rim.length].point
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (distance <= 1e-9 || distance > MAX_SPAN_MM + 0.05 || !segmentInside(contour, a, b)) continue
    spans.push({
      a, b,
      radiusMM: Math.min(protectionRadii[pointIndex.get(keyOf(a)) ?? 0], protectionRadii[pointIndex.get(keyOf(b)) ?? 0]),
    })
  }
  return spans
}

function spanPath({ a, b, radiusMM }: Span): Path64 {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy)
  const nx = -dy / length * radiusMM, ny = dx / length * radiusMM
  return pathOf([[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny],
    [b[0] + nx, b[1] + ny], [a[0] + nx, a[1] + ny]])
}

function heldOf(points: ReadonlyArray<Pt>, radii: ReadonlyArray<number>, spans: ReadonlyArray<Span>): Paths64 {
  const sides = 72
  const paths: Paths64 = points.map(([mx, my], index) => {
    const radius = radii[index] / Math.cos(Math.PI / sides)
    return Clipper.makePath(Array.from({ length: sides }, (_, side) => {
      const angle = side * Math.PI * 2 / sides
      return [Math.round((mx + Math.cos(angle) * radius) * SCALE),
        Math.round((my + Math.sin(angle) * radius) * SCALE)]
    }).flat())
  })
  paths.push(...spans.map(spanPath))
  return paths.length ? Clipper.union(paths, FillRule.NonZero) : []
}

function outerBoundaryUnheld(contour: Contour, held: Paths64): number {
  let unheld = 0
  const ring = contour.outer.pts
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index], b = ring[(index + 1) % ring.length]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (length <= 1e-9) continue
    // One-millimetre deterministic boundary integration. Display evidence only; solver never sees it.
    const steps = Math.max(1, Math.ceil(length))
    let missed = 0
    for (let step = 0; step < steps; step++) {
      const t = (step + 0.5) / steps
      const point = { x: Math.round((a[0] + (b[0] - a[0]) * t) * SCALE),
        y: Math.round((a[1] + (b[1] - a[1]) * t) * SCALE) }
      if (!held.some((path) => Clipper.pointInPolygon(point, path) !== 2)) missed++
    }
    unheld += length * missed / steps
  }
  return unheld
}

export function measureProtection(
  contour: Contour, points: ReadonlyArray<Pt>, pitchMM: number, edgePaddingMM: number, plan: MagnetPlan,
): ProtectionEvidence {
  const material = materialOf(contour)
  const physical = radiiOf(points, plan)
  const protectionRadii = physical.map((radius) => radius + edgePaddingMM)
  const spans = spansOf(contour, points, protectionRadii, pitchMM)
  const held = heldOf(points, protectionRadii, spans)
  const unsupported = held.length ? Clipper.difference(material, held, FillRule.NonZero) : material
  const materialAreaMM2 = areaMM2(material), unsupportedAreaMM2 = areaMM2(unsupported)
  return {
    ringsMM: unsupported.map((path) => path.map((point) =>
      [Number(point.x) / SCALE, Number(point.y) / SCALE] as Pt)),
    materialAreaMM2,
    areaMM2: unsupportedAreaMM2,
    percent: materialAreaMM2 ? unsupportedAreaMM2 / materialAreaMM2 * 100 : 0,
    patchCount: unsupported.filter((path) => Clipper.area(path) > 0).length,
    boundaryMM: outerBoundaryUnheld(contour, held),
  }
}
