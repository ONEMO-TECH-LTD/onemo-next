// units/judge.ts — JUDGE: which offers are lawful, and in what order they stand.
//
// The rules that were buried inside the band ladder (S2 step 6). Judge decides; it never places a
// magnet, never wraps and never mutates a population.

import type { Contour, HoldingRules, Pt } from '../types'
import { bbox, pointInContour } from '../foundation/geometry'
import { Clipper, FillRule, type Paths64 } from '@countertype/clipper2-ts'

/** BAND MEMBERSHIP (Dan, 08-24): a layout whose TRUE wrapped size falls outside the band does not
 *  exist in that band. No clamping to band floors — the size decides, not the request. */
export function inBand(sizeMM: number, loMM: number, hiMM: number): boolean {
  return !(sizeMM < loMM - 0.005 || sizeMM > hiMM + 0.005)
}

const HOLD_REACH_MM = 48
const HOLD_SCALE = 1000

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
}

type BoundaryGap = { a: Pt; b: Pt; length: number }
type SupportSpan = { a: Pt; b: Pt; radius: number }

function supportSpans(
  contour: Contour, magnets: ReadonlyArray<Pt>, radii: ReadonlyArray<number>, edgePaddingMM: number,
  pitchMM: number,
): SupportSpan[] {
  const spans: SupportSpan[] = []
  for (let i = 0; i < magnets.length; i++) for (let j = i + 1; j < magnets.length; j++) {
    const a = magnets[i], b = magnets[j]
    const dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1])
    if (!((dx < 0.01 && Math.abs(dy - pitchMM) < 0.01)
      || (dy < 0.01 && Math.abs(dx - pitchMM) < 0.01))) continue
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1])
    const steps = Math.max(1, Math.ceil(distance))
    let inside = true
    for (let step = 0; step <= steps; step++) {
      const t = step / steps
      if (!pointInContour([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], contour)) {
        inside = false; break
      }
    }
    if (inside) spans.push({ a, b, radius: edgePaddingMM + Math.min(radii[i] ?? 3, radii[j] ?? 3) })
  }
  return spans
}

function spanInterval(edgeA: Pt, edgeB: Pt, span: SupportSpan): [number, number] | null {
  const sx = span.b[0] - span.a[0], sy = span.b[1] - span.a[1], length = Math.hypot(sx, sy)
  if (length < 1e-9) return null
  const ux = sx / length, uy = sy / length
  const along = (point: Pt) => (point[0] - span.a[0]) * ux + (point[1] - span.a[1]) * uy
  const across = (point: Pt) => -(point[0] - span.a[0]) * uy + (point[1] - span.a[1]) * ux
  let lo = 0, hi = 1
  const clip = (v0: number, v1: number, min: number, max: number) => {
    const d = v1 - v0
    if (Math.abs(d) < 1e-12) return v0 >= min && v0 <= max
    const t0 = (min - v0) / d, t1 = (max - v0) / d
    lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1))
    return lo <= hi
  }
  return clip(along(edgeA), along(edgeB), 0, length)
    && clip(across(edgeA), across(edgeB), -span.radius, span.radius) ? [lo, hi] : null
}

/** Exact unsupported intervals on the actual material boundary under 48mm magnet discs. */
function boundaryGaps(
  contour: Contour, magnets: ReadonlyArray<Pt>, protectionRadii: ReadonlyArray<number>, spans: ReadonlyArray<SupportSpan>,
): BoundaryGap[] {
  const out: BoundaryGap[] = []
  for (const ring of [contour.outer, ...contour.holes]) for (let i = 0; i < ring.pts.length; i++) {
    const a = ring.pts[i], b = ring.pts[(i + 1) % ring.pts.length]
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy)
    if (length < 1e-9) continue
    const covered: Array<[number, number]> = []
    for (let magnetIndex = 0; magnetIndex < magnets.length; magnetIndex++) {
      const [mx, my] = magnets[magnetIndex], protectionRadius = protectionRadii[magnetIndex] ?? HOLD_REACH_MM
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
        length: hi - lo,
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

const nearBoundary = (contour: Contour, p: Pt): boolean => {
  let best = Infinity
  for (const ring of [contour.outer, ...contour.holes]) for (let i = 0; i < ring.pts.length; i++) {
    const a = ring.pts[i], b = ring.pts[(i + 1) % ring.pts.length]
    const dx = b[0] - a[0], dy = b[1] - a[1], d2 = dx * dx + dy * dy
    const t = d2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d2)) : 0
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)))
  }
  return best <= HOLD_REACH_MM
}

const pathOf = (points: ReadonlyArray<Pt>) => Clipper.makePath(points.flatMap(([x, y]) =>
  [Math.round(x * HOLD_SCALE), Math.round(y * HOLD_SCALE)]))

