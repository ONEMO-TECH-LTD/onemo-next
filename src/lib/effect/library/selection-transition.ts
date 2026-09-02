// library/selection-transition.ts — WHICH SELECTION A VARIANT REACHES. Pure state transition
// over declared shapes: no corpus, no registry, no class names, no geometry.
//
// It lives here rather than in transforms.ts (which is geometry) or selection.ts (zone 5, which
// zone 3 may not reach) because both class packages and the services need the same answer, and
// each writing it out is how the same fact came to have three spellings.

import type { ClassVariant } from './class-contract'
import type { LibraryFrame, LibrarySelection } from './types'

/** The layout a frame should land on: the preferred name when it carries it, else its first.
 *  The documented admin layout-carry — the one tolerated fallback in the library. */
export function pickLayout(frame: LibraryFrame, preferred: string): string {
  return frame.layouts.some((layout) => layout.name === preferred) ? preferred : frame.layouts[0].name
}

/** The selection a variant reaches, carrying the layout across when the new frame has it. */
export function selectVariant(current: LibrarySelection, variant: ClassVariant): LibrarySelection {
  return {
    ...current,
    ...variant.selection,
    layoutId: pickLayout(variant.frame, current.layoutId),
    view: { ...variant.view },
  }
}
