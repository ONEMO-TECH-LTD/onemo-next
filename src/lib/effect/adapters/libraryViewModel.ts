// adapters/libraryViewModel.ts — the Library tab's engine picture, requested by the shell (T2).
// The one thing drawn here beside the record is its LEGAL AREA — the region a magnet centre may sit
// in — so the legal box is checkable by eye. The engine says what that is; this adapter only asks.

import type { Contour, SafeSegment } from '../types'
import { insetOffsetPath, pathBoundsMM, pathFromAnchors } from '../grid-magnet'
import { RELEASED_PADDING_MM } from '../grid-magnet-spec'

/** What the Library draws of a legal area: its curve, and nothing measured. */
export type LibraryLegalArea = Pick<SafeSegment, 'paths' | 'masses' | 'bbox'>

/** KNOWN, NOT MEASURED. A cutout's legal area has to be measured — the solver's 2 mm clearance mesh,
 *  100–175 ms a shape — because nothing else knows where its edge is. A library record's outline is
 *  GENERATED from its magnets plus the rim, so its legal area is the same construction shrunk by the
 *  rim: lines and arcs, exact, in microseconds. This adapter ran the mesh anyway and the Library paid
 *  the solver's price for a fact it already held (Dan, 2026-09-07: "these are precomputed must be
 *  instant" / "solver for what?"). Empty when the shrink leaves nothing — a one-magnet disc. */
export function librarySegments(stage: { contour: Contour }): LibraryLegalArea[] {
  const outer = stage.contour.outer
  const path = outer.path ?? (outer.pts.length >= 3
    ? pathFromAnchors(outer.pts.map(([x, y]) => ({ p: { x, y } })), (v) => [v.x, v.y]) : null)
  if (!path) return []
  const legal = insetOffsetPath(path, RELEASED_PADDING_MM)
  if (!legal) return []
  const b = pathBoundsMM(legal)
  return [{ paths: [legal], masses: [], bbox: { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY } }]
}
