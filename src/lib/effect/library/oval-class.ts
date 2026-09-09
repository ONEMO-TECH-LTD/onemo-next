import { ovalFrames, ovalSizeMM } from './canon'
import { registryClass } from './registry-class'

/** OVAL — the ellipse the lattice holds, as a published record.
 *
 *  Dan, 2026-09-08: "we need to create oval as well". It is the circle's rule with two axes instead
 *  of one: take the rectangle canon, wrap it in an ellipse of that rectangle's own proportions, and
 *  keep every seat the ellipse can carry. A square population is left to the disc — an ellipse of
 *  square proportions IS a circle, and one product may not arrive from two families.
 *
 *  PRESET, not canon: an oval and the rectangle inside it present the same legal box, so which one a
 *  customer receives has to be a choice they made, never one the solver made — the pill's rule. */
export const ovalClass = registryClass({
  classId: 'oval',
  catalogueRole: 'preset',
  bothOrdersPublished: true,
  // three drawn shapes, not a taxonomy — the rectangle's slim/banner/frame says nothing about them
  types: [{ id: 'oval', label: 'oval' }],
  frames: ovalFrames,
  typeOfFrame: () => 'oval',
  // the drawn size is the product; the magnet count is what this lattice puts in it
  label: (frame) => { const s = ovalSizeMM(frame.key ?? '')
    return (s ? s.widthMM + '\u00d7' + s.heightMM : '?') + ' \u00b7 ' + frame.layouts[0].nodes.length },
  orientations: [],
  outline: (frame) => ({ corners: 'ellipse', ellipseMM: ovalSizeMM(frame.key ?? '') ?? undefined }),
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'oval' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'oval', frameKey }),
})
