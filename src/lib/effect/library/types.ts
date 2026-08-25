// library/types.ts — the layout library's own vocabulary. No engine imports, no React.

export interface LibraryLayout { name: string; nodes: ReadonlyArray<readonly [number, number]>; note?: string }

export interface LibraryFrame { cols: number; rows: number; layouts: LibraryLayout[] }

/** A display transform over a canonical (tall) layout. Pure; closed over the frame. */
export interface LibraryTransform { transpose: boolean; flipX: boolean; flipY: boolean }

/** THE LIBRARY'S OWN REVIEW TAXONOMY (Meta M1): a local declaration, deliberately NOT the
 *  engine classifier's type — runtime family recognition is Step-1's open ruling and the
 *  library must not pre-empt it. DRAFT applicability is review data, never engine policy. */
export type LibraryFamily = 'square' | 'rectangle' | 'diamond'
export const LIBRARY_FAMILIES: LibraryFamily[] = ['square', 'rectangle', 'diamond']

/** THE SHAPE LIBRARY — the ruled classification shapes, literal canonical outlines in the unit
 *  box (y down). aspect 'square' keeps a square span; 'frame' stretches to the frame's span.
 *  Pure data — the bridge materialises, never generates. */
export type LibraryShapeId = 'square' | 'rectangle' | 'diamond'
export interface LibraryShape {
  id: LibraryShapeId
  family: LibraryFamily
  aspect: 'square' | 'frame'
  outline: ReadonlyArray<readonly [number, number]>
}

/** Stable-ID selection — indices are forbidden identity (pruning the draft must never silently
 *  retarget a saved selection). Owned by the pure module. */
export interface LibrarySelection {
  shapeId: LibraryShapeId
  frameKey: string          // 'colsxrows', e.g. '2x3'
  layoutId: string          // layout name, or 'prim:<name>' for a universal primitive
  view: LibraryTransform
}

/** The class floor's first rung: a one-line axis is 24mm. */
export const MIN_LIB_MM = 24
