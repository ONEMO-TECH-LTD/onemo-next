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
  filletPath,
  filletShape,
  shapeBBox,
  signedArea,
  type VSegment,
} from './path'

// Cubic fitting (Graphics Gems / Schneider) — offline preset baking, generator output, trace.
export { fitCubicsOpen, ringToVPath, cornerIndices, type CubicSeg } from './fit'
