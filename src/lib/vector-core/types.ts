// vector-core — the SVG-path-native geometry kernel (V3 vector reset, Run 1).
//
// A shape IS a path: a closed loop of ANCHORS with optional Bézier handles. Between two anchors
// the segment is a straight LINE when neither facing handle exists, else a CUBIC (a missing
// handle defaults to its endpoint — standard SVG semantics). No polylines live in this model;
// point chains exist only as flatten() output for consumers (mesh, payload, validators) at their
// own tolerance. Doctrine (Dan, locked): minimal intentional anchors — square 4 corners, heart
// its 2 cusps + 4 smooth, circle 4 smooth (kappa) — hidden by default, added on demand.
// Blueprint: v3/blueprint/modules/vector-core.md (+ companions/vectoriser-explained.md).

export interface Vec2 {
  x: number
  y: number
}

export interface VAnchor {
  /** anchor position (the kernel is unit-agnostic — px or unit space; the caller owns mapping) */
  p: Vec2
  /** incoming Bézier handle (shaping the segment that ARRIVES here); absent = straight side */
  hIn?: Vec2 | null
  /** outgoing Bézier handle (shaping the segment that LEAVES here); absent = straight side */
  hOut?: Vec2 | null
  /** true corner (cusp) — handles independent; false = smooth (handles mirror on edit) */
  corner: boolean
  /** V4 (VD9) STABLE ID — the editor's source+adjustments engine keys per-anchor adjustments
   *  (radius/curve) and pinning on this. Minted once at OutlineSource creation; PRESERVED through
   *  transformShape; FRESH on import / new-anchor / insert. Optional: anchors produced by the global
   *  fairing pass are transient (unclaimed) and need no durable id (V4 blueprint §4). */
  id?: string
}

/** One closed loop. Segment i runs anchors[i] → anchors[(i + 1) % n]. */
export interface VPath {
  anchors: VAnchor[]
}

/** A shape: outer loop first, holes after (winding normalized at flatten/export). */
export interface VShape {
  paths: VPath[]
}
