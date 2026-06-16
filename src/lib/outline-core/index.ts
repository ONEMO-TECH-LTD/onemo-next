// outline-core — public surface (A1a)
// Deterministic 2D outline foundation, shared by client worker + server compiler + golden tests.
// Schema lands first (this slice); the resolver/reducer/normalizer functions land next in A1a.
//
// (R5 — Creator v5) BOUNDARY: the v4/active Creator (effect-creator/v3 + lib/effect) imports its
// math from `./math` — the narrow active surface. The DOCUMENT RUNTIME re-exported below (OutlineDocument
// types, reducer/replayCommands, resolveOutlineDocument, SDF blend, livewire) is DORMANT — retained
// only for the retired v1/v2 editors. Do NOT import it into v4 code as authority (audit §8).

export * from './types'

// Reducer — canonical command replay + the AMEND-F1 provenance invariant.
export {
  replayCommands,
  applyOutlineCommands,
  assertReplayMatchesHash,
  type ReplayEnv,
  type ReplayState,
} from './reducer'

// Hashing — canonical persistent projection + the pinned content hash (NIT-F1).
export { canonicalProjection, stableStringify, contentHash, outlineDocumentHash } from './hash'

// Resolver — OutlineDocument → resolved + flattened/normalized cut polygon (AMEND-C2/C9).
export {
  resolveOutlineDocument,
  applyCornerRadii,
  flattenPath,
  normalizeRing,
  validateSelfIntersection,
  repairSimplePolygon,
  nodesFromTracedRing,
  fairTracedRing,
  fairingFromDetail,
  BEN_DEFAULT_DETAIL,
  catmullRomClosed,
  signedArea,
  dedup,
  rdpClosed,
  type ResolveOptions,
  type FairTracedRingOpts,
} from './resolver'

// SDF blend (A2b) — 0→100% square↔silhouette morph, same client/server parity.
// prepareSdfBlend = fields-once evaluator for live sliders (V1-recovery F1).
export { resolveSdfBlend, prepareSdfBlend, type SdfBlendParams } from './sdf'

// Livewire pathfinder (A3b/c) — magnetic-lasso Dijkstra snap over an edge-cost grid.
export { livewirePath, type CostGrid } from './livewire'
