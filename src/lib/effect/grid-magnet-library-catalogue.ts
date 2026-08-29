// grid-magnet-library-catalogue.ts — THE MATCHER: which layouts the library holds for a frame.
//
// It PROPOSES; it never adjudicates. The frame is a quantised capacity, not proof that a population
// fits a concave shape — a duck's mass box may read 3×4 while its material cannot hold the 3×4
// anywhere. Seating and wrap remain the only authorities on what actually fits.
//
// The old key was (shapeFamily, cx, cy): a hardcoded three-family enum with an invented fill < 0.68
// cut, so a wrong family silently deleted the right layout before anything else ran. It is gone.
// The key is now pitch + the ordered frame, which is the only structure there is — triangle and
// diamond are populations ON a frame, not alternatives to match against (Dan, 2026-08-29: "all are
// subsets of the square and rectangles").

import { catalogue, type CatalogueEntry } from './library'
import type { Pt } from './types'

/** A layout offered for a frame, and which way round it goes. The library stores one canonical
 *  record per frame; a landscape shape wears the same record turned. Publishing both orientations
 *  would duplicate the library to paper over a matcher that compares one number. */
export interface FrameMatch {
  readonly entry: CatalogueEntry
  /** True when the record is used turned — its own frame is the transpose of the asked-for one. */
  readonly transposed: boolean
  /** The entry's magnet centres IN THE ASKED-FOR ORIENTATION, mm, y-up. */
  readonly nodesMM: readonly Pt[]
}

const transposeNodes = (nodes: readonly (readonly [number, number])[]): Pt[] =>
  nodes.map(([x, y]) => [y, x] as Pt)

const keyOf = (nodes: readonly Pt[]): string =>
  nodes.map(([x, y]) => x.toFixed(3) + ',' + y.toFixed(3)).sort().join(';')

/** The catalogue is enumerated through the full materialisation path, so rebuilding it per lookup
 *  is the expensive part by orders of magnitude. Indexed once per pitch: the frame key is the only
 *  key there is, so the index IS the matcher's data structure rather than a cache over a search. */
const INDEX = new Map<number, Map<string, FrameMatch[]>>()
const frameKey = (cols: number, rows: number) => cols + 'x' + rows

function indexAt(pitchMM: number): Map<string, FrameMatch[]> {
  const hit = INDEX.get(pitchMM)
  if (hit) return hit
  const index = new Map<string, FrameMatch[]>()
  const push = (key: string, match: FrameMatch) => index.set(key, [...(index.get(key) ?? []), match])
  for (const entry of catalogue(pitchMM)) {
    const nodesMM = entry.nodesMM.map(([x, y]) => [x, y] as Pt)
    push(frameKey(entry.frameCols, entry.frameRows), { entry, transposed: false, nodesMM })
    // A square frame matches itself both ways round. That is a second arrangement whenever the
    // population is not symmetric about the diagonal (a triangle on a 4x4), and the same magnets
    // when it is — so the identical set is dropped and the genuinely different one is kept.
    const turned = transposeNodes(entry.nodesMM)
    const sameFrame = entry.frameCols === entry.frameRows
    if (!sameFrame || keyOf(turned) !== keyOf(nodesMM))
      push(frameKey(entry.frameRows, entry.frameCols), { entry, transposed: true, nodesMM: turned })
  }
  INDEX.set(pitchMM, index)
  return index
}

/**
 * Every catalogue layout that lives on this frame at this pitch, in this orientation.
 *
 * NO COUNT IS FROZEN and no single winner is chosen: several entries legitimately share one frame
 * — a 5×5 carries a square, a diamond and three triangles — and picking between them here would be
 * exactly the invented filter the pipeline forbids. All of them come back with their distinct
 * identities, and the material decides.
 */
export function layoutsForFrame(
  cols: number, rows: number, pitchMM: number,
): readonly FrameMatch[] {
  return indexAt(pitchMM).get(frameKey(cols, rows)) ?? []
}

/** Every entry at this pitch, unmatched — the catalogue as the certified reference set. */
export function catalogueAt(pitchMM: number): readonly CatalogueEntry[] {
  return catalogue(pitchMM)
}
