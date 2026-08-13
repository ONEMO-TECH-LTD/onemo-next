// outline-core — geometry-ring primitives (live surface)
//
// Pure numeric types in SOURCE-IMAGE px for the live ring-math (rdpClosed / fairTracedRing /
// normalizeRing / validateSelfIntersection / repair). px → mm happens downstream via the engine
// transform_chain. The OutlineDocument document-runtime model was removed in the v5.5.1 de-slop —
// VShape is the source of truth (DEC-v5-02 / DEC-v5-03). Pure + deterministic: no DOM, no three.js.

/** A point in SOURCE-IMAGE pixel space. */
export type Vec2Px = [number, number]

/** An arc-length span along a ring's perimeter, in px (used by locators + segment confidence). */
export interface ArcLengthRangePx {
  ringId: string
  startPx: number
  endPx: number
}

// Corner radius — metadata per node (AMEND-C6). 2D `outlineCornerRadiusPx` is DISTINCT from the
// 3D `edgeProfileRadiusMm` (the material bullnose) — never call both "radius".
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

/** Per-segment confidence for snapped (livewire) segments — AMEND-C7. */
export interface SegmentConfidence {
  mean: number
  min: number
  weakRanges: ArcLengthRangePx[]
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
  snap?: { source: 'image_edge' | 'manual'; confidence: number }
  segmentToNext?: OutlineSegment
}

// Rings — discriminated union (AMEND-C3): outer forbids parentRingId, hole requires it.
// `winding` is DERIVED (normalized), not user-authored.
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

/**
 * Validation locators (AMEND-C8/F3) — every geometry-mapped gate carries locators so a failure
 * highlights the exact editable entity inline.
 */
export type GeometryLocator =
  | { kind: 'node'; ringId: string; nodeId: string }
  | { kind: 'segment'; ringId: string; fromNodeId: string; toNodeId: string }
  | { kind: 'arc_length_range'; ringId: string; startPx: number; endPx: number }
