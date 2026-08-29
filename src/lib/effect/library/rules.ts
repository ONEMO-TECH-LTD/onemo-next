// library/rules.ts — how a population is MEASURED. Band and legal box. No UI, no taxonomy.
//
// The spacing vocabulary and the 96mm samplers left with the filters: the ring, the corners and
// the 96mm sampling are the engine's to apply on top of the canon, not the library's to publish
// (Dan, 2026-08-29). What remains here is measurement, which is the same question whoever asks it.

import { BANDS } from '../grid-magnet-spec'
import type { LibraryFrame } from './types'

type Pt = readonly [number, number]

/** THE BAND OF A LAYOUT — read off the dominant axis of its LEGAL AREA, against the engine's own
 *  band table. One home for the ranges, so the band the engine asks for and the band the catalogue
 *  groups by are the same band by construction, not by agreement.
 *
 *  For a library record the legal area needs no erosion: the outline is generated FROM the disks
 *  plus their own 12mm rim, so the disk group's extent already is it.
 *
 *  This is where a layout SITS. What band an ANSWER lands in is decided by the wrap on the real
 *  shape — the catalogue groups, it does not adjudicate. */
export function bandIdOfMM(legalMM: number): number | null {
  return BANDS.find((b) => legalMM >= b.minMM && legalMM <= b.maxMM)?.id ?? null
}

/** THE LEGAL BOX of a placed magnet group — the span the seats themselves occupy.
 *
 *  Both sides, because both are needed: the longer one gives the band, and the ratio between them
 *  is what says which layouts a shape can wear at all. The OUTER aspect is locked by proportional
 *  scaling and therefore tells you nothing; the LEGAL aspect moves with size, because the 12mm rim
 *  does not scale — a 100×50 shape's legal box is 2.92:1 and the same shape at 400×200 is 2.14:1.
 *  That drift is what brings different layouts into range as the shape grows. */
export function legalBoxMM(nodes: readonly Pt[]): { widthMM: number; heightMM: number } {
  if (!nodes.length) return { widthMM: 0, heightMM: 0 }
  const xs = nodes.map((n) => n[0]), ys = nodes.map((n) => n[1])
  return { widthMM: Math.max(...xs) - Math.min(...xs), heightMM: Math.max(...ys) - Math.min(...ys) }
}

/** The longer side of the legal box — what the band is read from. */
export function legalExtentMM(nodes: readonly Pt[]): number {
  const box = legalBoxMM(nodes)
  return Math.max(box.widthMM, box.heightMM)
}

export function bandOfFrame(frame: LibraryFrame, pitchMM: number): number | null {
  const canon = frame.layouts[0]
  if (!canon) return null
  return bandIdOfMM(legalExtentMM(canon.nodes.map(([x, y]) => [x * pitchMM, y * pitchMM] as Pt)))
}
