// library/shapes.ts — the ruled demonstration outlines, unit box, y down.

import type { LibraryShape } from './types'

export const LIBRARY_SHAPES: LibraryShape[] = [
  { id: 'square', family: 'square', aspect: 'square', outline: [[0.0000, 0.0000], [1.0000, 0.0000], [1.0000, 1.0000], [0.0000, 1.0000]] },
  { id: 'rectangle', family: 'rectangle', aspect: 'frame', outline: [[0.0000, 0.0000], [1.0000, 0.0000], [1.0000, 1.0000], [0.0000, 1.0000]] },
  { id: 'diamond', family: 'diamond', aspect: 'square', outline: [[0.5000, 0.0000], [1.0000, 0.5000], [0.5000, 1.0000], [0.0000, 0.5000]] },
  { id: 'triangle', family: 'triangle', aspect: 'frame', outline: [] },
]
