// library/types.ts — the layout library's own vocabulary. No engine imports, no React.

export interface FrameExtent { readonly cols: number; readonly rows: number }

export interface LibraryLayout { readonly name: string; readonly nodes: ReadonlyArray<readonly [number, number]>; readonly note?: string }

export interface LibraryFrame extends FrameExtent {
  readonly layouts: readonly LibraryLayout[]
  /** A RECORD'S IDENTITY IS ITS EXTENT — unless the class publishes more than one population at the
   *  same extent, which the circle does: a 3x3 box holds both the nine-magnet disc and the five, and
   *  they are two products, not one product with two settings. Such a class states its own key here
   *  and every other class is untouched (Dan, 2026-09-06: "layouts are actually part of the layout
   *  selection we dont need to have separate panels"). */
  readonly key?: string
}

/** A display transform over a canonical (tall) layout. Pure; closed over the frame. */
export interface LibraryTransform { transpose: boolean; flipX: boolean; flipY: boolean }

export type PointMM = readonly [number, number]

/** Stable registered class identity; validity is owned by the fail-loud registry. */
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
