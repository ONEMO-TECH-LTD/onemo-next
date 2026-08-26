import { LIBRARY_FAMILIES, specOf } from './class-registry'
import { selectVariant } from './selection'
import { materializeSelection } from './materialize'
import type { CornerMode } from './class-contract'
import type { LibraryFamily, PointMM } from './types'

export const CATALOGUE_FORMAT_VERSION = 1

export type CatalogueEntry = Readonly<{
  classId: LibraryFamily
  typeId: string
  id: string
  label: string
  pitchMM: number
  corners: CornerMode
  nodesMM: readonly PointMM[]
  outlineMM: readonly PointMM[]
  widthMM: number
  heightMM: number
  frameCols: number
  frameRows: number
}>

const bounds = (points: readonly PointMM[]) => ({
  widthMM: Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x)),
  heightMM: Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y)),
})

export function catalogue(pitchMM: number): readonly CatalogueEntry[] {
  const entries: CatalogueEntry[] = []
  for (const classId of LIBRARY_FAMILIES) {
    const spec = specOf(classId)
    const opened = spec.open({ classId, frameKey: '', layoutId: '', view: { transpose: false, flipX: false, flipY: false } }, pitchMM)
    for (const type of spec.types) for (const variant of spec.variants(type.id, pitchMM)) {
      const selected = selectVariant(opened, variant)
      for (const layout of variant.frame.layouts) {
        const selection = { ...selected, layoutId: layout.name }
        const materialized = materializeSelection(selection, pitchMM)
        const size = bounds(materialized.outlineMM)
        entries.push(Object.freeze({
          classId, typeId: type.id,
          id: [classId, type.id, variant.id, layout.name, selection.view.transpose ? 't' : 'n', selection.view.flipX ? 'x' : 'n', selection.view.flipY ? 'y' : 'n'].map(encodeURIComponent).join('/'),
          label: variant.label + ' · ' + layout.name,
          pitchMM, corners: variant.outline.corners,
          nodesMM: materialized.nodesMM, outlineMM: materialized.outlineMM,
          widthMM: size.widthMM, heightMM: size.heightMM,
          frameCols: materialized.frameCols, frameRows: materialized.frameRows,
        }))
      }
    }
  }
  return Object.freeze(entries)
}
