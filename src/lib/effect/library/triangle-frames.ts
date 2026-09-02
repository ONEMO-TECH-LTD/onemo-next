// library/triangle-frames.ts — triangle geometry to pitch-aware frame populations.

import { TRIANGLE_LAYOUTS } from './corpus-triangle'
import { CANON_LAYOUT, SINGLE_LAYOUT } from './canon'
import { boundsOf, fullNodes, type TriangleLayout } from './triangle-geometry'
import type { LibraryFrame } from './types'

export const triangleById = (id: string): TriangleLayout => {
  const triangle = TRIANGLE_LAYOUTS.find((item) => item.id === id)
  if (!triangle) throw new Error('library: unknown triangle geometry ' + id)
  return triangle
}

/** An APPROVED SHAPE, as the library publishes it: the nodes its three vertices enclose, and
 *  nothing else. The ring, the corners and the 96mm sampling are filters the engine applies on
 *  top of this population (Dan, 2026-08-29) — a triangle publishes its canon like every frame. */
export function triangleFrame(triangle: TriangleLayout): LibraryFrame {
  const bounds = boundsOf([...triangle.vertices])
  const nodes = fullNodes(triangle.vertices)
  return {
    cols: bounds.cols, rows: bounds.rows,
    layouts: [{ name: nodes.length === 1 ? SINGLE_LAYOUT : CANON_LAYOUT, nodes }],
  }
}
