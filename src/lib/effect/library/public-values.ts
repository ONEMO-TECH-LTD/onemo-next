import { LIBRARY_FAMILIES } from './class-registry'
import { catalogue, CATALOGUE_FORMAT_VERSION } from './catalogue'
import { librarySurface } from './surface'
import { selectionForFamily } from './options'
import { startAdd, startEdit, saveEdit, deleteEdit, toggleNodeAt } from './authoring'
import { DRAFT_STORE_KEY } from './drafts'
import type { LibrarySelection } from './types'

export const DEFAULT_LIBRARY_SELECTION: LibrarySelection = {
  classId: 'square', frameKey: '3x3', layoutId: 'perimeter',
  view: { transpose: false, flipX: false, flipY: false },
}

export { LIBRARY_FAMILIES, CATALOGUE_FORMAT_VERSION, catalogue, librarySurface,
  selectionForFamily, startAdd, startEdit, saveEdit, deleteEdit, toggleNodeAt, DRAFT_STORE_KEY }
