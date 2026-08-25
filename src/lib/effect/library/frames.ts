// library/frames.ts — the registry: which frames each class carries, with its spacing modes
// composed in. The corpus files hold semantic populations only; the 48/96 mode is computed
// here through the class rules, so a hand edit can never silently overwrite it.

import { SQUARE_FRAMES } from './corpus-square'
import { RECTANGLE_FRAMES } from './corpus-rectangle'
import { DIAMOND_FRAMES } from './corpus-diamond'
import { withSpacingModes } from './rules'
import type { LibraryFamily, LibraryFrame } from './types'

export { SQUARE_FRAMES, RECTANGLE_FRAMES, DIAMOND_FRAMES }

const compose = (family: LibraryFamily, frames: LibraryFrame[]): LibraryFrame[] =>
  frames.map((f) => withSpacingModes(family, f))

export const CLASS_FRAMES: Record<LibraryFamily, LibraryFrame[]> = {
  square: compose('square', SQUARE_FRAMES),
  rectangle: compose('rectangle', RECTANGLE_FRAMES),
  diamond: compose('diamond', DIAMOND_FRAMES),
  // the triangle's frames come from the selected geometry — see triangle-frames.ts
  triangle: [],
}
