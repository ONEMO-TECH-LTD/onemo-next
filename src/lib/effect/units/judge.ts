// units/judge.ts — JUDGE: which offers are lawful, and in what order they stand.
//
// The rules that were buried inside the band ladder (S2 step 6). Judge decides; it never places a
// magnet, never wraps and never mutates a population.

import type {
  Contour, HoldingRules, Pt, UnprotectedEvidence, UnsupportedBoundaryInterval, UnsupportedPatch,
} from '../types'
import { bbox, pointInContour } from '../foundation/geometry'
import { Clipper, FillRule, PointInPolygonResult, type Path64, type Paths64 } from '@countertype/clipper2-ts'

/** BAND MEMBERSHIP (Dan, 08-24): a layout whose TRUE wrapped size falls outside the band does not
 *  exist in that band. No clamping to band floors — the size decides, not the request. */
export function inBand(sizeMM: number, loMM: number, hiMM: number): boolean {
  return !(sizeMM < loMM - 0.005 || sizeMM > hiMM + 0.005)
}

const HOLD_SCALE = 1000
const MAX_SUPPORT_SPAN_MM = 96
const HOLD_REACH_MM = 48

export interface HoldingFacts {
  perimeter: number
  holdsExtremes: boolean
  ends: number
  topUnprotectedMM: number
  unprotectedMM: number
  unprotectedAreaMM2: number
  imbalance: number
  centreOffMM: number
  ringsMM: Pt[][]
  evidence?: UnprotectedEvidence
}

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

const nearBoundary = (contour: Contour, p: Pt): number => {
  let best = Infinity
  for (const ring of [contour.outer, ...contour.holes]) for (let i = 0; i < ring.pts.length; i++) {
    const a = ring.pts[i], b = ring.pts[(i + 1) % ring.pts.length]
    const dx = b[0] - a[0], dy = b[1] - a[1], d2 = dx * dx + dy * dy
    const t = d2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d2)) : 0
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)))
  }
  return best
}

const pathsAreaMM2 = (paths: Paths64): number =>
  Math.abs(Number(Clipper.areaPaths(paths))) / (HOLD_SCALE * HOLD_SCALE)

const ringsOf = (paths: Paths64): Pt[][] => paths.map((path) =>
  path.map((point) => [Number(point.x) / HOLD_SCALE, Number(point.y) / HOLD_SCALE] as Pt))

function pathContains(path: Path64, point: Pt): boolean {
  return Clipper.pointInPolygon(
    { x: Math.round(point[0] * HOLD_SCALE), y: Math.round(point[1] * HOLD_SCALE) }, path)
    !== PointInPolygonResult.IsOutside
}

function interiorWitness(path: Path64): Pt | null {
  const ring = ringsOf([path])[0]
  const mean: Pt = [ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
    ring.reduce((sum, p) => sum + p[1], 0) / ring.length]
  if (pathContains(path, mean)) return mean
  for (let index = 0; index < ring.length; index++) {
    const mid: Pt = [(ring[index][0] + ring[(index + 1) % ring.length][0]) / 2,
      (ring[index][1] + ring[(index + 1) % ring.length][1]) / 2]
    for (const weight of [0.25, 0.5, 0.75]) {
      const candidate: Pt = [mid[0] * (1 - weight) + mean[0] * weight,
        mid[1] * (1 - weight) + mean[1] * weight]
      if (pathContains(path, candidate)) return candidate
    }
  }
  for (let a = 0; a < ring.length; a++) for (let b = a + 2; b < ring.length; b++) {
    const candidate: Pt = [(ring[a][0] + ring[b][0]) / 2, (ring[a][1] + ring[b][1]) / 2]
    if (pathContains(path, candidate)) return candidate
  }
  return null
}

function patchesOf(paths: Paths64): UnsupportedPatch[] {
  const outers = paths.filter((path) => Clipper.area(path) > 0)
  const holes = paths.filter((path) => Clipper.area(path) < 0)
  return outers.flatMap((path) => {
    const witnessMM = interiorWitness(path)
    if (!witnessMM) return []
    const holesArea = holes.filter((hole) => {
      const witness = interiorWitness(hole)
      return witness ? pathContains(path, witness) : false
    })
      .reduce((sum, hole) => sum + Math.abs(Number(Clipper.area(hole))) / (HOLD_SCALE * HOLD_SCALE), 0)
    return [{
      areaMM2: Number(Clipper.area(path)) / (HOLD_SCALE * HOLD_SCALE) - holesArea,
      witnessMM,
    }]
  }).sort((a, b) => b.areaMM2 - a.areaMM2)
}

