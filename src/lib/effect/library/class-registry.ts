import { CLASS_SPECS as LEGACY_CLASS_SPECS, specOf as legacySpecOf } from './registry-class'
import { squareClass } from './square-class'
import { rectangleClass } from './rectangle-class'
import { diamondClass } from './diamond-class'
import { triangleClass } from './triangle-class'
import type { LibraryFamily } from './types'

export const CLASS_SPECS = {
  square: squareClass,
  rectangle: rectangleClass,
  diamond: diamondClass,
  triangle: triangleClass,
} as const

type RegisteredClassId = keyof typeof CLASS_SPECS

export const LIBRARY_FAMILIES: readonly LibraryFamily[] = Object.freeze(Object.keys(CLASS_SPECS))
export const REGISTRY_FAMILIES = ['square', 'rectangle', 'diamond'] as const

export function specOf(classId: LibraryFamily) {
  const spec = CLASS_SPECS[classId as RegisteredClassId]
  if (!spec) throw new Error('library: unknown classId ' + classId)
  // Existing callers still consume the pre-Step-3 materialisation interface. This indirection
  // keeps their current behaviour while the class package registry becomes authoritative.
  return legacySpecOf(classId)
}

void LEGACY_CLASS_SPECS
