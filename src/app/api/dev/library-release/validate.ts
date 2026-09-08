import { LIBRARY_FAMILIES, knownReleaseIds } from '@/lib/effect/library'
import { BANDS, RELEASED_PITCHES_MM } from '@/lib/effect/grid-magnet-spec'

/** WHY the state is refused, or null when it may be written. Shape alone let `shownBands: [-999]` and
 *  `released: ['not-a-variant']` through to the generated source (QA F3, 2026-09-08): a class must be
 *  one the library registers, a band one the spec releases (no duplicates), a release id one that class
 *  actually publishes at some released pitch. */
export function unsound(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'not an object'
  const s = v as { version?: unknown; classes?: unknown }
  if (s.version !== 1) return 'version must be 1'
  if (!s.classes || typeof s.classes !== 'object' || Array.isArray(s.classes)) return 'classes must be an object'
  const bandIds = new Set(BANDS.map((b) => b.id))
  const known = knownReleaseIds(RELEASED_PITCHES_MM.map((p) => p.mm))
  for (const [classId, c] of Object.entries(s.classes as Record<string, unknown>)) {
    if (!LIBRARY_FAMILIES.includes(classId)) return 'unknown class ' + classId
    if (!c || typeof c !== 'object') return classId + ': not an object'
    const cls = c as { shownBands?: unknown; released?: unknown }
    if (cls.shownBands !== null) {
      if (!Array.isArray(cls.shownBands)) return classId + ': shownBands must be null or a list'
      if (new Set(cls.shownBands).size !== cls.shownBands.length) return classId + ': duplicate band'
      for (const b of cls.shownBands) if (!bandIds.has(b as number)) return classId + ': unknown band ' + String(b)
    }
    if (!Array.isArray(cls.released)) return classId + ': released must be a list'
    for (const r of cls.released) if (typeof r !== 'string' || !known.get(classId)?.has(r)) return classId + ': unknown release id ' + String(r)
  }
  return null
}

