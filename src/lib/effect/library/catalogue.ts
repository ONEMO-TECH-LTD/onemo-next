import { LIBRARY_FAMILIES, specOf } from './class-registry'
import { selectVariant } from './selection'
import { materializeSelection } from './materialize'
import type { CornerMode } from './class-contract'
import type { LibraryFamily, LibrarySelection, PointMM } from './types'
import { bandIdOfMM, legalBoxMM } from './rules'
import { D4_VIEWS, sameView } from './transforms'
import type { LibraryTransform } from './types'
export { bandIdOfMM } from './rules'

/** v3: one canon population per frame, pitch-aware frames, and a band that is never null.
 *  No new fields — the semantics and the identity set changed, which is what the version says. */
export const CATALOGUE_FORMAT_VERSION = 3

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
  /** The band this layout occupies — read off its LEGAL box, not its outline. A published record
   *  always has one: a frame the board cannot hold at this lattice is not published at all. */
  bandId: number
  /** The legal box itself: the span the magnets occupy. Its longer side gives the band; the ratio
   *  between the sides says which shapes can wear this layout. */
  legalWidthMM: number
  legalHeightMM: number
}>

/** ONE enumeration, read by both the catalogue and the frame index: every class x type x variant x
 *  layout, with the selection that produced each record. Two walks would be two chances to
 *  disagree about what the library holds. */
function* enumerate(pitchMM: number): Generator<{ entry: CatalogueEntry; selection: LibrarySelection }> {
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
        yield {
          selection,
          entry: Object.freeze({
            classId, typeId: type.id,
            id: [classId, type.id, variant.id, layout.name, selection.view.transpose ? 't' : 'n', selection.view.flipX ? 'x' : 'n', selection.view.flipY ? 'y' : 'n'].map(encodeURIComponent).join('/'),
            label: variant.label + ' · ' + layout.name,
            pitchMM, corners: variant.outline.corners,
            nodesMM: materialized.nodesMM, outlineMM: materialized.outlineMM,
            widthMM: materialized.widthMM, heightMM: materialized.heightMM,
            frameCols: materialized.frameCols, frameRows: materialized.frameRows,
            bandId,
            legalWidthMM: legal.widthMM, legalHeightMM: legal.heightMM,
          }),
        }
      }
    }
  }
}

export function catalogue(pitchMM: number): readonly CatalogueEntry[] {
  return Object.freeze([...enumerate(pitchMM)].map((x) => x.entry))
}

/** A layout offered for a frame, and which of the eight ways round it is turned. The library keeps
 *  ONE canonical record per frame and the matcher says how it sits; publishing eight records would
 *  duplicate the library to paper over a matcher that compares one number. */
export interface FrameMatch {
  readonly entry: CatalogueEntry
  readonly view: LibraryTransform
  readonly nodesMM: readonly PointMM[]
  /** The frame this view presents — the request's own frame, by construction. */
  readonly frameCols: number
  readonly frameRows: number
}

const keyOf = (nodes: readonly PointMM[]): string =>
  nodes.map(([x, y]) => x.toFixed(3) + ',' + y.toFixed(3)).sort().join(';')
const frameKey = (cols: number, rows: number) => cols + 'x' + rows

const INDEX = new Map<number, Map<string, FrameMatch[]>>()

/** Built once per pitch through the SAME materialisation path every other consumer uses (law 12),
 *  so a matched layout is byte-identical to the one the admin previews. Every entry is presented in
 *  all eight lattice views; a view whose magnets land exactly where another view of the SAME entry
 *  already put them is dropped, because that is one arrangement reached twice — but a mirror that
 *  moves even one magnet is a different product and is kept (Dan, 2026-08-29, on the triangle
 *  chips: they stay). Identity across DIFFERENT entries is never deduped: the 1x1 square and the
 *  1x1 diamond share their single magnet and are two products. */
function indexAt(pitchMM: number): Map<string, FrameMatch[]> {
  const hit = INDEX.get(pitchMM)
  if (hit) return hit
  const index = new Map<string, FrameMatch[]>()
  for (const { entry, selection } of enumerate(pitchMM)) {
    const seen = new Set<string>()
    for (const view of D4_VIEWS) {
      const shown = materializeSelection({ ...selection, view }, pitchMM)
      const key = keyOf(shown.nodesMM)
      if (seen.has(key)) continue
      seen.add(key)
      const match: FrameMatch = {
        entry, view, nodesMM: shown.nodesMM,
        frameCols: shown.frameCols, frameRows: shown.frameRows,
      }
      const fk = frameKey(shown.frameCols, shown.frameRows)
      index.set(fk, [...(index.get(fk) ?? []), match])
    }
  }
  INDEX.set(pitchMM, index)
  return index
}

/**
 * Every layout the library holds on this frame at this pitch, in every way round that presents it.
 *
 * NO COUNT IS FROZEN and no winner is chosen: several entries legitimately share a frame — a 5x5
 * carries a square, a diamond and three triangles — and choosing between them here would be the
 * invented filter the pipeline forbids. The material decides, never this.
 */
export function layoutsForFrame(cols: number, rows: number, pitchMM: number): readonly FrameMatch[] {
  return indexAt(pitchMM).get(frameKey(cols, rows)) ?? []
}

export { sameView }
