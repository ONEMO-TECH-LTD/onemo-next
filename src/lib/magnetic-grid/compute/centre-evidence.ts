// Neutral centre evidence — the single centre authority (R14 §7.1b items 1, 3 and the measurement
// half of 6). Two layers live here deliberately, not two implementations: the CLONED donor
// measurements (`centroidOf`, `centreMeasurements`, `coreCentre`, `allMasses`), preserved so the
// accepted centring behaviour can be proved unchanged, and the EXACT construction of the same
// branches, which replaces only the ruler beneath those rules. An island is a connected component
// of the legal region at the spot radius, its centre is its DEEPEST point, its peak clearance is
// that point's clearance, its mean is the area centroid, and its masses are the same construction
// at the ruled mass depth, assigned to the island containing them — the donor's semantics exactly.
// What changes is that the donor samples a 2mm mesh (areas are cell counts, the deepest point is a
// sample), so its answers move as the shape scales, while these are exact and anything the bounds
// cannot settle is reported unresolved rather than rounded into a branch.

import type { CentreMeasurements, CentreRegionRef, Contour, MassMeasurement, Pt, RegionMeasurement } from '../spec'
import type { ExactRational } from './exact-real'
import { MASS_DEPTH_MM, SPOT_RADIUS_MM } from '../spec'
import { compareCReal, evaluate, type CReal, type Interval } from './certified-real'
import { type ExactContour, toUnits } from './clearance'
import { clearanceMaximum, type ClearanceMaximum } from './deepest'
import { compareExact, ratAdd, ratDiv, ratFromInt, ratMul, ratSub, ratToNumber, rational } from './exact-real'
import { compareCertifiedSum, exactRegions, regionContains, regionIdentity, type ExactRegion } from './region'
import { bbox } from './seat'

/** Area centroid of a polygon (shoelace) — the material's weight centre. */
export function centroidOf(pts: ReadonlyArray<Pt>): Pt {
  let a2 = 0, sx = 0, sy = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const cross = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
    a2 += cross
    sx += (pts[j][0] + pts[i][0]) * cross
    sy += (pts[j][1] + pts[i][1]) * cross
  }
  if (Math.abs(a2) < 1e-9) {
    let mx = 0, my = 0
    for (const p of pts) { mx += p[0]; my += p[1] }
    return [mx / pts.length, my / pts.length]
  }
  return [sx / (3 * a2), sy / (3 * a2)]
}

export function centreMeasurements(contour: Contour, regions: readonly RegionMeasurement[]): CentreMeasurements {
  const bounds = bbox(contour.outer.pts)
  return {
    box: [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2],
    core: coreCentre(regions, [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]),
    weight: centroidOf(contour.outer.pts),
    regions,
    masses: allMasses(regions),
    midY: (bounds.minY + bounds.maxY) / 2,
  }
}

export function coreCentre(regions: readonly RegionMeasurement[], fallback: Pt): Pt {
  if (!regions.length) return fallback
  let area = 0, x = 0, y = 0
  for (const region of regions) {
    area += region.areaMM2
    x += region.meanMM[0] * region.areaMM2
    y += region.meanMM[1] * region.areaMM2
  }
  return [x / area, y / area]
}

export function allMasses(regions: readonly RegionMeasurement[]): readonly CentreRegionRef[] {
  const measured: CentreRegionRef[] = []
  for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
    const region = regions[regionIndex]
    if (region.masses.length) {
      for (let massIndex = 0; massIndex < region.masses.length; massIndex++) {
        measured.push({ region: region.masses[massIndex], regionIndex, massIndex })
      }
    } else measured.push({ region, regionIndex, massIndex: null })
  }
  return measured
}

// ---- exact construction of the same branches -------------------------------------------------


/**
 * A measured region: the certified integrals of §7.1b item 4 plus the maximum of item 5, together
 * with the NEUTRAL SELECTION RECORD the law layer chooses from.
 *
 * The record exists because selection is policy and measurement is not. Logic ranks islands and
 * masses by area, by depth and by height, and under the import law its only arithmetic is
 * `compareExact` on rationals — it may not reach into geometry to find a y coordinate. So compute
 * publishes those three quantities as certified rational enclosures and keeps the geometry opaque:
 * logic decides WHICH branch governs, never where anything is.
 *
 * `centre` is null exactly when the deepest evidence names no single point — a co-maximal ridge or
 * an unresolved maximum. The donor's mesh always produced a point there because it sampled; naming
 * that absence is the honest form of the same evidence, and it is what lets a tie stay a tie.
 */
