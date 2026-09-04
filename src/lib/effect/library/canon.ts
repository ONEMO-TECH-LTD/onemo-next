// library/canon.ts — THE CANON.
//
// A frame is `cols × rows` on the lattice, FULLY POPULATED. That is the whole canon, and it is
// arithmetic rather than authored data: the grid dictates it (Dan, 2026-08-29: "grid dictates the
// sizes and layouts cause it is fixed 48mm lattice with 24mm discks").
//
// The ring, the four corners and the 96mm sampling are NOT here and are not the library's to hold
// (Dan, 2026-08-29: "rings corners and the rest are not canon they are filters post processing ...
// they may not even exist" / "store only pure library of canon and approved shapes — the engine
// will add anything we need on the top later"). Two of them cannot honestly be answered here at
// all: the belt depends on which magnets actually seat on the real material, and only the engine
// has seen the shape.
//
// What the library still owns beside the canon is the APPROVED SHAPES — the diamond's mask and the
// triangle geometries. Those are shape choices, not arithmetic.
//
// This replaces the literal corpora. Their "written out, never generated" header, and rules.ts
// quoting it as "(Dan: a readable table, no generation)", had no ruling behind them: the sentence
// was mine on 2026-08-25 and it read "no generation AT SOLVE TIME", which is a different claim —
// what was rejected then was a solve-time generator filtering patterns per family.

import { boardPositions } from './geometry'
import type { LibraryFrame } from './types'

type Pt = readonly [number, number]

/** THE CANON — every node of the frame. */
export function fullNodes(cols: number, rows: number): Pt[] {
  const out: Pt[] = []
  for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) out.push([x, y])
  return out
}

/** AN APPROVED SHAPE — the diamond is the square patch within Manhattan reach of its centre. */
export function diamondMask(cols: number, nodes: readonly Pt[]): Pt[] {
  const r = (cols - 1) / 2
  return nodes.filter(([x, y]) => Math.abs(x - r) + Math.abs(y - r) <= r)
}

/** The name a population carries. One frame, one population — `single` is kept for a one-magnet
 *  frame because catalogue ids are built from it and it is the existing identity. */
export const CANON_LAYOUT = 'full'
export const SINGLE_LAYOUT = 'single'

/** A frame as the library publishes it: its canon population, and nothing else. */
export function frameOf(cols: number, rows: number, mask?: (nodes: readonly Pt[]) => Pt[]): LibraryFrame {
  const nodes = mask ? mask(fullNodes(cols, rows)) : fullNodes(cols, rows)
  return { cols, rows, layouts: [{ name: nodes.length === 1 ? SINGLE_LAYOUT : CANON_LAYOUT, nodes }] }
}

/** THE RECTANGULAR FRAME SET — every ordered frame the board holds, both ways round.
 *
 *  It lives in the canon because more than one class publishes it: the rectangle (sharp) and the
 *  pill (round ends) offer the SAME frames and differ only at the edge. A class may not import
 *  another class, and two copies of this loop would be one edit away from disagreeing, so the
 *  arithmetic has one home (2026-09-04).
 *
 *  Portrait and landscape are separate frames, published separately: a 9-wide board carries 3×10
 *  and cannot carry 10×3 (Dan, 2026-08-30). */
export function rectangularFrames(pitchMM: number): readonly LibraryFrame[] {
  const { cols, rows } = boardPositions(pitchMM)
  const out: LibraryFrame[] = []
  for (let c = 1; c <= cols; c++) for (let r = c + 1; r <= rows; r++) {
    out.push(frameOf(c, r))
    if (r <= cols) out.push(frameOf(r, c))
  }
  return out
}

/** How narrow a rectangular frame is on its minor axis — independent of which way round it sits:
 *  a 2×5 and a 5×2 are both banners. Shared for the same reason as the frame set. */
export const rectangularTypeOf = (cols: number, rows: number): string =>
  Math.min(cols, rows) <= 1 ? 'slim' : Math.min(cols, rows) === 2 ? 'banner' : 'frame'
