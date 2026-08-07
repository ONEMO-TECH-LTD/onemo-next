// vector-edit — the NODE/FRAME tool's math (I2e pure move out of cutout-lab/finish.ts):
// edit-grade skeleton, per-node engine local adjustments, bezier-exact insert/delete, node
// measurement, ring/path serialization. Pure over engine kernels — framework-free, liftable.

import { flattenShape, ringToVPath, shapeToSVGPathD, type VShape } from '@/lib/vector-core'
import { resampleClosedUniform, type Vec2Px } from '@/lib/outline-core'
import { GLOBAL_OFF, mintIds, resolve } from '@/lib/effect/outline-resolve'

/** Node knob scales — the ONE source; the lab's CHIP_RANGE imports these. */
export const NODE_KNOB_MAX = { radius: 200, curve: 200 } as const

/** EDIT-GRADE SKELETON: the engine's fitter reduces any resolved outline to sparse anchors with
 *  curve handles (corners >60° pinned as corner anchors) — visually identical, node count suitable
 *  for finger editing (Dan 2026-08-06: raw traces are uneditable on mobile). */
export function editableShape(shape: VShape): VShape {
  const flat = (flattenShape(shape, 0.5)[0] ?? []).map((q) => [q.x, q.y] as Vec2Px)
  if (flat.length < 3) return shape
  let perim = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < flat.length; i++) {
    const a = flat[i], b = flat[(i + 1) % flat.length]
    perim += Math.hypot(b[0] - a[0], b[1] - a[1])
    if (a[0] < minX) minX = a[0]; if (a[0] > maxX) maxX = a[0]
    if (a[1] < minY) minY = a[1]; if (a[1] > maxY) maxY = a[1]
  }
  const dense = resampleClosedUniform(flat, Math.max(2, perim / 500)).map(([x, y]) => ({ x, y }))
  const tol = Math.max(2, Math.min(maxX - minX, maxY - minY) * 0.01)
  const fitted = ringToVPath(dense, 60, tol)
  return fitted.anchors.length >= 3 ? { paths: [fitted] } : shape
}

/** PER-NODE vector edit through the ENGINE's local-adjustment machinery (outline-resolve
 *  LocalAdjustment: radius = single-corner fillet px, curve = tangent bend factor 0..2). The base
 *  shape stays immutable; each call re-resolves from it — reversible, value-true. */
/** Curve knob units (0–200) → engine bend factor (0–2): ONE mapping, shared by nodeAdjust and
 *  measureNode so the knob reads and writes the same scale. */
const NODE_CURVE_KNOB = 100
export function nodeAdjust(base: VShape, pi: number, ai: number, adj: { radius?: number; curveKnob?: number }): VShape {
  // SET-to-value semantics (Dan): sharpen the anchor first (corner, no handles), then apply the
  // engine's local fillet/bend — so radius 0 = a SHARP node, and every knob value is absolute,
  // not stacked on the current rounding.
  const sharpened: VShape = {
    paths: base.paths.map((path, i) => i !== pi ? path : ({
      anchors: path.anchors.map((a, j) => j !== ai ? a : ({ ...a, hIn: null, hOut: null, corner: true })),
    })),
  }
  const withIds = mintIds(sharpened)
  const id = withIds.paths[pi]?.anchors[ai]?.id
  if (!id) return base
  const engineAdj = { radius: adj.radius, curve: adj.curveKnob ? adj.curveKnob / NODE_CURVE_KNOB : undefined }
  if (!engineAdj.radius && !engineAdj.curve) return withIds // radius/curve 0 = the sharpened node
  return resolve(
    { shape: withIds, klass: 'generated', mmPerPx: 1, maskHeightPx: 1 },
    { global: { ...GLOBAL_OFF }, local: { [id]: engineAdj } },
  )
}

/** TRUE current values for a node (value reflection by MEASUREMENT): curvature radius from the
 *  circumcircle of (hIn, p, hOut); curve factor from handle length vs the engine's 0.33·edge base. */
