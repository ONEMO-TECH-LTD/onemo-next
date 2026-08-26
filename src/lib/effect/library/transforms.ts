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

/** A view as a 2x2 lattice matrix, so views can be COMPOSED and COMPARED. transformLayout
 *  applies transpose, then flipX, then flipY. */
type Mat = readonly [number, number, number, number]   // [a b; c d]
export function viewMatrix(t: LibraryTransform): Mat {
  let m: Mat = t.transpose ? [0, 1, 1, 0] : [1, 0, 0, 1]
  if (t.flipX) m = [-m[0], -m[1], m[2], m[3]]
  if (t.flipY) m = [m[0], m[1], -m[2], -m[3]]
  return m
}
const mul = (a: Mat, b: Mat): Mat =>
  [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]]
/** These are all orthogonal with entries in {-1,0,1}: the inverse is the transpose. */
const inv = (m: Mat): Mat => [m[0], m[2], m[1], m[3]]

const NAMED: Array<{ m: Mat; id: string }> = [
  { m: [1, 0, 0, 1], id: '0°' },
  { m: [0, -1, 1, 0], id: '90°' },
  { m: [-1, 0, 0, -1], id: '180°' },
  { m: [0, 1, -1, 0], id: '270°' },
  { m: [-1, 0, 0, 1], id: 'mirror vertical' },
  { m: [1, 0, 0, -1], id: 'mirror horizontal' },
  { m: [0, 1, 1, 0], id: 'mirror diagonal ↘' },
  { m: [0, -1, -1, 0], id: 'mirror diagonal ↗' },
]

/** What a view reads as RELATIVE TO the one on screen: the presented view is 0°, and every
 *  other button names the turn from there. Naming them against the stored canonical form made
 *  the default read 'mirror diagonal' while the shape sat upright (Dan, 08-26). */
export function viewName(base: LibraryTransform, view: LibraryTransform): string {
  const rel = mul(viewMatrix(view), inv(viewMatrix(base)))
  return NAMED.find((n) => n.m.every((v, i) => v === rel[i]))?.id ?? '?'
}
