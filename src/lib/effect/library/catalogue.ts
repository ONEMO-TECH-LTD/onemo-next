import { LIBRARY_FAMILIES, specOf } from './class-registry'
import { selectVariant } from './selection'
import { materializeSelection } from './materialize'
import type { OutlinePath } from './outline'
import type { CatalogueRole, CornerMode } from './class-contract'
import type { LibraryFamily, PointMM } from './types'
import { bandIdOfMM, legalBoxMM } from './rules'
export { bandIdOfMM } from './rules'

/** v4: every record states whether the engine may match it AUTOMATICALLY (canon) or only when it
 *  is explicitly asked for (preset). Square and rectangle are canon — the frame is the class, so a
 *  classified shape maps onto exactly one of them. Diamond and triangle are presets: node subsets
 *  on the same rectangular frames, kept for when someone chooses them (Dan, 2026-08-29: "the canon
 *  is square and rectangle the rest are layouts for us to have for potential presets").
 *
 *  It is a FIELD because a name cannot carry eligibility: with only classId to go on, a matcher
 *  keyed on the frame returned one square and twelve triangle presets for a 4x4, and the engine
 *  wrapped all thirteen. Automatic eligibility is matcher data, not a UI label. */
export const CATALOGUE_FORMAT_VERSION = 4

export type CatalogueEntry = Readonly<{
  classId: LibraryFamily
  /** Whether the engine may offer this record without being asked. */
  catalogueRole: CatalogueRole
  typeId: string
  id: string
  label: string
  pitchMM: number
  corners: CornerMode
  nodesMM: readonly PointMM[]
  /** The outline as points — a VIEW for Clipper and drawing, flattened from `outlinePath` where
   *  that exists. Nothing measures against it. */
  outlineMM: readonly PointMM[]
  /** THE OUTLINE, exact — lines and arcs of the rim radius — wherever it bends; null for a sharp or
   *  bevelled finish, whose offset polygon is already exact as points. Plain data, JSON-safe. */
  outlinePath: OutlinePath | null
  widthMM: number
  heightMM: number
  frameCols: number
  frameRows: number
  /** The band this layout occupies — read off its LEGAL box, not its outline. A published record
   *  always has one: a frame the board cannot hold at this lattice is not published at all. */
  bandId: number
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
        const bandId = bandIdOfMM(Math.max(legal.widthMM, legal.heightMM))
        if (bandId === null)
          throw new Error('library: ' + materialized.frameKey + ' at ' + pitchMM + 'mm has no released band')
        entries.push(Object.freeze({
          classId, catalogueRole: spec.catalogueRole, typeId: type.id,
          id: [classId, type.id, variant.id, layout.name, selection.view.transpose ? 't' : 'n', selection.view.flipX ? 'x' : 'n', selection.view.flipY ? 'y' : 'n'].map(encodeURIComponent).join('/'),
          label: variant.label + ' · ' + layout.name,
          pitchMM, corners: variant.outline.corners,
          nodesMM: materialized.nodesMM, outlineMM: materialized.outlineMM, outlinePath: materialized.outlinePath,
          widthMM: materialized.widthMM, heightMM: materialized.heightMM,
          frameCols: materialized.frameCols, frameRows: materialized.frameRows,
          bandId,
          legalWidthMM: legal.widthMM, legalHeightMM: legal.heightMM,
        }))
      }
    }
  }
  return Object.freeze(entries)
}

/** The layouts the engine may offer BY ITSELF for this frame: canon only. This is the automatic
 *  roster, and it is the one the pipeline's layout step reads.
 *
 *  Kept separate from `catalogue()` rather than replacing it: the full inventory is still what the
 *  admin browses, what a preset is chosen from, and what next-best may reach for. The two questions
 *  are "what exists" and "what may be matched without being asked", and only the second one belongs
 *  in an automatic answer. */
export function canonCatalogue(pitchMM: number): readonly CatalogueEntry[] {
  return catalogue(pitchMM).filter((entry) => entry.catalogueRole === 'canon')
}