/** Semantic corner analogue: end holds on the local top/bottom or left/right material spans. */
function spanEndHolds(contour: Contour, magnets: ReadonlyArray<Pt>, reachMM = HOLD_REACH_MM): number {
  const box = bbox(contour.outer.pts), w = box.maxX - box.minX, h = box.maxY - box.minY
  const portrait = h >= w
  const pathOf = (points: ReadonlyArray<Pt>) => Clipper.makePath(points.flatMap(([x, y]) =>
    [Math.round(x * HOLD_SCALE), Math.round(y * HOLD_SCALE)]))
  let material: Paths64 = [pathOf(contour.outer.pts)]
  if (contour.holes.length) material = Clipper.difference(
    material, contour.holes.map((hole) => pathOf(hole.pts)), FillRule.NonZero)
  let held = 0
  for (const far of [false, true]) {
    const lo = portrait ? box.minY : box.minX, hi = portrait ? box.maxY : box.maxX
    const from = far ? hi - reachMM : lo, to = far ? hi : lo + reachMM
    const stripMagnets = magnets.filter((p) => {
      const along = portrait ? p[1] : p[0]
      return along >= from && along <= to
    })
    if (!stripMagnets.length) continue
    const strip = Clipper.makePath((portrait
      ? [[box.minX, from], [box.maxX, from], [box.maxX, to], [box.minX, to]]
      : [[from, box.minY], [to, box.minY], [to, box.maxY], [from, box.maxY]])
      .flatMap(([x, y]) => [Math.round(x * HOLD_SCALE), Math.round(y * HOLD_SCALE)]))
    for (const run of Clipper.intersect(material, [strip], FillRule.NonZero)) {
      const across = run.map((point) => Number(portrait ? point.x : point.y) / HOLD_SCALE)
      const runLo = Math.min(...across), runHi = Math.max(...across)
      const positions = stripMagnets.map((p) => portrait ? p[0] : p[1])
        .filter((position) => position >= runLo - 1e-6 && position <= runHi + 1e-6)
      if (!positions.length) continue
      if (runHi - runLo <= reachMM) { held++; continue }
      if (Math.min(...positions) <= runLo + reachMM) held++
      if (Math.max(...positions) >= runHi - reachMM) held++
    }
  }
  return held
}

export function holdingFactsOf(
  contour: Contour, magnets: ReadonlyArray<Pt>, anchorMM: Pt, centreOffMM = 0,
  pitchMM = 48, edgePaddingMM = 24, magnetRadiiMM: ReadonlyArray<number> = magnets.map(() => 3),
): HoldingFacts {
  const protectionRadii = magnets.map((_, index) => edgePaddingMM + (magnetRadiiMM[index] ?? 3))
  const spans = supportSpans(contour, magnets, protectionRadii, pitchMM)
  const material = materialPaths(contour)
  const heldUnion = heldPaths(magnets, protectionRadii, spans)
  const unsupported = heldUnion.length ? Clipper.difference(material, heldUnion, FillRule.NonZero) : material
  const gaps = boundaryGaps(contour, magnets, protectionRadii, spans)
  const materialAreaMM2 = pathsAreaMM2(material), areaMM2 = pathsAreaMM2(unsupported)
  const targetGap = [...gaps].sort((a, b) => b.lengthMM - a.lengthMM)[0]
  const evidence: UnprotectedEvidence = {
    ringsMM: ringsOf(unsupported), materialAreaMM2, areaMM2,
    percent: materialAreaMM2 ? areaMM2 / materialAreaMM2 * 100 : 0,
    patches: patchesOf(unsupported), outerBoundary: gaps,
    boundaryMM: gaps.reduce((sum, gap) => sum + gap.lengthMM, 0),
    repairTargetMM: targetGap
      ? [(targetGap.a[0] + targetGap.b[0]) / 2, (targetGap.a[1] + targetGap.b[1]) / 2] : null,
  }
  const reachMM = protectionRadii.length ? Math.max(...protectionRadii) : edgePaddingMM + 3
  const box = bbox(contour.outer.pts), w = box.maxX - box.minX, h = box.maxY - box.minY
  const square = Math.abs(w - h) < 1e-6
  const held = (axis: 0 | 1, lo: number, hi: number) => magnets.length > 0
    && Math.min(...magnets.map((p) => p[axis])) <= lo + reachMM
    && Math.max(...magnets.map((p) => p[axis])) >= hi - reachMM
  const holdsExtremes = square
    ? held(0, box.minX, box.maxX) && held(1, box.minY, box.maxY)
    : h > w ? held(1, box.minY, box.maxY) : held(0, box.minX, box.maxX)
  const areaIn = (minX: number, minY: number, maxX: number, maxY: number) => {
    if (!unsupported.length || maxX <= minX || maxY <= minY) return 0
    const rect = Clipper.makePath([
      Math.round(minX * HOLD_SCALE), Math.round(minY * HOLD_SCALE),
      Math.round(maxX * HOLD_SCALE), Math.round(minY * HOLD_SCALE),
      Math.round(maxX * HOLD_SCALE), Math.round(maxY * HOLD_SCALE),
      Math.round(minX * HOLD_SCALE), Math.round(maxY * HOLD_SCALE),
    ])
    return pathsAreaMM2(Clipper.intersect(unsupported, [rect], FillRule.NonZero))
  }
  const portrait = h >= w
  const one = portrait ? areaIn(box.minX, box.minY, anchorMM[0], box.maxY)
    : areaIn(box.minX, box.minY, box.maxX, anchorMM[1])
  const two = portrait ? areaIn(anchorMM[0], box.minY, box.maxX, box.maxY)
    : areaIn(box.minX, anchorMM[1], box.maxX, box.maxY)
  const total = one + two
  return {
    perimeter: magnets.filter((p, index) => nearBoundary(contour, p) <= protectionRadii[index]).length,
    holdsExtremes,
    ends: spanEndHolds(contour, magnets, reachMM),
    topUnprotectedMM: areaIn(box.minX, box.maxY - reachMM, box.maxX, box.maxY),
    unprotectedMM: evidence.boundaryMM,
    unprotectedAreaMM2: evidence.areaMM2,
    imbalance: total ? Math.abs(one - two) / total : 0,
    centreOffMM,
    ringsMM: evidence.ringsMM,
    evidence,
  }
}

