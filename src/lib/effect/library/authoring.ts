// library/authoring.ts — THE AUTHORING TRANSITIONS. Starting, editing, saving and deleting a
// hand-authored layout, and toggling a magnet on the lattice, were all written out in the page,
// which meant the page knew the draft-id convention, the class's own draft identity, and which
// population a "custom" starts from. Dan, 08-26: "no logic in UI shell and poage".
//
// Every function here is pure: state in, state out. The page holds React state and calls these.

import { specOf } from './class-registry'
import { draftId, draftIntegrity, type LibraryDraft } from './drafts'
import { draftLayoutId, draftNameOf, resolveSelection } from './selection'
import { nodeAtMM } from './geometry'
import { canonicalNode, frameKeyOf } from './transforms'
import type { LibrarySelection } from './types'

/** A layout being drawn. Not stored until it is saved. */
export interface LibraryEdit {
  name: string
  nodes: Array<[number, number]>
}

/** A brand-new layout: an empty population on the selected frame. */
export const startAdd = (): LibraryEdit => ({ name: '', nodes: [] })

/** Edit what is on screen. A custom seeds from the population AT THIS PITCH, not the canonical
 *  48mm set, because the 96mm mode is physical and the admin is editing what they can see. */
export function startEdit(
  sel: LibrarySelection, drafts: readonly LibraryDraft[], pitchMM: number,
): LibraryEdit {
  const { layout, draft } = resolveSelection(sel, drafts, pitchMM)
  // the frame already carries the population for THIS pitch, so there is nothing to repair
  const source = draft?.nodes ?? layout.nodes
  return {
    name: draft ? draft.name : layout.name + '-custom',
    nodes: source.map(([x, y]) => [x, y] as [number, number]),
  }
}

/** Save. The corpus checks its own soundness and an authored layout gets the same gate before
 *  it is persisted (QA F1) — a draft that breaks its frame is never written. */
export function saveEdit(
  sel: LibrarySelection, drafts: readonly LibraryDraft[], edit: LibraryEdit, pitchMM: number,
): { ok: true; drafts: LibraryDraft[]; sel: LibrarySelection } | { ok: false; error: string } {
  const { classId, frame, safeSel } = resolveSelection(sel, drafts, pitchMM)
  const parts = specOf(classId).draftIdParts(safeSel, safeSel.frameKey)
  const rec: LibraryDraft = {
    id: draftId(parts.className, parts.frameKey, edit.name, parts.geometryId),
    className: parts.className, frameKey: parts.frameKey, geometryId: parts.geometryId,
    name: edit.name, nodes: edit.nodes,
  }
  const bad = draftIntegrity(rec, frame)
  if (bad.length) return { ok: false, error: bad[0] }
  return {
    ok: true,
    drafts: [...drafts.filter((x) => x.id !== rec.id), rec],
    sel: { ...sel, layoutId: draftLayoutId(edit.name) },
  }
}

/** Delete the draft being edited, or the one the selection names. Which stored drafts answer to
 *  this selection is the class's rule, not a field comparison written out here. */
export function deleteEdit(
  sel: LibrarySelection, drafts: readonly LibraryDraft[], edit: LibraryEdit | null, pitchMM: number,
): { drafts: LibraryDraft[]; sel: LibrarySelection } {
  const name = edit ? edit.name : draftNameOf(sel.layoutId)
  const { classId, frame } = resolveSelection(sel, drafts, pitchMM)
  const spec = specOf(classId)
  const frameKey = frameKeyOf(frame)
  return {
    drafts: drafts.filter((x) => !(spec.draftMatches(x, sel, frameKey) && x.name === name)),
    sel: { ...sel, layoutId: frame.layouts[0].name },
  }
}

/** A lattice spot was clicked while drawing. The click lands in VIEW space and drafts are
 *  canonical (QA F2); a click outside the frame is ignored, so an authored layout can never
 *  hold a node its own frame does not contain (QA F1). */
export function toggleNodeAt(
  sel: LibrarySelection, drafts: readonly LibraryDraft[], edit: LibraryEdit,
  pMM: readonly [number, number], pitchMM: number,
): LibraryEdit {
  const { frame } = resolveSelection(sel, drafts, pitchMM)
  const cols = sel.view.transpose ? frame.rows : frame.cols
  const rows = sel.view.transpose ? frame.cols : frame.rows
  const [ix, iy] = nodeAtMM(pMM, rows, pitchMM)
  if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) return edit
  const n = canonicalNode(frame, sel.view, [ix, iy])
  const k = n[0] + ',' + n[1]
  const has = edit.nodes.some(([x, y]) => x + ',' + y === k)
  return { ...edit, nodes: has ? edit.nodes.filter(([x, y]) => x + ',' + y !== k) : [...edit.nodes, n] }
}
