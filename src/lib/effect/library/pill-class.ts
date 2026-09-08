import { pillAxisOfKey, pillFrames, pillTypeOf } from './canon'
import { registryClass } from './registry-class'

/** PILL — the rectangle's layout, wrapped by a stadium (Dan, 2026-09-04: "we need to wrap rectangle
 *  layouts with pill shapes", "circle + rectangle shape behaviour", "it is rounded corner rectangle
 *  not oval pill", and "pill shape must be the same as rectangle slim/banner and frame").
 *
 *  Same frames, same subtypes, same published portrait/landscape pair — both take them from the CANON
 *  rather than one class importing another: a second frame list would be one edit away from disagreeing.
 *
 *  One thing differs from the rectangle: the outline. "You expand rectangle to the next band by 48mm
 *  round corners and center it to the prior band" — the corner radius is half the width, and the shape
 *  grows along its length by exactly that much so every magnet, corners included, keeps its 12mm rim.
 *  No magnet is dropped and the rim never moves; the pill grows instead. A one-wide frame grows by
 *  nothing, because there the rim already is half the width.
 *
 *  PRESET, not canon: a slim frame already has a canon rectangle record, and the two differ only at
 *  the edge. Which one a customer receives has to be a choice they made, never one the solver made.
 *  Both orders are published, so the page offers no turn. */
export const pillClass = registryClass({
  classId: 'pill',
  catalogueRole: 'preset',
  bothOrdersPublished: true,
  // fatter with each step: frame → stadium → o-shape; then the two narrow kinds
  types: [{ id: 'frame', label: 'frame' }, { id: 'stadium', label: 'stadium' }, { id: 'o-shape', label: 'o-shape' }, { id: 'banner', label: 'banner' }, { id: 'slim', label: 'slim' }],
  frames: pillFrames,
  typeOfFrame: pillTypeOf,
  // a square extent lies either way, and the chip says which: ↕ is a tall pill, ↔ a wide one
  label: (frame) => frame.cols + '×' + frame.rows
    + (pillAxisOfKey(frame.key ?? '') === 'x' ? ' ↕' : pillAxisOfKey(frame.key ?? '') === 'y' ? ' ↔' : ''),
  orientations: [],
  outline: (frame) => ({ corners: 'stadium', across: pillAxisOfKey(frame.key ?? '') }),
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'pill' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'pill', frameKey }),
})
