// library/corpus-diamond.ts — literal layout data for this class. Written out, never generated.

import type { LibraryFrame } from './types'

/** DIAMOND class — the lattice never rotates; a diamond is a node set read from a centre node
 *  outward by Manhattan distance. Frames are labelled by magnets per side (1×1 … 4×4); the
 *  cols/rows below are the lattice patch the ring occupies. */
export const DIAMOND_FRAMES: LibraryFrame[] = [
  { cols: 1, rows: 1, layouts: [
    { name: 'single', nodes: [[0, 0]] },
  ] },
  { cols: 3, rows: 3, layouts: [
    { name: 'full', nodes: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 1], [1, 0], [1, 2], [2, 1]] },
    { name: 'perimeter-96', nodes: [[1, 0], [1, 2]] },
  ] },
  { cols: 5, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 2], [1, 1], [1, 3], [2, 0], [2, 2], [2, 4], [3, 1], [3, 3], [4, 2]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 2], [1, 1], [1, 3], [2, 0], [2, 4], [3, 1], [3, 3], [4, 2]] },
    { name: 'perimeter-96', nodes: [[0, 2], [2, 0], [2, 4], [4, 2]] },
    { name: 'corners', nodes: [[0, 2], [2, 0], [2, 4], [4, 2]] },
  ] },
  { cols: 7, rows: 7, layouts: [
    { name: 'full', nodes: [[0, 3], [1, 2], [1, 4], [2, 1], [2, 5], [3, 0], [3, 3], [3, 6], [4, 1], [4, 5], [5, 2], [5, 4], [6, 3]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 3], [1, 2], [1, 4], [2, 1], [2, 5], [3, 0], [3, 6], [4, 1], [4, 5], [5, 2], [5, 4], [6, 3]] },
    { name: 'perimeter-96', nodes: [[1, 2], [1, 4], [3, 0], [3, 6], [5, 2], [5, 4]] },
    { name: 'corners', nodes: [[0, 3], [3, 0], [3, 6], [6, 3]] },
  ] },
]
