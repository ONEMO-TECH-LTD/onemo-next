// library/types.ts — the layout library's own vocabulary. No engine imports, no React.

export interface FrameExtent { readonly cols: number; readonly rows: number }

export interface LibraryLayout { readonly name: string; readonly nodes: ReadonlyArray<readonly [number, number]>; readonly note?: string }

export interface LibraryFrame extends FrameExtent { readonly layouts: readonly LibraryLayout[] }

/** A display transform over a canonical (tall) layout. Pure; closed over the frame. */
export interface LibraryTransform { transpose: boolean; flipX: boolean; flipY: boolean }

export type PointMM = readonly [number, number]

/** THE LIBRARY'S OWN REVIEW TAXONOMY (Meta M1): a local declaration, deliberately NOT the
 *  engine classifier's type — runtime family recognition is Step-1's open ruling and the
 *  library must not pre-empt it. */
/** A class whose frames are a literal table. The triangle's frames come from the geometry the
 *  selection names, so it is not one of these and carries no frame registry. */
export type LibraryFamily = string

/** Stable-ID selection — indices are forbidden identity (pruning the draft must never silently
 *  retarget a saved selection). Owned by the pure module. */
export interface LibrarySelection {
  classId: LibraryFamily
  frameKey: string          // 'colsxrows', e.g. '2x3'
  layoutId: string          // stable layout identity
  /** WHICH triangle. Geometry and population are different axes: the geometry names the shape
   *  (its three vertices), layoutId names the magnets on it. Mandatory for the triangle. */
  geometryId?: string
  view: LibraryTransform
}
