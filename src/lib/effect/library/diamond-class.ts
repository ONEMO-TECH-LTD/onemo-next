import { diamondMask, frameOf } from './canon'
import { boardPositions } from './geometry'
import { registryClass } from './registry-class'
import type { LibraryFrame } from './types'

/** DIAMOND — a PRESET, not canon (Dan, 2026-08-29: "the canon is square and rectangle, the rest are
 *  layouts for us to have for potential presets"). It is the square patch with the Manhattan mask
 *  applied; side n occupies a (2n-1) patch. */
function diamondFrames(pitchMM: number): readonly LibraryFrame[] {
  const { cols, rows } = boardPositions(pitchMM)
  const side = Math.min(cols, rows)
  const out: LibraryFrame[] = []
  for (let n = 1; (n - 1) * 2 + 1 <= side; n++) {
    const patch = (n - 1) * 2 + 1
    out.push(frameOf(patch, patch, (nodes) => diamondMask(patch, nodes)))
  }
  return out
}

export const diamondClass = registryClass({
  classId: 'diamond',
  catalogueRole: 'preset',
  types: [{ id: 'rhomb', label: 'rhomb' }],
  frames: (pitchMM) => diamondFrames(pitchMM),
  typeOfFrame: () => 'rhomb',
  label: (frame) => { const side = (frame.cols - 1) / 2 + 1; return side + '×' + side },
  orientations: [],
  outline: { corners: 'sharp', pointRotationDeg: 45 },
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'diamond' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'diamond', frameKey }),
})
