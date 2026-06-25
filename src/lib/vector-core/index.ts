// vector-core — public contract (the ONLY importable surface; no reach-ins past this barrel).
// Blueprint: v3/blueprint/modules/vector-core.md

export type { Vec2, VAnchor, VPath, VShape } from './types'
export {
  segmentAt,
  segments,
  cubicPoint,
  flattenPath,
  flattenShape,
  toSVGPathD,
  shapeToSVGPathD,
  transformPath,
  transformShape,
  // KAI-9071 (invariant 2 — ONE fillet engine): filletPath/filletShape (the old hand-rolled fillet)
  // are NOT in the public barrel — production rounds via the Paper kernel only. They moved out of
  // production ./path entirely (v5.5.1 de-slop) to __tests__/fillet-fixtures.ts; tests import from there.
  splitCubic,
  shapeBBox,
  signedArea,
  type VSegment,
} from './path'

// Ring → fitted VPath (Graphics Gems / Schneider cubic fitting) — offline preset baking + generator
// output. fitCubicsOpen / cornerIndices / CubicSeg are live-internal (ringToVPath + ops use them), not public.
export { ringToVPath } from './fit'

// Points-on-demand ops (Run 6) — exact insert, nearest-point, delete-with-refit.
// insertAnchorAt is live-internal (insertAnchorCentered calls it) but NOT a public API — tests import it from './ops' directly.
export { nearestOnPath, insertAnchorCentered, deleteAnchorRefit, scaleAnchorTension, type PathHit } from './ops'
