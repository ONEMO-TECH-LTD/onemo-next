// outline-core — deterministic 2D outline foundation (A1a)
//
// The SINGLE SOURCE OF TRUTH for the Manual Sticker Maker editor is a plain numeric
// `OutlineDocument` in SOURCE-IMAGE px. No library object (Konva/Paper/Fabric) and no SVG
// path string is ever the model — the SVG render, the flattened manufacturing polygon, and
// the 3D mesh are ALL derived from this document. (ADDENDUM C §C1 / AMEND-C1..C9, F1..F3.)
//
// This module is consumed IDENTICALLY by the client worker, the server canonical compiler,
// and the golden tests, so screen and factory cannot disagree (AMEND-C9). It is pure +
// deterministic — no DOM, no three.js, no randomness, no Date.now().

// ─────────────────────────────────────────────────────────────────────────────
// Geometry primitives
// ─────────────────────────────────────────────────────────────────────────────

/** A point in SOURCE-IMAGE pixel space. px → mm happens downstream via the engine transform_chain. */
export type Vec2Px = [number, number]

/** An arc-length span along a ring's perimeter, in px (used by locators + livewire confidence). */
export interface ArcLengthRangePx {
  ringId: string
  startPx: number
  endPx: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Corner radius — metadata per node (AMEND-C6). 2D `outlineCornerRadiusPx` is DISTINCT from
// the 3D `edgeProfileRadiusMm` (the material bullnose, §Mesh/AMEND-8) — never call both "radius".
// ─────────────────────────────────────────────────────────────────────────────

export interface CornerSpec {
  mode: 'inherit' | 'manual' | 'sharp' | 'smooth'
  /** v1: convex = editable radius; concave/reflex = profile-min smoothing only; near-straight = no handle. */
  kind?: 'convex' | 'concave' | 'near_straight'
  roundingSide?: 'inside_material' | 'outside_material'
  /** 2D outline corner radius in px. NOT the 3D edgeProfileRadiusMm. */
  outlineCornerRadiusPx?: number
  locked?: boolean
  /** DERIVED (clamp uses θ = INTERIOR angle, see resolver). Non-persistent unless profile-hashed. */
  maxRadiusPx?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Nodes + segments
// ─────────────────────────────────────────────────────────────────────────────

/** Per-segment confidence for snapped (livewire) segments — AMEND-C7. */
export interface SegmentConfidence {
  mean: number
  min: number
  weakRanges: ArcLengthRangePx[]
}

/** Provenance for a segment produced by projecting onto the BEN2 boundary — AMEND-C13 (reset tooling). */
export interface Ben2BoundaryProjection {
  type: 'ben2_boundary_projection'
  maskHash: string
  sourceRange?: ArcLengthRangePx
}

export type OutlineSegment =
  | { type: 'line' }
  | { type: 'cubic'; c1: Vec2Px; c2: Vec2Px }
  | { type: 'catmull_rom'; tension: number }
  | {
      type: 'livewire'
      rawPolyline: Vec2Px[]
      fitted?: Vec2Px[]
      confidence?: SegmentConfidence
      generator?: Ben2BoundaryProjection
    }

/**
 * An editable control node. Dense sampled points are NOT editable handles — they live in derived
 * data (`segmentToNext.rawPolyline`, resolved/flattened caches). Editable roles only (AMEND-C13).
 */
export interface OutlineNode {
  id: string
  p: Vec2Px
  role: 'corner' | 'smooth' | 'manual_anchor' | 'livewire_anchor'
  corner: CornerSpec
  snap?: { source: 'ben2_boundary' | 'image_edge' | 'manual'; confidence: number }
  segmentToNext?: OutlineSegment
}

// ─────────────────────────────────────────────────────────────────────────────
// Rings — discriminated union (AMEND-C3): outer forbids parentRingId, hole requires it.
// `winding` is DERIVED (normalized), not user-authored.
// ─────────────────────────────────────────────────────────────────────────────

export type OutlineRing =
  | {
      id: string
      role: 'outer'
      parentRingId?: never
      closed: true
      winding?: 'ccw' | 'cw'
      nodes: OutlineNode[]
      locked?: boolean
    }
  | {
      id: string
      role: 'hole'
      parentRingId: string
      closed: true
      winding?: 'ccw' | 'cw'
      nodes: OutlineNode[]
      locked?: boolean
    }

// ─────────────────────────────────────────────────────────────────────────────
// Generators — how a base ring was produced
// ─────────────────────────────────────────────────────────────────────────────

/** SDF square↔silhouette blend generator (AMEND-C5). `resolveSdfBlend()` lands at A2b. */
export interface SdfBlendGenerator {
  type: 'sdf_blend'
  from: { type: 'rect' | 'rounded_rect'; rectPx: { x: number; y: number; w: number; h: number }; cornerRadiusPx: number }
  to: { type: 'ben2_silhouette'; maskHash: string }
  /** BOTH SDFs on the same grid; store sdf-grid→source-px so the contour doesn't drift on downscale. */
  rasterDomain: { widthPx: number; heightPx: number; scaleToSourcePx: Matrix3 }
  t: number // 0..1
  topologyPolicy: {
    components: 'largest' | 'reject_multiple' | 'preserve_all'
    holes: 'remove' | 'preserve' | 'reject'
    minComponentAreaPx2: number
    minHoleAreaPx2: number
  }
}

export type OutlineGenerator =
  | { type: 'ben2_auto'; maskHash: string; contourProfileHash?: string; smoothProfileHash?: string }
  | { type: 'manual' }
  | SdfBlendGenerator

/** Row-major 3×3 affine, [a, b, c, d, e, f, 0, 0, 1] flattened — pure data, no library dep. */
export type Matrix3 = [number, number, number, number, number, number, number, number, number]

// ─────────────────────────────────────────────────────────────────────────────
// Command log (canonical, semantic, replayable) ≠ UI undo (AMEND-C4)
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical semantic ops. A pointer drag coalesces to ONE MoveNode — never 500 pointermove deltas. */
export type OutlineCommand =
  | { op: 'MoveNode'; ringId: string; nodeId: string; to: Vec2Px }
  | { op: 'AddNode'; ringId: string; afterNodeId: string | null; node: OutlineNode }
  | { op: 'DeleteNode'; ringId: string; nodeId: string }
  | { op: 'SetCorner'; ringId: string; nodeId: string; corner: CornerSpec }
  | { op: 'SetGlobalCornerRadius'; outlineCornerRadiusPx: number }
  | { op: 'SetSmoothing'; smoothing: number }
  | { op: 'SetBlend'; t: number }
  | { op: 'BakeBase'; generator: OutlineGenerator }
  | { op: 'SetSegment'; ringId: string; fromNodeId: string; segment: OutlineSegment }

/** UI-local undo entry — related to commands, NOT identical (drag-coalesced). */
export interface UIUndoEntry {
  label: string
  commandIndex: number
}

/** Replay base — commands replay over this to reconstruct the document (provenance/audit, AMEND-F1). */
export interface OutlineBaseSnapshot {
  rings: OutlineRing[]
  style: OutlineStyle
  generator?: OutlineGenerator
}

export interface OutlineStyle {
  /** 2D outline corner radius — NOT 3D edgeProfileRadiusMm (§Mesh, AMEND-C6). */
  globalOutlineCornerRadiusPx: number
  smoothing: number // 0..1
}

// ─────────────────────────────────────────────────────────────────────────────
// The document — the single source of truth (build FIRST)
// ─────────────────────────────────────────────────────────────────────────────

export interface OutlineDocument {
  version: 1
  image: { widthPx: number; heightPx: number; sourceHash: string; orientation: 'baked' }
  mode: 'auto' | 'semi_auto' | 'manual'
  /** how the base ring was produced (ben2_auto | sdf_blend | manual). */
  generator?: OutlineGenerator
  rings: OutlineRing[]
  style: OutlineStyle
  /** canonical semantic ops, replayable → ShapeSpecDraft.outline_edit_ops (AMEND-C4). */
  commands: OutlineCommand[]
  /** UI-local undo (drag-coalesced) — related to commands, NOT identical (AMEND-C4). */
  undoStack?: UIUndoEntry[]
  /** replay base; compactedSnapshot? for long sessions. */
  baseSnapshot: OutlineBaseSnapshot
  /** true in Auto mode (A1d) — snapshot is view-only until "Edit outline" (CARRIED-1). */
  readonly?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation locators (AMEND-C8/F3) — every geometry-mapped gate MUST carry locators so a
// failure highlights the exact editable entity inline.
// ─────────────────────────────────────────────────────────────────────────────

export type GeometryLocator =
  | { kind: 'node'; ringId: string; nodeId: string }
  | { kind: 'segment'; ringId: string; fromNodeId: string; toNodeId: string }
  | { kind: 'arc_length_range'; ringId: string; startPx: number; endPx: number }

export interface ValidationIssue {
  code: string
  subsystem: string
  severity: 'block' | 'warn' | 'info'
  measured?: Record<string, number>
  threshold?: Record<string, number>
  repairability?: 'auto' | 'manual' | 'none'
}

export type EditorValidationIssue = ValidationIssue & {
  locators: GeometryLocator[]
  source: 'client_preview' | 'server_canonical'
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve policy + resolved output (AMEND-C2)
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedOutlinePolicy {
  smoothing_applied: boolean
  corner_radii_applied: boolean
  /** disable the engine's global filletCorners once per-node radii are applied (no double-round). */
  downstream_corner_rounding: 'disabled' | 'profile_only_if_no_node_radii'
}

/** Output of resolving an OutlineDocument into a flattened, normalized cut polygon (px). */
export interface ResolvedOutline {
  outlineDocumentHash: string
  /** resolved vector path (segments + smoothing + per-node corner radii applied), per ring. */
  resolvedRingsPx: Vec2Px[][]
  /** flattened cut polygon (profile tolerance), normalized closure/winding, per ring. */
  flattenedRingsPx: Vec2Px[][]
  flattenTolerancePx: number
  policy: ResolvedOutlinePolicy
  locators: GeometryLocator[]
  issues: EditorValidationIssue[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical compiler input (AMEND-C1 / F1) — two input modes; the outline path records
// approved-input provenance so remakes reuse the stored shape (never silently recompute).
// ─────────────────────────────────────────────────────────────────────────────

export interface MaskBasedDraftInput {
  kind: 'mask_based'
  approved_mask_ref: string
  mask_edit_ops: unknown[]
}

export interface OutlineBasedDraftInputEditing {
  kind: 'outline_based'
  state: 'editing'
  outline_document_ref: string
  outline_document_hash: string
  outline_edit_ops: OutlineCommand[]
  resolved_outline_preview_ref?: string
}

export interface OutlineBasedDraftInputApproved {
  kind: 'outline_based'
  state: 'approved'
  outline_document_ref: string
  outline_document_hash: string
  outline_edit_ops_hash: string
  /** REQUIRED on approval (AMEND-F1) — else the fail-closed canonicalization diff silently vanishes. */
  resolved_outline_preview_ref: string
  resolved_outline_preview_hash: string
  resolved_outline_policy_hash: string
}

export type ShapeSpecDraftInput =
  | MaskBasedDraftInput
  | OutlineBasedDraftInputEditing
  | OutlineBasedDraftInputApproved
