import { squareClass } from './square-class'
import { rectangleClass } from './rectangle-class'
import { diamondClass } from './diamond-class'
import { triangleClass } from './triangle-class'
import type { LibraryClass } from './class-contract'
import type { LibraryFamily } from './types'

export const CLASS_SPECS = {
  square: squareClass,
  rectangle: rectangleClass,
  diamond: diamondClass,
  triangle: triangleClass,
} as const satisfies Record<string, LibraryClass>

type RegisteredClassId = keyof typeof CLASS_SPECS

export const LIBRARY_FAMILIES: readonly LibraryFamily[] = Object.freeze(Object.keys(CLASS_SPECS))

export function specOf(classId: LibraryFamily): LibraryClass {
  const spec = CLASS_SPECS[classId as RegisteredClassId]
  if (!spec) throw new Error('library: unknown classId ' + classId)
  return spec
}
