import {
  bagOptionLayouts,
  classifiedLayouts,
  classifyBag,
  layoutIdentity,
  measureBagView,
  measureTightFits,
  normalizeBagOutline,
  prepareBag,
} from './lattice-bag-compute'
import {
  bandForRequiredSize,
  compareBagFits,
  isSnugWrap,
  judgeBagFit,
} from './lattice-bag-logic'
import {
  BAG_BANDS,
  CLASSIFIED_COUNTS,
  DISK_DIAMETER_MM,
  LATTICE_PITCH_MM,
  MAX_BAG_DISKS,
  type BagBandResult,
  type BagFit,
  type BagLayout,
  type BagMode,
  type PreparedBag,
} from './lattice-bag-spec'

export {
  BAG_BANDS,
  DISK_DIAMETER_MM,
  LATTICE_PITCH_MM,
  MAX_BAG_DISKS,
  classifyBag,
  normalizeBagOutline,
  prepareBag,
}
export type {
  BagBandId,
  BagBandResult,
  BagContact,
  BagFit,
  BagMode,
  BagShapeClass,
  BagView,
  PreparedBag,
} from './lattice-bag-spec'

function lawfulFits(prepared: PreparedBag, layout: BagLayout, allowRotation: boolean) {
  return measureTightFits(prepared, layout, allowRotation)
    .map(judgeBagFit)
    .filter(isSnugWrap)
    .sort(compareBagFits)
}

function uniqueLayouts(layouts: ReadonlyArray<BagLayout>) {
  const seen = new Set<string>()
  return layouts.filter(({ seats }) => {
    const identity = layoutIdentity(seats)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function fitLayouts(prepared: PreparedBag, layouts: ReadonlyArray<BagLayout>, allowRotation: boolean) {
  return uniqueLayouts(layouts)
    .flatMap((layout) => {
      const selectedByRotation = new Map<string, BagFit>()
      for (const fit of lawfulFits(prepared, layout, allowRotation)) {
        const key = fit.rotation.toFixed(9)
        if (!selectedByRotation.has(key)) selectedByRotation.set(key, fit)
      }
      return [...selectedByRotation.values()]
    })
    .sort(compareBagFits)
}

export function fitClassifiedOptions(prepared: PreparedBag, count: number, allowRotation = false): BagFit[] {
  return fitLayouts(prepared, classifiedLayouts(prepared, count), allowRotation)
}

export function fitClassifiedBag(prepared: PreparedBag, count: number, allowRotation = false): BagFit {
  const fit = fitClassifiedOptions(prepared, count, allowRotation)[0]
  if (!fit) throw new Error('No snug classified layout exists for this disk count')
  return fit
}

export function fitBagOptions(prepared: PreparedBag, count: number, allowRotation = false): BagFit[] {
  return fitLayouts(prepared, bagOptionLayouts(count), allowRotation)
}

export function fitBagMode(
  prepared: PreparedBag,
  count: number,
  mode: Exclude<BagMode, 'bands'>,
  allowRotation = false,
) {
  return mode === 'classified'
    ? fitClassifiedOptions(prepared, count, allowRotation)
    : fitLayouts(prepared, [...bagOptionLayouts(count), ...classifiedLayouts(prepared, count)], allowRotation)
}

export function fitClassifiedLadder(prepared: PreparedBag, allowRotation = false) {
  return CLASSIFIED_COUNTS[classifyBag(prepared)]
    .map((count) => fitClassifiedBag(prepared, count, allowRotation))
}

export function buildBagView(fit: BagFit) {
  return measureBagView(fit)
}

export function bagBandLabel(sizeMM: number) {
  return bandForRequiredSize(sizeMM)?.id ?? 'B5+'
}

export function fitBagCount(prepared: PreparedBag, count: number): BagFit {
  const fit = fitBagOptions(prepared, count)[0]
  if (!fit) throw new Error('No snug layout exists for this disk count')
  return fit
}

export function fitOptimalBagBands(
  prepared: PreparedBag,
  allowRotation = false,
  onProgress?: (completed: number, total: number) => void,
): BagBandResult[] {
  const exactByLayout = new Map<string, BagFit[]>()

  const exactFits = (layout: BagLayout) => {
    const identity = layoutIdentity(layout.seats)
    const cached = exactByLayout.get(identity)
    if (cached) return cached
    const fits = fitLayouts(prepared, [layout], allowRotation)
    exactByLayout.set(identity, fits)
    return fits
  }

  const candidatesByBand = new Map(BAG_BANDS.map(({ id }) => [id, [] as BagFit[]]))
  const maximumBand = BAG_BANDS[BAG_BANDS.length - 1]
  const seatsPerAxis = Math.floor((maximumBand.maxMM - DISK_DIAMETER_MM) / LATTICE_PITCH_MM) + 1
  for (let count = 1; count <= seatsPerAxis ** 2; count++) {
    const layouts = uniqueLayouts([...bagOptionLayouts(count), ...classifiedLayouts(prepared, count)])
    for (const layout of layouts) {
      for (const exact of exactFits(layout)) {
        const band = bandForRequiredSize(exact.sizeMM)
        if (band) candidatesByBand.get(band.id)?.push(exact)
      }
    }
  }

  return BAG_BANDS.map((band, bandIndex) => {
    const result = { ...band, candidates: (candidatesByBand.get(band.id) ?? []).sort(compareBagFits) }
    onProgress?.(bandIndex + 1, BAG_BANDS.length)
    return result
  })
}
