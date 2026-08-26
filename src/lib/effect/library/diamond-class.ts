import { DIAMOND_FRAMES } from './corpus-diamond'
import { withSpacingModes } from './rules'
import { registryClass } from './registry-factory'

export const diamondClass = registryClass({
  classId: 'diamond',
  types: [{ id: 'rhomb', label: 'rhomb' }],
  frames: (pitchMM) => DIAMOND_FRAMES.map((frame) => withSpacingModes('diamond', frame, pitchMM)),
  typeOfFrame: () => 'rhomb',
  label: (frame) => { const side = (frame.cols - 1) / 2 + 1; return side + '×' + side },
  orientations: [],
  outline: { corners: 'sharp', pointRotationDeg: 45 },
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'diamond' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'diamond', frameKey }),
})
