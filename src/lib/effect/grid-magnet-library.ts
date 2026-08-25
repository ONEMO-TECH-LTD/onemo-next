// grid-magnet-library.ts — THE LAYOUT LIBRARY (DRAFT, awaiting Dan's approval).
//
// Literal data, written out — never generated at solve time. Node coordinates are lattice
// units [ix, iy], iy = 0 at the TOP, canonical tall orientation; wide frames are the
// transpose, mirrors are reflections — the viewer derives those for display.

export interface LibraryLayout { name: string; nodes: ReadonlyArray<readonly [number, number]>; note?: string }
export interface LibraryFrame { cols: number; rows: number; layouts: LibraryLayout[] }

/** A display transform over a canonical (tall) layout. Pure; closed over the frame. */
export interface LibraryTransform { transpose: boolean; flipX: boolean; flipY: boolean }

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

/** THE LIBRARY'S OWN REVIEW TAXONOMY (Meta M1): a local declaration, deliberately NOT the
 *  engine classifier's type — runtime family recognition is Step-1's open ruling and the
 *  library must not pre-empt it. DRAFT applicability is review data, never engine policy. */
export type LibraryFamily = 'square' | 'rectangle' | 'diamond'
export const LIBRARY_FAMILIES: LibraryFamily[] = ['square', 'rectangle', 'diamond']
export const FAMILY_APPLICABILITY_DRAFT: Record<LibraryFamily, string[]> = {
  square: ['single', 'full', 'perimeter', 'perimeter-96', 'corners'],
  rectangle: ['full', 'perimeter', 'perimeter-96', 'corners'],
  diamond: ['single', 'full', 'perimeter', 'perimeter-96', 'corners'],
}


/** Integrity of the canonical data — every violation named; empty list = sound. */
export function libraryIntegrity(): string[] {
  const out: string[] = []
  const seenFrames = new Set<string>()
  for (const f of LAYOUT_LIBRARY) {
    const fk = f.cols + 'x' + f.rows
    if (seenFrames.has(fk)) out.push('duplicate frame ' + fk)
    seenFrames.add(fk)
    const names = new Set<string>()
    for (const l of f.layouts) {
      if (names.has(l.name)) out.push(fk + ': duplicate layout name ' + l.name)
      names.add(l.name)
      const nodes = new Set<string>()
      for (const [x, y] of l.nodes) {
        if (x < 0 || x >= f.cols || y < 0 || y >= f.rows) out.push(fk + ' ' + l.name + ': node out of bounds ' + x + ',' + y)
        const k = x + ',' + y
        if (nodes.has(k)) out.push(fk + ' ' + l.name + ': duplicate node ' + k)
        nodes.add(k)
      }
      if (!l.nodes.length) out.push(fk + ' ' + l.name + ': empty layout')
    }
    if (!f.layouts.length) out.push(fk + ': no layouts')
  }
  return out
}

export const SQUARE_FRAMES: LibraryFrame[] = [
  { cols: 1, rows: 1, layouts: [
    { name: 'single', nodes: [[0, 0]] },
  ] },
  { cols: 2, rows: 2, layouts: [
    { name: 'full', nodes: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { name: 'perimeter', nodes: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { name: 'perimeter-96', nodes: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { name: 'corners', nodes: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  ] },
  { cols: 3, rows: 3, layouts: [
    { name: 'full', nodes: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]] },
    { name: 'perimeter-96', nodes: [[0, 0], [2, 0], [0, 2], [2, 2]] },
    { name: 'corners', nodes: [[0, 0], [2, 0], [0, 2], [2, 2]] },
  ] },
  { cols: 4, rows: 4, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [3, 1], [0, 2], [3, 2], [0, 3], [1, 3], [2, 3], [3, 3]] },
    { name: 'perimeter-96', nodes: [[0, 0], [2, 0], [3, 0], [0, 2], [3, 2], [0, 3], [2, 3], [3, 3]] },
    { name: 'corners', nodes: [[0, 0], [3, 0], [0, 3], [3, 3]] },
  ] },
  { cols: 5, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [4, 1], [0, 2], [4, 2], [0, 3], [4, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] },
    { name: 'perimeter-96', nodes: [[0, 0], [2, 0], [4, 0], [0, 2], [4, 2], [0, 4], [2, 4], [4, 4]] },
    { name: 'corners', nodes: [[0, 0], [4, 0], [0, 4], [4, 4]] },
  ] },
]
/** RECTANGLE sub-types, ruled 08-24: SLIM = the minor axis carries one line (chains only);
 *  Dan, 08-25: FRAME = the standard 2D rectangle (3+ lines across) · BANNER = narrow (2 lines)
 *  · SLIM = the slimmest, a single chain (1 line). Orientation is portrait/landscape and is
 *  the axis pair (the transpose), never a type. */
