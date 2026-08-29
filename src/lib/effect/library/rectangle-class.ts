import { frameOf } from './canon'
import { boardPositions } from './geometry'
import { registryClass } from './registry-class'
import type { LibraryFrame } from './types'

const typeOf = (cols: number, rows: number) => Math.min(cols, rows) <= 1 ? 'slim' : Math.min(cols, rows) === 2 ? 'banner' : 'frame'

/** RECTANGLE — canon. Canonical form is TALL (cols < rows); the wide orientation is the transpose,
 *  published as a view by the matcher rather than duplicated here. */
function rectangleFrames(pitchMM: number): readonly LibraryFrame[] {
  const { cols, rows } = boardPositions(pitchMM)
  const out: LibraryFrame[] = []
  for (let c = 1; c <= cols; c++) for (let r = c + 1; r <= rows; r++) out.push(frameOf(c, r))
  return out
}

export const rectangleClass = registryClass({
  classId: 'rectangle',
  types: [{ id: 'frame', label: 'frame' }, { id: 'banner', label: 'banner' }, { id: 'slim', label: 'slim' }],
  frames: (pitchMM) => rectangleFrames(pitchMM),
  typeOfFrame: (frame) => typeOf(frame.cols, frame.rows),
  label: (frame) => frame.cols + '×' + frame.rows,
  orientations: [{ id: 'portrait', view: { transpose: false, flipX: false, flipY: false } }, { id: 'landscape', view: { transpose: true, flipX: false, flipY: false } }],
  outline: { corners: 'sharp' },
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'rectangle' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'rectangle', frameKey }),
})
