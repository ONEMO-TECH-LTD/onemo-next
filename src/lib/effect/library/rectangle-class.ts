import { frameOf } from './canon'
import { boardPositions } from './geometry'
import { registryClass } from './registry-class'
import type { LibraryFrame } from './types'

/** SUBTYPE — how narrow the rectangle is, on its minor axis. Independent of which way round it
 *  sits: a 2×5 and a 5×2 are both banners. */
const typeOf = (cols: number, rows: number) => Math.min(cols, rows) <= 1 ? 'slim' : Math.min(cols, rows) === 2 ? 'banner' : 'frame'

/** RECTANGLE — canon, and PORTRAIT AND LANDSCAPE ARE SEPARATE LAYOUTS (Dan, 2026-08-30).
 *
 *  They used to be one tall record with the wide form left to a view toggle on the library page.
 *  That published 54 tall rectangles and zero wide ones, so the canon table held no corresponding
 *  landscape record for a wide shape. Both ordered frames are published now — where the board
 *  holds each: a 9-wide board carries 3×10 and cannot carry 10×3. */
function rectangleFrames(pitchMM: number): readonly LibraryFrame[] {
  const { cols, rows } = boardPositions(pitchMM)
  const out: LibraryFrame[] = []
  for (let c = 1; c <= cols; c++) for (let r = c + 1; r <= rows; r++) {
    out.push(frameOf(c, r))
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
  // NO ORIENTATION CONTROL. Dan, 2026-08-30: "lock canon without on page orientation, remove
  // orientation completely, leave the locked orientation." A canon record's orientation is part of
  // what it IS — a 3x4 and a 4x3 are two products, both published, and you choose the one you
  // want. A control that turned one into the other would be offering a transform over an identity
  // the record already fixed, which is how a 3x10 silently became a 4x3.
  orientations: [],
  outline: { corners: 'sharp' },
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'rectangle' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'rectangle', frameKey }),
})
