import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BAG_BANDS,
  DISK_DIAMETER_MM,
  classifyBag,
  fitBagCount,
  fitBagOptions,
  fitClassifiedBag,
  fitClassifiedOptions,
  fitOptimalBagBands,
  LATTICE_PITCH_MM,
  MAX_BAG_DISKS,
  normalizeBagOutline,
  prepareBag,
  type BagFit,
} from '../lattice-bag'
import { isSnugWrap, judgeBagFit } from '../lattice-bag-logic'

const irregular = normalizeBagOutline([
  [-60, -40], [10, -52], [58, -28], [34, 4], [72, 38],
  [8, 50], [-20, 30], [-68, 44], [-42, 4],
])

function squaredPitchUnits(a: readonly number[], b: readonly number[]) {
  return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) / LATTICE_PITCH_MM ** 2
}

function expectSnug(fit: BagFit) {
  expect(fit.minimumClearanceMM).toBeGreaterThanOrEqual(-0.05)
  expect(fit.contacts.length).toBeGreaterThanOrEqual(2)
  expect(fit.opposingContactPairs).toBeGreaterThan(0)
  expect(isSnugWrap(fit)).toBe(true)
}

describe('lattice bag prototype', () => {
  const prepared = prepareBag(irregular)

  it('moves every disk through one rigid 48 mm lattice transform', () => {
    const fit = fitBagCount(prepared, 40)
    for (let index = 1; index < fit.seats.length; index++) {
      const units2 = squaredPitchUnits(fit.seats[0], fit.seats[index])
      expect(units2).toBeCloseTo(Math.round(units2), 8)
    }
    expect(LATTICE_PITCH_MM).toBe(48)
    expect(DISK_DIAMETER_MM).toBe(24)
    expect(MAX_BAG_DISKS).toBe(1000)
  })

  it('offers straight and diagonal layouts without silently rotating them', () => {
    const fixed = fitBagOptions(prepared, 2)
    expect(fixed.every((option) => option.rotation === 0)).toBe(true)
    expect(new Set(fixed.map((option) => option.option))).toEqual(new Set([
      'Vertical', 'Horizontal', 'Diagonal ↘', 'Diagonal ↗',
    ]))
    expect(fixed.every(isSnugWrap)).toBe(true)
    const rotating = fitBagOptions(prepared, 2, true)
    expect(rotating.some((option) => Math.abs(option.rotation) > 1e-6)).toBe(true)
    expect(rotating.every((option) => Math.abs(option.rotation) <= Math.PI / 4)).toBe(true)
  })

  it('rejects containment with contact on only one side', () => {
    const candidate = fitBagCount(prepared, 2)
    const oneSided = judgeBagFit({ ...candidate, contacts: candidate.contacts.slice(0, 1), opposingContactPairs: 0 })
    expect(isSnugWrap(oneSided)).toBe(false)
    expectSnug(candidate)
  })

  it('keeps the single square disk centred with opposing wrap evidence', () => {
    const square = prepareBag(normalizeBagOutline([[-60, -60], [60, -60], [60, 60], [-60, 60]]))
    const fit = fitBagCount(square, 1)
    expect(fit.centreShiftMM).toBeLessThan(0.001)
    expect(fit.contacts).toHaveLength(4)
    expect(fit.opposingContactPairs).toBeGreaterThanOrEqual(2)
    expectSnug(fit)
  })

  it('finds a snug rigid-lattice result for every requested count through forty', () => {
    for (let count = 1; count <= 40; count++) {
      expectSnug(fitBagCount(prepared, count))
    }
  })

  it('uses the material centroid as a ranking reference, never as a rigid anchor', () => {
    const fit = fitBagCount(prepared, 2)
    const measuredShift = Math.hypot(
      fit.centre[0] - fit.materialCentre[0],
      fit.centre[1] - fit.materialCentre[1],
    )
    expect(fit.centreShiftMM).toBeCloseTo(measuredShift, 8)
    expectSnug(fit)
  })

  it('re-settles deterministically without deforming the outline or lattice', () => {
    const nine = fitBagCount(prepared, 9)
    fitBagCount(prepared, 10)
    const back = fitBagCount(prepared, 9)
    expect(back.seats).toEqual(nine.seats)
    expect(back.outline).toEqual(nine.outline)
    const ratios = back.outline.map(([x, y], index) => {
      const [sx, sy] = prepared.outline[index]
      return Math.hypot(x, y) / Math.hypot(sx, sy)
    }).filter(Number.isFinite)
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThan(1e-8)
  })

  it('builds deterministic classified frames without changing the count', () => {
    const portrait = prepareBag(normalizeBagOutline([[-30, -90], [30, -90], [30, 90], [-30, 90]]))
    const landscape = prepareBag(normalizeBagOutline([[-90, -30], [90, -30], [90, 30], [-90, 30]]))
    const square = prepareBag(normalizeBagOutline([[-60, -60], [60, -60], [60, 60], [-60, 60]]))
    expect(classifyBag(portrait)).toBe('Portrait rectangle')
    expect(classifyBag(landscape)).toBe('Landscape rectangle')
    expect(classifyBag(square)).toBe('Square')
    expect(fitClassifiedBag(portrait, 6).seats).toHaveLength(6)
    expect(fitClassifiedBag(landscape, 6).seats).toHaveLength(6)
    expect(fitClassifiedBag(square, 9).seats).toHaveLength(9)
    expect(fitClassifiedOptions(portrait, 6).every(isSnugWrap)).toBe(true)
  })

  it('lets size ranges plus wrap select counts and preserves every lawful layout', () => {
    expect(BAG_BANDS).toEqual([
      { id: 'B1', minMM: 24, maxMM: 71 },
      { id: 'B2', minMM: 72, maxMM: 119 },
      { id: 'B3', minMM: 120, maxMM: 167 },
      { id: 'B4', minMM: 168, maxMM: 216 },
    ])
    const progress: Array<[number, number]> = []
    const bands = fitOptimalBagBands(prepared, false, (completed, total) => progress.push([completed, total]))
    expect(progress).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]])
    for (const band of bands) {
      expect(band.candidates.length).toBeGreaterThan(0)
      for (const candidate of band.candidates) {
        expectSnug(candidate)
        const wholeMM = Math.ceil(candidate.sizeMM - 0.001)
        expect(wholeMM).toBeGreaterThanOrEqual(band.minMM)
        expect(wholeMM).toBeLessThanOrEqual(band.maxMM)
      }
    }
    expect(new Set(bands[3].candidates.map((candidate) => candidate.seats.length)).size).toBeGreaterThan(1)
  })

  it('finds the square wrap ladder without hardcoding disk counts to bands', () => {
    const square = prepareBag(normalizeBagOutline([[-60, -60], [60, -60], [60, 60], [-60, 60]]))
    const bands = fitOptimalBagBands(square)
    expect(bands.every(({ candidates }) => candidates.length > 0)).toBe(true)
    expect(bands.map(({ candidates }) => candidates[0].seats.length)).toEqual([1, 4, 9, 16])
    expect(bands.every(({ candidates }) => candidates.every(isSnugWrap))).toBe(true)
  })

  it('keeps policy out of Compute and solver law out of the UI shell', () => {
    const compute = readFileSync(new URL('../lattice-bag-compute.ts', import.meta.url), 'utf8')
    const logic = readFileSync(new URL('../lattice-bag-logic.ts', import.meta.url), 'utf8')
    const spec = readFileSync(new URL('../lattice-bag-spec.ts', import.meta.url), 'utf8')
    const engine = readFileSync(new URL('../lattice-bag.ts', import.meta.url), 'utf8')
    const worker = readFileSync(new URL('../lattice-bag.worker.ts', import.meta.url), 'utf8')
    const ui = readFileSync(new URL('../../app/(dev)/effect-creator/lattice-bag/LatticeBagPrototype.tsx', import.meta.url), 'utf8')
    expect(compute).not.toMatch(/from ['"]\.\/lattice-bag-logic['"]|isSnugWrap|compareBagFits/)
    expect(logic).not.toMatch(/from ['"]\.\/lattice-bag-compute['"]/)
    expect(worker).not.toMatch(/isSnugWrap|compareBagFits|pointInPolygon|Clipper/)
    expect(ui).not.toMatch(/pointInPolygon|traceContourRaw|maskFromImageData|classifiedCounts|bandForSize|\[1,\s*2,\s*6,\s*8\]|\[1,\s*4,\s*9,\s*16\]/)
    expect(spec).toMatch(/BAG_BANDS|fitEpsilonMM|opposingContactDotMax|peripheryReachMM/)
    expect(`${compute}\n${logic}\n${engine}\n${worker}\n${ui}`).not.toMatch(/const BAG_BANDS|fitEpsilonMM\s*:/)
  })
})
