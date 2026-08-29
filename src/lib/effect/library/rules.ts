// library/rules.ts — shared physical spacing-mode policy.
// Owns the fixed spacing vocabulary and pitch-aware 96mm samplers; no UI or class taxonomy.

import type { LibraryFrame, LibraryLayout } from './types'
import { BANDS } from '../grid-magnet-spec'

/** THE BAND OF A LAYOUT — read off the dominant axis of its LEGAL AREA, against the engine's own
 *  band table. One home for the ranges, so the band the engine asks for and the band the catalogue
 *  groups by are the same band by construction, not by agreement.
 *
 *  For a library record the legal area needs no erosion: the outline is generated FROM the disks
 *  plus their own 12mm rim, so the disk group's extent already is it.
 *
 *  This is where a layout SITS. What band an ANSWER lands in is decided by the wrap on the real
 *  shape — the catalogue groups, it does not adjudicate. */
export function bandIdOfMM(legalMM: number): number | null {
  return BANDS.find((b) => legalMM >= b.minMM && legalMM <= b.maxMM)?.id ?? null
}

/** THE LEGAL BOX of a placed magnet group — the span the seats themselves occupy.
 *
 *  Both sides, because both are needed: the longer one gives the band, and the ratio between them
 *  is what says which layouts a shape can wear at all. The OUTER aspect is locked by proportional
 *  scaling and therefore tells you nothing; the LEGAL aspect moves with size, because the 12mm rim
 *  does not scale — a 100×50 shape's legal box is 2.92:1 and the same shape at 400×200 is 2.14:1.
 *  That drift is what brings different layouts into range as the shape grows. */
export function legalBoxMM(nodes: readonly Node[]): { widthMM: number; heightMM: number } {
  if (!nodes.length) return { widthMM: 0, heightMM: 0 }
  const xs = nodes.map((n) => n[0]), ys = nodes.map((n) => n[1])
  return { widthMM: Math.max(...xs) - Math.min(...xs), heightMM: Math.max(...ys) - Math.min(...ys) }
}

/** The longer side of the legal box — what the band is read from. */
export function legalExtentMM(nodes: readonly Node[]): number {
  const box = legalBoxMM(nodes)
  return Math.max(box.widthMM, box.heightMM)
}

/** Longer side over shorter, 1 for a square box. Infinity where a side is zero — a single line of
 *  magnets has no width, and that is an answer, not a missing value. */
export function aspectOf(widthMM: number, heightMM: number): number {
  const lo = Math.min(widthMM, heightMM), hi = Math.max(widthMM, heightMM)
  if (hi === 0) return 1
  return lo === 0 ? Infinity : hi / lo
}

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
export function sample96(n: number, pitchMM: number): Set<number> {
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
export function box96(frame: LibraryFrame, perimeter: readonly Node[], pitchMM: number): Node[] {
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
export function ring96(frame: LibraryFrame, perimeter: readonly Node[], pitchMM: number): Node[] {
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

/** A frame as the panel and the pipeline see it: the literal semantic layouts, plus the
 *  computed spacing mode inserted next to the perimeter it samples. The corpus stays literal
 *  (Dan: a readable table, no generation) — only the MODE is computed (Dan: "96mm is mode
 *  correctly calculating ... 96mm is skip every 48mm logic").
 *
 *  96mm is a PHYSICAL distance, so the population depends on the pitch and the pitch must be
 *  known here. Composing once at 48 and repairing later meant the panel counted a different
 *  set of magnets from the one the canvas drew, at every pitch except 48. */
type SpacingSampler = (
  frame: LibraryFrame, perimeter: ReadonlyArray<readonly [number, number]>, pitchMM: number,
) => ReadonlyArray<readonly [number, number]>

export function withSpacingModes(
  frame: LibraryFrame, pitchMM: number, spacing96: SpacingSampler,
): LibraryFrame {
  const i = frame.layouts.findIndex((l) => l.name === SPACING_BASE)
  if (i < 0) return frame
  const nodes = spacing96(frame, frame.layouts[i].nodes, pitchMM)
  if (!nodes.length) return frame
  const mode: LibraryLayout = { name: SPACING_96, nodes }
  const layouts = [...frame.layouts]
  layouts.splice(i + 1, 0, mode)
  return { ...frame, layouts }
}
