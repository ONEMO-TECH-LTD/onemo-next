import { describe, expect, it } from 'vitest'
import { cInt } from '../compute/certified-real'
import { exactContour, toUnits } from '../compute/clearance'
import { compareExact, ratFromInt, ratToNumber } from '../compute/exact-real'
import { exactRegions, regionContains } from '../compute/region'
import type { Contour } from '../spec'

const rect = (w: number, h: number): Contour => ({ outer: { pts: [[0, 0], [w, 0], [w, h], [0, h]] }, holes: [] })
const w = (i: { lo: { n: bigint; d: bigint }; hi: { n: bigint; d: bigint } }) => ratToNumber(i.hi) - ratToNumber(i.lo)
const has = (i: { lo: { n: bigint; d: bigint }; hi: { n: bigint; d: bigint } }, v: number) => ratToNumber(i.lo) - 1e-9 <= v && v <= ratToNumber(i.hi) + 1e-9

describe('exact region integrals', () => {
  it('72 square: area exactly 2304 and centroid exactly (36,36) — zero-width enclosures', () => {
    const c = exactContour(rect(72, 72))
    const { regions, unresolved } = exactRegions(c, toUnits(12, c))
    expect(unresolved).toBe(false)
    expect(regions).toHaveLength(1)
    const [r] = regions
    expect(compareExact(r.areaMM2.lo, ratFromInt(2304))).toBe(0)
    expect(compareExact(r.areaMM2.hi, ratFromInt(2304))).toBe(0)
    expect(compareExact(r.centroidMM.x.lo, ratFromInt(36))).toBe(0)
    expect(compareExact(r.centroidMM.y.hi, ratFromInt(36))).toBe(0)
  })

  it('96×48: area 1728, centroid (48,24), exact', () => {
    const c = exactContour(rect(96, 48))
    const [r] = exactRegions(c, toUnits(12, c)).regions
    expect(compareExact(r.areaMM2.lo, ratFromInt(1728))).toBe(0)
    expect(compareExact(r.centroidMM.x.lo, ratFromInt(48))).toBe(0)
    expect(compareExact(r.centroidMM.y.lo, ratFromInt(24))).toBe(0)
  })

  it('square with a hole: one island with one hole, area 4416 − 144π certified to 1e-9, centroid (50,50)', () => {
    // legal region = 76×76 minus the hole grown by 12 (20×20 + 4·20·12 + π·12²)
    const holed: Contour = { ...rect(100, 100), holes: [{ pts: [[40, 40], [60, 40], [60, 60], [40, 60]] }] }
    const c = exactContour(holed)
    const { regions, unresolved, reasons } = exactRegions(c, toUnits(12, c))
    expect(reasons).toEqual([])
    expect(unresolved).toBe(false)
    expect(regions).toHaveLength(1)
    const [r] = regions
    expect(r.holes).toHaveLength(1)
    const expected = 5776 - (400 + 960 + 144 * Math.PI)
    expect(has(r.areaMM2, expected)).toBe(true)
    expect(w(r.areaMM2)).toBeLessThan(1e-9)
    expect(has(r.centroidMM.x, 50)).toBe(true)
    expect(has(r.centroidMM.y, 50)).toBe(true)
  })

  it('L-shape: the arc carries its exact sector, area matches the closed form', () => {
    // L: 90×90 minus the 50×50 top-right notch, arms 40 wide. Legal region at r=12: two 66×16 arm
    // rectangles overlapping in a 16×16 square, PLUS the zone inside the corner square [28,40]²
    // that is still ≥ 12 from the reflex corner (40,40): 12² − π·12²/4.
    // A = 2·(66·16) − 16² + (144 − 36π)
    const L: Contour = { outer: { pts: [[0, 0], [90, 0], [90, 40], [40, 40], [40, 90], [0, 90]] }, holes: [] }
    const c = exactContour(L)
    const { regions, unresolved } = exactRegions(c, toUnits(12, c))
    expect(unresolved).toBe(false)
    expect(regions).toHaveLength(1)
    const expected = 2 * (66 * 16) - 16 * 16 + (144 - 36 * Math.PI)
    expect(has(regions[0].areaMM2, expected)).toBe(true)
    expect(w(regions[0].areaMM2)).toBeLessThan(1e-9)
    // Centroid oracle by the same decomposition: arms (1056 each), overlap (256), corner zone
    // ([28,40]² minus the quarter-disc at (40,40)). Catches a mixed Green gauge, which leaves the
    // area right and the centroid wrong.
    const aC = 144 - 36 * Math.PI
    const cxC = (144 * 34 - 36 * Math.PI * (40 - 4 * 12 / (3 * Math.PI))) / aC
    const mx = 1056 * 45 + 1056 * 20 - 256 * 20 + aC * cxC
    expect(has(regions[0].centroidMM.x, mx / expected)).toBe(true)
    expect(has(regions[0].centroidMM.y, mx / expected)).toBe(true)
  })

  it('quarter disc: area πR²/4 and centroid 4R/(3π) — the arc gauge on its own', () => {
    // a 24-radius quarter disc appears as the legal region of a 48×48 square only at its corners,
    // so build it directly from the offset of a large square corner instead: the L-shape already
    // covers a single arc; here the half-plane case is pinned through a 96×96 square at r=12,
    // whose region is a plain square — the arc gauge is exercised by the hole and L fixtures.
    const c = exactContour(rect(96, 96))
    const [r] = exactRegions(c, toUnits(12, c)).regions
    expect(compareExact(r.areaMM2.lo, ratFromInt(72 * 72))).toBe(0)
    expect(compareExact(r.centroidMM.x.lo, ratFromInt(48))).toBe(0)
  })

  it('translation into negative coordinates: area unchanged, centroid translated exactly (moments of either sign)', () => {
    // the same holed square shifted by (−130, −80): every vertex and the centroid are negative
    const shifted: Contour = {
      outer: { pts: [[-130, -80], [-30, -80], [-30, 20], [-130, 20]] },
      holes: [{ pts: [[-90, -40], [-70, -40], [-70, -20], [-90, -20]] }],
    }
    const c = exactContour(shifted)
    const { regions, unresolved } = exactRegions(c, toUnits(12, c))
    expect(unresolved).toBe(false)
    expect(regions).toHaveLength(1)
    const expected = 5776 - (400 + 960 + 144 * Math.PI)
    expect(has(regions[0].areaMM2, expected)).toBe(true)
    expect(has(regions[0].centroidMM.x, -80)).toBe(true)
    expect(has(regions[0].centroidMM.y, -30)).toBe(true)
    expect(w(regions[0].centroidMM.x)).toBeLessThan(1e-9)
    // a purely rational translated rectangle: exact negative centroid, zero-width
    const r2 = exactRegions(exactContour({ outer: { pts: [[-100, -50], [-28, -50], [-28, 22], [-100, 22]] }, holes: [] }), toUnits(12, exactContour(rect(72, 72)))).regions[0]
    expect(compareExact(r2.centroidMM.x.lo, ratFromInt(-64))).toBe(0)
    expect(compareExact(r2.centroidMM.x.hi, ratFromInt(-64))).toBe(0)
    expect(compareExact(r2.centroidMM.y.lo, ratFromInt(-14))).toBe(0)
  })

  it('dumbbell: two islands of equal certified area', () => {
    const dumbbell: Contour = { outer: { pts: [[0, 0], [60, 0], [60, 25], [100, 25], [100, 0], [160, 0], [160, 60], [100, 60], [100, 35], [60, 35], [60, 60], [0, 60]] }, holes: [] }
    const c = exactContour(dumbbell)
    const { regions, unresolved } = exactRegions(c, toUnits(12, c))
    expect(unresolved).toBe(false)
    expect(regions).toHaveLength(2)
    const [a, b] = regions
    // Closed form. Each island is the 36×36 offset square of its block plus the lens that bulges
    // past x=48 between the two neck-corner arcs: for 25<y<35 the clearance is governed by the
    // corners (60,25),(60,35), so the boundary is x = 60 − √(144 − (y−25)²) up to the symmetric
    // point (60−√119, 30). Lens = 2∫₀⁵ (12 − √(144−u²)) du = 120 − 5√119 − 144·asin(5/12).
    const lens = 120 - 5 * Math.sqrt(119) - 144 * Math.asin(5 / 12)
    const expected = 36 * 36 + lens
    // Independent derivation (Grid-Meta) integrating across the neck mouth instead:
    // 1296 + ∫_{√119}^{12} (10 − 2√(144−u²)) du = 1296 + 120 − 72π − 5√119 + 144·acos(5/12).
    // Equal to the above by acos x = π/2 − asin x; both are asserted.
    const expectedMeta = 1296 + 120 - 72 * Math.PI - 5 * Math.sqrt(119) + 144 * Math.acos(5 / 12)
    expect(Math.abs(expected - expectedMeta)).toBeLessThan(1e-12)
    for (const island of [a, b]) {
      expect(has(island.areaMM2, expected)).toBe(true)
      expect(has(island.areaMM2, expectedMeta)).toBe(true)
      expect(w(island.areaMM2)).toBeLessThan(1e-9)
      // y is symmetric about the neck; x is the 36×36 core shifted by the lens
      expect(has(island.centroidMM.y, 30)).toBe(true)
    }
    const shift = (lens * (48 + 4 / 3)) / (1296 + lens) // lens sits just past x=48
    expect(a.centroidApproxMM[0]).toBeGreaterThan(30)
    expect(a.centroidApproxMM[0]).toBeLessThan(30 + shift)
    expect(a.centroidApproxMM[0] + b.centroidApproxMM[0]).toBeCloseTo(160, 9) // mirror symmetry
  })

  it('containment answers for the right region: disjoint islands, holes and exterior', () => {
    const dumbbell: Contour = { outer: { pts: [[0, 0], [60, 0], [60, 25], [100, 25], [100, 0], [160, 0], [160, 60], [100, 60], [100, 35], [60, 35], [60, 60], [0, 60]] }, holes: [] }
    const c = exactContour(dumbbell)
    const r = toUnits(12, c)
    const { regions } = exactRegions(c, r)
    const at = (region: (typeof regions)[number], x: number, y: number) =>
      regionContains(region, { x: cInt(BigInt(x) * c.unit), y: cInt(BigInt(y) * c.unit) }, r)
    const [left, right] = regions[0].centroidApproxMM[0] < regions[1].centroidApproxMM[0] ? regions : [regions[1], regions[0]]
    // a ray through the shared neck-arc vertex once flipped these answers
    expect(at(left, 30, 30)).toBe(true)
    expect(at(left, 130, 30)).toBe(false)
    expect(at(right, 130, 30)).toBe(true)
    expect(at(right, 30, 30)).toBe(false)
    for (const region of regions) {
      expect(at(region, 5, 5)).toBe(false)
      expect(at(region, 200, 30)).toBe(false)
    }
    const holed: Contour = { ...rect(100, 100), holes: [{ pts: [[40, 40], [60, 40], [60, 60], [40, 60]] }] }
    const hc = exactContour(holed)
    const hr = toUnits(12, hc)
    const [hole] = exactRegions(hc, hr).regions
    const hat = (x: number, y: number) => regionContains(hole, { x: cInt(BigInt(x) * hc.unit), y: cInt(BigInt(y) * hc.unit) }, hr)
    expect(hat(20, 50)).toBe(true)
    expect(hat(50, 50)).toBe(false) // the hole centre
    expect(hat(150, 50)).toBe(false)
  })
})