export interface MeasuredRegion {
  readonly region: ExactRegion
  readonly areaMM2: Interval
  /** area centroid — the donor's `meanMM` */
  readonly meanMM: { x: Interval; y: Interval }
  /** the deepest-point evidence — the donor's `centreMM`/`peakClearMM`, as typed evidence */
  readonly deepest: ClearanceMaximum
  /** the governed point, when one exists: certified maximum, or the single point of a tie set */
  readonly centre: { x: Interval; y: Interval } | null
  /** peak clearance — the donor's `peakClearMM` — certified, or null when the maximum is unresolved */
  readonly peakClear: Interval | null
  /** the finitely many co-equal maxima when the maximum is a tie; empty for a ridge, which has none */
  readonly coEqual: readonly { x: Interval; y: Interval }[]
  /**
   * Equality classes, proven here rather than guessed downstream. Two regions share a class when
   * their integrals are PROVED equal — mirrored lobes have identical areas built from different
   * coordinates, so no enclosure and no structural key could ever show it, but grouping the angle
   * terms by provably-equal sweep can. Logic then selects on policy alone: same class means equal,
   * and it never has to reason about geometry to know that.
   */
  readonly areaClass: number
  readonly clearanceClass: number
}

export interface ExactIsland extends MeasuredRegion {
  /** regions of the same construction at the ruled mass depth, contained in this island */
  readonly masses: readonly MeasuredRegion[]
}

export interface ExactCentreEvidence {
  /**
   * Content identity of this measured evidence set. Branch indices are NOT identity — `(0, null)`
   * is the first island of every contour at every scale — so a decision travelling with indices
   * alone could not be told apart downstream, where it becomes cache and result identity.
   *
   * It is derived from EXACT, PRECISION-FREE inputs only: the supplied geometry as exact integer
   * units, the two ruled clearance levels, and each region's own generating features. Deliberately
   * NOT from enclosure bounds, array positions or message order — an id that moved when a bound was
   * refined, or when the same outline arrived with its points rotated, would be an id of the
   * traversal rather than of the evidence. Every key is sorted by exact geometry, so a permuted
   * input yields the identical id.
   */
  readonly id: string
  readonly box: { x: ExactRational; y: ExactRational }
  /** material weight centre — the exact shoelace centroid of the supplied outer ring */
  readonly weight: { x: ExactRational; y: ExactRational }
  /** area-weighted mean of the island means — the donor's `core` */
  readonly core: { x: Interval; y: Interval } | null
  readonly islands: readonly ExactIsland[]
  readonly midY: ExactRational
  readonly unresolved: boolean
  readonly reasons: readonly string[]
}

/** Deterministic 64-bit FNV-1a over a canonical rendering — no host crypto, identical everywhere. */
function contentId(parts: readonly string[]): string {
  let hash = BigInt('0xcbf29ce484222325')
  const prime = BigInt('0x100000001b3')
  const mask = (BigInt(1) << BigInt(64)) - BigInt(1)
  for (const part of parts) {
    for (let index = 0; index < part.length; index++) {
      hash = ((hash ^ BigInt(part.charCodeAt(index))) * prime) & mask
    }
    hash = ((hash ^ BigInt(31)) * prime) & mask
  }
  return hash.toString(16).padStart(16, '0')
}

/** Exact geometric key of one supplied segment, independent of which ring index or direction it
 *  arrived with: the two endpoints in integer units, ordered canonically between themselves. */
function segmentKey(segment: { ax: bigint; ay: bigint; bx: bigint; by: bigint }): string {
  const a = `${segment.ax},${segment.ay}`
  const b = `${segment.bx},${segment.by}`
  return a <= b ? `${a}|${b}` : `${b}|${a}`
}

const iAdd = (a: Interval, b: Interval): Interval => ({ lo: ratAdd(a.lo, b.lo), hi: ratAdd(a.hi, b.hi) })
const iMul = (a: Interval, b: Interval): Interval => {
  const p = [ratMul(a.lo, b.lo), ratMul(a.lo, b.hi), ratMul(a.hi, b.lo), ratMul(a.hi, b.hi)]
  return { lo: p.reduce((m, x) => (compareExact(x, m) < 0 ? x : m)), hi: p.reduce((m, x) => (compareExact(x, m) > 0 ? x : m)) }
}
const iDivPos = (num: Interval, den: Interval): Interval => {
  const q = [ratDiv(num.lo, den.lo), ratDiv(num.lo, den.hi), ratDiv(num.hi, den.lo), ratDiv(num.hi, den.hi)]
  return { lo: q.reduce((m, x) => (compareExact(x, m) < 0 ? x : m)), hi: q.reduce((m, x) => (compareExact(x, m) > 0 ? x : m)) }
}
const IZERO: Interval = { lo: ratFromInt(0), hi: ratFromInt(0) }

