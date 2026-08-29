// grid-magnet-library-catalogue.ts — THE MATCHER'S ENGINE-SIDE ADAPTER.
//
// Type conversion, and nothing else. WHICH layouts live on a frame, and in which of the eight ways
// round, is the library's own law and lives beside the transform that applies it — this file used
// to answer that question itself, with only two of the eight views and a hardcoded shape family
// whose invented fill < 0.68 cut silently deleted the right layout whenever it guessed wrong.
//
// It PROPOSES; it never adjudicates. A frame is a quantised capacity, not proof that a population
// fits a concave shape. Seating and wrap remain the only authorities on what actually fits.

import { catalogue, layoutsForFrame as libraryLayoutsForFrame, type CatalogueEntry, type FrameMatch } from './library'
import type { Pt } from './types'

/** A library layout offered for a frame, with its magnets in the engine's own mutable point type. */
export interface FrameCandidate {
  readonly entry: CatalogueEntry
  readonly match: FrameMatch
  readonly nodesMM: readonly Pt[]
}

/** Every layout the library holds on this frame at this pitch, in every way round that presents it.
 *  No winner, no frozen count: several entries share a frame and all of them come back. */
export function layoutsForFrame(cols: number, rows: number, pitchMM: number): readonly FrameCandidate[] {
  return libraryLayoutsForFrame(cols, rows, pitchMM).map((match) => ({
    entry: match.entry, match, nodesMM: match.nodesMM.map(([x, y]) => [x, y] as Pt),
  }))
}

/** Every entry at this pitch, unmatched — the catalogue as the certified reference set. */
export function catalogueAt(pitchMM: number): readonly CatalogueEntry[] {
  return catalogue(pitchMM)
}
