// outline-core — public surface (A1a)
// Deterministic 2D outline foundation, shared by client worker + server compiler + golden tests.
// Schema lands first (this slice); the resolver/reducer/normalizer functions land next in A1a.

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
  catmullRomClosed,
  signedArea,
  dedup,
  rdpClosed,
  type ResolveOptions,
} from './resolver'

// SDF blend (A2b) — 0→100% square↔silhouette morph, same client/server parity.
// prepareSdfBlend = fields-once evaluator for live sliders (V1-recovery F1).
export { resolveSdfBlend, prepareSdfBlend, type SdfBlendParams } from './sdf'

// Livewire pathfinder (A3b/c) — magnetic-lasso Dijkstra snap over an edge-cost grid.
export { livewirePath, type CostGrid } from './livewire'
