// library/frames.ts — the registry: which frames each class carries, with its spacing modes
// composed in. The corpus files hold semantic populations only; the 48/96 mode is computed
// here through the class rules, so a hand edit can never silently overwrite it.

import { SQUARE_FRAMES } from './corpus-square'
import { RECTANGLE_FRAMES } from './corpus-rectangle'
import { DIAMOND_FRAMES } from './corpus-diamond'
import { withSpacingModes } from './rules'
import type { LibraryFrame, RegistryFamily } from './types'

export { SQUARE_FRAMES, RECTANGLE_FRAMES, DIAMOND_FRAMES }

const compose = (family: RegistryFamily, frames: LibraryFrame[]): LibraryFrame[] =>
  frames.map((f) => withSpacingModes(family, f))

/** Only the classes that HAVE a frame table appear here. The triangle's frames come from the
 *  geometry a selection names (triangle-frames.ts), so it has no entry rather than an empty
 *  one — an empty list is a sentinel every caller then has to know about. */
export const CLASS_FRAMES: Record<RegistryFamily, LibraryFrame[]> = {
  square: compose('square', SQUARE_FRAMES),
  rectangle: compose('rectangle', RECTANGLE_FRAMES),
  diamond: compose('diamond', DIAMOND_FRAMES),
}
