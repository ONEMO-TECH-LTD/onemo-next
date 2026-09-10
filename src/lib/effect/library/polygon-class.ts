import { polygonPopulation, CANON_LAYOUT } from './canon'
import { boardPositions, placePointMM, rimLattice } from './geometry'
import { registryClass } from './registry-class'
import type { LibraryFrame } from './types'

/** The side counts the library publishes. FIVE UPWARDS: three sides is the triangle and four with a
 *  corner at the top is the diamond, and both already have families of their own — publishing them
 *  here would be one product arriving from two places. Twelve is where a polygon and the disc stop
 *  differing by more than the rim at these sizes. */
const SIDES = [5, 6, 7, 8, 9, 10, 12] as const

const sidesOfKey = (key: string): number => Number(key.slice(1, key.indexOf('-')))

/** POLYGON — the SQUARE CANON wrapped in a polygon, which is exactly what the circle is with a
 *  different boundary (Dan, 2026-09-06: "the polygon must be determined from the lattice ... apply
 *  circle logic and wrap square canon inside it").
 *
 *  So the magnets are the square's own population, unchanged — the lattice determines the layout —
 *  and only the outline differs, the pill's relationship to the rectangle. The size is arithmetic
 *  over those magnets, in closed form: see regularOutline. */
function polygonFrames(pitchMM: number): readonly LibraryFrame[] {
  const { cols, rows } = boardPositions(pitchMM)
  const side = Math.min(cols, rows)
  const rim = rimLattice(pitchMM)
  const out: LibraryFrame[] = []
  for (const sides of SIDES) for (let n = 1; n <= side; n++) {
    const { nodes } = polygonPopulation(sides, n, n, rim)
    const xs = nodes.map(([x]) => x), ys = nodes.map(([, y]) => y)
    const frame = {
      cols: Math.max(...xs) + 1, rows: Math.max(...ys) + 1,
      key: 'p' + sides + '-' + n + 'x' + n,
      layouts: [{ name: nodes.length === 1 ? 'single' : CANON_LAYOUT, nodes }],
    }
    // magnets off the board are not a frame the board can hold; whether the SHAPE fits is the
    // registry's question, asked once for every class
    if (frame.cols <= cols && frame.rows <= rows) out.push(frame)
  }
  return out
}

export const polygonClass = registryClass({
  classId: 'polygon',
  catalogueRole: 'preset',
  // A square patch has no portrait and no landscape, so there are no two orders to offer a turn
  // between — the same reason the circle sets this.
  bothOrdersPublished: true,
  types: SIDES.map((sides) => ({ id: String(sides), label: sides + ' sides' })),
  frames: polygonFrames,
  typeOfFrame: (frame) => String(sidesOfKey(frame.key!)),
  label: (frame) => { const n = frame.key!.slice(frame.key!.indexOf('-') + 1); return n.slice(0, n.indexOf('x')) + '×' + n.slice(n.indexOf('x') + 1) },
  orientations: [],
  outline: (frame, pitchMM) => {
    const sides = sidesOfKey(frame.key!)
    const n = Number(frame.key!.slice(frame.key!.indexOf('-') + 1).split('x')[0])
    const { centre } = polygonPopulation(sides, n, n, rimLattice(pitchMM))
    // through geometry's own placement, so the centre crosses to millimetres exactly as the magnets
    // do — writing the flip out here is what drew the shape about a mirrored centre
    return { corners: 'regular', sides, centreMM: placePointMM(frame.rows, centre, pitchMM) }
  },
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'polygon' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'polygon', frameKey }),
})
