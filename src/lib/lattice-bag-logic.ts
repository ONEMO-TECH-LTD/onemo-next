import {
  BAG_BANDS,
  BAG_SOLVER_SPEC,
  type BagContact,
  type BagFit,
} from './lattice-bag-spec'

function dot(a: readonly number[], b: readonly number[]) {
  return a[0] * b[0] + a[1] * b[1]
}

export function opposingContactPairs(contacts: ReadonlyArray<BagContact>) {
  let pairs = 0
  for (let left = 0; left < contacts.length; left++) {
    for (let right = left + 1; right < contacts.length; right++) {
      if (dot(contacts[left].inward, contacts[right].inward) <= BAG_SOLVER_SPEC.opposingContactDotMax) pairs++
    }
  }
  return pairs
}

export function isSnugWrap(fit: BagFit) {
  return fit.minimumClearanceMM >= -BAG_SOLVER_SPEC.contactToleranceMM
    && fit.contacts.length >= 2
    && fit.opposingContactPairs > 0
    && fit.unprotectedSeatCentres.length === 0
    && fit.maximumUnsupportedSpanMM <= BAG_SOLVER_SPEC.maximumUnsupportedSpanMM + BAG_SOLVER_SPEC.fitEpsilonMM
}

export function judgeBagFit(measured: BagFit): BagFit {
  return { ...measured, opposingContactPairs: opposingContactPairs(measured.contacts) }
}

export function compareBagFits(a: BagFit, b: BagFit): number {
  return a.centreShiftMM - b.centreShiftMM
    || a.largestFlapAreaMM2 - b.largestFlapAreaMM2
    || a.unheldAreaMM2 - b.unheldAreaMM2
    || a.maximumUnsupportedSpanMM - b.maximumUnsupportedSpanMM
    || a.uncoveredPeripheryMM - b.uncoveredPeripheryMM
    || b.opposingContactPairs - a.opposingContactPairs
    || b.contacts.length - a.contacts.length
    || a.sizeMM - b.sizeMM
    || a.option.localeCompare(b.option)
}

export function bandForRequiredSize(sizeMM: number) {
  const requiredWholeMM = Math.ceil(sizeMM - BAG_SOLVER_SPEC.fitEpsilonMM)
  return BAG_BANDS.find(({ minMM, maxMM }) => requiredWholeMM >= minMM && requiredWholeMM <= maxMM)
}
