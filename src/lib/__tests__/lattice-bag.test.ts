import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Pt } from '../effect/types'
import {
  BAG_BANDS,
  DISK_DIAMETER_MM,
  classifyBag,
  fitBagCount,
  fitBagMode,
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
import { bagOptionLayouts, layoutIdentity, measureTightFits } from '../lattice-bag-compute'
import { compareBagFits, isSnugWrap, judgeBagFit } from '../lattice-bag-logic'

const irregular = normalizeBagOutline([
  [-60, -40], [10, -52], [58, -28], [34, 4], [72, 38],
  [8, 50], [-20, 30], [-68, 44], [-42, 4],
])

function squaredPitchUnits(a: readonly number[], b: readonly number[]) {
  return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) / LATTICE_PITCH_MM ** 2
}

function boundsOf(points: ReadonlyArray<Pt>) {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

function expectSnug(fit: BagFit) {
  expect(fit.minimumClearanceMM).toBeGreaterThanOrEqual(-0.05)
  expect(fit.contacts.length).toBeGreaterThanOrEqual(2)
  expect(fit.opposingContactPairs).toBeGreaterThan(0)
  expect(fit.maximumUnsupportedSpanMM).toBeLessThanOrEqual(DISK_DIAMETER_MM + 0.001)
  expect(isSnugWrap(fit)).toBe(true)
}

describe('lattice bag prototype', () => {
  const prepared = prepareBag(irregular)
  const square = prepareBag(normalizeBagOutline([[-60, -60], [60, -60], [60, 60], [-60, 60]]))
  const diamond = prepareBag(normalizeBagOutline([[0, -90], [90, 0], [0, 90], [-90, 0]]))

  it('moves every disk through one rigid 48 mm lattice transform', () => {
    const fit = fitClassifiedBag(square, 4)
    for (let index = 1; index < fit.seats.length; index++) {
      const units2 = squaredPitchUnits(fit.seats[0], fit.seats[index])
      expect(units2).toBeCloseTo(Math.round(units2), 8)
    }
    expect(LATTICE_PITCH_MM).toBe(48)
    expect(DISK_DIAMETER_MM).toBe(24)
    expect(MAX_BAG_DISKS).toBe(1000)
  })

  it('offers straight and diagonal layouts without silently rotating them', () => {
    const fixed = fitBagOptions(diamond, 2)
    expect(fixed.length).toBeGreaterThan(0)
    expect(fixed.every((option) => option.rotation === 0)).toBe(true)
    expect(fixed.every(isSnugWrap)).toBe(true)
    const rotating = fitBagOptions(diamond, 2, true)
    expect(rotating.some((option) => Math.abs(option.rotation) > 1e-6)).toBe(true)
    expect(rotating.every((option) => Math.abs(option.rotation) <= Math.PI / 4)).toBe(true)
  })

  it('rejects containment with contact on only one side', () => {
    const candidate = fitBagCount(square, 2)
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

  it('rejects an uninterrupted unsupported span wide enough to fit a disk', () => {
    const portrait = prepareBag(normalizeBagOutline([[-30, -90], [30, -90], [30, 90], [-30, 90]]))
    expect(fitClassifiedOptions(portrait, 6)).toEqual([])
    expectSnug(fitClassifiedBag(square, 4))
  })

  it('uses the material centroid as a ranking reference, never as a rigid anchor', () => {
    const fit = fitBagCount(square, 2)
    const measuredShift = Math.hypot(
      fit.centre[0] - fit.materialCentre[0],
      fit.centre[1] - fit.materialCentre[1],
    )
    expect(fit.centreShiftMM).toBeCloseTo(measuredShift, 8)
    expectSnug(fit)
  })

  it('returns exact unheld material polygons with areas and centroids', () => {
    const fit = measureTightFits(prepared, bagOptionLayouts(2)[0], false)[0]
    expect(fit.holdRadiusMM).toBe(48)
    expect(fit.flaps.length).toBeGreaterThan(0)
    expect(fit.unheldAreaMM2).toBeCloseTo(fit.flaps.reduce((area, flap) => area + flap.areaMM2, 0), 8)
    expect(fit.largestFlapAreaMM2).toBeCloseTo(Math.max(...fit.flaps.map((flap) => flap.areaMM2)), 8)
    expect(fit.flaps.every((flap) => flap.areaMM2 > 0 && flap.centroid.every(Number.isFinite))).toBe(true)
  })

  it('measures residual flaps but rejects only one that can seat another disk', () => {
    const raw = measureTightFits(prepared, bagOptionLayouts(2)[0], false)[0]
    expect(raw.flaps.length).toBeGreaterThan(0)
    expect(raw.unprotectedSeatCentres).toEqual([])
    const squareFit = fitBagCount(square, 1)
    expect(isSnugWrap(judgeBagFit({ ...squareFit, unprotectedSeatCentres: [[0, 0]] }))).toBe(false)
  })

  it('re-settles deterministically without deforming the outline or lattice', () => {
    const nine = fitClassifiedBag(square, 9)
    fitClassifiedBag(square, 4)
    const back = fitClassifiedBag(square, 9)
    expect(back.seats).toEqual(nine.seats)
    expect(back.outline).toEqual(nine.outline)
    const sourceBounds = boundsOf(square.outline)
    const fittedBounds = boundsOf(back.outline)
    expect(fittedBounds.width / sourceBounds.width).toBeCloseTo(fittedBounds.height / sourceBounds.height, 8)
  })

  it('builds deterministic classified frames without changing the count', () => {
    const portrait = prepareBag(normalizeBagOutline([[-60, -120], [60, -120], [60, 120], [-60, 120]]))
    const landscape = prepareBag(normalizeBagOutline([[-120, -60], [120, -60], [120, 60], [-120, 60]]))
    expect(classifyBag(portrait)).toBe('Portrait rectangle')
    expect(classifyBag(landscape)).toBe('Landscape rectangle')
    expect(classifyBag(square)).toBe('Square')
    expect(fitClassifiedOptions(portrait, 2).map(({ option }) => option)).toEqual(['Portrait rectangle · 1×2'])
    expect(fitClassifiedOptions(landscape, 2).map(({ option }) => option)).toEqual(['Landscape rectangle · 2×1'])
    expect(fitClassifiedBag(square, 9).seats).toHaveLength(9)
    expect(fitClassifiedOptions(square, 4).every(isSnugWrap)).toBe(true)
  })

  it('lets size ranges plus wrap select counts and preserves every lawful layout', () => {
    expect(BAG_BANDS).toEqual([
      { id: 'B1', minMM: 24, maxMM: 71 },
      { id: 'B2', minMM: 72, maxMM: 119 },
      { id: 'B3', minMM: 120, maxMM: 167 },
      { id: 'B4', minMM: 168, maxMM: 216 },
    ])
    const progress: Array<[number, number]> = []
    const bands = fitOptimalBagBands(square, false, (completed, total) => progress.push([completed, total]))
    expect(progress).not.toHaveLength(0)
    expect(progress.every(([, total]) => total === progress[0][1])).toBe(true)
    expect(progress.at(-1)).toEqual([progress[0][1], progress[0][1]])
    for (const band of bands) {
      const identities = band.candidates.map(({ seats, option, rotation }) => `${seats.length}:${option}:${rotation.toFixed(9)}`)
      expect(new Set(identities).size).toBe(identities.length)
      for (const candidate of band.candidates) {
        expectSnug(candidate)
        const wholeMM = Math.ceil(candidate.sizeMM - 0.001)
        expect(wholeMM).toBeGreaterThanOrEqual(band.minMM)
        expect(wholeMM).toBeLessThanOrEqual(band.maxMM)
      }
    }
    const allCandidates = bands.flatMap(({ candidates }) => candidates)
    expect(allCandidates.length).toBeGreaterThan(0)
    expect(allCandidates.every((candidate) => candidate.maximumUnsupportedSpanMM <= DISK_DIAMETER_MM + 0.001)).toBe(true)
    expect(new Set(allCandidates.map(({ seats, option, rotation }) => `${seats.length}:${option}:${rotation.toFixed(9)}`)).size)
      .toBe(allCandidates.length)
  })

  it('returns one centred result per magnet-addition layout, not contact-point translations', () => {
    const fits = fitBagOptions(diamond, 2)
    expect(fits.length).toBeGreaterThan(0)
    expect(fits.every((fit) => fit.centreShiftMM <= 0.001)).toBe(true)
    expect(new Set(fits.map((fit) => `${fit.option}:${fit.rotation}`)).size).toBe(fits.length)
    const alternatives = fitBagOptions(diamond, 2, true)
    const grouped = new Map<string, BagFit[]>()
    for (const fit of alternatives) {
      const key = `${fit.option}:${fit.rotation.toFixed(6)}`
      grouped.set(key, [...(grouped.get(key) ?? []), fit])
    }
    expect([...grouped.values()].every((group) => group.length === 1)).toBe(true)
  })

  it('deduplicates layouts that differ only by their local origin', () => {
    expect(layoutIdentity([[0, 0], [0, 48]])).toBe(layoutIdentity([[0, -24], [0, 24]]))
  })

  it('lets Auto consider the detected class frame without duplicating a neutral layout', () => {
    const auto = fitBagMode(square, 4, 'auto')
    expect(auto.some(({ option }) => option === 'Square · 2×2')).toBe(true)
    expect(new Set(auto.map(({ seats, option, rotation }) => `${seats.length}:${option}:${rotation.toFixed(9)}`)).size)
      .toBe(auto.length)
  })

  it('finds the square wrap ladder without hardcoding disk counts to bands', () => {
    const bands = fitOptimalBagBands(square)
    const candidates = bands.flatMap(({ candidates }) => candidates)
    expect(candidates.every(isSnugWrap)).toBe(true)
    const counts = new Set(candidates.map((candidate) => candidate.seats.length))
    for (const count of [1, 2, 4, 9]) expect(counts.has(count)).toBe(true)
  })

  it('jointly evaluates centre, pan and scale before Logic selects one layout result', () => {
    const vertical = bagOptionLayouts(2).find(({ label }) => label === 'Vertical')!
    const measured = measureTightFits(prepared, vertical, false).map(judgeBagFit)
    expect(measured).toHaveLength(1)
    const selected = fitBagOptions(diamond, 2).find(({ option }) => option === 'Vertical')!
    const diamondVertical = bagOptionLayouts(2).find(({ label }) => label === 'Vertical')!
    const lawful = measureTightFits(diamond, diamondVertical, false).map(judgeBagFit).filter(isSnugWrap)
    expect(selected).toEqual([...lawful].sort(compareBagFits)[0])
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
    expect(spec).toMatch(/AUTO_LAYOUTS|BAG_BANDS|fitEpsilonMM|opposingContactDotMax|peripheryReachMM/)
    expect(`${compute}\n${logic}\n${engine}\n${worker}\n${ui}`).not.toMatch(/const BAG_BANDS|fitEpsilonMM\s*:/)
  })
})
