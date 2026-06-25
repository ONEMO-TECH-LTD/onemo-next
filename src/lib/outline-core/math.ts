// outline-core/math.ts — the NARROW active geometry-math surface (R5 — Creator v5).
//
// The active Creator (effect-creator/v5.3.1 + lib/effect) imports its outline-core math from HERE.
// Re-exports ONLY the live ring/curve math, canonical hashing, and the Vec2Px tuple type, straight
// from the underlying modules. The OutlineDocument document-runtime was removed in the v5.5.1
// de-slop — VShape is the source of truth (DEC-v5-02 / DEC-v5-03); the kernel direction is
// Paper.js/Clipper2.

export {
  rdpClosed,
  fairTracedRing,
  fairingFromDetail,
  BEN_DEFAULT_DETAIL,
  validateSelfIntersection,
  repairSimplePolygon,
  normalizeRing,
  signedArea,
  type FairTracedRingOpts,
} from './resolver'
export { contentHash, stableStringify } from './hash'
export type { Vec2Px } from './types'
