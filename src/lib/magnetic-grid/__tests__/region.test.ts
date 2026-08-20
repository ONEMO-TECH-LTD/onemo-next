import { describe, expect, it } from 'vitest'
import { exactContour, toUnits } from '../compute/clearance'
import { compareExact, ratFromInt, ratToNumber } from '../compute/exact-real'
import { exactRegions } from '../compute/region'
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
    expect(Math.abs(a.areaApproxMM2 - b.areaApproxMM2)).toBeLessThan(1e-9)
    // each island is the 36×36 offset square plus a small lens that bulges past x=48 between the
    // two neck-corner arcs (clearance there is governed by the corners, not the wall)
    expect(a.areaApproxMM2).toBeGreaterThan(36 * 36)
    expect(a.areaApproxMM2).toBeLessThan(36 * 36 + 10)
  })
})
