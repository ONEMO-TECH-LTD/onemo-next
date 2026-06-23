// outline-core — public surface (A1a)
// Deterministic 2D outline foundation, shared by client worker + server compiler + golden tests.
// Schema lands first (this slice); the resolver/reducer/normalizer functions land next in A1a.
//
// (R5 — Creator v5) BOUNDARY: the v4/active Creator (effect-creator/v5.3.1 + lib/effect) imports its
// math from `./math` — the narrow active surface. The DOCUMENT RUNTIME re-exported below (OutlineDocument
// types, reducer/replayCommands, resolveOutlineDocument, SDF blend, livewire) is DORMANT — retained
// only for the retired v1/v2 editors. Do NOT import it into v4 code as authority (audit §8).

export * from './types'

// Reducer — KAI-9073: the dormant DOCUMENT runtime FUNCTIONS (replayCommands / applyOutlineCommands /
// assertReplayMatchesHash) are NOT on the public barrel — the retired v1/v2 editors import them from
// './reducer' directly. Only the types stay public, so the dead runtime isn't one barrel-import from active code.
export type { ReplayEnv, ReplayState } from './reducer'

// Hashing — canonical persistent projection + the pinned content hash (NIT-F1).
export { canonicalProjection, stableStringify, contentHash, outlineDocumentHash } from './hash'

// Resolver — KAI-9073: the dormant DOCUMENT functions (resolveOutlineDocument / applyCornerRadii) are
// NOT public — v1/v2 import them from './resolver' directly. The PURE MATH below stays public (active
// code uses ./math; tests + legacy use it here).
export {
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
export type { SdfBlendParams } from './sdf' // KAI-9073: resolveSdfBlend/prepareSdfBlend dormant — import from './sdf' directly

// Livewire pathfinder (A3b/c) — magnetic-lasso Dijkstra snap over an edge-cost grid.
export type { CostGrid } from './livewire' // KAI-9073: livewirePath dormant — import from './livewire' directly
