// library/rules.ts — CLASS POLICY: sub-types, orientation, box measurement, labelling.
// The view asks these; it never tests 'is this a diamond'. Shared with the classifier bridge.

import { MIN_LIB_MM, type LibraryFamily, type LibraryFrame, type LibraryLayout } from './types'

type Node = readonly [number, number]

/** THE SPACING MODES — one vocabulary, every class. 48mm is the perimeter as written; 96mm is
 *  the same ring sampled every other node. The panel renders these; it does not know their
 *  names (Dan, 08-25: "same modes everywhere — those modes must be in the logic file"). */
export const SPACING_BASE = 'perimeter'
export const SPACING_96 = 'perimeter-96'
/** The labels are the PITCH, not the words: the library inherits the bench's pitch tier, so a
 *  hardcoded '48 mm' is physically false at 24 or 96 (QA F3). One node step, or every other. */
export const SPACING_MODES: Array<{ layoutId: string; step: number }> = [
  { layoutId: SPACING_BASE, step: 1 },
  { layoutId: SPACING_96, step: 2 },
]
export const spacingLabel = (step: number, pitchMM: number): string => step * pitchMM + ' mm'
export const isSpacingMode = (name: string): boolean => SPACING_MODES.some((m) => m.layoutId === name)

/** Which indices along a run of n lattice nodes survive a 96mm sample.
 *  Dan, 08-25 19:55: "96mm is skip every 48mm logic" — every other node — and the far end is
 *  always kept, because an unpinned extreme is the failure the belt exists to prevent.
 *  (His earlier four-corner edit to the 4x4 he reclassified himself minutes later: "the edits
 *  i did before to square in 4x4 is sparse ... or custom actually make it custom". Sparse is
 *  the custom mode, not this one.) */
export function sample96(n: number): Set<number> {
  const keep = new Set<number>()
  for (let i = 0; i < n; i += 2) keep.add(i)
  if (n > 0) keep.add(n - 1)
  return keep
}

/** Axis-aligned ring: a node survives if it is an even sample along the side it sits on. */
function box96(frame: LibraryFrame, perimeter: readonly Node[]): Node[] {
  const kx = sample96(frame.cols), ky = sample96(frame.rows)
  return perimeter.filter(([x, y]) => {
    const onRow = y === 0 || y === frame.rows - 1
    const onCol = x === 0 || x === frame.cols - 1
    return (onRow && kx.has(x)) || (onCol && ky.has(y))
  }).map(([x, y]) => [x, y] as Node)
}

/** The triangle's perimeter is three runs — the vertical leg, the base, and the slant, one
 *  node per row. A node is sampled by the run it sits on; the vertices sit on two runs and
 *  survive either way. */
function tri96(frame: LibraryFrame, perimeter: readonly Node[]): Node[] {
  const ky = sample96(frame.rows), kx = sample96(frame.cols)
  const xmax = (y: number) => Math.floor((y * (frame.cols - 1)) / (frame.rows - 1))
  return perimeter.filter(([x, y]) =>
    (x === 0 && ky.has(y)) || (y === frame.rows - 1 && kx.has(x)) || (x === xmax(y) && ky.has(y)),
  ).map(([x, y]) => [x, y] as Node)
}

/** Manhattan ring: sides run vertex to vertex with r+1 nodes; a node's place along its side
 *  is |dx| from the vertical vertex. */
function ring96(frame: LibraryFrame, perimeter: readonly Node[]): Node[] {
  const k = (frame.cols - 1) / 2
  const keep = sample96(k + 1)
  return perimeter.filter(([x]) => keep.has(Math.abs(x - k))).map(([x, y]) => [x, y] as Node)
}

/** The class floor: an n-line axis starts at 24mm and grows one pitch per extra line. */
const boxByClassFloor = (cols: number, rows: number, pitchMM: number) =>
  ({ w: MIN_LIB_MM + (cols - 1) * pitchMM, h: MIN_LIB_MM + (rows - 1) * pitchMM })

/** THE CLASS RULES — one description per class, read by the panel AND available to the
 *  classifier bridge. No class logic lives in the UI (Dan, 08-25): the view asks these, it
 *  never asks 'is this a diamond'. */
