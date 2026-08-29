import { frameOf } from './canon'
import { boardPositions } from './geometry'
import { registryClass } from './registry-class'
import { pickLayout } from './selection-transition'
import { frameKeyOf } from './transforms'
import type { ClassOrientationChoice } from './class-contract'
import type { LibraryFrame, LibrarySelection } from './types'

const IDENTITY = { transpose: false, flipX: false, flipY: false }
const parseFrame = (key: string): [number, number] => {
  const [c, r] = key.split('x').map(Number)
  return [c, r]
}

/** THE ORIENTATION ROW, owned by the records rather than by a transform.
 *
 *  Portrait and landscape are two layouts, so turning one into the other is a SELECTION, not a
 *  view: the toggle moves to the transposed frame, and the view stays identity because the target
 *  frame already carries its own orientation. Where the transpose would not fit the board — 3x10
 *  exists, 10x3 does not on a 9-wide board — the choice is offered but disabled rather than
 *  silently landing somewhere else. */
function rectangleOrientationChoices(
  sel: LibrarySelection, pitchMM: number,
): readonly ClassOrientationChoice[] {
  const [cols, rows] = parseFrame(sel.frameKey)
  const frames = rectangleFrames(pitchMM)
  const byKey = new Map(frames.map((f) => [frameKeyOf(f), f]))
  const subtype = typeOf(cols, rows)
  const choiceFor = (id: 'portrait' | 'landscape'): ClassOrientationChoice => {
    const wantTall = id === 'portrait'
    const active = wantTall ? rows > cols : cols > rows
    if (active) return { id, label: id, active: true, next: { ...sel, view: { ...IDENTITY } } }
    // the exact turn of the selected frame, when the board holds it
    const turned = byKey.get(rows + 'x' + cols)
    // otherwise the first frame of the SAME subtype facing the requested way
    const fallback = turned ?? frames.find((f) =>
      typeOf(f.cols, f.rows) === subtype && (wantTall ? f.rows > f.cols : f.cols > f.rows))
    if (!fallback) return { id, label: id, active: false, disabled: true, next: sel }
    return {
      id, label: id, active: false,
      next: {
        ...sel, frameKey: frameKeyOf(fallback),
        layoutId: pickLayout(fallback, sel.layoutId), view: { ...IDENTITY },
      },
    }
  }
  return [choiceFor('portrait'), choiceFor('landscape')]
}

/** SUBTYPE — how narrow the rectangle is, on its minor axis. Independent of which way round it
 *  sits: a 2x5 and a 5x2 are both banners. Folding orientation into the subtype id destroyed that,
 *  and you could no longer ask what subtype a frame is without parsing a name. */
const typeOf = (cols: number, rows: number) => Math.min(cols, rows) <= 1 ? 'slim' : Math.min(cols, rows) === 2 ? 'banner' : 'frame'

/** RECTANGLE — canon, and PORTRAIT AND LANDSCAPE ARE SEPARATE LAYOUTS (Dan, 2026-08-30).
 *
 *  They used to be one tall record with the wide form left to a view toggle on the library page.
 *  That published 54 tall rectangles and zero wide ones, so a landscape shape had nothing to match:
 *  every proportion in the catalogue was 1.00 or taller, and a wide shape's 0.71 found no nearest
 *  class at all. Recognition is a proportion compared against the canon table, so the table has to
 *  contain both sides of 1.00 or half the shapes are unrecognisable by construction.
 *
 *  A 3x4 and a 4x3 are different products — different magnets in different places on the board —
 *  and each is now its own record with its own frame, band and identity. */
function rectangleFrames(pitchMM: number): readonly LibraryFrame[] {
  const { cols, rows } = boardPositions(pitchMM)
  const out: LibraryFrame[] = []
  for (let c = 1; c <= cols; c++) for (let r = c + 1; r <= rows; r++) {
    out.push(frameOf(c, r))
    // the same frame turned: a wide record, published in its own right. The board is 9 wide and
    // 11 tall, so a turned frame only exists where the board can actually hold it.
    if (r <= cols) out.push(frameOf(r, c))
  }
  return out
}

export const rectangleClass = registryClass({
  classId: 'rectangle',
  catalogueRole: 'canon',
  types: [{ id: 'frame', label: 'frame' }, { id: 'banner', label: 'banner' }, { id: 'slim', label: 'slim' }],
  frames: (pitchMM) => rectangleFrames(pitchMM),
  typeOfFrame: (frame) => typeOf(frame.cols, frame.rows),
  label: (frame) => frame.cols + '×' + frame.rows,
  // The Orientation row STAYS — Dan asked for the toggle to select separate layouts, not for the
  // toggle to go. It is record-owned for the rectangle: see orientationChoices below, which moves
  // the selection to the transposed FRAME instead of applying a view to this one.
  orientations: [],
  orientationChoices: rectangleOrientationChoices,
  outline: { corners: 'sharp' },
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'rectangle' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'rectangle', frameKey }),
})
