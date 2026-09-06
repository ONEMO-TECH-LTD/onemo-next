import { frameOf } from './canon'
import { boardPositions } from './geometry'
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
  return SIDES.flatMap((sides) =>
    Array.from({ length: side }, (_, i) => {
      const n = i + 1
      return { ...frameOf(n, n), key: 'p' + sides + '-' + n + 'x' + n }
    }))
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
  label: (frame) => frame.cols + '×' + frame.rows,
  orientations: [],
  outline: (frame) => ({ corners: 'regular', sides: sidesOfKey(frame.key!) }),
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'polygon' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'polygon', frameKey }),
})