export interface ClassRules {
  /** Sub-types offered, in order. One entry means a single fixed type. */
  subs: string[]
  /** Which sub a frame belongs to. */
  subOf: (cols: number, rows: number) => string
  /** The frame's outer box in mm — the class floor, or the wrapping rule the class needs. */
  boxMM: (cols: number, rows: number, pitchMM: number, padMM: number) => { w: number; h: number }
  /** How a frame is labelled to a human. */
  label: (cols: number, rows: number) => string
  /** The views this class offers, in order. Empty means the class has no orientation.
   *  A rectangle turns (transpose); a triangle points its apex at any of four corners. */
  orientations: Array<{ id: string; view: { transpose: boolean; flipX: boolean; flipY: boolean } }>
  /** The 96mm sample of this class's perimeter — the ring geometry differs per class. */
  spacing96: (frame: LibraryFrame, perimeter: readonly Node[]) => Node[]
}

export const CLASS_RULES: Record<LibraryFamily, ClassRules> = {
  square: {
    subs: ['box'],
    subOf: () => 'box',
    boxMM: (c, r, pitch) => boxByClassFloor(c, r, pitch),
    label: (c, r) => c + '×' + r,
    orientations: [],
    spacing96: box96,
  },
  rectangle: {
    subs: ['frame', 'banner', 'slim'],
    subOf: (c, r) => (Math.min(c, r) <= 1 ? 'slim' : Math.min(c, r) === 2 ? 'banner' : 'frame'),
    boxMM: (c, r, pitch) => boxByClassFloor(c, r, pitch),
    label: (c, r) => c + '×' + r,
    orientations: [
      { id: 'portrait', view: { transpose: false, flipX: false, flipY: false } },
      { id: 'landscape', view: { transpose: true, flipX: false, flipY: false } },
    ],
    spacing96: box96,
  },
  diamond: {
    subs: ['rhomb'],
    subOf: () => 'rhomb',
    // the outline WRAPS the ring: half-diagonal = ring radius + padding on the diagonal
    boxMM: (c, _r, pitch, pad) => {
      const span = 2 * (((c - 1) / 2) * pitch + pad * Math.SQRT2)
      return { w: span, h: span }
    },
    label: (c) => { const side = (c - 1) / 2 + 1; return side + '×' + side },
    orientations: [],
    spacing96: ring96,
  },
  triangle: {
    subs: ['wedge'],
    subOf: () => 'wedge',
    // The outline WRAPS the magnets: each of the three edges moves out by the padding, which
    // for a triangle is the same triangle scaled about its incentre. Legs W and H, slant L.
    boxMM: (c, r, pitch, pad) => {
      const W = (c - 1) * pitch, H = (r - 1) * pitch
      if (W === 0 || H === 0) return boxByClassFloor(c, r, pitch)
      const L = Math.hypot(W, H)
      return { w: pad + (pad * L + W * (H + pad)) / H, h: H + pad + (pad * (H + L)) / W }
    },
    label: (c, r) => c + '×' + r,
    orientations: [
      { id: 'apex ↖', view: { transpose: false, flipX: false, flipY: false } },
      { id: 'apex ↗', view: { transpose: false, flipX: true, flipY: false } },
      { id: 'apex ↙', view: { transpose: false, flipX: false, flipY: true } },
      { id: 'apex ↘', view: { transpose: false, flipX: true, flipY: true } },
    ],
    spacing96: tri96,
  },
}

/** A frame as the panel and the pipeline see it: the literal semantic layouts, plus the
 *  computed spacing mode inserted next to the perimeter it samples. The corpus stays literal
 *  (Dan: a readable table, no generation) — only the MODE is computed (Dan: "96mm is mode
 *  correctly calculating ... 96mm is skip every 48mm logic"). */
export function withSpacingModes(family: LibraryFamily, frame: LibraryFrame): LibraryFrame {
  const i = frame.layouts.findIndex((l) => l.name === SPACING_BASE)
  if (i < 0) return frame
  const nodes = CLASS_RULES[family].spacing96(frame, frame.layouts[i].nodes)
  if (!nodes.length) return frame
  const mode: LibraryLayout = { name: SPACING_96, nodes }
  const layouts = [...frame.layouts]
  layouts.splice(i + 1, 0, mode)
  return { ...frame, layouts }
}

/** How a frame reads to a human, per its class. One call site for every label in the panel. */
export function frameLabel(family: LibraryFamily, cols: number, rows: number): string {
  return CLASS_RULES[family].label(cols, rows)
}
