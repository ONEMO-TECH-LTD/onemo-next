// library/corpus-triangle.ts — literal layout data for this class. Written out, never generated.

import type { LibraryFrame } from './types'

/** TRIANGLE class — built on the square and rectangle frames (Dan, 08-25). Canonical is apex
 *  top-left: the vertical leg runs down the left edge, the base along the bottom, and the slant
 *  from the apex to the far base corner. The other three apex corners are the flips, exactly as
 *  landscape is the rectangle's transpose.
 *
 *  A frame carries a triangle only where the slant lands on lattice nodes — (rows-1) a whole
 *  multiple of (cols-1). Every square frame qualifies; of the rectangles, 2x3, 2x5 and 3x5 do.
 *  3x4 and 4x5 do not: their slant would step half a node, and the lattice has nowhere to put it.
 *
 *  Same vocabulary as every class: full — every node in the triangle · perimeter — the two legs
 *  and the slant · corners — the three vertices · perimeter-96 — computed in rules.ts. */
export const TRIANGLE_FRAMES: LibraryFrame[] = [
  { cols: 1, rows: 1, layouts: [
    { name: 'single', nodes: [[0, 0]] },
  ] },
  { cols: 2, rows: 2, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [1, 1]] },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [1, 1]] },
    { name: 'corners', nodes: [[0, 0], [0, 1], [1, 1]] },
  ] },
  { cols: 3, rows: 3, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2]] },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2]] },
    { name: 'corners', nodes: [[0, 0], [0, 2], [2, 2]] },
  ] },
  { cols: 4, rows: 4, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3], [3, 3]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [1, 1], [0, 2], [2, 2], [0, 3], [1, 3], [2, 3], [3, 3]] },
    { name: 'corners', nodes: [[0, 0], [0, 3], [3, 3]] },
  ] },
  { cols: 5, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3], [3, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [1, 1], [0, 2], [2, 2], [0, 3], [3, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [4, 4]] },
  ] },
  { cols: 2, rows: 3, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [1, 2]] },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [1, 2]] },
    { name: 'corners', nodes: [[0, 0], [0, 2], [1, 2]] },
  ] },
  { cols: 2, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4]] },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [1, 4]] },
  ] },
  { cols: 3, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [0, 4], [1, 4], [2, 4]] },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [0, 4], [1, 4], [2, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [2, 4]] },
  ] },
]