/** Equal-weight rank sum. Counts and lawful wrapping remain hard gates outside this scorer. */
export function rankByHolding<T>(
  candidates: ReadonlyArray<T>, factsOf: (candidate: T) => HoldingFacts, rules?: HoldingRules,
): T[] {
  if (!rules || candidates.length < 2) return [...candidates]
  const ruleset: Array<Array<(facts: HoldingFacts) => number>> = []
  if (rules.perimeter) ruleset.push([(f) => -f.perimeter])
  if (rules.extremes) ruleset.push([(f) => f.holdsExtremes ? 0 : 1])
  if (rules.ends) ruleset.push([(f) => -f.ends])
  if (rules.top) ruleset.push([(f) => f.topUnprotectedMM])
  if (rules.universal) ruleset.push([(f) => f.unprotectedAreaMM2, (f) => f.unprotectedMM])
  if (!ruleset.length && !rules.balance) return [...candidates]
  const facts = new Map(candidates.map((candidate) => [candidate, factsOf(candidate)]))
  const totals = new Map(candidates.map((candidate) => [candidate, 0]))
  for (const measures of ruleset) for (const measure of measures) {
    const rows = candidates.map((candidate) => ({ candidate, value: measure(facts.get(candidate)!) }))
      .sort((a, b) => a.value - b.value)
    let rank = 0
    for (let i = 0; i < rows.length; i++) {
      if (i && Math.abs(rows[i].value - rows[i - 1].value) > 1e-9) rank = i
      totals.set(rows[i].candidate, (totals.get(rows[i].candidate) ?? 0) + rank / measures.length)
    }
  }
  if (rules.balance) {
    const rows = candidates.map((candidate) => ({ candidate, facts: facts.get(candidate)! }))
      .sort((a, b) => a.facts.centreOffMM - b.facts.centreOffMM
        || a.facts.imbalance - b.facts.imbalance)
    let rank = 0
    for (let index = 0; index < rows.length; index++) {
      if (index && (Math.abs(rows[index].facts.centreOffMM - rows[index - 1].facts.centreOffMM) > 1e-9
        || Math.abs(rows[index].facts.imbalance - rows[index - 1].facts.imbalance) > 1e-9)) rank = index
      totals.set(rows[index].candidate, (totals.get(rows[index].candidate) ?? 0) + rank)
    }
  }
  return [...candidates].sort((a, b) => (totals.get(a) ?? 0) - (totals.get(b) ?? 0))
}

/** Remove Canon seats greedily while preserving whole-shape extremes and semantic span ends. */
export function sparseExtremeHold(contour: Contour, points: ReadonlyArray<Pt>, anchorMM: Pt): Pt[] {
  let kept = [...points]
  const baseline = holdingFactsOf(contour, kept, anchorMM)
  for (;;) {
    const options = kept.map((_, index) => kept.filter((__, i) => i !== index)).filter((candidate) => {
      const facts = holdingFactsOf(contour, candidate, anchorMM)
      return facts.holdsExtremes === baseline.holdsExtremes && facts.ends >= baseline.ends
    })
    if (!options.length) return kept
    options.sort((a, b) => {
      const fa = holdingFactsOf(contour, a, anchorMM), fb = holdingFactsOf(contour, b, anchorMM)
      return fa.unprotectedMM - fb.unprotectedMM || fa.imbalance - fb.imbalance
    })
    kept = options[0]
  }
}
