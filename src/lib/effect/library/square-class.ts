import { boardPositions, frameOf } from './canon'
import { registryClass } from './registry-class'
import type { LibraryFrame } from './types'

/** SQUARE — canon. Every square frame the board holds at this lattice, at full coverage. */
function squareFrames(pitchMM: number): readonly LibraryFrame[] {
  const { cols, rows } = boardPositions(pitchMM)
  return Array.from({ length: Math.min(cols, rows) }, (_, i) => frameOf(i + 1, i + 1))
}

export const squareClass = registryClass({
  classId: 'square',
  types: [{ id: 'box', label: 'box' }],
  frames: (pitchMM) => squareFrames(pitchMM),
  typeOfFrame: () => 'box',
  label: (frame) => frame.cols + '×' + frame.rows,
  orientations: [],
  outline: { corners: 'sharp', pointRotationDeg: 0 },
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'square' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'square', frameKey }),
})
