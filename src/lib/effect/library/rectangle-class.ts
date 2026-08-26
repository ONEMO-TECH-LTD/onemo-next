import { RECTANGLE_FRAMES } from './corpus-rectangle'
import { box96, withSpacingModes } from './rules'
import { registryClass } from './registry-class'

const typeOf = (cols: number, rows: number) => Math.min(cols, rows) <= 1 ? 'slim' : Math.min(cols, rows) === 2 ? 'banner' : 'frame'

export const rectangleClass = registryClass({
  classId: 'rectangle',
  types: [{ id: 'frame', label: 'frame' }, { id: 'banner', label: 'banner' }, { id: 'slim', label: 'slim' }],
  frames: (pitchMM) => RECTANGLE_FRAMES.map((frame) => withSpacingModes(frame, pitchMM, box96)),
  typeOfFrame: (frame) => typeOf(frame.cols, frame.rows),
  label: (frame) => frame.cols + '×' + frame.rows,
  orientations: [{ id: 'portrait', view: { transpose: false, flipX: false, flipY: false } }, { id: 'landscape', view: { transpose: true, flipX: false, flipY: false } }],
  outline: { corners: 'sharp' },
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'rectangle' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'rectangle', frameKey }),
})
