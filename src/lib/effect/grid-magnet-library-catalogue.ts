import { catalogue, type CatalogueEntry } from './library'
import { classifyShape, shapeFamilyOf } from './grid-magnet-class'
import type { Pt } from './types'

export const CATALOGUE_RUNTIME_STATUS = 'catalogue contract landed; runtime consumption pending'

const points = (outline: readonly (readonly [number, number])[]) => outline.map(([x, y]) => [x, y] as Pt)

export function classifiedLibraryCatalogue(pitchMM: number) {
  return catalogue(pitchMM).map((entry) => ({ entry, shapeClass: classifyShape(points(entry.outlineMM), pitchMM), shapeFamily: shapeFamilyOf(points(entry.outlineMM)) }))
}

export function catalogueCandidates(outer: readonly Pt[], pitchMM: number): readonly CatalogueEntry[] {
  const shape = classifyShape(outer, pitchMM)
  const family = shapeFamilyOf(outer)
  return classifiedLibraryCatalogue(pitchMM)
    .filter((item) => item.shapeFamily === family && item.shapeClass.cx === shape.cx && item.shapeClass.cy === shape.cy)
    .map((item) => item.entry)
}
