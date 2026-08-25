// library/transforms.ts — pure geometry and resolution over the corpus.

import { CLASS_FRAMES } from './frames'
import { LIBRARY_SHAPES } from './shapes'
import type { LibraryFrame, LibraryLayout, LibrarySelection, LibraryShape, LibraryTransform } from './types'

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

/** The layout a frame should land on: the preferred name when it carries it, else its first.
 *  Every class/type/frame switch goes through this — a selection can never name a layout the
 *  frame does not have (that threw the strict resolver and took the page down, 08-25). */
export function pickLayout(frame: LibraryFrame, preferred: string): string {
  return frame.layouts.some((l) => l.name === preferred) ? preferred : frame.layouts[0].name
}

export function selectedRecords(sel: LibrarySelection): {
  shape: LibraryShape
  frame: LibraryFrame
  layout: LibraryLayout
} {
  // FAIL LOUD (QA F3): stable IDs exist so a stale or mistyped identity can never silently
  // retarget to unrelated data — an unknown ID is an error, never a 1x1 fallback.
  const shape = LIBRARY_SHAPES.find((x) => x.id === sel.shapeId)
  if (!shape) throw new Error('library: unknown shapeId ' + sel.shapeId)
  const frame = CLASS_FRAMES[shape.family].find((f) => frameKeyOf(f) === sel.frameKey)
  if (!frame) throw new Error('library: unknown frameKey ' + sel.frameKey)
  const layout = frame.layouts.find((l) => l.name === sel.layoutId)
  if (!layout) throw new Error('library: unknown layoutId ' + sel.layoutId + ' in ' + sel.frameKey)
  return { shape, frame, layout }
}
