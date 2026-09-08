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

export const classRelease = (state: LibraryReleaseState, classId: LibraryFamily): ClassRelease =>
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

export { LIBRARY_RELEASE_STATE }
