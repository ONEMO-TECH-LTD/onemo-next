import { circleFrames } from './canon'
import { registryClass } from './registry-class'

/** CIRCLE — the round shape as a PUBLISHED record rather than something the solver has to discover.
 *
 *  Dan, 2026-09-06: "i need to add to the library circle so we do not guess it". The engine classifies
 *  a circle by its legal BOX, which is square, and then asks for a frame that a circle of that size
 *  cannot seat — a full 5x5 needs 296mm of diameter and band five stops at 263. What came back was a
 *  partial frame found by search: 18 of 25 magnets on the circle, 14 of 16 one band below, with the
 *  holes wherever the phase happened to fall.
 *
 *  The populations here are the ones a circle actually holds — every lattice node inside a growing
 *  radius, about a node or about a cell centre — so the record states the answer instead of the
 *  solver approximating it. The outline is the exact circle those magnets fit in.
 *
 *  PRESET, not canon: a round population that happens to be a full square (the nine-node disc IS the
 *  3x3) already has a canon record, and the two differ only at the edge. Which one a customer receives
 *  is their choice, never the solver's — the same rule the pill follows. */
export const circleClass = registryClass({
  classId: 'circle',
  catalogueRole: 'preset',
  bothOrdersPublished: true,
  types: [{ id: 'disc', label: 'disc' }],
  frames: circleFrames,
  typeOfFrame: () => 'disc',
  label: (frame) => frame.layouts.length === 1
    ? String(frame.layouts[0].nodes.length) + '⌾'
    : frame.cols + '×' + frame.rows,
  orientations: [],
  outline: { corners: 'disc' },
  validateDraft: () => [],
  draftMatches: (draft, _sel, frameKey) => draft.className === 'circle' && draft.frameKey === frameKey,
  draftIdParts: (_sel, frameKey) => ({ className: 'circle', frameKey }),
})
