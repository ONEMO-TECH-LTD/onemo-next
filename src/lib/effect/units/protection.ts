// units/protection.ts — diagnostic clone from 80eb3cd0. Measurement only; never imported by the solver.

import type { Contour, Pt } from '../types'
import { pointInContour } from '../foundation/geometry'
import { Clipper, FillRule, PointInPolygonResult, type Path64, type Paths64 } from '@countertype/clipper2-ts'

export interface UnsupportedPatch {
  areaMM2: number
  witnessMM: Pt | null
}
export interface UnsupportedBoundaryInterval {
  a: Pt
  b: Pt
  lengthMM: number
}

export interface UnprotectedEvidence {
  ringsMM: Pt[][]
  materialAreaMM2: number
  areaMM2: number
  percent: number
  patches: UnsupportedPatch[]
  outerBoundary: UnsupportedBoundaryInterval[]
  boundaryMM: number
  repairTargetMM: Pt | null
}

const HOLD_SCALE = 1000
const MAX_SUPPORT_SPAN_MM = 96

type SupportSpan = { a: Pt; b: Pt; radiusMM: number }

const pathOf = (points: ReadonlyArray<Pt>) => Clipper.makePath(points.flatMap(([x, y]) =>
  [Math.round(x * HOLD_SCALE), Math.round(y * HOLD_SCALE)]))

function materialPaths(contour: Contour): Paths64 {
  let material: Paths64 = [pathOf(contour.outer.pts)]
  if (contour.holes.length) material = Clipper.difference(
    material, contour.holes.map((hole) => pathOf(hole.pts)), FillRule.NonZero)
  return material
}

