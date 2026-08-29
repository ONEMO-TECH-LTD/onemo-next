// units/classifier.ts — CLASSIFIER: what the shape IS, before anything is placed.
//
// The outline-bbox classifier is GONE, and with it the typed 1..5 axis class, the class floors,
// the frame-node capacity helper and the three-family shapeFamilyOf with its invented fill < 0.68
// cut. They measured the wrong box and encoded the old five-band product range in a type; the
// pipeline reads the frame off the usable material instead, which is all that remains here.

import type { BBox, Pt, SafeSegment } from '../types'

/** THE FRAME — the grid the shape's USABLE MATERIAL carries. Dan's step 1: "determine segmented
 *  legal area ... we can define what aspect ratio of the bbox is of the legal shape area and it
 *  will fall into that bucket".
 *
 *  Measured on the UNION of the live masses. Not the outline: a 135mm triangle's outline claims
 *  three lines across while only 96mm of it can hold magnets. Not the legal bbox either, and that
 *  is the one that surprises — a 30mm arm eroded by 12mm each side leaves a 6mm sliver that
 *  stretches the box the arm's whole length and seats nothing, so a dead arm and a live one measure
 *  identically on it (measured: 30mm arm reads 3×6 on outer AND legal, 3×3 only on the mass union).
 *  And not the GOVERNING mass: that is the centring dial's pick, so classifying off it would tie
 *  what the shape IS to a control, and would lose the duck's head entirely.
 *
 *  The empty neck inside a two-mass box is harmless — every magnet is still tested against the real
 *  material one position at a time, and wrap remains the only authority on what fits. */
export function massUnionBoxMM(segments: readonly SafeSegment[]): BBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const segment of segments)
    for (const mass of (segment.masses.length ? segment.masses : [segment])) {
      if (mass.bbox.minX < minX) minX = mass.bbox.minX
      if (mass.bbox.minY < minY) minY = mass.bbox.minY
      if (mass.bbox.maxX > maxX) maxX = mass.bbox.maxX
      if (mass.bbox.maxY > maxY) maxY = mass.bbox.maxY
    }
  return minX === Infinity ? null : { minX, minY, maxX, maxY }
}

/** How many magnet positions a legal span of this length carries: n positions span (n−1) pitches,
 *  so the span admits floor(span / pitch) + 1. NO CEILING — the typed 1..5 axis class encoded the
 *  old five-band product range in the type system and clamped every larger shape down to it (Dan,
 *  2026-08-29: "the classifier must be adaptive if we remove select bands and keep others it
 *  conforms"). The board's limit arrives through the catalogue, which publishes no frame the board
 *  cannot hold — stating the board here as well would give one fact two homes. */
export function positionsAcross(spanMM: number, pitchMM: number): number {
  return spanMM < 0 ? 0 : Math.floor(spanMM / pitchMM + 1e-9) + 1
}

/** The shape's frame at this size: the ordered pair the mass union carries. Ordered, not a ratio —
 *  3×6 and 2×4 share a ratio and are different frames, and a 1-wide frame has no ratio at all
 *  (Dan, 2026-08-29: "do we need aspect at all?" — no; the pair carries everything it would). */
export function frameOfMasses(
  segments: readonly SafeSegment[], pitchMM: number,
): { cols: number; rows: number; widthMM: number; heightMM: number } | null {
  const box = massUnionBoxMM(segments)
  if (!box) return null
  const widthMM = box.maxX - box.minX, heightMM = box.maxY - box.minY
  return { cols: positionsAcross(widthMM, pitchMM), rows: positionsAcross(heightMM, pitchMM), widthMM, heightMM }
}
