// library/drafts.ts — hand-authored layouts: browser-local, never mutating the corpus.

import type { LibraryFrame } from './types'

/** CUSTOM LAYOUTS (Dan, 08-25): hand-authored by clicking lattice nodes — a trimmed or sparse
 *  population that no computed mode produces. The 48/96 spacing MODE is computed; anything a
 *  human removes by hand is custom.
 *  Browser-local until exported — the canonical corpus above is never mutated at runtime.
 *  A draft is the same literal shape as a library layout, plus where it belongs. */
export interface LibraryDraft {
  id: string                 // 'draft:<class>:<frame>:<name>'
  className: string          // the class folder, e.g. 'square'
  frameKey: string
  name: string
  nodes: Array<[number, number]>   // lattice units, y-down, same canon as LAYOUT_LIBRARY
}

export const DRAFT_STORE_KEY = 'grid-centre.library-drafts'
export function draftId(className: string, frameKey: string, name: string): string {
  return 'draft:' + className + ':' + frameKey + ':' + name
}

/** Reasons a draft is not saveable — empty list = sound. Pure. */
export function draftIntegrity(d: LibraryDraft, frame: LibraryFrame): string[] {
  const out: string[] = []
  if (!d.name.trim()) out.push('name required')
  if (!d.nodes.length) out.push('at least one magnet required')
  const seen = new Set<string>()
  for (const [x, y] of d.nodes) {
    if (x < 0 || x >= frame.cols || y < 0 || y >= frame.rows) out.push('node out of frame: ' + x + ',' + y)
    const k = x + ',' + y
    if (seen.has(k)) out.push('duplicate node ' + k)
    seen.add(k)
  }
  return out
}
