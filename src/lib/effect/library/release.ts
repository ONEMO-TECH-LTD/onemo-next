// library/release.ts — WHAT THE LIBRARY SHOWS, AND WHAT IT RELEASES.
//
// Dan, 2026-09-07: "i do not need all these sizes it is clutter i need to select what sizes the
// library is displaying and from them is release ready for presets as well" / "make also release
// limiter per shape so we can cherry pick". Two dials, coarse then fine: per class, which BANDS the
// Library displays at all; and per record, whether it is RELEASED — the set the Presets read.
//
// The state is a file in the repo (release-state.ts), written by the Grid Lab through a dev route,
// so what the admin toggles is what ships. This module is the only reader and the only writer of
// its shape; the state file is data.

import { LIBRARY_RELEASE_STATE } from './release-state'
import { catalogue, type CatalogueEntry } from './catalogue'
import type { LibraryFamily } from './types'

export interface ClassRelease {
  /** Bands the Library displays for this class; null = every band the class reaches. */
  shownBands: readonly number[] | null
  /** Record ids (the class's frame keys) released for presets. */
  released: readonly string[]
}

export interface LibraryReleaseState {
  version: 1
  classes: Readonly<Record<string, ClassRelease>>
}

const NONE: ClassRelease = { shownBands: null, released: [] }

const classRelease = (state: LibraryReleaseState, classId: LibraryFamily): ClassRelease =>
  state.classes[classId] ?? NONE

export const bandShown = (state: LibraryReleaseState, classId: LibraryFamily, bandId: number): boolean => {
  const shown = classRelease(state, classId).shownBands
  return shown === null || shown.includes(bandId)
}

export const recordReleased = (state: LibraryReleaseState, classId: LibraryFamily, recordId: string): boolean =>
  classRelease(state, classId).released.includes(recordId)

/** The state with one band shown or hidden. `reach` is every band the class reaches: hiding from
 *  "all" writes the explicit remainder, and showing the last hidden one returns to null. */
export function withBandShown(
  state: LibraryReleaseState, classId: LibraryFamily, bandId: number, shown: boolean, reach: readonly number[],
): LibraryReleaseState {
  const current = classRelease(state, classId)
  const now = current.shownBands ?? reach
  const next = shown ? [...new Set([...now, bandId])].sort((a, b) => a - b) : now.filter((b) => b !== bandId)
  const complete = reach.every((b) => next.includes(b))
  return withClass(state, classId, { ...current, shownBands: complete ? null : next })
}

export function withReleased(
  state: LibraryReleaseState, classId: LibraryFamily, recordId: string, released: boolean,
): LibraryReleaseState {
  const current = classRelease(state, classId)
  const next = released
    ? [...new Set([...current.released, recordId])].sort()
    : current.released.filter((id) => id !== recordId)
  return withClass(state, classId, { ...current, released: next })
}

const withClass = (state: LibraryReleaseState, classId: LibraryFamily, cls: ClassRelease): LibraryReleaseState => {
  const classes = { ...state.classes }
  if (cls.shownBands === null && !cls.released.length) delete classes[classId]
  else classes[classId] = cls
  return { version: 1, classes }
}

/** A catalogue record's release identity: the class's own variant id, as the Frame toggle stored it.
 *  The catalogue id carries that segment URL-encoded — a triangle's `tri:0,0;0,2;2,1` reads
 *  `tri%3A0%2C0%3B…` there — so it is decoded before it is compared (QA F1, 2026-09-08: releasing a
 *  triangle produced no preset). */
export const releaseIdOf = (entry: CatalogueEntry): string => decodeURIComponent(entry.id.split('/')[2])

/** THE PRESETS — every catalogue record whose frame the admin released, at this pitch, in a band the
 *  Library SHOWS. Dan's flow is "select what the Library displays, and from those release" — so a
 *  hidden size is not shippable even if it was released while shown (QA F2). Every layout and view of
 *  a released frame ships with it. Empty until something is released (Dan, 2026-09-07: "the presets i
 *  asked to swap for the library presets"). */
export const releasedRecords = (pitchMM: number, state: LibraryReleaseState): readonly CatalogueEntry[] =>
  catalogue(pitchMM).filter((e) => bandShown(state, e.classId, e.bandId) && recordReleased(state, e.classId, releaseIdOf(e)))

export interface ReleasedShape {
  classId: LibraryFamily
  /** The bands this shape is released in, ascending, each with its records. */
  bands: readonly { bandId: number; records: readonly CatalogueEntry[] }[]
}

/** THE PRESETS AS THE BENCH READS THEM — one SHAPE per released class, its released bands, the
 *  records in each. The shape is the preset; the band row is where its sizes live (Dan, 2026-09-09:
 *  "preset must be shape name, the grid settings display the sizes"). Class order is the library's. */
export function releasedShapes(pitchMM: number, state: LibraryReleaseState): readonly ReleasedShape[] {
  const shapes = new Map<LibraryFamily, Map<number, CatalogueEntry[]>>()
  for (const e of releasedRecords(pitchMM, state)) {
    const bands = shapes.get(e.classId) ?? new Map<number, CatalogueEntry[]>()
    bands.set(e.bandId, [...(bands.get(e.bandId) ?? []), e])
    shapes.set(e.classId, bands)
  }
  return [...shapes].map(([classId, bands]) => ({
    classId,
    bands: [...bands].sort(([a], [b]) => a - b).map(([bandId, records]) => ({ bandId, records })),
  }))
}

/** The release ids the library knows at all, per class — what a stored state may legitimately name.
 *  Read off the catalogue at every released pitch, so the dev route can refuse an id no class ever
 *  published (QA F3). */
export function knownReleaseIds(pitches: readonly number[]): ReadonlyMap<string, ReadonlySet<string>> {
  const out = new Map<string, Set<string>>()
  for (const pitchMM of pitches) for (const e of catalogue(pitchMM)) {
    const set = out.get(e.classId) ?? new Set<string>()
    set.add(releaseIdOf(e)); out.set(e.classId, set)
  }
  return out
}

export { LIBRARY_RELEASE_STATE }
