import { SQUARE_FRAMES } from './corpus-square'
import { box96, withSpacingModes } from './rules'
import { registryClass } from './registry-class'

export const squareClass = registryClass({
  classId: 'square',
  types: [{ id: 'box', label: 'box' }],
  frames: (pitchMM) => SQUARE_FRAMES.map((frame) => withSpacingModes(frame, pitchMM, box96)),
  typeOfFrame: () => 'box',
  label: (frame) => frame.cols + '×' + frame.rows,
  orientations: [],
  outline: { corners: 'sharp', pointRotationDeg: 0 },
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'square' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'square', frameKey }),
})
