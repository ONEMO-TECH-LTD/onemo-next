// library/frames.ts — which frames each class carries.

import { SQUARE_FRAMES } from './corpus-square'
import { RECTANGLE_FRAMES } from './corpus-rectangle'
import { DIAMOND_FRAMES } from './corpus-diamond'
import type { LibraryFamily, LibraryFrame } from './types'

export { SQUARE_FRAMES, RECTANGLE_FRAMES, DIAMOND_FRAMES }
export const CLASS_FRAMES: Record<LibraryFamily, LibraryFrame[]> = {
  square: SQUARE_FRAMES,
  rectangle: RECTANGLE_FRAMES,
  diamond: DIAMOND_FRAMES,
}
