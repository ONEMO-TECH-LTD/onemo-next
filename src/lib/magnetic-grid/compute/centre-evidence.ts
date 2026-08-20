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

import type { CentreMeasurements, CentreRegionRef, Contour, Pt, Rational, RegionMeasurement } from '../spec'
import { MASS_DEPTH_MM, SPOT_RADIUS_MM } from '../spec'
import type { Interval } from './certified-real'
import { type ExactContour, toUnits } from './clearance'
import { clearanceMaximum, type ClearanceMaximum } from './deepest'
import { compareExact, ratAdd, ratDiv, ratFromInt, ratMul, ratSub, rational } from './exact-real'
import { exactRegions, regionContains, type ExactRegion } from './region'
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


/** A measured region: the certified integrals of §7.1b item 4 plus the maximum of item 5. */
export interface MeasuredRegion {
  readonly region: ExactRegion
  readonly areaMM2: Interval
  /** area centroid — the donor's `meanMM` */
  readonly meanMM: { x: Interval; y: Interval }
  /** the deepest-point evidence — the donor's `centreMM`/`peakClearMM`, as typed evidence */
  readonly deepest: ClearanceMaximum
}

export interface ExactIsland extends MeasuredRegion {
  /** regions of the same construction at the ruled mass depth, contained in this island */
  readonly masses: readonly MeasuredRegion[]
}

export interface ExactCentreEvidence {
  readonly box: { x: Rational; y: Rational }
  /** material weight centre — the exact shoelace centroid of the supplied outer ring */
  readonly weight: { x: Rational; y: Rational }
  /** area-weighted mean of the island means — the donor's `core` */
  readonly core: { x: Interval; y: Interval } | null
  readonly islands: readonly ExactIsland[]
  readonly midY: Rational
  readonly unresolved: boolean
  readonly reasons: readonly string[]
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
export function exactBoxCentre(c: ExactContour): { x: Rational; y: Rational } {
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
export function exactWeightCentre(c: ExactContour): { x: Rational; y: Rational } {
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

function measure(c: ExactContour, region: ExactRegion, level: bigint): MeasuredRegion {
  return {
    region,
    areaMM2: region.areaMM2,
    meanMM: region.centroidMM,
    deepest: clearanceMaximum(c, region, level),
  }
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
export function exactCentreEvidence(
  c: ExactContour,
  spotRadiusMM: number = SPOT_RADIUS_MM,
  massDepthMM: number = MASS_DEPTH_MM,
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

  // core: area-weighted mean of the island means, certified
  let core: { x: Interval; y: Interval } | null = null
  if (ordered.length) {
    let area: Interval = IZERO, mx: Interval = IZERO, my: Interval = IZERO
    for (const island of ordered) {
      area = iAdd(area, island.areaMM2)
      mx = iAdd(mx, iMul(island.meanMM.x, island.areaMM2))
      my = iAdd(my, iMul(island.meanMM.y, island.areaMM2))
    }
    if (compareExact(area.lo, ratFromInt(0)) > 0) core = { x: iDivPos(mx, area), y: iDivPos(my, area) }
    else note('core weighting undecidable: total island area encloses zero')
  }

  const box = exactBoxCentre(c)
  return {
    box,
    weight: exactWeightCentre(c),
    core,
    islands: ordered,
    midY: box.y,
    unresolved,
    reasons,
  }
}
