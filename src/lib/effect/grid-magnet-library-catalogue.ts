// THE CANON MATCHER — an ordered frame and a pitch in, the one layout the engine may offer by
// itself out. Dan, 2026-08-30: the classifier is "a nudge for the current engine to know
// orientation and precise class to skip searching endlessly and match the layout from canon first".
//
// Canon is square and rectangle. Diamond and triangle are presets and never answer here — a 4x4
// frame carries one square and twelve triangle presets, and matching them all is what turned one
// layout into thirteen and a click into fifty-two wrap solves.
//
// The frame carries orientation: 3x4 and 4x3 are different records, so nothing turns anything.

import { canonCatalogue, type CatalogueEntry } from './library'

const frameKey = (cols: number, rows: number) => cols + 'x' + rows

/** Built once per pitch. The naive lookup re-materialised the whole catalogue per query, which
 *  turned a matcher gate into a 51-second timeout. */
const byPitch = new Map<number, ReadonlyMap<string, CatalogueEntry>>()

function canonIndex(pitchMM: number): ReadonlyMap<string, CatalogueEntry> {
  const hit = byPitch.get(pitchMM)
  if (hit) return hit
  const index = new Map<string, CatalogueEntry>()
  for (const entry of canonCatalogue(pitchMM)) {
    const key = frameKey(entry.frameCols, entry.frameRows)
    if (index.has(key)) throw new Error('library: ' + key + ' at ' + pitchMM + 'mm has two canon layouts')
    index.set(key, entry)
  }
  byPitch.set(pitchMM, index)
  return index
}

/** The canon layout for this ordered frame, or null when the board holds no such frame at this
 *  lattice. Never substitutes another frame, never returns a preset. */
export function canonLayoutForFrame(
  pitchMM: number, cols: number, rows: number,
): CatalogueEntry | null {
  return canonIndex(pitchMM).get(frameKey(cols, rows)) ?? null
}
