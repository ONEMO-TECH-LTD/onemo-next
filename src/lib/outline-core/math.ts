// outline-core/math.ts — the NARROW active geometry-math surface (R5 — Creator v5).
//
// The v4/active Creator (effect-creator/v5.3.1 + lib/effect) imports its outline-core math from HERE,
// NOT from the full `./index` barrel — so the dormant document runtime (OutlineDocument, reducer,
// resolveOutlineDocument, SDF blend, livewire) is never one import away from active code (audit §8,
// the worst entanglement). This barrel re-exports ONLY pure ring/curve math, canonical hashing, and
// the Vec2Px tuple type, straight from the underlying modules (never re-exporting the runtime).
//
// The full `./index` barrel still unions everything for the retired v1/v2 editors; do NOT import the
// document runtime into v4 as authority — the kernel direction is Paper.js/Clipper2 (DEC-v5-02).

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
