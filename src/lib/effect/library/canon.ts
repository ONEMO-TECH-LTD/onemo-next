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

/** AN APPROVED SHAPE — the magnets a pill's rounded ends can hold BEYOND the rectangle it wraps.
 *
 *  A pill grows along its length by half its width so the corner magnets keep their rim, and that new
 *  material is not empty: it is lattice like everything else. Dan, 2026-09-04: "frame can naturally
 *  hold single top magnet". A three-wide frame gains one at the centre of each end; a four-wide gains
 *  two; a banner or a slim gains none, because neither grew far enough to hold one.
 *
 *  Lattice arithmetic, pitch cancelled: the end cap is a circle of radius r + rim about the end of the
 *  population's centre line, so a position is held exactly when it lies within r of that line. */
export function pillCapNodes(cols: number, rows: number): Pt[] {
  const spanX = cols - 1, spanY = rows - 1
  const tall = spanX <= spanY
  const r = Math.min(spanX, spanY) / 2
  const reach = Math.ceil(r)
  // the population's centre line: the axis the end caps are drawn about
  const held = (across: number, along: number, alongSpan: number) =>
    Math.hypot(across, Math.max(0, -along, along - alongSpan)) <= r + 1e-9
  const out: Pt[] = []
  const [wide, long] = tall ? [cols, rows] : [rows, cols]
  const longSpan = tall ? spanY : spanX
  for (let across = 0; across < wide; across++) for (let k = 1; k <= reach; k++) {
    for (const along of [-k, long - 1 + k]) {
      if (!held(Math.abs(across - (wide - 1) / 2), along, longSpan)) continue
      out.push(tall ? [across, along] : [along, across])
    }
  }
  return out
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
export function rectangularFrameSizes(pitchMM: number): ReadonlyArray<readonly [number, number]> {
  const { cols, rows } = boardPositions(pitchMM)
  const out: Array<readonly [number, number]> = []
  for (let c = 1; c <= cols; c++) for (let r = c + 1; r <= rows; r++) {
    out.push([c, r])
    if (r <= cols) out.push([r, c])
  }
  return out
}

export function rectangularFrames(pitchMM: number): readonly LibraryFrame[] {
  return rectangularFrameSizes(pitchMM).map(([c, r]) => frameOf(c, r))
}

/** THE PILL'S FRAMES — the rectangle's population plus the magnets its rounded ends hold, published
 *  at the extent that population actually occupies. A three-wide pill reaches one lattice row past the
 *  rectangle at each end, so its frame is that much taller: nodes outside their own frame would break
 *  transform closure, and the frame is the truthful extent either way. */
export function pillFrames(pitchMM: number): readonly LibraryFrame[] {
  const board = boardPositions(pitchMM)
  return rectangularFrameSizes(pitchMM).map(([c, r]) => {
    const nodes = [...fullNodes(c, r), ...pillCapNodes(c, r)]
    const xs = nodes.map(([x]) => x), ys = nodes.map(([, y]) => y)
    const [ox, oy] = [Math.min(...xs), Math.min(...ys)]
    return {
      cols: Math.max(...xs) - ox + 1, rows: Math.max(...ys) - oy + 1,
      layouts: [{ name: CANON_LAYOUT, nodes: nodes.map(([x, y]) => [x - ox, y - oy] as Pt) }],
    }
  // grown out of the board is not a frame the board can carry
  }).filter((frame) => frame.cols <= board.cols && frame.rows <= board.rows)
}

/** How narrow a rectangular frame is on its minor axis — independent of which way round it sits:
 *  a 2×5 and a 5×2 are both banners. Shared for the same reason as the frame set. */
export const rectangularTypeOf = (cols: number, rows: number): string =>
  Math.min(cols, rows) <= 1 ? 'slim' : Math.min(cols, rows) === 2 ? 'banner' : 'frame'