/** Exact bbox midpoint of the supplied contour, in mm. */
export function exactBoxCentre(c: ExactContour): { x: ExactRational; y: ExactRational } {
  return {
    x: rational(c.minX + c.maxX, BigInt(2) * c.unit),
    y: rational(c.minY + c.maxY, BigInt(2) * c.unit),
  }
}

/**
 * Exact material weight centre: the shoelace area centroid of the supplied OUTER ring, in mm.
 * Outer-ring-only is the donor's accepted behaviour, preserved deliberately — a holes-aware weight
 * would move the answer on every holed shape, which is a ruled product change, not a repair. A
 * degenerate ring (zero signed area) falls back to the vertex mean, exactly as the donor does.
 */
export function exactWeightCentre(c: ExactContour): { x: ExactRational; y: ExactRational } {
  const outer = c.segments.filter((s) => s.ring === 0)
  let a2 = BigInt(0), sx = BigInt(0), sy = BigInt(0)
  for (const s of outer) {
    // each segment runs from its ring predecessor to itself: (ax,ay) → (bx,by)
    const cross = s.ax * s.by - s.bx * s.ay
    a2 += cross
    sx += (s.ax + s.bx) * cross
    sy += (s.ay + s.by) * cross
  }
  if (a2 === BigInt(0)) {
    let mx = BigInt(0), my = BigInt(0)
    for (const s of outer) { mx += s.bx; my += s.by }
    const n = BigInt(outer.length)
    return { x: rational(mx, n * c.unit), y: rational(my, n * c.unit) }
  }
  return { x: rational(sx, BigInt(3) * a2 * c.unit), y: rational(sy, BigInt(3) * a2 * c.unit) }
}

/** Certified enclosure of a certified point's coordinates, in mm. */
function pointMM(p: { x: CReal; y: CReal }, unit: bigint): { x: Interval; y: Interval } {
  const perUnit = ratFromInt(unit)
  const x = evaluate(p.x, BigInt(64)), y = evaluate(p.y, BigInt(64))
  return {
    x: { lo: ratDiv(x.lo, perUnit), hi: ratDiv(x.hi, perUnit) },
    y: { lo: ratDiv(y.lo, perUnit), hi: ratDiv(y.hi, perUnit) },
  }
}

/**
 * Group measured regions into proven-equal classes.
 *
 * Every PAIR is compared, not each item against whichever representative happened to be created
 * first: a comparison that cannot be settled must never hide one that can, and with representatives
 * the discovered equalities depended on the order the items arrived in. Proven-true pairs are
 * unioned; an unsettled pair is simply not a proof and joins nothing.
 *
 * Class labels are then derived from the members' own canonical identities and sorted, so the same
 * evidence yields the same labels however it was ordered on the way in.
 */
function classify<T>(items: readonly T[], equal: (a: T, b: T) => boolean | null, identity: (item: T) => string): number[] {
  const parent = items.map((_, index) => index)
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])))
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (equal(items[i], items[j]) === true) parent[find(i)] = find(j)
    }
  }
  const canonical = new Map<number, string>()
  for (let index = 0; index < items.length; index++) {
    const root = find(index)
    const key = identity(items[index])
    const known = canonical.get(root)
    if (known === undefined || key < known) canonical.set(root, key)
  }
  const order = [...canonical.entries()].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
  const label = new Map(order.map(([root], index) => [root, index]))
  return items.map((_, index) => label.get(find(index))!)
}

