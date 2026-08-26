// library/frames.ts — the registry: which frames each class carries, with its spacing modes
// composed in. The corpus files hold semantic populations only; the 48/96 mode is computed
// here through the class rules, so a hand edit can never silently overwrite it.

import { SQUARE_FRAMES } from './corpus-square'
import { RECTANGLE_FRAMES } from './corpus-rectangle'
import { DIAMOND_FRAMES } from './corpus-diamond'
import { withSpacingModes } from './rules'
import type { LibraryFrame, RegistryFamily } from './types'

export { SQUARE_FRAMES, RECTANGLE_FRAMES, DIAMOND_FRAMES }

/** Only the classes that HAVE a frame table appear here. The triangle's frames come from the
 *  geometry a selection names (triangle-frames.ts), so it has no entry rather than an empty
 *  one — an empty list is a sentinel every caller then has to know about. */
export const RAW_CLASS_FRAMES = {
  square: SQUARE_FRAMES,
  rectangle: RECTANGLE_FRAMES,
  diamond: DIAMOND_FRAMES,
} satisfies Record<RegistryFamily, LibraryFrame[]>

/** THE frames of a class AT A PITCH. There is no pitch-free frame list: the 96mm population is
 *  a physical distance, so a frame is only meaningful once the pitch is known. Every reader —
 *  resolver, panel, authoring, canvas — goes through here and sees the same magnets. */
export const registryFramesAt = (family: RegistryFamily, pitchMM: number): LibraryFrame[] =>
  RAW_CLASS_FRAMES[family].map((frame) => withSpacingModes(family, frame, pitchMM))
