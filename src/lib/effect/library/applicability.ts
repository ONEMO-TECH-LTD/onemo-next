// library/applicability.ts — DRAFT review data: which layouts a class is expected to offer.
// Panel tags only; never engine policy until Dan rules it.

import type { LibraryFamily } from './types'

export const FAMILY_APPLICABILITY_DRAFT: Record<LibraryFamily, string[]> = {
  square: ['single', 'full', 'perimeter', 'perimeter-96', 'corners'],
  rectangle: ['full', 'perimeter', 'perimeter-96', 'corners'],
  diamond: ['single', 'full', 'perimeter', 'perimeter-96', 'corners'],
  triangle: ['corners', 'perimeter', 'perimeter-96', 'full'],
}
