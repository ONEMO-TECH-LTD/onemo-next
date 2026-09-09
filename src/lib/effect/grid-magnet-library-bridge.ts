// grid-magnet-library-bridge.ts — THE ONE NARROW BRIDGE from the pure layout-library module to
// engine types. ADAPTER ONLY: the library materialises a selection into magnets and an outline
// in millimetres (library/materialize.ts); this file wraps that record in the engine's own
// Contour and GridResult and adds the engine-side constants. It does not resolve a selection,
// transform a layout, choose an outline, or decide what to do when a drawn population is not a
// shape yet — those are the library's, and it must not import its resolvers to do them.

import type { Contour, Pt } from './types'
import type { GridResult } from './grid-magnet'
import { MAGNET_DIA_SMALL_MM, RELEASED_PADDING_MM } from './grid-magnet-spec'
import {
  type CatalogueEntry,
  type MaterializedLibrary,
} from './library'

interface LibraryStageModel {
  contour: Contour
  grid: GridResult
  /** Why a population being drawn is not a saveable shape yet — null when it is. */
  error?: string | null
}

const pts = (ps: MaterializedLibrary['nodesMM']): Pt[] => ps.map((p) => [p[0], p[1]] as Pt)

/** The engine's picture of a materialised library record. The lattice field is seeded only when
 *  nothing is drawn, so an empty canvas still has somewhere to click. */
export function libraryStageModel(materialized: MaterializedLibrary, pitchMM: number): LibraryStageModel {
  return { ...stageOf(materialized, materialized.legalBoxMM, materialized.seedMM, pitchMM), error: materialized.error }
}

/** A RELEASED RECORD on the bench — the catalogue entry itself, put on the canvas as it was
 *  published: its magnets, its exact outline, its size. Nothing is solved; the Library already
 *  answered (Dan, 2026-09-09: "the grid settings display the sizes … without solving"). The legal box
 *  is the magnets' own extent, as the library materialises it. */
export function recordStageModel(record: CatalogueEntry, pitchMM: number): LibraryStageModel {
  const xs = record.nodesMM.map(([x]) => x), ys = record.nodesMM.map(([, y]) => y)
  const legalBoxMM = record.nodesMM.length
    ? { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) } : null
  return stageOf(record, legalBoxMM, null, pitchMM)
}

function stageOf(
  rec: Pick<MaterializedLibrary, 'nodesMM' | 'outlineMM' | 'outlinePath' | 'frameCols' | 'frameRows'>,
  legalBoxMM: MaterializedLibrary['legalBoxMM'], seedMM: MaterializedLibrary['seedMM'], pitchMM: number,
): LibraryStageModel {
  const nodesMM = pts(rec.nodesMM)
  const contour: Contour = { outer: { pts: pts(rec.outlineMM), path: rec.outlinePath ?? undefined }, holes: [] }
  const grid: GridResult = {
    anchors: nodesMM.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM })),
    pitchCentreMM: pitchMM,
    lattice: seedMM ? [[seedMM[0], seedMM[1]] as Pt] : [],
    phaseMM: [0, 0],
    panMM: [0, 0],
    spotRadiusMM: RELEASED_PADDING_MM,
    contactsMM: [],
    segments: [],
    legalBoxMM,
    centresMM: [],
    centreMainMM: [(rec.frameCols - 1) * pitchMM / 2, (rec.frameRows - 1) * pitchMM / 2],
    seatings: [],   // a library record is one authored population; nothing was registered
    canonSeatings: [],
  }
  return { contour, grid }
}