function measure(c: ExactContour, region: ExactRegion, level: bigint): MeasuredRegion {
  const deepest = clearanceMaximum(c, region, level)
  const perUnit = ratFromInt(c.unit)
  const clearanceOf = (lo: ExactRational, hi: ExactRational): Interval => ({ lo: ratDiv(lo, perUnit), hi: ratDiv(hi, perUnit) })
  // A co-maximal ridge has no single point; a tie has several. Both are named rather than reduced
  // to one sample, which is precisely what the 2mm mesh used to do.
  const centre = deepest.status === 'certified' ? pointMM(deepest.best.p, c.unit) : null
  const peakClear = deepest.status === 'certified' ? clearanceOf(deepest.best.lo, deepest.best.hi)
    : deepest.status === 'tie' ? clearanceOf(deepest.candidates[0].lo, deepest.candidates[0].hi)
      : deepest.status === 'plateau' ? clearanceOf(deepest.clearanceLo, deepest.clearanceHi)
        : null
  const coEqual = deepest.status === 'tie' ? deepest.candidates.map((cand) => pointMM(cand.p, c.unit)) : []
  // classes are assigned across the whole evidence set once every region is measured
  return { region, areaMM2: region.areaMM2, meanMM: region.centroidMM, deepest, centre, peakClear, coEqual, areaClass: -1, clearanceClass: -1 }
}

/**
 * Order by exact area, ascending — the donor's ordering, decided by certified comparison instead of
 * float. Areas whose enclosures overlap cannot be ordered by their bounds, so they are compared
 * exactly through their difference; a pair that stays undecidable is reported rather than ordered
 * arbitrarily, because governor selection reads this order.
 */
function byAreaAscending<T extends { areaMM2: Interval }>(items: readonly T[], note: (why: string) => void): T[] {
  const ordered: T[] = []
  for (const item of items) {
    let place = ordered.length
    for (let k = 0; k < ordered.length; k++) {
      const a = item.areaMM2, b = ordered[k].areaMM2
      // separated enclosures decide immediately; overlapping ones are equal only if both bounds are
      if (compareExact(a.hi, b.lo) < 0) { place = k; break }
      if (compareExact(a.lo, b.hi) > 0) continue
      const sameLo = compareExact(a.lo, b.lo) === 0, sameHi = compareExact(a.hi, b.hi) === 0
      if (sameLo && sameHi) continue // equal within certification: stable order, flagged below
      note(`area order undecidable between overlapping enclosures (width ${ratSub(a.hi, a.lo).n}/${ratSub(a.hi, a.lo).d})`)
      break
    }
    ordered.splice(place, 0, item)
  }
  return ordered
}

/**
 * Every centre branch of one supplied contour at one physical scale. `spotRadiusMM` and
 * `massDepthMM` are the ruled values; they are parameters so a fixture can exercise the same
 * construction at another level, never so a caller can invent a policy.
 */
// Evidence depends on the contour and the two ruled levels — never on which policy will read it —
// so asking nine policies about one shape must measure it once. R14 §7.3: reuse changes cost only,
// and it can be switched off so the fixtures can prove the values are identical either way.
let evidenceMemo = new WeakMap<object, Map<string, ExactCentreEvidence>>()
let evidenceMemoOn = true

/** Neutral cache control for centre evidence. Disabling it changes cost, never a measurement. */
export function centreEvidenceMemo(enabled: boolean): void {
  evidenceMemoOn = enabled
  evidenceMemo = new WeakMap()
}

export function exactCentreEvidence(
  c: ExactContour,
  spotRadiusMM: number = SPOT_RADIUS_MM,
  massDepthMM: number = MASS_DEPTH_MM,
): ExactCentreEvidence {
  if (!evidenceMemoOn) return measureCentreEvidence(c, spotRadiusMM, massDepthMM)
  const key = `${spotRadiusMM}:${massDepthMM}`
  let table = evidenceMemo.get(c)
  const hit = table?.get(key)
  if (hit) return hit
  const measured = measureCentreEvidence(c, spotRadiusMM, massDepthMM)
  if (!table) { table = new Map(); evidenceMemo.set(c, table) }
  table.set(key, measured)
  return measured
}

