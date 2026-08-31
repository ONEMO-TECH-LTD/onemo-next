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

/** THE OPTIMAL LAYOUT IN A BAND, for a shape whose legal box is this big.
 *
 *  Dan, 2026-08-30: the classifier "must just send the sweeper the outer/inner box dimensions in
 *  each band — and the look up must digest it and return the optimal layout in that band".
 *
 *  So the digesting happens HERE, not in the classifier. Every canon record already carries the
 *  legal box its own magnets occupy, so this is box against box: of the canon layouts sitting in
 *  this band, which ones fit inside the shape's legal box on BOTH axes, and of those, which uses
 *  the most of it. No position arithmetic, no lattice knowledge on the caller's side.
 *
 *  Orientation is carried by the record, not chosen: a tall legal box admits the 2x3 and refuses
 *  the 3x2, because 3x2 is 96mm wide and the box is not.
 *
 *  Null when nothing in that band fits — the shape is not that band's size yet, and saying so is
 *  the answer. It never substitutes a layout from another band. */
export function optimalLayoutForBox(
  pitchMM: number, bandId: number, legalWidthMM: number, legalHeightMM: number,
): CatalogueEntry | null {
  // THE REQUESTED BAND FIRST, THEN DOWN. Dan, 2026-08-31: "Canon may come from lower band if none
  // fit in proposed, the current and prior band did not use it as well — means the band [was]
  // shifted due to mismatch of the shape bbox and actual internal structure."
  //
  // That mismatch is the whole reason: a band is asked for on one reading of the shape's size,
  // while what the material can actually carry is another. The duck and the butterfly at B3 hold a
  // clean 2x2 — a B2 record — and used to come back with NOTHING while the free search found that
  // very layout on its own. Stepping down names what the shape can wear instead of staying silent.
  //
  // Never UP: a shape is not offered a layout larger than the band asked for.
  for (let id = bandId; id >= 1; id--) {
    const found = bestInBand(pitchMM, id, legalWidthMM, legalHeightMM)
    if (found) return found
  }
  return null
}

/** The largest canon record of one band that fits inside this legal box. */
function bestInBand(
  pitchMM: number, bandId: number, legalWidthMM: number, legalHeightMM: number,
): CatalogueEntry | null {
  const EPS = 0.005
  let best: CatalogueEntry | null = null
  for (const entry of canonCatalogue(pitchMM)) {
    if (entry.bandId !== bandId) continue
    if (entry.legalWidthMM > legalWidthMM + EPS) continue
    if (entry.legalHeightMM > legalHeightMM + EPS) continue
    if (!best) { best = entry; continue }
    // most of the box used; ties break on the larger magnet count, then on the stable id so the
    // answer never depends on catalogue order
    const a = entry.legalWidthMM * entry.legalHeightMM, b = best.legalWidthMM * best.legalHeightMM
    if (a > b + EPS
      || (Math.abs(a - b) <= EPS && entry.nodesMM.length > best.nodesMM.length)
      || (Math.abs(a - b) <= EPS && entry.nodesMM.length === best.nodesMM.length && entry.id < best.id))
      best = entry
  }
  return best
}
