// library/corpus-square.ts — literal layout data for this class. Written out, never generated.

import type { LibraryFrame } from './types'

export const SQUARE_FRAMES: LibraryFrame[] = [
  { cols: 1, rows: 1, layouts: [
    { name: 'single', nodes: [[0, 0]] },
  ] },
  { cols: 2, rows: 2, layouts: [
    { name: 'full', nodes: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { name: 'perimeter', nodes: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { name: 'corners', nodes: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  ] },
  { cols: 3, rows: 3, layouts: [
    { name: 'full', nodes: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]] },
    { name: 'corners', nodes: [[0, 0], [2, 0], [0, 2], [2, 2]] },
  ] },
  { cols: 4, rows: 4, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [3, 1], [0, 2], [3, 2], [0, 3], [1, 3], [2, 3], [3, 3]] },
    { name: 'corners', nodes: [[0, 0], [3, 0], [0, 3], [3, 3]] },
  ] },
  { cols: 5, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [4, 1], [0, 2], [4, 2], [0, 3], [4, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] },
    { name: 'corners', nodes: [[0, 0], [4, 0], [0, 4], [4, 4]] },
  ] },
]
