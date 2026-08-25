// library/transforms.ts — pure integer geometry over a frame. Resolution lives in selection.ts.

import type { LibraryFrame, LibraryLayout, LibraryTransform } from './types'

/** Apply a transform. Pure integer geometry — no engine, no React. */
export function transformLayout(
  frame: LibraryFrame, layout: LibraryLayout, t: LibraryTransform,
): { cols: number; rows: number; nodes: Array<[number, number]> } {
  let c = frame.cols, r = frame.rows
  let ns = layout.nodes.map(([x, y]) => [x, y] as [number, number])
  if (t.transpose) { ns = ns.map(([x, y]) => [y, x]); const k = c; c = r; r = k }
  if (t.flipX) ns = ns.map(([x, y]) => [c - 1 - x, y])
  if (t.flipY) ns = ns.map(([x, y]) => [x, r - 1 - y])
  return { cols: c, rows: r, nodes: ns }
}

/** Frame kind, the classifier's taxonomy (square / slim / standard) — pure. */
export function kindOf(cols: number, rows: number): 'square' | 'slim' | 'standard' {
  return cols === rows ? 'square' : Math.min(cols, rows) <= 2 ? 'slim' : 'standard'
}

export function orientationOf(cols: number, rows: number): 'tall' | 'wide' | 'even' {
  return rows > cols ? 'tall' : cols > rows ? 'wide' : 'even'
}

export function frameKeyOf(f: LibraryFrame): string { return f.cols + 'x' + f.rows }

/** The inverse of transformLayout for ONE node: a view-space node back to canonical.
 *  Undo in reverse order — flipY, then flipX (both against the TRANSFORMED dimensions),
 *  then the transpose. Authoring picks land in view space; the corpus and every draft are
 *  canonical, and mixing the two silently corrupted layouts under landscape (QA F2). */
export function canonicalNode(
  frame: LibraryFrame, t: LibraryTransform, node: readonly [number, number],
): [number, number] {
  const c = t.transpose ? frame.rows : frame.cols
  const r = t.transpose ? frame.cols : frame.rows
  let [x, y] = node
  if (t.flipY) y = r - 1 - y
  if (t.flipX) x = c - 1 - x
  return t.transpose ? [y, x] : [x, y]
}
