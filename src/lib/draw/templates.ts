// draw/templates — the recognizer's template set IS our own shape library (blueprint draw.md:
// "you draw a rough heart, it snaps to THE heart"). Built lazily once from the library's true
// vector definitions; the matcher can only ever suggest a shape the product actually sells.

import { flattenPath } from '@/lib/vector-core'
import { getShape, hasVectorDef } from '@/lib/shape-library'
import { normalizeStroke, type StrokeTemplate } from './recognizer'

// Distinct silhouettes only — near-duplicates of the circle class (pebble/squircle) are excluded
// so a drawn circle ghosts as Circle, not a coin-flip between three look-alikes.
const TEMPLATE_KINDS = ['heart', 'circle', 'square', 'bolt', 'sparkle', 'teardrop', 'leaf', 'lens', 'diamond', 'plus', 'asterisk', 'bowtie', 'pinched', 'polygon', 'star'] as const

let cache: StrokeTemplate[] | null = null

/** The library as normalized point clouds (built once; ~15 shapes × 32 points). */
export function libraryTemplates(): StrokeTemplate[] {
  if (cache) return cache
  cache = TEMPLATE_KINDS.filter((k) => hasVectorDef(k)).map((kind) => {
    const ring = flattenPath(getShape(kind, 100, 100).paths[0], 0.5)
    return { kind, points: normalizeStroke(ring) }
  })
  return cache
}