export type RectangleSub = 'frame' | 'banner' | 'slim'
export const RECTANGLE_SUBS: RectangleSub[] = ['frame', 'banner', 'slim']
/** SQUARE class types — one so far: BOX (Dan, 08-25). */
export type SquareSub = 'box'
export const SQUARE_SUBS: SquareSub[] = ['box']
export function rectangleSubOf(cols: number, rows: number): RectangleSub {
  const minor = Math.min(cols, rows)
  return minor <= 1 ? 'slim' : minor === 2 ? 'banner' : 'frame'
}

/** RECTANGLE class — tall canonical frames; wide is the transpose. */
export const RECTANGLE_FRAMES: LibraryFrame[] = [
  { cols: 1, rows: 2, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1]] },
  ] },
  { cols: 1, rows: 3, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2]] },
  ] },
  { cols: 1, rows: 4, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 3]] },
    { name: 'corners', nodes: [[0, 0], [0, 3]] },
  ] },
  { cols: 1, rows: 5, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4]] },
  ] },
  { cols: 2, rows: 3, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [1, 0], [1, 2]] },
  ] },
  { cols: 2, rows: 4, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 3], [1, 0], [1, 2], [1, 3]] },
    { name: 'corners', nodes: [[0, 0], [0, 3], [1, 0], [1, 3]] },
  ] },
  { cols: 2, rows: 5, layouts: [
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4], [1, 0], [1, 2], [1, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [1, 0], [1, 4]] },
  ] },
  { cols: 3, rows: 4, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 3], [2, 0], [2, 2], [2, 3]] },
    { name: 'corners', nodes: [[0, 0], [0, 3], [2, 0], [2, 3]] },
  ] },
  { cols: 3, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4], [2, 0], [2, 2], [2, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [2, 0], [2, 4]] },
  ] },
  { cols: 4, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 4], [2, 0], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4], [2, 0], [2, 4], [3, 0], [3, 2], [3, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [3, 0], [3, 4]] },
  ] },
  { cols: 4, rows: 6, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 5], [2, 0], [2, 5], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4], [0, 5], [2, 0], [2, 5], [3, 0], [3, 2], [3, 4], [3, 5]] },
    { name: 'corners', nodes: [[0, 0], [0, 5], [3, 0], [3, 5]] },
  ] },
  { cols: 5, rows: 6, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 5], [2, 0], [2, 5], [3, 0], [3, 5], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]] },
    { name: 'perimeter-96', nodes: [[0, 0], [0, 2], [0, 4], [0, 5], [2, 0], [2, 5], [4, 0], [4, 2], [4, 4], [4, 5]] },
    { name: 'corners', nodes: [[0, 0], [0, 5], [4, 0], [4, 5]] },
  ] },
]

/** The frames a class carries. */
/** DIAMOND class — the lattice never rotates; a diamond is a node set read from a centre node
 *  outward (Manhattan rings). D1 single · D2 four at one cell · D3 eight at two · D4 twelve at
 *  three, each with its axis-only thinning and its centre-filled variant. */
export const DIAMOND_FRAMES: LibraryFrame[] = [
  { cols: 1, rows: 1, layouts: [
    { name: 'single', nodes: [[0, 0]] },
  ] },
  { cols: 3, rows: 3, layouts: [
    { name: 'full', nodes: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 1], [1, 0], [1, 2], [2, 1]] },
    { name: 'perimeter-96', nodes: [[1, 0], [1, 2]] },
  ] },
  { cols: 5, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 2], [1, 1], [1, 3], [2, 0], [2, 2], [2, 4], [3, 1], [3, 3], [4, 2]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 2], [1, 1], [1, 3], [2, 0], [2, 4], [3, 1], [3, 3], [4, 2]] },
    { name: 'perimeter-96', nodes: [[0, 2], [2, 0], [2, 4], [4, 2]] },
    { name: 'corners', nodes: [[0, 2], [2, 0], [2, 4], [4, 2]] },
  ] },
  { cols: 7, rows: 7, layouts: [
    { name: 'full', nodes: [[0, 3], [1, 2], [1, 4], [2, 1], [2, 5], [3, 0], [3, 3], [3, 6], [4, 1], [4, 5], [5, 2], [5, 4], [6, 3]], note: 'interior — Full grid only' },
    { name: 'perimeter', nodes: [[0, 3], [1, 2], [1, 4], [2, 1], [2, 5], [3, 0], [3, 6], [4, 1], [4, 5], [5, 2], [5, 4], [6, 3]] },
    { name: 'perimeter-96', nodes: [[1, 2], [1, 4], [3, 0], [3, 6], [5, 2], [5, 4]] },
    { name: 'corners', nodes: [[0, 3], [3, 0], [3, 6], [6, 3]] },
  ] },
]


