// library/drafts.ts — hand-authored layouts: browser-local, never mutating the corpus.

import { specOf } from './class-registry'
import type { LibraryFamily, LibraryFrame } from './types'

/** CUSTOM LAYOUTS (Dan, 08-25): hand-authored by clicking lattice nodes — a trimmed or sparse
 *  population that no computed mode produces. The 48/96 spacing MODE is computed; anything a
 *  human removes by hand is custom.
 *  Browser-local until exported — the canonical corpus above is never mutated at runtime.
 *  A draft is the same literal shape as a library layout, plus where it belongs. */
export interface LibraryDraft {
  id: string                 // 'draft:<class>:<frame>:<name>'
  className: string          // the class folder, e.g. 'square'
  frameKey: string
  /** WHICH triangle this was drawn on. Two geometries in one frame must not answer for each
   *  other, so the geometry is part of the identity, not a note. */
  geometryId?: string
  name: string
  nodes: Array<[number, number]>   // lattice units, y-down, same canonical basis as the corpus
}

export const DRAFT_STORE_KEY = 'grid-centre.library-drafts'
export function draftId(className: string, frameKey: string, name: string, geometryId?: string): string {
  return 'draft:' + className + ':' + frameKey + (geometryId ? ':' + geometryId : '') + ':' + name
}

/** Reasons a draft is not saveable — empty list = sound. Pure. What makes a POPULATION sound is
 *  the class's own rule (bounds everywhere; the triangle also owes three hull corners), so it is
 *  asked, never tested here. */
export function draftIntegrity(d: LibraryDraft, frame: LibraryFrame): string[] {
  const out: string[] = []
  if (!d.name.trim()) out.push('name required')
  if (!d.nodes.length) out.push('at least one magnet required')
  out.push(...specOf(d.className as LibraryFamily).validateDraft(d, frame))
  return out
}
