import { LOCK_KEYS, type LockKey } from '@/lib/effect/locks'
import { BANDS, DISC_OFFSET_CEIL_MM, DISC_OFFSET_FLOOR_MM, SHAPE_RADIUS_CEIL_MM, SHAPE_RADIUS_FLOOR_MM, EDGE_PADDING_CEIL_MM, EDGE_PADDING_FLOOR_MM, PADDING_SHAPES, SQUIRCLE_RADIUS_CEIL_MM, SQUIRCLE_RADIUS_FLOOR_MM, PADDING_CEIL_MM, PADDING_FLOOR_MM, RELEASED_PITCHES_MM } from '@/lib/effect/grid-magnet-spec'

/** WHY a profile is refused, or null when it may be sealed. A locked value is what production will
 *  use and cannot override, so it is checked against what the engine actually accepts — a bad seal is
 *  worse than none. */
export function unsound(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'not an object'
  const s = v as { version?: unknown; locks?: unknown }
  if (s.version !== 1) return 'version must be 1'
  if (!s.locks || typeof s.locks !== 'object' || Array.isArray(s.locks)) return 'locks must be an object'
  const bandIds = new Set(BANDS.map((b) => b.id))
  const pitches = new Set(RELEASED_PITCHES_MM.map((p) => p.mm))
  const ok: Record<LockKey, (x: unknown) => boolean> = {
    paddingMM: (x) => typeof x === 'number' && x >= PADDING_FLOOR_MM && x <= PADDING_CEIL_MM,
    edgePaddingMM: (x) => typeof x === 'number' && x >= EDGE_PADDING_FLOOR_MM && x <= EDGE_PADDING_CEIL_MM,
    paddingShape: (x) => PADDING_SHAPES.some((m) => m.id === x),
    paddingRadiusMM: (x) => typeof x === 'number' && x >= SQUIRCLE_RADIUS_FLOOR_MM && x <= SQUIRCLE_RADIUS_CEIL_MM,
    discOffsetMM: (x) => typeof x === 'number' && x >= DISC_OFFSET_FLOOR_MM && x <= DISC_OFFSET_CEIL_MM,
    shapeRadiusMM: (x) => x === null || (typeof x === 'number' && x >= SHAPE_RADIUS_FLOOR_MM && x <= SHAPE_RADIUS_CEIL_MM),
    pitchMM: (x) => typeof x === 'number' && pitches.has(x),
    centreMode: (x) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 5,
    governor: (x) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 3,
    coverage: (x) => x === 'full' || x === 'perimeter',
    plan: (x) => x === 'all6' || x === 'all8' || x === 'corners8',
    protectionPaddingMM: (x) => typeof x === 'number' && x >= 0 && x <= 96,
    classifierRuler: (x) => x === 'legal' || x === 'outer',
    activeBandIds: (x) => Array.isArray(x) && x.length > 0 && new Set(x).size === x.length
      && x.every((b) => bandIds.has(b as number)),
  }
  for (const [key, lock] of Object.entries(s.locks as Record<string, unknown>)) {
    if (!LOCK_KEYS.includes(key as LockKey)) return 'unknown config ' + key
    if (!lock || typeof lock !== 'object') return key + ': not a lock'
    const l = lock as { value?: unknown; locked?: unknown }
    if (typeof l.locked !== 'boolean') return key + ': locked must be true or false'
    if (!ok[key as LockKey](l.value)) return key + ': ' + String(l.value) + ' is not a value the engine accepts'
  }
  return null
}
