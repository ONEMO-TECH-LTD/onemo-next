// library/triangle-frames.ts — triangle geometry to pitch-aware frame populations.

import { TRIANGLE_LAYOUTS } from './corpus-triangle'
import { sample96, SPACING_96, SPACING_BASE } from './rules'
import { boundsOf, fullNodes, perimeterNodes, perimeterRuns, symmetryClosure, type LatticeNode, type TriangleLayout } from './triangle-geometry'
import type { LibraryFrame, LibraryLayout } from './types'

export const triangleById = (id: string): TriangleLayout => {
  const triangle = TRIANGLE_LAYOUTS.find((item) => item.id === id)
  if (!triangle) throw new Error('library: unknown triangle geometry ' + id)
  return triangle
}

export function trianglePerimeter96(triangle: TriangleLayout, pitchMM: number): LatticeNode[] {
  const keep: LatticeNode[] = []
  for (const run of perimeterRuns(triangle.vertices)) {
    const indices = sample96(run.length, pitchMM)
    run.forEach((node, index) => { if (indices.has(index)) keep.push(node) })
  }
  for (const vertex of triangle.vertices) keep.push(vertex)
  return symmetryClosure(triangle.vertices, keep)
}

export function triangleFrame(triangle: TriangleLayout, pitchMM: number): LibraryFrame {
  const bounds = boundsOf([...triangle.vertices])
  const perimeter = perimeterNodes(triangle.vertices)
  const full = fullNodes(triangle.vertices)
  const layouts: LibraryLayout[] = [
    { name: 'corners', nodes: [...triangle.vertices] },
    { name: SPACING_BASE, nodes: perimeter },
    { name: SPACING_96, nodes: trianglePerimeter96(triangle, pitchMM) },
  ]
  layouts.push(full.length > perimeter.length
    ? { name: 'full', nodes: full, note: 'interior — Full grid only' }
    : { name: 'full', nodes: full })
  return { cols: bounds.cols, rows: bounds.rows, layouts }
}
