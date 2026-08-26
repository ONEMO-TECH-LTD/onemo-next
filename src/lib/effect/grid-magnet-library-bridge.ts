// grid-magnet-library-bridge.ts — THE ONE NARROW BRIDGE from the pure layout-library module to
// engine types. ADAPTER ONLY: the library materialises a selection into magnets and an outline
// in millimetres (library/materialize.ts); this file wraps that record in the engine's own
// Contour and GridResult and adds the engine-side constants. It does not resolve a selection,
// transform a layout, choose an outline, or decide what to do when a drawn population is not a
// shape yet — those are the library's, and it must not import its resolvers to do them.

import type { Contour, Pt } from './types'
import type { GridResult } from './grid-magnet'
import { spotRadiusOf } from './grid-magnet-compute'
import { MAGNET_DIA_SMALL_MM, RELEASED_PADDING_MM } from './grid-magnet-spec'
import {
  materializeSelection, materializeDraft,
  type MaterializedLibrary, type LibrarySelection,
} from './library'

export type { LibrarySelection } from './library'

export interface LibraryStageModel {
  contour: Contour
  grid: GridResult
  /** Why a population being drawn is not a saveable shape yet — null when it is. */
  error?: string | null
}

const pts = (ps: MaterializedLibrary['nodesMM']): Pt[] => ps.map((p) => [p[0], p[1]] as Pt)

/** The engine's picture of a materialised library record. The lattice field is seeded only when
 *  nothing is drawn, so an empty canvas still has somewhere to click. */
function toStage(m: MaterializedLibrary, pitchMM: number, padMM: number): LibraryStageModel {
  const nodesMM = pts(m.nodesMM)
  const contour: Contour = { outer: { pts: pts(m.outlineMM) } , holes: [] }
  const grid: GridResult = {
    anchors: nodesMM.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM })),
    pitchCentreMM: pitchMM,
    lattice: m.seedMM ? [[m.seedMM[0], m.seedMM[1]] as Pt] : [],
    phaseMM: [0, 0],
    panMM: [0, 0],
    spotRadiusMM: spotRadiusOf(padMM),
    contactsMM: [],
    segments: [],
    centresMM: [],
    centreMainMM: [(m.frameCols - 1) * pitchMM / 2, (m.frameRows - 1) * pitchMM / 2],
  }
  return { contour, grid, error: m.error }
}

export function libraryStageModel(sel: LibrarySelection, pitchMM: number, padMM: number): LibraryStageModel {
  const m = materializeSelection(sel, pitchMM, padMM)
  // a corpus selection always has magnets, so the lattice seed is not used here
  return toStage({ ...m, seedMM: null }, pitchMM, padMM)
}

/** AUTHORING (Dan, 08-25 — sandbox drafts): a draft's own nodes drawn on the selected frame. */
export function draftStageModel(
  sel: LibrarySelection, nodes: ReadonlyArray<readonly [number, number]>, pitchMM: number, padMM: number,
  frameCols: number, frameRows: number,
): LibraryStageModel {
  return toStage(materializeDraft(sel, nodes, pitchMM, padMM, frameCols, frameRows), pitchMM, padMM)
}

/** Selection -> the engine-space record the pipeline consumes. */
export function libraryArrangement(sel: LibrarySelection, pitchMM: number, padMM = RELEASED_PADDING_MM): MaterializedLibrary {
  return materializeSelection(sel, pitchMM, padMM)
}

/** Preview metadata — AUTHORING DISPLAY ONLY, never part of the pipeline arrangement (Meta M1:
 *  the declared library family must not pre-empt Step-1's open recognition-source ruling). */
export function libraryPreview(sel: LibrarySelection, pitchMM: number, padMM: number = RELEASED_PADDING_MM): MaterializedLibrary {
  return materializeSelection(sel, pitchMM, padMM)
}