export const CLASS_FRAMES: Record<LibraryFamily, LibraryFrame[]> = {
  square: SQUARE_FRAMES,
  rectangle: RECTANGLE_FRAMES,
  diamond: DIAMOND_FRAMES,
}
/** Back-compat alias — the square corpus. */
export const LAYOUT_LIBRARY = SQUARE_FRAMES





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
export const LIBRARY_SHAPES: LibraryShape[] = [
  { id: 'square', family: 'square', aspect: 'square', outline: [[0.0000, 0.0000], [1.0000, 0.0000], [1.0000, 1.0000], [0.0000, 1.0000]] },
  { id: 'rectangle', family: 'rectangle', aspect: 'frame', outline: [[0.0000, 0.0000], [1.0000, 0.0000], [1.0000, 1.0000], [0.0000, 1.0000]] },
  { id: 'diamond', family: 'diamond', aspect: 'square', outline: [[0.5000, 0.0000], [1.0000, 0.5000], [0.5000, 1.0000], [0.0000, 0.5000]] },
]





/** Stable-ID selection — indices are forbidden identity (pruning the draft must never silently
 *  retarget a saved selection). Owned by the pure module. */
export interface LibrarySelection {
  shapeId: LibraryShapeId
  frameKey: string          // 'colsxrows', e.g. '2x3'
  layoutId: string          // layout name, or 'prim:<name>' for a universal primitive
  view: LibraryTransform
}
export function frameKeyOf(f: LibraryFrame): string { return f.cols + 'x' + f.rows }
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


/** CUSTOM LAYOUTS (Dan, 08-25): hand-authored by clicking lattice nodes — a trimmed or sparse
 *  population that no computed mode produces. The 48/96 spacing MODE is computed; anything a
 *  human removes by hand is custom.
 *  Browser-local until exported — the canonical corpus above is never mutated at runtime.
 *  A draft is the same literal shape as a library layout, plus where it belongs. */
export interface LibraryDraft {
  id: string                 // 'draft:<class>:<frame>:<name>'
  className: string          // the class folder, e.g. 'square'
  frameKey: string
  name: string
  nodes: Array<[number, number]>   // lattice units, y-down, same canon as LAYOUT_LIBRARY
}
export const DRAFT_STORE_KEY = 'grid-centre.library-drafts'
export function draftId(className: string, frameKey: string, name: string): string {
  return 'draft:' + className + ':' + frameKey + ':' + name
}
/** Reasons a draft is not saveable — empty list = sound. Pure. */
export function draftIntegrity(d: LibraryDraft, frame: LibraryFrame): string[] {
  const out: string[] = []
  if (!d.name.trim()) out.push('name required')
  if (!d.nodes.length) out.push('at least one magnet required')
  const seen = new Set<string>()
  for (const [x, y] of d.nodes) {
    if (x < 0 || x >= frame.cols || y < 0 || y >= frame.rows) out.push('node out of frame: ' + x + ',' + y)
    const k = x + ',' + y
    if (seen.has(k)) out.push('duplicate node ' + k)
    seen.add(k)
  }
  return out
}

/** The layout a frame should land on: the preferred name when it carries it, else its first.
 *  Every class/type/frame switch goes through this — a selection can never name a layout the
 *  frame does not have (that threw the strict resolver and took the page down, 08-25). */
export function pickLayout(frame: LibraryFrame, preferred: string): string {
  return frame.layouts.some((l) => l.name === preferred) ? preferred : frame.layouts[0].name
}

/** A diamond's frame is displayed by MAGNETS PER SIDE (Dan, 08-25): the 4-ring shows 2x2, the
 *  8-ring 3x3, the 12-ring 4x4 — the bounding lattice patch (3x3, 5x5, 7x7) stays the internal
 *  key because the node maths lives on it. */
export function frameLabel(family: LibraryFamily, cols: number, rows: number): string {
  if (family !== 'diamond') return cols + '×' + rows
  const k = (cols - 1) / 2
  const side = k + 1
  return side + '×' + side
}