function measureCentreEvidence(
  c: ExactContour,
  spotRadiusMM: number,
  massDepthMM: number,
): ExactCentreEvidence {
  const reasons: string[] = []
  let unresolved = false
  const note = (why: string) => { if (!reasons.includes(why)) { reasons.push(why); unresolved = true } }

  const spot = toUnits(spotRadiusMM, c)
  const depth = toUnits(massDepthMM, c)

  const islandLevel = exactRegions(c, spot)
  if (islandLevel.unresolved) { unresolved = true; for (const r of islandLevel.reasons) if (!reasons.includes(r)) reasons.push(r) }
  const massLevel = massDepthMM > spotRadiusMM ? exactRegions(c, depth) : islandLevel
  if (massLevel !== islandLevel && massLevel.unresolved) { unresolved = true; for (const r of massLevel.reasons) if (!reasons.includes(r)) reasons.push(r) }

  const measuredMasses = massLevel.regions.map((region) => measure(c, region, depth))
  const islands: ExactIsland[] = []
  for (const region of islandLevel.regions) {
    const island = measure(c, region, spot)
    const mine: MeasuredRegion[] = []
    for (const mass of measuredMasses) {
      if (massLevel === islandLevel) { if (mass.region === region) mine.push(mass); continue }
      // A mass sits strictly inside its island (its level is deeper), so any point of the mass
      // decides membership. Its outer loop's first piece midpoint is exact and always available.
      const probe = mass.region.outer.pieces[0].piece.mid
      const inside = regionContains(region, probe, spot)
      if (inside === null) { note('mass-to-island membership undecidable'); continue }
      if (inside) mine.push(mass)
    }
    islands.push({ ...island, masses: byAreaAscending(mine, note) })
  }

  const ordered = byAreaAscending(islands, note)

  // Prove which regions are equal, once, over the complete set — islands and their masses alike.
  const everyRegion: MeasuredRegion[] = ordered.flatMap((island) => [island, ...island.masses])
  const levelOf = new Map<MeasuredRegion, bigint>()
  for (const island of ordered) {
    levelOf.set(island, spot)
    for (const mass of island.masses) levelOf.set(mass, depth)
  }
  const regionKeyOf = (region: MeasuredRegion) => regionIdentity(region.region, levelOf.get(region) ?? spot)
  const areaClasses = classify(everyRegion, (a, b) => {
    const order = compareCertifiedSum(a.region.areaExpr, b.region.areaExpr)
    return order === null ? null : order === 0
  }, regionKeyOf)
  // Clearance is an EXACT algebraic value — every resolved maximum carries its squared clearance —
  // so equality is proved on that, never on matching enclosures. Identical nonzero-width bounds are
  // not equality; that is the mistake this whole layer exists to avoid.
  const squaredClearance = (region: MeasuredRegion) => {
    const deepest = region.deepest
    if (deepest.status === 'certified') return deepest.best.d2
    if (deepest.status === 'tie') return deepest.candidates[0].d2
    if (deepest.status === 'plateau') return deepest.d2
    return null
  }
  const clearanceClasses = classify(everyRegion, (a, b) => {
    const left = squaredClearance(a), right = squaredClearance(b)
    if (!left || !right) return null
    const order = compareCReal(left, right)
    return order === null ? null : order === 0
  }, regionKeyOf)
  const classed = new Map<MeasuredRegion, { areaClass: number; clearanceClass: number }>()
  everyRegion.forEach((region, index) => classed.set(region, { areaClass: areaClasses[index], clearanceClass: clearanceClasses[index] }))
  const withClasses = (region: MeasuredRegion): MeasuredRegion => ({ ...region, ...classed.get(region)! })
  const labelled: ExactIsland[] = ordered.map((island) => ({
    ...withClasses(island),
    masses: island.masses.map(withClasses),
  }))

  // core: area-weighted mean of the island means, certified
  let core: { x: Interval; y: Interval } | null = null
  if (labelled.length) {
    let area: Interval = IZERO, mx: Interval = IZERO, my: Interval = IZERO
    for (const island of labelled) {
      area = iAdd(area, island.areaMM2)
      mx = iAdd(mx, iMul(island.meanMM.x, island.areaMM2))
      my = iAdd(my, iMul(island.meanMM.y, island.areaMM2))
    }
    if (compareExact(area.lo, ratFromInt(0)) > 0) core = { x: iDivPos(mx, area), y: iDivPos(my, area) }
    else note('core weighting undecidable: total island area encloses zero')
  }

  const box = exactBoxCentre(c)
  const weight = exactWeightCentre(c)
  // Sorted, so the same shape identifies identically however its points were ordered on the way in.
  const regionKeys = labelled.map((island) => {
    const masses = island.masses.map((mass) => `${regionIdentity(mass.region, depth)}#${mass.deepest.status}`).sort()
    return `${regionIdentity(island.region, spot)}#${island.deepest.status}[${masses.join('+')}]`
  }).sort()
  const id = contentId([
    'centre-evidence-v1',
    `geometry:${[...c.segments].map(segmentKey).sort().join(';')}`,
    `unit:${c.unit}`,
    `levels:${spot},${depth}`,
    ...regionKeys,
    `unresolved:${[...reasons].sort().join('~')}`,
  ])
  return {
    id,
    box,
    weight,
    core,
    islands: labelled,
    midY: box.y,
    unresolved,
    reasons,
  }
}