function unprotectedMaterial(
  contour: Contour, magnets: ReadonlyArray<Pt>, protectionRadii: ReadonlyArray<number>, spans: ReadonlyArray<SupportSpan>,
): Paths64 {
  let material: Paths64 = [pathOf(contour.outer.pts)]
  if (contour.holes.length) material = Clipper.difference(
    material, contour.holes.map((hole) => pathOf(hole.pts)), FillRule.NonZero)
  if (!magnets.length) return material
  const sides = 72
  const heldPaths = magnets.map(([mx, my], magnetIndex) => {
    const radius = (protectionRadii[magnetIndex] ?? HOLD_REACH_MM) / Math.cos(Math.PI / sides)
    return Clipper.makePath(Array.from({ length: sides }, (_, index) => {
    const angle = index * Math.PI * 2 / sides
    return [Math.round((mx + Math.cos(angle) * radius) * HOLD_SCALE),
      Math.round((my + Math.sin(angle) * radius) * HOLD_SCALE)]
    }).flat())
  })
  for (const span of spans) {
    const dx = span.b[0] - span.a[0], dy = span.b[1] - span.a[1], length = Math.hypot(dx, dy)
    const nx = -dy / length * span.radius, ny = dx / length * span.radius
    heldPaths.push(pathOf([
      [span.a[0] + nx, span.a[1] + ny], [span.b[0] + nx, span.b[1] + ny],
      [span.b[0] - nx, span.b[1] - ny], [span.a[0] - nx, span.a[1] - ny],
    ]))
  }
  const held = Clipper.union(heldPaths, FillRule.NonZero)
  return held.length ? Clipper.difference(material, held, FillRule.NonZero) : material
}

const pathsAreaMM2 = (paths: Paths64): number =>
  Math.abs(Number(Clipper.areaPaths(paths))) / (HOLD_SCALE * HOLD_SCALE)

const ringsOf = (paths: Paths64): Pt[][] => paths.map((path) =>
  path.map((point) => [Number(point.x) / HOLD_SCALE, Number(point.y) / HOLD_SCALE] as Pt))

/** Semantic corner analogue: end holds on the local top/bottom or left/right material spans. */
function spanEndHolds(contour: Contour, magnets: ReadonlyArray<Pt>): number {
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
    const from = far ? hi - HOLD_REACH_MM : lo, to = far ? hi : lo + HOLD_REACH_MM
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
      if (runHi - runLo <= HOLD_REACH_MM) { held++; continue }
      if (Math.min(...positions) <= runLo + HOLD_REACH_MM) held++
      if (Math.max(...positions) >= runHi - HOLD_REACH_MM) held++
    }
  }
  return held
}

export function holdingFactsOf(
  contour: Contour, magnets: ReadonlyArray<Pt>, anchorMM: Pt, centreOffMM = 0,
  pitchMM = 48, edgePaddingMM = 45, magnetRadiiMM: ReadonlyArray<number> = magnets.map(() => 3),
): HoldingFacts {
  const box = bbox(contour.outer.pts), w = box.maxX - box.minX, h = box.maxY - box.minY
  const square = Math.abs(w - h) < 1e-6
  const held = (axis: 0 | 1, lo: number, hi: number) => magnets.length > 0
    && Math.min(...magnets.map((p) => p[axis])) <= lo + HOLD_REACH_MM
    && Math.max(...magnets.map((p) => p[axis])) >= hi - HOLD_REACH_MM
  const holdsExtremes = square
    ? held(0, box.minX, box.maxX) && held(1, box.minY, box.maxY)
    : h > w ? held(1, box.minY, box.maxY) : held(0, box.minX, box.maxX)
  const protectionRadii = magnets.map((_, index) => edgePaddingMM + (magnetRadiiMM[index] ?? 3))
  const spans = supportSpans(contour, magnets, magnetRadiiMM, edgePaddingMM, pitchMM)
  const gaps = boundaryGaps(contour, magnets, protectionRadii, spans)
  const unsupported = unprotectedMaterial(contour, magnets, protectionRadii, spans)
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
    perimeter: magnets.filter((p) => nearBoundary(contour, p)).length,
    holdsExtremes,
    ends: spanEndHolds(contour, magnets),
    topUnprotectedMM: areaIn(box.minX, box.maxY - HOLD_REACH_MM, box.maxX, box.maxY),
    unprotectedMM: gaps.reduce((sum, gap) => sum + gap.length, 0),
    unprotectedAreaMM2: pathsAreaMM2(unsupported),
    imbalance: total ? Math.abs(one - two) / total : 0,
    centreOffMM,
    ringsMM: ringsOf(unsupported),
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
export function sparseExtremeHold(
  contour: Contour, points: ReadonlyArray<Pt>, anchorMM: Pt,
  pitchMM = 48, edgePaddingMM = 45, magnetRadiiMM: ReadonlyArray<number> = points.map(() => 3),
): Pt[] {
  let kept = [...points]
  const baseline = holdingFactsOf(contour, kept, anchorMM, 0, pitchMM, edgePaddingMM, magnetRadiiMM)
  for (;;) {
    const options = kept.map((_, index) => kept.filter((__, i) => i !== index)).filter((candidate) => {
      const facts = holdingFactsOf(contour, candidate, anchorMM, 0, pitchMM, edgePaddingMM,
        candidate.map((point) => magnetRadiiMM[points.indexOf(point)] ?? 3))
      return facts.holdsExtremes === baseline.holdsExtremes && facts.ends >= baseline.ends
    })
    if (!options.length) return kept
    options.sort((a, b) => {
      const fa = holdingFactsOf(contour, a, anchorMM, 0, pitchMM, edgePaddingMM,
        a.map((point) => magnetRadiiMM[points.indexOf(point)] ?? 3))
      const fb = holdingFactsOf(contour, b, anchorMM, 0, pitchMM, edgePaddingMM,
        b.map((point) => magnetRadiiMM[points.indexOf(point)] ?? 3))
      return fa.unprotectedMM - fb.unprotectedMM || fa.imbalance - fb.imbalance
    })
    kept = options[0]
  }
}
