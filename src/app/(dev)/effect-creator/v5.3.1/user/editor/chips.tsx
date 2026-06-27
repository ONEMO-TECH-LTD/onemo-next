// editor/chips — the Shape sheet's chip lineup + glyphs (Run 2 · G6 decomposition, seam 2).
// Chip icons render from the REAL shape geometry, so a chip can never lie about its shape.
// Blueprint: v3/blueprint/modules/editor.md (+ shape-library.md for the lineup itself).

import { useMemo } from 'react'
import { shapeToSVGPathD } from '@/lib/vector-core'
import { hasVectorDef, getShape } from '@/lib/shape-library'
import { generateShapeRing, type ShapeKind } from '../shapes'

// The chip lineup + default params are PURE DATA in ./shape-chips (no React), so the descriptor layer can
// import them without this UI module. Re-exported here for existing UI consumers (sheets.tsx, OutlineEditor).
export { SHAPE_CHIPS, DEFAULT_SHAPE_PARAMS } from './shape-chips'

/** Chip glyph drawn from the SAME geometry as the real shape (24px box, filled) — vector kinds
 *  render their true path data; only the Run-3 generator kinds still rasterize a ring. */
export function ShapeChipIcon({ kind }: { kind: ShapeKind }) {
  const d = useMemo(() => {
    if (hasVectorDef(kind)) return shapeToSVGPathD(getShape(kind, 26, 26), 1)
    const ring = generateShapeRing({ kind }, 26, 26)
    return `M ${ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')} Z`
  }, [kind])
  return <svg width={24} height={24} viewBox="0 0 26 26" aria-hidden><path d={d} fill="currentColor" fillRule="evenodd" /></svg>
}