const pointKey = ([x, y]: Pt) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`

function populationRim(points: ReadonlyArray<Pt>, pitchMM: number): Pt[] {
  const population = new Set(points.map(pointKey))
  const directions: Pt[] = [[pitchMM, 0], [-pitchMM, 0], [0, pitchMM], [0, -pitchMM]]
  return points.filter((point) => !directions.every(([dx, dy]) =>
    population.has(pointKey([point[0] + dx, point[1] + dy]))))
}

function ringPositionMM(point: Pt, ring: ReadonlyArray<Pt>): number {
  let travelled = 0, bestDistance = Infinity, bestPosition = 0
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index], b = ring[(index + 1) % ring.length]
    const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy
    const length = Math.sqrt(length2)
    const t = length2 <= 1e-12 ? 0 : Math.max(0, Math.min(1,
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2))
    const distance = Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy))
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

function centreSegmentInside(contour: Contour, a: Pt, b: Pt): boolean {
  if (!pointInContour([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], contour)) return false
  for (const ring of [contour.outer, ...contour.holes]) for (let index = 0; index < ring.pts.length; index++)
    if (segmentsCross(a, b, ring.pts[index], ring.pts[(index + 1) % ring.pts.length])) return false
  return true
}

function supportSpans(
  contour: Contour, magnets: ReadonlyArray<Pt>, protectionRadii: ReadonlyArray<number>, pitchMM: number,
): SupportSpan[] {
  const indexOf = new Map(magnets.map((point, index) => [pointKey(point), index]))
  const rim = populationRim(magnets, pitchMM)
    .map((point) => ({ point, position: ringPositionMM(point, contour.outer.pts) }))
    .sort((a, b) => a.position - b.position || a.point[0] - b.point[0] || a.point[1] - b.point[1])
  if (rim.length < 2) return []
  const spans: SupportSpan[] = [], pairCount = rim.length === 2 ? 1 : rim.length
  for (let index = 0; index < pairCount; index++) {
    const a = rim[index].point, b = rim[(index + 1) % rim.length].point
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (distance <= 1e-9 || distance > MAX_SUPPORT_SPAN_MM + 0.05 || !centreSegmentInside(contour, a, b)) continue
    spans.push({
      a, b,
      radiusMM: Math.min(protectionRadii[indexOf.get(pointKey(a)) ?? 0] ?? 0,
        protectionRadii[indexOf.get(pointKey(b)) ?? 0] ?? 0),
    })
  }
  return spans
}

function spanPath({ a, b, radiusMM }: SupportSpan): Path64 {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy)
  const nx = -dy / length * radiusMM, ny = dx / length * radiusMM
  return pathOf([[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny],
    [b[0] + nx, b[1] + ny], [a[0] + nx, a[1] + ny]])
}

function heldPaths(
  magnets: ReadonlyArray<Pt>, protectionRadii: ReadonlyArray<number>, spans: ReadonlyArray<SupportSpan>,
): Paths64 {
  const sides = 72
  const paths: Paths64 = magnets.map(([mx, my], index) => {
    const radius = (protectionRadii[index] ?? 0) / Math.cos(Math.PI / sides)
    return Clipper.makePath(Array.from({ length: sides }, (_, side) => {
      const angle = side * Math.PI * 2 / sides
      return [Math.round((mx + Math.cos(angle) * radius) * HOLD_SCALE),
        Math.round((my + Math.sin(angle) * radius) * HOLD_SCALE)]
    }).flat())
  })
  paths.push(...spans.map(spanPath))
  return paths.length ? Clipper.union(paths, FillRule.NonZero) : []
}

function spanInterval(edgeA: Pt, edgeB: Pt, span: SupportSpan): [number, number] | null {
  const sx = span.b[0] - span.a[0], sy = span.b[1] - span.a[1], length = Math.hypot(sx, sy)
  const ux = sx / length, uy = sy / length
  const along = (point: Pt) => (point[0] - span.a[0]) * ux + (point[1] - span.a[1]) * uy
  const across = (point: Pt) => -(point[0] - span.a[0]) * uy + (point[1] - span.a[1]) * ux
  let lo = 0, hi = 1
  const clip = (v0: number, v1: number, min: number, max: number) => {
    const delta = v1 - v0
    if (Math.abs(delta) < 1e-12) return v0 >= min && v0 <= max
    const t0 = (min - v0) / delta, t1 = (max - v0) / delta
    lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1))
    return lo <= hi
  }
  return clip(along(edgeA), along(edgeB), 0, length)
    && clip(across(edgeA), across(edgeB), -span.radiusMM, span.radiusMM) ? [lo, hi] : null
}

/** Exact unsupported intervals on the manufactured outer boundary. */
function boundaryGaps(
  contour: Contour, magnets: ReadonlyArray<Pt>, protectionRadii: ReadonlyArray<number>, spans: ReadonlyArray<SupportSpan>,
): UnsupportedBoundaryInterval[] {
  const out: UnsupportedBoundaryInterval[] = []
  const ring = contour.outer
  for (let i = 0; i < ring.pts.length; i++) {
    const a = ring.pts[i], b = ring.pts[(i + 1) % ring.pts.length]
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy)
    if (length < 1e-9) continue
    const covered: Array<[number, number]> = []
    for (let magnetIndex = 0; magnetIndex < magnets.length; magnetIndex++) {
      const [mx, my] = magnets[magnetIndex], protectionRadius = protectionRadii[magnetIndex] ?? 0
      const ux = dx / length, uy = dy / length
      const along = (mx - a[0]) * ux + (my - a[1]) * uy
      const across2 = (mx - (a[0] + along * ux)) ** 2 + (my - (a[1] + along * uy)) ** 2
      const reach2 = protectionRadius ** 2 - across2
      if (reach2 < 0) continue
      const reach = Math.sqrt(reach2)
      const lo = Math.max(0, along - reach), hi = Math.min(length, along + reach)
      if (hi > lo) covered.push([lo, hi])
    }
    for (const span of spans) {
      const interval = spanInterval(a, b, span)
      if (interval) covered.push([interval[0] * length, interval[1] * length])
    }
    covered.sort((x, y) => x[0] - y[0])
    let at = 0
    const add = (lo: number, hi: number) => {
      if (hi <= lo + 1e-7) return
      out.push({
        a: [a[0] + dx * lo / length, a[1] + dy * lo / length],
        b: [a[0] + dx * hi / length, a[1] + dy * hi / length],
        lengthMM: hi - lo,
      })
    }
    for (const [lo, hi] of covered) {
      add(at, lo)
      at = Math.max(at, hi)
    }
    add(at, length)
  }
  return out
}

const pathsAreaMM2 = (paths: Paths64): number =>
  Math.abs(Number(Clipper.areaPaths(paths))) / (HOLD_SCALE * HOLD_SCALE)

const ringsOf = (paths: Paths64): Pt[][] => paths.map((path) =>
  path.map((point) => [Number(point.x) / HOLD_SCALE, Number(point.y) / HOLD_SCALE] as Pt))

function pointRelation(path: Path64, point: Pt): PointInPolygonResult {
  return Clipper.pointInPolygon(
    { x: Math.round(point[0] * HOLD_SCALE), y: Math.round(point[1] * HOLD_SCALE) }, path)
}

function scanIntervals(path: Path64, y: number): Array<[number, number]> {
  const ring = ringsOf([path])[0]
  const intersections: number[] = []
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index], b = ring[(index + 1) % ring.length]
    if (!((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))) continue
    intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
  }
  intersections.sort((a, b) => a - b)
  const intervals: Array<[number, number]> = []
  for (let index = 0; index + 1 < intersections.length; index += 2)
    if (intersections[index + 1] > intersections[index])
      intervals.push([intersections[index], intersections[index + 1]])
  return intervals
}

function interiorWitness(path: Path64, holes: ReadonlyArray<Path64>): Pt | null {
  const accepts = (point: Pt) => pointRelation(path, point) === PointInPolygonResult.IsInside
    && holes.every((hole) => pointRelation(hole, point) === PointInPolygonResult.IsOutside)
  const ys = [...new Set([path, ...holes].flatMap((ring) =>
    ringsOf([ring])[0].map((point) => point[1])))].sort((a, b) => a - b)
  let best: { point: Pt; width: number } | null = null
  for (let index = 0; index + 1 < ys.length; index++) {
    const y = (ys[index] + ys[index + 1]) / 2
    let open = scanIntervals(path, y)
    for (const hole of holes) for (const [holeLo, holeHi] of scanIntervals(hole, y)) {
      const next: Array<[number, number]> = []
      for (const [lo, hi] of open) {
        if (holeHi <= lo || holeLo >= hi) next.push([lo, hi])
        else {
          if (holeLo > lo) next.push([lo, Math.min(holeLo, hi)])
          if (holeHi < hi) next.push([Math.max(holeHi, lo), hi])
        }
      }
      open = next
    }
    for (const [lo, hi] of open) {
      const point: Pt = [(lo + hi) / 2, y]
      if (hi > lo && accepts(point) && (!best || hi - lo > best.width)) best = { point, width: hi - lo }
    }
  }
  return best?.point ?? null
}

function patchesOf(paths: Paths64): UnsupportedPatch[] {
  const outers = paths.filter((path) => Clipper.area(path) > 0)
  const holes = paths.filter((path) => Clipper.area(path) < 0)
  return outers.flatMap((path) => {
    const ownedHoles = holes.filter((hole) => ringsOf([hole])[0]
      .some((point) => pointRelation(path, point) !== PointInPolygonResult.IsOutside))
    const witnessMM = interiorWitness(path, ownedHoles)
    const holesArea = ownedHoles.reduce((sum, hole) =>
      sum + Math.abs(Number(Clipper.area(hole))) / (HOLD_SCALE * HOLD_SCALE), 0)
    return [{
      areaMM2: Number(Clipper.area(path)) / (HOLD_SCALE * HOLD_SCALE) - holesArea,
      witnessMM,
    }]
  }).sort((a, b) => b.areaMM2 - a.areaMM2)
}

export function measureProtection(
  contour: Contour, magnets: ReadonlyArray<Pt>, pitchMM = 48, edgePaddingMM = 24,
  magnetRadiiMM: ReadonlyArray<number> = magnets.map(() => 3),
): UnprotectedEvidence {
  const protectionRadii = magnets.map((_, index) => edgePaddingMM + (magnetRadiiMM[index] ?? 3))
  const spans = supportSpans(contour, magnets, protectionRadii, pitchMM)
  const material = materialPaths(contour)
  const heldUnion = heldPaths(magnets, protectionRadii, spans)
  const unsupported = heldUnion.length ? Clipper.difference(material, heldUnion, FillRule.NonZero) : material
  const gaps = boundaryGaps(contour, magnets, protectionRadii, spans)
  const materialAreaMM2 = pathsAreaMM2(material), areaMM2 = pathsAreaMM2(unsupported)
  const targetGap = [...gaps].sort((a, b) => b.lengthMM - a.lengthMM)[0]
  return {
    ringsMM: ringsOf(unsupported), materialAreaMM2, areaMM2,
    percent: materialAreaMM2 ? areaMM2 / materialAreaMM2 * 100 : 0,
    patches: patchesOf(unsupported), outerBoundary: gaps,
    boundaryMM: gaps.reduce((sum, gap) => sum + gap.lengthMM, 0),
    repairTargetMM: targetGap
      ? [(targetGap.a[0] + targetGap.b[0]) / 2, (targetGap.a[1] + targetGap.b[1]) / 2] : null,
  }
}
