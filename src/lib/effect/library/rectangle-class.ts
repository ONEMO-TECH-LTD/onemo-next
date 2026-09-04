import { rectangularFrames, rectangularTypeOf } from './canon'
import { registryClass } from './registry-class'
import type { LibraryFrame } from './types'

/** RECTANGLE — canon, sharp-edged. Its frames and subtypes are the canon's (shared with the pill,
 *  which publishes the same frames finished round). PORTRAIT AND LANDSCAPE ARE SEPARATE LAYOUTS
 *  (Dan, 2026-08-30): both ordered frames are published, so the page offers no turn. */
export const rectangleClass = registryClass({
  classId: 'rectangle',
  catalogueRole: 'canon',
  bothOrdersPublished: true,
  types: [{ id: 'frame', label: 'frame' }, { id: 'banner', label: 'banner' }, { id: 'slim', label: 'slim' }],
  frames: (pitchMM) => rectangularFrames(pitchMM),
  typeOfFrame: (frame) => rectangularTypeOf(frame.cols, frame.rows),
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
