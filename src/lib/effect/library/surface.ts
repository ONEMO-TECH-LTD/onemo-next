import { materializeResolved, type MaterializedLibrary } from './materialize'
import { DEFAULT_LIBRARY_BROWSE, panelOptionsResolved, type LibraryBrowse, type PanelOptions } from './options'
import { resolveSelection } from './selection'
import type { LibraryEdit } from './authoring'
import type { LibraryDraft } from './drafts'
import type { LibraryFamily, LibrarySelection } from './types'

export interface LibrarySurface {
  classId: LibraryFamily
  materialized: MaterializedLibrary
  options: PanelOptions
  isDraft: boolean
}

export function librarySurface(
  selection: LibrarySelection, drafts: readonly LibraryDraft[], edit: LibraryEdit | null, pitchMM: number,
  browse: LibraryBrowse = DEFAULT_LIBRARY_BROWSE,
): LibrarySurface {
  const resolved = resolveSelection(selection, drafts, pitchMM)
  const nodes = edit ? edit.nodes : resolved.draft?.nodes
  return {
    classId: resolved.classId,
    materialized: materializeResolved(resolved, nodes ?? null, pitchMM),
    options: panelOptionsResolved(selection, drafts, pitchMM, resolved, browse),
    isDraft: Boolean(resolved.draft),
  }
}
