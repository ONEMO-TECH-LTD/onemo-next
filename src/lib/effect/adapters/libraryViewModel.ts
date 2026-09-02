// adapters/libraryViewModel.ts — the Library tab's engine picture, requested by the shell (T2).
// The one measurement moved here from page.tsx (08fd49e7): the legal area of a canon record, drawn so
// its legal box is checkable by eye. The engine measures; this adapter only asks and hands it on.

import type { Contour, SafeSegment } from '../types'
import { safeSegments, spotRadiusOf } from '../grid-magnet'
import { RELEASED_PADDING_MM } from '../grid-magnet-spec'

export function librarySegments(stage: { contour: Contour }): SafeSegment[] {
  return safeSegments(stage.contour, spotRadiusOf(RELEASED_PADDING_MM), 'full')
}
