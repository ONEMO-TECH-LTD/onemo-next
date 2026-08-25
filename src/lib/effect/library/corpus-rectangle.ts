// library/corpus-rectangle.ts — literal layout data for this class. Written out, never generated.

import type { LibraryFrame } from './types'

/** RECTANGLE class — tall canonical frames; wide is the transpose. */
export const RECTANGLE_FRAMES: LibraryFrame[] = [
  { cols: 1, rows: 2, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1]] },
  ] },
  { cols: 1, rows: 3, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2]] },
  ] },
  { cols: 1, rows: 4, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 3]] },
    { name: 'corners', nodes: [[0, 0], [0, 3]] },
  ] },
  { cols: 1, rows: 5, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4]] },
  ] },
  { cols: 2, rows: 3, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [1, 0], [1, 2]] },
  ] },
  { cols: 2, rows: 4, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 3], [1, 0], [1, 2], [1, 3]] },
    { name: 'corners', nodes: [[0, 0], [0, 3], [1, 0], [1, 3]] },
  ] },
  { cols: 2, rows: 5, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4], [1, 0], [1, 2], [1, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [1, 0], [1, 4]] },
  ] },
  { cols: 3, rows: 4, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 3], [2, 0], [2, 2], [2, 3]] },
    { name: 'corners', nodes: [[0, 0], [0, 3], [2, 0], [2, 3]] },
  ] },
  { cols: 3, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4], [2, 0], [2, 2], [2, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [2, 0], [2, 4]] },
  ] },
  { cols: 4, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 4], [2, 0], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4], [2, 0], [2, 4], [3, 0], [3, 2], [3, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [3, 0], [3, 4]] },
  ] },
  { cols: 4, rows: 6, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 5], [2, 0], [2, 5], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4], [0, 5], [2, 0], [2, 5], [3, 0], [3, 2], [3, 4], [3, 5]] },
    { name: 'corners', nodes: [[0, 0], [0, 5], [3, 0], [3, 5]] },
  ] },
  { cols: 5, rows: 6, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 5], [2, 0], [2, 5], [3, 0], [3, 5], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4], [0, 5], [2, 0], [2, 5], [4, 0], [4, 2], [4, 4], [4, 5]] },
    { name: 'corners', nodes: [[0, 0], [0, 5], [4, 0], [4, 5]] },
  ] },
]
