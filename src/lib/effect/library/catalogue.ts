import { LIBRARY_FAMILIES, specOf } from './class-registry'
import { selectVariant } from './selection'
import { materializeSelection } from './materialize'
import type { CornerMode } from './class-contract'
import type { LibraryFamily, PointMM } from './types'
import { bandIdOfMM, legalBoxMM } from './rules'
export { bandIdOfMM } from './rules'

/** v2 adds `bandId` — the band a record occupies at its own canonical size. */
export const CATALOGUE_FORMAT_VERSION = 2

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
  /** The band this layout occupies — read off its LEGAL box, not its outline. */
  bandId: number | null
  /** The legal box itself: the span the magnets occupy. Its longer side gives the band; the ratio
   *  between the sides says which shapes can wear this layout. */
  legalWidthMM: number
  legalHeightMM: number
}>

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
        const legal = legalBoxMM(materialized.nodesMM)
        entries.push(Object.freeze({
          classId, typeId: type.id,
          id: [classId, type.id, variant.id, layout.name, selection.view.transpose ? 't' : 'n', selection.view.flipX ? 'x' : 'n', selection.view.flipY ? 'y' : 'n'].map(encodeURIComponent).join('/'),
          label: variant.label + ' · ' + layout.name,
          pitchMM, corners: variant.outline.corners,
          nodesMM: materialized.nodesMM, outlineMM: materialized.outlineMM,
          widthMM: materialized.widthMM, heightMM: materialized.heightMM,
          frameCols: materialized.frameCols, frameRows: materialized.frameRows,
          bandId: bandIdOfMM(Math.max(legal.widthMM, legal.heightMM)),
          legalWidthMM: legal.widthMM, legalHeightMM: legal.heightMM,
        }))
      }
    }
  }
  return Object.freeze(entries)
}
