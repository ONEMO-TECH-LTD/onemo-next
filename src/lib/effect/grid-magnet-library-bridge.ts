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
  const nodesMM = pts(materialized.nodesMM)
  const contour: Contour = { outer: { pts: pts(materialized.outlineMM) } , holes: [] }
  const grid: GridResult = {
    anchors: nodesMM.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM })),
    pitchCentreMM: pitchMM,
    lattice: materialized.seedMM ? [[materialized.seedMM[0], materialized.seedMM[1]] as Pt] : [],
    phaseMM: [0, 0],
    panMM: [0, 0],
    spotRadiusMM: RELEASED_PADDING_MM,
    contactsMM: [],
    segments: [],
    centresMM: [],
    centreMainMM: [(materialized.frameCols - 1) * pitchMM / 2, (materialized.frameRows - 1) * pitchMM / 2],
    seatings: [],   // a library record is one authored population; nothing was registered
    canonSeatings: [],
  }
  return { contour, grid, error: materialized.error }
}
