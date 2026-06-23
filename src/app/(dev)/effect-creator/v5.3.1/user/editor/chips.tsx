// editor/chips — the Shape sheet's chip lineup + glyphs (Run 2 · G6 decomposition, seam 2).
// Chip icons render from the REAL shape geometry, so a chip can never lie about its shape.
// Blueprint: v3/blueprint/modules/editor.md (+ shape-library.md for the lineup itself).

import { useMemo } from 'react'
import { shapeToSVGPathD } from '@/lib/vector-core'
import { hasVectorDef, getShape } from '@/lib/shape-library'
import { generateShapeRing, type ShapeKind, type ShapeParams } from '../shapes'

// Shape chips — KAI-9129 CURATED launch set (16→10, Dan 2026-06-17). BASICS first. Simple shapes are
// math-derived (square/circle/diamond/polygon/star; squircle = square + Radius; pill = rect + Radius —
// sharp source + reversible recipe). Artistic = as-is/baked, no precision guarantee (heart/sparkle/
// pinched). PARKED for launch — manufacturability / magnetic-attachment uncertain (kept in defs, off the
// picker): plus · teardrop(drop) · leaf · lens · bolt · asterisk · bowtie. The ✦ generative forms are
// not stock library shapes.
export const SHAPE_CHIPS: { kind: ShapeKind; label: string }[] = [
  { kind: 'square', label: 'Square' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'squircle', label: 'Squircle' },
  { kind: 'pill', label: 'Pill' },
  { kind: 'polygon', label: 'Polygon' },
  { kind: 'star', label: 'Star' },
  { kind: 'diamond', label: 'Diamond' },
  { kind: 'heart', label: 'Heart' },
  { kind: 'sparkle', label: 'Sparkle' },
  { kind: 'pinched', label: 'Pinched' },
  { kind: 'daisy', label: 'Daisy ✦' },
  { kind: 'pinwheel', label: 'Pinwheel ✦' },
  { kind: 'form', label: 'Form ✦' },
  { kind: 'blob', label: 'Blob ✦' },
]

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

/** Default generator params (persist across picks within an editor session). */
export const DEFAULT_SHAPE_PARAMS: Required<Omit<ShapeParams, 'kind' | 'rotateDeg'>> = {
  sides: 6, points: 5, spikiness: 45, lobes: 4, pinch: 50,
  petals: 8, depth: 55, blades: 5, swirl: 50, waviness: 50, seed: 1,
}
