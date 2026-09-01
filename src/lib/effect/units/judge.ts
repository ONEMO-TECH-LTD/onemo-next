// units/judge.ts — JUDGE: which offers are lawful, and in what order they stand.
//
// The rules that were buried inside the band ladder (S2 step 6). Judge decides; it never places a
// magnet, never wraps and never mutates a population.

import type { Contour, HoldingRules, Pt } from '../types'
import { bbox } from '../foundation/geometry'
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

/** Exact unsupported intervals on the actual material boundary under 48mm magnet discs. */
function boundaryGaps(contour: Contour, magnets: ReadonlyArray<Pt>): BoundaryGap[] {
  const out: BoundaryGap[] = []
  for (const ring of [contour.outer, ...contour.holes]) for (let i = 0; i < ring.pts.length; i++) {
    const a = ring.pts[i], b = ring.pts[(i + 1) % ring.pts.length]
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy)
    if (length < 1e-9) continue
    const covered: Array<[number, number]> = []
    for (const [mx, my] of magnets) {
      const ux = dx / length, uy = dy / length
      const along = (mx - a[0]) * ux + (my - a[1]) * uy
      const across2 = (mx - (a[0] + along * ux)) ** 2 + (my - (a[1] + along * uy)) ** 2
      const reach2 = HOLD_REACH_MM ** 2 - across2
      if (reach2 < 0) continue
      const reach = Math.sqrt(reach2)
      const lo = Math.max(0, along - reach), hi = Math.min(length, along + reach)
      if (hi > lo) covered.push([lo, hi])
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

function unprotectedMaterial(contour: Contour, magnets: ReadonlyArray<Pt>): Paths64 {
  let material: Paths64 = [pathOf(contour.outer.pts)]
  if (contour.holes.length) material = Clipper.difference(
    material, contour.holes.map((hole) => pathOf(hole.pts)), FillRule.NonZero)
  if (!magnets.length) return material
  const sides = 72, radius = HOLD_REACH_MM / Math.cos(Math.PI / sides)
  const discs = magnets.map(([mx, my]) => Clipper.makePath(Array.from({ length: sides }, (_, index) => {
    const angle = index * Math.PI * 2 / sides
    return [Math.round((mx + Math.cos(angle) * radius) * HOLD_SCALE),
      Math.round((my + Math.sin(angle) * radius) * HOLD_SCALE)]
  }).flat()))
  const held = Clipper.union(discs, FillRule.NonZero)
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
): HoldingFacts {
  const box = bbox(contour.outer.pts), w = box.maxX - box.minX, h = box.maxY - box.minY
  const square = Math.abs(w - h) < 1e-6
  const held = (axis: 0 | 1, lo: number, hi: number) => magnets.length > 0
    && Math.min(...magnets.map((p) => p[axis])) <= lo + HOLD_REACH_MM
    && Math.max(...magnets.map((p) => p[axis])) >= hi - HOLD_REACH_MM
  const holdsExtremes = square
    ? held(0, box.minX, box.maxX) && held(1, box.minY, box.maxY)
    : h > w ? held(1, box.minY, box.maxY) : held(0, box.minX, box.maxX)
  const gaps = boundaryGaps(contour, magnets)
  const unsupported = unprotectedMaterial(contour, magnets)
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
