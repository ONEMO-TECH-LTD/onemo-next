// shape-library — static preset definitions as PURE VECTOR DATA (V3 vector reset, Run 1).
//
// Presets are files, not code (Dan, locked): authored Bézier control points in a unit box,
// instantiated by transform only. No sampling, no fitting, no equations at runtime.
// Sources rule: pre-made in Figma / canonical clean definitions / proper vector generators —
// never derived from raster or segments. Blueprint: v3/blueprint/modules/shape-library.md.
//
// Unit space: each def lives in a box roughly [-1, 1] × [-1, 1], y-DOWN (editor convention),
// centered on (0, 0). `getShape` maps unit → image px.

import type { VAnchor, VShape } from '@/lib/vector-core'

/** Exact circle: 4 smooth anchors, the standard kappa construction (max radial error ~0.027%). */
const KAPPA = 0.5522847498307936

function circleDef(): VShape {
  const k = KAPPA
  const anchors: VAnchor[] = [
    { p: { x: 0, y: -1 }, hIn: { x: -k, y: -1 }, hOut: { x: k, y: -1 }, corner: false },
    { p: { x: 1, y: 0 }, hIn: { x: 1, y: -k }, hOut: { x: 1, y: k }, corner: false },
    { p: { x: 0, y: 1 }, hIn: { x: k, y: 1 }, hOut: { x: -k, y: 1 }, corner: false },
    { p: { x: -1, y: 0 }, hIn: { x: -1, y: k }, hOut: { x: -1, y: -k }, corner: false },
  ]
  return { paths: [{ anchors }] }
}

/** Exact square: 4 corner anchors, no handles — straight lines by construction. */
function squareDef(): VShape {
  const anchors: VAnchor[] = [
    { p: { x: -1, y: -1 }, corner: true },
    { p: { x: 1, y: -1 }, corner: true },
    { p: { x: 1, y: 1 }, corner: true },
    { p: { x: -1, y: 1 }, corner: true },
  ]
  return { paths: [{ anchors }] }
}

/**
 * Canonical heart — the classic suit-heart cubic construction (public-domain construction,
 * 32 × 29.6 design box), restated as 6 anchors: 2 true cusps (top notch, bottom tip) + 4 smooth.
 * Exactly the doctrine skeleton: "heart its 2 cusps", nothing pre-created between.
 */
function heartDef(): VShape {
  // Design-space cubics (x: 0..32, y: 0..29.6, y-down), normalized below.
  // M 23.6,0  C 20.2,0 17.3,2.7 16,5.6           (right lobe top → cusp)
  //           C 14.7,2.7 11.8,0 8.4,0            (cusp → left lobe top)
  //           C 3.8,0 0,3.8 0,8.4                (left lobe outer)
  //           C 0,17.8 9.5,20.3 16,29.6          (left side → bottom tip)
  //           C 22.1,20.3 32,17.5 32,8.4         (bottom tip → right side)
  //           C 32,3.8 28.2,0 23.6,0             (right lobe outer)
  const W = 32, H = 29.6
  const n = (x: number, y: number) => ({ x: (x / W) * 2 - 1, y: (y / H) * 2 - 1 })
  const anchors: VAnchor[] = [
    // right lobe top (smooth)
    { p: n(23.6, 0), hIn: n(28.2, 0), hOut: n(20.2, 0), corner: false },
    // top notch — TRUE CUSP
    { p: n(16, 5.6), hIn: n(17.3, 2.7), hOut: n(14.7, 2.7), corner: true },
    // left lobe top (smooth)
    { p: n(8.4, 0), hIn: n(11.8, 0), hOut: n(3.8, 0), corner: false },
    // left side (smooth)
    { p: n(0, 8.4), hIn: n(0, 3.8), hOut: n(0, 17.8), corner: false },
    // bottom tip — TRUE CUSP
    { p: n(16, 29.6), hIn: n(9.5, 20.3), hOut: n(22.1, 20.3), corner: true },
    // right side (smooth)
    { p: n(32, 8.4), hIn: n(32, 17.5), hOut: n(32, 3.8), corner: false },
  ]
  return { paths: [{ anchors }] }
}

export type VectorShapeKind = 'circle' | 'square' | 'heart'

const DEFS: Record<VectorShapeKind, () => VShape> = {
  circle: circleDef,
  square: squareDef,
  heart: heartDef,
}

export function hasVectorDef(kind: string): kind is VectorShapeKind {
  return kind in DEFS
}

export function unitShape(kind: VectorShapeKind): VShape {
  return DEFS[kind]()
}