export function measureNode(shape: VShape, pi: number, ai: number): { radius: number; curve: number } {
  const path = shape.paths[pi]
  const a = path?.anchors[ai]
  if (!a || (!a.hIn && !a.hOut)) return { radius: 0, curve: 0 }
  const n = path.anchors.length
  const prev = path.anchors[(ai - 1 + n) % n].p, next = path.anchors[(ai + 1) % n].p
  const eMin = Math.min(Math.hypot(a.p.x - prev.x, a.p.y - prev.y), Math.hypot(next.x - a.p.x, next.y - a.p.y)) || 1
  const hLen = Math.max(a.hIn ? Math.hypot(a.hIn.x - a.p.x, a.hIn.y - a.p.y) : 0, a.hOut ? Math.hypot(a.hOut.x - a.p.x, a.hOut.y - a.p.y) : 0)
  const curve = Math.round(Math.min(2, hLen / (0.33 * eMin)) * NODE_CURVE_KNOB)
  // local curvature radius AT the anchor: circumcircle of on-curve neighbours sampled just before
  // and after the node (handles are collinear on smooth anchors, so they can't be used directly)
  let radius = 0
  if (a.hIn && a.hOut) {
    const bez = (p0: {x:number;y:number}, c1: {x:number;y:number}, c2: {x:number;y:number}, p3: {x:number;y:number}, t: number) => {
      const u = 1 - t
      return { x: u*u*u*p0.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*p3.x, y: u*u*u*p0.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*p3.y }
    }
    const pv = path.anchors[(ai - 1 + n) % n], nx2 = path.anchors[(ai + 1) % n]
    const A = bez(pv.p, pv.hOut ?? pv.p, a.hIn, a.p, 0.85)
    const B = a.p
    const C = bez(a.p, a.hOut, nx2.hIn ?? nx2.p, nx2.p, 0.15)
    const ab = Math.hypot(B.x - A.x, B.y - A.y), bc = Math.hypot(C.x - B.x, C.y - B.y), ca = Math.hypot(A.x - C.x, A.y - C.y)
    const area2 = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y))
    radius = area2 > 1e-6 ? Math.round((ab * bc * ca) / (2 * area2)) : 0
  }
  return { radius: Math.min(NODE_KNOB_MAX.radius, radius), curve: Math.min(NODE_KNOB_MAX.curve, curve) } // clamped to the knob scale
}

/** Flattened ring of a shape (vector-core op kept OUT of the UI — module boundary). */
/** Insert an anchor ON the outline nearest (x,y) — exact bezier split (de Casteljau), so the
 *  curve is unchanged by insertion. Returns null when the tap is farther than `tol` from the line. */
/** Tap tolerance for inserting on the outline: finger-sized in image px, scale-aware. */
export const nodeTapTol = (imgW: number): number => Math.max(8, imgW / 60)
export function insertNode(shape: VShape, x: number, y: number, tol: number): { shape: VShape; pi: number; ai: number } | null {
  type Hit = { pi: number; ai: number; t: number; d: number }
  let best = null as Hit | null
  shape.paths.forEach((path, pi) => {
    const n = path.anchors.length
    for (let ai = 0; ai < n; ai++) {
      const a = path.anchors[ai], b = path.anchors[(ai + 1) % n]
      const p0 = a.p, c1 = a.hOut ?? a.p, c2 = b.hIn ?? b.p, p3 = b.p
      for (let k = 1; k < 32; k++) {
        const t = k / 32, u = 1 - t
        const px = u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x
        const py = u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y
        const d = Math.hypot(px - x, py - y)
        if (!best || d < best.d) best = { pi, ai, t, d }
      }
    }
  })
  if (!best || best.d > tol) return null
  const { pi, ai, t } = best
  const path = shape.paths[pi], n = path.anchors.length
  const a = path.anchors[ai], b = path.anchors[(ai + 1) % n]
  const p0 = a.p, c1 = a.hOut ?? a.p, c2 = b.hIn ?? b.p, p3 = b.p
  const lerp = (u: { x: number; y: number }, v: { x: number; y: number }) => ({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t })
  const q0 = lerp(p0, c1), q1 = lerp(c1, c2), q2 = lerp(c2, p3)
  const r0 = lerp(q0, q1), r1 = lerp(q1, q2), pt = lerp(r0, r1)
  const anchors = path.anchors.map((an, j) => {
    if (j === ai) return { ...an, hOut: an.hOut ? q0 : null }
    if (j === (ai + 1) % n) return { ...an, hIn: an.hIn ? q2 : null }
    return an
  })
  const inserted = { p: pt, hIn: a.hOut || b.hIn ? r0 : null, hOut: a.hOut || b.hIn ? r1 : null, corner: !(a.hOut || b.hIn) }
  anchors.splice(ai + 1, 0, inserted)
  return { shape: { paths: shape.paths.map((pp, j) => j === pi ? { anchors } : pp) }, pi, ai: ai + 1 }
}

/** Delete an anchor (min 3 must remain — a shape needs area). Neighbors keep their handles. */
export function deleteNode(shape: VShape, pi: number, ai: number): VShape | null {
  const path = shape.paths[pi]
  if (!path || path.anchors.length <= 3) return null
  return { paths: shape.paths.map((pp, j) => j === pi ? { anchors: pp.anchors.filter((_, k) => k !== ai) } : pp) }
}

export const shapeRing = (shape: VShape): { x: number; y: number }[] =>
  (flattenShape(shape, 0.5)[0] ?? []).map((p) => ({ x: p.x, y: p.y }))

/** SVG path of a shape (serialization kept OUT of the UI — module boundary). */
export const shapePathD = (shape: VShape): string => shapeToSVGPathD(shape, 2)
