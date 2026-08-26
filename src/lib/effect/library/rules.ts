// library/rules.ts — CLASS POLICY: sub-types, orientation, box measurement, labelling.
// The view renders this policy without deciding which class it receives.

import { MIN_LIB_MM, type LibraryFrame, type LibraryLayout, type LibraryTransform, type RegistryFamily } from './types'

type Node = readonly [number, number]

/** THE SPACING MODES — one vocabulary, every class. 48mm is the perimeter as written; 96mm is
 *  the same ring sampled every other node. The panel renders these; it does not know their
 *  names (Dan, 08-25: "same modes everywhere — those modes must be in the logic file"). */
export const SPACING_BASE = 'perimeter'
export const SPACING_96 = 'perimeter-96'
/** The two spacings are PHYSICAL and fixed everywhere (Dan, 08-25): one node step, or 96mm.
 *  The 96 population therefore changes with the pitch tier while the label does not — at 24
 *  it takes every fourth node, at 96 every node. Arbitrary populations are custom, not this. */
export const SPACING_MODES: Array<{ layoutId: string; label: string }> = [
  { layoutId: SPACING_BASE, label: '48 mm' },
  { layoutId: SPACING_96, label: '96 mm' },
]
export const isSpacingMode = (name: string): boolean => SPACING_MODES.some((m) => m.layoutId === name)

/** Which indices along a run survive the 96mm mode at the given pitch. 96mm is a physical
 *  distance, so the stride is 96/pitch nodes; the far end is always kept, because an unpinned
 *  extreme is the failure the belt exists to prevent. A short closing interval is lawful —
 *  Dan's hand-made sparse populations are the CUSTOM mode, never this one. */
export function sample96(n: number, pitchMM = 48): Set<number> {
  const stride = 96 / pitchMM
  if (!Number.isInteger(stride) || stride < 1) throw new Error('library: 96mm mode unsupported at pitch ' + pitchMM)
  const keep = new Set<number>()
  for (let i = 0; i < n; i += stride) keep.add(i)
  if (n > 0) keep.add(n - 1)
  return keep
}

/** Axis-aligned ring, WALKED CLOCKWISE. Each side indexes from its own start, so the short
 *  closing interval of a non-divisible run lands as rotationally balanced pairs instead of
 *  biased to one absolute direction (Dan, 08-25: the 4x4 must pair, not lean). */
function box96(frame: LibraryFrame, perimeter: readonly Node[], pitchMM: number): Node[] {
  const kx = sample96(frame.cols, pitchMM), ky = sample96(frame.rows, pitchMM)
  // A one-line frame is a chain, not a ring: its two long sides are the same nodes walked in
  // opposite directions, and treating them as a ring would keep every node and make the 96
  // mode identical to the perimeter. Sample the single run once.
  if (frame.cols === 1) return perimeter.filter(([, y]) => ky.has(y)).map(([x, y]) => [x, y] as Node)
  if (frame.rows === 1) return perimeter.filter(([x]) => kx.has(x)).map(([x, y]) => [x, y] as Node)
  return perimeter.filter(([x, y]) => (
    (y === 0 && kx.has(x))                                  // top, left to right
    || (x === frame.cols - 1 && ky.has(y))                  // right, top to bottom
    || (y === frame.rows - 1 && kx.has(frame.cols - 1 - x)) // bottom, right to left
    || (x === 0 && ky.has(frame.rows - 1 - y))              // left, bottom to top
  )).map(([x, y]) => [x, y] as Node)
}

/** Manhattan ring: sides run vertex to vertex with r+1 nodes; a node's place along its side
 *  is |dx| from the vertical vertex. */
function ring96(frame: LibraryFrame, perimeter: readonly Node[], pitchMM: number): Node[] {
  const k = (frame.cols - 1) / 2
  const keep = sample96(k + 1, pitchMM)
  return perimeter.filter(([x, y]) => {
    const along = y <= k && x >= k ? x - k          // top-right side
      : x >= k && y >= k ? y - k                    // bottom-right
        : y >= k && x <= k ? k - x                  // bottom-left
          : k - y                                   // top-left
    return keep.has(along)
  }).map(([x, y]) => [x, y] as Node)
}

/** The class floor: an n-line axis starts at 24mm and grows one pitch per extra line. */
const boxByClassFloor = (cols: number, rows: number, pitchMM: number) =>
  ({ w: MIN_LIB_MM + (cols - 1) * pitchMM, h: MIN_LIB_MM + (rows - 1) * pitchMM })

/** THE REGISTRY CLASS RULES — one description per class whose frames are a literal table.
 *  A class whose frames are MATERIALISED from a geometry has none of these, and does not
 *  appear here at all: there is no sentinel entry to mistake for a real one. */
export interface RegistryRules {
  /** Sub-types offered, in order. One entry means a single fixed type. */
  subs: string[]
  /** How a frame is labelled to a human. */
  label: (cols: number, rows: number) => string
  /** Which sub a frame belongs to. */
  subOf: (cols: number, rows: number) => string
  /** The frame's outer box in mm — the class floor, or the wrapping rule the class needs. */
  boxMM: (cols: number, rows: number, pitchMM: number, padMM: number) => { w: number; h: number }
  /** The views this class names. Empty means it has no orientation of its own. */
  orientations: Array<{ id: string; view: LibraryTransform }>
  /** The 96mm sample of this class's perimeter — the ring geometry differs per class. */
  spacing96: (frame: LibraryFrame, perimeter: readonly Node[], pitchMM: number) => Node[]
}

export const REGISTRY_RULES = {
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
} satisfies Record<RegistryFamily, RegistryRules>

/** A frame as the panel and the pipeline see it: the literal semantic layouts, plus the
 *  computed spacing mode inserted next to the perimeter it samples. The corpus stays literal
 *  (Dan: a readable table, no generation) — only the MODE is computed (Dan: "96mm is mode
 *  correctly calculating ... 96mm is skip every 48mm logic").
 *
 *  96mm is a PHYSICAL distance, so the population depends on the pitch and the pitch must be
 *  known here. Composing once at 48 and repairing later meant the panel counted a different
 *  set of magnets from the one the canvas drew, at every pitch except 48. */
export function withSpacingModes(
  family: RegistryFamily, frame: LibraryFrame, pitchMM: number,
): LibraryFrame {
  const i = frame.layouts.findIndex((l) => l.name === SPACING_BASE)
  if (i < 0) return frame
  const nodes = REGISTRY_RULES[family].spacing96(frame, frame.layouts[i].nodes, pitchMM)
  if (!nodes.length) return frame
  const mode: LibraryLayout = { name: SPACING_96, nodes }
  const layouts = [...frame.layouts]
  layouts.splice(i + 1, 0, mode)
  return { ...frame, layouts }
}
