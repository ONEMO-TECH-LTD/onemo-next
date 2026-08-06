// outline-core — public surface (live geometry math + canonical hashing)
//
// Active Creator code (effect-creator/v5.3.1 + lib/effect) imports from `./math` (the narrow
// surface). This barrel re-exports the live ring/curve math + canonical hashing for tests and
// shape-library. The OutlineDocument document-runtime (reducer / resolveOutlineDocument / SDF
// blend / livewire) was REMOVED in the v5.5.1 de-slop — VShape is the source of truth and the
// document model was retired (DEC-v5-02 / DEC-v5-03; the manufacturing compiler builds on VShape).

export * from './types'

export { stableStringify, contentHash } from './hash'

export {
  resampleClosedUniform,
  flattenPath,
  normalizeRing,
  validateSelfIntersection,
  repairSimplePolygon,
  fairTracedRing,
  fairingFromDetail,
  BEN_DEFAULT_DETAIL,
  catmullRomClosed,
  signedArea,
  dedup,
  rdpClosed,
  type FairTracedRingOpts,
} from './resolver'
